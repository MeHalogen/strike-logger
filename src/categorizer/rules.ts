import { StrikeCategory } from '../database/schema.js';
import type { CategoryId, StrikeSeverity } from '../database/schema.js';

export interface CategoryRule {
  category: CategoryId;
  keywords: string[];
  patterns: RegExp[];
  weight: number;
}

/**
 * Predefined categorization rules.
 *
 * Every value of {@link StrikeCategory} (except OTHER, which is the fallback)
 * has at least one rule so it can actually be auto-detected.
 */
export const CATEGORY_RULES: CategoryRule[] = [
  {
    category: StrikeCategory.MISSING_ERROR_HANDLING,
    keywords: ['try', 'catch', 'error handling', 'exception', 'throw', 'reject', 'finally'],
    patterns: [
      /no error handling/i,
      /missing (catch|try|error handling)/i,
      /unhandled (error|exception|promise|rejection)/i,
      /needs? try.*catch/i,
      /swallow(ed|s|ing)? (the )?(error|exception)/i,
      /empty catch/i,
    ],
    weight: 1.0,
  },
  {
    category: StrikeCategory.NULL_POINTER,
    keywords: ['null', 'undefined', 'typeerror', 'cannot read property', 'optional chaining', 'nullpointer'],
    patterns: [
      /cannot read propert(y|ies).*(of )?(undefined|null)/i,
      /null (reference|pointer)/i,
      /undefined is not/i,
      /(check|guard|handle).*(for )?(null|undefined)/i,
      /nullpointer(exception)?/i,
    ],
    weight: 1.0,
  },
  {
    category: StrikeCategory.RACE_CONDITION,
    keywords: ['race condition', 'concurrency', 'mutex', 'deadlock', 'atomic', 'semaphore'],
    patterns: [
      /race condition/i,
      /concurrent (access|modification)/i,
      /needs? (a )?(lock|mutex|semaphore)/i,
      /(dead|live)lock/i,
      /not thread.?safe/i,
    ],
    weight: 0.9,
  },
  {
    category: StrikeCategory.SQL_INJECTION,
    keywords: ['sql injection', 'sqli', 'prepared statement', 'parameterized query'],
    patterns: [
      /sql ?injection/i,
      /unsafe (sql )?query/i,
      /use (a )?prepared statement/i,
      /parameteri[sz]e.*quer/i,
      /string.?concat.*(sql|query)/i,
    ],
    weight: 1.0,
  },
  {
    category: StrikeCategory.XSS_VULNERABILITY,
    keywords: ['xss', 'cross-site scripting', 'innerhtml', 'dangerouslysetinnerhtml', 'sanitize html'],
    patterns: [
      /\bxss\b/i,
      /cross.?site scripting/i,
      /escape (html|output|user input)/i,
      /unsafe (html|innerhtml)/i,
      /dangerouslysetinnerhtml/i,
    ],
    weight: 1.0,
  },
  {
    category: StrikeCategory.HARDCODED_SECRET,
    keywords: ['api key', 'password', 'secret', 'token', 'credential', 'hardcoded', 'private key'],
    patterns: [
      /hard.?coded? (secret|password|api.?key|token|credential)/i,
      /exposed (credential|secret|key)/i,
      /use (an )?environment variable/i,
      /(secret|key|token) in (source|code|repo)/i,
    ],
    weight: 1.0,
  },
  {
    category: StrikeCategory.AUTH_BYPASS,
    keywords: ['authentication', 'authorization', 'auth bypass', 'access control', 'permission', 'privilege', 'unauthorized'],
    patterns: [
      /auth(entication|orization)? bypass/i,
      /missing (auth|permission|authorization) check/i,
      /broken access control/i,
      /privilege escalation/i,
      /(unauthori[sz]ed|unauthenticated) (access|user)/i,
      /idor/i,
    ],
    weight: 1.0,
  },
  {
    category: StrikeCategory.MISSING_TESTS,
    keywords: ['test', 'unit test', 'spec', 'untested'],
    patterns: [
      /missing test/i,
      /needs? (a )?(unit |integration )?test/i,
      /no tests?\b/i,
      /add(ed)? tests?/i,
      /untested/i,
    ],
    weight: 0.8,
  },
  {
    category: StrikeCategory.INSUFFICIENT_COVERAGE,
    keywords: ['coverage', 'edge case', 'untested path', 'branch coverage'],
    patterns: [
      /(insufficient|low|poor|no) (test )?coverage/i,
      /(missing|untested) edge case/i,
      /uncovered (branch|path|case)/i,
      /increase coverage/i,
    ],
    weight: 0.7,
  },
  {
    category: StrikeCategory.N_PLUS_ONE_QUERY,
    keywords: ['n+1', 'eager load', 'lazy load', 'select in loop'],
    patterns: [
      /n\s*\+\s*1 (query|problem|select)/i,
      /quer(y|ies) (in|inside) (a )?loop/i,
      /use (a )?(join|eager load|batch)/i,
      /(select|fetch) (in|per) (loop|iteration)/i,
    ],
    weight: 0.9,
  },
  {
    category: StrikeCategory.INEFFICIENT_ALGORITHM,
    keywords: ['inefficient', 'complexity', 'performance', 'slow', 'quadratic', 'optimize'],
    patterns: [
      /inefficient (algorithm|loop|code)/i,
      /o\(n\^?2\)|quadratic|exponential complexity/i,
      /nested loops?.*(slow|perf)/i,
      /(should|could) be optimi[sz]ed/i,
      /unnecessary (re-?computation|iteration|allocation)/i,
    ],
    weight: 0.7,
  },
  {
    category: StrikeCategory.MEMORY_LEAK,
    keywords: ['memory leak', 'leak', 'cleanup', 'dispose', 'unsubscribe', 'clearinterval'],
    patterns: [
      /memory leak/i,
      /not (cleaned up|disposed|released)/i,
      /(missing|needs?) cleanup/i,
      /dispose.*resource/i,
      /(missing|forgot).*(unsubscribe|clearinterval|cleartimeout|removeeventlistener)/i,
    ],
    weight: 0.9,
  },
  {
    category: StrikeCategory.TIGHT_COUPLING,
    keywords: ['coupling', 'dependency', 'decouple', 'hard dependency'],
    patterns: [
      /tight(ly)? coupled/i,
      /(direct|hard) dependency/i,
      /use (an? )?(interface|abstraction)/i,
      /decouple/i,
      /depends? directly on/i,
    ],
    weight: 0.7,
  },
  {
    category: StrikeCategory.MISSING_ABSTRACTION,
    keywords: ['abstraction', 'duplication', 'duplicated', 'repeated code', 'extract'],
    patterns: [
      /missing abstraction/i,
      /(code )?duplication|duplicated (code|logic)/i,
      /extract (a )?(function|method|class|helper)/i,
      /repeated (logic|code|block)/i,
      /violates dry/i,
    ],
    weight: 0.6,
  },
  {
    category: StrikeCategory.WRONG_PATTERN,
    keywords: ['anti-pattern', 'antipattern', 'wrong pattern', 'god object', 'singleton'],
    patterns: [
      /(wrong|incorrect|inappropriate) (design )?pattern/i,
      /anti.?pattern/i,
      /god (object|class)/i,
      /misuse of (the )?\w+ pattern/i,
      /should use (a )?\w+ pattern/i,
    ],
    weight: 0.6,
  },
  {
    category: StrikeCategory.INCONSISTENT_NAMING,
    keywords: ['naming', 'convention', 'consistent', 'rename', 'camelcase', 'snake_case'],
    patterns: [
      /inconsistent naming/i,
      /naming convention/i,
      /rename to match/i,
      /(camel|snake|pascal).?case/i,
    ],
    weight: 0.5,
  },
  {
    category: StrikeCategory.MISSING_DOCUMENTATION,
    keywords: ['documentation', 'comment', 'jsdoc', 'docstring', 'undocumented'],
    patterns: [
      /missing (documentation|docs?|comment)/i,
      /needs? (documentation|docs?)/i,
      /add (a )?(comment|docstring|jsdoc)/i,
      /undocumented/i,
    ],
    weight: 0.5,
  },
];

