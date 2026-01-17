/**
 * Classifier Unit Tests
 * Tests for prompt classification with language-aware matching
 */

import { describe, it, expect } from 'vitest';
import {
  extractFeatures,
  classifyIntent,
  classifyTaskCategory,
  classifyPrompt,
} from './classifier.js';

describe('extractFeatures', () => {
  it('should detect Korean language', () => {
    const features = extractFeatures('버그를 수정해줘');
    expect(features.languageHint).toBe('ko');
  });

  it('should detect English language', () => {
    const features = extractFeatures('Fix the authentication bug');
    expect(features.languageHint).toBe('en');
  });

  it('should detect mixed language', () => {
    const features = extractFeatures('React 컴포넌트를 만들어줘');
    expect(features.languageHint).toBe('mixed');
  });

  it('should detect code blocks', () => {
    const features = extractFeatures('Check this `const x = 1`');
    expect(features.hasCodeBlock).toBe(true);
  });

  it('should detect question marks', () => {
    const features = extractFeatures('How does this work?');
    expect(features.hasQuestionMark).toBe(true);
  });

  it('should calculate complexity', () => {
    expect(extractFeatures('Fix bug').complexity).toBe('simple');
    expect(
      extractFeatures('Please refactor this module to improve performance and add proper error handling')
        .complexity
    ).toBe('moderate');
  });
});

describe('classifyIntent', () => {
  describe('Korean prompts', () => {
    it('should classify command intent', () => {
      const result = classifyIntent('버그를 수정해줘');
      expect(result.intent).toBe('command');
      expect(result.matchedKeywords).toContain('해줘');
    });

    it('should classify question intent', () => {
      const result = classifyIntent('이 코드가 어떻게 작동하나요?');
      expect(result.intent).toBe('question');
    });

    it('should classify feedback intent', () => {
      const result = classifyIntent('감사합니다 완벽해요');
      expect(result.intent).toBe('feedback');
    });
  });

  describe('English prompts', () => {
    it('should classify command intent', () => {
      const result = classifyIntent('Create a new React component');
      expect(result.intent).toBe('command');
      expect(result.matchedKeywords).toContain('create');
    });

    it('should classify question intent', () => {
      const result = classifyIntent('How does authentication work?');
      expect(result.intent).toBe('question');
      expect(result.matchedKeywords).toContain('how');
    });

    it('should NOT match "then" in "authentication" (word boundary)', () => {
      const result = classifyIntent('How do I implement authentication?');
      expect(result.matchedKeywords).not.toContain('then');
      expect(result.matchedKeywords).toContain('how');
      expect(result.matchedKeywords).toContain('implement');
    });

    it('should match standalone "then" correctly', () => {
      const result = classifyIntent('First do this, then do that');
      expect(result.matchedKeywords).toContain('first');
      expect(result.matchedKeywords).toContain('then');
    });
  });

  describe('mixed language', () => {
    it('should match both Korean and English keywords', () => {
      const result = classifyIntent('then을 사용해서 비동기 처리해줘');
      expect(result.matchedKeywords).toContain('해줘');
      expect(result.matchedKeywords).toContain('then');
    });
  });
});

describe('classifyTaskCategory', () => {
  describe('Korean prompts', () => {
    it('should classify bug-fix category', () => {
      const result = classifyTaskCategory('버그를 수정해줘');
      expect(result.category).toBe('bug-fix');
    });

    it('should classify code-generation category', () => {
      const result = classifyTaskCategory('새로운 컴포넌트를 만들어줘');
      expect(result.category).toBe('code-generation');
    });

    it('should classify explanation category', () => {
      const result = classifyTaskCategory('이 함수가 뭐야? 설명해줘');
      expect(result.category).toBe('explanation');
    });
  });

  describe('English prompts', () => {
    it('should classify code-generation category', () => {
      const result = classifyTaskCategory('Create a user profile component');
      expect(result.category).toBe('code-generation');
    });

    it('should classify bug-fix category', () => {
      const result = classifyTaskCategory('Fix the login error');
      expect(result.category).toBe('bug-fix');
    });

    it('should classify explanation category', () => {
      const result = classifyTaskCategory('What is the difference between let and const?');
      expect(result.category).toBe('explanation');
    });

    it('should classify refactoring category', () => {
      const result = classifyTaskCategory('Refactor this code to improve readability');
      expect(result.category).toBe('refactoring');
    });
  });
});

describe('classifyPrompt (integration)', () => {
  it('should return complete classification for Korean prompt', () => {
    const result = classifyPrompt('버그를 수정해줘');
    expect(result.intent).toBe('command');
    expect(result.taskCategory).toBe('bug-fix');
    expect(result.intentConfidence).toBeGreaterThan(0.5);
    expect(result.categoryConfidence).toBeGreaterThan(0.5);
    expect(result.features.languageHint).toBe('ko');
  });

  it('should return complete classification for English prompt', () => {
    const result = classifyPrompt('How do I implement authentication?');
    expect(result.intent).toBe('question');
    expect(result.taskCategory).toBe('code-generation');
    expect(result.intentConfidence).toBeGreaterThan(0.8);
    expect(result.matchedKeywords).not.toContain('then');
  });

  it('should handle prompts with code blocks', () => {
    const result = classifyPrompt('Fix this bug: `const x = undefined`');
    expect(result.features.hasCodeBlock).toBe(true);
  });
});
