import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { StrikeSeverity, UserConfig, UserRuleDefinition } from '../database/schema.js';
import type { CategoryRule } from '../categorizer/rules.js';
import { CATEGORY_RULES } from '../categorizer/rules.js';

/** Config file names searched, in priority order. */
export const CONFIG_FILE_NAMES = ['strike-logger.config.json', '.strikerc.json'];

/**
 * Load an optional user config from the given directory. Returns an empty
 * config (never throws) when no file is present or the file is invalid — a bad
 * config file should never break the core workflow.
 */
export async function loadConfig(dir: string = process.cwd()): Promise<UserConfig> {
  for (const name of CONFIG_FILE_NAMES) {
    const filePath = join(dir, name);
    if (!existsSync(filePath)) continue;

    try {
      const raw = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as UserConfig;
      return sanitizeConfig(parsed);
    } catch (error) {
      console.error(`[strike-logger] Ignoring invalid config at ${name}: ${(error as Error).message}`);
      return {};
    }
  }
  return {};
}

/** Defensive normalization so downstream code can trust the shape. */
function sanitizeConfig(config: UserConfig): UserConfig {
  return {
    customRules: Array.isArray(config.customRules) ? config.customRules : [],
    categoryLabels: config.categoryLabels && typeof config.categoryLabels === 'object' ? config.categoryLabels : {},
    severityOverrides:
      config.severityOverrides && typeof config.severityOverrides === 'object' ? config.severityOverrides : {},
  };
}

/**
 * Compile user rule definitions into runtime {@link CategoryRule} objects.
 * Invalid regex strings are skipped with a warning rather than crashing.
 */
export function compileUserRules(definitions: UserRuleDefinition[] = []): CategoryRule[] {
  const rules: CategoryRule[] = [];

  for (const def of definitions) {
    if (!def || typeof def.category !== 'string' || def.category.trim() === '') continue;

    const patterns: RegExp[] = [];
    for (const src of def.patterns || []) {
      try {
        patterns.push(new RegExp(src, 'i'));
      } catch {
        console.error(`[strike-logger] Skipping invalid regex "${src}" for category "${def.category}"`);
      }
    }

    rules.push({
      category: def.category.trim(),
      keywords: Array.isArray(def.keywords) ? def.keywords : [],
      patterns,
      weight: typeof def.weight === 'number' && def.weight > 0 ? def.weight : 1.0,
    });
  }

  return rules;
}

/**
 * Return the effective rule set: built-in rules plus any compiled custom rules.
 * Custom rules come last so a tie prefers built-ins, but a higher weight lets a
 * custom rule win.
 */
export function getEffectiveRules(config: UserConfig): CategoryRule[] {
  return [...CATEGORY_RULES, ...compileUserRules(config.customRules)];
}

/** Look up a forced severity for a category, if the user configured one. */
export function getSeverityOverride(config: UserConfig, category: string): StrikeSeverity | undefined {
  return config.severityOverrides?.[category];
}

/** Resolve a human-readable label for a category id. */
export function labelForCategory(config: UserConfig, category: string): string {
  if (config.categoryLabels?.[category]) return config.categoryLabels[category];
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
