import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  categorizeByRules,
  categorizeDetailed,
  scoreCategories,
  suggestSeverity,
} from '../src/categorizer/rules.js';
import { StrikeCategory, Strike, StrikeDatabase } from '../src/database/schema.js';
import {
  compileUserRules,
  getEffectiveRules,
  labelForCategory,
  loadConfig,
} from '../src/config/config.js';
import {
  getCombinedChanges,
  getPrimaryFile,
  extractAddedLines,
  GitDiffInfo,
} from '../src/parsers/git-parser.js';
import {
  migrateDatabase,
  addStrike,
  resolveStrike,
  deleteStrike,
  findStrikeByIdPrefix,
  getAllStrikes,
} from '../src/database/strike-log.js';
import { scanDiffForViolations } from '../src/hooks/hook-manager.js';
import { generateHtmlReport, trendByMonth } from '../src/reporting/html.js';
import { generateWorkflow } from '../src/ci/ci.js';

describe('Expanded categorization rules', () => {
  it('detects auth bypass', () => {
    expect(categorizeByRules('Missing authorization check allows privilege escalation')).toBe(
      StrikeCategory.AUTH_BYPASS
    );
  });

  it('detects insufficient coverage', () => {
    expect(categorizeByRules('Insufficient test coverage on the error branch')).toBe(
      StrikeCategory.INSUFFICIENT_COVERAGE
    );
  });

  it('detects inefficient algorithm', () => {
    expect(categorizeByRules('This is an inefficient algorithm with quadratic complexity')).toBe(
      StrikeCategory.INEFFICIENT_ALGORITHM
    );
  });

  it('detects missing abstraction / duplication', () => {
    expect(categorizeByRules('Duplicated logic, extract a helper function')).toBe(
      StrikeCategory.MISSING_ABSTRACTION
    );
  });

  it('detects wrong pattern / anti-pattern', () => {
    expect(categorizeByRules('This is a god object anti-pattern')).toBe(StrikeCategory.WRONG_PATTERN);
  });

  it('falls back to OTHER when nothing matches', () => {
    expect(categorizeByRules('completely unrelated text about weather')).toBe(StrikeCategory.OTHER);
  });

  it('reports confidence and ranked matches', () => {
    const result = categorizeDetailed('Unhandled promise rejection, missing try catch');
    expect(result.category).toBe(StrikeCategory.MISSING_ERROR_HANDLING);
    expect(result.confidence).toBeGreaterThan(0);
    const ranked = scoreCategories('Unhandled promise rejection, missing try catch');
    expect(ranked[0].category).toBe(StrikeCategory.MISSING_ERROR_HANDLING);
  });
});

describe('Severity overrides', () => {
  it('honors a config-supplied override before heuristics', () => {
    expect(suggestSeverity('flaky_test', 'a flaky test', { flaky_test: 'critical' })).toBe('critical');
  });

  it('still uses heuristics without an override', () => {
    expect(suggestSeverity(StrikeCategory.SQL_INJECTION, 'unsafe query')).toBe('critical');
  });
});

describe('Custom config / rules', () => {
  it('compiles custom rules and skips invalid regex', () => {
    const rules = compileUserRules([
      { category: 'flaky_test', keywords: ['flaky'], patterns: ['\\bflaky\\b', '('], weight: 1.2 },
      { category: '', keywords: ['ignored'] },
    ]);
    expect(rules).toHaveLength(1);
    expect(rules[0].category).toBe('flaky_test');
    expect(rules[0].patterns).toHaveLength(1); // invalid '(' dropped
  });

  it('categorizes using effective (built-in + custom) rules', () => {
    const rules = getEffectiveRules({
      customRules: [{ category: 'flaky_test', keywords: ['flaky'], patterns: ['\\bflaky\\b'], weight: 1.5 }],
    });
    expect(categorizeByRules('this test is flaky', undefined, rules)).toBe('flaky_test');
  });

  it('resolves labels from config or humanizes the id', () => {
    expect(labelForCategory({ categoryLabels: { flaky_test: 'Flaky Tests' } }, 'flaky_test')).toBe(
      'Flaky Tests'
    );
    expect(labelForCategory({}, 'null_pointer')).toBe('Null Pointer');
  });
});

describe('Config loading', () => {
  const dir = join(process.cwd(), 'temp_config_ws');
  beforeEach(() => mkdirSync(dir, { recursive: true }));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('returns empty config when no file exists', async () => {
    expect(await loadConfig(dir)).toEqual({});
  });

  it('loads and sanitizes a config file', async () => {
    writeFileSync(join(dir, 'strike-logger.config.json'), JSON.stringify({ customRules: [{ category: 'x' }] }));
    const config = await loadConfig(dir);
    expect(config.customRules).toHaveLength(1);
    expect(config.categoryLabels).toEqual({});
  });

  it('does not throw on invalid JSON', async () => {
    writeFileSync(join(dir, '.strikerc.json'), '{ not valid json ');
    expect(await loadConfig(dir)).toEqual({});
  });
});