export interface CategorizationResult {
  category: CategoryId;
  /** Raw weighted score of the winning rule. */
  score: number;
  /** Winning score as a fraction of total score across all matched rules (0-1). */
  confidence: number;
}

/**
 * Score `text` against a set of rules and return the ranked matches.
 * Exposed so callers (e.g. reporting, tests) can inspect confidence.
 */
export function scoreCategories(
  description: string,
  code?: string,
  rules: CategoryRule[] = CATEGORY_RULES
): CategorizationResult[] {
  const text = `${description} ${code || ''}`.toLowerCase();
  const scored: CategorizationResult[] = [];

  for (const rule of rules) {
    let score = 0;

    for (const keyword of rule.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += 0.5;
      }
    }

    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        score += 1.5;
      }
    }

    score *= rule.weight;

    if (score > 0) {
      scored.push({ category: rule.category, score, confidence: 0 });
    }
  }

  const total = scored.reduce((sum, r) => sum + r.score, 0);
  for (const result of scored) {
    result.confidence = total > 0 ? result.score / total : 0;
  }

  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Match description (and optionally code) against category rules.
 * Returns the single best-matching category, or OTHER when nothing is confident.
 */
export function categorizeByRules(
  description: string,
  code?: string,
  rules: CategoryRule[] = CATEGORY_RULES
): CategoryId {
  const [best] = scoreCategories(description, code, rules);
  return best && best.score > 0.5 ? best.category : StrikeCategory.OTHER;
}

