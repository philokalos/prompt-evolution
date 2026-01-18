# CLAUDE.md - Prompt Evolution

Prompt analytics platform | Node.js + Electron + React

**Core Loop**: Capture → Parse → Analyze → Library → Evolve

## Commands

```bash
# CLI
npm run dev                    # Watch mode (tsx)
npx tsx src/cli.ts <command>   # Run CLI directly

# Dashboard
npm run dev:server             # Express API (:3001)
npm run dev:web                # Vite dev (:5173)
npm run build:all              # CLI + server + web

# Desktop App
cd desktop && npm run dev:electron   # Build + launch
cd desktop && npm run dist:mac       # macOS release

# Testing
npm test                       # Vitest (watch)
cd desktop && npm test         # Desktop tests
```

## Critical Rules

1. **ESM-only**: All imports require `.js` extension
2. **UserContent**: Can be `string | ContentBlock[]` - always handle both
3. **GOLDEN Scoring**: 0-1 per dimension (Goal, Output, Limits, Data, Evaluation, Next)
4. **Desktop Build**: Preload must output `.cjs` (Electron requires CommonJS)

## Architecture

```
~/.claude/projects/{path}/*.jsonl → Parser → SQLite → Analysis → Reports
```

**Products (3)**:
- **Desktop App (PromptLint)**: `desktop/` - Electron 앱, 실시간 프롬프트 분석
- **Dashboard**: `server/` + `web/` - Express API + React 분석 대시보드
- **Landing Page**: `landing-page/` - 프로모션 페이지 (Vercel 배포)

**Shared Core**: `src/` - CLI + 분석 로직 (Desktop이 esbuild로 번들링)

**Scripts**:
- `scripts/` - Dashboard 서버 관리 (start/stop)
- `desktop/scripts/` - Desktop 빌드 스크립트

## Key Patterns

| Pattern | Details |
|---------|---------|
| Classification | `PromptIntent` (7 types) + `TaskCategory` (12 types) |
| Quality Signals | 7 types with confidence scoring |
| AI Improvement | Rule-based (~71%) or LLM-powered (~83%) |
| Desktop | Reuses `src/analysis/` via esbuild bundling to CJS |

## Anti-Patterns

| Wrong | Correct |
|-------|---------|
| `import './classifier'` | `import './classifier.js'` (ESM) |
| `const text = content` | Handle `string \| ContentBlock[]` |
| Silent JSONL parse fail | Log line numbers for debugging |
| Trust LLM output | Reject if contains `[` or `TODO` |
| High confidence only | Check both `intentConfidence` AND `categoryConfidence` |

## Environment

```bash
export ANTHROPIC_API_KEY=sk-ant-...  # Optional: AI-powered improvements
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Import error | Add `.js` extension to all imports |
| All "unknown" classification | Lower confidence threshold (0.7 → 0.6) |
| Empty insights | Minimum 2 turns required |
| LLM improvement fails | Check for placeholder filtering |

---

## VVCS (Verified Vibe Coding System)

이 프로젝트는 VVCS를 따릅니다. 상세 워크플로우는 루트 `CLAUDE.md` 참조.
