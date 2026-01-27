/**
 * Text analysis helper functions
 * Extract information from prompts: verbs, categories, code blocks, errors, etc.
 */

import type { SessionContext } from '../session-context.js';
import type { PromptComplexity } from './types.js';

/**
 * 원본에서 핵심 동사 추출 (목표 명확화용)
 */
export function detectPrimaryVerb(text: string): { verb: string; action: string } {
  const verbPatterns: Array<{ pattern: RegExp; verb: string; action: string }> = [
    { pattern: /만들어|생성|구현|개발|작성/i, verb: '생성', action: '구현해주세요' },
    { pattern: /수정|고쳐|바꿔|변경|업데이트/i, verb: '수정', action: '수정해주세요' },
    { pattern: /에러|오류|버그|fix|error/i, verb: '해결', action: '해결해주세요' },
    { pattern: /설명|알려|이해|왜|어떻게/i, verb: '설명', action: '설명해주세요' },
    { pattern: /리뷰|검토|봐줘|체크|확인/i, verb: '검토', action: '검토해주세요' },
    { pattern: /최적화|개선|향상|빠르게/i, verb: '최적화', action: '최적화해주세요' },
    { pattern: /추가|넣어|포함/i, verb: '추가', action: '추가해주세요' },
    { pattern: /삭제|제거|지워/i, verb: '삭제', action: '삭제해주세요' },
    { pattern: /테스트|검증|확인/i, verb: '테스트', action: '테스트해주세요' },
  ];

  for (const { pattern, verb, action } of verbPatterns) {
    if (pattern.test(text)) {
      return { verb, action };
    }
  }
  return { verb: '처리', action: '처리해주세요' };
}

/**
 * 카테고리 기반 출력 형식 추론
 */
export function inferOutputFormat(category: string): string[] {
  const formats: Record<string, string[]> = {
    'code-generation': ['전체 구현 코드 (import 포함)', '주요 로직 설명'],
    'bug-fix': ['에러 원인 분석', '수정된 코드', '재발 방지 방법'],
    'code-review': ['문제점과 심각도', '개선된 코드 예시'],
    'refactoring': ['리팩토링된 코드', '변경 이유 설명'],
    'explanation': ['단계별 설명', '코드 예시'],
    'testing': ['테스트 코드', '커버리지 고려사항'],
    'general': ['구체적인 결과물'],
  };
  return formats[category] || formats['general'];
}

/**
 * 세션 컨텍스트에서 최소 컨텍스트 라인 생성
 */
export function buildMinimalContext(context: SessionContext | undefined): string | null {
  if (!context) return null;

  const parts: string[] = [];
  const projectName = context.projectPath.split('/').pop() || 'project';

  // 기술 스택 (항상 포함)
  if (context.techStack.length > 0) {
    parts.push(`${projectName} (${context.techStack.slice(0, 3).join(', ')})`);
  } else {
    parts.push(projectName);
  }

  // 현재 작업 (의미 있는 경우만)
  if (context.currentTask &&
      context.currentTask !== '작업 진행 중' &&
      context.currentTask.length > 5) {
    parts.push(`작업: ${context.currentTask.slice(0, 50)}`);
  }

  // 관련 파일 (있는 경우)
  if (context.recentFiles.length > 0) {
    const fileName = context.recentFiles[0].split('/').pop() || context.recentFiles[0];
    parts.push(`파일: ${fileName}`);
  }

  // 직전 대화 컨텍스트 (있는 경우)
  if (context.lastExchange) {
    if (context.lastExchange.assistantFiles.length > 0) {
      const file = context.lastExchange.assistantFiles[0].split('/').pop();
      parts.push(`방금 수정: ${file}`);
    } else if (context.lastExchange.assistantSummary) {
      parts.push(`이전: ${context.lastExchange.assistantSummary.slice(0, 30)}...`);
    }
  }

  return parts.join(' | ');
}

/**
 * 원본에서 코드 블록 추출
 */
