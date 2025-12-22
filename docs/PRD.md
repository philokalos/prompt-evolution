# Prompt Evolution System PRD

## 1. 제품 개요

### 1.1 제품명
**Prompt Evolution** (가칭)

### 1.2 한 줄 정의
AI 코딩 어시스턴트와의 대화를 분석하여 프롬프트를 자동으로 개선하는 메타-프롬프팅 시스템

### 1.3 목표 사용자
- AI 코딩 도구(Claude Code, Cursor 등)를 일상적으로 사용하는 개발자
- 프롬프트 품질 개선에 관심 있는 파워 유저
- 초기: 경결 본인 (dogfooding)

### 1.4 핵심 문제
1. 같은 요청도 프롬프트에 따라 결과가 크게 달라짐
2. 어떤 프롬프트가 효과적이었는지 기억하기 어려움
3. 개인의 프롬프팅 스타일을 체계적으로 개선할 방법이 없음

### 1.5 솔루션
- 모든 대화를 자동 수집 (사용자 개입 없음)
- 입력-출력 패턴을 분석하여 효과적인 프롬프트 식별
- 새 프롬프트 작성 시 개선안 제안

---

## 2. 핵심 기능

### Phase 1: Foundation (MVP)
- 대화 파싱: Claude Code JSONL → 구조화 데이터 (P0)
- 대화 뷰어: 파싱된 대화를 읽기 쉽게 표시 (P0)
- 기본 통계: 프로젝트별/일별 대화량, 토큰 사용량 (P1)

### Phase 2: Analysis
- 프롬프트 분류: 의도별 자동 태깅 (P0)
- 효과성 측정: 수정 횟수, 채택률 기반 평가 (P0)
- 패턴 추출: 효과적인 프롬프트 구조 식별 (P1)

### Phase 3: Evolution
- 프롬프트 라이브러리: 개인 프롬프트 패턴 DB (P0)
- 개선 제안: 현재 프롬프트 → 더 나은 버전 제안 (P1)
- A/B 테스트: 다른 프롬프트 버전 비교 (P2)

---

## 3. 데이터 모델

### 3.1 Conversation (대화)
```typescript
interface Conversation {
  id: string;                    // 세션 ID
  project: string;               // 프로젝트 경로
  startedAt: Date;
  endedAt: Date;
  model: string;                 // claude-opus-4-5 등
  totalTokens: number;
  turns: Turn[];
}
```

### 3.2 Turn (대화 턴)
```typescript
interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  promptType?: 'command' | 'question' | 'instruction' | 'feedback';
  toolsUsed?: string[];
  codeBlocks?: CodeBlock[];
  thinking?: string;
}
```

### 3.3 PromptPattern (프롬프트 패턴)
```typescript
interface PromptPattern {
  id: string;
  category: string;
  template: string;
  examples: string[];
  successRate: number;
  frequency: number;
}
```

---

## 4. 성공 지표

### MVP 성공 기준
1. 경결 본인이 2주 이상 일상적으로 사용
2. "프롬프트가 개선됐다"는 체감
3. 최소 1개의 프롬프트 패턴 라이브러리 생성

---

## 5. 개발 로드맵

### Week 1-2: Parser MVP
- Claude Code JSONL 파서 구현
- 기본 CLI 구조 설정
- SQLite 스키마 설계 및 구현

### Week 3-4: Viewer & Stats
- 대화 뷰어 CLI
- 기본 통계 (프로젝트별, 일별)

### Week 5-6: Analysis Foundation
- 프롬프트 타입 분류기
- 효과성 측정 로직

---

*Version: 0.1.0*
*Last Updated: 2025-12-19*
