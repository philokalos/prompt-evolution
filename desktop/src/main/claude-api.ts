/**
 * Claude API Client for AI-powered prompt rewriting
 * Uses Anthropic SDK for direct API calls
 */

import Anthropic from '@anthropic-ai/sdk';

// Types
export interface RewriteRequest {
  originalPrompt: string;
  goldenScores: {
    goal: number;
    output: number;
    limits: number;
    data: number;
    evaluation: number;
    next: number;
  };
  issues: Array<{
    severity: string;
    category: string;
    message: string;
    suggestion?: string;
  }>;
  sessionContext?: {
    projectPath?: string;
    projectName?: string;
    techStack?: string[];
  };
}

export interface RewriteResult {
  success: boolean;
  rewrittenPrompt?: string;
  explanation?: string;
  improvements?: string[];
  error?: string;
}

// System prompt for Claude to rewrite prompts
const REWRITE_SYSTEM_PROMPT = `당신은 프롬프트 엔지니어링 전문가입니다. 사용자의 프롬프트를 분석하고 개선된 버전을 생성합니다.

GOLDEN 체크리스트를 기반으로 프롬프트를 개선하세요:
- Goal (목표): 명확하고 구체적인 목표 설정
- Output (출력): 원하는 출력 형식과 구조 명시
- Limits (제약): 범위, 길이, 스타일 등 제약조건 정의
- Data (데이터): 필요한 컨텍스트와 정보 제공
- Evaluation (평가): 성공 기준 명시
- Next (다음): 후속 작업이나 예상 결과 언급

개선 시 주의사항:
1. 원래 의도를 유지하면서 명확성 향상
2. 불필요한 장황함 제거
3. 프로젝트 컨텍스트 활용 (제공된 경우)
4. 구체적이고 실행 가능한 지시로 변환
5. 한국어 프롬프트는 한국어로, 영어는 영어로 개선`;

/**
 * Rewrite a prompt using Claude API
 */
export async function rewritePromptWithClaude(
  apiKey: string,
  request: RewriteRequest
): Promise<RewriteResult> {
  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      error: 'API 키가 설정되지 않았습니다',
    };
  }

  try {
    const client = new Anthropic({
      apiKey: apiKey,
    });

    // Build the user message with context
    const weakDimensions = Object.entries(request.goldenScores)
      .filter(([, score]) => score < 60)
      .map(([dim, score]) => `${dim}: ${score}점`)
      .join(', ');

    const issuesSummary = request.issues
      .slice(0, 3)
      .map((i) => `- ${i.message}`)
      .join('\n');

    const contextInfo = request.sessionContext?.projectName
      ? `\n\n프로젝트 컨텍스트:
- 프로젝트: ${request.sessionContext.projectName}
- 기술 스택: ${request.sessionContext.techStack?.join(', ') || '알 수 없음'}`
      : '';

    const userMessage = `다음 프롬프트를 개선해주세요:

원본 프롬프트:
"""
${request.originalPrompt}
"""

GOLDEN 점수 분석:
- 약한 영역: ${weakDimensions || '없음'}

발견된 문제:
${issuesSummary || '- 특별한 문제 없음'}
${contextInfo}

개선된 프롬프트를 JSON 형식으로 반환해주세요:
{
  "rewrittenPrompt": "개선된 프롬프트 전체 텍스트",
  "explanation": "주요 개선 사항에 대한 간단한 설명 (1-2문장)",
  "improvements": ["개선점1", "개선점2", "개선점3"]
}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      system: REWRITE_SYSTEM_PROMPT,
    });

    // Extract text content from response
    const textContent = message.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return {
        success: false,
        error: 'API 응답에서 텍스트를 찾을 수 없습니다',
      };
    }

    // Parse JSON response
    const responseText = textContent.text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback: use the entire response as the rewritten prompt
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
      return {
        success: true,
        rewrittenPrompt: parsed.rewrittenPrompt || responseText,
        explanation: parsed.explanation,
        improvements: parsed.improvements || [],
      };
    } catch {
      // JSON parsing failed, use raw response
      return {
        success: true,
        rewrittenPrompt: responseText.trim(),
        explanation: 'AI가 생성한 개선된 프롬프트입니다',
        improvements: [],
      };
    }
  } catch (error) {
    console.error('[ClaudeAPI] Error:', error);

    // Handle specific Anthropic errors
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return {
          success: false,
          error: 'API 키가 유효하지 않습니다. 설정에서 확인해주세요.',
        };
      }
      if (error.status === 429) {
        return {
          success: false,
          error: 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
        };
      }
      if (error.status === 500 || error.status === 503) {
        return {
          success: false,
          error: 'Claude API 서버에 일시적인 문제가 있습니다.',
        };
      }
      return {
        success: false,
        error: `API 오류: ${error.message}`,
      };
    }

    // Network or other errors
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        return {
          success: false,
          error: '네트워크 연결을 확인해주세요.',
        };
      }
      return {
        success: false,
        error: `오류: ${error.message}`,
      };
    }

    return {
      success: false,
      error: '알 수 없는 오류가 발생했습니다.',
    };
  }
}

/**
 * Validate API key by making a simple request
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey || apiKey.trim() === '') {
    return false;
  }

  try {
    const client = new Anthropic({
      apiKey: apiKey,
    });

    // Make a minimal request to validate the key
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: 'test',
        },
      ],
    });

    return true;
  } catch (error) {
    console.error('[ClaudeAPI] Key validation failed:', error);
    return false;
  }
}
