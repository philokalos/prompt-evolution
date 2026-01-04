/**
 * Claude API Client Unit Tests
 *
 * Tests for AI-powered prompt rewriting using Anthropic SDK.
 * All Anthropic SDK calls are mocked.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted() to ensure mock state is available when vi.mock runs
const mockState = vi.hoisted(() => {
  // Custom APIError class for testing - must be inside hoisted
  class MockAPIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'APIError';
    }
  }

  return {
    create: vi.fn(),
    MockAPIError,
  };
});

// Mock the Anthropic SDK - use function constructor like BrowserWindow mock
vi.mock('@anthropic-ai/sdk', () => {
  // Use a regular function constructor (not vi.fn) for proper `new` behavior
  function MockAnthropic(this: { messages: { create: typeof mockState.create } }) {
    this.messages = {
      create: mockState.create,
    };
  }

  // Attach APIError as a static property
  (MockAnthropic as unknown as { APIError: typeof mockState.MockAPIError }).APIError = mockState.MockAPIError;

  return {
    default: MockAnthropic,
  };
});

import {
  rewritePromptWithClaude,
  rewritePromptWithMultiVariant,
  validateApiKey,
  type RewriteRequest,
} from '../claude-api.js';

// Helper to create a mock request
function createMockRequest(overrides?: Partial<RewriteRequest>): RewriteRequest {
  return {
    originalPrompt: '버그 수정해줘',
    goldenScores: {
      goal: 0.3,
      output: 0.2,
      limits: 0.1,
      data: 0.2,
      evaluation: 0.1,
      next: 0.1,
    },
    issues: [
      {
        severity: 'error',
        category: 'goal',
        message: '목표가 불명확합니다',
        suggestion: '구체적인 버그 설명 추가',
      },
    ],
    ...overrides,
  };
}

// Helper to create a mock API response
function createMockResponse(text: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text,
      },
    ],
  };
}

describe('Claude API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rewritePromptWithClaude', () => {
    describe('API Key Validation', () => {
      it('should return error when API key is empty', async () => {
        const result = await rewritePromptWithClaude('', createMockRequest());

        expect(result.success).toBe(false);
        expect(result.error).toBe('API 키가 설정되지 않았습니다');
      });

      it('should return error when API key is whitespace only', async () => {
        const result = await rewritePromptWithClaude('   ', createMockRequest());

        expect(result.success).toBe(false);
        expect(result.error).toBe('API 키가 설정되지 않았습니다');
      });
    });

    describe('Successful Response Handling', () => {
      it('should parse JSON response correctly', async () => {
        mockState.create.mockResolvedValueOnce(
          createMockResponse(
            JSON.stringify({
              rewrittenPrompt: '개선된 프롬프트입니다',
              explanation: '목표를 명확히 했습니다',
              improvements: ['목표 추가', '컨텍스트 보강'],
            })
          )
        );

        const result = await rewritePromptWithClaude('sk-valid-key', createMockRequest());

        expect(result.success).toBe(true);
        expect(result.rewrittenPrompt).toBe('개선된 프롬프트입니다');
        expect(result.explanation).toBe('목표를 명확히 했습니다');
        expect(result.improvements).toEqual(['목표 추가', '컨텍스트 보강']);
      });

      it('should handle response with extra text around JSON', async () => {
        mockState.create.mockResolvedValueOnce(
          createMockResponse(
            `Here's the improved prompt:\n${JSON.stringify({
              rewrittenPrompt: '개선된 프롬프트',
              explanation: '설명',
            })}\nHope this helps!`
          )
        );

        const result = await rewritePromptWithClaude('sk-valid-key', createMockRequest());

        expect(result.success).toBe(true);
        expect(result.rewrittenPrompt).toBe('개선된 프롬프트');
      });

      it('should fallback when response is not JSON', async () => {
        mockState.create.mockResolvedValueOnce(
          createMockResponse('이것은 개선된 프롬프트입니다. JSON이 아닙니다.')
        );

        const result = await rewritePromptWithClaude('sk-valid-key', createMockRequest());

        expect(result.success).toBe(true);
        expect(result.rewrittenPrompt).toBe('이것은 개선된 프롬프트입니다. JSON이 아닙니다.');
        expect(result.explanation).toBe('AI가 생성한 개선된 프롬프트입니다');
        expect(result.improvements).toEqual([]);
      });

      it('should handle malformed JSON gracefully', async () => {
        mockState.create.mockResolvedValueOnce(
          createMockResponse('{ "rewrittenPrompt": "test", invalid json }')
        );

        const result = await rewritePromptWithClaude('sk-valid-key', createMockRequest());

        expect(result.success).toBe(true);
        // Falls back to raw response
        expect(result.rewrittenPrompt).toContain('test');
      });
    });

    describe('Placeholder Handling', () => {
      it('should clean placeholders from response', async () => {
        mockState.create.mockResolvedValueOnce(
          createMockResponse(
            JSON.stringify({
              rewrittenPrompt: '버그 수정해줘 [에러 정보 입력] [환경 설명]',
              explanation: '플레이스홀더가 포함됨',
            })
          )
        );

        const result = await rewritePromptWithClaude('sk-valid-key', createMockRequest());

        expect(result.success).toBe(true);
        expect(result.rewrittenPrompt).toBe('버그 수정해줘');
        expect(result.rewrittenPrompt).not.toContain('[');
      });

      it('should return original prompt when only placeholders remain after cleaning', async () => {
        mockState.create.mockResolvedValueOnce(
          createMockResponse(
            JSON.stringify({
              rewrittenPrompt: '[코드 입력]',
              explanation: '플레이스홀더만 있음',
            })
          )
        );

        const request = createMockRequest({ originalPrompt: '원본 프롬프트' });
        const result = await rewritePromptWithClaude('sk-valid-key', request);

        expect(result.success).toBe(true);
        expect(result.rewrittenPrompt).toBe('원본 프롬프트');
      });
    });

    describe('No Text Content', () => {
      it('should return error when response has no text content', async () => {
        mockState.create.mockResolvedValueOnce({
          content: [{ type: 'tool_use', id: '123', name: 'test', input: {} }],
        });

        const result = await rewritePromptWithClaude('sk-valid-key', createMockRequest());

        expect(result.success).toBe(false);
        expect(result.error).toBe('API 응답에서 텍스트를 찾을 수 없습니다');
      });

      it('should return error when response content is empty', async () => {
        mockState.create.mockResolvedValueOnce({ content: [] });

        const result = await rewritePromptWithClaude('sk-valid-key', createMockRequest());

        expect(result.success).toBe(false);
        expect(result.error).toBe('API 응답에서 텍스트를 찾을 수 없습니다');
      });
    });

    describe('API Error Handling', () => {
      it('should handle 401 unauthorized error', async () => {
        mockState.create.mockRejectedValueOnce(new mockState.MockAPIError(401, 'Unauthorized'));

        const result = await rewritePromptWithClaude('sk-invalid-key', createMockRequest());

        expect(result.success).toBe(false);
        expect(result.error).toBe('API 키가 유효하지 않습니다. 설정에서 확인해주세요.');
      });

      it('should handle 429 rate limit error', async () => {
        mockState.create.mockRejectedValueOnce(new mockState.MockAPIError(429, 'Rate limited'));

        const result = await rewritePromptWithClaude('sk-valid-key', createMockRequest());

        expect(result.success).toBe(false);
        expect(result.error).toBe('API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
      });

      it('should handle 500 server error', async () => {
        mockState.create.mockRejectedValueOnce(new mockState.MockAPIError(500, 'Server error'));

        const result = await rewritePromptWithClaude('sk-valid-key', createMockRequest());

        expect(result.success).toBe(false);
        expect(result.error).toBe('Claude API 서버에 일시적인 문제가 있습니다.');
      });

      it('should handle 503 service unavailable error', async () => {
        mockState.create.mockRejectedValueOnce(new mockState.MockAPIError(503, 'Service unavailable'));

        const result = await rewritePromptWithClaude('sk-valid-key', createMockRequest());

        expect(result.success).toBe(false);
        expect(result.error).toBe('Claude API 서버에 일시적인 문제가 있습니다.');
      });

      it('should handle other API errors', async () => {
        mockState.create.mockRejectedValueOnce(new mockState.MockAPIError(400, 'Bad request'));

        const result = await rewritePromptWithClaude('sk-valid-key', createMockRequest());

        expect(result.success).toBe(false);
        expect(result.error).toContain('API 오류');
      });

      it('should handle network error', async () => {
        mockState.create.mockRejectedValueOnce(new Error('fetch failed'));

        const result = await rewritePromptWithClaude('sk-valid-key', createMockRequest());

        expect(result.success).toBe(false);
        expect(result.error).toBe('네트워크 연결을 확인해주세요.');
      });

      it('should handle generic errors', async () => {
        mockState.create.mockRejectedValueOnce(new Error('Something went wrong'));

        const result = await rewritePromptWithClaude('sk-valid-key', createMockRequest());

        expect(result.success).toBe(false);
        expect(result.error).toContain('오류');
      });

      it('should handle unknown error types', async () => {
        mockState.create.mockRejectedValueOnce('String error');

        const result = await rewritePromptWithClaude('sk-valid-key', createMockRequest());

        expect(result.success).toBe(false);
        expect(result.error).toBe('알 수 없는 오류가 발생했습니다.');
      });
    });

    describe('Session Context in Request', () => {
      it('should include session context in API call', async () => {
        mockState.create.mockResolvedValueOnce(
          createMockResponse(JSON.stringify({ rewrittenPrompt: '개선됨' }))
        );

        const request = createMockRequest({
          sessionContext: {
            projectPath: '/path/to/project',
            projectName: 'my-project',
            techStack: ['React', 'TypeScript'],
            currentTask: '로그인 기능 구현',
            recentFiles: ['src/App.tsx', 'src/auth.ts'],
            recentTools: ['Read', 'Edit'],
            gitBranch: 'feature/login',
          },
        });

        await rewritePromptWithClaude('sk-valid-key', request);

        expect(mockState.create).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                content: expect.stringContaining('my-project'),
              }),
            ]),
          })
        );
      });

      it('should include lastExchange context in API call', async () => {
        mockState.create.mockResolvedValueOnce(
          createMockResponse(JSON.stringify({ rewrittenPrompt: '개선됨' }))
        );

        const request = createMockRequest({
          sessionContext: {
            projectName: 'test-project',
            lastExchange: {
              userMessage: '이전 메시지',
              assistantSummary: '이전 응답 요약',
              assistantTools: ['Read', 'Edit'],
              assistantFiles: ['src/index.ts'],
            },
          },
        });

        await rewritePromptWithClaude('sk-valid-key', request);

        const callArgs = mockState.create.mock.calls[0][0];
        expect(callArgs.messages[0].content).toContain('직전 요청');
        expect(callArgs.messages[0].content).toContain('이전 메시지');
      });

      it('should skip main/master branch in context', async () => {
        mockState.create.mockResolvedValueOnce(
          createMockResponse(JSON.stringify({ rewrittenPrompt: '개선됨' }))
        );

        const request = createMockRequest({
          sessionContext: {
            projectName: 'test',
            gitBranch: 'main',
          },
        });

        await rewritePromptWithClaude('sk-valid-key', request);

        const callArgs = mockState.create.mock.calls[0][0];
        expect(callArgs.messages[0].content).not.toContain('브랜치: main');
      });
    });

    describe('Issue Formatting', () => {
      it('should include issues in API call', async () => {
        mockState.create.mockResolvedValueOnce(
          createMockResponse(JSON.stringify({ rewrittenPrompt: '개선됨' }))
        );

        const request = createMockRequest({
          issues: [
            { severity: 'error', category: 'goal', message: '목표 불명확', suggestion: '구체화 필요' },
            { severity: 'warning', category: 'data', message: '컨텍스트 부족' },
          ],
        });

        await rewritePromptWithClaude('sk-valid-key', request);

        const callArgs = mockState.create.mock.calls[0][0];
        expect(callArgs.messages[0].content).toContain('목표 불명확');
        expect(callArgs.messages[0].content).toContain('구체화 필요');
      });

      it('should limit issues to 4', async () => {
        mockState.create.mockResolvedValueOnce(
          createMockResponse(JSON.stringify({ rewrittenPrompt: '개선됨' }))
        );

        const request = createMockRequest({
          issues: [
            { severity: 'error', category: 'goal', message: 'Issue 1' },
            { severity: 'error', category: 'output', message: 'Issue 2' },
            { severity: 'error', category: 'limits', message: 'Issue 3' },
            { severity: 'error', category: 'data', message: 'Issue 4' },
            { severity: 'error', category: 'evaluation', message: 'Issue 5' },
            { severity: 'error', category: 'next', message: 'Issue 6' },
          ],
        });

        await rewritePromptWithClaude('sk-valid-key', request);

        const callArgs = mockState.create.mock.calls[0][0];
        expect(callArgs.messages[0].content).toContain('Issue 4');
        expect(callArgs.messages[0].content).not.toContain('Issue 5');
      });
    });
  });

  describe('rewritePromptWithMultiVariant', () => {
    // Use text length proportionally so longer prompts get higher scores
    const mockEvaluateGolden = vi.fn((text: string) => {
      const score = Math.min(text.length / 50, 1.0);  // Max 1.0 at 50+ chars
      return {
        total: score,
        goal: score * 0.9,
        output: score * 0.8,
        limits: score * 0.7,
        data: score * 0.9,
        evaluation: score * 0.6,
        next: score * 0.5,
      };
    });

    beforeEach(() => {
      mockEvaluateGolden.mockClear();
    });

    describe('API Key Validation', () => {
      it('should return error when API key is empty', async () => {
        const result = await rewritePromptWithMultiVariant('', createMockRequest(), mockEvaluateGolden);

        expect(result.success).toBe(false);
        expect(result.error).toBe('API 키가 설정되지 않았습니다');
      });

      it('should return error when API key is whitespace', async () => {
        const result = await rewritePromptWithMultiVariant('  ', createMockRequest(), mockEvaluateGolden);

        expect(result.success).toBe(false);
        expect(result.error).toBe('API 키가 설정되지 않았습니다');
      });
    });

    describe('Multi-Variant Generation', () => {
      it('should generate 3 variants with different temperatures', async () => {
        mockState.create
          .mockResolvedValueOnce(createMockResponse(JSON.stringify({ rewrittenPrompt: 'Conservative variant' })))
          .mockResolvedValueOnce(createMockResponse(JSON.stringify({ rewrittenPrompt: 'Balanced variant here' })))
          .mockResolvedValueOnce(createMockResponse(JSON.stringify({ rewrittenPrompt: 'Comprehensive variant with more text' })));

        await rewritePromptWithMultiVariant('sk-valid-key', createMockRequest(), mockEvaluateGolden);

        expect(mockState.create).toHaveBeenCalledTimes(3);

        // Check temperatures
        const temps = mockState.create.mock.calls.map((call) => call[0].temperature);
        expect(temps).toEqual([0.3, 0.5, 0.7]);
      });

      it('should select the best variant by GOLDEN score', async () => {
        mockState.create
          .mockResolvedValueOnce(createMockResponse(JSON.stringify({ rewrittenPrompt: 'Short' })))
          .mockResolvedValueOnce(createMockResponse(JSON.stringify({ rewrittenPrompt: 'This is a much longer prompt with better quality' })))
          .mockResolvedValueOnce(createMockResponse(JSON.stringify({ rewrittenPrompt: 'Medium length prompt here' })));

        const result = await rewritePromptWithMultiVariant('sk-valid-key', createMockRequest(), mockEvaluateGolden);

        expect(result.success).toBe(true);
        expect(result.rewrittenPrompt).toBe('This is a much longer prompt with better quality');
        expect(result.variant).toBe('balanced');
      });

      it('should return improvement metrics', async () => {
        mockState.create
          .mockResolvedValueOnce(createMockResponse(JSON.stringify({ rewrittenPrompt: 'Improved prompt with more detail and context' })))
          .mockResolvedValueOnce(createMockResponse(JSON.stringify({ rewrittenPrompt: 'Another variant' })))
          .mockResolvedValueOnce(createMockResponse(JSON.stringify({ rewrittenPrompt: 'Third variant' })));

        const result = await rewritePromptWithMultiVariant('sk-valid-key', createMockRequest(), mockEvaluateGolden);

        expect(result.success).toBe(true);
        expect(result.originalScore).toBeDefined();
        expect(result.improvedScore).toBeDefined();
        expect(result.improvementPercent).toBeDefined();
      });
    });

    describe('Partial Failure Handling', () => {
      it('should succeed if at least one variant succeeds', async () => {
        mockState.create
          .mockRejectedValueOnce(new Error('Failed'))
          .mockResolvedValueOnce(createMockResponse(JSON.stringify({ rewrittenPrompt: 'Only successful one with enough text' })))
          .mockRejectedValueOnce(new Error('Failed'));

        const result = await rewritePromptWithMultiVariant('sk-valid-key', createMockRequest(), mockEvaluateGolden);

        expect(result.success).toBe(true);
        expect(result.rewrittenPrompt).toBe('Only successful one with enough text');
      });

      it('should fail if all variants fail', async () => {
        mockState.create
          .mockRejectedValueOnce(new Error('Failed 1'))
          .mockRejectedValueOnce(new Error('Failed 2'))
          .mockRejectedValueOnce(new Error('Failed 3'));

        const result = await rewritePromptWithMultiVariant('sk-valid-key', createMockRequest(), mockEvaluateGolden);

        expect(result.success).toBe(false);
        expect(result.error).toBe('모든 변형 생성에 실패했습니다.');
      });

      it('should handle variants without text content', async () => {
        mockState.create
          .mockResolvedValueOnce({ content: [] }) // No text
          .mockResolvedValueOnce(createMockResponse(JSON.stringify({ rewrittenPrompt: 'Valid variant with enough text for good score' })))
          .mockResolvedValueOnce({ content: [{ type: 'tool_use', id: '1', name: 'test', input: {} }] }); // Non-text

        const result = await rewritePromptWithMultiVariant('sk-valid-key', createMockRequest(), mockEvaluateGolden);

        expect(result.success).toBe(true);
        expect(result.rewrittenPrompt).toBe('Valid variant with enough text for good score');
      });
    });

    describe('Placeholder Cleaning in Variants', () => {
      it('should clean placeholders from all variants', async () => {
        mockState.create
          .mockResolvedValueOnce(createMockResponse(JSON.stringify({ rewrittenPrompt: 'Clean prompt [정보 입력]' })))
          .mockResolvedValueOnce(createMockResponse(JSON.stringify({ rewrittenPrompt: 'Another [설명] variant' })))
          .mockResolvedValueOnce(createMockResponse(JSON.stringify({ rewrittenPrompt: 'Best prompt without placeholders and enough text' })));

        const result = await rewritePromptWithMultiVariant('sk-valid-key', createMockRequest(), mockEvaluateGolden);

        expect(result.success).toBe(true);
        expect(result.rewrittenPrompt).not.toContain('[');
      });
    });

    describe('API Error Handling', () => {
      // Note: In multi-variant, API errors are caught per-variant and result in generic "all failed" error
      // because the implementation swallows individual variant errors and only checks if any succeeded
      it('should handle all variants failing with API errors', async () => {
        mockState.create.mockRejectedValue(new mockState.MockAPIError(401, 'Unauthorized'));

        const result = await rewritePromptWithMultiVariant('sk-invalid', createMockRequest(), mockEvaluateGolden);

        expect(result.success).toBe(false);
        expect(result.error).toBe('모든 변형 생성에 실패했습니다.');
      });

      it('should succeed if at least one variant bypasses rate limiting', async () => {
        // First two fail with rate limit, third succeeds
        mockState.create
          .mockRejectedValueOnce(new mockState.MockAPIError(429, 'Rate limited'))
          .mockRejectedValueOnce(new mockState.MockAPIError(429, 'Rate limited'))
          .mockResolvedValueOnce(createMockResponse(JSON.stringify({ rewrittenPrompt: 'Successful prompt after rate limits' })));

        const result = await rewritePromptWithMultiVariant('sk-valid', createMockRequest(), mockEvaluateGolden);

        expect(result.success).toBe(true);
        expect(result.rewrittenPrompt).toBe('Successful prompt after rate limits');
      });
    });

    describe('Non-JSON Response Handling', () => {
      it('should handle raw text responses', async () => {
        mockState.create
          .mockResolvedValueOnce(createMockResponse('Just plain text response without JSON formatting'))
          .mockResolvedValueOnce(createMockResponse('Another plain text'))
          .mockResolvedValueOnce(createMockResponse('Third'));

        const result = await rewritePromptWithMultiVariant('sk-valid-key', createMockRequest(), mockEvaluateGolden);

        expect(result.success).toBe(true);
        expect(result.rewrittenPrompt).toBe('Just plain text response without JSON formatting');
      });
    });
  });

  describe('validateApiKey', () => {
    it('should return false for empty key', async () => {
      const result = await validateApiKey('');
      expect(result).toBe(false);
    });

    it('should return false for whitespace key', async () => {
      const result = await validateApiKey('   ');
      expect(result).toBe(false);
    });

    it('should return true for valid key', async () => {
      mockState.create.mockResolvedValueOnce(createMockResponse('test'));

      const result = await validateApiKey('sk-valid-key');
      expect(result).toBe(true);
    });

    it('should return false when API call fails', async () => {
      mockState.create.mockRejectedValueOnce(new mockState.MockAPIError(401, 'Invalid'));

      const result = await validateApiKey('sk-invalid-key');
      expect(result).toBe(false);
    });

    it('should make minimal API call for validation', async () => {
      mockState.create.mockResolvedValueOnce(createMockResponse('ok'));

      await validateApiKey('sk-valid-key');

      expect(mockState.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }],
        })
      );
    });
  });

  describe('GOLDEN Score Formatting', () => {
    it('should format high scores with checkmark', async () => {
      mockState.create.mockResolvedValueOnce(
        createMockResponse(JSON.stringify({ rewrittenPrompt: '개선됨' }))
      );

      const request = createMockRequest({
        goldenScores: {
          goal: 80,
          output: 70,
          limits: 30,
          data: 50,
          evaluation: 20,
          next: 10,
        },
      });

      await rewritePromptWithClaude('sk-valid-key', request);

      const callArgs = mockState.create.mock.calls[0][0];
      const message = callArgs.messages[0].content;

      expect(message).toContain('✓ 목표: 80점');
      expect(message).toContain('✓ 출력: 70점');
      expect(message).toContain('✗ 제약: 30점');
      expect(message).toContain('△ 컨텍스트: 50점');
    });
  });
});
