# Claude Code 데이터 구조 분석

## 저장 위치

```
~/.claude/
├── history.jsonl              # 사용자 입력 이력 (간략)
├── settings.json              # 설정
└── projects/                  # 프로젝트별 대화 저장
    └── {encoded-project-path}/
        ├── {session-id}.jsonl     # 일반 대화 세션
        └── agent-{hash}.jsonl     # 에이전트 세션
```

## JSONL 레코드 타입

### 1. summary (세션 요약)
```json
{
  "type": "summary",
  "summary": "Family Group Management UI Implementation",
  "leafUuid": "e7caaae8-0344-431a-8952-c00ed78150d6"
}
```

### 2. system (시스템 이벤트)
```json
{
  "type": "system",
  "subtype": "local_command",
  "content": "<command-name>/status</command-name>...",
  "timestamp": "2025-12-18T16:00:48.237Z",
  "sessionId": "e20af017-1c44-4285-b7b3-c9974578e0fe",
  "uuid": "ccbdd2d5-8d8f-4162-8738-b23d0c0af2e2"
}
```

### 3. user (사용자 입력)
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "이전 작업 이어서 진행"
  },
  "uuid": "517a9f6b-b4dd-4384-9c07-e5860acfe2fa",
  "parentUuid": "c3df8748-2958-4073-b308-febf9d36fb1d",
  "timestamp": "2025-12-18T16:00:55.753Z",
  "sessionId": "e20af017-1c44-4285-b7b3-c9974578e0fe",
  "cwd": "/Users/philokalos/Development/active/claude-projects/Ledger",
  "gitBranch": "main",
  "version": "2.0.72"
}
```

### 4. assistant (AI 응답)
```json
{
  "type": "assistant",
  "message": {
    "model": "claude-opus-4-5-20251101",
    "role": "assistant",
    "content": [
      {"type": "thinking", "thinking": "..."},
      {"type": "text", "text": "이전 작업 상태를 확인하겠습니다."},
      {"type": "tool_use", "name": "mcp__memory__read_graph", "input": {}}
    ],
    "usage": {
      "input_tokens": 10,
      "output_tokens": 1,
      "cache_creation_input_tokens": 70594,
      "cache_read_input_tokens": 12995
    }
  },
  "uuid": "f0bfc666-8b81-4d0b-a86a-736934dc1e9e",
  "parentUuid": "517a9f6b-b4dd-4384-9c07-e5860acfe2fa",
  "timestamp": "2025-12-18T16:01:01.908Z",
  "requestId": "req_011CWES1QdQZDHxxULaLmzLK"
}
```

## 핵심 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `type` | string | 레코드 타입: summary, system, user, assistant |
| `uuid` | string | 고유 식별자 |
| `parentUuid` | string | 대화 트리에서 부모 메시지 |
| `sessionId` | string | 세션 식별자 |
| `timestamp` | ISO8601 | 타임스탬프 |
| `message.content` | string/array | 실제 내용 (문자열 또는 배열) |
| `message.model` | string | 사용된 모델 |
| `message.usage` | object | 토큰 사용량 |

## Assistant Content Types

| type | 설명 |
|------|------|
| `thinking` | Claude의 사고 과정 (Extended Thinking) |
| `text` | 텍스트 응답 |
| `tool_use` | 도구 호출 |
| `tool_result` | 도구 실행 결과 |

## 현재 데이터 현황

- 프로젝트: 12개
- 세션 파일: 364개
- 총 용량: 360MB
- 주요 프로젝트: 4matrix, Ledger, voice-journal, Morph, daily-dev-logger

---

*분석일: 2025-12-19*
