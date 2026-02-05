# User Guide

Prompt Evolution을 사용하여 AI 코딩 어시스턴트와의 대화를 분석하고 프롬프트 품질을 개선하는 방법을 안내합니다.

## Getting Started

### Prerequisites

- Node.js 18 이상
- macOS (Desktop App)
- Claude Code 사용 이력 (JSONL 로그)

### Quick Start

```bash
git clone https://github.com/philokalos/prompt-evolution.git
cd prompt-evolution
npm install
```

## Products

Prompt Evolution은 3가지 제품으로 구성됩니다:

| 제품 | 용도 | 시작 방법 |
|------|------|----------|
| **PromptLint** (Desktop) | 실시간 프롬프트 분석 | `cd desktop && npm run dev:electron` |
| **Dashboard** | 분석 대시보드 | `npm run dev:server` + `npm run dev:web` |
| **CLI** | 명령줄 분석 도구 | `npx tsx src/cli.ts <command>` |

---

## PromptLint (Desktop App)

실시간으로 프롬프트를 분석하고 개선 제안을 제공하는 Electron 앱입니다.

### Installation

```bash
cd desktop
npm install
npm run dev:electron    # 개발 모드
npm run dist:mac        # macOS 빌드 (.dmg)
```

### Global Shortcut

**Cmd+Shift+P**: 현재 선택된 텍스트 또는 클립보드 내용을 분석

### Main Features

#### 1. GOLDEN Radar Chart

프롬프트 품질을 6가지 차원으로 시각화합니다:

| 차원 | 의미 | 좋은 예 |
|------|------|--------|
| **G**oal | 목표 명확성 | "로그인 기능을 구현해줘" |
| **O**utput | 출력 형식 지정 | "JSON 형식으로 반환" |
| **L**imits | 제약 조건 | "100줄 이하로" |
| **D**ata | 컨텍스트 제공 | "이 에러 메시지가 발생했어: ..." |
| **E**valuation | 성공 기준 | "테스트가 통과해야 함" |
| **N**ext | 후속 단계 | "완료 후 PR 생성" |

각 점수는 0-1 사이로 표시됩니다. 0.7 이상이 권장됩니다.

#### 2. Ghost Bar

간소화된 프롬프트 개선 UI입니다:

1. 텍스트 선택 후 Cmd+Shift+P
2. Ghost Bar에서 개선된 프롬프트 확인
3. 클릭하여 클립보드에 복사
4. AI 어시스턴트에 붙여넣기

#### 3. Issue Detection

자동으로 감지되는 프롬프트 문제:

- **missing_context**: 컨텍스트 부족
- **vague_goal**: 모호한 목표
- **no_constraints**: 제약 조건 없음
- **missing_output_format**: 출력 형식 미지정

#### 4. Improvement Variants

3가지 개선 버전을 제공합니다:

| 타입 | 방식 | 개선율 |
|------|------|--------|
| **Rule-based** | 패턴 기반 규칙 적용 | ~71% |
| **COSP** | Context-Output-Style-Purpose 프레임워크 | ~75% |
| **AI-powered** | LLM 기반 재작성 (API 키 필요) | ~83% |

### Settings

Settings 페이지에서 구성 가능:

- **AI Provider**: Anthropic, OpenAI, Google AI 선택
- **API Key**: AI 기반 개선에 필요
- **Language**: English / 한국어

---

## Dashboard

웹 기반 분석 대시보드로 프롬프트 패턴과 트렌드를 시각화합니다.

### Installation

```bash
# 개발 모드
npm run dev:server    # API 서버 (:3001)
npm run dev:web       # React 앱 (:5173)

# 프로덕션
npm run build:all
npm run prod:start    # 백그라운드 시작
npm run prod:stop     # 서버 중지
npm run prod:logs     # 로그 확인
```

### Features

#### 1. Overview Statistics

- 총 대화 수
- 분석된 프롬프트 수
- 평균 효과성 점수
- 평균 품질 점수

#### 2. Project Breakdown

프로젝트별 통계:
- 대화 수
- 마지막 활동 시간
- 평균 효과성

#### 3. Insights Report

기간별 분석 리포트:
- 발견된 문제점
- 개선 제안
- 강점 영역
- 카테고리별 분포

#### 4. Trends

시간에 따른 변화 추적:
- 볼륨 트렌드
- 효과성 트렌드
- 품질 트렌드

---

## CLI

명령줄에서 대화 데이터를 파싱하고 분석합니다.

### Commands

