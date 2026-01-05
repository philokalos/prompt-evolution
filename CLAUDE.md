# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Prompt Evolution** is a meta-prompting platform that analyzes Claude Code conversations to extract prompt patterns and improve prompting effectiveness.

**Core Loop**: Capture → Parse → Analyze → Library → Evolve

**Key Feature**: Evaluates prompts against Anthropic's GOLDEN checklist (Goal, Output, Limits, Data, Evaluation, Next) for empirical quality assessment.

**Three Components**:
1. **CLI** (`src/`) - Parse and analyze Claude Code conversations
2. **Web Dashboard** (`server/` + `web/`) - Express API + React visualization
3. **Desktop App** (`desktop/`) - Electron app "PromptLint" with global hotkey (Cmd+Shift+P). See `desktop/CLAUDE.md` for detailed documentation.

## Development Commands

```bash
# CLI Development
npm run dev                    # Watch mode (tsx)
npx tsx src/cli.ts <command>   # Run CLI directly without build

# CLI Build
npm run build                  # TypeScript build → dist/src/
npm start <command>            # Run built CLI (after build)

# Dashboard
npm run dev:server             # Express API (:3001)
npm run dev:web                # Vite dev (:5173) - runs in web/ directory
npm run build:server           # Build server → dist/server/
npm run build:web              # Build React → web/dist/
npm run build:all              # Build CLI + server + web
npm run start:dashboard        # Production dashboard server

# Testing
npm test                       # Vitest (watch mode)
npm test -- --run              # Run once without watch
cd desktop && npm test         # Desktop app tests (Vitest)
cd desktop && npm run test:run # Single run
cd desktop && npm run test:coverage  # Coverage report

# Linting (ESLint v9 flat config)
cd web && npm run lint         # ESLint for React dashboard
cd desktop && npm run lint     # ESLint for Electron app

# TypeScript Checks
npx tsc --noEmit               # CLI (src/) type check
npx tsc -p tsconfig.server.json --noEmit  # CLI + server type check
cd desktop && npm run typecheck  # Desktop: all 4 configs (main, preload, renderer, shared)

# Desktop App (separate package)
cd desktop
npm run dev:electron           # Build all 4 configs + launch Electron
npm run dist:mac               # macOS .dmg + .zip → release/
```

### CLI Commands

```bash
# Discovery
pe projects                        # List Claude Code projects
pe sessions <project-id>           # List sessions in project
pe parse <project-id> [session]    # Parse and display conversation

# Database
pe import [--incremental]          # Import sessions to SQLite
pe db-stats                        # Database statistics

# Analysis
pe analyze [--incremental]         # Run quality signal detection
pe classify "<text>"               # Classify single prompt
pe classify --all                  # Classify all user turns

# Reporting
pe insights [--period 7d|30d|90d]  # Generate insights report
pe report [--output <path>]        # Generate HTML report
```

Project ID format: Encoded path with dashes (e.g., `-Users-foo-project`)

## Architecture

### Data Flow

```
~/.claude/projects/{encoded-path}/*.jsonl
              ↓
      Parser Layer (JSONL → ParsedConversation)
              ↓
      Database Layer (SQLite ~/.prompt-evolution/data.db)
              ↓
      Analysis Layer (Signals, Classification, Scoring)
              ↓
      Report Layer (CLI output, HTML reports, Dashboard API)
```

### Module Structure

**`src/parser/`** - JSONL parsing from `~/.claude/projects/`

**`src/db/`** - SQLite persistence (better-sqlite3, WAL mode)
- Tables: conversations, turns, tool_usages, quality_signals, summaries

**`src/analysis/`** - Quality analysis (main orchestrator: `insights.ts`)
- `guidelines-evaluator.ts`: GOLDEN checklist scoring
- `classifier.ts`: Intent + task category classification
- `signal-detector.ts`: Quality signals (clarifications, corrections, frustration)
- `prompt-library.ts`: Reusable pattern extraction
- `self-improvement.ts`: Before/After improvement examples

**`src/report/`** - HTML report generation with GOLDEN radar chart

**`server/`** - Express API with scheduled sync
- Routes: stats, projects, insights, trends, sync
- Scheduler: 30min incremental imports, 2hr analysis, 4AM daily full refresh
- Middleware: Custom error handler with structured responses

