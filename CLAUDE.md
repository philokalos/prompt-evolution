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

**Three Components**: CLI (`src/`), Dashboard (`server/` + `web/`), Desktop (`desktop/`)

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

## Verified Vibe Coding Protocol

이 프로젝트는 VVCS(Verified Vibe Coding System)를 따릅니다.

### 필수 워크플로우

**1. 새 기능 개발**
```
/speckit.specify "기능 설명"
  ↓
/speckit.plan
  ↓
/speckit.implement
  ↓
npm test
  ↓
/commit-push-pr
```

**2. 버그 수정**
```
"think hard" 포함하여 문제 분석
  ↓
수정 계획 확인
  ↓
수정 구현
  ↓
npm test
```

**3. 리팩토링**
```
"think harder" 포함하여 계획 요청
  ↓
계획 검토 및 승인
  ↓
단계별 구현
  ↓
각 단계마다 테스트
```

### Think Mode 가이드

| 작업 복잡도 | Think Mode | 예시 |
|-------------|-----------|------|
| 단순 수정 | (기본) | 오타 수정, 간단한 버그 |
| 다중 파일 변경 | `think hard` | 여러 파일에 걸친 리팩토링 |
| 아키텍처 결정 | `think harder` | 새로운 기능의 설계 |
| 보안/성능 크리티컬 | `ultrathink` | 보안 취약점, 성능 최적화 |

### 자동 검증

VVCS Hooks가 자동으로:
- Plan-First 워크플로우 권장
- Think 모드 사용 권장
- 코드 품질 실시간 검증 (실패 시에만)
- 보안 패턴 감지

### Definition of Done

**필수 체크리스트**:
- [ ] TypeScript 컴파일 에러 없음
- [ ] ESLint 경고 0개
- [ ] 관련 테스트 통과
- [ ] 보안 패턴 없음 (innerHTML, eval 등)

### 일간 모니터링

```bash
python3 ~/.claude/scripts/analyze-conversations.py
python3 ~/.claude/scripts/analyze-conversations.py trend
```

**목표 지표**:
- Fix 커밋 비율: < 15%
- Think 사용률: > 5%
- Plan-First 비율: > 80%
