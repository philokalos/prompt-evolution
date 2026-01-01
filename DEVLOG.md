# Prompt Evolution - 개발 로그

## 2025-12-19 (Day 1)

### 완료
- [x] 프로젝트 아이디어 정의 및 분석
- [x] Claude Code 대화 데이터 구조 분석
- [x] 프로젝트 폴더 생성 (`prompt-evolution`)
- [x] CLAUDE.md 작성
- [x] PRD 초안 작성
- [x] 데이터 구조 문서화
- [x] **프로젝트 초기화** (package.json, tsconfig)
- [x] **타입 정의** (claude-code.ts, assistant.ts)
- [x] **Parser 구현** (claude-code-parser.ts, session-parser.ts)
- [x] **CLI 구현** (projects, sessions, parse, stats 명령어)
- [x] **동작 테스트 완료**

### 구현된 기능

```bash
# 프로젝트 목록 조회
npx tsx src/cli.ts projects

# 세션 목록 조회  
npx tsx src/cli.ts sessions <project-id>

# 대화 파싱
npx tsx src/cli.ts parse <project-id>

# 전체 통계
npx tsx src/cli.ts stats
```

### 발견 사항
1. Claude Code는 이미 모든 대화를 자동으로 `~/.claude/projects/`에 저장
2. JSONL 형식으로 저장되며, 풍부한 메타데이터 포함
3. 현재 12개 프로젝트, 364개 세션, 360MB 데이터 축적됨
4. voice-journal 프로젝트가 154개 세션으로 가장 활발

### 프로젝트 구조
```
prompt-evolution/
├── CLAUDE.md
├── DEVLOG.md
├── package.json
├── tsconfig.json
├── docs/
│   ├── PRD.md
│   └── claude-code-data-structure.md
└── src/
    ├── cli.ts
    ├── types/
    │   ├── index.ts
    │   ├── claude-code.ts
    │   └── assistant.ts
    └── parser/
        ├── index.ts
        ├── claude-code-parser.ts
        └── session-parser.ts
```

### 다음 단계
- [x] SQLite 저장소 구현
- [x] 전체 세션 일괄 파싱 및 저장
- [x] 프롬프트 타입 분류기
- [x] 대시보드 또는 더 나은 뷰어

### 메모
- MVP 파서가 완성됨 → 이제 데이터 축적 및 분석 단계로 진입 가능
- 경결님의 실제 사용 패턴 분석 가능

---

## 2024-12-27 ~ 2025-01-01 (PromptLint Desktop App)

### 완료된 기능

#### Core Desktop App (v0.1.0 ~ v0.1.4)
- [x] **Electron 앱 초기 설정** - 시스템 트레이, 글로벌 단축키 (Cmd+Shift+P)
- [x] **GOLDEN 체크리스트 분석** - Goal, Output, Limits, Data, Evaluation, Next
- [x] **프롬프트 비교 UI** - 3가지 리라이팅 변형 (보수적/균형/포괄적)
- [x] **세션 컨텍스트 통합** - ~/.claude/projects/ 읽기, 기술 스택 감지
- [x] **텍스트 선택 캡처** - AppleScript 기반 Cmd+C 시뮬레이션
- [x] **설정 UI** - 단축키, 캡처 모드, 항상 위 등 설정
- [x] **ESM/CJS 호환성** - esbuild로 분석 모듈 CJS 번들링

#### Phase 1: 활성 윈도우 감지 (ce9c476)
- [x] macOS AppleScript 기반 활성 윈도우 감지
- [x] VS Code, Cursor, JetBrains IDE, Terminal 지원
- [x] 2초 간격 프로젝트 폴링
- [x] 라이브 프로젝트 상태 표시

#### Phase 2: 히스토리 기반 추천 (ffd8b6a)
- [x] 프로젝트별 GOLDEN 점수 평균
- [x] 약점 감지 및 개선 추천
- [x] 고득점 프롬프트 참조
- [x] 카테고리 기반 유사 프롬프트 조회
- [x] DB 스키마 확장 (project_path, intent, category)

#### Phase 3: Claude API 통합 (d209971)
- [x] Settings에서 API 키 관리
- [x] AI 기반 프롬프트 리라이팅
- [x] API 실패 시 규칙 기반 폴백
- [x] AI 변형 시각적 구분 (Wand2 아이콘)

### 기술적 해결

1. **Preload .cjs 이슈** - package.json의 `"type": "module"` 때문에 preload는 .cjs로 출력 필요
2. **투명 윈도우** - macOS에서 transparent: true 사용 시 보이지 않음, backgroundColor 사용
3. **Cursor 충돌** - Electron 기반 IDE에서 keystroke 시뮬레이션 시 충돌, 클립보드 직접 사용으로 해결
4. **IPC 레이스 컨디션** - renderer-ready 신호로 해결

### 현재 상태
- ✅ PromptLint 데스크탑 앱 완전 동작
- ✅ GitHub 저장소: philokalos/prompt-evolution (private)
- ✅ 빌드 및 패키징 정상 작동

### 다음 단계
- [ ] Web Dashboard 완성 (server/ + web/)
- [ ] 프로덕션 배포 (.dmg 배포)
- [ ] 사용자 피드백 수집 및 개선
