import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { categorizeByRules, suggestSeverity } from '../src/categorizer/rules.js';
import { StrikeCategory, Strike } from '../src/database/schema.js';
import { injectAntiPatternsIntoWorkspace } from '../src/templates/injector.js';
import { registerPreCommitHook, unregisterPreCommitHook } from '../src/hooks/hook-manager.js';

describe('Strike Logger Unit Tests', () => {
  describe('Categorization and Severity Rules', () => {
    it('should categorize missing error handling correctly', () => {
      const desc = 'Unhandled promise rejection in API caller';
      const code = 'fetch(url).then(res => res.json())';
      const cat = categorizeByRules(desc, code);
      expect(cat).toBe(StrikeCategory.MISSING_ERROR_HANDLING);
    });

    it('should categorize null pointer exceptions correctly', () => {
      const desc = 'Cannot read property price of undefined';
      const cat = categorizeByRules(desc);
      expect(cat).toBe(StrikeCategory.NULL_POINTER);
    });

    it('should suggest critical severity for SQL Injection', () => {
      const sev = suggestSeverity(StrikeCategory.SQL_INJECTION, 'Unsafe query building');
      expect(sev).toBe('critical');
    });

    it('should suggest low severity for style/naming issues', () => {
      const sev = suggestSeverity(StrikeCategory.INCONSISTENT_NAMING, 'Variables named incorrectly');
      expect(sev).toBe('low');
    });
  });

  describe('Spec File Auto-Injection', () => {
    const tempDir = join(process.cwd(), 'temp_test_workspace');
    
    const mockStrikes: Strike[] = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        category: StrikeCategory.NULL_POINTER,
        severity: 'high',
        source: {
          commit: 'abcdef1',
          file: 'app.js',
          lines: [1, 1],
          diff: 'const x = item.price;'
        },
        description: 'Check for null pointer',
        tags: [],
        resolved: false
      }
    ];

    beforeEach(() => {
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
      }
    });

    afterEach(() => {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should create .cursorrules if no spec files exist', async () => {
      const updated = await injectAntiPatternsIntoWorkspace(mockStrikes, tempDir);
      expect(updated).toContain('.cursorrules');
      
      const fileContent = readFileSync(join(tempDir, '.cursorrules'), 'utf-8');
      expect(fileContent).toContain('<!-- STRIKE-LOGGER-START -->');
      expect(fileContent).toContain('Check for null pointer');
      expect(fileContent).toContain('<!-- STRIKE-LOGGER-END -->');
    });

    it('should update existing spec files', async () => {
      const specPath = join(tempDir, '.clinespec');
      writeFileSync(specPath, 'Existing content\n<!-- STRIKE-LOGGER-START -->\nOld rules\n<!-- STRIKE-LOGGER-END -->\nFootnote');
      
      const updated = await injectAntiPatternsIntoWorkspace(mockStrikes, tempDir);
      expect(updated).toContain('.clinespec');
      
      const fileContent = readFileSync(specPath, 'utf-8');
      expect(fileContent).toContain('Existing content');
      expect(fileContent).toContain('Check for null pointer');
      expect(fileContent).toContain('Footnote');
    });
  });

  describe('Git Hooks Registration', () => {
    const tempDir = join(process.cwd(), 'temp_git_workspace');

    beforeEach(() => {
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
      }
    });

    afterEach(() => {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should fail registration if no .git directory exists', async () => {
      const success = await registerPreCommitHook(tempDir);
      expect(success).toBe(false);
    });

    it('should register hook successfully if .git/hooks directory exists', async () => {
      const gitHooksDir = join(tempDir, '.git', 'hooks');
      mkdirSync(gitHooksDir, { recursive: true });

      const success = await registerPreCommitHook(tempDir);
      expect(success).toBe(true);

      const hookFile = join(gitHooksDir, 'pre-commit');
      expect(existsSync(hookFile)).toBe(true);

      const content = readFileSync(hookFile, 'utf-8');
      expect(content).toContain('strike-logger hook --check');

      // Now unregister
      const unregSuccess = await unregisterPreCommitHook(tempDir);
      expect(unregSuccess).toBe(true);

      const postUnregContent = readFileSync(hookFile, 'utf-8');
      expect(postUnregContent).not.toContain('strike-logger hook --check');
    });
  });
});
