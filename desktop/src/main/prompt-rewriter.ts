/**
 * Prompt Rewriter Engine v2
 * 원본 프롬프트를 GOLDEN 가이드라인에 맞게 실제로 리라이트
 * 3가지 변형 제공: 보수적, 균형, 적극적
 * AI 리라이트 옵션: Claude API를 사용한 지능형 개선
 * 세션 컨텍스트 활용: 기술 스택, 현재 작업 기반 템플릿 적용
 *
 * v2 개선사항:
 * - 모든 변형에서 플레이스홀더 제거
 * - 세션 컨텍스트를 실제 값으로 활용
 * - 원본에서 코드/에러 추출하여 구조화
 * - 항상 의미 있는 개선 적용
 */

import type { SessionContext } from './session-context.js';
import { rewritePromptWithClaude, rewritePromptWithMultiVariant, type RewriteRequest, type RewriteResult as AIRewriteResult } from './claude-api.js';

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼 함수: 원본 분석 및 컨텍스트 추출
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 원본에서 핵심 동사 추출 (목표 명확화용)
 */
function detectPrimaryVerb(text: string): { verb: string; action: string } {
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
function inferOutputFormat(category: string): string[] {
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
function buildMinimalContext(context: SessionContext | undefined): string | null {
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

  return parts.join(' | ');
}

/**
 * 원본에서 코드 블록 추출
 */
function extractCodeFromPrompt(text: string): string | null {
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
function extractErrorFromPrompt(text: string): string | null {
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
function inferWorkFromTools(tools: string[]): string | null {
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
function getTechStackConstraints(techStack: string[]): string[] {
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
function extractCoreRequest(text: string): string {
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
function detectLanguage(text: string): 'ko' | 'en' {
  const koreanChars = text.match(/[가-힣]/g)?.length || 0;
  const totalChars = text.length;
  return koreanChars / totalChars > 0.3 ? 'ko' : 'en';
}

// ─────────────────────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────────────────────

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

export type VariantType = 'conservative' | 'balanced' | 'comprehensive' | 'ai';

export interface RewriteResult {
  rewrittenPrompt: string;
  keyChanges: string[];
  confidence: number;
  variant: VariantType;
  variantLabel: string;
  isAiGenerated?: boolean;
  aiExplanation?: string;
  needsSetup?: boolean; // API 미설정 시 true
}

// ─────────────────────────────────────────────────────────────────────────────
// 카테고리 감지
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// 보수적 리라이트 - 가장 약한 차원 1개만 개선 (항상 의미 있는 변경)
// ─────────────────────────────────────────────────────────────────────────────

function generateConservativeRewrite(
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext
): RewriteResult {
  const keyChanges: string[] = [];
  let rewritten = extractCoreRequest(original);

  // 가장 약한 차원 찾기 (항상 찾음, 임계값 없음)
  const dimensions = Object.entries(evaluation.goldenScore)
    .filter(([key]) => key !== 'total')
    .sort((a, b) => (a[1] as number) - (b[1] as number));

  const weakestDim = dimensions[0]?.[0];
  const { verb, action } = detectPrimaryVerb(original);
  const category = detectCategory(original);

  switch (weakestDim) {
    case 'goal': {
      // 목표 명확화: 동사 기반 목표 추가
      if (!/해주세요|해줘|하세요/.test(rewritten)) {
        rewritten = `${rewritten}을(를) ${action}`;
      } else {
        // 구체적인 목표 동사 강조
        rewritten = `[${verb}] ${rewritten}`;
      }
      keyChanges.push('목표 명확화');
      break;
    }

    case 'output': {
      // 출력 형식: 카테고리 기반 형식 추가
      const formats = inferOutputFormat(category);
      rewritten += `\n\n→ 출력: ${formats[0]}`;
      keyChanges.push('출력 형식 추가');
      break;
    }

    case 'data': {
      // 컨텍스트: 세션 컨텍스트에서 최소 정보 추가
      const minContext = buildMinimalContext(context);
      if (minContext) {
        rewritten = `[${minContext}]\n\n${rewritten}`;
        keyChanges.push('프로젝트 컨텍스트');
      } else {
        // 컨텍스트 없으면 추출된 코드/에러라도 정리
        const code = extractCodeFromPrompt(original);
        if (code && !rewritten.includes(code)) {
          rewritten += `\n\n참조: ${code}`;
          keyChanges.push('참조 코드 정리');
        }
      }
      break;
    }

    case 'limits': {
      // 제약조건: 기술 스택 기반 제약 추가
      const constraints = context ? getTechStackConstraints(context.techStack) : [];
      if (constraints.length > 0) {
        rewritten += `\n\n(${constraints[0]})`;
        keyChanges.push('기술 제약 추가');
      } else {
        rewritten += ' (간결하게)';
        keyChanges.push('간결함 제약');
      }
      break;
    }

    case 'evaluation': {
      // 평가 기준: 성공 조건 추가
      rewritten += '\n\n성공 기준: 정상 동작 확인';
      keyChanges.push('성공 기준 추가');
      break;
    }

    case 'next': {
      // 후속 작업: 다음 단계 언급
      rewritten += '\n\n(이후 테스트 예정)';
      keyChanges.push('후속 작업 언급');
      break;
    }

    default: {
      // 기본: 카테고리 태그 추가
      rewritten = `[${getCategoryLabel(category)}] ${rewritten}`;
      keyChanges.push('카테고리 태그');
    }
  }

  return {
    rewrittenPrompt: rewritten,
    keyChanges,
    confidence: 0.6,
    variant: 'conservative',
    variantLabel: '보수적',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 균형잡힌 리라이트 - 상위 2-3개 약한 영역 보완 (실제 값 사용)
// ─────────────────────────────────────────────────────────────────────────────

function generateBalancedRewrite(
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext
): RewriteResult {
  const keyChanges: string[] = [];
  const category = detectCategory(original);
  const coreRequest = extractCoreRequest(original);
  const parts: string[] = [];

  // 1. 상황 섹션 (컨텍스트)
  const contextSection = buildContextSection(context, original);
  if (contextSection) {
    parts.push(contextSection);
    keyChanges.push('상황 정보');
  }

  // 2. 요청 섹션
  parts.push(`요청:\n${coreRequest}`);

  // 3. 약한 영역 순서대로 보완 (상위 2개)
  const weakAreas = Object.entries(evaluation.goldenScore)
    .filter(([key, value]) => key !== 'total' && (value as number) < 0.6)
    .sort((a, b) => (a[1] as number) - (b[1] as number))
    .slice(0, 2)
    .map(([key]) => key);

  // 출력 형식
  if (weakAreas.includes('output')) {
    const outputSection = buildOutputSection(category, context);
    parts.push(outputSection);
    keyChanges.push('출력 형식');
  }

  // 제약조건
  if (weakAreas.includes('limits')) {
    const limitsSection = buildLimitsSection(context);
    if (limitsSection) {
      parts.push(limitsSection);
      keyChanges.push('제약조건');
    }
  }

  // 변경이 없으면 기본 구조화
  if (keyChanges.length === 0) {
    parts.unshift(`[${getCategoryLabel(category)}]`);
    keyChanges.push('구조화');
  }

  return {
    rewrittenPrompt: parts.join('\n\n'),
    keyChanges,
    confidence: context ? 0.78 : 0.72,
    variant: 'balanced',
    variantLabel: '균형',
  };
}

/**
 * 상황 섹션 빌드 (실제 값만 사용, 플레이스홀더 없음)
 */
function buildContextSection(context: SessionContext | undefined, original: string): string | null {
  const lines: string[] = [];

  if (context) {
    const projectName = context.projectPath.split('/').pop() || 'project';

    // 프로젝트 + 기술 스택
    if (context.techStack.length > 0) {
      lines.push(`- 환경: ${projectName} (${context.techStack.join(' + ')})`);
    } else {
      lines.push(`- 프로젝트: ${projectName}`);
    }

    // 현재 작업 (의미 있는 경우만)
    if (context.currentTask &&
        context.currentTask !== '작업 진행 중' &&
        context.currentTask.length > 5) {
      lines.push(`- 진행 중: ${context.currentTask.slice(0, 60)}`);
    }

    // 관련 파일
    if (context.recentFiles.length > 0) {
      const file = context.recentFiles[0].split('/').pop() || context.recentFiles[0];
      lines.push(`- 관련 파일: ${file}`);
    }

    // 브랜치 (main/master가 아닌 경우)
    if (context.gitBranch && !['main', 'master'].includes(context.gitBranch)) {
      lines.push(`- 브랜치: ${context.gitBranch}`);
    }
  }

  // 컨텍스트가 없으면 원본에서 추론 시도
  if (lines.length === 0) {
    const code = extractCodeFromPrompt(original);
    const error = extractErrorFromPrompt(original);

    if (error) {
      lines.push(`- 에러: ${error.slice(0, 80)}`);
    }
    if (code && code.length < 100) {
      lines.push(`- 참조: ${code}`);
    }
  }

  if (lines.length === 0) return null;
  return `현재 상황:\n${lines.join('\n')}`;
}

/**
 * 출력 형식 섹션 빌드
 */
function buildOutputSection(category: string, context?: SessionContext): string {
  const formats = inferOutputFormat(category);
  const items = formats.map(f => `- ${f}`);

  // TypeScript 프로젝트면 타입 정의 추가
  if (context?.techStack.includes('TypeScript') && !items.some(i => i.includes('타입'))) {
    items.push('- 타입 정의 포함');
  }

  return `출력 형식:\n${items.join('\n')}`;
}

/**
 * 제약조건 섹션 빌드
 */
function buildLimitsSection(context?: SessionContext): string | null {
  if (!context || context.techStack.length === 0) return null;

  const constraints = getTechStackConstraints(context.techStack);
  if (constraints.length === 0) return null;

  return `제약조건:\n${constraints.map(c => `- ${c}`).join('\n')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 적극적 리라이트 - 완전한 GOLDEN 구조 (원본에서 콘텐츠 추출)
// ─────────────────────────────────────────────────────────────────────────────

function generateComprehensiveRewrite(
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext
): RewriteResult {
  const keyChanges: string[] = [];
  const category = detectCategory(original);
  const coreRequest = extractCoreRequest(original);
  const { verb } = detectPrimaryVerb(original);

  const sections: string[] = [];

  // 1. 헤더 (카테고리 + 목표)
  sections.push(`[${getCategoryLabel(category)} - ${verb}]`);
  keyChanges.push('목표 명확화');

  // 2. 컨텍스트 섹션 (풍부한 정보)
  const dataSection = buildDataSection(original, context);
  if (dataSection) {
    sections.push(dataSection);
    keyChanges.push('컨텍스트 구조화');
  }

  // 3. 요청 섹션
  sections.push(`요청:\n${coreRequest}`);

  // 4. 제약조건 (있는 경우)
  if (context && context.techStack.length > 0) {
    const constraints = getTechStackConstraints(context.techStack);
    if (constraints.length > 0) {
      sections.push(`제약:\n${constraints.map(c => `- ${c}`).join('\n')}`);
      keyChanges.push('기술 제약');
    }
  }

  // 5. 출력 형식
  const outputFormats = inferOutputFormat(category);
  sections.push(`출력:\n${outputFormats.map(f => `- ${f}`).join('\n')}`);
  keyChanges.push('출력 형식');

  // 6. 성공 기준 (카테고리별)
  const successCriteria = getSuccessCriteria(category);
  sections.push(`완료 조건:\n- ${successCriteria}`);
  keyChanges.push('완료 조건');

  return {
    rewrittenPrompt: sections.join('\n\n'),
    keyChanges,
    confidence: context ? 0.92 : 0.85,
    variant: 'comprehensive',
    variantLabel: '적극적',
  };
}

/**
 * 데이터 섹션 빌드 (원본에서 코드/에러 추출)
 */
function buildDataSection(original: string, context?: SessionContext): string | null {
  const lines: string[] = [];

  // 세션 컨텍스트
  if (context) {
    const projectName = context.projectPath.split('/').pop() || 'project';
    lines.push(`프로젝트: ${projectName}`);

    if (context.techStack.length > 0) {
      lines.push(`환경: ${context.techStack.join(', ')}`);
    }

    if (context.recentFiles.length > 0) {
      const files = context.recentFiles.slice(0, 3).map(f => f.split('/').pop()).join(', ');
      lines.push(`관련 파일: ${files}`);
    }

    if (context.gitBranch && !['main', 'master'].includes(context.gitBranch)) {
      lines.push(`브랜치: ${context.gitBranch}`);
    }

    if (context.currentTask && context.currentTask !== '작업 진행 중') {
      lines.push(`작업: ${context.currentTask.slice(0, 80)}`);
    }
  }

  // 원본에서 에러 추출
  const error = extractErrorFromPrompt(original);
  if (error) {
    if (lines.length > 0) lines.push('');
    lines.push(`에러: ${error}`);
  }

  // 원본에서 코드 추출 (별도 섹션으로)
  const code = extractCodeFromPrompt(original);
  if (code && code.includes('```')) {
    if (lines.length > 0) lines.push('');
    lines.push(`참조 코드:\n${code}`);
  }

  if (lines.length === 0) return null;
  return `컨텍스트:\n${lines.join('\n')}`;
}

/**
 * 카테고리별 성공 기준 생성
 */
function getSuccessCriteria(category: string): string {
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

// ─────────────────────────────────────────────────────────────────────────────
// 메인 함수
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 3가지 변형 생성 (메인 함수)
 */
export function generatePromptVariants(
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext
): RewriteResult[] {
  // 이미 점수가 높으면 변형 최소화
  if (evaluation.overallScore >= 0.85) {
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

/**
 * GOLDEN 점수 평가 함수 타입
 */
export type GOLDENEvaluator = (text: string) => {
  total: number;
  goal: number;
  output: number;
  limits: number;
  data: number;
  evaluation: number;
  next: number;
};

/**
 * AI-powered prompt rewriting using Claude API
 * v2: Multi-variant generation with GOLDEN evaluation → best score selection
 * Returns null if API is not available or fails
 */
export async function generateAIRewrite(
  apiKey: string,
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext,
  goldenEvaluator?: GOLDENEvaluator
): Promise<RewriteResult | null> {
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }

  const request: RewriteRequest = {
    originalPrompt: original,
    goldenScores: {
      goal: Math.round(evaluation.goldenScore.goal * 100),
      output: Math.round(evaluation.goldenScore.output * 100),
      limits: Math.round(evaluation.goldenScore.limits * 100),
      data: Math.round(evaluation.goldenScore.data * 100),
      evaluation: Math.round(evaluation.goldenScore.evaluation * 100),
      next: Math.round(evaluation.goldenScore.next * 100),
    },
    issues: evaluation.guidelineScores
      .filter((g) => g.score < 0.5)
      .map((g) => ({
        severity: g.score < 0.3 ? 'high' : 'medium',
        category: g.guideline,
        message: g.description,
        suggestion: g.suggestion,
      })),
    sessionContext: context
      ? {
          projectPath: context.projectPath,
          projectName: context.projectPath.split('/').pop(),
          techStack: context.techStack,
          currentTask: context.currentTask,
          recentFiles: context.recentFiles,
          recentTools: context.recentTools,
          gitBranch: context.gitBranch,
        }
      : undefined,
  };

  try {
    // v2: Use multi-variant generation if GOLDEN evaluator is provided
    if (goldenEvaluator) {
      console.log('[PromptRewriter] Using multi-variant AI generation with GOLDEN evaluation');

      const result = await rewritePromptWithMultiVariant(apiKey, request, goldenEvaluator);

      if (!result.success || !result.rewrittenPrompt) {
        console.warn('[PromptRewriter] Multi-variant AI rewrite failed:', result.error);
        return null;
      }

      const improvementLabel = result.improvementPercent !== undefined
        ? `${result.originalScore}% → ${result.improvedScore}% (+${result.improvementPercent}%)`
        : undefined;

      return {
        rewrittenPrompt: result.rewrittenPrompt,
        keyChanges: [
          ...(result.improvements || []),
          ...(improvementLabel ? [`GOLDEN 점수: ${improvementLabel}`] : []),
        ],
        confidence: 0.95,
        variant: 'ai',
        variantLabel: 'AI 추천',
        isAiGenerated: true,
        aiExplanation: result.explanation,
      };
    }

    // Fallback: Single variant generation (legacy behavior)
    const result = await rewritePromptWithClaude(apiKey, request);

    if (!result.success || !result.rewrittenPrompt) {
      console.warn('[PromptRewriter] AI rewrite failed:', result.error);
      return null;
    }

    return {
      rewrittenPrompt: result.rewrittenPrompt,
      keyChanges: result.improvements || ['AI가 자동 개선'],
      confidence: 0.95,
      variant: 'ai',
      variantLabel: 'AI 추천',
      isAiGenerated: true,
      aiExplanation: result.explanation,
    };
  } catch (error) {
    console.error('[PromptRewriter] AI rewrite error:', error);
    return null;
  }
}

/**
 * Generate all prompt variants including AI-powered one if API key is available
 * Always returns 4 variants: AI (or placeholder) + 3 rule-based
 * v2: Now accepts GOLDEN evaluator for multi-variant selection
 */
export async function generateAllVariants(
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext,
  apiKey?: string,
  goldenEvaluator?: GOLDENEvaluator
): Promise<RewriteResult[]> {
  // Start with rule-based variants
  const variants = generatePromptVariants(original, evaluation, context);

  // Try AI rewrite if API key is provided
  if (apiKey && apiKey.trim() !== '') {
    try {
      // v2: Pass GOLDEN evaluator for multi-variant generation
      const aiVariant = await generateAIRewrite(apiKey, original, evaluation, context, goldenEvaluator);
      if (aiVariant) {
        // Insert AI variant at the beginning (highest priority)
        variants.unshift(aiVariant);
      } else {
        // AI call returned null, add placeholder
        variants.unshift(createAIPlaceholder());
      }
    } catch (error) {
      console.warn('[PromptRewriter] AI variant generation failed:', error);
      // Add placeholder on error
      variants.unshift(createAIPlaceholder());
    }
  } else {
    // No API key, add placeholder with setup guidance
    variants.unshift({
      rewrittenPrompt: '',
      keyChanges: [],
      confidence: 0,
      variant: 'ai',
      variantLabel: 'AI 추천',
      isAiGenerated: false,
      needsSetup: true,
    });
  }

  return variants;
}

/**
 * Create a placeholder AI variant for error cases
 */
function createAIPlaceholder(): RewriteResult {
  return {
    rewrittenPrompt: '',
    keyChanges: [],
    confidence: 0,
    variant: 'ai',
    variantLabel: 'AI 추천',
    isAiGenerated: false,
    needsSetup: true,
  };
}

export { GuidelineEvaluation };
