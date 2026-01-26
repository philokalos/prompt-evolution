# Prompt Evolution

AI 코딩 어시스턴트 대화를 분석하여 프롬프트를 자동으로 개선하는 메타-프롬프팅 시스템

**Core Loop**: Capture -> Parse -> Analyze -> Library -> Evolve

## Features

- **GOLDEN Scoring**: 6가지 차원(Goal, Output, Limits, Data, Evaluation, Next)으로 프롬프트 품질 측정
- **Prompt Classification**: 7가지 의도 타입 + 12가지 작업 카테고리 자동 분류
- **AI-Powered Improvement**: 규칙 기반(~71%) 및 LLM 기반(~83%) 프롬프트 개선
- **Personal Learning**: 프로젝트별 패턴 학습 및 개인화된 추천

## Products

| Product | Description | Location |
|---------|-------------|----------|
| **PromptLint** (Desktop) | 실시간 프롬프트 분석 Electron 앱 | `desktop/` |
| **Dashboard** | Express API + React 분석 대시보드 | `server/` + `web/` |
| **CLI** | 파싱 및 분석 명령줄 도구 | `src/cli/` |

## Tech Stack

- **Desktop**: Electron + React + TypeScript + Tailwind CSS
- **Backend**: Express.js + SQLite (better-sqlite3)
- **AI**: Anthropic SDK (Claude), OpenAI, Google AI
- **Build**: Vite + esbuild + TypeScript
- **Testing**: Vitest

## Getting Started

### Prerequisites

- Node.js >= 18
- npm

### Installation

```bash
git clone https://github.com/philokalos/prompt-evolution.git
cd prompt-evolution
npm install
```

### CLI

```bash
# Watch mode
npm run dev

# Parse Claude Code conversations
npx tsx src/cli.ts parse

# Run directly
npx tsx src/cli.ts <command>
```

### Dashboard

```bash
# Development
npm run dev:server    # Express API (:3001)
npm run dev:web       # Vite dev (:5173)

# Production
npm run build:all
npm run prod:start    # Start server
npm run prod:stop     # Stop server
npm run prod:logs     # View logs
```

### Desktop App (PromptLint)

```bash
cd desktop

# Development
npm install
npm run dev:electron

# Production build (macOS)
npm run dist:mac
```

## Commands

### Root

```bash
npm run dev              # CLI watch mode
npm run build            # Build CLI
npm run build:all        # Build CLI + server + web
npm run dev:server       # Express API server (:3001)
npm run dev:web          # Vite dashboard (:5173)
npm test                 # Run tests
npm run lint             # ESLint
```

### Desktop

```bash
cd desktop
npm run dev:electron     # Build all + launch Electron
npm run build:all        # Build all components
npm run dist:mac         # macOS release (.dmg + .zip)
npm test                 # Desktop tests
```

## Architecture

```
~/.claude/projects/{path}/*.jsonl  →  Parser  →  SQLite  →  Analysis  →  Reports
```

### Directory Structure

```
prompt-evolution/
├── src/                  # Shared core (CLI + analysis)
│   ├── analysis/         # Analysis modules
│   ├── parser/           # JSONL parser
│   └── db/               # SQLite schema
├── desktop/              # Electron app (PromptLint)
├── server/               # Dashboard API
├── web/                  # Dashboard frontend
├── landing-page/         # Marketing site
└── docs/                 # Documentation
```

## Documentation

- [API Documentation](./docs/api.md) - REST API reference
- [Architecture Guide](./docs/architecture.md) - System design
- [PRD](./docs/PRD.md) - Product requirements

## Environment Variables

```bash
# Optional: AI-powered improvements
export ANTHROPIC_API_KEY=sk-ant-...
```

## Key Concepts

### GOLDEN Scoring

| Dimension | Description |
|-----------|-------------|
| **G**oal | 목표가 명확한가? |
| **O**utput | 출력 형식이 지정되었는가? |
| **L**imits | 제약 조건이 명시되었는가? |
| **D**ata | 필요한 데이터/컨텍스트가 제공되었는가? |
| **E**valuation | 성공 기준이 있는가? |
| **N**ext | 후속 단계가 고려되었는가? |

### Classification

**Intent Types (7)**:
- command, question, instruction, feedback, clarify, context, other

**Task Categories (12)**:
- code-generation, debugging, refactoring, documentation, testing, architecture, review, explanation, configuration, data, design, other

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details

## Author

Kyeol ([@philokalos](https://github.com/philokalos))
