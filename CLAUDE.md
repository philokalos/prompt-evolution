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
