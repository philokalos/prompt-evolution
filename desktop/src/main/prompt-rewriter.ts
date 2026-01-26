/**
 * Prompt Rewriter Engine v3
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
 *
 * v3 개선사항:
 * - 증거 기반 신뢰도 계산 (무조건 높은 신뢰도 제거)
 * - Anti-pattern 자동 수정 통합
 * - 분류 품질에 따른 신뢰도 조정
 */

import type { SessionContext } from './session-context.js';
import { rewritePromptWithClaude, rewritePromptWithMultiVariant, type RewriteRequest, type RewriteResult as _AIRewriteResult } from './claude-api.js';
import {
  type ProviderConfig,
  type ProviderType,
  type RewriteRequest as ProviderRewriteRequest,
  rewriteWithFallback,
  hasAnyProvider,
} from './providers/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// 증거 기반 신뢰도 계산 (v3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Confidence calculation factors
 */
interface ConfidenceFactors {
  classificationConfidence: number; // 0-1, from classifier
  dimensionsImproved: number; // 0-6, count of GOLDEN dimensions improved
  antiPatternFree: number; // 0-1, 1 if no anti-patterns, lower if patterns remain
  templateMatch: number; // 0-1, how well template fits category
  contextRichness: number; // 0-1, how much context was available
}

/**
 * Calculate calibrated confidence based on actual evidence
 * Replaces the old unconditional high confidence (0.90-0.98)
 */
function calculateCalibratedConfidence(factors: ConfidenceFactors): number {
  let confidence = 0;

  // Classification quality (30% weight)
  confidence += factors.classificationConfidence * 0.30;

  // GOLDEN improvement extent (25% weight)
  confidence += (factors.dimensionsImproved / 6) * 0.25;

  // Anti-pattern status (15% weight)
  confidence += factors.antiPatternFree * 0.15;

  // Template applicability (15% weight)
  confidence += factors.templateMatch * 0.15;

  // Context availability (15% weight)
  confidence += factors.contextRichness * 0.15;

  // Clamp to reasonable range
  return Math.max(0.30, Math.min(0.95, confidence));
}

/**
 * Count how many GOLDEN dimensions will be improved
 */
function countImprovedDimensions(evaluation: GuidelineEvaluation): number {
  const dimensions = ['goal', 'output', 'limits', 'data', 'evaluation', 'next'] as const;
  let improved = 0;

  for (const dim of dimensions) {
    // If dimension score is below 0.5, rewriting will likely improve it
    if (evaluation.goldenScore[dim] < 0.5) {
      improved++;
    }
  }

  return improved;
}

/**
 * Calculate anti-pattern free score
 */
function calculateAntiPatternFreeScore(antiPatterns: Array<{ severity: string }>): number {
  if (antiPatterns.length === 0) return 1.0;

  // High severity patterns reduce score more
  let penalty = 0;
  for (const pattern of antiPatterns) {
    if (pattern.severity === 'high') penalty += 0.3;
    else if (pattern.severity === 'medium') penalty += 0.15;
    else penalty += 0.05;
  }

  return Math.max(0, 1 - penalty);
}

/**
 * Calculate context richness score
 */