**`web/`** - React dashboard (Vite + Tailwind + React Query)
- Pages: Dashboard, Projects, Insights, Trends, Library, Guidebook
- Hooks: useStats, useProjects, useInsights, useTrends, useSync
- API client: Centralized in `api/client.ts`

### Running Single Tests

```bash
# Root package (CLI/Server) - Vitest
npm test -- src/analysis/classifier.test.ts   # Single file
npm test -- -t "pattern"                       # By test name pattern
npm test -- --run src/analysis/classifier.test.ts  # Single run (no watch)

# Desktop package - Vitest
cd desktop
npm test -- src/main/__tests__/learning-engine.test.ts
npm test -- -t "should detect project"
npm run test:run -- src/main/__tests__/learning-engine.test.ts  # Single run
```

### TypeScript Configs

| Config | Scope | Output |
|--------|-------|--------|
| `tsconfig.json` | CLI (`src/`) | `dist/src/` |
| `tsconfig.server.json` | CLI + Server | `dist/` |
| `desktop/tsconfig.main.json` | Electron main process | `dist/main/` |
| `desktop/tsconfig.preload.json` | Preload (CommonJS) | `dist/preload/*.cjs` |
| `desktop/scripts/build-analysis.ts` | esbuild bundler | `dist/analysis/*.cjs` |

### Classification Types

```typescript
type PromptIntent = 'command' | 'question' | 'instruction' | 'feedback' | 'context' | 'clarification' | 'unknown';

type TaskCategory = 'code-generation' | 'code-review' | 'bug-fix' | 'refactoring' |
  'explanation' | 'documentation' | 'testing' | 'architecture' | 'deployment' | 'data-analysis' | 'general' | 'unknown';
```

## Important Patterns

### ESM-Only Codebase
All packages use `"type": "module"`. Import paths require `.js` extension:
```typescript
import { classifyPrompt } from './classifier.js';  // ✓
import { classifyPrompt } from './classifier';     // ✗
```

### User Message Content Format
Claude Code JSONL stores user content as string OR array:
```typescript
const text = typeof content === 'string'
  ? content
  : content.filter(b => b.type === 'text').map(b => b.text).join('\n');
```

### JSONL Record Structure

| Record Type | Key Fields |
|-------------|------------|
| `summary` | Session summary text |
| `user` | User prompts (content: string \| ContentBlock[]) |
| `assistant` | AI responses with content array, model, usage |

Records linked via `uuid` → `parentUuid`.

## Desktop App

Separate Electron app in `desktop/` with its own `package.json` and detailed `CLAUDE.md`.

**Key Integration Point**: Reuses parent `src/analysis/` modules via esbuild bundling to CJS (`scripts/build-analysis.ts`).

**Critical Build Detail**: Preload script must output `.cjs` because Electron requires CommonJS, but `package.json` has `"type": "module"`.

See `desktop/CLAUDE.md` for complete architecture, IPC handlers, and gotchas.

## Data Sources

**CLI/Dashboard** reads from:
```
~/.claude/projects/{encoded-project-path}/
├── {session-uuid}.jsonl      # Regular sessions
└── agent-{hash}.jsonl        # Agent task sessions
```

**SQLite Database**: `~/.prompt-evolution/data.db` (WAL mode)

## Environment Variables

**For AI-powered features** (CLI `improve` command, Desktop AI rewriting):
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Without API key, rule-based improvements still work (~11% → 71% improvement vs ~11% → 83% with AI).

## Production Deployment (Dashboard)

### Quick Start

```bash
# Build everything
npm run build:all

# Start server (manual)
npm run prod:start

# Check status
npm run prod:status

# View logs
npm run prod:logs

# Stop server
npm run prod:stop
```

### Auto-Start on Login (macOS LaunchAgent)

```bash
# Install LaunchAgent (starts on login)
npm run prod:install

# Uninstall LaunchAgent
npm run prod:uninstall
```

Dashboard runs at `http://localhost:3001`.

### Production Scripts

