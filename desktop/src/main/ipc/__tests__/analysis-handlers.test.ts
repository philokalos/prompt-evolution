/**
 * Analysis Handlers Unit Tests
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { AnalysisHandlerDeps } from '../analysis-handlers.js';
import type { ProviderConfig } from '../../prompt-rewriter.js';

// Mock Electron modules
const mockIpcHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mockIpcHandlers.set(channel, handler);
    }),
  },
}));

describe('Analysis Handlers', () => {
  let deps: AnalysisHandlerDeps;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockIpcHandlers.clear();

    deps = {
      analyzePrompt: vi.fn().mockResolvedValue({
        evaluation: { overallScore: 0.75 },
        variants: [],
      }),
      generateAIVariant: vi.fn().mockResolvedValue({
        text: 'Improved prompt',
        score: 0.9,
      }),
      generateAIVariantWithProviders: vi.fn().mockResolvedValue({
        results: [{ provider: 'claude', text: 'AI variant', score: 0.85 }],
      }),
      getActiveWindowSessionContext: vi.fn().mockResolvedValue({
        projectPath: '/test/project',
        techStack: ['typescript', 'react'],
      }),
      getSessionContext: vi.fn().mockResolvedValue({
        projectPath: '/legacy/path',
      }),
      getSessionContextForPath: vi.fn().mockResolvedValue({
        projectPath: '/specific/path',
        gitBranch: 'main',
      }),
      analyzeProjectPatterns: vi.fn().mockResolvedValue({
        patterns: ['code-generation', 'debugging'],
        averageScore: 0.7,
      }),
      getContextRecommendations: vi.fn().mockResolvedValue({
        recommendations: ['Add more context', 'Specify output format'],
      }),
    };

    const { registerAnalysisHandlers } = await import('../analysis-handlers.js');
    registerAnalysisHandlers(deps);
  });

  describe('analyze-prompt', () => {
    it('should call analyzePrompt with text', async () => {
      const handler = mockIpcHandlers.get('analyze-prompt');
      const testText = 'Help me write a function';

      await handler!(null, testText);

      expect(deps.analyzePrompt).toHaveBeenCalledWith(testText);
    });

    it('should return analysis result', async () => {
      const handler = mockIpcHandlers.get('analyze-prompt');
      const result = await handler!(null, 'Test prompt');

      expect(result).toEqual({
        evaluation: { overallScore: 0.75 },
        variants: [],
      });
    });
  });

  describe('get-ai-variant', () => {
    it('should call generateAIVariant with text', async () => {
      const handler = mockIpcHandlers.get('get-ai-variant');
      const testText = 'Improve this prompt';

      await handler!(null, testText);

      expect(deps.generateAIVariant).toHaveBeenCalledWith(testText);
    });

    it('should return AI variant result', async () => {
      const handler = mockIpcHandlers.get('get-ai-variant');
      const result = await handler!(null, 'Test');

      expect(result).toEqual({
        text: 'Improved prompt',
        score: 0.9,
      });
    });
  });

  describe('get-ai-variant-with-providers', () => {
    it('should call generateAIVariantWithProviders with text and configs', async () => {
      const handler = mockIpcHandlers.get('get-ai-variant-with-providers');
      const testText = 'Multi-provider test';
      const configs: ProviderConfig[] = [
        { provider: 'claude', apiKey: 'key1' },
        { provider: 'openai', apiKey: 'key2' },
      ];

      await handler!(null, testText, configs);

      expect(deps.generateAIVariantWithProviders).toHaveBeenCalledWith(testText, configs);
    });

    it('should return multi-provider results', async () => {
      const handler = mockIpcHandlers.get('get-ai-variant-with-providers');
      const result = await handler!(null, 'Test', []);

      expect(result).toEqual({
        results: [{ provider: 'claude', text: 'AI variant', score: 0.85 }],
      });
    });
  });

  describe('get-session-context', () => {
    it('should call getActiveWindowSessionContext', async () => {
      const handler = mockIpcHandlers.get('get-session-context');

      await handler!();

      expect(deps.getActiveWindowSessionContext).toHaveBeenCalled();
    });

    it('should return active window context', async () => {
      const handler = mockIpcHandlers.get('get-session-context');
      const result = await handler!();

      expect(result).toEqual({
        projectPath: '/test/project',
        techStack: ['typescript', 'react'],
      });
    });
  });

  describe('get-session-context-legacy', () => {
    it('should call getSessionContext', async () => {
      const handler = mockIpcHandlers.get('get-session-context-legacy');

      await handler!();

      expect(deps.getSessionContext).toHaveBeenCalled();
    });

    it('should return legacy context', async () => {
      const handler = mockIpcHandlers.get('get-session-context-legacy');
      const result = await handler!();

      expect(result).toEqual({
        projectPath: '/legacy/path',
      });
    });
  });

  describe('get-session-context-for-path', () => {
    it('should call getSessionContextForPath with target path', async () => {
      const handler = mockIpcHandlers.get('get-session-context-for-path');
      const targetPath = '/custom/path';

      await handler!(null, targetPath);

      expect(deps.getSessionContextForPath).toHaveBeenCalledWith(targetPath);
    });

    it('should return context for specific path', async () => {
      const handler = mockIpcHandlers.get('get-session-context-for-path');
      const result = await handler!(null, '/specific/path');

      expect(result).toEqual({
        projectPath: '/specific/path',
        gitBranch: 'main',
      });
    });
  });

  describe('get-project-patterns', () => {
    it('should call analyzeProjectPatterns with project path', async () => {
      const handler = mockIpcHandlers.get('get-project-patterns');
      const projectPath = '/my/project';

      await handler!(null, projectPath);

      expect(deps.analyzeProjectPatterns).toHaveBeenCalledWith(projectPath);
    });

    it('should return project patterns', async () => {
      const handler = mockIpcHandlers.get('get-project-patterns');
      const result = await handler!(null, '/project');

      expect(result).toEqual({
        patterns: ['code-generation', 'debugging'],
        averageScore: 0.7,
      });
    });
  });

  describe('get-context-recommendations', () => {
    it('should call getContextRecommendations with category and path', async () => {
      const handler = mockIpcHandlers.get('get-context-recommendations');
      const category = 'code-generation';
      const projectPath = '/project/path';

      await handler!(null, category, projectPath);

      expect(deps.getContextRecommendations).toHaveBeenCalledWith(category, projectPath);
    });

    it('should handle undefined category and path', async () => {
      const handler = mockIpcHandlers.get('get-context-recommendations');

      await handler!(null, undefined, undefined);

      expect(deps.getContextRecommendations).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should return recommendations', async () => {
      const handler = mockIpcHandlers.get('get-context-recommendations');
      const result = await handler!(null, 'debugging', '/path');

      expect(result).toEqual({
        recommendations: ['Add more context', 'Specify output format'],
      });
    });
  });

  describe('IPC registration', () => {
    it('should register all analysis handlers', () => {
      expect(mockIpcHandlers.has('analyze-prompt')).toBe(true);
      expect(mockIpcHandlers.has('get-ai-variant')).toBe(true);
      expect(mockIpcHandlers.has('get-ai-variant-with-providers')).toBe(true);
      expect(mockIpcHandlers.has('get-session-context')).toBe(true);
      expect(mockIpcHandlers.has('get-session-context-legacy')).toBe(true);
      expect(mockIpcHandlers.has('get-session-context-for-path')).toBe(true);
      expect(mockIpcHandlers.has('get-project-patterns')).toBe(true);
      expect(mockIpcHandlers.has('get-context-recommendations')).toBe(true);
    });

    it('should have correct number of handlers', () => {
      expect(mockIpcHandlers.size).toBe(8);
    });
  });

  describe('error handling', () => {
    it('should propagate errors from analyzePrompt', async () => {
      (deps.analyzePrompt as Mock).mockRejectedValue(new Error('Analysis failed'));
      const handler = mockIpcHandlers.get('analyze-prompt');

      await expect(handler!(null, 'test')).rejects.toThrow('Analysis failed');
    });

    it('should propagate errors from generateAIVariant', async () => {
      (deps.generateAIVariant as Mock).mockRejectedValue(new Error('AI generation failed'));
      const handler = mockIpcHandlers.get('get-ai-variant');

      await expect(handler!(null, 'test')).rejects.toThrow('AI generation failed');
    });
  });
});
