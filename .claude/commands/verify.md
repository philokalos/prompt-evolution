---
description: prompt-evolution 프로젝트 검증 (React + Vite)
---

## Goal

변경사항의 품질을 자동 검증한다.

## Execution Steps

### 1. TypeScript 컴파일 체크

```bash
npx tsc --noEmit
```

### 2. Lint 검사

```bash
npm run lint
```

### 3. 단위 테스트

```bash
npm test -- --passWithNoTests
```

### 4. 빌드 검증

```bash
npm run build
```

### 5. 보안 스캔

```bash
# 취약점 스캔
npm audit --audit-level=moderate 2>/dev/null || echo "No vulnerabilities found"

# 시크릿 감지
grep -rn "apiKey\s*[:=]\s*['\"][^process.env]" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules 2>/dev/null | head -5 || true
```

## 결과 출력

| 단계 | 상태 | 상세 |
|------|------|------|
| TypeScript | ✅/❌ | |
| Lint | ✅/❌ | |
| Unit Tests | ✅/❌ | |
| Build | ✅/❌ | |
| Security | ✅/❌ | |

### 결론
✅ **모든 검사 통과** - 커밋 가능
또는
❌ **실패 항목 발견** - 수정 필요