| Command | Description |
|---------|-------------|
| `npm run prod:start` | Start server in background |
| `npm run prod:stop` | Stop running server |
| `npm run prod:status` | Check if server is running |
| `npm run prod:logs` | Tail server logs |
| `npm run prod:install` | Install macOS auto-start |
| `npm run prod:uninstall` | Remove macOS auto-start |

### PM2 Alternative

If PM2 is installed globally (`npm i -g pm2`):

```bash
pm2 start ecosystem.config.cjs
pm2 stop prompt-evolution
pm2 logs prompt-evolution
pm2 startup  # Enable PM2 auto-start
```

### Files

- `scripts/start-server.sh` - Startup script
- `scripts/stop-server.sh` - Shutdown script
- `scripts/com.philokalos.prompt-evolution.plist` - macOS LaunchAgent
- `ecosystem.config.cjs` - PM2 configuration
- `logs/` - Server logs directory

## Repository Boundaries

- `desktop/` is a standalone npm package with separate dependencies
- `web/` has its own package.json and builds independently
- Parent's `src/analysis/` modules are shared via esbuild bundling into desktop

## Domain Concepts

### GOLDEN 체크리스트
```typescript
// guidelines-evaluator.ts:373-443
G (Goal): 목표 명확성
O (Output): 출력 형식 지정
L (Limits): 제약조건/경계
D (Data): 컨텍스트/데이터 제공
E (Evaluation): 성공/검증 기준
N (Next): 후속 단계 안내

// 점수: 0-1 per dimension, length bonus 최대 +0.15 (50+ words)
```

### PromptIntent vs TaskCategory
```typescript
// Intent (사용자 의도)
command | question | instruction | feedback | context | clarification | unknown

// Category (작업 도메인)
code-generation | code-review | bug-fix | refactoring |
explanation | documentation | testing | architecture |
deployment | data-analysis | general | unknown
```

### Quality Signals (7가지)
```typescript
positive_feedback | negative_feedback | retry_attempt |
task_completion | question | command | context_providing
```
- Confidence: 키워드 수 × 0.3, 짧은 콘텐츠 보너스 1.1x

## ⚠️ Anti-Patterns

### ❌ ESM Import .js 확장자 누락
```typescript
// ❌ 잘못된 패턴
import { classifyPrompt } from './classifier';

// ✓ 올바른 패턴
import { classifyPrompt } from './classifier.js';
```
- package.json: `"type": "module"`

### ❌ UserContent 타입 미처리
```typescript
type UserContent = string | UserContentBlock[];

// ❌ 위험한 패턴
const text = content;  // array일 수 있음

// ✓ 올바른 패턴
function extractUserContent(content: UserContent): string {
  if (typeof content === 'string') return content;
  return content
    .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
    .map((item) => item.text)
    .join('\n');
}
```

### ❌ JSONL 파싱 Silent 실패
```typescript
for (const line of lines) {
  try { records.push(JSON.parse(line)); }
  catch { continue; }  // 로깅 없이 skip
}
```
- 일부 conversation 누락 가능

### ❌ LLM 출력에 Placeholder 허용
```typescript
// AI가 반환할 수 있음:
"Goal: [여기에_구체적인_기능명] component"
// 반드시 검증: improved.includes('[') → reject
```

### ❌ Intent/Category Confidence 혼동
```typescript
// 잘못된 패턴
if (ruleResult.intentConfidence >= 0.7) { ... }

// 올바른 패턴
if (ruleResult.intentConfidence >= 0.7 &&
    ruleResult.categoryConfidence >= 0.7) { ... }
```

## Troubleshooting

| 증상 | 원인 | 해결 |
|------|------|------|
| Import 오류 | .js 확장자 누락 | 모든 import에 .js 추가 |
| Conversation 누락 | JSONL 파싱 실패 | 라인 번호 로깅 추가 |
| 모든 분류 "unknown" | Confidence 임계값 너무 높음 | 0.7 → 0.6 조정 |
| 빈 Insights 리포트 | 2턴 미만 대화 | 최소 턴 수 검증 추가 |
| LLM 개선 실패 | Placeholder 미필터링 | `[`, `TODO` 문자열 검증 |
| API quota 초과 | Rule-based classifier 미사용 | Confidence 임계값 낮춰서 rule 우선 |
