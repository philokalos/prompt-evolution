/**
 * Gemini Provider Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiProvider } from '../gemini-provider.js';
import type { RewriteRequest } from '../types.js';

// Mock Google Generative AI SDK
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(function(this: { getGenerativeModel: typeof mockGetGenerativeModel }) {
    this.getGenerativeModel = mockGetGenerativeModel;
  }),
  GoogleGenerativeAIError: class GoogleGenerativeAIError extends Error {},
}));

describe('GeminiProvider', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GeminiProvider();
  });

  const mockRequest: RewriteRequest = {
    originalPrompt: 'Fix bug',
    goldenScores: {
      goal: 50,
      output: 40,
      limits: 30,
      data: 60,
      evaluation: 20,
      next: 10,
    },
    issues: [
      {
        severity: 'medium',
        category: 'goal',
        message: 'Goal is not specific',
        suggestion: 'Add concrete action',
      },
    ],
    sessionContext: {
      projectName: 'test-project',
      techStack: ['React', 'TypeScript'],
    },
  };

  describe('rewritePrompt', () => {
    it('should successfully rewrite prompt', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Please analyze and fix the bug in the authentication system.',
        },
      });

      const result = await provider.rewritePrompt(mockRequest, 'AIza-test123');

      expect(result.success).toBe(true);
      expect(result.rewrittenPrompt).toBe(
        'Please analyze and fix the bug in the authentication system.'
      );
      expect(mockGetGenerativeModel).toHaveBeenCalled();
      const callArgs = mockGetGenerativeModel.mock.calls[0][0];
      expect(callArgs).toHaveProperty('model', 'gemini-2.0-flash');
      expect(callArgs).toHaveProperty('systemInstruction');
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({ role: 'user' }),
          ]),
          generationConfig: {
            maxOutputTokens: 1500,
          },
        })
      );
    });

    it('should parse JSON response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            rewrittenPrompt: 'Improved prompt',
            explanation: 'Added context',
            improvements: ['More specific', 'Added goal'],
          }),
        },
      });

      const result = await provider.rewritePrompt(mockRequest, 'AIza-test123');

      expect(result.success).toBe(true);
      expect(result.rewrittenPrompt).toBe('Improved prompt');
      expect(result.explanation).toBe('Added context');
      expect(result.improvements).toEqual(['More specific', 'Added goal']);
    });

    it('should clean placeholders from response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            rewrittenPrompt: 'Fix the [사용자 입력] in the system',
          }),
        },
      });

      const result = await provider.rewritePrompt(mockRequest, 'AIza-test123');

      expect(result.success).toBe(true);
      expect(result.rewrittenPrompt).toBe('Fix the  in the system');
      expect(result.explanation).toBe('원본 유지 (플레이스홀더 제거)');
    });

    it('should reject empty API key', async () => {
      const result = await provider.rewritePrompt(mockRequest, '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('API 키');
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only API key', async () => {
      const result = await provider.rewritePrompt(mockRequest, '   ');

      expect(result.success).toBe(false);
      expect(result.error).toContain('API 키');
    });

    it('should handle API errors', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Quota exceeded'));

      const result = await provider.rewritePrompt(mockRequest, 'AIza-test123');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should handle missing content in response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => null,
        },
      });

      const result = await provider.rewritePrompt(mockRequest, 'AIza-test123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('텍스트를 찾을 수 없습니다');
    });

    it('should handle empty response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => '',
        },
      });

      const result = await provider.rewritePrompt(mockRequest, 'AIza-test123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('텍스트를 찾을 수 없습니다');
    });

    it('should use custom model when provided', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Response',
        },
      });

      await provider.rewritePrompt(mockRequest, 'AIza-test123', 'gemini-1.5-pro');

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-1.5-pro',
        })
      );
    });

    it('should include context in request', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Response',
        },
      });

      await provider.rewritePrompt(mockRequest, 'AIza-test123');

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const userContent = callArgs.contents[0].parts[0].text;
      expect(userContent).toContain('test-project');
      expect(userContent).toContain('React');
    });
  });

  describe('validateKey', () => {
    it('should validate correct API key', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'test',
        },
      });

      const result = await provider.validateKey('AIza-test123');

      expect(result).toBe(true);
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: [{ role: 'user', parts: [{ text: 'test' }] }],
          generationConfig: { maxOutputTokens: 10 },
        })
      );
    });

    it('should reject empty API key', async () => {
      const result = await provider.validateKey('');

      expect(result).toBe(false);
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only API key', async () => {
      const result = await provider.validateKey('   ');

      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Invalid API key'));

      const result = await provider.validateKey('AIza-invalid');

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Network timeout'));

      const result = await provider.validateKey('AIza-test123');

      expect(result).toBe(false);
    });

    it('should return false on quota error', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Quota exceeded'));

      const result = await provider.validateKey('AIza-test123');

      expect(result).toBe(false);
    });
  });

  describe('parseResponse', () => {
    it('should handle plain text response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'This is a plain text response without JSON',
        },
      });

      const result = await provider.rewritePrompt(mockRequest, 'AIza-test123');

      expect(result.success).toBe(true);
      expect(result.rewrittenPrompt).toBe('This is a plain text response without JSON');
      expect(result.explanation).toBe('AI가 생성한 개선된 프롬프트입니다');
    });

    it('should extract JSON from mixed content', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Here is the result: {"rewrittenPrompt": "Improved", "explanation": "Better"} Done!',
        },
      });

      const result = await provider.rewritePrompt(mockRequest, 'AIza-test123');

      expect(result.success).toBe(true);
      expect(result.rewrittenPrompt).toBe('Improved');
      expect(result.explanation).toBe('Better');
    });

    it('should handle malformed JSON gracefully', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Some text {invalid json} more text',
        },
      });

      const result = await provider.rewritePrompt(mockRequest, 'AIza-test123');

      expect(result.success).toBe(true);
      expect(result.rewrittenPrompt).toBeTruthy();
    });
  });

  describe('metadata', () => {
    it('should have correct provider name', () => {
      expect(provider.name).toBe('gemini');
    });

    it('should have display name', () => {
      expect(provider.displayName).toBeTruthy();
      expect(typeof provider.displayName).toBe('string');
    });
  });
});
