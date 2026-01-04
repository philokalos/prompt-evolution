# Changelog

All notable changes to PromptLint will be documented in this file.

## [0.1.7] - 2026-01-04

### Added
- **Global Shortcut Validation**: Error handling and user notification
  - Warning banner when shortcut registration fails (e.g., conflict with other apps)
  - Automatic re-registration when shortcut setting is changed
  - Guides user to Settings to configure alternative shortcut
- **Expandable Text Areas**: Better UX for long prompts
  - Auto-expanding input textarea (3 rows min, 300px max)
  - Expand/collapse toggle for output (appears when >200 chars)
  - Character count display for both input and output
- **Help View**: In-app help accessible from tray menu
  - Usage guide, keyboard shortcuts, and tips

### Changed
- **Smart Apply Button**: Only shown when applicable
  - Hidden for blocked apps (Cursor, VS Code, Claude, terminals)
  - These apps don't support AppleScript paste automation
  - Copy button always available with Cmd+V guidance
- **Responsive Layout**: Comparison grid adapts to screen size
  - 1 column on mobile, 2 columns on desktop

### Fixed
- Global shortcut conflicts with apps like AntiGravity now handled gracefully

## [0.1.6] - 2026-01-02

### Added
- **Innovative Activation Methods**: Three ways to trigger analysis
  - Global hotkey (Cmd+Shift+P, customizable)
  - Clipboard Watch mode with automatic prompt detection
  - Floating AI Context Button for one-click analysis
- **Session Context Awareness**: Integration with Claude Code sessions
  - Last exchange tracking (user message, assistant summary, modified files)
  - Tech stack inference from project files
  - Git branch detection
- **Comprehensive Test Suite**: 183 tests across 4 test files
  - claude-api.ts: 93.75% coverage (41 tests)
  - prompt-rewriter.ts: 90.07% coverage (98 tests)
  - clipboard-watcher.ts: 96.66% coverage (21 tests)
  - ai-context-popup.ts: 94.28% coverage (23 tests)

### Changed
- Enhanced prompt rewriting with session context enrichment
- Improved multi-variant AI generation with temperature control (0.3, 0.5, 0.7)
- Better error handling for API failures (401, 429, 500, 503)

### Fixed
- Auto-updater with private repo support and user-friendly errors
- TypeScript strict mode compliance in test files

## [0.1.1] - 2026-01-01

### Fixed
- **ESM/CJS Compatibility**: Fixed "Cannot use import statement outside a module" error in packaged app
  - Analysis modules now bundled as CJS using esbuild
  - Added `build-analysis.ts` script for module bundling
  - Updated `extraResources` to filter only `.cjs` files

### Changed
- Analysis modules loaded via `createRequire()` for ESM/CJS interop
- Learning engine now uses CJS bundles from `analysis-bundle.cjs`

### Verified
- GOLDEN score analysis working (14% → 50% with structured prompts)
- Global hotkey (Cmd+Shift+P) functioning
- Clipboard analysis flow operational
- Tray icon and menu working correctly

## [0.1.0] - 2024-12-XX

### Added
- Initial release
- System tray app with global shortcut
- GOLDEN checklist compliance scoring
- Personal learning engine with history tracking
- Radar chart visualization for GOLDEN scores
- SQLite-based analysis history
