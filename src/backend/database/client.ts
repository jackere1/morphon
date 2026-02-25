import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: Database.Database | null = null;

/**
 * Initialize the SQLite database connection
 * Creates the database file if it doesn't exist
 * Runs schema migrations
 */
export function initDatabase(dbPath?: string): Database.Database {
  const path = dbPath || process.env.DATABASE_PATH || './data/cs-animations.db';

  // Ensure data directory exists
  const dbDir = dirname(path);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Open database connection
  db = new Database(path);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Run schema migrations
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  console.log(`[Database] Initialized at ${path}`);

  return db;
}

/**
 * Get the database instance
 * Throws if database not initialized
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[Database] Connection closed');
  }
}

/**
 * Clean up old jobs and their video files
 * Called periodically to manage storage
 */
export function cleanupOldJobs(retentionDays: number = 7): number {
  const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

  const database = getDatabase();
  const result = database.prepare(`
    DELETE FROM jobs
    WHERE created_at < ? AND status IN ('done', 'error')
  `).run(cutoffTime);

  return result.changes;
}
