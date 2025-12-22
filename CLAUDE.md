# Prompt Evolution System

## 프로젝트 비전

**"대화 → 분석 → 라이브러리화 → 프롬프트 자동 개선"** 사이클을 만드는 메타-프롬프팅 플랫폼

사용자의 AI 코딩 어시스턴트(Claude Code, Cursor 등)와의 대화를 자동으로 수집하고, 이를 분석하여 프롬프트 패턴을 추출하며, 더 나은 프롬프팅으로 진화시키는 시스템.

## 핵심 가치

1. **제로 프릭션 수집**: 사용자가 인지적 노력 없이 모든 대화가 자동 기록됨
2. **양방향 분석**: 입력(프롬프트)과 출력(AI 응답) 모두 분석
3. **개인화된 진화**: 개인의 프롬프팅 스타일과 효과적인 패턴을 학습

## 데이터 소스

### 현재 확보된 소스
- **Claude Code**: `~/.claude/projects/` 내 JSONL 파일 (자동 저장됨)
  - 12개 프로젝트, 364개 세션, 360MB 축적

### 향후 확장 가능 소스
- Cursor: `~/Library/Application Support/Cursor/`
- Continue: `~/.continue/sessions/`
- Claude.ai Web: Browser Extension 필요

## 아키텍처 (계획)

```
[1] Capture Layer     → 이미 Claude Code가 자동 수집 중
[2] Parser Layer      → JSONL → 구조화된 대화 데이터
[3] Analysis Layer    → 패턴 추출, 효과성 평가
[4] Library Layer     → 프롬프트/응답 패턴 DB
[5] Evolution Layer   → 개선 제안, A/B 테스트
[6] Dashboard         → 시각화, 인사이트
```

## 기술 스택 (예정)

- Runtime: Node.js / Bun
- Database: SQLite (로컬 우선)
- CLI: Commander.js
- Dashboard: React (추후)

## 개발 원칙

1. **점진적 발전**: MVP → 검증 → 확장
2. **로컬 우선**: 프라이버시 보장, 클라우드 의존 없음
3. **실사용 기반**: 경결 본인이 직접 사용하며 검증
4. **Vibe Coding**: 빠른 실험, 직관적 개선

## 현재 상태

- [x] 아이디어 정의
- [x] 데이터 소스 분석 (Claude Code 구조 파악 완료)
- [ ] PRD 작성
- [ ] Parser 개발
- [ ] MVP 구현

---

*Created: 2025-12-19*
*Owner: Kyeol (philokalos)*
