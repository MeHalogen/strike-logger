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

export type StrikeSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Individual Strike Entry
 */
export interface Strike {
  id: string;
  timestamp: string;
  category: StrikeCategory;
  severity: StrikeSeverity;
  source: {
    commit: string;
    file: string;
    lines: [number, number];
    diff: string;
  };
  description: string;
  reviewComment?: string;
  aiModel?: string;
  tags: string[];
  resolved: boolean;
}

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
    byCategory: Record<StrikeCategory, number>;
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
