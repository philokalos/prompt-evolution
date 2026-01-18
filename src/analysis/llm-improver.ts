/**
 * LLM-based Prompt Improver Module
 *
 * Claude API를 사용한 프롬프트 개선 엔진
 * - 다중 변형 생성 (temperature 0.3, 0.5, 0.7)
 * - 실제 GOLDEN 평가로 최고 점수 선택
 * - 5% → 60%+ 체감 가능한 개선
 */

import Anthropic from '@anthropic-ai/sdk';
import { calculateGOLDENScore, type GOLDENScore } from './guidelines-evaluator.js';
import { classifyPrompt, type PromptClassification } from './classifier.js';

/**
 * 개선된 프롬프트 결과
 */
export interface ImprovedPrompt {
  original: string;
  improved: string;
  originalScore: GOLDENScore;
  improvedScore: GOLDENScore;
  improvementPercent: number;
  classification: PromptClassification;
  keyChanges: string[];
  confidence: number;
  variant: 'conservative' | 'balanced' | 'comprehensive';
}

/**
 * 컨텍스트 정보
 */
export interface ImprovementContext {
  techStack?: string[];
  projectType?: string;
  recentTask?: string;
  language?: 'ko' | 'en';
}

/**
 * LLM 개선 엔진 옵션
 */
export interface LLMImproverOptions {
  apiKey?: string;
  model?: string;
  numVariants?: number;
  maxTokens?: number;
}

const DEFAULT_OPTIONS: Required<LLMImproverOptions> = {
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: 'claude-3-haiku-20240307',
  numVariants: 3,
  maxTokens: 2048,
};

/**
 * GOLDEN 체크리스트 기반 메타프롬프트 (강화된 버전)
 * - 모든 6개 차원을 명시적으로 포함하도록 요구
 * - 설명 없이 프롬프트만 출력하도록 강조
 */
const IMPROVEMENT_METAPROMPT = `당신은 프롬프트 엔지니어링 전문가입니다.

주어진 프롬프트를 GOLDEN 체크리스트의 **모든 6가지 차원**을 반드시 포함하도록 개선하세요.

## GOLDEN 체크리스트 (각 차원 반드시 포함)

1. **G - Goal (목표)**: "~을 구현해 주세요", "~를 개발해 주세요" 등 명확한 목표 문장
2. **O - Output (출력)**: "출력 형식:", "결과물:" 등으로 원하는 형식 명시 (예: "TypeScript 코드로 작성", "JSON 형식으로 반환")
3. **L - Limits (제약)**: "다음 조건을 따라주세요:", "제약사항:" 등으로 범위와 제한 명시
4. **D - Data (데이터)**: "현재 환경:", "사용 기술:" 등으로 컨텍스트 제공
5. **E - Evaluation (평가)**: "성공 기준:", "테스트 방법:" 등으로 검증 기준 명시
6. **N - Next (다음)**: "완료 후:", "다음 단계:" 등으로 후속 작업 안내

## 개선 원칙
- 플레이스홀더([여기에], TODO 등) 절대 금지 - 구체적인 값으로 채워 넣을 것
- 원본 언어 유지 (한글 → 한글, 영어 → 영어)
- 실제 사용 가능한 완성된 프롬프트만 생성

## 출력 규칙 (매우 중요!)
- "개선된 프롬프트:", "다음과 같이", "프롬프트를 개선했습니다" 같은 도입부 절대 금지
- 설명, 주석, 코멘트 없이 개선된 프롬프트 텍스트만 출력
- 첫 글자부터 바로 개선된 프롬프트 내용으로 시작`;

/**
 * 프롬프트 개선 (LLM 기반)
 */
