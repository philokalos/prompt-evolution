/**
 * Shared Prompts
 * System prompts and message builders shared across providers
 */

import type { RewriteRequest } from './types.js';

/**
 * Enhanced system prompt for AI to rewrite prompts (~1500 tokens)
 * Shared across all providers with minor adjustments
 */
export const REWRITE_SYSTEM_PROMPT = `당신은 프롬프트 엔지니어링 전문가입니다. 사용자의 프롬프트를 분석하고 **즉시 사용 가능한** 개선된 버전을 생성합니다.

## GOLDEN 체크리스트 상세 가이드

### G - Goal (목표 명확성)
목표가 명확한 프롬프트의 특징:
- 구체적인 동사 사용: "만들어줘" → "React 컴포넌트를 생성해줘"
- 완료 조건 명시: "동작하는" → "에러 없이 빌드되고 테스트 통과하는"

**개선 전**: "로그인 기능 만들어줘"
**개선 후**: "Firebase Auth를 사용해서 이메일/비밀번호 로그인 기능을 구현해줘. 에러 처리와 로딩 상태 포함."

### O - Output (출력 형식)
출력 형식이 명확한 프롬프트:
- 원하는 형태: 코드, 설명, 단계별 가이드
- 포함 요소: 타입 정의, import 문, 주석

**개선 전**: "설명해줘"
**개선 후**: "다음 내용을 설명해줘: 1) 기본 개념, 2) 코드 예시, 3) 주의사항"

### L - Limits (제약조건)
제약조건이 명확한 프롬프트:
- 기술 스택: React 19, TypeScript strict 모드
- 스타일: 함수형 컴포넌트, Tailwind CSS
- 제한: 외부 라이브러리 최소화

**개선 전**: "버튼 만들어줘"
**개선 후**: "React + TypeScript + Tailwind로 버튼 컴포넌트 만들어줘. shadcn/ui 스타일로."

### D - Data (컨텍스트)
충분한 컨텍스트를 제공하는 프롬프트:
- 현재 환경: 프로젝트, 기술 스택
- 관련 정보: 에러 메시지, 관련 코드
- 작업 배경: 왜 이 작업이 필요한지

**개선 전**: "에러 수정해줘"
**개선 후**: "다음 에러가 발생해: TypeError: Cannot read property 'x' of undefined. 관련 코드: [코드]. 원인과 해결책 알려줘."

### E - Evaluation (평가 기준)
성공 기준이 명확한 프롬프트:
- 동작 확인: 빌드 성공, 테스트 통과
- 품질 기준: 성능, 접근성, 보안

### N - Next (후속 작업)
다음 단계가 언급된 프롬프트:
- 이 결과로 무엇을 할 것인지
- 추가 작업 예정 여부

## 리라이팅 핵심 규칙

1. **절대 플레이스홀더 사용 금지**
   - "[코드 입력]", "[프로젝트 설명]", "[환경 정보]" 같은 빈 자리 표시 금지
   - 정보가 없으면 해당 섹션 자체를 생략
   - 세션 컨텍스트에서 실제 값을 추출하여 사용

2. **원본 의도 100% 보존**
   - 사용자가 요청한 핵심 내용을 절대 변경하지 않음
   - 부족한 정보만 보완

3. **언어 일관성**
   - 한국어 프롬프트 → 한국어로 개선
   - 영어 프롬프트 → 영어로 개선
   - 코드/기술 용어는 원어 유지 가능

4. **세션 컨텍스트 최대 활용**
   - 제공된 프로젝트 이름, 기술 스택, 현재 작업 등을 자연스럽게 통합
   - 관련 파일명, 브랜치 정보 활용

5. **간결함 유지**
   - 원본 길이 대비 2배 이하
   - 불필요한 수식어 제거
   - 핵심 정보만 추가

## 사고 과정

1. **원본 분석**: 핵심 요청은 무엇인가?
2. **약점 파악**: GOLDEN 점수가 낮은 영역은 어디인가?
3. **개선 계획**: 어떤 정보를 추가하면 좋을까?
4. **맥락 통합**: 세션 컨텍스트에서 유용한 정보는?
5. **검증**: 원본 의도 보존? 플레이스홀더 없음? 바로 사용 가능?

## 출력 형식

반드시 JSON 형식으로 응답:
{
  "rewrittenPrompt": "개선된 프롬프트 전체 텍스트",
  "explanation": "주요 개선 사항 (1-2문장)",
  "improvements": ["개선점1", "개선점2", "개선점3"]
}`;

