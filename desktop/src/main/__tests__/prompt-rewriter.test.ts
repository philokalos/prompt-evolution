/**
 * Prompt Rewriter Unit Tests
 *
 * Tests for the COSP (Claude-Optimized Smart Prompt) rewriting engine.
 * Tests cover:
 * - COSP generation with XML structure
 * - Think mode selection based on complexity
 * - Context integration (SessionContext)
 * - Edge cases (empty prompts, high-scoring prompts, etc.)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generatePromptVariants,
  generateAllVariants,
  generateAIRewrite,
  type RewriteResult as _RewriteResult,
} from '../prompt-rewriter.js';

import { rewritePromptWithClaude, rewritePromptWithMultiVariant } from '../claude-api.js';

// Mock claude-api module to avoid actual API calls
vi.mock('../claude-api.js', () => ({
  rewritePromptWithClaude: vi.fn(),
  rewritePromptWithMultiVariant: vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createMockEvaluation(overrides: Partial<{
  overallScore: number;
  goal: number;
  output: number;
  limits: number;
  data: number;
  evaluation: number;
  next: number;
}> = {}) {
  const goldenScore = {
    goal: overrides.goal ?? 0.3,
    output: overrides.output ?? 0.3,
    limits: overrides.limits ?? 0.3,
    data: overrides.data ?? 0.3,
    evaluation: overrides.evaluation ?? 0.3,
    next: overrides.next ?? 0.3,
    total: 0,
  };
  goldenScore.total = Object.values(goldenScore).reduce((a, b) => a + b, 0) / 6;

  // Calculate overallScore from dimensions if not provided
  // Default to 0.30 (30%, low) to ensure variants are generated
  // Note: overallScore is expected as decimal (0.85 = 85%)
  const calculatedScore = overrides.overallScore ?? 0.30;

  return {
    overallScore: calculatedScore,
    guidelineScores: [
      {
        guideline: 'goal',
        name: 'Goal',
        description: 'Clear goal',
        score: goldenScore.goal,
        weight: 1,
        evidence: [],
        suggestion: 'Add clear goal',
      },
    ],
    goldenScore,
    recommendations: [],
    grade: (calculatedScore >= 0.80 ? 'A' : calculatedScore >= 0.60 ? 'B' : calculatedScore >= 0.40 ? 'C' : 'D') as 'A' | 'B' | 'C' | 'D' | 'F',
  };
}

function createMockSessionContext(overrides: Partial<{
  projectPath: string;
  projectId: string;
  sessionId: string;
  techStack: string[];
  currentTask: string;
  recentFiles: string[];
  recentTools: string[];
  gitBranch: string;
  lastActivity: Date;
  lastExchange: {
    userMessage: string;
    assistantSummary: string;
    assistantTools: string[];
    assistantFiles: string[];
    timestamp: Date;
  };
}> = {}) {
  return {
    projectPath: overrides.projectPath ?? '/Users/test/my-project',
    projectId: overrides.projectId ?? '-Users-test-my-project',
    sessionId: overrides.sessionId ?? 'test-session-123',
    techStack: overrides.techStack ?? ['TypeScript', 'React', 'Vite'],
    currentTask: overrides.currentTask ?? 'Implementing user authentication',
    recentFiles: overrides.recentFiles ?? ['src/auth.ts', 'src/hooks/useAuth.ts'],
    recentTools: overrides.recentTools ?? ['Read', 'Edit'],
    gitBranch: overrides.gitBranch ?? 'feature/auth',
    lastActivity: overrides.lastActivity ?? new Date(),
    lastExchange: overrides.lastExchange
      ? { ...overrides.lastExchange, timestamp: overrides.lastExchange.timestamp ?? new Date() }
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COSP XML Structure Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Prompt Rewriter', () => {
  describe('COSP XML Structure', () => {
    it('should generate XML tags in COSP output', () => {
      const prompt = '버튼 컴포넌트를 만들어줘';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);

      // COSP variant should include XML tags
      const cosp = variants.find(v => v.variant === 'cosp');
      expect(cosp?.rewrittenPrompt).toContain('<task>');
      expect(cosp?.rewrittenPrompt).toContain('</task>');
    });

    it('should include constraints section for code-generation', () => {
      const prompt = '이 버그를 수정해줘: Cannot read property of undefined';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);

      const cosp = variants.find(v => v.variant === 'cosp');
      expect(cosp?.rewrittenPrompt).toContain('<constraints>');
    });

    it('should include output_format when output score is low', () => {
      const prompt = '이 코드를 리팩토링해주세요';
      const evaluation = createMockEvaluation({ output: 0.2 });
      const variants = generatePromptVariants(prompt, evaluation);

      const cosp = variants.find(v => v.variant === 'cosp');
      expect(cosp?.rewrittenPrompt).toContain('<output_format>');
    });

    it('should include success_criteria when evaluation score is low', () => {
      // Use bug-fix category which has success_criteria in its template
      const prompt = '이 에러를 수정해줘';
      const evaluation = createMockEvaluation({ evaluation: 0.2 });
      const variants = generatePromptVariants(prompt, evaluation);

      const cosp = variants.find(v => v.variant === 'cosp');
      expect(cosp?.rewrittenPrompt).toContain('<success_criteria>');
    });

    it('should include context section with session context', () => {
      const prompt = '이 모듈의 테스트 코드를 작성해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext();
      const variants = generatePromptVariants(prompt, evaluation, context);

      const cosp = variants.find(v => v.variant === 'cosp');
      expect(cosp?.rewrittenPrompt).toContain('<context>');
      expect(cosp?.rewrittenPrompt).toContain('my-project');
    });

    it('should include tech stack constraints with context', () => {
      const prompt = '이 PR을 리뷰해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({ techStack: ['TypeScript', 'React'] });
      const variants = generatePromptVariants(prompt, evaluation, context);

      const cosp = variants.find(v => v.variant === 'cosp');
      expect(cosp?.rewrittenPrompt).toContain('TypeScript');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // COSP Variant Generation Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('COSP Variant Generation', () => {
    it('should generate 1 COSP variant for low-scoring prompts', () => {
      const prompt = '버그 수정해줘';
      const evaluation = createMockEvaluation({ overallScore: 0.20 });
      const variants = generatePromptVariants(prompt, evaluation);

      expect(variants).toHaveLength(1);
      expect(variants[0].variant).toBe('cosp');
    });

    it('should preserve original for high-scoring prompts', () => {
      const prompt = '잘 작성된 프롬프트입니다';
      const evaluation = createMockEvaluation({
        overallScore: 0.90,
        goal: 0.9,
        output: 0.9,
        limits: 0.9,
        data: 0.9,
        evaluation: 0.9,
        next: 0.9,
      });
      const variants = generatePromptVariants(prompt, evaluation);

      const cosp = variants.find(v => v.variant === 'cosp');
      expect(cosp?.keyChanges).toContain('이미 잘 작성됨');
      expect(cosp?.rewrittenPrompt).toBe(prompt);
    });

    it('should include keyChanges describing improvements', () => {
      const prompt = '코드 만들어줘';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);

      variants.forEach(variant => {
        expect(variant.keyChanges).toBeDefined();
        expect(variant.keyChanges.length).toBeGreaterThan(0);
      });
    });

    it('should have high confidence for COSP variant', () => {
      const prompt = 'API 구현해줘';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);

      const cosp = variants.find(v => v.variant === 'cosp')!;
      // COSP should have confidence >= 0.9
      expect(cosp.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // COSP Weak Dimension Targeting Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('COSP Weak Dimension Targeting', () => {
    it('should add weak dimension info to keyChanges', () => {
      const prompt = '코드 작성해줘';
      const evaluation = createMockEvaluation({
        goal: 0.1, // Weakest
        output: 0.5,
        limits: 0.5,
        data: 0.5,
        evaluation: 0.5,
        next: 0.5,
      });
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      // With template system, categories with templates get template label instead of weak dimension info
      // The template itself addresses weak dimensions structurally
      expect(cosp.keyChanges).toContain('코드 생성 템플릿');
    });

    it('should add output_format XML tag when output is weakest', () => {
      const prompt = '함수 만들어줘';
      const evaluation = createMockEvaluation({
        goal: 0.8,
        output: 0.1, // Weakest
        limits: 0.5,
        data: 0.5,
        evaluation: 0.5,
        next: 0.5,
      });
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      expect(cosp.rewrittenPrompt).toContain('<output_format>');
      expect(cosp.rewrittenPrompt).toContain('</output_format>');
    });

    it('should have confidence >= 0.9 for COSP', () => {
      const prompt = '테스트 작성';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      expect(cosp.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // COSP Context Integration Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('COSP Context Integration', () => {
    it('should include context XML section with session context', () => {
      const prompt = '인증 기능 구현해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext();
      const variants = generatePromptVariants(prompt, evaluation, context);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      expect(cosp.rewrittenPrompt).toContain('<context>');
      expect(cosp.rewrittenPrompt).toContain('my-project');
    });

    it('should include tech stack in context', () => {
      const prompt = 'API 만들어줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        techStack: ['Node.js', 'Express', 'MongoDB'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const balanced = variants.find(v => v.variant === 'cosp')!;

      expect(balanced.rewrittenPrompt).toContain('Node.js');
    });

    it('should have higher confidence with context', () => {
      const prompt = '컴포넌트 만들어줘';
      const evaluationNoContext = createMockEvaluation();
      const variantsNoContext = generatePromptVariants(prompt, evaluationNoContext);
      const balancedNoContext = variantsNoContext.find(v => v.variant === 'cosp')!;

      const evaluationWithContext = createMockEvaluation();
      const context = createMockSessionContext();
      const variantsWithContext = generatePromptVariants(prompt, evaluationWithContext, context);
      const balancedWithContext = variantsWithContext.find(v => v.variant === 'cosp')!;

      expect(balancedWithContext.confidence).toBeGreaterThan(balancedNoContext.confidence);
    });

    it('should include lastExchange context when available', () => {
      const prompt = '다음 단계 진행해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        lastExchange: {
          userMessage: '이전 요청',
          assistantSummary: 'auth.ts 파일을 수정했습니다',
          assistantTools: ['Edit'],
          assistantFiles: ['src/auth.ts'],
          timestamp: new Date(),
        },
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const balanced = variants.find(v => v.variant === 'cosp')!;

      expect(balanced.rewrittenPrompt).toContain('방금 수정');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // COSP XML Structure Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('COSP Full XML Structure', () => {
    it('should include task XML section', () => {
      const prompt = 'React 컴포넌트 만들어줘';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      // Should have task XML section
      expect(cosp.rewrittenPrompt).toContain('<task>');
      expect(cosp.rewrittenPrompt).toContain('</task>');
    });

    it('should include constraints XML with context', () => {
      const prompt = '폼 컴포넌트 구현해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        techStack: ['TypeScript', 'React'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      expect(cosp.rewrittenPrompt).toContain('<constraints>');
      expect(cosp.keyChanges).toContain('기술 스택 반영');
    });

    it('should have highest confidence with context', () => {
      const prompt = 'API 구현해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext();
      const variants = generatePromptVariants(prompt, evaluation, context);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      expect(cosp.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('should extract and structure code blocks with reference_code XML', () => {
      // Refactoring template uses <current_code> tag for the code block
      const prompt = '이 코드를 개선해줘:\n```typescript\nconst x = 1;\n```';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      // Template system uses <current_code> for refactoring category
      expect(cosp.rewrittenPrompt).toContain('<current_code>');
    });

    it('should extract error messages', () => {
      const prompt = '에러 수정해줘: TypeError: Cannot read property of undefined';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      expect(cosp.rewrittenPrompt).toContain('TypeError');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Text Cleaning Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Text Cleaning', () => {
    it('should remove greeting prefixes', () => {
      const prompt = '안녕하세요, 버튼 컴포넌트 만들어주세요';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);
      const conservative = variants.find(v => v.variant === 'cosp')!;

      expect(conservative.rewrittenPrompt).not.toMatch(/^안녕하세요/);
    });

    it('should remove filler words', () => {
      const prompt = '그래서 API 구현해줘';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);
      const conservative = variants.find(v => v.variant === 'cosp')!;

      expect(conservative.rewrittenPrompt).not.toMatch(/^그래서/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Verb Detection Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Verb Detection', () => {
    it('should preserve original prompt in task section', () => {
      const prompt = '새 컴포넌트 만들어줘';
      const evaluation = createMockEvaluation({ goal: 0.1 }); // Make goal weakest
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      expect(cosp.rewrittenPrompt).toContain('컴포넌트');
      expect(cosp.rewrittenPrompt).toContain('<task>');
    });

    it('should detect fix verbs', () => {
      const prompt = '버그 고쳐줘';
      const evaluation = createMockEvaluation({ goal: 0.1 });
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      // Should contain the original bug-fix request
      expect(cosp.rewrittenPrompt).toContain('버그');
    });

    it('should detect explanation verbs', () => {
      const prompt = '이 코드가 왜 안 되는지 설명해줘';
      const evaluation = createMockEvaluation({ goal: 0.1 });
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      expect(cosp.rewrittenPrompt).toContain('설명');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Tech Stack Constraints Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Tech Stack Constraints', () => {
    it('should add TypeScript constraints', () => {
      const prompt = '유틸 함수 만들어줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        techStack: ['TypeScript'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toMatch(/타입|strict/);
    });

    it('should add React constraints', () => {
      const prompt = '컴포넌트 만들어줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        techStack: ['React'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toMatch(/함수형|hooks/);
    });

    it('should add Firebase constraints', () => {
      const prompt = 'DB 쿼리 작성해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        techStack: ['Firebase'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toMatch(/보안|비용/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Output Format Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Output Format Inference', () => {
    it('should suggest code output for code-generation', () => {
      const prompt = 'React 훅 만들어줘';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toMatch(/구현|코드/);
    });

    it('should suggest analysis output for bug-fix', () => {
      const prompt = '에러 수정해줘';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toMatch(/원인|분석/);
    });

    it('should include type definitions for TypeScript projects', () => {
      const prompt = '유틸 함수 만들어줘';
      const evaluation = createMockEvaluation({ output: 0.1 }); // Make output weakest
      const context = createMockSessionContext({
        techStack: ['TypeScript'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const balanced = variants.find(v => v.variant === 'cosp')!;

      expect(balanced.rewrittenPrompt).toContain('타입');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Success Criteria Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Success Criteria', () => {
    it('should include success_criteria XML when evaluation score is low', () => {
      // Bug-fix template includes success_criteria section
      const prompt = '버그 수정해줘';
      const evaluation = createMockEvaluation({ evaluation: 0.2 }); // Low evaluation score
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      expect(cosp.rewrittenPrompt).toContain('<success_criteria>');
    });

    it('should include test-passing criteria for bug-fix', () => {
      const prompt = '버그 수정해줘';
      const evaluation = createMockEvaluation({ evaluation: 0.2 });
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      expect(cosp.rewrittenPrompt).toMatch(/해결|테스트/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle empty prompt', () => {
      const prompt = '';
      const evaluation = createMockEvaluation();

      expect(() => generatePromptVariants(prompt, evaluation)).not.toThrow();
      const variants = generatePromptVariants(prompt, evaluation);
      expect(variants).toHaveLength(1);
    });

    it('should handle very short prompt', () => {
      const prompt = '해줘';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);

      expect(variants).toHaveLength(1);
      variants.forEach(v => {
        expect(v.rewrittenPrompt).toBeDefined();
      });
    });

    it('should handle prompt with only code block', () => {
      const prompt = '```\nconst x = 1;\n```';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);

      expect(variants).toHaveLength(1);
    });

    it('should handle prompt with special characters', () => {
      const prompt = '이 코드에서 <T>를 수정해줘 @deprecated 제거';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);

      expect(variants).toHaveLength(1);
    });

    it('should handle undefined context gracefully', () => {
      const prompt = 'API 구현해줘';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation, undefined);

      expect(variants).toHaveLength(1);
    });

    it('should handle empty tech stack', () => {
      const prompt = '함수 만들어줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        techStack: [],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);

      expect(variants).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // generateAllVariants Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('generateAllVariants', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return 4 variants with AI placeholder when no API key', async () => {
      const prompt = '컴포넌트 만들어줘';
      const evaluation = createMockEvaluation();
      const variants = await generateAllVariants(prompt, evaluation);

      expect(variants).toHaveLength(2);
      expect(variants[0].variant).toBe('ai');
      expect(variants[0].needsSetup).toBe(true);
      expect(variants[0].isAiGenerated).toBe(false);
    });

    it('should return 4 variants with AI placeholder when API key is empty', async () => {
      const prompt = '컴포넌트 만들어줘';
      const evaluation = createMockEvaluation();
      const variants = await generateAllVariants(prompt, evaluation, undefined, '');

      expect(variants).toHaveLength(2);
      expect(variants[0].variant).toBe('ai');
      expect(variants[0].needsSetup).toBe(true);
    });

    it('should include session context in all variants', async () => {
      const prompt = 'API 구현해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext();
      const variants = await generateAllVariants(prompt, evaluation, context);

      // Skip AI placeholder, check rule-based variants
      const ruleBasedVariants = variants.filter(v => v.variant !== 'ai');
      const balanced = ruleBasedVariants.find(v => v.variant === 'cosp');

      expect(balanced?.rewrittenPrompt).toContain('my-project');
    });

    it('should have correct variant order', async () => {
      const prompt = '함수 만들어줘';
      const evaluation = createMockEvaluation();
      const variants = await generateAllVariants(prompt, evaluation);

      expect(variants.map(v => v.variant)).toEqual([
        'ai',
        'cosp',
      ]);
    });

    it('should have correct variant labels', async () => {
      const prompt = '코드 작성해줘';
      const evaluation = createMockEvaluation();
      const variants = await generateAllVariants(prompt, evaluation);

      expect(variants.map(v => v.variantLabel)).toEqual([
        'AI 추천',
        'COSP',
      ]);
    });

    it('should add placeholder when AI returns null', async () => {
      const prompt = '컴포넌트 만들어줘';
      const evaluation = createMockEvaluation();

      // Mock AI returning null (failure case)
      vi.mocked(rewritePromptWithClaude).mockResolvedValue({
        success: false,
        error: 'API error',
      });

      const variants = await generateAllVariants(prompt, evaluation, undefined, 'test-api-key');

      expect(variants).toHaveLength(2);
      expect(variants[0].variant).toBe('ai');
      expect(variants[0].needsSetup).toBe(true);
      expect(variants[0].isAiGenerated).toBe(false);
    });

    it('should add placeholder when AI throws error', async () => {
      const prompt = '기능 구현해줘';
      const evaluation = createMockEvaluation();

      // Mock AI throwing error
      vi.mocked(rewritePromptWithClaude).mockRejectedValue(new Error('Network error'));

      const variants = await generateAllVariants(prompt, evaluation, undefined, 'test-api-key');

      expect(variants).toHaveLength(2);
      expect(variants[0].variant).toBe('ai');
      expect(variants[0].needsSetup).toBe(true);
    });

    it('should include AI variant when API call succeeds', async () => {
      const prompt = 'API 구현해줘';
      const evaluation = createMockEvaluation();

      // Mock successful AI response
      vi.mocked(rewritePromptWithClaude).mockResolvedValue({
        success: true,
        rewrittenPrompt: '개선된 프롬프트',
        improvements: ['목표 명확화', '출력 형식 추가'],
        explanation: 'AI가 프롬프트를 개선했습니다',
      });

      const variants = await generateAllVariants(prompt, evaluation, undefined, 'test-api-key');

      expect(variants).toHaveLength(2);
      expect(variants[0].variant).toBe('ai');
      expect(variants[0].isAiGenerated).toBe(true);
      expect(variants[0].rewrittenPrompt).toBe('개선된 프롬프트');
      expect(variants[0].aiExplanation).toBe('AI가 프롬프트를 개선했습니다');
    });

    it('should use multi-variant when GOLDEN evaluator is provided', async () => {
      const prompt = '함수 만들어줘';
      const evaluation = createMockEvaluation();
      const mockEvaluator = vi.fn().mockReturnValue({
        total: 0.7,
        goal: 0.7,
        output: 0.7,
        limits: 0.7,
        data: 0.7,
        evaluation: 0.7,
        next: 0.7,
      });

      vi.mocked(rewritePromptWithMultiVariant).mockResolvedValue({
        success: true,
        rewrittenPrompt: '멀티 변형 개선된 프롬프트',
        improvements: ['GOLDEN 평가 기반 개선'],
        explanation: '최적의 변형 선택됨',
        originalScore: 30,
        improvedScore: 75,
        improvementPercent: 150,
      });

      const variants = await generateAllVariants(prompt, evaluation, undefined, 'test-api-key', mockEvaluator);

      expect(variants).toHaveLength(2);
      expect(variants[0].isAiGenerated).toBe(true);
      expect(variants[0].keyChanges).toContain('GOLDEN 평가 기반 개선');
      expect(variants[0].keyChanges.some(c => c.includes('30%'))).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // generateAIRewrite Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('generateAIRewrite', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return null when API key is empty', async () => {
      const prompt = '컴포넌트 만들어줘';
      const evaluation = createMockEvaluation();

      const result = await generateAIRewrite('', prompt, evaluation);

      expect(result).toBeNull();
    });

    it('should return null when API key is whitespace only', async () => {
      const prompt = '함수 작성해줘';
      const evaluation = createMockEvaluation();

      const result = await generateAIRewrite('   ', prompt, evaluation);

      expect(result).toBeNull();
    });

    it('should return null when API call fails', async () => {
      const prompt = 'API 구현해줘';
      const evaluation = createMockEvaluation();

      vi.mocked(rewritePromptWithClaude).mockResolvedValue({
        success: false,
        error: 'Rate limit exceeded',
      });

      const result = await generateAIRewrite('test-api-key', prompt, evaluation);

      expect(result).toBeNull();
    });

    it('should return null when API throws error', async () => {
      const prompt = '기능 구현해줘';
      const evaluation = createMockEvaluation();

      vi.mocked(rewritePromptWithClaude).mockRejectedValue(new Error('Network error'));

      const result = await generateAIRewrite('test-api-key', prompt, evaluation);

      expect(result).toBeNull();
    });

    it('should include session context in API request', async () => {
      const prompt = '테스트 작성해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        lastExchange: {
          userMessage: '이전 요청',
          assistantSummary: '작업 완료',
          assistantTools: ['Edit'],
          assistantFiles: ['src/test.ts'],
          timestamp: new Date(),
        },
      });

      vi.mocked(rewritePromptWithClaude).mockResolvedValue({
        success: true,
        rewrittenPrompt: '개선된 테스트 프롬프트',
        improvements: ['컨텍스트 활용'],
      });

      await generateAIRewrite('test-api-key', prompt, evaluation, context);

      expect(rewritePromptWithClaude).toHaveBeenCalledWith(
        'test-api-key',
        expect.objectContaining({
          sessionContext: expect.objectContaining({
            projectPath: expect.any(String),
            techStack: expect.any(Array),
            lastExchange: expect.objectContaining({
              userMessage: '이전 요청',
              assistantSummary: '작업 완료',
            }),
          }),
        })
      );
    });

    it('should use multi-variant when GOLDEN evaluator is provided', async () => {
      const prompt = '컴포넌트 만들어줘';
      const evaluation = createMockEvaluation();
      const mockEvaluator = vi.fn();

      vi.mocked(rewritePromptWithMultiVariant).mockResolvedValue({
        success: true,
        rewrittenPrompt: '멀티 변형 프롬프트',
        improvements: ['개선'],
        originalScore: 30,
        improvedScore: 80,
        improvementPercent: 167,
      });

      const result = await generateAIRewrite('test-api-key', prompt, evaluation, undefined, mockEvaluator);

      expect(rewritePromptWithMultiVariant).toHaveBeenCalled();
      expect(result?.rewrittenPrompt).toBe('멀티 변형 프롬프트');
      expect(result?.keyChanges).toContain('개선');
    });

    it('should return null when multi-variant fails', async () => {
      const prompt = '함수 작성해줘';
      const evaluation = createMockEvaluation();
      const mockEvaluator = vi.fn();

      vi.mocked(rewritePromptWithMultiVariant).mockResolvedValue({
        success: false,
        error: 'Generation failed',
      });

      const result = await generateAIRewrite('test-api-key', prompt, evaluation, undefined, mockEvaluator);

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Korean/English Mixed Content Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Korean/English Mixed Content', () => {
    it('should handle English prompts', () => {
      const prompt = 'Create a React component with TypeScript';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);

      expect(variants).toHaveLength(1);
      // Should still apply improvements
      variants.forEach(v => {
        expect(v.keyChanges.length).toBeGreaterThan(0);
      });
    });

    it('should handle mixed Korean/English prompts', () => {
      const prompt = 'React useState를 사용해서 form state를 관리해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        techStack: ['React', 'TypeScript'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);

      expect(variants).toHaveLength(1);
      // Should detect React-related content
      const comprehensive = variants.find(v => v.variant === 'cosp');
      expect(comprehensive?.rewrittenPrompt).toContain('React');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // COSP Weak Dimension Indication Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('COSP Weak Dimension Indication', () => {
    it('should indicate context in keyChanges when session context is provided', () => {
      const prompt = '코드 작성해줘';
      const evaluation = createMockEvaluation({
        goal: 0.8,
        output: 0.8,
        limits: 0.8,
        data: 0.1, // Weakest
        evaluation: 0.8,
        next: 0.8,
      });
      const context = createMockSessionContext();
      const variants = generatePromptVariants(prompt, evaluation, context);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      // Template system uses template label; context is reflected in structure
      expect(cosp.keyChanges).toContain('코드 생성 템플릿');
      expect(cosp.rewrittenPrompt).toContain('<context>');
    });

    it('should not add reference code when data is weakest but code already in prompt', () => {
      // When code is already in the prompt, it's already included in rewritten,
      // so '참조 코드 정리' is not added (code is not duplicated)
      const prompt = '이 코드 `myFunction` 수정해줘';
      const evaluation = createMockEvaluation({
        goal: 0.8,
        output: 0.8,
        limits: 0.8,
        data: 0.1, // Weakest
        evaluation: 0.8,
        next: 0.8,
      });
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      // Code already in prompt, so no additional reference added
      expect(cosp.keyChanges).not.toContain('참조 코드 정리');
    });

    it('should include XML structure even without context', () => {
      const prompt = '이 함수 수정해줘'; // No inline code
      const evaluation = createMockEvaluation({
        goal: 0.8,
        output: 0.8,
        limits: 0.8,
        data: 0.1, // Weakest
        evaluation: 0.8,
        next: 0.8,
      });
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      // COSP always includes XML structure via template
      expect(cosp.rewrittenPrompt).toContain('<task>');
      // Template system uses template label instead of 'XML 구조화'
      expect(cosp.keyChanges).toContain('버그 수정 템플릿');
    });

    it('should add tech stack info to keyChanges when provided', () => {
      const prompt = '함수 만들어줘';
      const evaluation = createMockEvaluation({
        goal: 0.8,
        output: 0.8,
        limits: 0.1, // Weakest
        data: 0.8,
        evaluation: 0.8,
        next: 0.8,
      });
      const context = createMockSessionContext({
        techStack: ['TypeScript'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      expect(cosp.keyChanges).toContain('기술 스택 반영');
    });

    it('should include constraints section when limits score is low', () => {
      const prompt = '함수 만들어줘';
      const evaluation = createMockEvaluation({
        goal: 0.8,
        output: 0.8,
        limits: 0.1, // Weakest
        data: 0.8,
        evaluation: 0.8,
        next: 0.8,
      });
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      // COSP includes constraints for code-generation category
      expect(cosp.rewrittenPrompt).toContain('<constraints>');
    });

    it('should add success_criteria XML when evaluation is weakest', () => {
      // Bug-fix template includes success_criteria
      const prompt = '버그 수정해줘';
      const evaluation = createMockEvaluation({
        goal: 0.8,
        output: 0.8,
        limits: 0.8,
        data: 0.8,
        evaluation: 0.1, // Weakest
        next: 0.8,
      });
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      // Template system uses template label
      expect(cosp.keyChanges).toContain('버그 수정 템플릿');
      expect(cosp.rewrittenPrompt).toContain('<success_criteria>');
    });

    it('should indicate weak dimension in keyChanges when next is weakest', () => {
      const prompt = '컴포넌트 만들어줘';
      const evaluation = createMockEvaluation({
        goal: 0.8,
        output: 0.8,
        limits: 0.8,
        data: 0.8,
        evaluation: 0.8,
        next: 0.1, // Weakest
      });
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      // Template system uses template label; weak dimensions are addressed structurally
      expect(cosp.keyChanges).toContain('코드 생성 템플릿');
    });

    it('should indicate goal weakness in keyChanges', () => {
      const prompt = '버튼 컴포넌트를 구현해주세요';
      const evaluation = createMockEvaluation({
        goal: 0.1, // Weakest
        output: 0.8,
        limits: 0.8,
        data: 0.8,
        evaluation: 0.8,
        next: 0.8,
      });
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      // Template system uses template label; goal is addressed by task section
      expect(cosp.keyChanges).toContain('코드 생성 템플릿');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // LastExchange Context Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('LastExchange Context', () => {
    it('should include modified files in context when available', () => {
      const prompt = '다음 진행해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        lastExchange: {
          userMessage: '이전 요청',
          assistantSummary: '인증 시스템을 분석했습니다',
          assistantTools: ['Edit'],
          assistantFiles: ['src/auth.ts'], // Has modified files
          timestamp: new Date(),
        },
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      expect(cosp.rewrittenPrompt).toContain('방금 수정');
      expect(cosp.rewrittenPrompt).toContain('auth.ts');
    });

    it('should show multiple modified files', () => {
      const prompt = '계속해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        lastExchange: {
          userMessage: '이전',
          assistantSummary: '수정 완료',
          assistantTools: ['Edit'],
          assistantFiles: ['src/auth.ts', 'src/login.ts', 'src/utils.ts'],
          timestamp: new Date(),
        },
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const balanced = variants.find(v => v.variant === 'cosp')!;

      expect(balanced.rewrittenPrompt).toContain('auth.ts');
      expect(balanced.rewrittenPrompt).toContain('login.ts');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Code/Error Extraction Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Code and Error Extraction', () => {
    it('should extract inline code references', () => {
      const prompt = '`useState`와 `useEffect` 훅 사용법 설명해줘';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      // Should preserve the inline code references
      expect(comprehensive.rewrittenPrompt).toContain('useState');
    });

    it('should extract stack trace errors', () => {
      const prompt = '에러 수정해줘 at handleClick (Button.tsx:15:3)';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toContain('Button.tsx');
    });

    it('should handle SyntaxError messages', () => {
      const prompt = 'SyntaxError: Unexpected token 수정해줘';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toContain('SyntaxError');
    });

    it('should handle ReferenceError messages', () => {
      const prompt = 'ReferenceError: x is not defined 해결해줘';
      const evaluation = createMockEvaluation();
      const variants = generatePromptVariants(prompt, evaluation);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toContain('ReferenceError');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Tool-based Work Inference Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Tool-based Work Inference', () => {
    it('should recognize Write tool', () => {
      const prompt = '새 파일 만들어줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        recentTools: ['Write', 'Read'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);

      expect(variants).toHaveLength(1);
    });

    it('should recognize Grep tool', () => {
      const prompt = '관련 코드 찾아줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        recentTools: ['Grep'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);

      expect(variants).toHaveLength(1);
    });

    it('should recognize Bash tool', () => {
      const prompt = '테스트 실행해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        recentTools: ['Bash'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);

      expect(variants).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Additional Tech Stack Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Additional Tech Stack Constraints', () => {
    it('should add Vue constraints', () => {
      const prompt = '컴포넌트 만들어줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        techStack: ['Vue'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toContain('Composition API');
    });

    it('should add Next.js constraints', () => {
      const prompt = '페이지 만들어줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        techStack: ['Next.js'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toMatch(/App Router|SSR/);
    });

    it('should add Electron constraints', () => {
      const prompt = 'IPC 통신 구현해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        techStack: ['Electron'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toContain('main/renderer');
    });

    it('should add Node.js constraints', () => {
      const prompt = 'API 만들어줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        techStack: ['Node.js'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toContain('async/await');
    });

    it('should add Vite constraints', () => {
      const prompt = '빌드 설정해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        techStack: ['Vite'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toContain('HMR');
    });

    it('should add Tailwind CSS constraints', () => {
      const prompt = '스타일링 해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        techStack: ['Tailwind CSS'],
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toContain('테마');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Verb Pattern Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Additional Verb Patterns', () => {
    it('should detect optimization verbs', () => {
      const prompt = '성능 최적화해줘';
      const evaluation = createMockEvaluation({ goal: 0.1 });
      const variants = generatePromptVariants(prompt, evaluation);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toContain('최적화');
    });

    it('should detect add verbs', () => {
      const prompt = '새 기능 추가해줘';
      const evaluation = createMockEvaluation({ goal: 0.1 });
      const variants = generatePromptVariants(prompt, evaluation);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toContain('추가');
    });

    it('should detect delete verbs', () => {
      const prompt = '이 함수 삭제해줘';
      const evaluation = createMockEvaluation({ goal: 0.1 });
      const variants = generatePromptVariants(prompt, evaluation);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toContain('삭제');
    });

    it('should detect test verbs', () => {
      const prompt = '이 모듈 테스트해줘';
      const evaluation = createMockEvaluation({ goal: 0.1 });
      const variants = generatePromptVariants(prompt, evaluation);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toContain('테스트');
    });

    it('should detect review verbs', () => {
      const prompt = '코드 검토해줘';
      const evaluation = createMockEvaluation({ goal: 0.1 });
      const variants = generatePromptVariants(prompt, evaluation);
      const comprehensive = variants.find(v => v.variant === 'cosp')!;

      expect(comprehensive.rewrittenPrompt).toContain('검토');
    });

    it('should preserve original text in task section for unknown patterns', () => {
      const prompt = '뭔가 해줘';
      const evaluation = createMockEvaluation({ goal: 0.1 });
      const variants = generatePromptVariants(prompt, evaluation);
      const cosp = variants.find(v => v.variant === 'cosp')!;

      // COSP preserves the original request in task section
      expect(cosp.rewrittenPrompt).toContain('<task>');
      expect(cosp.rewrittenPrompt).toContain('뭔가 해줘');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Context Section Edge Cases
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Context Section Edge Cases', () => {
    it('should handle context without tech stack', () => {
      const prompt = '기능 구현해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        techStack: [],
        projectPath: '/Users/test/simple-project',
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const balanced = variants.find(v => v.variant === 'cosp')!;

      expect(balanced.rewrittenPrompt).toContain('프로젝트');
      expect(balanced.rewrittenPrompt).toContain('simple-project');
    });

    it('should skip generic current task', () => {
      const prompt = '작업 계속해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        currentTask: '작업 진행 중', // Generic task - should be skipped
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const balanced = variants.find(v => v.variant === 'cosp')!;

      expect(balanced.rewrittenPrompt).not.toContain('작업 진행 중');
    });

    it('should skip very short current task', () => {
      const prompt = '도와줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        currentTask: 'test', // Too short (< 5 chars) - should be skipped
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const balanced = variants.find(v => v.variant === 'cosp')!;

      expect(balanced.rewrittenPrompt).not.toContain('진행 중: test');
    });

    it('should truncate long current task', () => {
      const prompt = '다음 단계 진행해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        currentTask: 'This is a very long task description that should be truncated to prevent the prompt from becoming too verbose and hard to read',
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const balanced = variants.find(v => v.variant === 'cosp')!;

      // Task should be truncated
      expect(balanced.rewrittenPrompt.length).toBeLessThan(1000);
    });

    it('should extract error from prompt when no context', () => {
      const prompt = '에러 해결해줘: Error: Module not found';
      const evaluation = createMockEvaluation();
      // No context provided
      const variants = generatePromptVariants(prompt, evaluation);
      const balanced = variants.find(v => v.variant === 'cosp')!;

      // Should extract error from original prompt
      expect(balanced.rewrittenPrompt).toContain('에러');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Git Branch Context Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Git Branch Context', () => {
    it('should include feature branch in context', () => {
      const prompt = '기능 구현해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        gitBranch: 'feature/new-dashboard',
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const balanced = variants.find(v => v.variant === 'cosp')!;

      expect(balanced.rewrittenPrompt).toContain('feature/new-dashboard');
    });

    it('should not include main/master branch', () => {
      const prompt = '기능 구현해줘';
      const evaluation = createMockEvaluation();
      const context = createMockSessionContext({
        gitBranch: 'main',
      });
      const variants = generatePromptVariants(prompt, evaluation, context);
      const balanced = variants.find(v => v.variant === 'cosp')!;

      expect(balanced.rewrittenPrompt).not.toContain('main');
    });
  });
});
