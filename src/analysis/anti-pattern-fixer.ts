/**
 * Anti-Pattern Fixer
 * Automatically fixes detected anti-patterns in prompts
 */

import type { DetectedAntiPattern } from '../shared/types/index.js';

/**
 * Session context for anti-pattern fixing
 */
export interface FixerContext {
  recentFiles?: string[];
  techStack?: string[];
  currentTask?: string;
  projectName?: string;
}

/**
 * Anti-pattern fixer result
 */
export interface FixerResult {
  fixedPrompt: string;
  appliedFixes: string[];
  fixedPatterns: string[];
}

/**
 * Individual fixer function type
 */
type AntiPatternFixer = (prompt: string, ctx?: FixerContext) => {
  fixed: string;
  applied: boolean;
  description: string;
};

/**
 * Anti-pattern fixers
 */
const FIXERS: Record<string, AntiPatternFixer> = {
  /**
   * Fix vague objectives by adding category-specific goal prefixes
   */
  'vague-objective': (prompt, ctx) => {
    // If prompt is very short, try to expand it
    if (prompt.length <= 15) {
      const category = detectSimpleCategory(prompt);
      const prefix = getCategoryPrefix(category, ctx);

      if (prefix) {
        return {
          fixed: `${prefix}\n\n${prompt}`,
          applied: true,
          description: '목표 명확화 접두어 추가',
        };
      }
    }
    return { fixed: prompt, applied: false, description: '' };
  },

  /**
   * Fix vague references by extracting file names from context
   */
  'vague-reference': (prompt, ctx) => {
    // Pattern to find vague references
    const vaguePatterns = /이거|저거|그거|이것|저것|그것|this|that|it(?!\s+is)/gi;

    if (!vaguePatterns.test(prompt)) {
      return { fixed: prompt, applied: false, description: '' };
    }

    // Try to get specific reference from context
    let replacement = '해당 코드';

    if (ctx?.recentFiles && ctx.recentFiles.length > 0) {
      const fileName = ctx.recentFiles[0].split('/').pop() || ctx.recentFiles[0];
      replacement = `\`${fileName}\``;
    } else if (ctx?.currentTask) {
      replacement = ctx.currentTask.slice(0, 30);
    }

    // Only replace the first occurrence to avoid over-correction
    const fixed = prompt.replace(vaguePatterns, replacement);

    if (fixed !== prompt) {
      return {
        fixed,
        applied: true,
        description: `모호한 참조 → ${replacement}`,
      };
    }

    return { fixed: prompt, applied: false, description: '' };
  },

  /**
   * Fix unstructured context by adding XML section separators
   */
  'unstructured-context': (prompt, _ctx) => {
    // If prompt has long unstructured text (>200 chars without line breaks or structure)
    const hasLongUnstructured = /(?:[^\n]{200,})/.test(prompt);

    if (!hasLongUnstructured) {
      return { fixed: prompt, applied: false, description: '' };
    }

    // Try to identify and separate sections
    const parts: string[] = [];

    // Extract code blocks first (preserve them)
    const codeBlocks: string[] = [];
    let codeIndex = 0;
    const processedPrompt = prompt.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeIndex++}__`;
    });

    // Try to split by sentence boundaries
    const sentences = processedPrompt.split(/(?<=[.!?。])\s+/);

    // Categorize sentences
    const context: string[] = [];
    const task: string[] = [];
    const constraints: string[] = [];

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (/현재|상황|환경|프로젝트|currently|situation|background/i.test(lower)) {
        context.push(sentence);
      } else if (/하지|제외|without|don't|only|만/i.test(lower)) {
        constraints.push(sentence);
      } else {
        task.push(sentence);
      }
    }

    // Build structured prompt
    if (context.length > 0) {
      parts.push(`<context>\n${context.join(' ')}\n</context>`);
    }
    if (task.length > 0) {
      parts.push(`<task>\n${task.join(' ')}\n</task>`);
    }
    if (constraints.length > 0) {
      parts.push(`<constraints>\n${constraints.join('\n')}\n</constraints>`);
    }

    // Restore code blocks
    let fixed = parts.join('\n\n');
    codeBlocks.forEach((block, i) => {
      fixed = fixed.replace(`__CODE_BLOCK_${i}__`, block);
    });

    // Only apply if we actually created structure
    if (parts.length > 1) {
      return {
        fixed,
        applied: true,
        description: 'XML 섹션 구조화',
      };
    }

    return { fixed: prompt, applied: false, description: '' };
  },

  /**
   * Fix missing output format by adding category-specific defaults
   */
  'missing-output-format': (prompt, ctx) => {
    // Check if output format is already specified
    if (/형식|포맷|format|JSON|table|list|출력/i.test(prompt)) {
      return { fixed: prompt, applied: false, description: '' };
    }

    const category = detectSimpleCategory(prompt);
    const outputFormat = getCategoryOutputFormat(category, ctx);

    if (outputFormat) {
      const fixed = `${prompt}\n\n<output_format>\n${outputFormat}\n</output_format>`;
      return {
        fixed,
        applied: true,
        description: '출력 형식 추가',
      };
    }

    return { fixed: prompt, applied: false, description: '' };
  },

  /**
   * Fix retry without context
   */
  'retry-without-context': (prompt, ctx) => {
    if (!/^(?:다시|again|retry|한번 더).{0,20}$/i.test(prompt)) {
      return { fixed: prompt, applied: false, description: '' };
    }

    // Add context from session if available
    const additions: string[] = [];

    if (ctx?.currentTask) {
      additions.push(`작업: ${ctx.currentTask.slice(0, 50)}`);
    }
    if (ctx?.recentFiles && ctx.recentFiles.length > 0) {
      const file = ctx.recentFiles[0].split('/').pop();
      additions.push(`파일: ${file}`);
    }

    if (additions.length > 0) {
      const fixed = `${prompt}\n\n이전 컨텍스트:\n${additions.map(a => `- ${a}`).join('\n')}`;
      return {
        fixed,
        applied: true,
        description: '재시도 컨텍스트 추가',
      };
    }

    return { fixed: prompt, applied: false, description: '' };
  },

  /**
   * Fix implicit constraints by suggesting explicit ones
   */
  'implicit-constraints': (prompt, ctx) => {
    // If there are no explicit constraints but tech stack is known
    if (/만|without|제외|don't|not/.test(prompt)) {
      return { fixed: prompt, applied: false, description: '' };
    }

    if (ctx?.techStack && ctx.techStack.length > 0) {
      const techConstraints = getTechStackConstraints(ctx.techStack);
      if (techConstraints.length > 0) {
        const fixed = `${prompt}\n\n<constraints>\n${techConstraints.map(c => `- ${c}`).join('\n')}\n</constraints>`;
        return {
          fixed,
          applied: true,
          description: '기술 스택 제약조건 추가',
        };
      }
    }

    return { fixed: prompt, applied: false, description: '' };
  },
};

/**
 * Apply all relevant fixers to a prompt
 */
export function fixAntiPatterns(
  prompt: string,
  detectedPatterns: DetectedAntiPattern[],
  context?: FixerContext
): FixerResult {
  let currentPrompt = prompt;
  const appliedFixes: string[] = [];
  const fixedPatterns: string[] = [];

  // Sort patterns by severity (high first)
  const sortedPatterns = [...detectedPatterns].sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  // Apply fixers for each detected pattern
  for (const pattern of sortedPatterns) {
    const patternId = getPatternId(pattern.pattern);
    const fixer = FIXERS[patternId];

    if (fixer) {
      const result = fixer(currentPrompt, context);
      if (result.applied) {
        currentPrompt = result.fixed;
        appliedFixes.push(result.description);
        fixedPatterns.push(patternId);
      }
    }
  }

  return {
    fixedPrompt: currentPrompt,
    appliedFixes,
    fixedPatterns,
  };
}

/**
 * Map anti-pattern display name to ID
 */
function getPatternId(displayName: string): string {
  const mapping: Record<string, string> = {
    '모호한 목표': 'vague-objective',
    '모호한 참조': 'vague-reference',
    '정리되지 않은 컨텍스트': 'unstructured-context',
    '출력 형식 미지정': 'missing-output-format',
    '맥락 없는 재시도': 'retry-without-context',
    '암묵적 제약조건': 'implicit-constraints',
  };
  return mapping[displayName] || displayName.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Simple category detection for fixing
 */
function detectSimpleCategory(text: string): string {
  if (/에러|오류|버그|fix|error|bug/i.test(text)) return 'bug-fix';
  if (/만들어|생성|구현|create|implement/i.test(text)) return 'code-generation';
  if (/설명|알려|explain|tell/i.test(text)) return 'explanation';
  if (/테스트|test/i.test(text)) return 'testing';
  if (/리팩토링|refactor/i.test(text)) return 'refactoring';
  return 'general';
}

/**
 * Get category-specific goal prefix
 */
function getCategoryPrefix(category: string, ctx?: FixerContext): string | null {
  const prefixes: Record<string, string> = {
    'bug-fix': '[버그 수정] 다음 에러를 해결해주세요:',
    'code-generation': '[기능 구현] 다음을 구현해주세요:',
    'explanation': '[설명 요청] 다음에 대해 설명해주세요:',
    'testing': '[테스트 작성] 다음에 대한 테스트를 작성해주세요:',
    'refactoring': '[리팩토링] 다음 코드를 개선해주세요:',
    'general': '[작업 요청] 다음을 처리해주세요:',
  };

  let prefix = prefixes[category] || prefixes['general'];

  // Add project context if available
  if (ctx?.projectName) {
    prefix = `[${ctx.projectName}] ${prefix}`;
  }

  return prefix;
}

/**
 * Get category-specific output format
 */
function getCategoryOutputFormat(category: string, ctx?: FixerContext): string | null {
  const formats: Record<string, string[]> = {
    'bug-fix': ['- 에러 원인 분석', '- 수정된 코드', '- 재발 방지 방법'],
    'code-generation': ['- 전체 구현 코드 (import 포함)', '- 주요 로직 설명'],
    'explanation': ['- 개념 설명', '- 코드 예시', '- 실제 사용 사례'],
    'testing': ['- 테스트 코드', '- 테스트 케이스 설명'],
    'refactoring': ['- 리팩토링된 코드', '- 변경 사항 설명'],
    'general': ['- 구체적인 결과물'],
  };

  const format = formats[category] || formats['general'];

  // Add TypeScript type definition if tech stack includes TypeScript
  if (ctx?.techStack?.includes('TypeScript')) {
    format.push('- 타입 정의 포함');
  }

  return format.join('\n');
}

/**
 * Get tech stack specific constraints
 */
function getTechStackConstraints(techStack: string[]): string[] {
  const constraints: string[] = [];

  const techConstraints: Record<string, string> = {
    'TypeScript': '타입 안전성 유지',
    'React': '함수형 컴포넌트, hooks 패턴 사용',
    'Vue': 'Composition API 스타일',
    'Next.js': 'App Router 호환, SSR 고려',
    'Firebase': '보안 규칙 준수',
    'Electron': 'main/renderer 분리',
    'Node.js': 'async/await 패턴',
  };

  for (const tech of techStack) {
    if (techConstraints[tech]) {
      constraints.push(techConstraints[tech]);
    }
  }

  return constraints.slice(0, 3); // Max 3 constraints
}

/**
 * Check if a prompt has any fixable anti-patterns
 */
export function hasFixablePatterns(patterns: DetectedAntiPattern[]): boolean {
  return patterns.some(p => FIXERS[getPatternId(p.pattern)] !== undefined);
}