function calculateContextRichness(context?: SessionContext): number {
  if (!context) return 0.2;

  let richness = 0.3; // Base for having any context

  if (context.techStack.length > 0) richness += 0.2;
  if (context.currentTask && context.currentTask !== '작업 진행 중') richness += 0.15;
  if (context.recentFiles.length > 0) richness += 0.15;
  if (context.lastExchange) richness += 0.1;
  if (context.gitBranch) richness += 0.1;

  return Math.min(1, richness);
}

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
function _inferWorkFromTools(tools: string[]): string | null {
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
function _detectLanguage(text: string): 'ko' | 'en' {
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
  antiPatterns?: Array<{
    pattern: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
    example?: string;
    fix: string;
  }>;
  recommendations: string[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export type VariantType = 'conservative' | 'balanced' | 'comprehensive' | 'ai' | 'cosp';

export interface RewriteResult {
  rewrittenPrompt: string;
  keyChanges: string[];
  confidence: number;
  variant: VariantType;
  variantLabel: string;
  isAiGenerated?: boolean;
  aiExplanation?: string;
  needsSetup?: boolean; // API 미설정 시 true
  isLoading?: boolean; // Phase 3.1: 비동기 AI 로딩 상태
  // Multi-provider metadata
  provider?: ProviderType; // 사용된 프로바이더
  wasFallback?: boolean;   // Fallback 발생 여부
  fallbackReason?: string; // Fallback 사유
}

// ─────────────────────────────────────────────────────────────────────────────
// 카테고리별 템플릿 시스템 (개선안 품질 향상)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 템플릿 생성 컨텍스트
 */
interface TemplateContext {
  original: string;
  coreRequest: string;
  category: string;
  evaluation: GuidelineEvaluation;
  sessionContext?: SessionContext;
  extractedCode?: string | null;
  extractedError?: string | null;
  techStack: string[];
  complexity: PromptComplexity;
}

/**
 * 섹션 생성기 타입
 */
type SectionGenerator = (ctx: TemplateContext) => string | null;

/**
 * 카테고리별 템플릿 인터페이스
 * 각 카테고리에 최적화된 프롬프트 구조 정의
 */
interface CategoryTemplate {
  /** 필수 섹션들 (순서대로 출력) */
  requiredSections: Array<{
    tag: string;
    generator: SectionGenerator;
  }>;
  /** 기본 Think mode (카테고리 특성 반영) */
  defaultThinkMode: 'think' | 'think hard' | 'think harder' | null;
  /** 카테고리별 품질 체크포인트 */
  qualityFactors: string[];
  /** Few-shot 예시 (AI 리라이트용) */
  example: {
    before: string;
    after: string;
    improvement: string;
  };
}

/**
 * 카테고리별 템플릿 정의
 */
const CATEGORY_TEMPLATES: Record<string, CategoryTemplate> = {
  'bug-fix': {
    requiredSections: [
      {
        tag: 'error_context',
        generator: (ctx) => {
          const lines: string[] = [];
          if (ctx.extractedError) {
            lines.push(`에러 메시지: ${ctx.extractedError}`);
          }
          if (ctx.sessionContext?.recentFiles.length) {
            const file = ctx.sessionContext.recentFiles[0].split('/').pop();
            lines.push(`발생 위치: ${file}`);
          }
          if (ctx.extractedCode) {
            lines.push(`관련 코드:\n${ctx.extractedCode}`);
          }
          return lines.length > 0 ? lines.join('\n') : null;
        },
      },
      {
        tag: 'task',
        generator: (ctx) => ctx.coreRequest,
      },
      {
        tag: 'expected_behavior',
        generator: (ctx) => {
          // 원본에서 기대 동작 추출 시도
          const expectedMatch = ctx.original.match(/(?:원래|기대|expected|should|해야|되어야)[^.。]*[.。]/i);
          return expectedMatch ? expectedMatch[0].trim() : '정상 동작';
        },
      },
      {
        tag: 'constraints',
        generator: (ctx) => {
          const constraints = ['- 부작용 최소화', '- 기존 동작 유지'];
          if (ctx.techStack.includes('TypeScript')) {
            constraints.push('- 타입 안전성 유지');
          }
          return constraints.join('\n');
        },
      },
      {
        tag: 'output_format',
        generator: () => '- 에러 원인 분석\n- 수정된 코드\n- 재발 방지 방법',
      },
      {
        tag: 'success_criteria',
        generator: () => '- 에러 해결됨\n- 재현 테스트 통과\n- 기존 기능 정상 동작',
      },
    ],
    defaultThinkMode: 'think hard',
    qualityFactors: ['에러 메시지 포함', '재현 조건 명시', '기대 동작 설명'],
    example: {
      before: 'TypeError 나는데 고쳐줘',
      after: `<error_context>
에러 메시지: TypeError: Cannot read property 'map' of undefined
발생 위치: UserList.tsx
</error_context>

<task>
사용자 목록 렌더링 시 발생하는 TypeError 수정
</task>

<expected_behavior>
users 배열이 비어있거나 undefined일 때도 정상 렌더링
</expected_behavior>

<constraints>
- 부작용 최소화
- 기존 동작 유지
- 타입 안전성 유지
</constraints>

<success_criteria>
- 에러 해결됨
- 빈 배열/undefined 케이스 테스트 통과
</success_criteria>`,
      improvement: '에러 컨텍스트 구조화, 기대 동작 명시, 성공 기준 추가',
    },
  },

  'code-generation': {
    requiredSections: [
      {
        tag: 'context',
        generator: (ctx) => {
          const lines: string[] = [];
          if (ctx.sessionContext) {
            const projectName = ctx.sessionContext.projectPath.split('/').pop();
            if (ctx.techStack.length > 0) {
              lines.push(`프로젝트: ${projectName} (${ctx.techStack.join(', ')})`);
            } else {
              lines.push(`프로젝트: ${projectName}`);
            }
            if (ctx.sessionContext.currentTask && ctx.sessionContext.currentTask !== '작업 진행 중') {
              lines.push(`현재 작업: ${ctx.sessionContext.currentTask.slice(0, 60)}`);
            }
            // Git 브랜치 (main/master가 아닌 경우)
            if (ctx.sessionContext.gitBranch && !['main', 'master'].includes(ctx.sessionContext.gitBranch)) {
              lines.push(`브랜치: ${ctx.sessionContext.gitBranch}`);
            }
          }
          return lines.length > 0 ? lines.join('\n') : null;
        },
      },
      {
        tag: 'task',
        generator: (ctx) => ctx.coreRequest,
      },
      {
        tag: 'requirements',
        generator: (ctx) => {
          // 원본에서 요구사항 추출 또는 기본 생성
          const requirements: string[] = [];
          if (/컴포넌트|component/i.test(ctx.original)) {
            requirements.push('- 재사용 가능한 컴포넌트 구조');
          }
          if (/api|엔드포인트/i.test(ctx.original)) {
            requirements.push('- 에러 핸들링 포함');
          }
          if (ctx.techStack.includes('TypeScript')) {
            requirements.push('- 타입 정의 포함');
          }
          if (requirements.length === 0) {
            requirements.push('- 기존 코드 스타일 준수');
          }
          return requirements.join('\n');
        },
      },
      {
        tag: 'constraints',
        generator: (ctx) => {
          const constraints: string[] = [];
          // 기술 스택별 제약조건
          if (ctx.techStack.includes('TypeScript')) {
            constraints.push('- 타입 안전성 유지');
          }
          if (ctx.techStack.includes('React')) {
            constraints.push('- 함수형 컴포넌트, hooks 패턴 사용');
          }
          if (ctx.techStack.includes('Vue')) {
            constraints.push('- Composition API 스타일');
          }
          if (ctx.techStack.includes('Next.js')) {
            constraints.push('- App Router 호환, SSR 고려');
          }
          if (ctx.techStack.includes('Firebase')) {
            constraints.push('- 보안 규칙 준수, 비용 최적화');
          }
          if (ctx.techStack.includes('Electron')) {
            constraints.push('- main/renderer 분리');
          }
          if (ctx.techStack.includes('Node.js')) {
            constraints.push('- async/await 패턴');
          }
          if (constraints.length === 0) {
            constraints.push('- 기존 코드 스타일 준수');
          }
          return constraints.join('\n');
        },
      },
      {
        tag: 'output_format',
        generator: (ctx) => {
          const formats = ['- 전체 구현 코드 (import 포함)'];
          if (ctx.complexity !== 'simple') {
            formats.push('- 주요 로직 설명');
          }
          if (ctx.techStack.includes('TypeScript')) {
            formats.push('- 인터페이스/타입 정의');
          }
          return formats.join('\n');
        },
      },
    ],
    defaultThinkMode: 'think',
    qualityFactors: ['기술 스택 명시', '요구사항 구체화', '출력 형식 지정'],
    example: {
      before: '로그인 기능 만들어줘',
      after: `<context>
프로젝트: my-app (React, TypeScript, Firebase)
현재 작업: 인증 시스템 구현
</context>

<task>
Firebase Authentication을 사용한 이메일/비밀번호 로그인 기능 구현
</task>

<requirements>
- 로그인 폼 컴포넌트 (이메일, 비밀번호 입력)
- 유효성 검사 (이메일 형식, 비밀번호 최소 길이)
- 에러 상태 표시 (잘못된 인증 정보 등)
- 로그인 성공 시 리다이렉트
</requirements>

<output_format>
- 전체 구현 코드 (import 포함)
- 인터페이스/타입 정의
- 사용 예시
</output_format>`,
      improvement: '프로젝트 컨텍스트 추가, 요구사항 구체화, 출력 형식 명시',
    },
  },

  'refactoring': {
    requiredSections: [
      {
        tag: 'current_code',
        generator: (ctx) => ctx.extractedCode || '(리팩토링 대상 코드를 붙여넣어 주세요)',
      },
      {
        tag: 'task',
        generator: (ctx) => ctx.coreRequest,
      },
      {
        tag: 'refactoring_goals',
        generator: (ctx) => {
          const goals: string[] = [];
          if (/성능|최적화|performance/i.test(ctx.original)) {
            goals.push('- 성능 개선');
          }
          if (/가독성|readable|clean/i.test(ctx.original)) {
            goals.push('- 가독성 향상');
          }
          if (/중복|duplicate|dry/i.test(ctx.original)) {
            goals.push('- 중복 제거');
          }
          if (/테스트|test/i.test(ctx.original)) {
            goals.push('- 테스트 용이성 향상');
          }
          if (goals.length === 0) {
            goals.push('- 코드 품질 향상');
            goals.push('- 유지보수성 개선');
          }
          return goals.join('\n');
        },
      },
      {
        tag: 'constraints',
        generator: (ctx) => {
          const constraints = ['- 기존 기능 100% 유지', '- 외부 인터페이스 변경 없음'];
          if (ctx.techStack.includes('TypeScript')) {
            constraints.push('- 타입 호환성 유지');
          }
          return constraints.join('\n');
        },
      },
      {
        tag: 'output_format',
        generator: () => '- 리팩토링된 코드\n- 변경 사항 설명\n- (선택) 단계별 적용 가이드',
      },
    ],
    defaultThinkMode: 'think harder',
    qualityFactors: ['기존 코드 포함', '리팩토링 목표 명시', '기능 유지 제약'],
    example: {
      before: '이 함수 정리해줘',
      after: `think harder

<current_code>
\`\`\`typescript
function processData(data) {
  // ... 리팩토링 대상 코드
}
\`\`\`
</current_code>

<task>
processData 함수의 가독성 및 유지보수성 개선
</task>

<refactoring_goals>
- 단일 책임 원칙 적용
- 중첩 조건문 단순화
- 의미 있는 변수명 사용
</refactoring_goals>

<constraints>
- 기존 기능 100% 유지
- 외부 인터페이스 변경 없음
- 타입 호환성 유지
</constraints>

<output_format>
- 리팩토링된 코드
- 변경 사항 설명
- 단계별 적용 가이드
</output_format>`,
      improvement: '대상 코드 포함, 리팩토링 목표 구체화, 제약조건 명시',
    },
  },

  'explanation': {
    requiredSections: [
      {
        tag: 'topic',
        generator: (ctx) => ctx.coreRequest,
      },
      {
        tag: 'context',
        generator: (ctx) => {
          const lines: string[] = [];
          if (ctx.extractedCode) {
            lines.push(`참조 코드:\n${ctx.extractedCode}`);
          }
          if (ctx.sessionContext?.techStack.length) {
            lines.push(`환경: ${ctx.sessionContext.techStack.join(', ')}`);
          }
          return lines.length > 0 ? lines.join('\n\n') : null;
        },
      },
      {
        tag: 'knowledge_level',
        generator: (ctx) => {
          // 원본에서 수준 추정
          if (/초보|beginner|기초|basic/i.test(ctx.original)) {
            return '입문자 (기초 개념부터 설명 필요)';
          }
          if (/깊이|심층|advanced|상세/i.test(ctx.original)) {
            return '숙련자 (심층적인 내용 위주)';
          }
          return '중급자 (핵심 개념 중심)';
        },
      },
      {
        tag: 'output_format',
        generator: () => '- 개념 설명\n- 코드 예시\n- 실제 사용 사례',
      },
    ],
    defaultThinkMode: null,
    qualityFactors: ['질문 명확화', '수준 명시', '예시 요청'],
    example: {
      before: '클로저가 뭐야',
      after: `<topic>
JavaScript 클로저(Closure)의 개념과 활용 방법
</topic>

<knowledge_level>
중급자 (기본 함수 개념은 알고 있음)
</knowledge_level>

<output_format>
- 클로저의 정의와 동작 원리
- 실용적인 코드 예시 3가지
- 흔한 실수와 주의사항
- 실제 프로젝트 활용 사례
</output_format>`,
      improvement: '질문 구체화, 지식 수준 명시, 출력 형식 상세화',
    },
  },
};

/**
 * 카테고리 템플릿을 사용한 프롬프트 생성
 */
function generateFromTemplate(ctx: TemplateContext): string {
  const template = CATEGORY_TEMPLATES[ctx.category];
  if (!template) {
    // 템플릿이 없으면 기존 XML 빌더 사용
    return buildXMLPrompt(ctx.original, ctx.evaluation, ctx.sessionContext);
  }

  const sections: string[] = [];

  // Think mode 추가 (복잡도에 따라 오버라이드 가능)
  const thinkMode = selectThinkMode(ctx.complexity) || template.defaultThinkMode;
  if (thinkMode) {
    sections.push(thinkMode);
  }

  // 템플릿 섹션들 생성
  for (const { tag, generator } of template.requiredSections) {
    const content = generator(ctx);
    if (content) {
      sections.push(`<${tag}>\n${content}\n</${tag}>`);
    }
  }

  return sections.join('\n\n');
}

/**
 * 템플릿 컨텍스트 생성
 */
function createTemplateContext(
  original: string,
  evaluation: GuidelineEvaluation,
  sessionContext?: SessionContext
): TemplateContext {
  const coreRequest = extractCoreRequest(original);
  const category = detectCategory(coreRequest);
  const complexity = detectComplexity(original, sessionContext);

  return {
    original,
    coreRequest,
    category,
    evaluation,
    sessionContext,
    extractedCode: extractCodeFromPrompt(original),
    extractedError: extractErrorFromPrompt(original),
    techStack: sessionContext?.techStack || [],
    complexity,
  };
}

/**
 * 카테고리별 Few-shot 예시 가져오기 (AI 리라이트용)
 */
export function getCategoryExample(category: string): { before: string; after: string; improvement: string } | null {
  const template = CATEGORY_TEMPLATES[category];
  return template?.example || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// COSP (Claude-Optimized Smart Prompt) 관련 함수들
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 프롬프트 복잡도 유형
 */
export type PromptComplexity = 'simple' | 'medium' | 'complex' | 'advanced';

/**
 * 프롬프트 복잡도 감지
 * - simple: 단순 질문, 설명 요청, <50자
 * - medium: 코드 생성, 버그 수정, 50-200자
 * - complex: 다중 파일, 리팩토링, 200-500자
 * - advanced: 아키텍처, 보안, >500자 또는 특정 키워드
 */
function detectComplexity(text: string, context?: SessionContext): PromptComplexity {
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
function selectThinkMode(complexity: PromptComplexity): string | null {
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
 * XML 구조화된 프롬프트 빌드
 * Claude 공식 권장 형식: <context>, <task>, <constraints>, <output_format>, <success_criteria>
 */
function buildXMLPrompt(
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext
): string {
  const sections: string[] = [];
  const coreRequest = extractCoreRequest(original);
  const category = detectCategory(coreRequest);
  const { verb: _verb } = detectPrimaryVerb(original);

  // 1. <context> 섹션 - 프로젝트/환경 정보
  const contextLines: string[] = [];
  if (context) {
    const projectName = context.projectPath.split('/').pop() || 'project';
    contextLines.push(`프로젝트: ${projectName}`);

    if (context.techStack.length > 0) {
      contextLines.push(`기술 스택: ${context.techStack.join(', ')}`);
    }

    if (context.currentTask && context.currentTask !== '작업 진행 중' && context.currentTask.length > 5) {
      contextLines.push(`현재 작업: ${context.currentTask.slice(0, 60)}`);
    }

    if (context.gitBranch && !['main', 'master'].includes(context.gitBranch)) {
      contextLines.push(`Git 브랜치: ${context.gitBranch}`);
    }

    if (context.recentFiles.length > 0) {
      const files = context.recentFiles.slice(0, 3).map(f => f.split('/').pop()).join(', ');
      contextLines.push(`관련 파일: ${files}`);
    }

    // 직전 대화 컨텍스트
    if (context.lastExchange) {
      if (context.lastExchange.assistantFiles.length > 0) {
        const files = context.lastExchange.assistantFiles.slice(0, 2).map(f => f.split('/').pop()).join(', ');
        contextLines.push(`방금 수정: ${files}`);
      }
    }
  }

  // 컨텍스트가 없으면 원본에서 추론
  if (contextLines.length === 0) {
    const error = extractErrorFromPrompt(original);
    const code = extractCodeFromPrompt(original);
    if (error) {
      contextLines.push(`에러: ${error.slice(0, 80)}`);
    }
    if (code && !code.includes('```')) {
      contextLines.push(`참조: ${code}`);
    }
  }

  if (contextLines.length > 0) {
    sections.push(`<context>\n${contextLines.join('\n')}\n</context>`);
  }

  // 2. <task> 섹션 - 핵심 요청
  // 원본에 코드 블록이 있으면 별도로 분리
  const codeBlock = extractCodeFromPrompt(original);
  let taskContent = coreRequest;

  // 코드 블록이 포함된 경우, task에서는 텍스트만 포함하고 코드는 context로 이동
  if (codeBlock && codeBlock.includes('```')) {
    taskContent = coreRequest.replace(codeBlock, '').trim();
    // 코드 블록이 아직 context에 없으면 추가
    if (!sections.some(s => s.includes(codeBlock))) {
      const codeSection = `<reference_code>\n${codeBlock}\n</reference_code>`;
      sections.push(codeSection);
    }
  }

  sections.push(`<task>\n${taskContent || coreRequest}\n</task>`);

  // 3. <constraints> 섹션 - 제약조건 (GOLDEN limits 점수가 낮거나 기술 스택이 있을 때)
  const constraintLines: string[] = [];
  if (context && context.techStack.length > 0) {
    const techConstraints = getTechStackConstraints(context.techStack);
    constraintLines.push(...techConstraints);
  }

  // 카테고리별 기본 제약 추가
  const categoryConstraints: Record<string, string[]> = {
    'code-generation': ['기존 코드 스타일 준수'],
    'bug-fix': ['부작용 최소화'],
    'refactoring': ['기존 기능 유지'],
    'code-review': ['구체적인 라인 번호 포함'],
    'testing': ['엣지 케이스 포함'],
  };
  if (categoryConstraints[category]) {
    constraintLines.push(...categoryConstraints[category]);
  }

  if (constraintLines.length > 0) {
    sections.push(`<constraints>\n${constraintLines.map(c => `- ${c}`).join('\n')}\n</constraints>`);
  }

  // 4. <output_format> 섹션 - 출력 형식 (GOLDEN output 점수가 낮을 때)
  if (evaluation.goldenScore.output < 0.5) {
    const formats = inferOutputFormat(category);
    sections.push(`<output_format>\n${formats.map(f => `- ${f}`).join('\n')}\n</output_format>`);
  }

  // 5. <success_criteria> 섹션 - 성공 기준 (GOLDEN evaluation 점수가 낮을 때)
  if (evaluation.goldenScore.evaluation < 0.5) {
    const criteria = getSuccessCriteria(category);
    const criteriaItems = [criteria];

    // 카테고리별 추가 기준
    if (category === 'code-generation' || category === 'bug-fix') {
      criteriaItems.push('타입 에러 없음');
    }
    if (category === 'testing') {
      criteriaItems.push('모든 테스트 통과');
    }

    sections.push(`<success_criteria>\n${criteriaItems.map(c => `- ${c}`).join('\n')}\n</success_criteria>`);
  }

  return sections.join('\n\n');
}

/**
 * COSP (Claude-Optimized Smart Prompt) 생성
 * 카테고리별 템플릿 시스템 + XML 구조 + Think mode 자동 삽입
 */
function generateCOSPRewrite(
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext
): RewriteResult {
  const keyChanges: string[] = [];

  // 템플릿 컨텍스트 생성
  const templateCtx = createTemplateContext(original, evaluation, context);
  const category = templateCtx.category;
  const template = CATEGORY_TEMPLATES[category];

  // 카테고리 템플릿이 있으면 템플릿 기반 생성, 없으면 기존 XML 빌더 사용
  let rewrittenPrompt: string;

  if (template) {
    // 템플릿 기반 생성
    rewrittenPrompt = generateFromTemplate(templateCtx);
    keyChanges.push(`${getCategoryLabel(category)} 템플릿`);

    // Think mode 정보 추가
    const thinkMode = selectThinkMode(templateCtx.complexity) || template.defaultThinkMode;
    if (thinkMode) {
      keyChanges.push(`Think: ${thinkMode}`);
    }

    // 템플릿 품질 요소 반영 여부 체크
    const appliedFactors = template.qualityFactors.filter(factor => {
      if (factor.includes('에러') && templateCtx.extractedError) return true;
      if (factor.includes('코드') && templateCtx.extractedCode) return true;
      if (factor.includes('기술 스택') && templateCtx.techStack.length > 0) return true;
      if (factor.includes('요구사항')) return true; // 항상 생성
      if (factor.includes('출력 형식')) return true; // 항상 생성
      return false;
    });

    if (appliedFactors.length > 0) {
      keyChanges.push(...appliedFactors.slice(0, 2));
    }
  } else {
    // 기존 XML 빌더 사용 (general 등 템플릿 없는 카테고리)
    const complexity = detectComplexity(original, context);
    const thinkMode = selectThinkMode(complexity);
    const xmlPrompt = buildXMLPrompt(original, evaluation, context);

    const parts: string[] = [];
    if (thinkMode) {
      parts.push(thinkMode);
      keyChanges.push(`Think mode: ${thinkMode}`);
    }
    parts.push(xmlPrompt);
    rewrittenPrompt = parts.join('\n\n');

    keyChanges.push('XML 구조화');
  }

  // 컨텍스트 정보 반영 여부
  if (context && context.techStack.length > 0) {
    keyChanges.push('기술 스택 반영');
  }
  if (context && context.currentTask && context.currentTask !== '작업 진행 중') {
    keyChanges.push('세션 컨텍스트');
  }

  // 약한 GOLDEN 차원 보강 메시지
  const weakDimensions = Object.entries(evaluation.goldenScore)
    .filter(([key, value]) => key !== 'total' && (value as number) < 0.5)
    .map(([key]) => key);

  if (weakDimensions.length > 0 && !template) {
    const dimNames: Record<string, string> = {
      goal: '목표',
      output: '출력',
      limits: '제약',
      data: '컨텍스트',
      evaluation: '평가',
      next: '후속',
    };
    const weakNames = weakDimensions.slice(0, 2).map(d => dimNames[d] || d);
    keyChanges.push(`${weakNames.join('/')} 보강`);
  }

  // v3: 증거 기반 신뢰도 계산 (무조건 높은 신뢰도 대신)
  const confidenceFactors: ConfidenceFactors = {
    // Classification confidence (use category confidence as proxy)
    classificationConfidence: 0.7, // Default, could be passed from classifier
    // Count dimensions that will be improved
    dimensionsImproved: countImprovedDimensions(evaluation),
    // Anti-pattern free score
    antiPatternFree: calculateAntiPatternFreeScore(evaluation.antiPatterns || []),
    // Template match score
    templateMatch: template ? 0.85 : 0.6,
    // Context richness
    contextRichness: calculateContextRichness(context),
  };

  const confidence = calculateCalibratedConfidence(confidenceFactors);

  return {
    rewrittenPrompt,
    keyChanges: [...new Set(keyChanges)].slice(0, 5), // 중복 제거, 최대 5개
    confidence,
    variant: 'cosp',
    variantLabel: 'COSP',
  };
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

function _generateConservativeRewrite(
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

function _generateBalancedRewrite(
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

    // 직전 대화 컨텍스트 (새로 추가)
    if (context.lastExchange) {
      const le = context.lastExchange;
      if (le.assistantFiles.length > 0) {
        const files = le.assistantFiles.slice(0, 2).map(f => f.split('/').pop()).join(', ');
        lines.push(`- 방금 수정한 파일: ${files}`);
      }
      if (le.assistantSummary && le.assistantSummary.length > 10) {
        lines.push(`- 직전 작업: ${le.assistantSummary.slice(0, 50)}`);
      }
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

function _generateComprehensiveRewrite(
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
 * COSP 변형 생성 (메인 함수)
 * 기존 3가지 변형 → 1개의 COSP 변형으로 통합
 */
export function generatePromptVariants(
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext
): RewriteResult[] {
  // 이미 점수가 높으면 최소 변형
  if (evaluation.overallScore >= 0.85) {
    return [
      {
        rewrittenPrompt: original,
        keyChanges: ['이미 잘 작성됨'],
        confidence: 0.95,
        variant: 'cosp',
        variantLabel: 'COSP',
      },
    ];
  }

  // COSP 변형만 반환
  return [generateCOSPRewrite(original, evaluation, context)];
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
          // 직전 대화 컨텍스트 전달
          lastExchange: context.lastExchange
            ? {
                userMessage: context.lastExchange.userMessage,
                assistantSummary: context.lastExchange.assistantSummary,
                assistantTools: context.lastExchange.assistantTools,
                assistantFiles: context.lastExchange.assistantFiles,
              }
            : undefined,
        }
      : undefined,
  };

  try {
    // v2: Use multi-variant generation if GOLDEN evaluator is provided
    if (goldenEvaluator) {
      const result = await rewritePromptWithMultiVariant(apiKey, request, goldenEvaluator);

      if (!result.success || !result.rewrittenPrompt) {
        console.warn('[PromptRewriter] AI rewrite failed:', result.error);
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
 * AI-powered prompt rewriting using multi-provider system
 * Supports fallback across Claude, OpenAI, and Gemini providers
 * Returns null if no providers are available or all fail
 */
export async function generateAIRewriteWithProviders(
  providerConfigs: ProviderConfig[],
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext
): Promise<RewriteResult | null> {
  if (!hasAnyProvider(providerConfigs)) {
    return null;
  }

  const request: ProviderRewriteRequest = {
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
          lastExchange: context.lastExchange
            ? {
                userMessage: context.lastExchange.userMessage,
                assistantSummary: context.lastExchange.assistantSummary,
                assistantTools: context.lastExchange.assistantTools,
                assistantFiles: context.lastExchange.assistantFiles,
              }
            : undefined,
        }
      : undefined,
  };

  try {
    const result = await rewriteWithFallback(request, providerConfigs);

    if (!result.success || !result.rewrittenPrompt) {
      console.warn('[PromptRewriter] Multi-provider rewrite failed:', result.error);
      return null;
    }

    // Provider label for logging (provider info is in result)

    return {
      rewrittenPrompt: result.rewrittenPrompt,
      keyChanges: [
        ...(result.improvements || ['AI가 자동 개선']),
        ...(result.wasFallback ? [`Fallback: ${result.fallbackReason}`] : []),
      ],
      confidence: 0.95,
      variant: 'ai',
      variantLabel: 'AI 추천',
      isAiGenerated: true,
      aiExplanation: result.explanation,
      provider: result.provider,
      wasFallback: result.wasFallback,
      fallbackReason: result.fallbackReason,
    };
  } catch (error) {
    console.error('[PromptRewriter] Multi-provider AI rewrite error:', error);
    return null;
  }
}

/**
 * Generate all prompt variants using multi-provider system
 * Uses provider configs instead of single API key
 */
export async function generateAllVariantsWithProviders(
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext,
  providerConfigs?: ProviderConfig[]
): Promise<RewriteResult[]> {
  // Start with rule-based variants
  const variants = generatePromptVariants(original, evaluation, context);

  // Try multi-provider AI rewrite if configs provided
  if (providerConfigs && hasAnyProvider(providerConfigs)) {
    try {
      const aiVariant = await generateAIRewriteWithProviders(
        providerConfigs,
        original,
        evaluation,
        context
      );
      if (aiVariant) {
        variants.unshift(aiVariant);
      } else {
        variants.unshift(createAIPlaceholder());
      }
    } catch (error) {
      console.warn('[PromptRewriter] Multi-provider variant generation failed:', error);
      variants.unshift(createAIPlaceholder());
    }
  } else {
    // No providers configured
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
 * Generate only the AI variant using multi-provider system
 * Called separately from main analysis to avoid blocking initial render
 */
export async function generateAIVariantWithProviders(
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext,
  providerConfigs?: ProviderConfig[]
): Promise<RewriteResult> {
  if (!providerConfigs || !hasAnyProvider(providerConfigs)) {
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

  try {
    const aiVariant = await generateAIRewriteWithProviders(
      providerConfigs,
      original,
      evaluation,
      context
    );
    if (aiVariant) {
      return aiVariant;
    }
    return createAIPlaceholder();
  } catch (error) {
    console.warn('[PromptRewriter] Async multi-provider variant generation failed:', error);
    return createAIPlaceholder();
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

/**
 * Phase 3.1: Generate only the AI variant asynchronously
 * Called separately from main analysis to avoid blocking initial render
 */
export async function generateAIVariantOnly(
  original: string,
  evaluation: GuidelineEvaluation,
  context?: SessionContext,
  apiKey?: string,
  goldenEvaluator?: GOLDENEvaluator
): Promise<RewriteResult> {
  if (!apiKey || apiKey.trim() === '') {
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

  try {
    const aiVariant = await generateAIRewrite(apiKey, original, evaluation, context, goldenEvaluator);
    if (aiVariant) {
      return aiVariant;
    }
    return createAIPlaceholder();
  } catch (error) {
    console.warn('[PromptRewriter] Async AI variant generation failed:', error);
    return createAIPlaceholder();
  }
}

export { GuidelineEvaluation };
export type { ProviderConfig, ProviderType };
