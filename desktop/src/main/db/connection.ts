/**
 * Desktop App SQLite Connection
 * PromptLint - Personal History Database
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync } from 'fs';
import { DESKTOP_SCHEMA_BASE, DESKTOP_SCHEMA_V2_INDEXES, DESKTOP_SCHEMA_VERSION } from './schema.js';

// Database location
const DB_DIR = join(homedir(), '.promptlint');
const DB_PATH = join(DB_DIR, 'history.db');

let db: Database.Database | null = null;

/**
 * Get or create database connection
 */
export function getDatabase(): Database.Database {
  if (db) return db;

  // Ensure directory exists
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  // Create connection with WAL mode
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}

/**
 * Initialize database with schema and run migrations
 */
export function initializeDatabase(): Database.Database {
  const database = getDatabase();

  // Step 1: Create base tables (without new columns, for backward compatibility)
  database.exec(DESKTOP_SCHEMA_BASE);

  // Step 2: Run migrations to add new columns
  runMigrations(database);

  // Step 3: Create indexes for new columns (after migration ensures columns exist)
  try {
    database.exec(DESKTOP_SCHEMA_V2_INDEXES);
  } catch (error) {
    console.warn('[DB] Failed to create V2 indexes:', error);
  }

  return database;
}

/**
 * Run schema migrations for existing databases
 */
function runMigrations(database: Database.Database): void {
  // Check current schema version
  const versionStmt = database.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='schema_version'
  `);
  const hasVersionTable = versionStmt.get();

  if (!hasVersionTable) {
    // Create version tracking table
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );
      INSERT OR IGNORE INTO schema_version (version) VALUES (1);
    `);
  }

  // Get current version
  const currentVersionStmt = database.prepare(`SELECT version FROM schema_version LIMIT 1`);
  const currentVersionRow = currentVersionStmt.get() as { version: number } | undefined;
  const currentVersion = currentVersionRow?.version || 1;

  // Run migrations based on version
  if (currentVersion < 2) {
    console.log('[DB] Running migration to version 2...');
    try {
      // Add new columns if they don't exist (SQLite doesn't support IF NOT EXISTS for ALTER)
      const columns = database.prepare(`PRAGMA table_info(prompt_history)`).all() as Array<{ name: string }>;
      const columnNames = columns.map(c => c.name);

      if (!columnNames.includes('project_path')) {
        database.exec(`ALTER TABLE prompt_history ADD COLUMN project_path TEXT`);
      }
      if (!columnNames.includes('intent')) {
        database.exec(`ALTER TABLE prompt_history ADD COLUMN intent TEXT`);
      }
      if (!columnNames.includes('category')) {
        database.exec(`ALTER TABLE prompt_history ADD COLUMN category TEXT`);
      }

      // Update version
      database.prepare(`UPDATE schema_version SET version = 2`).run();
      console.log('[DB] Migration to version 2 complete');
    } catch (error) {
      console.warn('[DB] Migration error (may be already migrated):', error);
    }
  }

  console.log(`[DB] Schema version: ${DESKTOP_SCHEMA_VERSION}`);
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Check if database exists
 */
export function databaseExists(): boolean {
  return existsSync(DB_PATH);
}

export { DB_PATH, DB_DIR };
