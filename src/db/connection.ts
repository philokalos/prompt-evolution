/**
 * SQLite Database Connection
 * Prompt Evolution - Data Pipeline
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync } from 'fs';
import { SCHEMA } from './schema.js';

// Default database location
const DEFAULT_DB_DIR = join(homedir(), '.prompt-evolution');
const DEFAULT_DB_PATH = join(DEFAULT_DB_DIR, 'data.db');

let db: Database.Database | null = null;

/**
 * Get or create database connection
 */
export function getDatabase(dbPath: string = DEFAULT_DB_PATH): Database.Database {
  if (db) return db;

  // Ensure directory exists
  const dbDir = join(dbPath, '..');
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Create connection with WAL mode for better performance
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}

/**
 * Initialize database with schema
 */
export function initializeDatabase(dbPath?: string): Database.Database {
  const database = getDatabase(dbPath);
  database.exec(SCHEMA);
  return database;
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
 * Get database path
 */
export function getDatabasePath(): string {
  return DEFAULT_DB_PATH;
}

/**
 * Check if database exists
 */
export function databaseExists(dbPath: string = DEFAULT_DB_PATH): boolean {
  return existsSync(dbPath);
}

/**
 * Run a transaction
 */
export function transaction<T>(fn: () => T): T {
  const database = getDatabase();
  return database.transaction(fn)();
}

export { DEFAULT_DB_PATH, DEFAULT_DB_DIR };
