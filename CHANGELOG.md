# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
