/**
 * Claude API Client for AI-powered prompt rewriting (v2)
 * Uses Anthropic SDK for direct API calls
 *
 * v2 개선사항:
 * - 시스템 프롬프트 ~1500 토큰으로 강화
 * - GOLDEN 차원별 상세 설명 + 예시 포함
 * - 플레이스홀더 사용 금지 규칙 명시
 * - 풍부한 세션 컨텍스트 전달
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
    currentTask?: string;
    recentFiles?: string[];
    recentTools?: string[];
    gitBranch?: string;
    // 직전 대화 컨텍스트 (새 필드)
    lastExchange?: {
      userMessage: string;          // 직전 사용자 메시지 (100자 이내)
      assistantSummary: string;     // 직전 Claude 응답 요약 (100자 이내)
      assistantTools: string[];     // 응답에서 사용된 도구들
      assistantFiles: string[];     // 응답에서 수정된 파일들
    };
  };
}

export interface RewriteResult {
  success: boolean;
  rewrittenPrompt?: string;
  explanation?: string;
  improvements?: string[];
  error?: string;
}

// Enhanced system prompt for Claude to rewrite prompts (~1500 tokens)
const REWRITE_SYSTEM_PROMPT = `당신은 프롬프트 엔지니어링 전문가입니다. 사용자의 프롬프트를 분석하고 **즉시 사용 가능한** 개선된 버전을 생성합니다.

## GOLDEN 체크리스트 상세 가이드

### G - Goal (목표 명확성)
목표가 명확한 프롬프트의 특징:
- 구체적인 동사 사용: "만들어줘" → "React 컴포넌트를 생성해줘"
- 완료 조건 명시: "동작하는" → "에러 없이 빌드되고 테스트 통과하는"

**개선 전**: "로그인 기능 만들어줘"
**개선 후**: "Firebase Auth를 사용해서 이메일/비밀번호 로그인 기능을 구현해줘. 에러 처리와 로딩 상태 포함."

### O - Output (출력 형식)
출력 형식이 명확한 프롬프트:
- 원하는 형태: 코드, 설명, 단계별 가이드
- 포함 요소: 타입 정의, import 문, 주석

**개선 전**: "설명해줘"
**개선 후**: "다음 내용을 설명해줘: 1) 기본 개념, 2) 코드 예시, 3) 주의사항"

### L - Limits (제약조건)
제약조건이 명확한 프롬프트:
- 기술 스택: React 19, TypeScript strict 모드
- 스타일: 함수형 컴포넌트, Tailwind CSS
- 제한: 외부 라이브러리 최소화

**개선 전**: "버튼 만들어줘"
**개선 후**: "React + TypeScript + Tailwind로 버튼 컴포넌트 만들어줘. shadcn/ui 스타일로."

### D - Data (컨텍스트)
충분한 컨텍스트를 제공하는 프롬프트:
- 현재 환경: 프로젝트, 기술 스택
- 관련 정보: 에러 메시지, 관련 코드
- 작업 배경: 왜 이 작업이 필요한지

**개선 전**: "에러 수정해줘"
**개선 후**: "다음 에러가 발생해: TypeError: Cannot read property 'x' of undefined. 관련 코드: [코드]. 원인과 해결책 알려줘."

### E - Evaluation (평가 기준)
성공 기준이 명확한 프롬프트:
- 동작 확인: 빌드 성공, 테스트 통과
- 품질 기준: 성능, 접근성, 보안

### N - Next (후속 작업)
다음 단계가 언급된 프롬프트:
- 이 결과로 무엇을 할 것인지
- 추가 작업 예정 여부

## 리라이팅 핵심 규칙

1. **절대 플레이스홀더 사용 금지**
   - "[코드 입력]", "[프로젝트 설명]", "[환경 정보]" 같은 빈 자리 표시 금지
   - 정보가 없으면 해당 섹션 자체를 생략
   - 세션 컨텍스트에서 실제 값을 추출하여 사용

2. **원본 의도 100% 보존**
   - 사용자가 요청한 핵심 내용을 절대 변경하지 않음
   - 부족한 정보만 보완

3. **언어 일관성**
   - 한국어 프롬프트 → 한국어로 개선
   - 영어 프롬프트 → 영어로 개선
   - 코드/기술 용어는 원어 유지 가능

4. **세션 컨텍스트 최대 활용**
   - 제공된 프로젝트 이름, 기술 스택, 현재 작업 등을 자연스럽게 통합
   - 관련 파일명, 브랜치 정보 활용

5. **간결함 유지**
   - 원본 길이 대비 2배 이하
   - 불필요한 수식어 제거
   - 핵심 정보만 추가

## 사고 과정

1. **원본 분석**: 핵심 요청은 무엇인가?
2. **약점 파악**: GOLDEN 점수가 낮은 영역은 어디인가?
3. **개선 계획**: 어떤 정보를 추가하면 좋을까?
4. **맥락 통합**: 세션 컨텍스트에서 유용한 정보는?
5. **검증**: 원본 의도 보존? 플레이스홀더 없음? 바로 사용 가능?

## 출력 형식

반드시 JSON 형식으로 응답:
{
  "rewrittenPrompt": "개선된 프롬프트 전체 텍스트",
  "explanation": "주요 개선 사항 (1-2문장)",
  "improvements": ["개선점1", "개선점2", "개선점3"]
}`;

/**
 * Build enhanced user message with rich context
 */
