/**
 * Prompt Rewriter Engine
 * 원본 프롬프트를 GOLDEN 가이드라인에 맞게 실제로 리라이트
 * 3가지 변형 제공: 보수적, 균형, 적극적
 * 세션 컨텍스트 활용: 기술 스택, 현재 작업 기반 템플릿 적용
 */

import type { SessionContext } from './session-context.js';

// Tech stack specific hints for prompt enhancement
const TECH_STACK_HINTS: Record<string, string[]> = {
  'React': ['컴포넌트 구조 명시', 'hooks 사용 여부'],
  'TypeScript': ['타입 정의 포함', '인터페이스 명시'],
  'Vue': ['Composition API 또는 Options API 선택'],
  'Next.js': ['App Router 또는 Pages Router', 'SSR/SSG 고려'],
  'Firebase': ['보안 규칙 고려', 'Firestore 구조'],
  'Node.js': ['런타임 버전', '패키지 매니저'],
  'Python': ['Python 버전', '가상환경 정보'],
  'Tailwind CSS': ['커스텀 테마 여부', '기존 스타일 패턴'],
  'Vite': ['빌드 설정 고려'],
  'Electron': ['main/renderer 프로세스 구분'],
};

interface GOLDENScore {
  goal: number;
  output: number;
  limits: number;
  data: number;
  evaluation: number;
  next: number;
  total: number;
}

