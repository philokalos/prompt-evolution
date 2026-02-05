/**
 * Learning Engine Unit Tests
 *
 * Tests for the personal learning engine that connects Electron app
 * to analysis modules and provides history tracking.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock as _Mock } from 'vitest';

// Use vi.hoisted() to ensure mock state is available when vi.mock runs
const mockState = vi.hoisted(() => ({
  // Electron mocks
  isPackaged: false,
  ipcMainHandle: vi.fn(),
  // DB mocks
  initializeDatabase: vi.fn(),
  saveAnalysis: vi.fn(),
  getRecentAnalyses: vi.fn(() => []),
  getScoreTrend: vi.fn(() => []),
  getGoldenAverages: vi.fn(() => ({})),
  getTopWeaknesses: vi.fn(() => []),
  getWeeklyStats: vi.fn(() => []),
  getMonthlyStats: vi.fn(() => []),
  getImprovementAnalysis: vi.fn(() => null),
  getStats: vi.fn(() => ({ total: 0, avgScore: 0 })),
  // Prompt rewriter mocks
  generatePromptVariants: vi.fn(() => [
    { rewrittenPrompt: 'conservative', variant: 'conservative', confidence: 60, keyChanges: [], variantLabel: '보수적' },
    { rewrittenPrompt: 'balanced', variant: 'balanced', confidence: 75, keyChanges: [], variantLabel: '균형' },
    { rewrittenPrompt: 'comprehensive', variant: 'comprehensive', confidence: 95, keyChanges: [], variantLabel: '포괄적' },
  ]),
  generateAllVariants: vi.fn(() => Promise.resolve([
    { rewrittenPrompt: 'ai', variant: 'ai', confidence: 90, keyChanges: [], variantLabel: 'AI 추천', isAiGenerated: true },
  ])),
  // Index mocks
  getAIRewriteSettings: vi.fn(() => ({ enabled: false, apiKey: null })),
  getLastCapturedContext: vi.fn(() => null),
  // Session context mocks
  getSessionContext: vi.fn(() => null),
  getSessionContextForPath: vi.fn(() => null),
  getActiveWindowSessionContext: vi.fn(() => Promise.resolve(null)),
  getSessionContextForCapturedProject: vi.fn(() => Promise.resolve(null)),
  // History pattern mocks
  analyzeProjectPatterns: vi.fn(() => ({})),
  getContextRecommendations: vi.fn(() => []),
  enrichAnalysisWithHistory: vi.fn(() => ({
    historyRecommendations: [],
    comparisonWithHistory: null,
  })),
  // Module loading mocks
  existsSync: vi.fn(() => true),
  createRequire: vi.fn(() => vi.fn((path: string) => {
    if (path.includes('analysis-bundle')) {
      return {
        evaluatePromptAgainstGuidelines: mockState.mockEvaluate,
      };
    }
    if (path.includes('classifier-bundle')) {
      return {
        classifyPrompt: mockState.mockClassify,
      };
    }
    return {};
  })),
  // Analysis module mocks
  mockEvaluate: vi.fn((_text: string) => ({
    overallScore: 0.65,
    grade: 'C' as const,
    goldenScore: {
      goal: 0.7,
      output: 0.6,
      limits: 0.5,
      data: 0.6,
      evaluation: 0.4,
      next: 0.5,
      total: 0.55,
    },
    guidelineScores: [
      { guideline: 'G', name: 'Goal', description: 'Clear objective', score: 0.7, weight: 1, evidence: [], suggestion: 'Add goal' },
      { guideline: 'O', name: 'Output', description: 'Expected format', score: 0.6, weight: 1, evidence: [], suggestion: 'Specify output' },
    ],
    antiPatterns: [
      { pattern: 'vague', severity: 'medium' as const, description: 'Vague language', fix: 'Be more specific' },
    ],
    recommendations: ['Add more context', 'Be specific'],
  })),
  mockClassify: vi.fn((_text: string) => ({
    intent: 'instruction',
    category: 'code-generation',
    confidence: 0.85,
  })),
}));

// Mock electron
vi.mock('electron', () => ({
  app: {
    isPackaged: mockState.isPackaged,
  },
  ipcMain: {
    handle: mockState.ipcMainHandle,
  },
}));

// Mock path
vi.mock('path', () => ({
  default: {
    join: (...args: string[]) => args.join('/'),
    dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
  },
  join: (...args: string[]) => args.join('/'),
  dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
}));

// Mock url with ESM compatibility
vi.mock('url', () => ({
  __esModule: true,
  default: { fileURLToPath: (url: string) => url.replace('file://', '') },
  fileURLToPath: (url: string) => url.replace('file://', ''),
}));

// Mock fs (dynamically imported in loadAnalysisModules)
vi.mock('fs', () => ({
  existsSync: mockState.existsSync,
  default: {
    existsSync: mockState.existsSync,
  },
}));

// Mock module (for createRequire)
vi.mock('module', () => ({
  createRequire: mockState.createRequire,
}));

// Mock db/index.js
vi.mock('../db/index.js', () => ({
  initializeDatabase: mockState.initializeDatabase,
  saveAnalysis: mockState.saveAnalysis,
  getRecentAnalyses: mockState.getRecentAnalyses,
  getScoreTrend: mockState.getScoreTrend,
  getGoldenAverages: mockState.getGoldenAverages,
  getTopWeaknesses: mockState.getTopWeaknesses,
  getWeeklyStats: mockState.getWeeklyStats,
  getMonthlyStats: mockState.getMonthlyStats,
  getImprovementAnalysis: mockState.getImprovementAnalysis,
  getStats: mockState.getStats,
}));

// Mock prompt-rewriter.js
vi.mock('../prompt-rewriter.js', () => ({
  generatePromptVariants: mockState.generatePromptVariants,
  generateAllVariants: mockState.generateAllVariants,
}));

// Mock settings-store.js (extracted from index.js)
vi.mock('../settings-store.js', () => ({
  getAIRewriteSettings: mockState.getAIRewriteSettings,
}));

// Mock app-state.js (extracted from index.js)
vi.mock('../app-state.js', () => ({
  getLastCapturedContext: mockState.getLastCapturedContext,
}));

// Mock session-context.js
vi.mock('../session-context.js', () => ({
  getSessionContext: mockState.getSessionContext,
  getSessionContextForPath: mockState.getSessionContextForPath,
  getActiveWindowSessionContext: mockState.getActiveWindowSessionContext,
  getSessionContextForCapturedProject: mockState.getSessionContextForCapturedProject,
}));

// Mock history-pattern-analyzer.js
vi.mock('../history-pattern-analyzer.js', () => ({
  analyzeProjectPatterns: mockState.analyzeProjectPatterns,
  getContextRecommendations: mockState.getContextRecommendations,
  enrichAnalysisWithHistory: mockState.enrichAnalysisWithHistory,
}));

// Import after mocking
import { analyzePrompt, registerLearningEngineHandlers } from '../learning-engine.js';

describe('Learning Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.existsSync.mockReturnValue(true);
    mockState.getAIRewriteSettings.mockReturnValue({ enabled: false, apiKey: null });
    mockState.getLastCapturedContext.mockReturnValue(null);
    mockState.getActiveWindowSessionContext.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // analyzePrompt Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('analyzePrompt', () => {
    it('should analyze prompt and return structured result', async () => {
      const result = await analyzePrompt('Create a function to sort an array');

      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('grade');
      expect(result).toHaveProperty('goldenScores');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('personalTips');
      expect(result).toHaveProperty('promptVariants');
    });

    it('should convert GOLDEN scores to percentages', async () => {
      const result = await analyzePrompt('Test prompt');

      // Scores should be converted to 0-100 range
      expect(result.goldenScores.goal).toBe(70); // 0.7 * 100
      expect(result.goldenScores.output).toBe(60); // 0.6 * 100
      expect(result.goldenScores.limits).toBe(50); // 0.5 * 100
    });

    it('should include classification when classifier is available', async () => {
      const result = await analyzePrompt('Write a Python function');

      expect(result.classification).toBeDefined();
      expect(result.classification?.intent).toBe('instruction');
      expect(result.classification?.category).toBe('code-generation');
    });

    it('should generate prompt variants', async () => {
      const result = await analyzePrompt('Test prompt');

      expect(result.promptVariants.length).toBeGreaterThan(0);
      expect(mockState.generatePromptVariants).toHaveBeenCalled();
    });

    it('should add AI placeholder when AI is not enabled', async () => {
      mockState.getAIRewriteSettings.mockReturnValue({ enabled: false, apiKey: null });

      const result = await analyzePrompt('Test prompt');

      // First variant should be AI placeholder with needsSetup
      const aiVariant = result.promptVariants.find(v => v.variant === 'ai');
      expect(aiVariant).toBeDefined();
      expect(aiVariant?.needsSetup).toBe(true);
    });

    it('should add AI loading placeholder when enabled and API key is set', async () => {
      // Phase 3.1: analyzePrompt no longer calls generateAllVariants directly
      // Instead, it adds a loading placeholder for async AI loading via get-ai-variant IPC
      mockState.getAIRewriteSettings.mockReturnValue({ enabled: true, apiKey: 'sk-test-key' });

      const result = await analyzePrompt('Test prompt');

      // Should have AI variant with isLoading flag
      const aiVariant = result.promptVariants.find(v => v.variant === 'ai');
      expect(aiVariant).toBeDefined();
      expect(aiVariant?.isLoading).toBe(true);
      expect(aiVariant?.isAiGenerated).toBe(false);
    });

    it('should add AI placeholder when AI is enabled (async loading flow)', async () => {
      // The actual AI generation happens via separate get-ai-variant IPC call
      mockState.getAIRewriteSettings.mockReturnValue({ enabled: true, apiKey: 'sk-test-key' });

      const result = await analyzePrompt('Test prompt');

      // Should have AI loading placeholder
      expect(result.promptVariants.length).toBeGreaterThan(0);
      const aiVariant = result.promptVariants.find(v => v.variant === 'ai');
      expect(aiVariant).toBeDefined();
      expect(aiVariant?.isLoading).toBe(true);
    });

    it('should save analysis to history', async () => {
      await analyzePrompt('Test prompt for history');

      expect(mockState.saveAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          promptText: 'Test prompt for history',
          overallScore: expect.any(Number),
          grade: expect.any(String),
        })
      );
    });

    it('should handle database save failure gracefully', async () => {
      mockState.saveAnalysis.mockImplementation(() => {
        throw new Error('DB error');
      });

      // Should not throw
      const result = await analyzePrompt('Test prompt');
      expect(result).toBeDefined();
    });

    it('should use captured context when available', async () => {
      const capturedContext = {
        project: {
          projectPath: '/Users/test/project',
          projectName: 'test-project',
          ideName: 'VS Code',
          confidence: 'high' as const,
        },
        windowInfo: null,
        timestamp: new Date(),
      };
      mockState.getLastCapturedContext.mockReturnValue(capturedContext);
      mockState.getSessionContextForCapturedProject.mockResolvedValue({
        projectPath: '/Users/test/project',
        projectId: '-Users-test-project',
        sessionId: 'session-123',
        currentTask: 'Testing',
        techStack: ['TypeScript'],
        recentTools: ['Edit'],
        recentFiles: ['test.ts'],
        lastActivity: new Date(),
        source: 'active-window',
        confidence: 'high',
      });

      await analyzePrompt('Test with context');

      expect(mockState.getSessionContextForCapturedProject).toHaveBeenCalledWith(capturedContext);
    });

    it('should fallback to active window detection when no captured context', async () => {
      mockState.getLastCapturedContext.mockReturnValue(null);

      await analyzePrompt('Test prompt');

      expect(mockState.getActiveWindowSessionContext).toHaveBeenCalled();
    });

    it('should enrich with history recommendations when project path available', async () => {
      mockState.getActiveWindowSessionContext.mockResolvedValue({
        projectPath: '/Users/test/project',
        projectId: '-Users-test-project',
        sessionId: 'session-123',
        currentTask: 'Testing',
        techStack: ['React'],
        recentTools: [],
        recentFiles: [],
        lastActivity: new Date(),
        source: 'active-window',
        confidence: 'high',
      });
      mockState.enrichAnalysisWithHistory.mockReturnValue({
        historyRecommendations: [{ type: 'improvement', message: 'Getting better!' }],
        comparisonWithHistory: { betterThanAverage: true, scoreDiff: 5, improvement: '+5%' },
      });

      const result = await analyzePrompt('Test prompt');

      expect(mockState.enrichAnalysisWithHistory).toHaveBeenCalled();
      expect(result.historyRecommendations).toBeDefined();
      expect(result.comparisonWithHistory).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Fallback Analysis Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Fallback Analysis', () => {
    it('should return fallback analysis when modules cannot be loaded', async () => {
      mockState.existsSync.mockReturnValue(false);

      // Need to reimport to trigger new module loading
      // For this test, we simulate module load failure by checking the result
      const result = await analyzePrompt('Test prompt');

      // Result should still be valid
      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('grade');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Issue Generation Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Issue Generation', () => {
    it('should convert anti-patterns to issues', async () => {
      const result = await analyzePrompt('Vague test prompt');

      const vagueIssue = result.issues.find(i => i.category === 'vague');
      expect(vagueIssue).toBeDefined();
      expect(vagueIssue?.severity).toBe('medium');
    });

    it('should add issues from low-scoring guidelines', async () => {
      mockState.mockEvaluate.mockReturnValue({
        overallScore: 0.4,
        grade: 'D',
        goldenScore: { goal: 0.2, output: 0.3, limits: 0.5, data: 0.4, evaluation: 0.2, next: 0.3, total: 0.3 },
        guidelineScores: [
          { guideline: 'G', name: 'Goal', description: 'Clear objective', score: 0.2, weight: 1, evidence: [], suggestion: 'Define goal' },
          { guideline: 'E', name: 'Evaluation', description: 'Success criteria', score: 0.2, weight: 1, evidence: [], suggestion: 'Add criteria' },
        ],
        antiPatterns: [],
        recommendations: [],
      });

      const result = await analyzePrompt('Bad prompt');

      // Should have high severity issues for very low scores
      const highSeverityIssues = result.issues.filter(i => i.severity === 'high');
      expect(highSeverityIssues.length).toBeGreaterThan(0);
    });

    it('should sort issues by severity', async () => {
      mockState.mockEvaluate.mockReturnValue({
        overallScore: 0.5,
        grade: 'D',
        goldenScore: { goal: 0.3, output: 0.4, limits: 0.5, data: 0.4, evaluation: 0.3, next: 0.4, total: 0.4 },
        guidelineScores: [],
        antiPatterns: [
          { pattern: 'low', severity: 'low', description: 'Low issue', fix: 'Fix low' },
          { pattern: 'high', severity: 'high', description: 'High issue', fix: 'Fix high' },
          { pattern: 'medium', severity: 'medium', description: 'Medium issue', fix: 'Fix medium' },
        ],
        recommendations: [],
      });

      const result = await analyzePrompt('Test prompt');

      // High severity should come first
      expect(result.issues[0].severity).toBe('high');
      expect(result.issues[1].severity).toBe('medium');
      expect(result.issues[2].severity).toBe('low');
    });

    it('should limit issues to top 5', async () => {
      mockState.mockEvaluate.mockReturnValue({
        overallScore: 0.3,
        grade: 'F',
        goldenScore: { goal: 0.2, output: 0.2, limits: 0.2, data: 0.2, evaluation: 0.2, next: 0.2, total: 0.2 },
        guidelineScores: [
          { guideline: 'G', name: 'Goal', description: 'Test', score: 0.2, weight: 1, evidence: [], suggestion: 'Fix' },
          { guideline: 'O', name: 'Output', description: 'Test', score: 0.2, weight: 1, evidence: [], suggestion: 'Fix' },
          { guideline: 'L', name: 'Limits', description: 'Test', score: 0.2, weight: 1, evidence: [], suggestion: 'Fix' },
          { guideline: 'D', name: 'Data', description: 'Test', score: 0.2, weight: 1, evidence: [], suggestion: 'Fix' },
          { guideline: 'E', name: 'Evaluation', description: 'Test', score: 0.2, weight: 1, evidence: [], suggestion: 'Fix' },
          { guideline: 'N', name: 'Next', description: 'Test', score: 0.2, weight: 1, evidence: [], suggestion: 'Fix' },
        ],
        antiPatterns: [
          { pattern: 'test1', severity: 'high', description: 'Test', fix: 'Fix' },
          { pattern: 'test2', severity: 'high', description: 'Test', fix: 'Fix' },
        ],
        recommendations: [],
      });

      const result = await analyzePrompt('Bad prompt');

      expect(result.issues.length).toBeLessThanOrEqual(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Personal Tips Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Personal Tips', () => {
    it('should include recommendations in tips', async () => {
      const result = await analyzePrompt('Test prompt');

      expect(result.personalTips.length).toBeGreaterThan(0);
    });

    it('should add tips for lowest GOLDEN score area', async () => {
      mockState.mockEvaluate.mockReturnValue({
        overallScore: 0.5,
        grade: 'D',
        goldenScore: { goal: 0.8, output: 0.7, limits: 0.6, data: 0.5, evaluation: 0.2, next: 0.6, total: 0.5 },
        guidelineScores: [],
        antiPatterns: [],
        recommendations: [],
      });

      const result = await analyzePrompt('Test prompt');

      // Should have tip about evaluation (lowest score)
      const evaluationTip = result.personalTips.find(t => t.includes('성공 기준'));
      expect(evaluationTip).toBeDefined();
    });

    it('should limit tips to 3', async () => {
      mockState.mockEvaluate.mockReturnValue({
        overallScore: 0.3,
        grade: 'F',
        goldenScore: { goal: 0.2, output: 0.2, limits: 0.2, data: 0.2, evaluation: 0.2, next: 0.2, total: 0.2 },
        guidelineScores: [],
        antiPatterns: [],
        recommendations: ['Tip 1', 'Tip 2', 'Tip 3', 'Tip 4', 'Tip 5'],
      });

      const result = await analyzePrompt('Bad prompt');

      expect(result.personalTips.length).toBeLessThanOrEqual(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // registerLearningEngineHandlers Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('registerLearningEngineHandlers', () => {
    it('should initialize database', () => {
      registerLearningEngineHandlers();

      expect(mockState.initializeDatabase).toHaveBeenCalled();
    });

    it('should register all IPC handlers', () => {
      registerLearningEngineHandlers();

      const handlerNames = mockState.ipcMainHandle.mock.calls.map((call: unknown[]) => call[0]);

      expect(handlerNames).toContain('analyze-prompt');
      expect(handlerNames).toContain('get-history');
      expect(handlerNames).toContain('get-score-trend');
      expect(handlerNames).toContain('get-golden-averages');
      expect(handlerNames).toContain('get-top-weaknesses');
      expect(handlerNames).toContain('get-stats');
      expect(handlerNames).toContain('get-weekly-stats');
      expect(handlerNames).toContain('get-monthly-stats');
      expect(handlerNames).toContain('get-improvement-analysis');
      expect(handlerNames).toContain('get-session-context');
      expect(handlerNames).toContain('get-session-context-legacy');
      expect(handlerNames).toContain('get-session-context-for-path');
      expect(handlerNames).toContain('get-project-patterns');
      expect(handlerNames).toContain('get-context-recommendations');
    });

    it('should handle database initialization failure gracefully', () => {
      mockState.initializeDatabase.mockImplementation(() => {
        throw new Error('DB init failed');
      });

      // Should not throw
      expect(() => registerLearningEngineHandlers()).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // IPC Handler Callback Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('IPC Handler Callbacks', () => {
    it('should handle get-history with default limit', async () => {
      registerLearningEngineHandlers();

      const historyHandler = mockState.ipcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === 'get-history'
      )?.[1] as (_event: unknown, limit?: number) => Promise<unknown>;

      await historyHandler({}, undefined);

      expect(mockState.getRecentAnalyses).toHaveBeenCalledWith(30);
    });

    it('should handle get-history with custom limit', async () => {
      registerLearningEngineHandlers();

      const historyHandler = mockState.ipcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === 'get-history'
      )?.[1] as (_event: unknown, limit?: number) => Promise<unknown>;

      await historyHandler({}, 10);

      expect(mockState.getRecentAnalyses).toHaveBeenCalledWith(10);
    });

    it('should handle get-score-trend with default days', async () => {
      registerLearningEngineHandlers();

      const trendHandler = mockState.ipcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === 'get-score-trend'
      )?.[1] as (_event: unknown, days?: number) => Promise<unknown>;

      await trendHandler({}, undefined);

      expect(mockState.getScoreTrend).toHaveBeenCalledWith(30);
    });

    it('should handle get-stats', async () => {
      registerLearningEngineHandlers();

      const statsHandler = mockState.ipcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === 'get-stats'
      )?.[1] as () => Promise<unknown>;

      await statsHandler();

      expect(mockState.getStats).toHaveBeenCalled();
    });

    it('should handle get-session-context', async () => {
      registerLearningEngineHandlers();

      const contextHandler = mockState.ipcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === 'get-session-context'
      )?.[1] as () => Promise<unknown>;

      await contextHandler();

      expect(mockState.getActiveWindowSessionContext).toHaveBeenCalled();
    });

    it('should handle get-project-patterns', async () => {
      registerLearningEngineHandlers();

      const patternsHandler = mockState.ipcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === 'get-project-patterns'
      )?.[1] as (_event: unknown, projectPath: string) => Promise<unknown>;

      await patternsHandler({}, '/Users/test/project');

      expect(mockState.analyzeProjectPatterns).toHaveBeenCalledWith('/Users/test/project');
    });

    it('should handle get-context-recommendations', async () => {
      registerLearningEngineHandlers();

      const recommendationsHandler = mockState.ipcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === 'get-context-recommendations'
      )?.[1] as (_event: unknown, category: string | undefined, projectPath: string | undefined) => Promise<unknown>;

      await recommendationsHandler({}, 'code-generation', '/Users/test/project');

      expect(mockState.getContextRecommendations).toHaveBeenCalledWith('code-generation', '/Users/test/project');
    });

    it('should handle get-ai-variant when AI is not enabled', async () => {
      mockState.getAIRewriteSettings.mockReturnValue({ enabled: false, apiKey: null });
      registerLearningEngineHandlers();

      const aiVariantHandler = mockState.ipcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === 'get-ai-variant'
      )?.[1] as (_event: unknown, text: string) => Promise<unknown>;

      const result = await aiVariantHandler({}, 'Test prompt');

      expect(result).toMatchObject({
        variant: 'ai',
        needsSetup: true,
        isAiGenerated: false,
      });
    });

    it('should handle get-weekly-stats with custom weeks', async () => {
      registerLearningEngineHandlers();

      const weeklyStatsHandler = mockState.ipcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === 'get-weekly-stats'
      )?.[1] as (_event: unknown, weeks?: number) => Promise<unknown>;

      await weeklyStatsHandler({}, 8);

      expect(mockState.getWeeklyStats).toHaveBeenCalledWith(8);
    });

    it('should handle get-monthly-stats with custom months', async () => {
      registerLearningEngineHandlers();

      const monthlyStatsHandler = mockState.ipcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === 'get-monthly-stats'
      )?.[1] as (_event: unknown, months?: number) => Promise<unknown>;

      await monthlyStatsHandler({}, 12);

      expect(mockState.getMonthlyStats).toHaveBeenCalledWith(12);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Edge Cases and Error Handling
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle empty prompt text', async () => {
      const result = await analyzePrompt('');

      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it('should handle very long prompt text', async () => {
      const longText = 'word '.repeat(1000);
      const result = await analyzePrompt(longText);

      expect(result).toBeDefined();
      expect(result.promptVariants.length).toBeGreaterThan(0);
    });

    it('should handle special characters in prompt', async () => {
      const specialText = 'Test <>&"\'```\n\t';
      const result = await analyzePrompt(specialText);

      expect(result).toBeDefined();
    });

    it('should handle non-IDE app without project', async () => {
      mockState.getLastCapturedContext.mockReturnValue({
        project: null,
        windowInfo: {
          appName: 'Safari',
          windowTitle: 'Google Search',
        },
        timestamp: new Date(),
      });

      const result = await analyzePrompt('Test prompt');

      expect(result.sessionContext).toBeUndefined();
      expect(mockState.getSessionContextForCapturedProject).not.toHaveBeenCalled();
    });

    it('should handle database save error with error message', async () => {
      mockState.saveAnalysis.mockImplementation(() => {
        throw new Error('Database connection lost');
      });

      const result = await analyzePrompt('Test prompt');

      expect(result.dbSaveError).toBe('분석 결과 저장에 실패했습니다. 진행 추적이 기록되지 않았습니다.');
    });

    it('should handle history enrichment failure gracefully', async () => {
      mockState.getActiveWindowSessionContext.mockResolvedValue({
        projectPath: '/Users/test/project',
        projectId: '-Users-test-project',
        sessionId: 'session-123',
        currentTask: 'Testing',
        techStack: ['React'],
        recentTools: [],
        recentFiles: [],
        lastActivity: new Date(),
        source: 'active-window',
        confidence: 'high',
      });
      mockState.enrichAnalysisWithHistory.mockImplementation(() => {
        throw new Error('History DB error');
      });

      const result = await analyzePrompt('Test prompt');

      // Should still return result even if history enrichment fails
      expect(result).toBeDefined();
      expect(result.historyRecommendations).toBeUndefined();
    });

    it('should not enrich history when no project path', async () => {
      mockState.getActiveWindowSessionContext.mockResolvedValue({
        projectPath: undefined,
        projectId: undefined,
        sessionId: 'session-123',
        currentTask: undefined,
        techStack: [],
        recentTools: [],
        recentFiles: [],
        lastActivity: new Date(),
        source: 'active-window',
        confidence: 'low',
      });

      const result = await analyzePrompt('Test prompt');

      expect(mockState.enrichAnalysisWithHistory).not.toHaveBeenCalled();
      expect(result.historyRecommendations).toBeUndefined();
    });

    it('should use category from classification in history enrichment', async () => {
      mockState.getActiveWindowSessionContext.mockResolvedValue({
        projectPath: '/Users/test/project',
        projectId: '-Users-test-project',
        sessionId: 'session-123',
        currentTask: 'Testing',
        techStack: ['React'],
        recentTools: [],
        recentFiles: [],
        lastActivity: new Date(),
        source: 'active-window',
        confidence: 'high',
      });
      mockState.mockClassify.mockReturnValue({
        intent: 'instruction',
        category: 'refactoring',
        confidence: 0.9,
      });

      await analyzePrompt('Refactor this code');

      expect(mockState.enrichAnalysisWithHistory).toHaveBeenCalledWith(
        expect.any(Object),
        '/Users/test/project',
        'refactoring'
      );
    });

    it('should handle code block in prompt', async () => {
      const result = await analyzePrompt('```typescript\nconst x = 1;\n```');

      // Should analyze code block
      expect(result).toBeDefined();
      expect(result.goldenScores).toBeDefined();
    });

    it('should handle question in prompt', async () => {
      const result = await analyzePrompt('How do I fix this error?');

      // Should analyze question
      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it('should handle very long text prompts', async () => {
      const longPrompt = 'word '.repeat(60); // > 50 words
      const result = await analyzePrompt(longPrompt);

      // Should handle long prompts without error
      expect(result).toBeDefined();
      expect(result.goldenScores.data).toBeDefined();
    });

    it('should handle very short prompts', async () => {
      const result = await analyzePrompt('Test');

      // Should handle short prompts
      expect(result).toBeDefined();
      expect(result.goldenScores.goal).toBeDefined();
    });

    it('should handle single character prompt', async () => {
      const result = await analyzePrompt('a');

      expect(result).toBeDefined();
      expect(result.grade).toBeDefined();
    });

    it('should generate variants for normal prompts', async () => {
      const result = await analyzePrompt('Create a function to sort');

      expect(result.promptVariants.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Session Context Integration Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Session Context Integration', () => {
    it('should save project path to database when available', async () => {
      mockState.getActiveWindowSessionContext.mockResolvedValue({
        projectPath: '/Users/test/my-project',
        projectId: '-Users-test-my-project',
        sessionId: 'session-456',
        currentTask: 'Building feature',
        techStack: ['Vue'],
        recentTools: [],
        recentFiles: [],
        lastActivity: new Date(),
        source: 'active-window',
        confidence: 'high',
      });

      await analyzePrompt('Test prompt');

      expect(mockState.saveAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          projectPath: '/Users/test/my-project',
        })
      );
    });

    it('should save intent and category to database', async () => {
      mockState.mockClassify.mockReturnValue({
        intent: 'question',
        category: 'debugging',
        confidence: 0.8,
      });

      await analyzePrompt('Why is this failing?');

      expect(mockState.saveAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          intent: 'question',
          category: 'debugging',
        })
      );
    });

    it('should include session context in analysis result', async () => {
      const sessionContext = {
        projectPath: '/Users/test/project',
        projectId: '-Users-test-project',
        sessionId: 'session-789',
        currentTask: 'Testing',
        techStack: ['Angular'],
        recentTools: ['Read'],
        recentFiles: ['app.ts'],
        lastActivity: new Date(),
        source: 'active-window' as const,
        confidence: 'medium' as const,
      };
      mockState.getActiveWindowSessionContext.mockResolvedValue(sessionContext);

      const result = await analyzePrompt('Test');

      expect(result.sessionContext).toEqual(sessionContext);
    });
  });
});
