/**
 * Tests for schema v4 migration
 * Verifies instruction_analysis table creation, indexes, and idempotency
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SCHEMA_V4_MIGRATIONS, DESKTOP_SCHEMA_VERSION } from '../schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set up in-memory DB with schema_version at a given version */
function createDbAtVersion(version: number): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create schema_version table and set version
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
    INSERT INTO schema_version (version) VALUES (${version});
  `);

  return db;
}

/** Get table column info */
function getColumns(db: Database.Database, table: string): Array<{
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}> {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
  }>;
}

/** Get index names for a table */
function getIndexes(db: Database.Database, table: string): string[] {
  const rows = db.prepare(`PRAGMA index_list(${table})`).all() as Array<{ name: string }>;
  return rows.map(r => r.name);
}

/** Check if a table exists */
function tableExists(db: Database.Database, table: string): boolean {
  const row = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
  ).get(table);
  return row !== undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Schema V4 Migration', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDbAtVersion(3);
  });

  afterEach(() => {
    db.close();
  });

  it('should have DESKTOP_SCHEMA_VERSION set to 4', () => {
    expect(DESKTOP_SCHEMA_VERSION).toBe(4);
  });

  it('should create instruction_analysis table with correct columns', () => {
    db.exec(SCHEMA_V4_MIGRATIONS);

    expect(tableExists(db, 'instruction_analysis')).toBe(true);

    const columns = getColumns(db, 'instruction_analysis');
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('file_path');
    expect(columnNames).toContain('file_format');
    expect(columnNames).toContain('overall_score');
    expect(columnNames).toContain('grade');
    expect(columnNames).toContain('golden_goal');
    expect(columnNames).toContain('golden_output');
    expect(columnNames).toContain('golden_limits');
    expect(columnNames).toContain('golden_data');
    expect(columnNames).toContain('golden_evaluation');
    expect(columnNames).toContain('golden_next');
    expect(columnNames).toContain('issues_json');
    expect(columnNames).toContain('suggestions_json');
    expect(columnNames).toContain('sections_json');
    expect(columnNames).toContain('references_json');
    expect(columnNames).toContain('file_size');
    expect(columnNames).toContain('line_count');
    expect(columnNames).toContain('analyzed_at');
  });

  it('should create indexes for path, date, and grade', () => {
    db.exec(SCHEMA_V4_MIGRATIONS);

    const indexes = getIndexes(db, 'instruction_analysis');

    expect(indexes).toContain('idx_instruction_path');
    expect(indexes).toContain('idx_instruction_date');
    expect(indexes).toContain('idx_instruction_grade');
  });

  it('should bump schema version from 3 to 4', () => {
    db.exec(SCHEMA_V4_MIGRATIONS);
    db.prepare('UPDATE schema_version SET version = 4').run();

    const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number };
    expect(row.version).toBe(4);
  });

  it('should be idempotent (running twice does not error)', () => {
    db.exec(SCHEMA_V4_MIGRATIONS);

    // Running again should not throw because of IF NOT EXISTS
    expect(() => db.exec(SCHEMA_V4_MIGRATIONS)).not.toThrow();

    // Table still has the correct columns
    const columns = getColumns(db, 'instruction_analysis');
    expect(columns.length).toBe(18);
  });

  it('should have correct column types and constraints', () => {
    db.exec(SCHEMA_V4_MIGRATIONS);

    const columns = getColumns(db, 'instruction_analysis');
    const colMap = new Map(columns.map(c => [c.name, c]));

    // Primary key
    expect(colMap.get('id')?.pk).toBe(1);
    expect(colMap.get('id')?.type).toBe('INTEGER');

    // NOT NULL columns
    expect(colMap.get('file_path')?.notnull).toBe(1);
    expect(colMap.get('file_format')?.notnull).toBe(1);
    expect(colMap.get('overall_score')?.notnull).toBe(1);
    expect(colMap.get('grade')?.notnull).toBe(1);
    expect(colMap.get('golden_goal')?.notnull).toBe(1);
    expect(colMap.get('golden_output')?.notnull).toBe(1);
    expect(colMap.get('golden_limits')?.notnull).toBe(1);
    expect(colMap.get('golden_data')?.notnull).toBe(1);
    expect(colMap.get('golden_evaluation')?.notnull).toBe(1);
    expect(colMap.get('golden_next')?.notnull).toBe(1);

    // Nullable JSON columns
    expect(colMap.get('issues_json')?.notnull).toBe(0);
    expect(colMap.get('suggestions_json')?.notnull).toBe(0);
    expect(colMap.get('sections_json')?.notnull).toBe(0);
    expect(colMap.get('references_json')?.notnull).toBe(0);

    // Nullable metadata
    expect(colMap.get('file_size')?.notnull).toBe(0);
    expect(colMap.get('line_count')?.notnull).toBe(0);

    // Default value for analyzed_at
    expect(colMap.get('analyzed_at')?.dflt_value).toBe('CURRENT_TIMESTAMP');
  });

  it('should enforce file_format CHECK constraint', () => {
    db.exec(SCHEMA_V4_MIGRATIONS);

    // Valid formats should work
    const stmt = db.prepare(`
      INSERT INTO instruction_analysis (
        file_path, file_format, overall_score, grade,
        golden_goal, golden_output, golden_limits,
        golden_data, golden_evaluation, golden_next
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    expect(() => stmt.run('/test', 'claude-md', 80, 'B', 70, 80, 60, 75, 85, 90)).not.toThrow();
    expect(() => stmt.run('/test', 'cursorrules', 70, 'C', 60, 70, 50, 65, 75, 80)).not.toThrow();
    expect(() => stmt.run('/test', 'copilot-instructions', 60, 'D', 50, 60, 40, 55, 65, 70)).not.toThrow();

    // Invalid format should fail
    expect(() => stmt.run('/test', 'invalid-format', 50, 'F', 40, 50, 30, 45, 55, 60)).toThrow();
  });

  it('should enforce grade CHECK constraint', () => {
    db.exec(SCHEMA_V4_MIGRATIONS);

    const stmt = db.prepare(`
      INSERT INTO instruction_analysis (
        file_path, file_format, overall_score, grade,
        golden_goal, golden_output, golden_limits,
        golden_data, golden_evaluation, golden_next
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Valid grades
    for (const grade of ['A', 'B', 'C', 'D', 'F']) {
      expect(() => stmt.run(`/test-${grade}`, 'claude-md', 80, grade, 70, 80, 60, 75, 85, 90)).not.toThrow();
    }

    // Invalid grade
    expect(() => stmt.run('/test-invalid', 'claude-md', 80, 'E', 70, 80, 60, 75, 85, 90)).toThrow();
  });
});
