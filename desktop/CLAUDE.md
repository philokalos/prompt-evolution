# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PromptLint** is an Electron desktop app that provides real-time prompt quality analysis with AI-powered personalized learning. It functions like Grammarly for prompts - accessible via global hotkey from any app.

**Core Features**:
- System tray app with global shortcut (Cmd+Shift+P)
- GOLDEN checklist compliance scoring (Goal, Output, Limits, Data, Evaluation, Next)
- Personal learning engine with history tracking and improvement analysis
- Reuses analysis modules from parent `prompt-evolution` project
- Session context awareness (reads active Claude Code project)

## Development Commands

```bash
# Development
npm run dev:electron              # Build all + launch Electron
npm run dev                       # Vite dev server only (renderer)

# Build (multiple tsconfigs)
npm run build:main                # Main process (ESM)
npm run build:preload             # Preload script (CommonJS → .cjs)
npm run build:renderer            # Vite build (React)
npm run build:analysis            # Bundle parent's analysis modules as CJS
npm run build:all                 # All of the above (required before dev:electron)

# Production builds
npm run dist:mac                  # macOS .dmg + .zip (output: release/)
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
│ - Clipboard/selection    │         │ - Settings modal         │
│                          │         │                          │
│ src/main/learning-engine │         │ Preload Bridge           │
│ - Analysis orchestration │         │ (window.electronAPI)     │
│ - SQLite history DB      │         │                          │
│ - Loads analysis modules │         └──────────────────────────┘
│                          │
│ src/main/session-context │
│ - Reads ~/.claude/projects/
│ - Provides project context
└──────────────────────────┘
```

### Build System (4 Separate TypeScript Configs)

| Config | Module | Output | Purpose |
|--------|--------|--------|---------|
| `tsconfig.main.json` | ES2020 | `dist/main/` | Main process (ESM) |
| `tsconfig.preload.json` | **CommonJS** | `dist/preload/index.cjs` | Preload script |
| `scripts/build-analysis.ts` | esbuild | `dist/analysis/*.cjs` | CJS bundles from parent |
| `vite.config.ts` | - | `dist/renderer/` | React renderer |

**Critical**: Preload must be CommonJS (`.cjs`) because Electron requires it, but `package.json` has `"type": "module"`. The build script renames `index.js` → `index.cjs`.

### IPC Communication

All IPC handlers defined in `src/main/index.ts` and `src/main/learning-engine.ts`:

| Handler | Purpose |
|---------|---------|
| `get-clipboard` / `set-clipboard` | Clipboard operations |
| `analyze-prompt` | GOLDEN checklist analysis + variants |
| `get-history`, `get-score-trend`, `get-stats` | Progress tracking |
| `get-session-context` | Active Claude Code project info |
| `hide-window`, `minimize-window` | Window controls |
| `renderer-ready` | Signals renderer ready (fixes IPC race) |

Preload exposes these as `window.electronAPI.*` via `contextBridge`.

### Text Capture System

`src/main/text-selection.ts` handles text capture with three modes (configurable):
- **auto**: Try selected text first (via AppleScript Cmd+C), fall back to clipboard
- **selection**: Only capture selected text
- **clipboard**: Only use existing clipboard content

Requires macOS Accessibility permission. Dialog prompts user if not granted.

### Analysis Module Loading

The learning engine loads bundled CJS modules (built via esbuild):
- **Development**: `dist/analysis/analysis-bundle.cjs`
- **Production**: `extraResources/analysis/analysis-bundle.cjs` (outside asar)

Source: `../src/analysis/` (parent project's GOLDEN evaluator, classifier)

### Data Storage

- **Settings**: `electron-store` (JSON in app data folder)
- **History DB**: SQLite via `better-sqlite3` in `~/.promptlint/history.db`

## Key Files

| File | Purpose |
|------|---------|
| `src/main/index.ts` | Electron entry, window, shortcuts, tray, capture mode |
| `src/main/learning-engine.ts` | Analysis orchestration, IPC handlers, module loading |
| `src/main/text-selection.ts` | AppleScript text capture, accessibility permission |
| `src/main/session-context.ts` | Reads Claude Code sessions from `~/.claude/projects/` |
| `src/main/prompt-rewriter.ts` | Generates 3 prompt variants (concise/detailed/structured) |
| `src/main/db/` | SQLite schema and repositories |
| `src/preload/index.ts` | Context bridge (main ↔ renderer) |
| `src/renderer/App.tsx` | Main React component, view mode state |
| `src/renderer/components/Settings.tsx` | Settings modal (shortcut, capture mode, etc.) |
| `scripts/build-analysis.ts` | esbuild script to bundle parent's analysis modules |

## Gotchas

1. **Preload must be `.cjs`**: Due to `"type": "module"` in package.json, all `.js` files are treated as ESM. Electron preload requires CommonJS.

2. **Window transparency**: `transparent: true` causes invisible windows on macOS. Use `backgroundColor` instead.

3. **Analysis modules bundled as CJS**: Parent project uses ESM, but Electron packaging requires CJS. The `build:analysis` script uses esbuild to create `*.cjs` bundles.

4. **Global shortcut timing**: `globalShortcut.unregisterAll()` must check `app.isReady()` in `will-quit` handler.

5. **IPC race condition**: Renderer may not be ready when main sends `clipboard-text`. Use `renderer-ready` signal and queue pending text.

6. **Text selection requires Accessibility**: AppleScript `keystroke` needs Accessibility permission. Check with `systemPreferences.isTrustedAccessibilityClient()`.