export async function improvePrompt(
  originalPrompt: string,
  context?: ImprovementContext,
  options?: LLMImproverOptions
): Promise<ImprovedPrompt | null> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!opts.apiKey) {
    console.error('ANTHROPIC_API_KEY가 설정되지 않았습니다.');
    return null;
  }

  try {
    // 원본 분석
    const originalScore = calculateGOLDENScore(originalPrompt);
    const classification = classifyPrompt(originalPrompt);
    const language = detectLanguage(originalPrompt);

    // 다중 변형 생성
    const variants = await generateVariants(
      originalPrompt,
      context,
      opts,
      language
    );

    if (variants.length === 0) {
      return null;
    }

    // 각 변형 평가 및 최고 점수 선택
    const evaluatedVariants = variants.map((variant, index) => {
      const score = calculateGOLDENScore(variant.text);
      const variantType: 'conservative' | 'balanced' | 'comprehensive' =
        index === 0 ? 'conservative' : index === 1 ? 'balanced' : 'comprehensive';

      return {
        text: variant.text,
        score,
        keyChanges: variant.keyChanges,
        variantType,
        confidence: variant.confidence,
      };
    });

    // 최고 점수 변형 선택
    const best = evaluatedVariants.reduce((a, b) =>
      a.score.total > b.score.total ? a : b
    );

    const improvementPercent = Math.round(
      ((best.score.total - originalScore.total) / Math.max(originalScore.total, 0.01)) * 100
    );

    return {
      original: originalPrompt,
      improved: best.text,
      originalScore,
      improvedScore: best.score,
      improvementPercent,
      classification,
      keyChanges: best.keyChanges,
      confidence: best.confidence,
      variant: best.variantType,
    };
  } catch (error) {
    console.error('프롬프트 개선 중 오류:', error);
    return null;
  }
}

/**
 * 다중 변형 생성
 */
async function generateVariants(
  originalPrompt: string,
  context: ImprovementContext | undefined,
  options: Required<LLMImproverOptions>,
  language: 'ko' | 'en'
): Promise<Array<{ text: string; keyChanges: string[]; confidence: number }>> {
  const client = new Anthropic({ apiKey: options.apiKey });

  const temperatures = [0.3, 0.5, 0.7];
  const variantNames = ['보수적', '균형', '적극적'];

  // 컨텍스트 기반 힌트 생성
  const contextHint = buildContextHint(context, language);

  const promises = temperatures.map(async (temp, index) => {
    try {
      const systemPrompt = buildSystemPrompt(
        variantNames[index],
        language,
        contextHint
      );

      const response = await client.messages.create({
        model: options.model,
        max_tokens: options.maxTokens,
        temperature: temp,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `다음 프롬프트를 개선하세요:\n\n${originalPrompt}`,
          },
        ],
      });

      const text = extractTextFromResponse(response);
      const keyChanges = analyzeChanges(originalPrompt, text, language);

      // 신뢰도 계산 (temperature 낮을수록 높음)
      const confidence = 0.9 - (temp * 0.2);

      return { text, keyChanges, confidence };
    } catch (error) {
      console.error(`변형 ${index + 1} 생성 실패:`, error);
      return null;
    }
  });

  const results = await Promise.all(promises);
  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

/**
 * 시스템 프롬프트 구성
 */
function buildSystemPrompt(
  variantType: string,
  language: 'ko' | 'en',
  contextHint: string
): string {
  const styleGuide = {
    '보수적': '최소한의 변경으로 가장 약한 부분만 개선. 원본의 의도와 스타일 최대한 유지.',
    '균형': '2-3개 약한 영역 개선. 실용적이고 적용 가능한 수준의 변경.',
    '적극적': '완전한 GOLDEN 구조 적용. 모든 차원에서 최대한 개선.',
  };

  const langNote = language === 'ko'
    ? '반드시 한글로 응답하세요.'
    : 'Respond in English.';

  return `${IMPROVEMENT_METAPROMPT}

## 개선 스타일: ${variantType}
${styleGuide[variantType as keyof typeof styleGuide] || styleGuide['균형']}

${contextHint}

${langNote}`;
}

/**
 * 컨텍스트 힌트 생성
 */
