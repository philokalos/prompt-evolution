/**
 * Variant generation: COSP, conservative, balanced, comprehensive, and AI-powered rewrites
 */

import type { SessionContext } from '../session-context.js';
import {
  rewritePromptWithClaude,
  rewritePromptWithMultiVariant,
  type RewriteRequest,
  type RewriteResult as _AIRewriteResult,
} from '../claude-api.js';
import {
  type ProviderConfig,
  type RewriteRequest as ProviderRewriteRequest,
  rewriteWithFallback,
  hasAnyProvider,
} from '../providers/index.js';
import type {
  ConfidenceFactors,
  GuidelineEvaluation,
  GOLDENEvaluator,
  RewriteResult,
} from './types.js';
import {
  calculateCalibratedConfidence,
  calculateAntiPatternFreeScore,
  calculateContextRichness,
  countImprovedDimensions,
} from './confidence.js';
import {
  buildMinimalContext,
  detectCategory,
  detectComplexity,
  detectPrimaryVerb,
  extractCodeFromPrompt,
  extractCoreRequest,
  getCategoryLabel,
  getSuccessCriteria,
  getTechStackConstraints,
  inferOutputFormat,
  selectThinkMode,
} from './text-analysis.js';
import {
  buildContextSection,
  buildDataSection,
  buildLimitsSection,
  buildOutputSection,
  buildXMLPrompt,
  CATEGORY_TEMPLATES,
  createTemplateContext,
  generateFromTemplate,
} from './templates.js';

// ─────────────────────────────────────────────────────────────────────────────
// COSP (Claude-Optimized Smart Prompt) 생성
// ─────────────────────────────────────────────────────────────────────────────

/**
 * COSP (Claude-Optimized Smart Prompt) 생성
 * 카테고리별 템플릿 시스템 + XML 구조 + Think mode 자동 삽입
 */
export function generateCOSPRewrite(
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
// 보수적 리라이트 - 가장 약한 차원 1개만 개선 (항상 의미 있는 변경)
// ─────────────────────────────────────────────────────────────────────────────

export function _generateConservativeRewrite(
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

export function _generateBalancedRewrite(
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

// ─────────────────────────────────────────────────────────────────────────────
// 적극적 리라이트 - 완전한 GOLDEN 구조 (원본에서 콘텐츠 추출)
// ─────────────────────────────────────────────────────────────────────────────

export function _generateComprehensiveRewrite(
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

// ─────────────────────────────────────────────────────────────────────────────
// AI-powered rewrites
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AI-powered prompt rewriting using Claude API
 * v2: Multi-variant generation with GOLDEN evaluation -> best score selection
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
 * Create a placeholder AI variant for error cases
 */
export function createAIPlaceholder(): RewriteResult {
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

// ─────────────────────────────────────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * COSP 변형 생성 (메인 함수)
 * 기존 3가지 변형 -> 1개의 COSP 변형으로 통합
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
