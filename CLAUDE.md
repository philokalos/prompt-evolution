# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Prompt Evolution** is a meta-prompting platform that analyzes Claude Code conversations to extract prompt patterns and improve prompting effectiveness.

**Core Loop**: Capture → Parse → Analyze → Library → Evolve

**Key Feature**: Evaluates prompts against Anthropic's GOLDEN checklist (Goal, Output, Limits, Data, Evaluation, Next) for empirical quality assessment.

**Three Components**:
1. **CLI** (`src/`) - Parse and analyze Claude Code conversations
2. **Web Dashboard** (`server/` + `web/`) - Express API + React visualization
3. **Desktop App** (`desktop/`) - Electron app "PromptLint" with global hotkey (Cmd+Shift+P). See `desktop/CLAUDE.md` for detailed documentation.

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

# Web Linting
cd web && npm run lint         # ESLint for React dashboard

# Desktop App (separate package)
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
- Scheduler: 30min incremental imports, 2hr analysis, 4AM daily full refresh
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

**Key Integration Point**: Reuses parent `src/analysis/` modules via esbuild bundling to CJS (`scripts/build-analysis.ts`).

**Critical Build Detail**: Preload script must output `.cjs` because Electron requires CommonJS, but `package.json` has `"type": "module"`.

See `desktop/CLAUDE.md` for complete architecture, IPC handlers, and gotchas.

## Data Sources

**CLI/Dashboard** reads from:
```
~/.claude/projects/{encoded-project-path}/
├── {session-uuid}.jsonl      # Regular sessions
└── agent-{hash}.jsonl        # Agent task sessions
```

**SQLite Database**: `~/.prompt-evolution/data.db` (WAL mode)

## Environment Variables

**For AI-powered features** (CLI `improve` command, Desktop AI rewriting):
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Without API key, rule-based improvements still work (~11% → 71% improvement vs ~11% → 83% with AI).

## Production Deployment (Dashboard)

### Quick Start

```bash
# Build everything
npm run build:all

# Start server (manual)
npm run prod:start

# Check status
npm run prod:status

# View logs
npm run prod:logs

# Stop server
npm run prod:stop
```

### Auto-Start on Login (macOS LaunchAgent)

```bash
# Install LaunchAgent (starts on login)
npm run prod:install

# Uninstall LaunchAgent
npm run prod:uninstall
```

Dashboard runs at `http://localhost:3001`.

### Production Scripts

| Command | Description |
|---------|-------------|
| `npm run prod:start` | Start server in background |
| `npm run prod:stop` | Stop running server |
| `npm run prod:status` | Check if server is running |
| `npm run prod:logs` | Tail server logs |
| `npm run prod:install` | Install macOS auto-start |
| `npm run prod:uninstall` | Remove macOS auto-start |

### PM2 Alternative

If PM2 is installed globally (`npm i -g pm2`):

```bash
pm2 start ecosystem.config.cjs
pm2 stop prompt-evolution
pm2 logs prompt-evolution
pm2 startup  # Enable PM2 auto-start
```

### Files

- `scripts/start-server.sh` - Startup script
- `scripts/stop-server.sh` - Shutdown script
- `scripts/com.philokalos.prompt-evolution.plist` - macOS LaunchAgent
- `ecosystem.config.cjs` - PM2 configuration
- `logs/` - Server logs directory

## Repository Boundaries

- `desktop/` is a standalone npm package with separate dependencies
- `web/` has its own package.json and builds independently
- Parent's `src/analysis/` modules are shared via esbuild bundling into desktop
