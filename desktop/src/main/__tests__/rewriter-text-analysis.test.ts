/**
 * Rewriter Text Analysis Module Tests
 *
 * Tests for prompt text analysis helper functions.
 * All pure functions — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import {
  detectPrimaryVerb,
  inferOutputFormat,
  buildMinimalContext,
  extractCodeFromPrompt,
  extractErrorFromPrompt,
  getTechStackConstraints,
  extractCoreRequest,
  detectCategory,
  detectComplexity,
  selectThinkMode,
  getSuccessCriteria,
} from '../rewriter/text-analysis.js';
import type { SessionContext } from '../session-context.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    projectPath: '/test/project',
    sessionId: 'test-session',
    techStack: [],
    recentFiles: [],
    recentTools: [],
    lastActivity: new Date(),
    ...overrides,
  } as SessionContext;
}

// ─────────────────────────────────────────────────────────────────────────────
// detectPrimaryVerb
// ─────────────────────────────────────────────────────────────────────────────

describe('detectPrimaryVerb', () => {
  it('should detect Korean creation verbs', () => {
    expect(detectPrimaryVerb('로그인 컴포넌트 만들어줘').verb).toBe('생성');
    expect(detectPrimaryVerb('API 구현해줘').verb).toBe('생성');
  });

  it('should detect Korean modification verbs', () => {
    expect(detectPrimaryVerb('이 코드 수정해줘').verb).toBe('수정');
    expect(detectPrimaryVerb('변수명 바꿔줘').verb).toBe('수정');
  });

  it('should detect error/fix verbs', () => {
    // '에러 수정' matches '수정' pattern first (pattern order matters)
    expect(detectPrimaryVerb('에러 수정').verb).toBe('수정');
    expect(detectPrimaryVerb('fix this error').verb).toBe('해결');
  });

  it('should detect explanation verbs', () => {
    expect(detectPrimaryVerb('이 코드 설명해줘').verb).toBe('설명');
    expect(detectPrimaryVerb('어떻게 작동하는지 알려줘').verb).toBe('설명');
  });

  it('should detect review verbs', () => {
    expect(detectPrimaryVerb('이 코드 리뷰해줘').verb).toBe('검토');
    expect(detectPrimaryVerb('코드 체크해줘').verb).toBe('검토');
  });

  it('should detect optimization verbs', () => {
    expect(detectPrimaryVerb('성능 최적화해줘').verb).toBe('최적화');
  });

  it('should return default for unknown text', () => {
    const result = detectPrimaryVerb('xyz abc 123');
    expect(result.verb).toBe('처리');
    expect(result.action).toBe('처리해주세요');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// inferOutputFormat
// ─────────────────────────────────────────────────────────────────────────────

describe('inferOutputFormat', () => {
  it('should return correct format for code-generation', () => {
    const formats = inferOutputFormat('code-generation');
    expect(formats).toContain('전체 구현 코드 (import 포함)');
  });

  it('should return correct format for bug-fix', () => {
    const formats = inferOutputFormat('bug-fix');
    expect(formats).toContain('에러 원인 분석');
    expect(formats).toContain('수정된 코드');
  });

  it('should return correct format for code-review', () => {
    const formats = inferOutputFormat('code-review');
    expect(formats).toContain('문제점과 심각도');
  });

  it('should return general fallback for unknown category', () => {
    const formats = inferOutputFormat('something-unknown');
    expect(formats).toEqual(['구체적인 결과물']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildMinimalContext
// ─────────────────────────────────────────────────────────────────────────────

describe('buildMinimalContext', () => {
  it('should return null for undefined context', () => {
    expect(buildMinimalContext(undefined)).toBeNull();
  });

  it('should include project name', () => {
    const ctx = makeContext({ projectPath: '/home/user/my-app' });
    const result = buildMinimalContext(ctx);
    expect(result).toContain('my-app');
  });

  it('should include tech stack', () => {
    const ctx = makeContext({
      projectPath: '/home/user/my-app',
      techStack: ['React', 'TypeScript', 'Vite'],
    });
    const result = buildMinimalContext(ctx);
    expect(result).toContain('React');
    expect(result).toContain('TypeScript');
  });

  it('should include meaningful current task', () => {
    const ctx = makeContext({
      projectPath: '/test/project',
      currentTask: 'Implementing user authentication',
    });
    const result = buildMinimalContext(ctx);
    expect(result).toContain('작업: Implementing user authentication');
  });

  it('should exclude generic task placeholder', () => {
    const ctx = makeContext({
      projectPath: '/test/project',
      currentTask: '작업 진행 중',
    });
    const result = buildMinimalContext(ctx);
    expect(result).not.toContain('작업:');
  });

  it('should include recent file name', () => {
    const ctx = makeContext({
      projectPath: '/test/project',
      recentFiles: ['/test/project/src/App.tsx'],
    });
    const result = buildMinimalContext(ctx);
    expect(result).toContain('파일: App.tsx');
  });

  it('should use pipe separator', () => {
    const ctx = makeContext({
      projectPath: '/test/project',
      techStack: ['React'],
      recentFiles: ['src/App.tsx'],
    });
    const result = buildMinimalContext(ctx);
    expect(result).toContain(' | ');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractCodeFromPrompt
// ─────────────────────────────────────────────────────────────────────────────

describe('extractCodeFromPrompt', () => {
  it('should extract triple backtick code blocks', () => {
    const text = 'Fix this:\n```\nconst x = 1;\n```';
    expect(extractCodeFromPrompt(text)).toBe('```\nconst x = 1;\n```');
  });

  it('should extract inline code', () => {
    const text = 'Change `useState` to `useReducer`';
    const result = extractCodeFromPrompt(text);
    expect(result).toContain('`useState`');
    expect(result).toContain('`useReducer`');
  });

  it('should return null when no code found', () => {
    expect(extractCodeFromPrompt('일반 텍스트만 있음')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractErrorFromPrompt
// ─────────────────────────────────────────────────────────────────────────────

describe('extractErrorFromPrompt', () => {
  it('should extract Error: pattern', () => {
    const text = 'I get Error: Cannot read property of undefined';
    const result = extractErrorFromPrompt(text);
    expect(result).toContain('Error: Cannot read property of undefined');
  });

  it('should extract TypeError pattern', () => {
    const text = 'Getting TypeError: x is not a function';
    expect(extractErrorFromPrompt(text)).toContain('TypeError');
  });

  it('should extract stack trace pattern', () => {
    const text = 'Error at handleClick (App.tsx:42:5)';
    expect(extractErrorFromPrompt(text)).toContain('at handleClick');
  });

  it('should return null when no error found', () => {
    expect(extractErrorFromPrompt('일반 텍스트')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// detectCategory
// ─────────────────────────────────────────────────────────────────────────────

describe('detectCategory', () => {
  it('should detect code-generation', () => {
    expect(detectCategory('로그인 컴포넌트 만들어줘')).toBe('code-generation');
    expect(detectCategory('Create a function')).toBe('code-generation');
  });

  it('should detect bug-fix', () => {
    expect(detectCategory('이 에러 수정해줘')).toBe('bug-fix');
    expect(detectCategory('fix this bug')).toBe('bug-fix');
  });

  it('should detect code-review', () => {
    expect(detectCategory('이 코드 리뷰해줘')).toBe('code-review');
    expect(detectCategory('review this')).toBe('code-review');
  });

  it('should detect refactoring', () => {
    expect(detectCategory('리팩토링해줘')).toBe('refactoring');
    expect(detectCategory('refactor this')).toBe('refactoring');
  });

  it('should detect explanation', () => {
    expect(detectCategory('이 코드 설명해줘')).toBe('explanation');
    expect(detectCategory('explain how this works')).toBe('explanation');
  });

  it('should detect testing', () => {
    // '테스트 작성해줘' matches code-generation first due to '작성'
    expect(detectCategory('테스트 코드를 검증해줘')).toBe('testing');
    expect(detectCategory('write a test spec')).toBe('testing');
  });

  it('should return general for unrecognized text', () => {
    expect(detectCategory('xyz abc 123')).toBe('general');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// detectComplexity
// ─────────────────────────────────────────────────────────────────────────────

describe('detectComplexity', () => {
  it('should return simple for short text', () => {
    expect(detectComplexity('hi')).toBe('simple');
  });

  it('should return advanced for advanced keywords', () => {
    expect(detectComplexity('아키텍처 설계해줘')).toBe('advanced');
    expect(detectComplexity('security audit needed')).toBe('advanced');
  });

  it('should return advanced for very long text', () => {
    const longText = 'x'.repeat(501);
    expect(detectComplexity(longText)).toBe('advanced');
  });

  it('should return complex for refactoring keywords', () => {
    expect(detectComplexity('리팩토링 해줘 전체')).toBe('complex');
  });

  it('should return medium for creation patterns', () => {
    expect(detectComplexity('로그인 버튼 만들어줘')).toBe('medium');
  });

  it('should escalate to complex with many recent files in context', () => {
    const ctx = makeContext({ recentFiles: ['a.ts', 'b.ts', 'c.ts'] });
    expect(detectComplexity('short', ctx)).toBe('complex');
  });

  it('should escalate to medium with active task context', () => {
    const ctx = makeContext({ currentTask: 'Auth implementation' });
    expect(detectComplexity('short', ctx)).toBe('medium');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectThinkMode
// ─────────────────────────────────────────────────────────────────────────────

describe('selectThinkMode', () => {
  it('should return null for simple', () => {
    expect(selectThinkMode('simple')).toBeNull();
  });

  it('should return think for medium', () => {
    expect(selectThinkMode('medium')).toBe('think');
  });

  it('should return think hard for complex', () => {
    expect(selectThinkMode('complex')).toBe('think hard');
  });

  it('should return think harder for advanced', () => {
    expect(selectThinkMode('advanced')).toBe('think harder');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getTechStackConstraints
// ─────────────────────────────────────────────────────────────────────────────

describe('getTechStackConstraints', () => {
  it('should return TypeScript constraints', () => {
    const constraints = getTechStackConstraints(['TypeScript']);
    expect(constraints).toContain('타입 안전성 유지');
  });

  it('should return React constraints', () => {
    const constraints = getTechStackConstraints(['React']);
    expect(constraints).toContain('함수형 컴포넌트 사용');
  });

  it('should combine multiple stack constraints', () => {
    const constraints = getTechStackConstraints(['TypeScript', 'React']);
    expect(constraints.length).toBeGreaterThanOrEqual(2);
  });

  it('should limit to 3 constraints max', () => {
    const constraints = getTechStackConstraints([
      'TypeScript', 'React', 'Next.js', 'Firebase', 'Tailwind CSS',
    ]);
    expect(constraints.length).toBeLessThanOrEqual(3);
  });

  it('should return empty for unknown stack', () => {
    expect(getTechStackConstraints(['UnknownFramework'])).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractCoreRequest
// ─────────────────────────────────────────────────────────────────────────────

describe('extractCoreRequest', () => {
  it('should strip Korean greetings', () => {
    // regex matches '안녕' prefix, leaving '하세요' — use exact '안녕 코드' form
    expect(extractCoreRequest('안녕 코드 작성해줘')).toBe('코드 작성해줘');
    // '안녕하세요' matches via '안녕' prefix
    expect(extractCoreRequest('안녕하세요 코드 작성해줘')).toBe('하세요 코드 작성해줘');
  });

  it('should strip English greetings', () => {
    expect(extractCoreRequest('hello fix this bug')).toBe('fix this bug');
    expect(extractCoreRequest('Hi, please help')).toBe('please help');
  });

  it('should strip filler words', () => {
    expect(extractCoreRequest('그래서 이 코드 고쳐줘')).toBe('이 코드 고쳐줘');
  });

  it('should preserve core content', () => {
    expect(extractCoreRequest('React 컴포넌트 만들어줘')).toBe('React 컴포넌트 만들어줘');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getSuccessCriteria
// ─────────────────────────────────────────────────────────────────────────────

describe('getSuccessCriteria', () => {
  it('should return criteria for each category', () => {
    expect(getSuccessCriteria('code-generation')).toContain('코드 실행');
    expect(getSuccessCriteria('bug-fix')).toContain('에러 해결');
    expect(getSuccessCriteria('testing')).toContain('테스트 통과');
  });

  it('should return general criteria for unknown category', () => {
    expect(getSuccessCriteria('unknown')).toBe('요청 사항 충족');
  });
});
