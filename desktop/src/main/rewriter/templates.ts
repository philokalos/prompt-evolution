/**
 * Category-based template system for prompt generation
 * Provides structured templates optimized per category (bug-fix, code-gen, etc.)
 */

import type { SessionContext } from '../session-context.js';
import type {
  CategoryTemplate,
  GuidelineEvaluation,
  TemplateContext,
} from './types.js';
import {
  detectCategory,
  detectComplexity,
  detectPrimaryVerb,
  extractCodeFromPrompt,
  extractCoreRequest,
  extractErrorFromPrompt,
  getTechStackConstraints,
  getSuccessCriteria,
  inferOutputFormat,
  selectThinkMode,
} from './text-analysis.js';

/**
 * 카테고리별 템플릿 정의
 */
export const CATEGORY_TEMPLATES: Record<string, CategoryTemplate> = {
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
export function generateFromTemplate(ctx: TemplateContext): string {
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
export function createTemplateContext(
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

/**
 * XML 구조화된 프롬프트 빌드
 * Claude 공식 권장 형식: <context>, <task>, <constraints>, <output_format>, <success_criteria>
 */
export function buildXMLPrompt(
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
 * 상황 섹션 빌드 (실제 값만 사용, 플레이스홀더 없음)
 */
export function buildContextSection(context: SessionContext | undefined, original: string): string | null {
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
export function buildOutputSection(category: string, context?: SessionContext): string {
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
export function buildLimitsSection(context?: SessionContext): string | null {
  if (!context || context.techStack.length === 0) return null;

  const constraints = getTechStackConstraints(context.techStack);
  if (constraints.length === 0) return null;

  return `제약조건:\n${constraints.map(c => `- ${c}`).join('\n')}`;
}

/**
 * 데이터 섹션 빌드 (원본에서 코드/에러 추출)
 */
export function buildDataSection(original: string, context?: SessionContext): string | null {
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
