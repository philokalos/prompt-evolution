/**
 * Integration Tests — Instruction Linter Full Pipeline
 *
 * Exercises the complete flow:
 *   File read → parse sections → resolve refs → GOLDEN scores →
 *   detect issues → generate suggestions → save to DB → retrieve
 *
 * Uses real temporary files (node:fs + os.tmpdir) — no mocking.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { SCHEMA_V4_MIGRATIONS } from '../../db/schema.js';
import { lintInstructionFile } from '../index.js';
import {
  saveAnalysis,
  getHistory,
  getLatestForFile,
} from '../../db/instruction-repository.js';

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

let tmpDir: string;

function writeTempFile(filename: string, content: string): string {
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const REALISTIC_CLAUDE_MD = `# CLAUDE.md — My Project

React + TypeScript + Firebase application for task management.

## Overview

This is a web application built with React 18, TypeScript, and Firebase.
It provides task management with real-time sync.

## Commands

\`\`\`bash
npm run dev          # Vite dev server :5173
npm run build        # TypeScript check + build
npm run lint         # ESLint (--max-warnings 0)
npm test             # Vitest
\`\`\`

## Architecture

\`\`\`
src/
├── components/   # React components
├── hooks/        # Custom hooks
├── utils/        # Utility functions
└── config/       # Configuration
\`\`\`

## Key Patterns

| Pattern | Details |
|---------|---------|
| State | React Context + useReducer |
| Styling | Tailwind CSS |
| Testing | Vitest + React Testing Library |

## Critical Rules

1. **Never use \`any\`** — use \`unknown\` or proper typing
2. Always use optional chaining (\`?.\`) for nullable access
3. Must not expose API keys in client code

## Anti-Patterns

| Wrong | Correct |
|-------|---------|
| \`import './foo'\` | \`import './foo.js'\` |
| \`data: any\` | \`data: unknown\` |
| Silent catch | Log and re-throw |

## Testing

\`\`\`bash
npm test             # Unit tests
npm run test:e2e     # Playwright
\`\`\`

- Minimum coverage: 80%
- All PRs must pass CI checks

## Deployment

Deploy via GitHub Actions to Vercel:

1. Push to \`main\` branch
2. CI runs lint + test + build
3. Auto-deploy to production
`;

const WELL_STRUCTURED_CLAUDE_MD = `# CLAUDE.md — Well-Structured Project

A comprehensive TypeScript web application built with React 19, Node.js, and PostgreSQL.

## Project Overview

This platform provides real-time analytics dashboard for enterprise customers.
Tech stack: React 19 + TypeScript + Express + PostgreSQL + Redis.

## Commands

\`\`\`bash
npm run dev          # Development server :3000
npm run build        # Production build with TypeScript
npm run lint         # ESLint strict mode
npm test             # Jest with coverage
npm run deploy       # Deploy to AWS ECS
\`\`\`

## Architecture

\`\`\`
src/
├── components/      # React UI components
├── hooks/           # Custom React hooks
├── services/        # API service layer
├── utils/           # Helper utilities
├── config/          # Environment config
└── types/           # TypeScript type definitions
\`\`\`

### Key Modules

| Module | Purpose |
|--------|---------|
| \`AuthService\` | OAuth2 + JWT authentication |
| \`DataPipeline\` | Real-time data aggregation |
| \`CacheLayer\` | Redis-backed response caching |

## Coding Conventions

- Always use TypeScript strict mode
- Prefer \`const\` over \`let\`, never use \`var\`
- Use PascalCase for components, camelCase for functions
- Always add return types to exported functions
- Use named exports (no default exports)

### Examples

\`\`\`typescript
// Correct
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Wrong - no return type, default export
export default function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
\`\`\`

## Constraints & Rules

- **Never use \`any\`** type — use \`unknown\` or proper generics
- **Do not** commit \`.env\` files to version control
- **Must not** call external APIs directly from React components
- **Avoid** inline styles — use Tailwind utility classes
- **Must** include error boundaries around async operations
- Follow best practices for React performance (memo, useMemo, useCallback)

## Environment & Dependencies

Key dependencies in package.json:
- react: ^19.0.0
- typescript: ^5.4.0
- express: ^4.18.0
- pg: ^8.11.0

Environment variables:
- \`DATABASE_URL\` — PostgreSQL connection string
- \`REDIS_URL\` — Redis cache connection
- \`JWT_SECRET\` — Token signing key (in .env only)

## Testing & Quality

\`\`\`bash
npm test                # Jest unit tests
npm run test:coverage   # Coverage report (threshold: 80%)
npm run lint            # ESLint with --max-warnings 0
npx playwright test     # E2E tests
\`\`\`

Quality gates:
- All PRs require passing CI checks
- Minimum 80% coverage on new code
- No ESLint warnings allowed

## Workflow & CI/CD

### Branch Strategy

- \`main\` — production, auto-deploys
- \`develop\` — staging environment
- \`feature/*\` — feature branches

### CI Pipeline

1. Lint check (ESLint + Prettier)
2. Type check (tsc --noEmit)
3. Unit tests (Jest)
4. E2E tests (Playwright)
5. Build verification
6. Deploy to staging/production

### Deployment

Deploy via GitHub Actions:
- Staging: push to \`develop\`
- Production: merge PR to \`main\`
- Rollback: revert commit on \`main\`
`;

const MINIMAL_CLAUDE_MD = `# CLAUDE.md
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('instruction-linter integration', () => {
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-integration-'));
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // 1. Full pipeline with realistic CLAUDE.md
  // -------------------------------------------------------------------------

  describe('full pipeline with real CLAUDE.md', () => {
    it('should populate all fields from a realistic file', () => {
      const filePath = writeTempFile('CLAUDE.md', REALISTIC_CLAUDE_MD);

      const result = lintInstructionFile(filePath);

      // Core identity fields
      expect(result.filePath).toBe(filePath);
      expect(result.fileFormat).toBe('claude-md');

      // Scoring
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade);

      // GOLDEN scores — all 6 dimensions + total
      expect(result.goldenScores).toHaveProperty('goal');
      expect(result.goldenScores).toHaveProperty('output');
      expect(result.goldenScores).toHaveProperty('limits');
      expect(result.goldenScores).toHaveProperty('data');
      expect(result.goldenScores).toHaveProperty('evaluation');
      expect(result.goldenScores).toHaveProperty('next');
      expect(result.goldenScores).toHaveProperty('total');
      for (const dim of ['goal', 'output', 'limits', 'data', 'evaluation', 'next', 'total'] as const) {
        expect(result.goldenScores[dim]).toBeGreaterThanOrEqual(0);
        expect(result.goldenScores[dim]).toBeLessThanOrEqual(1);
      }

      // Issues array present (may or may not have items for this file)
      expect(Array.isArray(result.issues)).toBe(true);

      // Suggestions array present
      expect(Array.isArray(result.suggestions)).toBe(true);

      // Sections parsed — realistic file has multiple headings
      expect(result.sections.length).toBeGreaterThan(0);
      for (const section of result.sections) {
        expect(section).toHaveProperty('heading');
        expect(section).toHaveProperty('level');
        expect(section).toHaveProperty('content');
        expect(section).toHaveProperty('lineStart');
        expect(section).toHaveProperty('lineEnd');
        expect(section).toHaveProperty('codeBlocks');
        expect(section).toHaveProperty('references');
      }

      // References array (may be empty if no @refs in content)
      expect(Array.isArray(result.references)).toBe(true);

      // File metadata
      expect(result.fileSize).toBeGreaterThan(0);
      expect(result.lineCount).toBeGreaterThan(0);

      // Timestamp
      expect(result.analyzedAt).toBeTruthy();
      expect(() => new Date(result.analyzedAt)).not.toThrow();
    });

    it('should parse sections matching the file headings', () => {
      const filePath = writeTempFile('CLAUDE.md', REALISTIC_CLAUDE_MD);
      const result = lintInstructionFile(filePath);

      const headings = result.sections.map(s => s.heading);
      expect(headings).toContain('CLAUDE.md \u2014 My Project');
      expect(headings).toContain('Overview');
      expect(headings).toContain('Commands');
      expect(headings).toContain('Architecture');
      expect(headings).toContain('Critical Rules');
      expect(headings).toContain('Anti-Patterns');
    });

    it('should detect code blocks within sections', () => {
      const filePath = writeTempFile('CLAUDE.md', REALISTIC_CLAUDE_MD);
      const result = lintInstructionFile(filePath);

      const commandsSection = result.sections.find(s => s.heading === 'Commands');
      expect(commandsSection).toBeDefined();
      expect(commandsSection!.codeBlocks.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Save and retrieve round-trip
  // -------------------------------------------------------------------------

  describe('save and retrieve', () => {
    it('should round-trip lint result through the database', () => {
      const filePath = writeTempFile('CLAUDE.md', REALISTIC_CLAUDE_MD);
      const result = lintInstructionFile(filePath);

      // Save
      const id = saveAnalysis(db, result);
      expect(id).toBeGreaterThan(0);

      // Retrieve
      const retrieved = getLatestForFile(db, filePath);
      expect(retrieved).not.toBeNull();

      // Verify core fields match
      expect(retrieved!.filePath).toBe(result.filePath);
      expect(retrieved!.fileFormat).toBe(result.fileFormat);
      expect(retrieved!.overallScore).toBe(result.overallScore);
      expect(retrieved!.grade).toBe(result.grade);

      // Verify GOLDEN scores
      expect(retrieved!.goldenScores.goal).toBe(result.goldenScores.goal);
      expect(retrieved!.goldenScores.output).toBe(result.goldenScores.output);
      expect(retrieved!.goldenScores.limits).toBe(result.goldenScores.limits);
      expect(retrieved!.goldenScores.data).toBe(result.goldenScores.data);
      expect(retrieved!.goldenScores.evaluation).toBe(result.goldenScores.evaluation);
      expect(retrieved!.goldenScores.next).toBe(result.goldenScores.next);

      // Verify JSON-stored arrays
      expect(retrieved!.issues).toEqual(result.issues);
      expect(retrieved!.suggestions).toEqual(result.suggestions);
      expect(retrieved!.sections).toEqual(result.sections);
      expect(retrieved!.references).toEqual(result.references);

      // Verify metadata
      expect(retrieved!.fileSize).toBe(result.fileSize);
      expect(retrieved!.lineCount).toBe(result.lineCount);
      expect(retrieved!.analyzedAt).toBe(result.analyzedAt);
    });
  });

  // -------------------------------------------------------------------------
  // 3. History accumulation
  // -------------------------------------------------------------------------

  describe('history accumulation', () => {
    it('should return 3 entries in reverse chronological order after 3 saves', () => {
      const filePath = writeTempFile('CLAUDE.md', REALISTIC_CLAUDE_MD);

      const timestamps = [
        '2026-02-20T10:00:00.000Z',
        '2026-02-22T10:00:00.000Z',
        '2026-02-24T10:00:00.000Z',
      ];

      // Lint the file 3 times with different timestamps
      for (const ts of timestamps) {
        const result = lintInstructionFile(filePath);
        // Override timestamp so ordering is deterministic
        result.analyzedAt = ts;
        saveAnalysis(db, result);
      }

      const history = getHistory(db);

      expect(history).toHaveLength(3);

      // Reverse chronological order
      expect(history[0].analyzedAt).toBe('2026-02-24T10:00:00.000Z');
      expect(history[1].analyzedAt).toBe('2026-02-22T10:00:00.000Z');
      expect(history[2].analyzedAt).toBe('2026-02-20T10:00:00.000Z');

      // All entries point to the same file
      for (const entry of history) {
        expect(entry.filePath).toBe(filePath);
        expect(entry.fileFormat).toBe('claude-md');
      }
    });

    it('should filter history by filePath', () => {
      const fileA = writeTempFile('CLAUDE.md', REALISTIC_CLAUDE_MD);
      const fileB = writeTempFile('other-CLAUDE.md', MINIMAL_CLAUDE_MD);

      saveAnalysis(db, { ...lintInstructionFile(fileA), analyzedAt: '2026-02-20T10:00:00.000Z' });
      saveAnalysis(db, { ...lintInstructionFile(fileB), analyzedAt: '2026-02-21T10:00:00.000Z' });
      saveAnalysis(db, { ...lintInstructionFile(fileA), analyzedAt: '2026-02-22T10:00:00.000Z' });

      const historyA = getHistory(db, { filePath: fileA });
      expect(historyA).toHaveLength(2);
      expect(historyA.every(e => e.filePath === fileA)).toBe(true);

      const historyB = getHistory(db, { filePath: fileB });
      expect(historyB).toHaveLength(1);
      expect(historyB[0].filePath).toBe(fileB);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Well-structured file — high score
  // -------------------------------------------------------------------------

  describe('well-structured file', () => {
    it('should score >= 70 for a comprehensive CLAUDE.md', () => {
      const filePath = writeTempFile('CLAUDE.md', WELL_STRUCTURED_CLAUDE_MD);

      const result = lintInstructionFile(filePath);

      expect(result.overallScore).toBeGreaterThanOrEqual(70);
      // Grade should be B or A (70+ maps to B or higher)
      expect(['A', 'B']).toContain(result.grade);

      // All 6 dimensions should have non-zero scores
      expect(result.goldenScores.goal).toBeGreaterThan(0);
      expect(result.goldenScores.output).toBeGreaterThan(0);
      expect(result.goldenScores.limits).toBeGreaterThan(0);
      expect(result.goldenScores.data).toBeGreaterThan(0);
      expect(result.goldenScores.evaluation).toBeGreaterThan(0);
      expect(result.goldenScores.next).toBeGreaterThan(0);
    });

    it('should detect fewer issues than a minimal file', () => {
      const goodPath = writeTempFile('good-CLAUDE.md', WELL_STRUCTURED_CLAUDE_MD);
      const minPath = writeTempFile('min-CLAUDE.md', MINIMAL_CLAUDE_MD);

      const goodResult = lintInstructionFile(goodPath);
      const minResult = lintInstructionFile(minPath);

      expect(goodResult.issues.length).toBeLessThan(minResult.issues.length);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Minimal file — low score, issues detected
  // -------------------------------------------------------------------------

  describe('minimal file', () => {
    it('should score <= 40 for a nearly empty CLAUDE.md', () => {
      const filePath = writeTempFile('CLAUDE.md', MINIMAL_CLAUDE_MD);

      const result = lintInstructionFile(filePath);

      expect(result.overallScore).toBeLessThanOrEqual(40);
      // Grade should be D or F
      expect(['D', 'F']).toContain(result.grade);
    });

    it('should detect missing-section issues', () => {
      const filePath = writeTempFile('CLAUDE.md', MINIMAL_CLAUDE_MD);

      const result = lintInstructionFile(filePath);

      const missingIssues = result.issues.filter(i => i.type === 'missing');
      expect(missingIssues.length).toBeGreaterThan(0);

      // Should flag missing commands at minimum
      const descriptions = missingIssues.map(i => i.description.toLowerCase());
      expect(descriptions.some(d => d.includes('command') || d.includes('build'))).toBe(true);
    });

    it('should have minimal sections parsed', () => {
      const filePath = writeTempFile('CLAUDE.md', MINIMAL_CLAUDE_MD);

      const result = lintInstructionFile(filePath);

      // Only one heading: "# CLAUDE.md"
      expect(result.sections.length).toBe(1);
      expect(result.sections[0].heading).toBe('CLAUDE.md');
    });

    it('should report accurate file metadata', () => {
      const filePath = writeTempFile('CLAUDE.md', MINIMAL_CLAUDE_MD);

      const result = lintInstructionFile(filePath);

      const stat = fs.statSync(filePath);
      expect(result.fileSize).toBe(stat.size);
      expect(result.lineCount).toBe(MINIMAL_CLAUDE_MD.split('\n').length);
    });

    it('should still save and retrieve from DB correctly', () => {
      const filePath = writeTempFile('CLAUDE.md', MINIMAL_CLAUDE_MD);
      const result = lintInstructionFile(filePath);

      saveAnalysis(db, result);
      const retrieved = getLatestForFile(db, filePath);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.overallScore).toBe(result.overallScore);
      expect(retrieved!.grade).toBe(result.grade);
      expect(retrieved!.issues).toEqual(result.issues);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should resolve @references when referenced file exists', () => {
      // Create a referenced file
      const rulesDir = path.join(tmpDir, '.claude', 'rules');
      fs.mkdirSync(rulesDir, { recursive: true });
      fs.writeFileSync(path.join(rulesDir, 'strict.md'), '# Strict Mode\nAlways use strict.', 'utf-8');

      const content = `# CLAUDE.md

## Rules

@.claude/rules/strict.md
`;
      const filePath = writeTempFile('CLAUDE.md', content);
      const result = lintInstructionFile(filePath);

      const resolved = result.references.find(r => r.path === '.claude/rules/strict.md');
      expect(resolved).toBeDefined();
      expect(resolved!.exists).toBe(true);
      expect(resolved!.resolvedPath).toBe(path.join(tmpDir, '.claude', 'rules', 'strict.md'));
    });

    it('should handle @references to non-existent files', () => {
      const content = `# CLAUDE.md

## Rules

@.claude/rules/nonexistent.md
`;
      const filePath = writeTempFile('CLAUDE.md', content);
      const result = lintInstructionFile(filePath);

      const ref = result.references.find(r => r.path === '.claude/rules/nonexistent.md');
      expect(ref).toBeDefined();
      expect(ref!.exists).toBe(false);
    });

    it('should detect file format from filename', () => {
      const content = '# Rules\nUse TypeScript.\n';

      const claudePath = writeTempFile('CLAUDE.md', content);
      expect(lintInstructionFile(claudePath).fileFormat).toBe('claude-md');

      const cursorPath = writeTempFile('.cursorrules', content);
      expect(lintInstructionFile(cursorPath).fileFormat).toBe('cursorrules');

      const copilotPath = writeTempFile('copilot-instructions.md', content);
      expect(lintInstructionFile(copilotPath).fileFormat).toBe('copilot-instructions');
    });
  });
});
