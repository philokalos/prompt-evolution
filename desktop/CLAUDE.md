# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PromptLint** is an Electron desktop app that provides real-time prompt quality analysis with AI-powered personalized learning. Functions like Grammarly for prompts - accessible via global hotkey from any app.

**Core Features**:
- System tray app with global shortcut (Cmd+Shift+P)
- GOLDEN checklist scoring (Goal, Output, Limits, Data, Evaluation, Next)
- 3 rule-based prompt variants + optional AI rewriting (Claude API)
- Active IDE/project detection (VS Code, Cursor, JetBrains, terminals)
- Personal learning engine with history tracking and project-specific patterns
- Session context awareness (reads `~/.claude/projects/`)

## Development Commands

```bash
# Development
npm run dev:electron              # Build all + launch Electron
npm run dev                       # Vite dev server only (renderer)

# Build (4 separate configs)
npm run build:analysis            # Bundle parent's analysis modules as CJS
npm run build:main                # Main process (ESM)
npm run build:preload             # Preload script (CommonJS → .cjs)
npm run build:renderer            # Vite build (React)
npm run build:all                 # All of the above

# Production
npm run dist:mac                  # macOS .dmg + .zip (output: release/)
npm run pack                      # Unpacked build for testing

# Other
npm run typecheck                 # TypeScript check
npm run lint                      # ESLint
npm run generate-icons            # Regenerate app icons from SVG
```

## Architecture

### Process Model

```
Main Process (Node.js, ESM)              Renderer Process (Chromium)
┌────────────────────────────┐           ┌──────────────────────────┐
│ index.ts                   │           │ App.tsx                  │
│ - Window/tray/shortcuts    │◄───IPC───►│ - React UI               │
│ - Text capture (AppleScript)│          │ - GOLDEN radar chart     │
│                            │           │ - Variant comparison     │
│ learning-engine.ts         │           │ - Progress tracking      │
│ - Analysis orchestration   │           │ - History recommendations│
│ - Variant generation       │           │                          │
│ - SQLite persistence       │           │ Preload Bridge           │
│                            │           │ (window.electronAPI)     │
│ active-window-detector.ts  │           └──────────────────────────┘
│ - IDE window parsing       │
│ - Project path resolution  │
│                            │
│ claude-api.ts              │
│ - AI-powered rewriting     │
│                            │
│ session-context.ts         │
│ - Claude Code JSONL reader │
│ - Tech stack inference     │
└────────────────────────────┘
```

### Data Flow

```
Hotkey (Cmd+Shift+P)
       ↓
Text Capture (AppleScript or clipboard)
       ↓
Learning Engine
  ├─→ GOLDEN Evaluation (analysis-bundle.cjs)
  ├─→ Prompt Classification (classifier-bundle.cjs)
  ├─→ Rule-based Variants (conservative/balanced/comprehensive)
  ├─→ AI Variant (Claude API, if enabled)
  ├─→ History Enrichment (project patterns, recommendations)
  └─→ SQLite Save
       ↓
Renderer UI (radar, issues, variants, tips)
```

### Build System

| Config | Module | Output | Purpose |
|--------|--------|--------|---------|
| `tsconfig.main.json` | ES2020 | `dist/main/` | Main process |
| `tsconfig.preload.json` | **CommonJS** | `dist/preload/index.cjs` | Preload script |
| `scripts/build-analysis.ts` | esbuild | `dist/analysis/*.cjs` | Parent analysis modules |
| `vite.config.ts` | ESM | `dist/renderer/` | React renderer |

**Critical**: Preload must be `.cjs` because Electron requires CommonJS, but `package.json` has `"type": "module"`.

## Key Modules

### Main Process (`src/main/`)

| Module | Purpose |
|--------|---------|
| `index.ts` | Electron entry, window, shortcuts, tray, capture mode settings |
| `learning-engine.ts` | Analysis orchestration, IPC handlers, variant generation |
| `text-selection.ts` | AppleScript text capture, accessibility permission check |
| `active-window-detector.ts` | IDE window parsing (VS Code, Cursor, JetBrains, terminals) |
| `session-context.ts` | Claude Code JSONL reader, tech stack inference, git branch |
| `prompt-rewriter.ts` | 3 rule-based variants with tech stack hints |
| `claude-api.ts` | Anthropic SDK integration for AI rewriting |
| `history-pattern-analyzer.ts` | Project-specific patterns, dimensional weaknesses |
| `db/` | SQLite schema, migrations, history repository |