/**
 * Categorize and also report how confident the match is. Useful for
 * interactive/auto flows that want to surface low-confidence guesses.
 */
export function categorizeDetailed(
  description: string,
  code?: string,
  rules: CategoryRule[] = CATEGORY_RULES
): CategorizationResult {
  const [best] = scoreCategories(description, code, rules);
  if (!best || best.score <= 0.5) {
    return { category: StrikeCategory.OTHER, score: 0, confidence: 0 };
  }
  return best;
}

/**
 * Suggest severity based on category and description.
 * An optional `overrides` map (from user config) takes precedence over heuristics.
 */
export function suggestSeverity(
  category: CategoryId,
  description: string,
  overrides?: Record<string, StrikeSeverity>
): StrikeSeverity {
  if (overrides && overrides[category]) {
    return overrides[category];
  }

  const text = description.toLowerCase();

  // Critical indicators
  if (
    category === StrikeCategory.SQL_INJECTION ||
    category === StrikeCategory.XSS_VULNERABILITY ||
    category === StrikeCategory.AUTH_BYPASS ||
    text.includes('critical') ||
    text.includes('vulnerabilit') ||
    text.includes('exploit') ||
    text.includes('rce') ||
    text.includes('data breach')
  ) {
    return 'critical';
  }

  // High severity indicators
  if (
    category === StrikeCategory.HARDCODED_SECRET ||
    category === StrikeCategory.RACE_CONDITION ||
    category === StrikeCategory.MEMORY_LEAK ||
    category === StrikeCategory.N_PLUS_ONE_QUERY ||
    text.includes('breaks') ||
    text.includes('crash') ||
    text.includes('data loss') ||
    text.includes('corrupt')
  ) {
    return 'high';
  }

  // Low severity indicators
  if (
    category === StrikeCategory.INCONSISTENT_NAMING ||
    category === StrikeCategory.MISSING_DOCUMENTATION ||
    text.includes('minor') ||
    text.includes('nitpick') ||
    text.includes('style') ||
    text.includes('typo')
  ) {
    return 'low';
  }

  // Default to medium
  return 'medium';
}