function buildUserMessage(request: RewriteRequest): string {
  const parts: string[] = [];

  // 1. 원본 프롬프트
  parts.push(`원본 프롬프트:
"""
${request.originalPrompt}
"""`);

  // 2. GOLDEN 점수 시각화
  const dimensions: Array<{ key: keyof typeof request.goldenScores; label: string }> = [
    { key: 'goal', label: '목표' },
    { key: 'output', label: '출력' },
    { key: 'limits', label: '제약' },
    { key: 'data', label: '컨텍스트' },
    { key: 'evaluation', label: '평가' },
    { key: 'next', label: '후속' },
  ];

  const scoreLines = dimensions.map(({ key, label }) => {
    const score = request.goldenScores[key];
    const status = score >= 70 ? '✓' : score >= 40 ? '△' : '✗';
    return `  ${status} ${label}: ${score}점`;
  });

  parts.push(`GOLDEN 점수:
${scoreLines.join('\n')}`);

  // 3. 발견된 문제 + 제안
  if (request.issues.length > 0) {
    const issueLines = request.issues.slice(0, 4).map((issue, i) => {
      let line = `${i + 1}. [${issue.severity}] ${issue.message}`;
      if (issue.suggestion) {
        line += `\n   → ${issue.suggestion}`;
      }
      return line;
    });

    parts.push(`발견된 문제:
${issueLines.join('\n')}`);
  }

  // 4. 풍부한 세션 컨텍스트
  if (request.sessionContext) {
    const ctx = request.sessionContext;
    const contextLines: string[] = [];

    if (ctx.projectName) {
      contextLines.push(`- 프로젝트: ${ctx.projectName}`);
    }

    if (ctx.techStack && ctx.techStack.length > 0) {
      contextLines.push(`- 기술 스택: ${ctx.techStack.join(', ')}`);
    }

    if (ctx.currentTask && ctx.currentTask !== '작업 진행 중' && ctx.currentTask.length > 5) {
      contextLines.push(`- 현재 작업: ${ctx.currentTask.slice(0, 80)}`);
    }

    if (ctx.recentFiles && ctx.recentFiles.length > 0) {
      const files = ctx.recentFiles.slice(0, 3).map(f => f.split('/').pop()).join(', ');
      contextLines.push(`- 최근 파일: ${files}`);
    }

    if (ctx.recentTools && ctx.recentTools.length > 0) {
      contextLines.push(`- 최근 도구: ${ctx.recentTools.slice(0, 3).join(', ')}`);
    }

    if (ctx.gitBranch && !['main', 'master'].includes(ctx.gitBranch)) {
      contextLines.push(`- 브랜치: ${ctx.gitBranch}`);
    }

    // 직전 대화 컨텍스트 (새로 추가)
    if (ctx.lastExchange) {
      const le = ctx.lastExchange;
      if (le.userMessage) {
        contextLines.push(`- 직전 요청: ${le.userMessage}`);
      }
      if (le.assistantSummary) {
        contextLines.push(`- 직전 응답: ${le.assistantSummary}`);
      }
      if (le.assistantFiles && le.assistantFiles.length > 0) {
        const files = le.assistantFiles.slice(0, 3).map(f => f.split('/').pop()).join(', ');
        contextLines.push(`- 수정된 파일: ${files}`);
      }
      if (le.assistantTools && le.assistantTools.length > 0) {
        contextLines.push(`- 사용된 도구: ${le.assistantTools.slice(0, 3).join(', ')}`);
      }
    }

    if (contextLines.length > 0) {
      parts.push(`세션 컨텍스트:
${contextLines.join('\n')}`);
    }
  }

  // 5. 요청
  parts.push(`위 프롬프트를 GOLDEN 체크리스트에 맞게 개선해주세요.
플레이스홀더 없이, 즉시 사용 가능한 형태로 작성해주세요.`);

  return parts.join('\n\n');
}

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

    const userMessage = buildUserMessage(request);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
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

      // Validate: check for placeholders
      const rewritten = parsed.rewrittenPrompt || responseText;
      if (/\[[^\]]*입력\]|\[[^\]]*설명\]|\[[^\]]*정보\]/.test(rewritten)) {
        console.warn('[ClaudeAPI] Response contains placeholders, using fallback');
        // Try to remove placeholders
        const cleaned = rewritten.replace(/\[[^\]]*입력\]|\[[^\]]*설명\]|\[[^\]]*정보\]/g, '').trim();
        return {
          success: true,
          rewrittenPrompt: cleaned || request.originalPrompt,
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
 * Generate multiple variants with different temperatures and select the best
 * This is the key improvement: multi-variant generation + GOLDEN evaluation → best score selection
 */
export async function rewritePromptWithMultiVariant(
  apiKey: string,
  request: RewriteRequest,
  evaluateGolden: (text: string) => { total: number; goal: number; output: number; limits: number; data: number; evaluation: number; next: number }
): Promise<RewriteResult & { variant?: 'conservative' | 'balanced' | 'comprehensive'; originalScore?: number; improvedScore?: number; improvementPercent?: number }> {
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

    const userMessage = buildUserMessage(request);
    const temperatures = [0.3, 0.5, 0.7];
    const variantNames: Array<'conservative' | 'balanced' | 'comprehensive'> = ['conservative', 'balanced', 'comprehensive'];

    // Generate all variants in parallel
    const variantPromises = temperatures.map(async (temp, index) => {
      try {
        const message = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          temperature: temp,
          messages: [
            {
              role: 'user',
              content: userMessage,
            },
          ],
          system: REWRITE_SYSTEM_PROMPT,
        });

        const textContent = message.content.find((block) => block.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          return null;
        }

        // Parse JSON response
        const responseText = textContent.text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        let rewrittenPrompt: string;
        let explanation: string | undefined;
        let improvements: string[] = [];

        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]) as {
              rewrittenPrompt?: string;
              explanation?: string;
              improvements?: string[];
            };
            rewrittenPrompt = parsed.rewrittenPrompt || responseText.trim();
            explanation = parsed.explanation;
            improvements = parsed.improvements || [];
          } catch {
            rewrittenPrompt = responseText.trim();
          }
        } else {
          rewrittenPrompt = responseText.trim();
        }

        // Clean placeholders
        if (/\[[^\]]*입력\]|\[[^\]]*설명\]|\[[^\]]*정보\]/.test(rewrittenPrompt)) {
          rewrittenPrompt = rewrittenPrompt.replace(/\[[^\]]*입력\]|\[[^\]]*설명\]|\[[^\]]*정보\]/g, '').trim();
        }

        return {
          text: rewrittenPrompt,
          explanation,
          improvements,
          variantType: variantNames[index],
          temperature: temp,
        };
      } catch (error) {
        console.error(`[ClaudeAPI] Variant ${index + 1} generation failed:`, error);
        return null;
      }
    });

    const variants = (await Promise.all(variantPromises)).filter((v): v is NonNullable<typeof v> => v !== null);

    if (variants.length === 0) {
      return {
        success: false,
        error: '모든 변형 생성에 실패했습니다.',
      };
    }

    // Evaluate each variant with GOLDEN and find the best
    const evaluatedVariants = variants.map((variant) => {
      const score = evaluateGolden(variant.text);
      return {
        ...variant,
        goldenScore: score,
      };
    });

    // Select the best variant by total GOLDEN score
    const best = evaluatedVariants.reduce((a, b) =>
      a.goldenScore.total > b.goldenScore.total ? a : b
    );

    // Calculate original score for comparison
    const originalScore = evaluateGolden(request.originalPrompt);
    const improvementPercent = Math.round(
      ((best.goldenScore.total - originalScore.total) / Math.max(originalScore.total, 0.01)) * 100
    );

    return {
      success: true,
      rewrittenPrompt: best.text,
      explanation: best.explanation,
      improvements: best.improvements,
      variant: best.variantType,
      originalScore: Math.round(originalScore.total * 100),
      improvedScore: Math.round(best.goldenScore.total * 100),
      improvementPercent,
    };
  } catch (error) {
    console.error('[ClaudeAPI] Multi-variant error:', error);

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return { success: false, error: 'API 키가 유효하지 않습니다.' };
      }
      if (error.status === 429) {
        return { success: false, error: 'API 요청 한도 초과. 잠시 후 다시 시도해주세요.' };
      }
      return { success: false, error: `API 오류: ${error.message}` };
    }

    return { success: false, error: '알 수 없는 오류가 발생했습니다.' };
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
