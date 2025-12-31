# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PromptLint** is an Electron desktop app that provides real-time prompt quality analysis with AI-powered personalized learning. It functions like Grammarly for prompts - accessible via global hotkey from any app.

**Core Features**:
- System tray app with global shortcut (Cmd+Shift+P)
- GOLDEN checklist compliance scoring (Goal, Output, Limits, Data, Evaluation, Next)
- Personal learning engine with history tracking and improvement analysis
- Reuses analysis modules from parent `prompt-evolution` project

## Development Commands

```bash
# Development
npm run dev:electron              # Build all + launch Electron
npm run dev                       # Vite dev server only (renderer)

# Build (multiple tsconfigs)
npm run build:main                # Main process (ESM)
npm run build:preload             # Preload script (CommonJS → .cjs)
npm run build:renderer            # Vite build (React)
npm run build:analysis            # Parent project's analysis modules
npm run build:all                 # All of the above

# Production builds
npm run dist:mac                  # macOS .dmg + .zip
npm run dist:win                  # Windows .exe
npm run pack                      # Unpacked build for testing

# Other
npm run lint                      # ESLint
npm run typecheck                 # TypeScript check
npm run generate-icons            # Regenerate app icons from SVG
```

## Architecture

### Electron Process Model

```
Main Process (Node.js, ESM)          Renderer Process (Chromium)
┌──────────────────────────┐         ┌──────────────────────────┐
│ src/main/index.ts        │         │ src/renderer/App.tsx     │
│ - Window management      │◄──IPC──►│ - React UI               │
│ - Global shortcuts       │         │ - GOLDEN radar chart     │
│ - System tray            │         │ - Progress tracking      │
│ - Clipboard access       │         │                          │
│                          │         │ Preload Bridge           │
│ src/main/learning-engine │         │ (window.electronAPI)     │
│ - Analysis orchestration │         │                          │
│ - SQLite history DB      │         └──────────────────────────┘
│ - Loads analysis modules │
└──────────────────────────┘
```

### Build System (4 Separate TypeScript Configs)

| Config | Module | Output | Purpose |
|--------|--------|--------|---------|
| `tsconfig.main.json` | ES2020 | `dist/main/` | Main process (ESM) |
| `tsconfig.preload.json` | **CommonJS** | `dist/preload/index.cjs` | Preload script |
| `tsconfig.analysis.json` | ES2020 | `dist/analysis/` | Analysis modules from parent |
| `vite.config.ts` | - | `dist/renderer/` | React renderer |

**Critical**: Preload must be CommonJS (`.cjs`) because Electron requires it, but `package.json` has `"type": "module"`. The build script renames `index.js` → `index.cjs`.

### IPC Communication

Main process handlers in `src/main/index.ts` and `src/main/learning-engine.ts`:
- `get-clipboard` / `set-clipboard`: Clipboard operations
- `analyze-prompt`: GOLDEN checklist analysis
- `get-history`, `get-score-trend`, `get-stats`: Progress tracking
- `hide-window`, `minimize-window`: Window controls

Preload exposes these as `window.electronAPI.*` via `contextBridge`.

### Analysis Module Loading

The learning engine dynamically loads analysis modules from parent project:
- **Development**: `dist/analysis/` (built from `../src/analysis/`)
- **Production**: `extraResources/analysis/` (packaged outside asar)

**Known Issue**: Analysis modules use ESM imports but are loaded in CommonJS context in production. Currently runs in fallback mode.

### Data Storage

- **Settings**: `electron-store` (JSON in app data)
- **History DB**: SQLite via `better-sqlite3` in `~/.promptlint/history.db`

## Key Files

| File | Purpose |
|------|---------|
| `src/main/index.ts` | Electron entry, window, shortcuts, tray |
| `src/main/learning-engine.ts` | Analysis orchestration, IPC handlers |
| `src/main/db/` | SQLite schema and repositories |
| `src/preload/index.ts` | Context bridge (main ↔ renderer) |
| `src/renderer/App.tsx` | Main React component |
| `src/renderer/components/GoldenRadar.tsx` | SVG radar chart |

## Gotchas

1. **Preload must be `.cjs`**: Due to `"type": "module"` in package.json, all `.js` files are treated as ESM. Electron preload requires CommonJS.

2. **Window transparency**: `transparent: true` causes invisible windows on macOS. Use `backgroundColor` instead.

3. **Analysis module ESM**: The analysis modules from parent project use ESM imports but electron-builder packages them in a CJS context. App falls back to basic analysis.

4. **Global shortcut timing**: `globalShortcut.unregisterAll()` must check `app.isReady()` in `will-quit` handler.