### Renderer (`src/renderer/`)

| Component | Purpose |
|-----------|---------|
| `App.tsx` | Main component, view modes (analysis/progress/tips) |
| `GoldenRadar.tsx` | Radar chart of 6 GOLDEN dimensions |
| `IssueList.tsx` | Severity-sorted issues with suggestions |
| `PromptComparison.tsx` | Original vs variants with copy buttons |
| `HistoryRecommendations.tsx` | Project pattern insights |
| `ProgressTracker.tsx` | Score trends and weekly stats |
| `Settings.tsx` | Hotkey, capture mode, API key, polling config |

## Key Features

### Text Capture Modes

Three modes (configurable in settings):
- **auto**: AppleScript selection first, clipboard fallback
- **selection**: Only AppleScript-simulated Cmd+C
- **clipboard**: Only existing clipboard content

**App Blocklist**: Cursor, VS Code, Claude, terminals crash with AppleScript keystroke simulation → automatic clipboard fallback.

### Prompt Variant Generation

**Rule-based** (always generated):
1. **Conservative** (~60% confidence): Minimal changes, targets lowest dimension
2. **Balanced** (~70-75%): GOLDEN 6-dimension structure with category templates
3. **Comprehensive** (~90-95%): Full structure with tech stack inference

**AI-powered** (optional, requires API key):
- Multi-variant generation: 3 candidates at temperatures 0.3, 0.5, 0.7
- Real GOLDEN evaluation on each variant → select best score
- Results: 11% → 83%+ improvement (+700%)
- When not configured: Shows setup guidance UI with "설정하기" button

**Offline mode** (no API):
- GOLDEN 6-dimension structured output
- Category-specific templates (code-gen, bug-fix, refactoring, etc.)
- Tech stack inference from prompt keywords
- Results: 11% → 71% improvement (+564%)

### Active Project Detection

Polling-based (every 2s):
- **VS Code/Cursor**: Parses window title "file.ts — project — IDE"
- **JetBrains**: "project [/path] — file.ts"
- **Terminals**: "user@host: /path/to/project"
- Filesystem validation with confidence scoring

### Session Context Enrichment

From `~/.claude/projects/*.jsonl`:
- Current task (from summary or recent user message)
- Tech stack (file extensions + config files + package.json)
- Recent tools and files
- Git branch (from `.git/HEAD`)

30-second cache with mtime-based invalidation.

### History-Based Learning

SQLite queries for personalization:
- Project-specific GOLDEN averages
- Dimensional weaknesses (e.g., "output" consistently low)
- High-scoring example prompts for reference
- Improvement tracking ("12% better than your average")

## IPC Handlers

| Handler | Purpose |
|---------|---------|
| `analyze-prompt` | Full analysis + variants + history enrichment |
| `get-history`, `get-score-trend`, `get-stats` | Progress tracking |
| `get-golden-averages`, `get-top-weaknesses` | Dimensional analysis |
| `get-project-patterns`, `get-context-recommendations` | Phase 2 personalization |
| `get-session-context`, `get-current-project` | Context info |
| `renderer-ready` | Fixes IPC race condition |
| `get-clipboard`, `set-clipboard` | Clipboard operations |
| `hide-window`, `minimize-window` | Window controls |

## Data Storage

- **Settings**: `electron-store` (JSON in app data folder)
- **History DB**: SQLite at `~/.promptlint/history.db` (WAL mode)

Schema migrations tracked in `schema_version` table.

## Gotchas

1. **Preload must be `.cjs`**: Due to `"type": "module"`, Electron preload requires explicit CommonJS.

2. **Analysis modules bundled as CJS**: Parent uses ESM, Electron packaging requires CJS. The `build:analysis` script uses esbuild.

3. **IPC race condition**: Renderer may not be ready when main sends text. Use `renderer-ready` signal + queue pending text.

4. **AppleScript crashes some apps**: Cursor, VS Code, Claude, terminals crash with simulated keystrokes. Blocklist with clipboard fallback.

5. **Text selection requires Accessibility**: Check with `systemPreferences.isTrustedAccessibilityClient()`.

6. **Window positioning**: Use `screen.getDisplayNearestPoint()` for multi-monitor setups.

7. **Large session files**: Size-aware parsing (full for <10MB, last 100 lines for larger).

8. **Global shortcut cleanup**: `globalShortcut.unregisterAll()` must check `app.isReady()` in `will-quit`.