export function extractCodeFromPrompt(text: string): string | null {
  // 백틱 코드 블록 추출
  const codeBlockMatch = text.match(/```[\s\S]*?```/);
  if (codeBlockMatch) {
    return codeBlockMatch[0];
  }

  // 인라인 코드 패턴 (함수명, 변수명 등)
  const inlineCodeMatch = text.match(/`[^`]+`/g);
  if (inlineCodeMatch && inlineCodeMatch.length > 0) {
    return inlineCodeMatch.join(', ');
  }

  return null;
}

/**
 * 원본에서 에러 메시지 추출
 */
export function extractErrorFromPrompt(text: string): string | null {
  // Error: 패턴
  const errorMatch = text.match(/(?:Error|에러|오류|TypeError|SyntaxError|ReferenceError)[:\s][^\n]+/i);
  if (errorMatch) {
    return errorMatch[0].trim();
  }

  // 스택 트레이스 패턴
  const stackMatch = text.match(/at\s+\w+.*\(.*:\d+:\d+\)/);
  if (stackMatch) {
    return stackMatch[0];
  }

  return null;
}

/**
 * 최근 도구에서 작업 유형 추론
 */
export function _inferWorkFromTools(tools: string[]): string | null {
  if (tools.length === 0) return null;

  const toolActions: Record<string, string> = {
    'Read': '파일 읽기',
    'Write': '파일 작성',
    'Edit': '파일 편집',
    'Grep': '코드 검색',
    'Glob': '파일 탐색',
    'Bash': '터미널 작업',
    'Task': '태스크 실행',
  };

  const recentTool = tools[0];
  for (const [tool, action] of Object.entries(toolActions)) {
    if (recentTool.includes(tool)) {
      return action;
    }
  }
  return null;
}

/**
 * 기술 스택별 제약조건 생성
 */
export function getTechStackConstraints(techStack: string[]): string[] {
  const constraints: string[] = [];

  const techConstraints: Record<string, string[]> = {
    'TypeScript': ['타입 안전성 유지', 'strict 모드 호환'],
    'React': ['함수형 컴포넌트 사용', 'hooks 패턴 준수'],
    'Vue': ['Composition API 스타일'],
    'Next.js': ['App Router 호환', 'SSR 고려'],
    'Firebase': ['보안 규칙 준수', '비용 최적화'],
    'Tailwind CSS': ['기존 테마 활용'],
    'Electron': ['main/renderer 분리'],
    'Node.js': ['async/await 패턴'],
    'Vite': ['HMR 호환'],
  };

  for (const tech of techStack) {
    const techC = techConstraints[tech];
    if (techC) {
      constraints.push(...techC);
    }
  }

  return constraints.slice(0, 3); // 최대 3개
}

/**
 * 원본에서 핵심 요청 추출 (앞부분 정리)
 */
export function extractCoreRequest(text: string): string {
  // 인사말/불필요한 접두어 제거
  const cleaned = text
    .replace(/^(안녕|안녕하세요|hi|hello|hey)[\s,]*/i, '')
    .replace(/^(그래서|그리고|그런데|근데|그럼)[\s,]*/i, '')
    .trim();

  return cleaned;
}

/**
 * 언어 감지 (한국어/영어)
 */
export function _detectLanguage(text: string): 'ko' | 'en' {
  const koreanChars = text.match(/[가-힣]/g)?.length || 0;
  const totalChars = text.length;
  return koreanChars / totalChars > 0.3 ? 'ko' : 'en';
}

/**
 * 카테고리 감지
 */
export function detectCategory(text: string): string {
  const patterns: Record<string, RegExp[]> = {
    'code-generation': [/만들어|구현|생성|작성|개발/i, /component|function|class|api/i],
    'bug-fix': [/에러|오류|버그|수정|fix|error|bug/i],
    'code-review': [/리뷰|검토|봐줘|체크|review/i],
    'refactoring': [/리팩토링|정리|개선|최적화|refactor/i],
    'explanation': [/설명|알려|이해|왜|어떻게|explain|how|why/i],
    'testing': [/테스트|test|spec|검증/i],
  };

  for (const [category, regexes] of Object.entries(patterns)) {
    if (regexes.some((r) => r.test(text))) {
      return category;
    }
  }
  return 'general';
}

/**
 * 카테고리 라벨 반환
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'code-generation': '코드 생성',
    'bug-fix': '버그 수정',
    'code-review': '코드 리뷰',
    'refactoring': '리팩토링',
    'explanation': '설명 요청',
    'testing': '테스트',
    'general': '일반',
  };
  return labels[category] || '일반';
}

/**
 * 프롬프트 복잡도 감지
 * - simple: 단순 질문, 설명 요청, <50자
 * - medium: 코드 생성, 버그 수정, 50-200자
 * - complex: 다중 파일, 리팩토링, 200-500자
 * - advanced: 아키텍처, 보안, >500자 또는 특정 키워드
 */
export function detectComplexity(text: string, context?: SessionContext): PromptComplexity {
  const length = text.length;

  // 고급 키워드 감지
  const advancedKeywords = /아키텍처|설계|보안|성능\s*최적화|마이그레이션|시스템|전체\s*구조|architecture|security|migration|performance/i;
  if (advancedKeywords.test(text) || length > 500) {
    return 'advanced';
  }

  // 복잡한 키워드 감지
  const complexKeywords = /리팩토링|여러\s*파일|전체|테스트\s*작성|리뷰|refactor|multiple\s*files|comprehensive/i;
  if (complexKeywords.test(text) || (length > 200 && length <= 500)) {
    return 'complex';
  }

  // 중간 복잡도: 코드 생성, 버그 수정
  const mediumPatterns = /만들어|구현|생성|수정|고쳐|버그|에러|fix|create|implement/i;
  if (mediumPatterns.test(text) || (length >= 50 && length <= 200)) {
    return 'medium';
  }

  // 컨텍스트에 따른 복잡도 상향
  if (context) {
    // 다중 파일 작업 중이면 complex
    if (context.recentFiles.length > 2) {
      return 'complex';
    }
    // 활성 작업이 있으면 medium 이상
    if (context.currentTask && context.currentTask !== '작업 진행 중') {
      return length > 100 ? 'complex' : 'medium';
    }
  }

  return 'simple';
}

/**
 * 복잡도에 따른 Think mode 선택
 * - simple: 없음
 * - medium: think
 * - complex: think hard
 * - advanced: think harder
 */
export function selectThinkMode(complexity: PromptComplexity): string | null {
  switch (complexity) {
    case 'simple':
      return null;
    case 'medium':
      return 'think';
    case 'complex':
      return 'think hard';
    case 'advanced':
      return 'think harder';
    default:
      return null;
  }
}

/**
 * 카테고리별 성공 기준 생성
 */
export function getSuccessCriteria(category: string): string {
  const criteria: Record<string, string> = {
    'code-generation': '코드 실행 및 기능 동작 확인',
    'bug-fix': '에러 해결 및 재현 테스트 통과',
    'code-review': '모든 지적 사항 검토 완료',
    'refactoring': '기존 기능 유지 + 품질 개선',
    'explanation': '개념 이해 및 적용 가능',
    'testing': '테스트 통과 및 커버리지 달성',
    'general': '요청 사항 충족',
  };
  return criteria[category] || criteria['general'];
}
