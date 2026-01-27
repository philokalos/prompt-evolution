/**
 * Claude Provider Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaudeProvider } from '../claude-provider.js';
import type { RewriteRequest } from '../types.js';

// Mock Anthropic SDK
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  class MockAPIError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  }

  const MockAnthropic = vi.fn(function(this: any) {
    this.messages = { create: mockCreate };
  });
  MockAnthropic.APIError = MockAPIError;
  return { default: MockAnthropic };
});

describe('ClaudeProvider', () => {
  let provider: ClaudeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new ClaudeProvider();
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
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Please analyze and fix the bug in the authentication system.',
          },
        ],
      });

      const result = await provider.rewritePrompt(mockRequest, 'sk-ant-test123');

      expect(result.success).toBe(true);
      expect(result.rewrittenPrompt).toBe(
        'Please analyze and fix the bug in the authentication system.'
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user' }),
          ]),
        })
      );
    });

    it('should parse JSON response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              rewrittenPrompt: 'Improved prompt',
              explanation: 'Added context',
              improvements: ['More specific', 'Added goal'],
            }),
          },
        ],
      });

      const result = await provider.rewritePrompt(mockRequest, 'sk-ant-test123');

      expect(result.success).toBe(true);
      expect(result.rewrittenPrompt).toBe('Improved prompt');
      expect(result.explanation).toBe('Added context');
      expect(result.improvements).toEqual(['More specific', 'Added goal']);
    });

    it('should clean placeholders from response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              rewrittenPrompt: 'Fix the [사용자 입력] in the system',
            }),
          },
        ],
      });

      const result = await provider.rewritePrompt(mockRequest, 'sk-ant-test123');

      expect(result.success).toBe(true);
      expect(result.rewrittenPrompt).toBe('Fix the  in the system');
      expect(result.explanation).toBe('원본 유지 (플레이스홀더 제거)');
    });

    it('should reject empty API key', async () => {
      const result = await provider.rewritePrompt(mockRequest, '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('API 키');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only API key', async () => {
      const result = await provider.rewritePrompt(mockRequest, '   ');

      expect(result.success).toBe(false);
      expect(result.error).toContain('API 키');
    });

    it('should handle API errors', async () => {
      mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      const result = await provider.rewritePrompt(mockRequest, 'sk-ant-test123');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should handle missing text content in response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'image', data: 'xyz' }],
      });

      const result = await provider.rewritePrompt(mockRequest, 'sk-ant-test123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('텍스트를 찾을 수 없습니다');
    });

    it('should handle empty content array', async () => {
      mockCreate.mockResolvedValue({
        content: [],
      });

      const result = await provider.rewritePrompt(mockRequest, 'sk-ant-test123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('텍스트를 찾을 수 없습니다');
    });

    it('should use custom model when provided', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
      });

      await provider.rewritePrompt(mockRequest, 'sk-ant-test123', 'claude-3-opus-20240229');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-opus-20240229',
        })
      );
    });

    it('should include context in request', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
      });

      await provider.rewritePrompt(mockRequest, 'sk-ant-test123');

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[0].content;
      expect(userMessage).toContain('test-project');
      expect(userMessage).toContain('React');
    });
  });

  describe('validateKey', () => {
    it('should validate correct API key', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'test' }],
      });

      const result = await provider.validateKey('sk-ant-test123');

      expect(result).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }],
        })
      );
    });

    it('should reject empty API key', async () => {
      const result = await provider.validateKey('');

      expect(result).toBe(false);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only API key', async () => {
      const result = await provider.validateKey('   ');

      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      mockCreate.mockRejectedValue(new Error('Invalid API key'));

      const result = await provider.validateKey('sk-ant-invalid');

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      mockCreate.mockRejectedValue(new Error('Network timeout'));

      const result = await provider.validateKey('sk-ant-test123');

      expect(result).toBe(false);
    });

    it('should return false on rate limit error', async () => {
      mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      const result = await provider.validateKey('sk-ant-test123');

      expect(result).toBe(false);
    });
  });

  describe('parseResponse', () => {
    it('should handle plain text response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'This is a plain text response without JSON',
          },
        ],
      });

      const result = await provider.rewritePrompt(mockRequest, 'sk-ant-test123');

      expect(result.success).toBe(true);
      expect(result.rewrittenPrompt).toBe('This is a plain text response without JSON');
      expect(result.explanation).toBe('AI가 생성한 개선된 프롬프트입니다');
    });

    it('should extract JSON from mixed content', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Here is the result: {"rewrittenPrompt": "Improved", "explanation": "Better"} Done!',
          },
        ],
      });

      const result = await provider.rewritePrompt(mockRequest, 'sk-ant-test123');

      expect(result.success).toBe(true);
      expect(result.rewrittenPrompt).toBe('Improved');
      expect(result.explanation).toBe('Better');
    });

    it('should handle malformed JSON gracefully', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Some text {invalid json} more text',
          },
        ],
      });

      const result = await provider.rewritePrompt(mockRequest, 'sk-ant-test123');

      expect(result.success).toBe(true);
      expect(result.rewrittenPrompt).toBeTruthy();
    });
  });

  describe('metadata', () => {
    it('should have correct provider name', () => {
      expect(provider.name).toBe('claude');
    });

    it('should have display name', () => {
      expect(provider.displayName).toBeTruthy();
      expect(typeof provider.displayName).toBe('string');
    });
  });
});
