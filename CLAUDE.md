# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Prompt Evolution** is a meta-prompting platform that analyzes Claude Code conversations to extract prompt patterns and automatically improve prompting effectiveness.

**Core Loop**: Capture → Parse → Analyze → Library → Evolve

**Key Feature**: References official Anthropic Claude prompt engineering best practices (GOLDEN checklist, anti-pattern detection) for empirical prompt quality evaluation.

**Three Components**:
1. **CLI** (`src/`) - Parse and analyze Claude Code conversations
2. **Web Dashboard** (`server/` + `web/`) - Express API + React visualization
3. **Desktop App** (`desktop/`) - Electron app "PromptLint" for real-time analysis (Cmd+Shift+P)

## Development Commands

```bash
# CLI Development
npm run dev                              # Watch mode with tsx
npm run build                            # TypeScript build
npm test                                 # Vitest

# Single test execution
npx vitest run src/parser/__tests__/session-parser.test.ts  # Run single test file
npx vitest -t "pattern"                  # Run tests matching pattern

# CLI execution
npx tsx src/cli.ts <command>             # Development
npm start <command>                      # Production (after build)
pe <command>                             # Global install alias

# Dashboard Development
cd web && npm install                    # Install web dependencies (first time)
npm run dev:server                       # Express API server (:3001)
npm run dev:web                          # Vite dev server (:5173)
npm run build:web                        # Build React frontend
npm run build:all                        # Build server + frontend

# TypeScript Configs
tsc                                      # CLI: tsconfig.json
tsc -p tsconfig.server.json              # Server: separate config
```

### CLI Commands

```bash
# Discovery
projects                                 # List Claude Code projects
sessions <project-id>                    # List sessions in project
parse <project-id> [session]             # Parse and display conversation

# Database
import [--incremental]                   # Import sessions to SQLite
import --project <id>                    # Import specific project
db-stats                                 # Database statistics

# Analysis
analyze [--incremental]                  # Run quality signal detection
analyze --conversation <id>              # Analyze specific conversation
classify "<text>"                        # Classify single prompt
classify --all                           # Classify all user turns
classify --stats                         # Classification statistics

# Reporting
insights                                 # Generate insights report
insights --period 7d                     # Filter by period (7d, 30d, 90d, all)
insights --problems | --strengths        # Filter by type
report [--output <path>]                 # Generate HTML report
```

Project ID format: Encoded path with dashes (e.g., `-Users-foo-project`)

### Dashboard API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stats` | GET | Overall database statistics |
| `/api/projects` | GET | Project list with per-project stats |
| `/api/insights` | GET | Insights report (problems, strengths, recommendations) |
| `/api/trends` | GET | Time-series data for charts |
| `/api/sync` | POST | Trigger manual data sync |
| `/api/sync/status` | GET | Sync status and scheduler info |

**Query Parameters**:
- `period`: 7d, 30d, 90d, all
- `metric`: volume, effectiveness, quality
- `groupBy`: day, week, month
- `project`: Filter by project ID

### Scheduler

Automatic data sync schedule:
- **Every 30 minutes**: Import new sessions (incremental)
- **Every 2 hours**: Analyze recent conversations (analyzeRecent)
- **Daily at 03:00**: Full refresh (fullRefresh)

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
      Report Layer (CLI output, HTML reports)
