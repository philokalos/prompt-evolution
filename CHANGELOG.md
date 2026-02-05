# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.13] - 2025-02-05

### Changed
- Centralize config and extract utilities with test coverage
- Organize shared types into modular structure (`shared/types/`)
- Extract window modules (`main-window.ts`, `positioning.ts`, `shortcuts.ts`)
- Extract IPC handlers into dedicated modules (`main/ipc/`)

### Fixed
- Fix text-selection tests and add env-util tests

## [0.1.12] - 2025-02-04

### Changed
- Extract isMASBuild utility and enable sandbox mode for MAS builds
- Remove unnecessary network.server entitlement from MAS build

## [0.1.11] - 2025-01-30

### Added
- Enhanced core values: Radar chart improvements, Timeline visualization, categorized Insights
- Ghost Bar history persistence with unit tests and CI/CD
- Context-aware classification for improved COSP analysis quality
- Comprehensive test coverage expansion from 58% to 90%
  - Phase 1: IPC handlers, Ghost Bar, AI providers
  - Phase 2: Settings Store and i18n System
  - Phase 3: Renderer components (GoldenRadar, IssueList)
  - Learning engine edge case tests

### Changed
- Redesigned Settings UI with 52% reduction in settings count
- Simplified PromptLint UX with improvement badge
- Split main process modules and hardened security
- Consolidated App.tsx state management with useReducer
- Removed Quick Action Mode in favor of Ghost Bar
- Removed unused Project Settings and Template features

### Fixed
- Achieve perfect code quality - 0 errors, 0 warnings
- Build script to preserve dist/src for server dependencies
- Type safety issues in useAppState hook
- COSP confidence test thresholds aligned with v3 calibration

## [0.1.10] - 2025-01-26

### Added
- Ghost Bar UX for simplified prompt improvement (#6)
- Category-specific templates for improved prompt rewriting
- i18n support with English and Korean translations (#5)
- Multi-provider AI API support (Anthropic, OpenAI, Google)
- Quick Action Mode with compact UI (#3)

### Changed
- Prioritize Before/After transformation in UI layout
- Improve TypeScript strict mode compliance and React patterns
- Replace 3 rule-based variants with single COSP variant

### Fixed
- Add mainWindow safety checks with isMainWindowValid helper
- Resolve TypeScript errors in renderer components
- Use language-aware keyword matching in classifier
- Remove App Sandbox and fix test mocks
- Prevent repeated accessibility permission dialogs
- Parse Source Control window title pattern
- Change build target from mas to dmg/zip

## [0.1.9] - 2025-01-15

### Added
- Phase 4 UI: Workflow integration components (Project Settings & Templates)

### Changed
- Pre-release review fixes

### Fixed
- Use Promise.then() instead of await in sync function

## [0.1.0] - 2024-12-19

### Added
- Initial release
- Claude Code JSONL parser for conversation data
- GOLDEN scoring system (Goal, Output, Limits, Data, Evaluation, Next)
- Prompt classification (7 intent types, 12 task categories)
- Quality signal detection with confidence scoring
- Rule-based prompt improvement (~71% improvement rate)
- LLM-powered prompt improvement (~83% improvement rate)
- Desktop app (PromptLint) with Electron
  - System tray with global shortcut (Cmd+Shift+P)
  - Real-time prompt analysis
  - Active IDE/project detection (VS Code, Cursor, JetBrains)
  - Session context awareness
  - Personal learning engine with SQLite history
- Dashboard with Express API + React
  - Project statistics and trends
  - Insights reports with filtering
  - Effectiveness/quality trend visualization
- CLI tools for parsing and analysis
