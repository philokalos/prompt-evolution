/**
 * Tests for instruction-repository.ts
 * Verifies CRUD operations for instruction analysis results
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SCHEMA_V4_MIGRATIONS } from '../schema.js';
import {
  saveAnalysis,
  getHistory,
  getLatestForFile,
} from '../instruction-repository.js';
import type { LintResult } from '../../instruction-linter/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_V4_MIGRATIONS);
  return db;
}

function makeLintResult(overrides?: Partial<LintResult>): LintResult {
  return {
    filePath: '/projects/my-app/CLAUDE.md',
    fileFormat: 'claude-md',
    overallScore: 75,
    grade: 'B',
    goldenScores: {
      goal: 80,
      output: 70,
      limits: 60,
      data: 75,
      evaluation: 85,
      next: 80,
      total: 75,
    },
    issues: [
      {
        severity: 'medium',
        type: 'missing-section',
        description: 'No anti-patterns section found',
        location: { lineStart: 1, lineEnd: 10, section: 'root' },
        suggestion: 'Add an anti-patterns section',
      },
    ],
    suggestions: [
      {
        issueIndex: 0,
        type: 'add-section',
        suggestedText: '## Anti-Patterns\n\n| Wrong | Correct |',
        description: 'Add anti-patterns section',
      },
    ],
    sections: [
      {
        heading: 'Project',
        level: 1,
        content: '# Project\n\nDescription here.',
        lineStart: 1,
        lineEnd: 3,
        codeBlocks: [],
        references: [],
      },
    ],
    references: [
      {
        path: '@.claude/rules/typescript/strict-mode.md',
        resolvedPath: '/projects/my-app/.claude/rules/typescript/strict-mode.md',
        exists: true,
        lineCount: 50,
      },
    ],
    fileSize: 2048,
    lineCount: 120,
    analyzedAt: '2026-02-24T10:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('instruction-repository', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  // -------------------------------------------------------------------------
  // saveAnalysis
  // -------------------------------------------------------------------------

  describe('saveAnalysis', () => {
    it('should save and return an ID', () => {
      const result = makeLintResult();
      const id = saveAnalysis(db, result);

      expect(id).toBe(1);
    });

    it('should save multiple records with incrementing IDs', () => {
      const id1 = saveAnalysis(db, makeLintResult({ filePath: '/a/CLAUDE.md' }));
      const id2 = saveAnalysis(db, makeLintResult({ filePath: '/b/CLAUDE.md' }));
      const id3 = saveAnalysis(db, makeLintResult({ filePath: '/c/CLAUDE.md' }));

      expect(id1).toBe(1);
      expect(id2).toBe(2);
      expect(id3).toBe(3);
    });

    it('should JSON-stringify issues, suggestions, sections, references', () => {
      const result = makeLintResult();
      const id = saveAnalysis(db, result);

      const row = db.prepare('SELECT * FROM instruction_analysis WHERE id = ?').get(id) as {
        issues_json: string;
        suggestions_json: string;
        sections_json: string;
        references_json: string;
      };

      expect(JSON.parse(row.issues_json)).toEqual(result.issues);
      expect(JSON.parse(row.suggestions_json)).toEqual(result.suggestions);
      expect(JSON.parse(row.sections_json)).toEqual(result.sections);
      expect(JSON.parse(row.references_json)).toEqual(result.references);
    });

    it('should store null for empty arrays', () => {
      const result = makeLintResult({
        issues: [],
        suggestions: [],
        sections: [],
        references: [],
      });
      const id = saveAnalysis(db, result);

      const row = db.prepare('SELECT * FROM instruction_analysis WHERE id = ?').get(id) as {
        issues_json: string | null;
        suggestions_json: string | null;
        sections_json: string | null;
        references_json: string | null;
      };

      expect(row.issues_json).toBeNull();
      expect(row.suggestions_json).toBeNull();
      expect(row.sections_json).toBeNull();
      expect(row.references_json).toBeNull();
    });

    it('should persist golden scores correctly', () => {
      const result = makeLintResult();
      const id = saveAnalysis(db, result);

      const row = db.prepare('SELECT * FROM instruction_analysis WHERE id = ?').get(id) as {
        golden_goal: number;
        golden_output: number;
        golden_limits: number;
        golden_data: number;
        golden_evaluation: number;
        golden_next: number;
      };

      expect(row.golden_goal).toBe(80);
      expect(row.golden_output).toBe(70);
      expect(row.golden_limits).toBe(60);
      expect(row.golden_data).toBe(75);
      expect(row.golden_evaluation).toBe(85);
      expect(row.golden_next).toBe(80);
    });
  });

  // -------------------------------------------------------------------------
  // getHistory
  // -------------------------------------------------------------------------

  describe('getHistory', () => {
    it('should return paginated results ordered by date desc', () => {
      saveAnalysis(db, makeLintResult({
        filePath: '/a/CLAUDE.md',
        analyzedAt: '2026-02-20T10:00:00.000Z',
      }));
      saveAnalysis(db, makeLintResult({
        filePath: '/b/CLAUDE.md',
        analyzedAt: '2026-02-22T10:00:00.000Z',
      }));
      saveAnalysis(db, makeLintResult({
        filePath: '/c/CLAUDE.md',
        analyzedAt: '2026-02-24T10:00:00.000Z',
      }));

      const history = getHistory(db, { limit: 2 });

      expect(history).toHaveLength(2);
      // Most recent first
      expect(history[0].filePath).toBe('/c/CLAUDE.md');
      expect(history[1].filePath).toBe('/b/CLAUDE.md');
    });

    it('should support offset for pagination', () => {
      saveAnalysis(db, makeLintResult({
        filePath: '/a/CLAUDE.md',
        analyzedAt: '2026-02-20T10:00:00.000Z',
      }));
      saveAnalysis(db, makeLintResult({
        filePath: '/b/CLAUDE.md',
        analyzedAt: '2026-02-22T10:00:00.000Z',
      }));
      saveAnalysis(db, makeLintResult({
        filePath: '/c/CLAUDE.md',
        analyzedAt: '2026-02-24T10:00:00.000Z',
      }));

      const page2 = getHistory(db, { limit: 2, offset: 2 });

      expect(page2).toHaveLength(1);
      expect(page2[0].filePath).toBe('/a/CLAUDE.md');
    });

    it('should filter by filePath when provided', () => {
      saveAnalysis(db, makeLintResult({ filePath: '/a/CLAUDE.md' }));
      saveAnalysis(db, makeLintResult({ filePath: '/b/CLAUDE.md' }));
      saveAnalysis(db, makeLintResult({ filePath: '/a/CLAUDE.md' }));

      const filtered = getHistory(db, { filePath: '/a/CLAUDE.md' });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(e => e.filePath === '/a/CLAUDE.md')).toBe(true);
    });

    it('should return empty array when no records exist', () => {
      const history = getHistory(db);

      expect(history).toEqual([]);
    });

    it('should default to limit 20 when no options provided', () => {
      // Insert 25 records
      for (let i = 0; i < 25; i++) {
        saveAnalysis(db, makeLintResult({
          filePath: `/project-${i}/CLAUDE.md`,
          analyzedAt: `2026-02-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
        }));
      }

      const history = getHistory(db);

      expect(history).toHaveLength(20);
    });

    it('should return InstructionHistoryEntry without JSON fields', () => {
      saveAnalysis(db, makeLintResult());

      const history = getHistory(db);

      expect(history).toHaveLength(1);
      const entry = history[0];

      // Should have summary fields
      expect(entry.id).toBeDefined();
      expect(entry.filePath).toBe('/projects/my-app/CLAUDE.md');
      expect(entry.fileFormat).toBe('claude-md');
      expect(entry.overallScore).toBe(75);
      expect(entry.grade).toBe('B');
      expect(entry.goldenScores).toEqual({
        goal: 80,
        output: 70,
        limits: 60,
        data: 75,
        evaluation: 85,
        next: 80,
      });

      // Should NOT have parsed JSON fields (those are on InstructionAnalysis)
      expect(entry).not.toHaveProperty('issues');
      expect(entry).not.toHaveProperty('suggestions');
      expect(entry).not.toHaveProperty('sections');
      expect(entry).not.toHaveProperty('references');
    });
  });

  // -------------------------------------------------------------------------
  // getLatestForFile
  // -------------------------------------------------------------------------

  describe('getLatestForFile', () => {
    it('should return the most recent analysis for a file', () => {
      saveAnalysis(db, makeLintResult({
        filePath: '/a/CLAUDE.md',
        overallScore: 60,
        analyzedAt: '2026-02-20T10:00:00.000Z',
      }));
      saveAnalysis(db, makeLintResult({
        filePath: '/a/CLAUDE.md',
        overallScore: 80,
        analyzedAt: '2026-02-24T10:00:00.000Z',
      }));
      saveAnalysis(db, makeLintResult({
        filePath: '/b/CLAUDE.md',
        overallScore: 90,
        analyzedAt: '2026-02-25T10:00:00.000Z',
      }));

      const latest = getLatestForFile(db, '/a/CLAUDE.md');

      expect(latest).not.toBeNull();
      expect(latest!.overallScore).toBe(80);
      expect(latest!.analyzedAt).toBe('2026-02-24T10:00:00.000Z');
    });

    it('should return null if no analysis exists for the file', () => {
      saveAnalysis(db, makeLintResult({ filePath: '/other/CLAUDE.md' }));

      const latest = getLatestForFile(db, '/nonexistent/CLAUDE.md');

      expect(latest).toBeNull();
    });

    it('should return full InstructionAnalysis with parsed JSON fields', () => {
      const result = makeLintResult();
      saveAnalysis(db, result);

      const latest = getLatestForFile(db, '/projects/my-app/CLAUDE.md');

      expect(latest).not.toBeNull();
      expect(latest!.issues).toEqual(result.issues);
      expect(latest!.suggestions).toEqual(result.suggestions);
      expect(latest!.sections).toEqual(result.sections);
      expect(latest!.references).toEqual(result.references);
    });

    it('should return empty arrays for null JSON fields', () => {
      saveAnalysis(db, makeLintResult({
        issues: [],
        suggestions: [],
        sections: [],
        references: [],
      }));

      const latest = getLatestForFile(db, '/projects/my-app/CLAUDE.md');

      expect(latest).not.toBeNull();
      expect(latest!.issues).toEqual([]);
      expect(latest!.suggestions).toEqual([]);
      expect(latest!.sections).toEqual([]);
      expect(latest!.references).toEqual([]);
    });
  });
});
