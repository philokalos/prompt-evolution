# Architecture Guide

## System Overview

Prompt Evolution is a prompt analytics platform that captures AI assistant conversations, analyzes prompt quality, and provides improvement suggestions. The system follows a **Capture -> Parse -> Analyze -> Library -> Evolve** core loop.

## Products

The platform consists of three main products sharing a common analysis core:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Products (3)                                │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Desktop App   │    Dashboard    │       Landing Page          │
│   (PromptLint)  │  (Express+React)│        (Vercel)             │
│   desktop/      │  server/ + web/ │     landing-page/           │
└────────┬────────┴────────┬────────┴─────────────────────────────┘
         │                 │
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │   Shared Core   │
         │      src/       │
         └─────────────────┘
```

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop | Electron | 39.x |
| Frontend | React + TypeScript | 18.x |
| Styling | Tailwind CSS | 3.x |
| Backend | Express.js | 4.x |
| Database | SQLite (better-sqlite3) | - |
| Build | Vite + esbuild + tsc | 5.x |
| Testing | Vitest | 4.x |
| AI Integration | Anthropic SDK | 0.71.x |

## Directory Structure

```
prompt-evolution/
├── src/                      # Shared core (CLI + analysis)
│   ├── analysis/             # Analysis modules
│   │   ├── classifier.ts     # Prompt classification (intent + category)
│   │   ├── scorer.ts         # GOLDEN scoring system
│   │   ├── insights.ts       # Insights generation
│   │   ├── llm-improver.ts   # AI-powered improvements
│   │   └── patterns/         # Pattern detection
│   ├── parser/               # JSONL conversation parser
│   ├── db/                   # SQLite schema and queries
│   ├── cli/                  # CLI commands
│   └── types/                # TypeScript type definitions
│
├── desktop/                  # Electron desktop app (PromptLint)
│   ├── src/
│   │   ├── main/             # Main process (Node.js)
│   │   │   ├── index.ts      # Entry, window, shortcuts
│   │   │   ├── learning-engine.ts
│   │   │   ├── prompt-rewriter.ts
│   │   │   └── claude-api.ts
│   │   ├── renderer/         # Renderer process (React)
│   │   │   ├── App.tsx
│   │   │   └── components/
│   │   ├── preload/          # Electron preload bridge
│   │   └── locales/          # i18n translations
│   └── scripts/              # Build scripts
│
├── server/                   # Dashboard API server
│   ├── routes/               # API endpoints
│   ├── repositories/         # Data access layer
│   ├── services/             # Business logic
│   └── validation/           # Request validation (Zod)
│
├── web/                      # Dashboard frontend (Vite + React)
│   └── src/
│
├── landing-page/             # Marketing site
│
├── scripts/                  # Server management scripts
│
└── docs/                     # Documentation
```

## Data Flow

### Core Pipeline

```
~/.claude/projects/{path}/*.jsonl
              │
              ▼
        ┌─────────────┐
        │   Parser    │  Parse JSONL → Conversations + Turns
        └──────┬──────┘
               │
               ▼
        ┌─────────────┐
        │   SQLite    │  Store parsed data with metadata
        └──────┬──────┘
               │
               ▼
        ┌─────────────┐
        │  Classifier │  Intent (7 types) + Category (12 types)
        └──────┬──────┘
               │
               ▼
        ┌─────────────┐
        │   Scorer    │  GOLDEN scoring (6 dimensions, 0-1 each)
        └──────┬──────┘
               │
               ▼
        ┌─────────────┐
        │  Insights   │  Patterns, problems, recommendations
        └─────────────┘
```

### Desktop App Flow

```
Hotkey (Cmd+Shift+P)
         │
         ▼
Text Capture (AppleScript/Clipboard)
         │
         ▼
Learning Engine
   ├─→ GOLDEN Evaluation
   ├─→ Prompt Classification
   ├─→ Rule-based Variants (3 options)
   ├─→ AI Variant (optional, Claude API)
   ├─→ History Enrichment
   └─→ SQLite Save
         │
         ▼
Renderer UI (Radar chart, issues, variants)
```

## Key Architectural Decisions

### ADR-001: ESM-only Codebase
- **Context**: Modern Node.js ecosystem moving to ESM
- **Decision**: Use ES modules exclusively with `.js` extensions in imports
- **Consequences**: Better tree-shaking, cleaner async/await, requires careful build configuration

### ADR-002: Electron Preload as CommonJS
- **Context**: Electron requires CommonJS for preload scripts, but package.json has `"type": "module"`
- **Decision**: Build preload separately with explicit `.cjs` output
- **Consequences**: Additional build step, but maintains security and compatibility

### ADR-003: Shared Analysis Bundle for Desktop
- **Context**: Desktop needs analysis modules but Electron packaging requires specific formats
- **Decision**: Use esbuild to create CJS bundles from parent's ESM analysis modules
- **Consequences**: Analysis code reused across products, single source of truth

### ADR-004: SQLite for Local Storage
- **Context**: Need local persistence without external database dependency
- **Decision**: Use better-sqlite3 with WAL mode for performance
- **Consequences**: Zero-config deployment, but no built-in multi-client sync

### ADR-005: GOLDEN Scoring Framework
- **Context**: Need objective prompt quality measurement
- **Decision**: 6-dimension scoring (Goal, Output, Limits, Data, Evaluation, Next)
- **Consequences**: Consistent evaluation, actionable improvement areas, 0-1 normalized scores

## Module Architecture

### Analysis Layer

```
┌─────────────────────────────────────────────────────────────┐
│                     Analysis Modules                         │
├─────────────────┬─────────────────┬─────────────────────────┤
│   classifier.ts │    scorer.ts    │    insights.ts          │
│   ─────────────│   ──────────────│   ─────────────────────  │
│   PromptIntent  │   GOLDEN scores │   Problem detection     │
│   - command     │   - Goal: 0-1   │   Pattern recognition   │
│   - question    │   - Output: 0-1 │   Recommendations       │
│   - instruction │   - Limits: 0-1 │                         │
│   - feedback    │   - Data: 0-1   │                         │
│   - clarify     │   - Eval: 0-1   │                         │
│   - context     │   - Next: 0-1   │                         │
│   - other       │                 │                         │
│                 │   TaskCategory  │                         │
│                 │   (12 types)    │                         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### Desktop Process Model

```
Main Process (Node.js, ESM)              Renderer Process (Chromium)
┌────────────────────────────┐           ┌──────────────────────────┐
│ index.ts                   │           │ App.tsx                  │
│ - Window/tray/shortcuts    │◄───IPC───►│ - React UI               │
│ - Text capture             │           │ - GOLDEN radar chart     │
│                            │           │ - Variant comparison     │
│ learning-engine.ts         │           │                          │
│ - Analysis orchestration   │           │ Preload Bridge           │
│ - Variant generation       │           │ (window.electronAPI)     │
│ - SQLite persistence       │           └──────────────────────────┘
│                            │
│ active-window-detector.ts  │
│ - IDE detection            │
│ - Project path resolution  │
└────────────────────────────┘
```

## Security Considerations

### Data Privacy
- All data stored locally in SQLite
- No external data transmission except optional AI API calls
- Claude Code JSONL files read from user's home directory

### Desktop App Security
- Hardened runtime on macOS
- Context isolation in Electron
- IPC message validation

### API Keys
- AI API keys stored in electron-store (encrypted by OS)
- Never transmitted except to AI provider APIs

## Performance Considerations

### Session File Parsing
- Size-aware parsing in session-context.ts
- Full parse for files < 10MB
- Tail-only parsing for larger files (last 100 lines)

### Database
- SQLite with WAL mode for concurrent reads
- Indexes on frequently queried columns
- Incremental sync to avoid full re-import

### Caching
- 30-second cache for session context
- mtime-based cache invalidation
- In-memory caching for repeated analysis

## Build System

| Component | Build Tool | Output |
|-----------|-----------|--------|
| CLI | tsc | `dist/` (ESM) |
| Server | tsc | `dist/server/` (ESM) |
| Web Dashboard | Vite | `web/dist/` |
| Desktop Main | tsc | `desktop/dist/main/` (ESM) |
| Desktop Preload | tsc | `desktop/dist/preload/index.cjs` |
| Desktop Renderer | Vite | `desktop/dist/renderer/` |
| Analysis Bundle | esbuild | `desktop/dist/analysis/*.cjs` |

## Deployment

### Dashboard Server
```bash
# Development
npm run dev:server    # Watch mode on :3001

# Production
npm run build:all
npm run prod:start    # Daemonized server
npm run prod:stop
```

### Desktop App
```bash
# Development
cd desktop && npm run dev:electron

# Production
cd desktop && npm run dist:mac    # Creates .dmg + .zip
```

## Extension Points

### Adding New Analysis Modules
1. Create module in `src/analysis/`
2. Export from `src/analysis/index.ts`
3. Add to esbuild config if needed for desktop

### Adding New API Endpoints
1. Create route file in `server/routes/`
2. Register in `server/routes/index.ts`
3. Add validation schema if needed

### Adding AI Providers
1. Implement provider interface in `desktop/src/main/providers/`
2. Register in provider factory
3. Add to settings UI