function buildContextHint(
  context: ImprovementContext | undefined,
  language: 'ko' | 'en'
): string {
  if (!context) return '';

  const hints: string[] = [];

  if (context.techStack && context.techStack.length > 0) {
    hints.push(`기술 스택: ${context.techStack.join(', ')}`);
  }

  if (context.projectType) {
    hints.push(`프로젝트 유형: ${context.projectType}`);
  }

  if (context.recentTask) {
    hints.push(`최근 작업: ${context.recentTask}`);
  }

  if (hints.length === 0) return '';

  return language === 'ko'
    ? `## 사용자 컨텍스트\n${hints.join('\n')}\n\n이 컨텍스트를 활용하여 더 구체적인 프롬프트를 생성하세요.`
    : `## User Context\n${hints.join('\n')}\n\nUse this context to generate more specific prompts.`;
}

/**
 * Claude 응답에서 텍스트 추출 및 정리
 * - 불필요한 도입부/설명 텍스트 제거
 * - 프롬프트 내용만 추출
 */
function extractTextFromResponse(response: Anthropic.Message): string {
  for (const block of response.content) {
    if (block.type === 'text') {
      let text = block.text.trim();

      // 불필요한 도입부 패턴 제거
      const prefixPatterns = [
        /^(다음과 같이|아래와 같이)\s*(프롬프트를\s*)?(개선|수정|작성)했습니다[.:!]?\s*/i,
        /^(개선된|수정된|작성된)\s*프롬프트[.:!]?\s*/i,
        /^프롬프트(를\s*)?(개선|수정)했습니다[.:!]?\s*/i,
        /^(Here'?s?\s*)?the\s*(improved|enhanced|revised)\s*prompt[.:!]?\s*/i,
        /^(Improved|Enhanced|Revised)\s*prompt[.:!]?\s*/i,
        /^---+\s*/,  // 구분선
        /^\*\*개선된\s*프롬프트\*\*[.:!]?\s*/i,
      ];

      for (const pattern of prefixPatterns) {
        text = text.replace(pattern, '');
      }

      // 마지막 구분선 이후만 추출 (구분선이 있는 경우)
      const lastDivider = text.lastIndexOf('---');
      if (lastDivider > 0 && lastDivider < text.length - 10) {
        const afterDivider = text.slice(lastDivider + 3).trim();
        if (afterDivider.length > 20) {
          text = afterDivider;
        }
      }

      return text.trim();
    }
  }
  return '';
}

/**
 * 언어 감지
 */
function detectLanguage(text: string): 'ko' | 'en' {
  const koreanPattern = /[\uac00-\ud7af]/;
  return koreanPattern.test(text) ? 'ko' : 'en';
}

/**
 * 변경 사항 분석
 */
function analyzeChanges(
  original: string,
  improved: string,
  language: 'ko' | 'en'
): string[] {
  const changes: string[] = [];
  const originalScore = calculateGOLDENScore(original);
  const improvedScore = calculateGOLDENScore(improved);

  const dimensions = {
    goal: language === 'ko' ? '목표 명확화' : 'Goal clarification',
    output: language === 'ko' ? '출력 형식 추가' : 'Output format added',
    limits: language === 'ko' ? '제약조건 명시' : 'Constraints specified',
    data: language === 'ko' ? '컨텍스트 추가' : 'Context added',
    evaluation: language === 'ko' ? '평가 기준 추가' : 'Evaluation criteria added',
    next: language === 'ko' ? '다음 단계 명시' : 'Next steps specified',
  };

  for (const [key, label] of Object.entries(dimensions)) {
    const dim = key as keyof typeof dimensions;
    if (improvedScore[dim] > originalScore[dim] + 0.2) {
      changes.push(label);
    }
  }

  // 길이 증가
  if (improved.length > original.length * 1.5) {
    changes.push(language === 'ko' ? '상세 내용 추가' : 'Details added');
  }

  // 구조화
  if (/^[-*\d]+\./m.test(improved) && !/^[-*\d]+\./m.test(original)) {
    changes.push(language === 'ko' ? '구조화된 형식' : 'Structured format');
  }

  return changes.slice(0, 5);
}

/**
 * 다중 프롬프트 일괄 개선
 */
export async function improvePrompts(
  prompts: string[],
  context?: ImprovementContext,
  options?: LLMImproverOptions
): Promise<ImprovedPrompt[]> {
  const results: ImprovedPrompt[] = [];

  for (const prompt of prompts) {
    const result = await improvePrompt(prompt, context, options);
    if (result) {
      results.push(result);
    }
    // Rate limit 방지
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * API 키 유효성 검사
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'test' }],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 오프라인 폴백 (API 없이 규칙 기반 개선)
 * - GOLDEN 6개 차원 구조로 완전한 프롬프트 생성
 * - LLM 버전과 유사한 품질 목표
 */
export function improvePromptOffline(
  originalPrompt: string,
  context?: ImprovementContext
): ImprovedPrompt {
  const originalScore = calculateGOLDENScore(originalPrompt);
  const classification = classifyPrompt(originalPrompt);
  const language = detectLanguage(originalPrompt);
  const keyChanges: string[] = [];

  // 카테고리별 기본 템플릿
  const categoryTemplates = getCategoryTemplates(classification.taskCategory, language);

  // 기술 스택 추론
  const techStack = context?.techStack?.join(', ') || inferTechStack(originalPrompt, language);

  // GOLDEN 6개 차원 구조로 프롬프트 생성
  const sections: string[] = [];

  // G - Goal (목표)
  const goalText = language === 'ko'
    ? `목표: ${extractGoal(originalPrompt, classification, language)}`
    : `Goal: ${extractGoal(originalPrompt, classification, language)}`;
  sections.push(goalText);
  if (originalScore.goal < 0.5) keyChanges.push(language === 'ko' ? '목표 명확화' : 'Goal clarification');

  // O - Output (출력 형식)
  const outputText = language === 'ko'
    ? `출력 형식: ${categoryTemplates.output}`
    : `Output: ${categoryTemplates.output}`;
  sections.push(outputText);
  if (originalScore.output < 0.5) keyChanges.push(language === 'ko' ? '출력 형식 추가' : 'Output format added');

  // L - Limits (제약조건)
  const limitsText = language === 'ko'
    ? `제약사항:\n${categoryTemplates.limits.map(l => `- ${l}`).join('\n')}`
    : `Constraints:\n${categoryTemplates.limits.map(l => `- ${l}`).join('\n')}`;
  sections.push(limitsText);
  if (originalScore.limits < 0.5) keyChanges.push(language === 'ko' ? '제약조건 명시' : 'Constraints specified');

  // D - Data (데이터/컨텍스트)
  const dataText = language === 'ko'
    ? `현재 환경:\n- 기술 스택: ${techStack}\n- 프로젝트 유형: ${context?.projectType || categoryTemplates.projectType}`
    : `Environment:\n- Tech stack: ${techStack}\n- Project type: ${context?.projectType || categoryTemplates.projectType}`;
  sections.push(dataText);
  if (originalScore.data < 0.5) keyChanges.push(language === 'ko' ? '컨텍스트 추가' : 'Context added');

  // E - Evaluation (평가 기준)
  const evalText = language === 'ko'
    ? `성공 기준:\n${categoryTemplates.evaluation.map(e => `- ${e}`).join('\n')}`
    : `Success Criteria:\n${categoryTemplates.evaluation.map(e => `- ${e}`).join('\n')}`;
  sections.push(evalText);
  if (originalScore.evaluation < 0.5) keyChanges.push(language === 'ko' ? '평가 기준 추가' : 'Evaluation criteria added');

  // N - Next (다음 단계)
  const nextText = language === 'ko'
    ? `완료 후: ${categoryTemplates.next}`
    : `Next steps: ${categoryTemplates.next}`;
  sections.push(nextText);
  if (originalScore.next < 0.5) keyChanges.push(language === 'ko' ? '다음 단계 명시' : 'Next steps specified');

  const improved = sections.join('\n\n');
  const improvedScore = calculateGOLDENScore(improved);
  const improvementPercent = Math.round(
    ((improvedScore.total - originalScore.total) / Math.max(originalScore.total, 0.01)) * 100
  );

  return {
    original: originalPrompt,
    improved,
    originalScore,
    improvedScore,
    improvementPercent,
    classification,
    keyChanges,
    confidence: 0.7, // 구조화된 오프라인 모드는 더 높은 신뢰도
    variant: 'balanced',
  };
}

/**
 * 원본 프롬프트에서 목표 추출
 */
function extractGoal(prompt: string, classification: PromptClassification, language: 'ko' | 'en'): string {
  // 원본에서 핵심 동사/목적어 추출
  const actionMatch = prompt.match(/(.+?)(해줘|해주세요|만들어|작성해|구현해|개발해|설계해)/);
  if (actionMatch) {
    const target = actionMatch[1].trim();
    const action = actionMatch[2];
    return language === 'ko'
      ? `${target}을(를) ${action.replace('해줘', '구현해 주세요').replace('해주세요', '구현해 주세요')}`
      : `Implement ${target}`;
  }

  // 영어 패턴
  const engMatch = prompt.match(/(create|make|build|implement|develop|design|write)\s+(.+)/i);
  if (engMatch) {
    return `${engMatch[1]} ${engMatch[2]}`;
  }

  // 폴백: 분류 기반
  const categoryGoals: Record<string, { ko: string; en: string }> = {
    'code-generation': { ko: '요청된 코드를 구현해 주세요', en: 'Implement the requested code' },
    'bug-fix': { ko: '버그를 분석하고 수정해 주세요', en: 'Analyze and fix the bug' },
    'refactoring': { ko: '코드를 리팩토링해 주세요', en: 'Refactor the code' },
    'explanation': { ko: '코드를 상세히 설명해 주세요', en: 'Explain the code in detail' },
    'documentation': { ko: '문서를 작성해 주세요', en: 'Write the documentation' },
    'architecture': { ko: '시스템을 설계해 주세요', en: 'Design the system' },
  };

  return categoryGoals[classification.taskCategory]?.[language] ||
    (language === 'ko' ? '요청사항을 처리해 주세요' : 'Process the request');
}

/**
 * 카테고리별 템플릿 반환
 */
interface CategoryTemplate {
  output: string;
  limits: string[];
  projectType: string;
  evaluation: string[];
  next: string;
}

function getCategoryTemplates(category: string, language: 'ko' | 'en'): CategoryTemplate {
  const templates: Record<string, { ko: CategoryTemplate; en: CategoryTemplate }> = {
    'code-generation': {
      ko: {
        output: 'TypeScript 코드와 사용법 예시',
        limits: ['타입 안전성 보장', '에러 처리 포함', '주석으로 핵심 로직 설명'],
        projectType: '웹 애플리케이션',
        evaluation: ['코드가 컴파일되고 실행됨', '예상대로 동작함', '에러 처리가 적절함'],
        next: '테스트 코드 작성 및 통합',
      },
      en: {
        output: 'TypeScript code with usage examples',
        limits: ['Ensure type safety', 'Include error handling', 'Add comments for key logic'],
        projectType: 'Web application',
        evaluation: ['Code compiles and runs', 'Works as expected', 'Error handling is appropriate'],
        next: 'Write tests and integrate',
      },
    },
    'bug-fix': {
      ko: {
        output: '수정된 코드와 버그 원인 설명',
        limits: ['기존 기능 유지', '최소한의 변경', '회귀 버그 방지'],
        projectType: '기존 프로젝트',
        evaluation: ['버그가 해결됨', '다른 기능에 영향 없음', '테스트 통과'],
        next: '관련 테스트 케이스 추가',
      },
      en: {
        output: 'Fixed code with bug cause explanation',
        limits: ['Maintain existing functionality', 'Minimal changes', 'Prevent regression'],
        projectType: 'Existing project',
        evaluation: ['Bug is resolved', 'No impact on other features', 'Tests pass'],
        next: 'Add related test cases',
      },
    },
    'refactoring': {
      ko: {
        output: '리팩토링된 코드와 변경 사항 설명',
        limits: ['기능 동작 유지', 'SOLID 원칙 적용', '가독성 향상'],
        projectType: '레거시 코드베이스',
        evaluation: ['기존 테스트 통과', '코드 복잡도 감소', '유지보수성 향상'],
        next: '코드 리뷰 요청',
      },
      en: {
        output: 'Refactored code with change explanation',
        limits: ['Maintain functionality', 'Apply SOLID principles', 'Improve readability'],
        projectType: 'Legacy codebase',
        evaluation: ['Existing tests pass', 'Reduced complexity', 'Improved maintainability'],
        next: 'Request code review',
      },
    },
    'explanation': {
      ko: {
        output: '단계별 설명과 다이어그램 (필요시)',
        limits: ['초보자도 이해 가능한 수준', '핵심 개념 강조', '예시 포함'],
        projectType: '학습/문서화',
        evaluation: ['모든 주요 개념 설명됨', '예시가 명확함', '질문에 답변됨'],
        next: '추가 질문이나 심화 학습',
      },
      en: {
        output: 'Step-by-step explanation with diagrams if needed',
        limits: ['Beginner-friendly', 'Highlight key concepts', 'Include examples'],
        projectType: 'Learning/Documentation',
        evaluation: ['All key concepts explained', 'Examples are clear', 'Questions answered'],
        next: 'Follow-up questions or deeper learning',
      },
    },
    'documentation': {
      ko: {
        output: '마크다운 형식 문서',
        limits: ['명확한 구조', '예제 코드 포함', 'API 명세 (해당시)'],
        projectType: '오픈소스/팀 프로젝트',
        evaluation: ['모든 기능 문서화됨', '예제가 작동함', '형식이 일관됨'],
        next: 'README에 링크 추가',
      },
      en: {
        output: 'Markdown formatted documentation',
        limits: ['Clear structure', 'Include code examples', 'API specs if applicable'],
        projectType: 'Open source/Team project',
        evaluation: ['All features documented', 'Examples work', 'Consistent format'],
        next: 'Add links to README',
      },
    },
    'architecture': {
      ko: {
        output: '시스템 설계 문서와 다이어그램',
        limits: ['확장성 고려', '보안 고려', '비용 효율성'],
        projectType: '신규 시스템',
        evaluation: ['요구사항 충족', '확장 가능', '보안 취약점 없음'],
        next: '기술 검토 회의',
      },
      en: {
        output: 'System design document with diagrams',
        limits: ['Consider scalability', 'Consider security', 'Cost efficiency'],
        projectType: 'New system',
        evaluation: ['Requirements met', 'Scalable', 'No security vulnerabilities'],
        next: 'Technical review meeting',
      },
    },
  };

  const defaultTemplate = {
    ko: {
      output: '요청에 맞는 결과물',
      limits: ['명확한 구조', '실용적 접근', '품질 보장'],
      projectType: '일반 프로젝트',
      evaluation: ['요구사항 충족', '품질 기준 통과', '사용 가능한 상태'],
      next: '결과물 검토 및 피드백',
    },
    en: {
      output: 'Result matching the request',
      limits: ['Clear structure', 'Practical approach', 'Quality assurance'],
      projectType: 'General project',
      evaluation: ['Requirements met', 'Quality standards passed', 'Ready to use'],
      next: 'Review and feedback',
    },
  };

  return templates[category]?.[language] || defaultTemplate[language];
}

/**
 * 프롬프트에서 기술 스택 추론
 */
function inferTechStack(prompt: string, language: 'ko' | 'en'): string {
  const techPatterns: Array<{ pattern: RegExp; stack: string }> = [
    { pattern: /react/i, stack: 'React' },
    { pattern: /vue/i, stack: 'Vue.js' },
    { pattern: /angular/i, stack: 'Angular' },
    { pattern: /node/i, stack: 'Node.js' },
    { pattern: /python|파이썬/i, stack: 'Python' },
    { pattern: /java(?!script)/i, stack: 'Java' },
    { pattern: /typescript|ts/i, stack: 'TypeScript' },
    { pattern: /javascript|js/i, stack: 'JavaScript' },
    { pattern: /firebase/i, stack: 'Firebase' },
    { pattern: /api|rest|graphql/i, stack: 'REST API' },
  ];

  const detected: string[] = [];
  for (const { pattern, stack } of techPatterns) {
    if (pattern.test(prompt)) {
      detected.push(stack);
    }
  }

  if (detected.length > 0) {
    return detected.join(', ');
  }

  return language === 'ko' ? 'TypeScript, Node.js' : 'TypeScript, Node.js';
}
