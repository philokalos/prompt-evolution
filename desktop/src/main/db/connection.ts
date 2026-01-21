/**
 * Desktop App SQLite Connection
 * PromptLint - Personal History Database
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync, renameSync, unlinkSync } from 'fs';
import { app } from 'electron';
import {
  DESKTOP_SCHEMA_BASE,
  DESKTOP_SCHEMA_V2_INDEXES,
  SCHEMA_V3_MIGRATIONS,
  DESKTOP_SCHEMA_VERSION,
} from './schema.js';

// Database locations (primary and fallback)
const DB_DIR_PRIMARY = join(homedir(), '.promptlint');

// Get fallback directory safely (handles test environment where app may not be fully initialized)
function getFallbackDir(): string {
  try {
    if (app?.isPackaged) {
      return join(app.getPath('userData'), 'data');
    }
  } catch {
    // app.getPath may throw in test environment
  }
  return DB_DIR_PRIMARY;
}

const DB_DIR_FALLBACK = getFallbackDir();

let dbDir = DB_DIR_PRIMARY;
let dbPath = join(dbDir, 'history.db');
let db: Database.Database | null = null;
let lastDbError: Error | null = null;

/**
 * Get the last database error (for error reporting)
 */
export function getLastDbError(): Error | null {
  return lastDbError;
}

/**
 * Get current database path
 */
export function getDatabasePath(): string {
  return dbPath;
}

/**
 * Ensure database directory exists with fallback
 */
function ensureDbDirectory(): boolean {
  // Try primary location first
  try {
    if (!existsSync(DB_DIR_PRIMARY)) {
      mkdirSync(DB_DIR_PRIMARY, { recursive: true });
    }
    dbDir = DB_DIR_PRIMARY;
    dbPath = join(dbDir, 'history.db');
    return true;
  } catch (primaryError) {
    console.warn('[DB] Primary directory failed:', primaryError);

    // Try fallback location
    try {
      if (!existsSync(DB_DIR_FALLBACK)) {
        mkdirSync(DB_DIR_FALLBACK, { recursive: true });
      }
      dbDir = DB_DIR_FALLBACK;
      dbPath = join(dbDir, 'history.db');
      console.log('[DB] Using fallback directory:', dbDir);
      return true;
    } catch (fallbackError) {
      console.error('[DB] Fallback directory also failed:', fallbackError);
      lastDbError = fallbackError instanceof Error
        ? fallbackError
        : new Error(String(fallbackError));
      return false;
    }
  }
}

/**
 * Handle corrupted database by backing up and recreating
 */
function handleCorruptedDatabase(): boolean {
  const backupPath = `${dbPath}.backup.${Date.now()}`;

  try {
    if (existsSync(dbPath)) {
      console.warn('[DB] Backing up corrupted database to:', backupPath);
      renameSync(dbPath, backupPath);
    }

    // Also backup WAL and SHM files if they exist
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (existsSync(walPath)) {
      try { unlinkSync(walPath); } catch { /* ignore */ }
    }
    if (existsSync(shmPath)) {
      try { unlinkSync(shmPath); } catch { /* ignore */ }
    }

    return true;
  } catch (error) {
    console.error('[DB] Failed to backup corrupted database:', error);
    return false;
  }
}

/**
 * Get or create database connection with error handling
 */
export function getDatabase(): Database.Database {
  if (db) return db;

  // Ensure directory exists
  if (!ensureDbDirectory()) {
    throw new Error(
      '데이터베이스 디렉토리를 생성할 수 없습니다. ' +
      '디스크 공간 또는 권한을 확인해주세요.'
    );
  }

  // Try to create connection
  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount < maxRetries) {
    try {
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      // Auto-checkpoint WAL file every 1000 pages to prevent unbounded growth
      db.pragma('wal_autocheckpoint = 1000');
      lastDbError = null;
      return db;
    } catch (error) {
      console.error(`[DB] Failed to open database (attempt ${retryCount + 1}):`, error);
      lastDbError = error instanceof Error ? error : new Error(String(error));
      db = null;

      // Check if it's a corruption error
      const errorMessage = String(error);
      const isCorruption = errorMessage.includes('database disk image is malformed')
        || errorMessage.includes('file is not a database')
        || errorMessage.includes('SQLITE_CORRUPT')
        || errorMessage.includes('SQLITE_NOTADB');

      if (isCorruption && retryCount === 0) {
        console.warn('[DB] Database appears corrupted, attempting recovery...');
        if (handleCorruptedDatabase()) {
          retryCount++;
          continue;
        }
      }

      throw new Error(
        '데이터베이스를 열 수 없습니다. ' +
        (isCorruption
          ? '데이터베이스 파일이 손상되었습니다. 백업 후 새로 생성됩니다.'
          : '다른 프로그램이 사용 중이거나 권한 문제일 수 있습니다.')
      );
    }
  }

  throw new Error('데이터베이스 연결에 실패했습니다.');
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

  // Phase 4: Version 3 migration
  if (currentVersion < 3) {
    console.log('[DB] Running migration to version 3...');
    try {
      database.exec(SCHEMA_V3_MIGRATIONS);

      // Update version
      database.prepare(`UPDATE schema_version SET version = 3`).run();
      console.log('[DB] Migration to version 3 complete');
    } catch (error) {
      console.warn('[DB] V3 migration error (may be already migrated):', error);
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
  return existsSync(dbPath);
}

/**
 * Get database directory path
 */
export function getDbDir(): string {
  return dbDir;
}

// Legacy exports for backward compatibility
export const DB_PATH = dbPath;
export const DB_DIR = dbDir;
