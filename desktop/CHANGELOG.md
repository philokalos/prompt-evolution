# Changelog

All notable changes to PromptLint will be documented in this file.

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