interface GuidelineEvaluation {
  overallScore: number;
  guidelineScores: Array<{
    guideline: string;
    name: string;
    description: string;
    score: number;
    weight: number;
    evidence: string[];
    suggestion: string;
  }>;
  goldenScore: GOLDENScore;
  recommendations: string[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export type VariantType = 'conservative' | 'balanced' | 'comprehensive';

export interface RewriteResult {
  rewrittenPrompt: string;
  keyChanges: string[];
  confidence: number;
  variant: VariantType;
  variantLabel: string;
}

/**
 * 프롬프트 카테고리 감지
 */
function detectCategory(text: string): string {
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
 * 카테고리별 한글 라벨
 */
function getCategoryLabel(category: string): string {
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
 * 보수적 리라이트 - 최소한의 변경
 */
function generateConservativeRewrite(
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext
): RewriteResult {
  const keyChanges: string[] = [];
  let rewritten = original.trim();

  // 가장 낮은 점수 영역 1개만 보완
  const lowestScore = Object.entries(evaluation.goldenScore)
    .filter(([key]) => key !== 'total')
    .sort((a, b) => (a[1] as number) - (b[1] as number))[0];

  if (lowestScore && (lowestScore[1] as number) < 0.5) {
    const area = lowestScore[0];

    switch (area) {
      case 'goal':
        if (!/목표|하고 싶|원하는/i.test(rewritten)) {
          rewritten = rewritten.replace(/해줘\.?$|해$/, '해줘. (목표: 기능 구현)');
          keyChanges.push('목표 힌트 추가');
        }
        break;
      case 'output':
        if (!/형식|출력|결과/i.test(rewritten)) {
          rewritten += '\n\n출력: 코드로 보여줘.';
          keyChanges.push('출력 형식 힌트');
        }
        break;
      case 'data':
        if (rewritten.length < 50) {
          rewritten = `[참고: 현재 프로젝트]\n\n${rewritten}`;
          keyChanges.push('컨텍스트 자리');
        }
        break;
    }
  }

  // 변경이 없으면 기본 개선
  if (keyChanges.length === 0) {
    const category = detectCategory(original);
    rewritten = `[${getCategoryLabel(category)}] ${rewritten}`;
    keyChanges.push('카테고리 태그');
  }

  return {
    rewrittenPrompt: rewritten,
    keyChanges,
    confidence: 0.6,
    variant: 'conservative',
    variantLabel: '보수적',
  };
}

/**
 * 균형잡힌 리라이트 - 주요 영역 보완
 */
function generateBalancedRewrite(
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext
): RewriteResult {
  const keyChanges: string[] = [];
  const category = detectCategory(original);
  let rewritten = '';

  // 1. 카테고리 태그 추가
  rewritten = `[${getCategoryLabel(category)} 요청]\n\n`;
  keyChanges.push('카테고리 명시');

  // 2. 낮은 점수 영역들 보완 (0.5 미만)
  const lowScoreAreas = Object.entries(evaluation.goldenScore)
    .filter(([key, value]) => key !== 'total' && (value as number) < 0.5)
    .map(([key]) => key);

  // 컨텍스트 (data) - Use session context if available
  if (lowScoreAreas.includes('data')) {
    if (context && context.techStack.length > 0) {
      rewritten += `현재 상황:\n- 환경: ${context.techStack.join(' + ')}\n`;
      if (context.currentTask && context.currentTask !== '작업 진행 중') {
        rewritten += `- 작업: ${context.currentTask}\n`;
      }
      rewritten += '\n';
      keyChanges.push('세션 컨텍스트');
    } else {
      rewritten += '현재 상황:\n- [프로젝트/환경 설명]\n\n';
      keyChanges.push('컨텍스트 섹션');
    }
  }

  // 원본 요청
  rewritten += `요청:\n${original.trim()}\n`;

  // 출력 형식 (output)
  if (lowScoreAreas.includes('output')) {
    rewritten += '\n출력 형식:\n- [코드/설명/단계별 가이드]';
    keyChanges.push('출력 형식');
  }

  // 제약조건 (limits)
  if (lowScoreAreas.includes('limits') && category === 'code-generation') {
    // Add tech stack specific hints if available
    if (context && context.techStack.length > 0) {
      const hints = getTechStackHints(context.techStack);
      if (hints.length > 0) {
        rewritten += `\n\n제약조건:\n- ${hints.join('\n- ')}`;
        keyChanges.push('기술 스택 힌트');
      } else {
        rewritten += '\n\n제약조건:\n- [필요한 제약사항]';
        keyChanges.push('제약조건');
      }
    } else {
      rewritten += '\n\n제약조건:\n- [필요한 제약사항]';
      keyChanges.push('제약조건');
    }
  }

  return {
    rewrittenPrompt: rewritten,
    keyChanges,
    confidence: context ? 0.8 : 0.75,
    variant: 'balanced',
    variantLabel: '균형',
  };
}

/**
 * 적극적 리라이트 - 완전한 GOLDEN 구조화
 */
function generateComprehensiveRewrite(
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext
): RewriteResult {
  const keyChanges: string[] = [];
  const category = detectCategory(original);

  // 카테고리별 템플릿 적용
  let rewritten = '';

  // Add context header if available
  if (context && context.techStack.length > 0) {
    const contextHeader = generateContextHeader(context);
    rewritten = `[세션 컨텍스트]\n${contextHeader}\n\n`;
    keyChanges.push('세션 컨텍스트 적용');
  }

  switch (category) {
    case 'code-generation':
      rewritten += generateCodeGenerationTemplate(original, context);
      keyChanges.push('코드 생성 템플릿');
      break;
    case 'bug-fix':
      rewritten += generateBugFixTemplate(original);
      keyChanges.push('버그 수정 템플릿');
      break;
    case 'code-review':
      rewritten += generateCodeReviewTemplate(original);
      keyChanges.push('코드 리뷰 템플릿');
      break;
    case 'explanation':
      rewritten += generateExplanationTemplate(original);
      keyChanges.push('설명 요청 템플릿');
      break;
    default:
      rewritten += generateGeneralTemplate(original);
      keyChanges.push('일반 템플릿');
  }

  // GOLDEN 요소 태그
  keyChanges.push('목표 명확화', '컨텍스트 추가', '출력 형식 지정');

  return {
    rewrittenPrompt: rewritten,
    keyChanges,
    confidence: context ? 0.95 : 0.9,
    variant: 'comprehensive',
    variantLabel: '적극적',
  };
}

// 템플릿 함수들

function generateCodeGenerationTemplate(original: string, context?: SessionContext): string {
  // Use context for environment info if available
  const envInfo = context && context.techStack.length > 0
    ? `- 프로젝트: ${context.techStack.join(' + ')}`
    : '- 프로젝트: [프레임워크/언어]';

  const structureInfo = context && context.recentFiles.length > 0
    ? `- 최근 파일: ${context.recentFiles.slice(0, 3).join(', ')}`
    : '- 기존 구조: [관련 파일/패턴]';

  // Get tech stack hints
  const hints = context ? getTechStackHints(context.techStack) : [];
  const requirementsSection = hints.length > 0
    ? `요구사항:\n${hints.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
    : `요구사항:
1. [첫 번째 요구사항]
2. [두 번째 요구사항]`;

  return `[코드 생성 요청]

현재 상황:
${envInfo}
${structureInfo}

요청:
${original.trim()}

${requirementsSection}

출력 형식:
- 전체 코드 파일
- 사용된 타입 정의 포함`;
}

function generateBugFixTemplate(original: string): string {
  return `[버그 수정 요청]

에러 메시지:
\`\`\`
[에러 내용]
\`\`\`

재현 방법:
1. [첫 번째 단계]
2. [두 번째 단계]

관련 코드:
\`\`\`
[코드]
\`\`\`

문제:
${original.trim()}

원하는 결과:
- 에러 원인 분석
- 수정된 코드
- 재발 방지 방법`;
}

function generateCodeReviewTemplate(original: string): string {
  return `[코드 리뷰 요청]

리뷰 대상:
${original.trim()}

리뷰 관점:
1. 코드 품질
2. 성능
3. 보안

기대하는 피드백:
- 문제점과 심각도
- 개선된 코드 예시`;
}

function generateExplanationTemplate(original: string): string {
  return `[설명 요청]

주제:
${original.trim()}

내 수준:
- [현재 이해 수준]

알고 싶은 내용:
1. 기본 개념
2. 실제 사용 예시
3. 주의사항

형식:
- 단계별 설명
- 코드 예시 포함`;
}

function generateGeneralTemplate(original: string): string {
  return `[요청]

배경:
- [현재 상황 설명]

요청 내용:
${original.trim()}

원하는 결과:
- [기대하는 출력 형식]`;
}

/**
 * Generate context-aware environment header
 */
function generateContextHeader(context: SessionContext): string {
  const parts: string[] = [];

  // Project name from path
  const projectName = context.projectPath.split('/').pop() || 'project';
  parts.push(`프로젝트: ${projectName}`);

  // Tech stack
  if (context.techStack.length > 0) {
    parts.push(`환경: ${context.techStack.join(' + ')}`);
  }

  // Current task if available
  if (context.currentTask && context.currentTask !== '작업 진행 중') {
    parts.push(`작업: ${context.currentTask}`);
  }

  // Git branch if available
  if (context.gitBranch) {
    parts.push(`브랜치: ${context.gitBranch}`);
  }

  return parts.join('\n');
}

/**
 * Get relevant hints for the current tech stack
 */
function getTechStackHints(techStack: string[]): string[] {
  const hints: string[] = [];

  for (const tech of techStack) {
    const techHints = TECH_STACK_HINTS[tech];
    if (techHints) {
      hints.push(...techHints);
    }
  }

  return hints.slice(0, 3); // Limit to 3 most relevant hints
}

/**
 * 3가지 변형 생성 (메인 함수)
 */
export function generatePromptVariants(
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext
): RewriteResult[] {
  // 이미 점수가 높으면 변형 최소화
  if (evaluation.overallScore >= 0.8) {
    return [
      {
        rewrittenPrompt: original,
        keyChanges: ['이미 잘 작성됨'],
        confidence: 0.95,
        variant: 'conservative',
        variantLabel: '보수적',
      },
      generateBalancedRewrite(original, evaluation, context),
      generateComprehensiveRewrite(original, evaluation, context),
    ];
  }

  return [
    generateConservativeRewrite(original, evaluation, context),
    generateBalancedRewrite(original, evaluation, context),
    generateComprehensiveRewrite(original, evaluation, context),
  ];
}

export { GuidelineEvaluation };
