import { readFile, writeFile, mkdir, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import type { Strike, StrikeDatabase, StrikeSeverity, CategoryId } from './schema.js';
import { DB_SCHEMA_VERSION } from './schema.js';

const DEFAULT_DB_PATH = join(process.cwd(), 'data', 'strikes.json');

/**
 * Initialize a new strike database
 */
export async function initDatabase(path: string = DEFAULT_DB_PATH): Promise<StrikeDatabase> {
  const db: StrikeDatabase = {
    version: DB_SCHEMA_VERSION,
    created: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    config: {
      aiModel: 'gpt',
      severityThreshold: 'medium',
    },
    strikes: [],
    statistics: {
      totalStrikes: 0,
      byCategory: {},
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
    },
  };

  await ensureDirectory(path);
  await writeFile(path, JSON.stringify(db, null, 2), 'utf-8');
  return db;
}

/**
 * Load existing database or create new one.
 * Corrupt or partial files are migrated into a valid shape rather than crashing.
 */
export async function loadDatabase(path: string = DEFAULT_DB_PATH): Promise<StrikeDatabase> {
  if (!existsSync(path)) {
    return initDatabase(path);
  }

  let raw: unknown;
  try {
    const content = await readFile(path, 'utf-8');
    raw = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Database at ${path} is not valid JSON (${(error as Error).message}). ` +
        `Fix or remove the file, or re-run "strike-logger init".`
    );
  }

  return migrateDatabase(raw);
}

/**
 * Normalize an arbitrary parsed object into a valid {@link StrikeDatabase},
 * backfilling any missing fields. Keeps older databases working across upgrades.
 */
export function migrateDatabase(raw: unknown): StrikeDatabase {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<StrikeDatabase>;
  const now = new Date().toISOString();

  const strikes: Strike[] = Array.isArray(input.strikes)
    ? input.strikes.filter((s): s is Strike => !!s && typeof s === 'object')
    : [];

  const db: StrikeDatabase = {
    version: DB_SCHEMA_VERSION,
    created: typeof input.created === 'string' ? input.created : now,
    lastUpdated: typeof input.lastUpdated === 'string' ? input.lastUpdated : now,
    config: {
      aiModel: input.config?.aiModel ?? 'gpt',
      severityThreshold: input.config?.severityThreshold ?? 'medium',
    },
    strikes,
    statistics: {
      totalStrikes: 0,
      byCategory: {},
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
    },
  };

  // Always recompute statistics so they can never drift out of sync.
  updateStatistics(db);
  return db;
}

/**
 * Save database to disk atomically (write to a temp file, then rename) so an
 * interrupted write can never corrupt the existing database.
 */
export async function saveDatabase(
  db: StrikeDatabase,
  path: string = DEFAULT_DB_PATH
): Promise<void> {
  db.lastUpdated = new Date().toISOString();
  await ensureDirectory(path);
  const tmpPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
  await rename(tmpPath, path);
}

/**
 * Add a new strike to the database
 */
export async function addStrike(
  strike: Omit<Strike, 'id' | 'timestamp'>,
  path: string = DEFAULT_DB_PATH
): Promise<Strike> {
  const db = await loadDatabase(path);

  const newStrike: Strike = {
    ...strike,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };

  db.strikes.push(newStrike);
  updateStatistics(db);
  await saveDatabase(db, path);

  return newStrike;
}

/**
 * Get all strikes
 */
export async function getAllStrikes(path: string = DEFAULT_DB_PATH): Promise<Strike[]> {
  const db = await loadDatabase(path);
  return db.strikes;
}

/**
 * Get strikes by category
 */
export async function getStrikesByCategory(
  category: CategoryId,
  path: string = DEFAULT_DB_PATH
): Promise<Strike[]> {
  const db = await loadDatabase(path);
  return db.strikes.filter((s) => s.category === category);
}

/**
 * Find a single strike by full id or unambiguous id prefix (like a git short hash).
 * Returns `{ strike }` on a unique match, `{ ambiguous: true }` when a prefix
 * matches several strikes, or `{}` when nothing matches.
 */
export async function findStrikeByIdPrefix(
  idOrPrefix: string,
  path: string = DEFAULT_DB_PATH
): Promise<{ strike?: Strike; ambiguous?: boolean; matches?: Strike[] }> {
  const db = await loadDatabase(path);
  const exact = db.strikes.find((s) => s.id === idOrPrefix);
  if (exact) return { strike: exact };

  const matches = db.strikes.filter((s) => s.id.startsWith(idOrPrefix));
  if (matches.length === 1) return { strike: matches[0] };
  if (matches.length > 1) return { ambiguous: true, matches };
  return {};
}

/**
 * Get strikes by severity
 */
export async function getStrikesBySeverity(
  severity: StrikeSeverity,
  path: string = DEFAULT_DB_PATH
): Promise<Strike[]> {
  const db = await loadDatabase(path);
  return db.strikes.filter((s) => s.severity === severity);
}

/**
 * Mark a strike as resolved
 */
export async function resolveStrike(
  strikeId: string,
  path: string = DEFAULT_DB_PATH
): Promise<Strike | null> {
  const db = await loadDatabase(path);
  const strike = db.strikes.find((s) => s.id === strikeId);

  if (!strike) {
    return null;
  }

  strike.resolved = true;
  strike.resolvedAt = new Date().toISOString();
  await saveDatabase(db, path);
  return strike;
}

/**
 * Delete a strike
 */
export async function deleteStrike(
  strikeId: string,
  path: string = DEFAULT_DB_PATH
): Promise<boolean> {
  const db = await loadDatabase(path);
  const initialLength = db.strikes.length;
  db.strikes = db.strikes.filter((s) => s.id !== strikeId);

  if (db.strikes.length === initialLength) {
    return false;
  }

  updateStatistics(db);
  await saveDatabase(db, path);
  return true;
}

/**
 * Get database statistics
 */
export async function getStatistics(path: string = DEFAULT_DB_PATH): Promise<StrikeDatabase['statistics']> {
  const db = await loadDatabase(path);
  return db.statistics;
}

/**
 * Update database statistics
 */
function updateStatistics(db: StrikeDatabase): void {
  db.statistics.totalStrikes = db.strikes.length;

  // Reset statistics
  db.statistics.byCategory = {};
  db.statistics.bySeverity = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  // Recalculate
  for (const strike of db.strikes) {
    const category = strike.category || 'other';
    db.statistics.byCategory[category] = (db.statistics.byCategory[category] || 0) + 1;
    if (strike.severity in db.statistics.bySeverity) {
      db.statistics.bySeverity[strike.severity]++;
    }
  }
}

/**
 * Ensure directory exists
 */
async function ensureDirectory(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}
