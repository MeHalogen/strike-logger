import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import type { Strike, StrikeDatabase, StrikeSeverity, StrikeCategory } from './schema.js';

const DEFAULT_DB_PATH = join(process.cwd(), 'data', 'strikes.json');

/**
 * Initialize a new strike database
 */
export async function initDatabase(path: string = DEFAULT_DB_PATH): Promise<StrikeDatabase> {
  const db: StrikeDatabase = {
    version: '1.0.0',
    created: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    config: {
      aiModel: 'gpt',
      severityThreshold: 'medium',
    },
    strikes: [],
    statistics: {
      totalStrikes: 0,
      byCategory: {} as Record<StrikeCategory, number>,
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
 * Load existing database or create new one
 */
export async function loadDatabase(path: string = DEFAULT_DB_PATH): Promise<StrikeDatabase> {
  if (!existsSync(path)) {
    return initDatabase(path);
  }

  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load database from ${path}: ${error}`);
  }
}

/**
 * Save database to disk
 */
export async function saveDatabase(
  db: StrikeDatabase,
  path: string = DEFAULT_DB_PATH
): Promise<void> {
  db.lastUpdated = new Date().toISOString();
  await ensureDirectory(path);
  await writeFile(path, JSON.stringify(db, null, 2), 'utf-8');
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
  category: StrikeCategory,
  path: string = DEFAULT_DB_PATH
): Promise<Strike[]> {
  const db = await loadDatabase(path);
  return db.strikes.filter((s) => s.category === category);
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
  db.statistics.byCategory = {} as Record<StrikeCategory, number>;
  db.statistics.bySeverity = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  // Recalculate
  for (const strike of db.strikes) {
    db.statistics.byCategory[strike.category] = 
      (db.statistics.byCategory[strike.category] || 0) + 1;
    db.statistics.bySeverity[strike.severity]++;
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
