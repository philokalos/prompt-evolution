# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Prompt Evolution** is a meta-prompting platform that analyzes Claude Code conversations to extract prompt patterns and improve prompting effectiveness.

**Core Loop**: Capture → Parse → Analyze → Library → Evolve

**Key Feature**: Evaluates prompts against Anthropic's GOLDEN checklist (Goal, Output, Limits, Data, Evaluation, Next) for empirical quality assessment.

**Three Components**:
1. **CLI** (`src/`) - Parse and analyze Claude Code conversations
2. **Web Dashboard** (`server/` + `web/`) - Express API + React visualization
3. **Desktop App** (`desktop/`) - Electron app "PromptLint" with global hotkey (Cmd+Shift+P)

## Development Commands

```bash
# CLI Development
npm run dev                    # Watch mode (tsx)
npx tsx src/cli.ts <command>   # Run CLI directly without build

# CLI Build
npm run build                  # TypeScript build → dist/src/
npm start <command>            # Run built CLI (after build)

# Dashboard
npm run dev:server             # Express API (:3001)
npm run dev:web                # Vite dev (:5173) - runs in web/ directory
npm run build:server           # Build server → dist/server/
npm run build:web              # Build React → web/dist/
npm run build:all              # Build CLI + server + web
npm run start:dashboard        # Production dashboard server

# Testing
npm test                       # Vitest (no tests configured yet)

# Desktop App (separate package in desktop/)
cd desktop
npm run dev:electron           # Build all 4 configs + launch Electron
npm run dist:mac               # macOS .dmg + .zip → release/
npm run typecheck              # TypeScript check all configs
```

### CLI Commands

```bash
# Discovery
pe projects                        # List Claude Code projects
pe sessions <project-id>           # List sessions in project
pe parse <project-id> [session]    # Parse and display conversation

# Database
pe import [--incremental]          # Import sessions to SQLite
pe db-stats                        # Database statistics

# Analysis
pe analyze [--incremental]         # Run quality signal detection
pe classify "<text>"               # Classify single prompt
pe classify --all                  # Classify all user turns

# Reporting
pe insights [--period 7d|30d|90d]  # Generate insights report
pe report [--output <path>]        # Generate HTML report
```

Project ID format: Encoded path with dashes (e.g., `-Users-foo-project`)

## Architecture

### Data Flow

```
~/.claude/projects/{encoded-path}/*.jsonl
              ↓
      Parser Layer (JSONL → ParsedConversation)
              ↓
      Database Layer (SQLite ~/.prompt-evolution/data.db)
              ↓
      Analysis Layer (Signals, Classification, Scoring)
              ↓
      Report Layer (CLI output, HTML reports, Dashboard API)
```

### Module Structure

**`src/parser/`** - JSONL parsing from `~/.claude/projects/`

**`src/db/`** - SQLite persistence (better-sqlite3, WAL mode)
- Tables: conversations, turns, tool_usages, quality_signals, summaries

**`src/analysis/`** - Quality analysis (main orchestrator: `insights.ts`)
- `guidelines-evaluator.ts`: GOLDEN checklist scoring
- `classifier.ts`: Intent + task category classification
- `signal-detector.ts`: Quality signals (clarifications, corrections, frustration)
- `prompt-library.ts`: Reusable pattern extraction
- `self-improvement.ts`: Before/After improvement examples

**`src/report/`** - HTML report generation with GOLDEN radar chart

**`server/`** - Express API with scheduled sync
- Routes: stats, projects, insights, trends, sync
- Scheduler: 30min imports, 2hr analysis, daily full refresh
- Middleware: Custom error handler with structured responses

**`web/`** - React dashboard (Vite + Tailwind + React Query)
- Pages: Dashboard, Projects, Insights, Trends, Library, Guidebook
- Hooks: useStats, useProjects, useInsights, useTrends, useSync
- API client: Centralized in `api/client.ts`

### TypeScript Configs

| Config | Scope | Output |
|--------|-------|--------|
| `tsconfig.json` | CLI (`src/`) | `dist/src/` |
| `tsconfig.server.json` | CLI + Server | `dist/` |

### Classification Types

```typescript
type PromptIntent = 'command' | 'question' | 'instruction' | 'feedback' | 'context' | 'clarification' | 'unknown';

type TaskCategory = 'code-generation' | 'code-review' | 'bug-fix' | 'refactoring' |
  'explanation' | 'documentation' | 'testing' | 'architecture' | 'deployment' | 'data-analysis' | 'general' | 'unknown';
```

## Important Patterns

### ESM-Only Codebase
All packages use `"type": "module"`. Import paths require `.js` extension:
```typescript
import { classifyPrompt } from './classifier.js';  // ✓
import { classifyPrompt } from './classifier';     // ✗
```

### User Message Content Format
Claude Code JSONL stores user content as string OR array:
```typescript
const text = typeof content === 'string'
  ? content
  : content.filter(b => b.type === 'text').map(b => b.text).join('\n');
```

### JSONL Record Structure

| Record Type | Key Fields |
|-------------|------------|
| `summary` | Session summary text |
| `user` | User prompts (content: string \| ContentBlock[]) |
| `assistant` | AI responses with content array, model, usage |

Records linked via `uuid` → `parentUuid`.

## Desktop App

Separate Electron app in `desktop/` with its own `package.json` and detailed `CLAUDE.md`.

**Key Points**:
- Reuses parent `src/analysis/` modules (bundled as CJS via esbuild in `scripts/build-analysis.ts`)
- 4 TypeScript configs: main (ESM), preload (CJS→.cjs), analysis (ESM), renderer (Vite)
- Preload must output `.cjs` due to `"type": "module"` in package.json
- Requires macOS Accessibility permission for text selection
- SQLite history stored at `~/.promptlint/history.db`

**Build Order Matters**: `build:analysis` → `build:main` → `build:preload` → `build:renderer`

## Data Sources

**CLI/Dashboard** reads from:
```
~/.claude/projects/{encoded-project-path}/
├── {session-uuid}.jsonl      # Regular sessions
└── agent-{hash}.jsonl        # Agent task sessions
```

**SQLite Database**: `~/.prompt-evolution/data.db` (WAL mode)

## Repository Boundaries

- `desktop/` is a standalone npm package with separate dependencies
- `web/` has its own package.json and builds independently
- Parent's `src/analysis/` modules are shared via esbuild bundling into desktop