```bash
# 대화 파싱
npx tsx src/cli.ts parse

# 분석 실행
npx tsx src/cli.ts analyze

# 인사이트 생성
npx tsx src/cli.ts insights
```

### Data Source

Claude Code 대화 로그 위치:
```
~/.claude/projects/{project-path}/*.jsonl
```

---

## Key Concepts

### GOLDEN Scoring System

프롬프트 품질을 객관적으로 측정하는 프레임워크:

```
GOLDEN Score = (G + O + L + D + E + N) / 6
```

각 차원은 0-1로 정규화됩니다.

### Prompt Classification

#### Intent Types (7종)

| 타입 | 설명 | 예시 |
|------|------|------|
| command | 직접 명령 | "파일 생성해줘" |
| question | 질문 | "이 에러가 뭐야?" |
| instruction | 상세 지시 | "다음 단계를 따라..." |
| feedback | 피드백 | "아니, 그게 아니라..." |
| clarify | 명확화 요청 | "정확히 어떤 부분?" |
| context | 컨텍스트 제공 | "배경 설명하자면..." |
| other | 기타 | - |

#### Task Categories (12종)

| 카테고리 | 설명 |
|----------|------|
| code-generation | 새 코드 작성 |
| debugging | 버그 수정 |
| refactoring | 코드 개선 |
| documentation | 문서 작성 |
| testing | 테스트 작성 |
| architecture | 설계 논의 |
| review | 코드 리뷰 |
| explanation | 코드 설명 |
| configuration | 설정 작업 |
| data | 데이터 처리 |
| design | UI/UX 디자인 |
| other | 기타 |

---

## Tips for Better Prompts

### 1. 명확한 목표 설정

```
❌ "이거 고쳐줘"
✅ "로그인 버튼 클릭 시 발생하는 TypeError를 수정해줘"
```

### 2. 출력 형식 지정

```
❌ "API 응답 구조 알려줘"
✅ "API 응답 구조를 TypeScript 인터페이스로 정의해줘"
```

### 3. 컨텍스트 제공

```
❌ "에러 수정해줘"
✅ "다음 에러 메시지가 발생해: TypeError: Cannot read property 'map' of undefined"
```

### 4. 제약 조건 명시

```
❌ "테스트 작성해줘"
✅ "Vitest를 사용해서 유닛 테스트를 작성해줘. 엣지 케이스 포함"
```

### 5. 성공 기준 정의

```
❌ "성능 개선해줘"
✅ "로드 시간을 3초 이하로 줄여줘. Lighthouse 성능 점수 90 이상 목표"
```

---

## Troubleshooting

### Desktop App이 텍스트를 캡처하지 못함

1. 시스템 환경설정 > 개인정보 보호 > 접근성에서 PromptLint 허용
2. 앱 재시작

### Dashboard에서 데이터가 안 보임

1. Claude Code JSONL 파일이 `~/.claude/projects/`에 있는지 확인
2. `npm run dev:server`로 서버가 실행 중인지 확인
3. Sync 버튼 클릭하여 데이터 동기화

### AI 기반 개선이 작동하지 않음

1. Settings에서 API Key 설정 확인
2. API 키가 유효한지 확인
3. 네트워크 연결 확인

### Import 에러 발생

ESM 모듈에서는 모든 import에 `.js` 확장자가 필요합니다:

```typescript
// ❌ 잘못됨
import { analyzer } from './analyzer'

// ✅ 올바름
import { analyzer } from './analyzer.js'
```

---

## FAQ

### Q: API 키 없이 사용할 수 있나요?

A: 네. Rule-based 개선과 COSP 분석은 API 키 없이 작동합니다. AI-powered 개선만 API 키가 필요합니다.

### Q: 어떤 AI 제공자를 사용해야 하나요?

A: Anthropic Claude가 프롬프트 개선에 가장 효과적입니다. OpenAI와 Google AI도 지원됩니다.

### Q: 데이터가 외부로 전송되나요?

A: AI-powered 개선 사용 시에만 프롬프트 텍스트가 AI 제공자에게 전송됩니다. 그 외 모든 데이터는 로컬에 저장됩니다.

### Q: Windows를 지원하나요?

A: 현재 Desktop App은 macOS만 지원합니다. Dashboard와 CLI는 모든 플랫폼에서 사용 가능합니다.

### Q: Mac App Store 버전과 직접 다운로드 버전의 차이는?

A: MAS 버전은 샌드박스 모드가 활성화되어 있어 일부 시스템 기능에 제한이 있을 수 있습니다. 직접 다운로드(.dmg) 버전은 전체 기능을 사용할 수 있습니다.
