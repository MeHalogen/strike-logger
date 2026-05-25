import { StrikeCategory } from '../database/schema.js';

export interface CategoryRule {
  category: StrikeCategory;
  keywords: string[];
  patterns: RegExp[];
  weight: number;
}

/**
 * Predefined categorization rules
 */
export const CATEGORY_RULES: CategoryRule[] = [
  {
    category: StrikeCategory.MISSING_ERROR_HANDLING,
    keywords: ['try', 'catch', 'error handling', 'exception', 'throw'],
    patterns: [
      /no error handling/i,
      /missing catch/i,
      /unhandled (error|exception|promise)/i,
      /needs try.*catch/i,
    ],
    weight: 1.0,
  },
  {
    category: StrikeCategory.NULL_POINTER,
    keywords: ['null', 'undefined', 'TypeError', 'cannot read property'],
    patterns: [
      /cannot read property.*undefined/i,
      /null reference/i,
      /undefined is not/i,
      /check for null/i,
    ],
    weight: 1.0,
  },
  {
    category: StrikeCategory.RACE_CONDITION,
    keywords: ['race condition', 'async', 'await', 'concurrency', 'mutex'],
    patterns: [
      /race condition/i,
      /concurrent access/i,
      /needs (lock|mutex|semaphore)/i,
    ],
    weight: 0.9,
  },
  {
    category: StrikeCategory.SQL_INJECTION,
    keywords: ['sql injection', 'sql', 'query', 'sanitize', 'prepared statement'],
    patterns: [
      /sql injection/i,
      /unsafe query/i,
      /use prepared statement/i,
      /sanitize input/i,
    ],
    weight: 1.0,
  },
  {
    category: StrikeCategory.XSS_VULNERABILITY,
    keywords: ['xss', 'cross-site scripting', 'escape', 'sanitize html'],
    patterns: [
      /xss/i,
      /cross-site scripting/i,
      /escape (html|output)/i,
      /unsafe html/i,
    ],
    weight: 1.0,
  },
  {
    category: StrikeCategory.HARDCODED_SECRET,
    keywords: ['api key', 'password', 'secret', 'token', 'credential', 'hardcoded'],
    patterns: [
      /hardcoded (secret|password|api.*key|token)/i,
      /exposed (credential|secret)/i,
      /use environment variable/i,
    ],
    weight: 1.0,
  },
  {
    category: StrikeCategory.MISSING_TESTS,
    keywords: ['test', 'unit test', 'coverage', 'spec'],
    patterns: [
      /missing test/i,
      /needs? (unit )?test/i,
      /no test coverage/i,
      /add test/i,
    ],
    weight: 0.8,
  },
  {
    category: StrikeCategory.N_PLUS_ONE_QUERY,
    keywords: ['n+1', 'query', 'loop', 'database', 'performance'],
    patterns: [
      /n\+1 (query|problem)/i,
      /query in loop/i,
      /use (join|eager load)/i,
    ],
    weight: 0.9,
  },
  {
    category: StrikeCategory.MEMORY_LEAK,
    keywords: ['memory leak', 'leak', 'cleanup', 'dispose', 'garbage'],
    patterns: [
      /memory leak/i,
      /not cleaned up/i,
      /(missing|needs) cleanup/i,
      /dispose.*resource/i,
    ],
    weight: 0.9,
  },
  {
    category: StrikeCategory.TIGHT_COUPLING,
    keywords: ['coupling', 'dependency', 'interface', 'abstraction'],
    patterns: [
      /tight(ly)? coupled/i,
      /direct dependency/i,
      /use (interface|abstraction)/i,
      /decouple/i,
    ],
    weight: 0.7,
  },
  {
    category: StrikeCategory.INCONSISTENT_NAMING,
    keywords: ['naming', 'convention', 'style', 'consistent'],
    patterns: [
      /inconsistent naming/i,
      /naming convention/i,
      /rename to match/i,
    ],
    weight: 0.5,
  },
  {
    category: StrikeCategory.MISSING_DOCUMENTATION,
    keywords: ['documentation', 'comment', 'doc', 'jsdoc'],
    patterns: [
      /missing (documentation|doc|comment)/i,
      /needs? (documentation|doc)/i,
      /add (comment|docstring)/i,
    ],
    weight: 0.5,
  },
];

/**
 * Match description against category rules
 */
export function categorizeByRules(description: string, code?: string): StrikeCategory {
  const text = `${description} ${code || ''}`.toLowerCase();
  let bestMatch: { category: StrikeCategory; score: number } = {
    category: StrikeCategory.OTHER,
    score: 0,
  };

  for (const rule of CATEGORY_RULES) {
    let score = 0;

    // Check keywords
    for (const keyword of rule.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += 0.5;
      }
    }

    // Check patterns (stronger signal)
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        score += 1.5;
      }
    }

    // Apply weight
    score *= rule.weight;

    if (score > bestMatch.score) {
      bestMatch = { category: rule.category, score };
    }
  }

  return bestMatch.score > 0.5 ? bestMatch.category : StrikeCategory.OTHER;
}

/**
 * Suggest severity based on category and description
 */
export function suggestSeverity(
  category: StrikeCategory,
  description: string
): 'low' | 'medium' | 'high' | 'critical' {
  const text = description.toLowerCase();

  // Critical indicators
  if (
    category === StrikeCategory.SQL_INJECTION ||
    category === StrikeCategory.XSS_VULNERABILITY ||
    category === StrikeCategory.AUTH_BYPASS ||
    text.includes('critical') ||
    text.includes('security') ||
    text.includes('exploit')
  ) {
    return 'critical';
  }

  // High severity indicators
  if (
    category === StrikeCategory.HARDCODED_SECRET ||
    category === StrikeCategory.RACE_CONDITION ||
    category === StrikeCategory.MEMORY_LEAK ||
    text.includes('breaks') ||
    text.includes('crash') ||
    text.includes('data loss')
  ) {
    return 'high';
  }

  // Low severity indicators
  if (
    category === StrikeCategory.INCONSISTENT_NAMING ||
    category === StrikeCategory.MISSING_DOCUMENTATION ||
    text.includes('minor') ||
    text.includes('style')
  ) {
    return 'low';
  }

  // Default to medium
  return 'medium';
}