describe('Multi-file diff helpers', () => {
  const diffInfo: GitDiffInfo = {
    commit: 'abc123',
    message: 'fix stuff',
    author: 'a',
    date: 'd',
    files: [
      { file: 'small.ts', changes: '+one line', additions: 1, deletions: 0 },
      { file: 'big.ts', changes: '+lots\n+of\n+changes', additions: 10, deletions: 5 },
    ],
  };

  it('combines changes across all files', () => {
    expect(getCombinedChanges(diffInfo)).toContain('+one line');
    expect(getCombinedChanges(diffInfo)).toContain('+lots');
  });

  it('picks the most-changed file as primary', () => {
    expect(getPrimaryFile(diffInfo)?.file).toBe('big.ts');
  });

  it('extracts added lines only', () => {
    const added = extractAddedLines('diff --git\n+++ b/x\n+added line\n-removed\n context');
    expect(added).toEqual(['added line']);
  });
});

describe('Database migration & lifecycle', () => {
  const dir = join(process.cwd(), 'temp_db_ws');
  const dbPath = join(dir, 'strikes.json');
  beforeEach(() => mkdirSync(dir, { recursive: true }));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('backfills missing fields and recomputes stats', () => {
    const db = migrateDatabase({
      strikes: [
        { id: '1', timestamp: '2026-01-01T00:00:00Z', category: 'null_pointer', severity: 'high', source: {}, description: 'x', tags: [], resolved: false },
      ],
    });
    expect(db.config.aiModel).toBe('gpt');
    expect(db.statistics.totalStrikes).toBe(1);
    expect(db.statistics.bySeverity.high).toBe(1);
    expect(db.statistics.byCategory.null_pointer).toBe(1);
  });

  it('tolerates a non-object input', () => {
    const db = migrateDatabase(null);
    expect(db.strikes).toEqual([]);
    expect(db.statistics.totalStrikes).toBe(0);
  });

  it('supports add, resolve (by prefix), and delete', async () => {
    const strike = await addStrike(
      {
        category: StrikeCategory.NULL_POINTER,
        severity: 'high',
        source: { commit: 'c', file: 'f', lines: [1, 1], diff: '' },
        description: 'test strike',
        tags: [],
        resolved: false,
      },
      dbPath
    );

    const byPrefix = await findStrikeByIdPrefix(strike.id.substring(0, 8), dbPath);
    expect(byPrefix.strike?.id).toBe(strike.id);

    const resolved = await resolveStrike(strike.id, dbPath);
    expect(resolved?.resolved).toBe(true);
    expect(resolved?.resolvedAt).toBeDefined();

    const deleted = await deleteStrike(strike.id, dbPath);
    expect(deleted).toBe(true);
    expect(await getAllStrikes(dbPath)).toHaveLength(0);
  });
});

describe('Anti-pattern diff scanner (hook/CI core)', () => {
  const activeStrikes: Strike[] = [
    {
      id: '1',
      timestamp: new Date().toISOString(),
      category: StrikeCategory.NULL_POINTER,
      severity: 'high',
      source: { commit: 'c', file: 'f', lines: [1, 1], diff: '' },
      description: 'null pointer',
      tags: [],
      resolved: false,
    },
  ];

  it('flags added lines matching an active category', () => {
    const diff = '+++ b/app.ts\n+// check for null before deref';
    const violations = scanDiffForViolations(diff, activeStrikes);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].category).toBe(StrikeCategory.NULL_POINTER);
  });

  it('returns nothing when there are no active strikes', () => {
    expect(scanDiffForViolations('+anything', [])).toEqual([]);
  });

  it('ignores categories with no active strike', () => {
    const diff = '+++ b/app.ts\n+sql injection unsafe query';
    expect(scanDiffForViolations(diff, activeStrikes)).toEqual([]);
  });
});

describe('HTML report & CI workflow', () => {
  const stats: StrikeDatabase['statistics'] = {
    totalStrikes: 2,
    byCategory: { null_pointer: 1, flaky_test: 1 },
    bySeverity: { low: 0, medium: 1, high: 1, critical: 0 },
  };
  const strikes: Strike[] = [
    {
      id: '1',
      timestamp: '2026-01-15T00:00:00Z',
      category: 'null_pointer',
      severity: 'high',
      source: { commit: 'abcdef1', file: 'a.ts', lines: [1, 1], diff: '' },
      description: 'a <script> in description',
      tags: [],
      resolved: false,
    },
    {
      id: '2',
      timestamp: '2026-02-20T00:00:00Z',
      category: 'flaky_test',
      severity: 'medium',
      source: { commit: 'abcdef2', file: 'b.ts', lines: [1, 1], diff: '' },
      description: 'flaky',
      tags: [],
      resolved: true,
    },
  ];

  it('renders an HTML dashboard with escaped content and labels', () => {
    const html = generateHtmlReport(strikes, stats, { categoryLabels: { flaky_test: 'Flaky Tests' } });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Flaky Tests');
    expect(html).toContain('&lt;script&gt;'); // description escaped
    expect(html).not.toContain('<script> in description'); // not injected raw
  });

  it('buckets trend by month', () => {
    const trend = trendByMonth(strikes);
    expect(trend).toEqual([
      { month: '2026-01', count: 1 },
      { month: '2026-02', count: 1 },
    ]);
  });

  it('generates a valid-looking GitHub Actions workflow', () => {
    const yml = generateWorkflow();
    expect(yml).toContain('name: Strike Logger');
    expect(yml).toContain('strike-logger ci --check');
  });
});
