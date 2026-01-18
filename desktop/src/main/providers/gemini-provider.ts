/**
 * Gemini Provider Adapter
 * Implements AIProvider interface for Google's Gemini API
 */

import { GoogleGenerativeAI, GoogleGenerativeAIError } from '@google/generative-ai';
import type { AIProvider, RewriteRequest, ProviderRewriteResult } from './types.js';
import { PROVIDER_METADATA } from './metadata.js';
import { REWRITE_SYSTEM_PROMPT, buildUserMessage } from './shared-prompts.js';

/**
 * Gemini Provider implementation
 */
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const;
  readonly displayName = PROVIDER_METADATA.gemini.displayName;

  async rewritePrompt(
    request: RewriteRequest,
    apiKey: string,
    modelId?: string
  ): Promise<ProviderRewriteResult> {
    if (!apiKey || apiKey.trim() === '') {
      return {
        success: false,
        error: 'API 키가 설정되지 않았습니다',
      };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelId || PROVIDER_METADATA.gemini.defaultModel,
        systemInstruction: REWRITE_SYSTEM_PROMPT,
      });

      const userMessage = buildUserMessage(request);

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          maxOutputTokens: 1500,
        },
      });

      const response = result.response;
      const content = response.text();

      if (!content) {
        return {
          success: false,
          error: 'API 응답에서 텍스트를 찾을 수 없습니다',
        };
      }

      return this.parseResponse(content, request.originalPrompt);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async validateKey(apiKey: string): Promise<boolean> {
    if (!apiKey || apiKey.trim() === '') {
      return false;
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: PROVIDER_METADATA.gemini.defaultModel,
      });

      await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        generationConfig: { maxOutputTokens: 10 },
      });

      return true;
    } catch (error) {
      console.error('[GeminiProvider] Key validation failed:', error);
      return false;
    }
  }

  private parseResponse(responseText: string, originalPrompt: string): ProviderRewriteResult {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: true,
        rewrittenPrompt: responseText.trim(),
        explanation: 'AI가 생성한 개선된 프롬프트입니다',
        improvements: [],
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        rewrittenPrompt?: string;
        explanation?: string;
        improvements?: string[];
      };

      let rewritten = parsed.rewrittenPrompt || responseText;

      // Check for placeholders
      if (/\[[^\]]*입력\]|\[[^\]]*설명\]|\[[^\]]*정보\]/.test(rewritten)) {
        console.warn('[GeminiProvider] Response contains placeholders, cleaning');
        rewritten = rewritten.replace(/\[[^\]]*입력\]|\[[^\]]*설명\]|\[[^\]]*정보\]/g, '').trim();
        return {
          success: true,
          rewrittenPrompt: rewritten || originalPrompt,
          explanation: parsed.explanation || '원본 유지 (플레이스홀더 제거)',
          improvements: parsed.improvements || [],
        };
      }

      return {
        success: true,
        rewrittenPrompt: rewritten,
        explanation: parsed.explanation,
        improvements: parsed.improvements || [],
      };
    } catch {
      return {
        success: true,
        rewrittenPrompt: responseText.trim(),
        explanation: 'AI가 생성한 개선된 프롬프트입니다',
        improvements: [],
      };
    }
  }

  private handleError(error: unknown): ProviderRewriteResult {
    console.error('[GeminiProvider] Error:', error);

    if (error instanceof GoogleGenerativeAIError) {
      const message = error.message.toLowerCase();
      if (message.includes('api key') || message.includes('invalid') || message.includes('unauthorized')) {
        return { success: false, error: 'API 키가 유효하지 않습니다. 설정에서 확인해주세요.' };
      }
      if (message.includes('quota') || message.includes('rate') || message.includes('limit')) {
        return { success: false, error: 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' };
      }
      return { success: false, error: `API 오류: ${error.message}` };
    }

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('enotfound') ||
          msg.includes('enetunreach') || msg.includes('etimedout') || msg.includes('econnrefused')) {
        return { success: false, error: '네트워크 연결을 확인해주세요.' };
      }
      return { success: false, error: `오류: ${error.message}` };
    }

    return { success: false, error: '알 수 없는 오류가 발생했습니다.' };
  }
}

// Singleton instance
export const geminiProvider = new GeminiProvider();
