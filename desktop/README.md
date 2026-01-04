# PromptLint

Real-time prompt quality analysis with AI-powered personalized learning. Think of it as **Grammarly for AI prompts**.

![Version](https://img.shields.io/badge/version-0.1.6-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

### GOLDEN Score Analysis
Evaluates prompts against 6 dimensions:
- **G**oal - Clear objective definition
- **O**utput - Expected format specification
- **L**imits - Constraints and boundaries
- **D**ata - Context and examples
- **E**valuation - Success criteria
- **N**ext - Follow-up actions

### Three Activation Methods
1. **Global Hotkey** - `Cmd+Shift+P` (customizable)
2. **Clipboard Watch** - Automatic detection of prompt-like text
3. **Floating Button** - Click to analyze current clipboard

### Smart Prompt Variants
- **Conservative** (~60% improvement) - Minimal, safe changes
- **Balanced** (~75% improvement) - Structured GOLDEN format
- **Comprehensive** (~95% improvement) - Full context enrichment
- **AI-Powered** (optional) - Claude API multi-variant generation

### Context Awareness
- Active IDE/project detection (VS Code, Cursor, JetBrains, terminals)
- Claude Code session integration (`~/.claude/projects/`)
- Tech stack inference from project files
- Git branch awareness

### Personal Learning Engine
- SQLite-based history tracking
- Project-specific pattern analysis
- Dimensional weakness detection
- Progress tracking with trends

## Installation

### Download
Download the latest release from [Releases](https://github.com/philokalos/prompt-evolution/releases).

### Build from Source
```bash
# Clone repository
git clone https://github.com/philokalos/prompt-evolution.git
cd prompt-evolution/desktop

# Install dependencies
npm install

# Development
npm run dev:electron

# Build for macOS
npm run dist:mac
```

## Usage

### Quick Start
1. Launch PromptLint - appears in system tray
2. Copy a prompt to clipboard
3. Press `Cmd+Shift+P` (or click tray icon)
4. View GOLDEN analysis and improved variants
5. Click to copy improved version

### Text Capture Modes
Configure in Settings:
- **Auto** (default) - Selection first, clipboard fallback
- **Selection** - Simulated Cmd+C capture
- **Clipboard** - Use existing clipboard content

### AI Rewriting (Optional)
1. Open Settings
2. Enter Anthropic API key
3. Enable "AI 재작성" toggle
4. Get AI-generated variants with real GOLDEN scoring

## Configuration

### Hotkey Customization
Default: `Cmd+Shift+P`

Modify in Settings or `~/.promptlint/config.json`:
```json
{
  "hotkey": "CommandOrControl+Shift+P"
}
```

### Data Storage
- **Settings**: `~/Library/Application Support/promptlint/`
- **History DB**: `~/.promptlint/history.db`

## Development

### Prerequisites
- Node.js 18+
- npm 9+
- macOS (for Accessibility permissions)

### Scripts
```bash
npm run dev:electron      # Development mode
npm run build:all         # Build all components
npm run dist:mac          # macOS distribution
npm run typecheck         # TypeScript check
npm run test              # Run tests
npm run test:coverage     # Coverage report
```

### Architecture
```
src/
├── main/                 # Electron main process
│   ├── index.ts          # Entry point, window, shortcuts
│   ├── learning-engine.ts # Analysis orchestration
│   ├── claude-api.ts     # AI rewriting
│   ├── session-context.ts # Claude Code integration
│   └── db/               # SQLite persistence
├── renderer/             # React UI
│   ├── App.tsx           # Main component
│   ├── GoldenRadar.tsx   # Radar chart
│   └── components/       # UI components
└── preload/              # IPC bridge
```

## Permissions

### macOS Accessibility
Required for text selection capture:
1. System Preferences → Security & Privacy → Privacy
2. Accessibility → Add PromptLint

### Network (Optional)
Only needed for AI rewriting feature with Anthropic API.

## Troubleshooting

### Hotkey Not Working
- Check for conflicts with other apps
- Try alternative shortcuts in Settings
- Restart the app after changing hotkey

### Text Not Captured
- Grant Accessibility permissions
- Some apps block simulated keystrokes (use clipboard mode)
- Check if app is in blocklist (Cursor, VS Code terminals)

### Window Not Appearing
- Click tray icon to show window
- Check if window is on another display
- Restart the app

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

**PromptLint** - Write better prompts, get better results.
