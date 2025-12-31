/**
 * Desktop App SQLite Connection
 * PromptLint - Personal History Database
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync } from 'fs';
import { DESKTOP_SCHEMA } from './schema.js';

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
 * Initialize database with schema
 */
export function initializeDatabase(): Database.Database {
  const database = getDatabase();
  database.exec(DESKTOP_SCHEMA);
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
 * Check if database exists
 */
export function databaseExists(): boolean {
  return existsSync(DB_PATH);
}

export { DB_PATH, DB_DIR };