```

### Core Modules

**`src/parser/`** - JSONL parsing
- Reads from `~/.claude/projects/`
- Handles user message content as string OR array (text/tool_result blocks)

**`src/db/`** - SQLite persistence (better-sqlite3)
- Schema: conversations, turns, tool_usages, quality_signals, summaries
- Location: `~/.prompt-evolution/data.db`
- WAL mode enabled for performance

**`src/analysis/`** - Quality analysis
- `signal-detector.ts`: Detects quality signals (clarifications, corrections, frustration, praise)
- `classifier.ts`: Rule-based prompt classification (intent + task category)
- `scorer.ts`: Effectiveness scoring
- `insights.ts`: Aggregated insights generation (orchestrates all analysis modules)
- `prompt-library.ts`: Extracts reusable prompt patterns from usage data
- `guidelines-evaluator.ts`: GOLDEN checklist compliance evaluation (Goal, Output, Limits, Data, Evaluation, Next)
- `self-improvement.ts`: Personalized learning feedback with Before/After examples

**`src/report/`** - Output generation
- `html-generator.ts`: Static HTML reports with GOLDEN radar chart, prompt library, self-improvement sections

**`src/cli.ts`** - Command entry point

**`server/`** - Express API server
- `index.ts`: Express app entry point
- `routes/`: API route handlers (stats, insights, projects, trends, sync)
- `services/`: Business logic (sync-service, scheduler)
- `middleware/`: Error handling

**`web/`** - React dashboard (Vite + Tailwind)
- `src/api/`: API client with typed fetch functions
- `src/hooks/`: React Query hooks (useStats, useInsights, useTrends, etc.)
- `src/pages/`: Route components (Dashboard, Insights, Trends, Projects, Library, Guidebook)
- `src/components/`: Reusable UI components (charts, layout, guidebook)

### Database Schema

| Table | Purpose |
|-------|---------|
| conversations | Session metadata, token totals |
| turns | Individual messages (user/assistant) |
| tool_usages | Tools used per turn |
| quality_signals | Detected quality indicators |
| summaries | Session summaries |

### Classification Types

```typescript
type PromptIntent = 'command' | 'question' | 'instruction' | 'feedback' | 'context' | 'clarification' | 'unknown';

type TaskCategory = 'code-generation' | 'code-review' | 'bug-fix' | 'refactoring' |
  'explanation' | 'documentation' | 'testing' | 'architecture' | 'deployment' | 'data-analysis' | 'general' | 'unknown';
```

### Claude Code JSONL Structure

| Record Type | Key Fields |
|-------------|------------|
| `summary` | Session summary text |
| `system` | System events |
| `user` | User prompts (content: string \| ContentBlock[]) |
| `assistant` | AI responses with content array (text, thinking, tool_use), model, usage |

Records linked via `uuid` → `parentUuid`.

### Analysis Modules Integration

The `generateInsights()` function in `insights.ts` orchestrates:
```typescript
generateInsights(prompts, {
  period: '7d',                    // Time filter
  includeLibrary: true,            // Prompt pattern extraction
  includeGuidelines: true,         // GOLDEN score evaluation
  includeSelfImprovement: true,    // Learning feedback
});
```

**GOLDEN Checklist** evaluates prompts against:
- **G**oal: Clear objective stated
- **O**utput: Expected format specified
- **L**imits: Constraints defined
- **D**ata: Context/data provided
- **E**valuation: Success criteria given
- **N**ext: Follow-up actions clear

## Data Source

Claude Code stores conversations at:
```
~/.claude/projects/{encoded-project-path}/
├── {session-uuid}.jsonl      # Regular sessions
└── agent-{hash}.jsonl        # Agent task sessions
```

## Desktop App (PromptLint)

Separate Electron app in `desktop/` with its own `package.json`. See `desktop/CLAUDE.md` for detailed docs.

```bash
cd desktop
npm run dev:electron              # Build all + launch Electron
npm run dist:mac                  # macOS .dmg + .zip
```

**Key Architecture Points**:
- Reuses analysis modules from parent `src/analysis/` (bundled as CJS via esbuild)
- 4 separate tsconfigs: main (ESM), preload (CJS→.cjs), analysis (ESM), renderer (Vite)
- Preload script must output `.cjs` because package.json has `"type": "module"`

## Important Patterns

### ESM-Only Codebase
All packages use `"type": "module"`. Import paths must include `.js` extension:
```typescript
import { classifyPrompt } from './classifier.js';  // ✓
import { classifyPrompt } from './classifier';     // ✗
```

### User Message Content Format
Claude Code JSONL stores user content as string OR array - always handle both:
```typescript
// In parser/claude-code-parser.ts
const text = typeof content === 'string'
  ? content
  : content.filter(b => b.type === 'text').map(b => b.text).join('\n');
```

### Analysis Module Orchestration
`insights.ts` is the main orchestrator that combines all analysis modules:
```
insights.ts
├── classifier.ts      → Intent + category classification
├── scorer.ts          → Quality and effectiveness scoring
├── prompt-library.ts  → Pattern extraction
├── guidelines-evaluator.ts → GOLDEN checklist
└── self-improvement.ts → Learning feedback
```

### Three Data Layers
1. **Raw**: `~/.claude/projects/*.jsonl` (Claude Code source)
2. **Parsed**: In-memory `ParsedConversation` objects
3. **Persisted**: SQLite `~/.prompt-evolution/data.db`