/**
 * Build enhanced user message with rich context
 */
export function buildUserMessage(request: RewriteRequest): string {
  const parts: string[] = [];

  // 1. 원본 프롬프트
  parts.push(`원본 프롬프트:
"""
${request.originalPrompt}
"""`);

  // 2. GOLDEN 점수 시각화
  const dimensions: Array<{ key: keyof typeof request.goldenScores; label: string }> = [
    { key: 'goal', label: '목표' },
    { key: 'output', label: '출력' },
    { key: 'limits', label: '제약' },
    { key: 'data', label: '컨텍스트' },
    { key: 'evaluation', label: '평가' },
    { key: 'next', label: '후속' },
  ];

  const scoreLines = dimensions.map(({ key, label }) => {
    const score = request.goldenScores[key];
    const status = score >= 70 ? '✓' : score >= 40 ? '△' : '✗';
    return `  ${status} ${label}: ${score}점`;
  });

  parts.push(`GOLDEN 점수:
${scoreLines.join('\n')}`);

  // 3. 발견된 문제 + 제안
  if (request.issues.length > 0) {
    const issueLines = request.issues.slice(0, 4).map((issue, i) => {
      let line = `${i + 1}. [${issue.severity}] ${issue.message}`;
      if (issue.suggestion) {
        line += `\n   → ${issue.suggestion}`;
      }
      return line;
    });

    parts.push(`발견된 문제:
${issueLines.join('\n')}`);
  }

  // 4. 풍부한 세션 컨텍스트
  if (request.sessionContext) {
    const ctx = request.sessionContext;
    const contextLines: string[] = [];

    if (ctx.projectName) {
      contextLines.push(`- 프로젝트: ${ctx.projectName}`);
    }

    if (ctx.techStack && ctx.techStack.length > 0) {
      contextLines.push(`- 기술 스택: ${ctx.techStack.join(', ')}`);
    }

    if (ctx.currentTask && ctx.currentTask !== '작업 진행 중' && ctx.currentTask.length > 5) {
      contextLines.push(`- 현재 작업: ${ctx.currentTask.slice(0, 80)}`);
    }

    if (ctx.recentFiles && ctx.recentFiles.length > 0) {
      const files = ctx.recentFiles.slice(0, 3).map(f => f.split('/').pop()).join(', ');
      contextLines.push(`- 최근 파일: ${files}`);
    }

    if (ctx.recentTools && ctx.recentTools.length > 0) {
      contextLines.push(`- 최근 도구: ${ctx.recentTools.slice(0, 3).join(', ')}`);
    }

    if (ctx.gitBranch && !['main', 'master'].includes(ctx.gitBranch)) {
      contextLines.push(`- 브랜치: ${ctx.gitBranch}`);
    }

    // 직전 대화 컨텍스트
    if (ctx.lastExchange) {
      const le = ctx.lastExchange;
      if (le.userMessage) {
        contextLines.push(`- 직전 요청: ${le.userMessage}`);
      }
      if (le.assistantSummary) {
        contextLines.push(`- 직전 응답: ${le.assistantSummary}`);
      }
      if (le.assistantFiles && le.assistantFiles.length > 0) {
        const files = le.assistantFiles.slice(0, 3).map(f => f.split('/').pop()).join(', ');
        contextLines.push(`- 수정된 파일: ${files}`);
      }
      if (le.assistantTools && le.assistantTools.length > 0) {
        contextLines.push(`- 사용된 도구: ${le.assistantTools.slice(0, 3).join(', ')}`);
      }
    }

    if (contextLines.length > 0) {
      parts.push(`세션 컨텍스트:
${contextLines.join('\n')}`);
    }
  }

  // 5. 요청
  parts.push(`위 프롬프트를 GOLDEN 체크리스트에 맞게 개선해주세요.
플레이스홀더 없이, 즉시 사용 가능한 형태로 작성해주세요.`);

  return parts.join('\n\n');
}
