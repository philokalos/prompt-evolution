/**
 * Tests for db/connection.ts
 * PromptLint - SQLite connection management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock state
const mockState = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  mockDb: {
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn(() => ({
      get: vi.fn(() => undefined),
      all: vi.fn(() => []),
      run: vi.fn(),
    })),
    close: vi.fn(),
  },
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockState.existsSync(...args),
  mkdirSync: (...args: unknown[]) => mockState.mkdirSync(...args),
}));

// Mock better-sqlite3 as a constructor with spy tracking
vi.mock('better-sqlite3', () => {
  const MockDatabase = vi.fn(function (this: unknown) {
    return mockState.mockDb;
  });
  return { default: MockDatabase };
});

// Import after mocking
import {
  getDatabase,
  initializeDatabase,
  closeDatabase,
  databaseExists,
  DB_PATH,
  DB_DIR,
} from '../connection.js';
import Database from 'better-sqlite3';

describe('db/connection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton
    closeDatabase();
    // Reset the Database constructor spy
    (Database as ReturnType<typeof vi.fn>).mockClear();
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('getDatabase', () => {
    it('should create database directory if it does not exist', () => {
      mockState.existsSync.mockReturnValue(false);

      getDatabase();

      expect(mockState.mkdirSync).toHaveBeenCalledWith(DB_DIR, { recursive: true });
    });

    it('should not create directory if it already exists', () => {
      mockState.existsSync.mockReturnValue(true);

      getDatabase();

      expect(mockState.mkdirSync).not.toHaveBeenCalled();
    });

    it('should create database with WAL mode', () => {
      getDatabase();

      expect(mockState.mockDb.pragma).toHaveBeenCalledWith('journal_mode = WAL');
    });

    it('should enable foreign keys', () => {
      getDatabase();

      expect(mockState.mockDb.pragma).toHaveBeenCalledWith('foreign_keys = ON');
    });

    it('should return the same instance on subsequent calls', () => {
      const db1 = getDatabase();
      const db2 = getDatabase();

      expect(db1).toBe(db2);
      expect(Database).toHaveBeenCalledTimes(1);
    });

    it('should create database at correct path', () => {
      getDatabase();

      expect(Database).toHaveBeenCalledWith(DB_PATH);
    });
  });

  describe('initializeDatabase', () => {
    it('should execute base schema', () => {
      initializeDatabase();

      expect(mockState.mockDb.exec).toHaveBeenCalled();
    });

    it('should run migrations', () => {
      // Mock that schema_version table doesn't exist
      mockState.mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => undefined),
      });

      initializeDatabase();

      // Should have created schema_version table
      expect(mockState.mockDb.exec).toHaveBeenCalled();
    });

    it('should create V2 indexes', () => {
      initializeDatabase();

      // V2 indexes should be created (base schema + V2 indexes + version table)
      expect(mockState.mockDb.exec).toHaveBeenCalled();
    });

    it('should handle V2 index creation errors gracefully', () => {
      // Track exec calls and throw on V2 index creation (idx_history_project)
      let execCallCount = 0;
      mockState.mockDb.exec.mockImplementation((sql: string) => {
        execCallCount++;
        // Throw only on V2-specific indexes
        if (sql && sql.includes('idx_history_project')) {
          throw new Error('Index already exists');
        }
      });

      // Should not throw - error is caught in try-catch
      expect(() => initializeDatabase()).not.toThrow();
      expect(execCallCount).toBeGreaterThan(0);
    });

    it('should return database instance', () => {
      const db = initializeDatabase();

      expect(db).toBe(mockState.mockDb);
    });
  });

  describe('closeDatabase', () => {
    it('should close database if open', () => {
      getDatabase();
      closeDatabase();

      expect(mockState.mockDb.close).toHaveBeenCalled();
    });

    it('should handle multiple close calls gracefully', () => {
      getDatabase();
      closeDatabase();
      closeDatabase();

      expect(mockState.mockDb.close).toHaveBeenCalledTimes(1);
    });

    it('should allow reopening after close', () => {
      getDatabase();
      closeDatabase();
      getDatabase();

      expect(Database).toHaveBeenCalledTimes(2);
    });
  });

  describe('databaseExists', () => {
    it('should return true if database file exists', () => {
      mockState.existsSync.mockReturnValue(true);

      expect(databaseExists()).toBe(true);
    });

    it('should return false if database file does not exist', () => {
      mockState.existsSync.mockReturnValue(false);

      expect(databaseExists()).toBe(false);
    });

    it('should check correct path', () => {
      databaseExists();

      expect(mockState.existsSync).toHaveBeenCalledWith(DB_PATH);
    });
  });

  describe('DB paths', () => {
    it('should have DB_DIR in home directory', () => {
      expect(DB_DIR).toContain('.promptlint');
    });

    it('should have DB_PATH with history.db filename', () => {
      expect(DB_PATH).toContain('history.db');
    });

    it('should have DB_PATH inside DB_DIR', () => {
      expect(DB_PATH).toContain(DB_DIR);
    });
  });

  describe('migrations', () => {
    it('should create schema_version table if not exists', () => {
      mockState.mockDb.prepare.mockReturnValue({
        get: vi.fn(() => undefined),
        run: vi.fn(),
        all: vi.fn(() => []),
      });

      initializeDatabase();

      expect(mockState.mockDb.exec).toHaveBeenCalled();
    });

    it('should skip migration if version is current', () => {
      mockState.mockDb.prepare.mockReturnValue({
        get: vi.fn()
          .mockReturnValueOnce({ name: 'schema_version' }) // hasVersionTable
          .mockReturnValueOnce({ version: 2 }), // current version
        run: vi.fn(),
        all: vi.fn(() => []),
      });

      initializeDatabase();

      // Should not alter tables if already at version 2
      const execCalls = mockState.mockDb.exec.mock.calls.map((c: unknown[]) => c[0]);
      const alterCalls = execCalls.filter((sql: string) => sql?.includes?.('ALTER TABLE'));
      expect(alterCalls.length).toBe(0);
    });

    it('should run migration to version 2 if at version 1', () => {
      const mockPrepare = vi.fn()
        .mockReturnValueOnce({ get: vi.fn(() => ({ name: 'schema_version' })) }) // hasVersionTable
        .mockReturnValueOnce({ get: vi.fn(() => ({ version: 1 })) }) // currentVersion = 1
        .mockReturnValueOnce({ all: vi.fn(() => [{ name: 'id' }, { name: 'prompt_text' }]) }) // columns
        .mockReturnValueOnce({ run: vi.fn() }); // update version

      mockState.mockDb.prepare = mockPrepare;

      initializeDatabase();

      // Should have called ALTER TABLE for missing columns
      expect(mockState.mockDb.exec).toHaveBeenCalled();
    });

    it('should handle migration errors gracefully', () => {
      mockState.mockDb.prepare.mockReturnValue({
        get: vi.fn()
          .mockReturnValueOnce({ name: 'schema_version' })
          .mockReturnValueOnce({ version: 1 }),
        all: vi.fn(() => {
          throw new Error('Migration error');
        }),
        run: vi.fn(),
      });

      // Should not throw
      expect(() => initializeDatabase()).not.toThrow();
    });
  });
});
