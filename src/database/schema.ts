/**
 * Strike Category Types
 */
export enum StrikeCategory {
  // Code Quality
  MISSING_ERROR_HANDLING = 'missing_error_handling',
  NULL_POINTER = 'null_pointer',
  RACE_CONDITION = 'race_condition',
  MEMORY_LEAK = 'memory_leak',
  
  // Security
  SQL_INJECTION = 'sql_injection',
  XSS_VULNERABILITY = 'xss_vulnerability',
  HARDCODED_SECRET = 'hardcoded_secret',
  AUTH_BYPASS = 'auth_bypass',
  
  // Architecture
  TIGHT_COUPLING = 'tight_coupling',
  MISSING_ABSTRACTION = 'missing_abstraction',
  WRONG_PATTERN = 'wrong_pattern',
  
  // Testing
  MISSING_TESTS = 'missing_tests',
  INSUFFICIENT_COVERAGE = 'insufficient_coverage',
  
  // Performance
  N_PLUS_ONE_QUERY = 'n_plus_one_query',
  INEFFICIENT_ALGORITHM = 'inefficient_algorithm',
  
  // Style
  INCONSISTENT_NAMING = 'inconsistent_naming',
  MISSING_DOCUMENTATION = 'missing_documentation',
  
  // Other
  OTHER = 'other'
}

/**
 * A category identifier. Built-in categories come from {@link StrikeCategory},
 * but users may define their own via config, so the stored/handled type is a
 * plain string.
 */
export type CategoryId = StrikeCategory | (string & {});

export type StrikeSeverity = 'low' | 'medium' | 'high' | 'critical';

export const SEVERITIES: readonly StrikeSeverity[] = ['low', 'medium', 'high', 'critical'];

/**
 * Individual Strike Entry
 */
export interface Strike {
  id: string;
  timestamp: string;
  category: CategoryId;
  severity: StrikeSeverity;
  source: {
    commit: string;
    file: string;
    lines: [number, number];
    diff: string;
    /** Additional files touched by the originating commit (multi-file support). */
    files?: string[];
  };
  description: string;
  reviewComment?: string;
  aiModel?: string;
  tags: string[];
  resolved: boolean;
  /** ISO timestamp of when this strike was resolved, if any. */
  resolvedAt?: string;
}

/** Current on-disk database schema version. Bump when the shape changes. */
export const DB_SCHEMA_VERSION = '1.1.0';

/**
 * Strike Database Structure
 */
export interface StrikeDatabase {
  version: string;
  created: string;
  lastUpdated: string;
  config: {
    aiModel: string;
    severityThreshold: StrikeSeverity;
  };
  strikes: Strike[];
  statistics: {
    totalStrikes: number;
    byCategory: Record<string, number>;
    bySeverity: Record<StrikeSeverity, number>;
  };
}

/**
 * Configuration File Structure
 */
export interface StrikeLoggerConfig {
  version: string;
  aiModel: 'claude' | 'gpt' | 'copilot' | 'other';
  severityThreshold: StrikeSeverity;
  databasePath: string;
  autoLog: boolean;
  categories: StrikeCategory[];
}

/**
 * User-supplied rule definition (from a config file). Patterns are provided as
 * strings and compiled to case-insensitive RegExp at load time.
 */
export interface UserRuleDefinition {
  category: string;
  keywords?: string[];
  patterns?: string[];
  weight?: number;
}

/**
 * Shape of an optional `strike-logger.config.json` / `.strikerc.json` file that
 * lets users extend categorization without touching source.
 */
export interface UserConfig {
  /** Extra categorization rules, merged after the built-ins. */
  customRules?: UserRuleDefinition[];
  /** Human-readable labels for custom category ids, used in reports. */
  categoryLabels?: Record<string, string>;
  /** Force a severity for specific categories. */
  severityOverrides?: Record<string, StrikeSeverity>;
}
