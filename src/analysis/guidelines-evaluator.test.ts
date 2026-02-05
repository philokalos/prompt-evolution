/**
 * Tests for Guidelines Evaluator
 * Verifies GOLDEN scoring and guideline evaluation
 */
import { describe, it, expect } from 'vitest';
import {
  evaluatePromptAgainstGuidelines,
  calculateGOLDENScore,
  evaluatePromptsAgainstGuidelines,
} from './guidelines-evaluator.js';

describe('calculateGOLDENScore', () => {
  describe('Goal dimension', () => {
    it('scores higher with clear objectives', () => {
      const clearGoal = '로그인 기능을 구현해줘';
      const vagueGoal = '이거 봐줘';

      const clearScore = calculateGOLDENScore(clearGoal);
      const vagueScore = calculateGOLDENScore(vagueGoal);

      expect(clearScore.goal).toBeGreaterThan(vagueScore.goal);
    });

    it('recognizes goal-related keywords', () => {
      const withKeywords = '목표는 사용자 인증 시스템을 구현하는 것입니다';
      const score = calculateGOLDENScore(withKeywords);

      expect(score.goal).toBeGreaterThan(0);
    });
  });

  describe('Output dimension', () => {
    it('scores higher with format specification', () => {
      const withFormat = 'JSON 형식으로 사용자 데이터 반환';
      const withoutFormat = '사용자 데이터 반환';

      const withScore = calculateGOLDENScore(withFormat);
      const withoutScore = calculateGOLDENScore(withoutFormat);

      expect(withScore.output).toBeGreaterThan(withoutScore.output);
    });

    it('recognizes example mentions', () => {
      const withExample = '예시를 포함해서 설명해주세요';
      const score = calculateGOLDENScore(withExample);

      expect(score.output).toBeGreaterThan(0);
    });
  });

  describe('Limits dimension', () => {
    it('scores higher with explicit constraints', () => {
      const withLimits = 'React만 사용하고 jQuery는 쓰지 마세요';
      const withoutLimits = 'UI를 만들어주세요';

      const withScore = calculateGOLDENScore(withLimits);
      const withoutScore = calculateGOLDENScore(withoutLimits);

      expect(withScore.limits).toBeGreaterThan(withoutScore.limits);
    });

    it('recognizes technology constraints', () => {
      const withTech = 'TypeScript와 React를 사용해서 구현해주세요';
      const score = calculateGOLDENScore(withTech);

      expect(score.limits).toBeGreaterThan(0);
    });
  });

  describe('Data dimension', () => {
    it('scores higher with code blocks', () => {
      const withCode = '```typescript\nconst x = 1;\n```\n이 코드를 수정해주세요';
      const withoutCode = '이 코드를 수정해주세요';

      const withScore = calculateGOLDENScore(withCode);
      const withoutScore = calculateGOLDENScore(withoutCode);

      expect(withScore.data).toBeGreaterThan(withoutScore.data);
    });

    it('scores higher with file paths', () => {
      const withPath = 'src/components/Button.tsx 파일을 수정해주세요';
      const withoutPath = '버튼을 수정해주세요';

      const withScore = calculateGOLDENScore(withPath);
      const withoutScore = calculateGOLDENScore(withoutPath);

      expect(withScore.data).toBeGreaterThan(withoutScore.data);
    });
  });

  describe('Evaluation dimension', () => {
    it('scores higher with success criteria', () => {
      const withCriteria = '테스트가 모두 통과하면 성공입니다';
      const withoutCriteria = '이걸 고쳐주세요';

      const withScore = calculateGOLDENScore(withCriteria);
      const withoutScore = calculateGOLDENScore(withoutCriteria);

      expect(withScore.evaluation).toBeGreaterThan(withoutScore.evaluation);
    });
  });

  describe('Next dimension', () => {
    it('scores higher with follow-up mentions', () => {
      const withNext = '완료 후에 테스트도 작성해주세요';
      const withoutNext = '이것만 해주세요';

      const withScore = calculateGOLDENScore(withNext);
      const withoutScore = calculateGOLDENScore(withoutNext);

      expect(withScore.next).toBeGreaterThan(withoutScore.next);
    });
  });

  describe('Total score', () => {
    it('calculates total as weighted sum', () => {
      const text = '목표: 로그인 기능 구현. 형식: React component. 제약: TypeScript만. 성공 기준: 테스트 통과.';
      const score = calculateGOLDENScore(text);

      // Total should be between 0 and 1
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(1);
    });

    it('higher total for comprehensive prompts', () => {
      const comprehensive = `
        목표: 사용자 프로필 페이지 구현

        요구사항:
        - React와 TypeScript 사용
        - Tailwind CSS로 스타일링
        - 반응형 디자인

        예시 JSON:
        \`\`\`json
        { "name": "홍길동", "email": "test@example.com" }
        \`\`\`

        성공 기준:
        - 모바일/데스크톱에서 정상 표시
        - 접근성 지원

        완료 후 단위 테스트도 작성해주세요.
      `;
      const simple = '프로필 만들어줘';

      const compScore = calculateGOLDENScore(comprehensive);
      const simpleScore = calculateGOLDENScore(simple);

      expect(compScore.total).toBeGreaterThan(simpleScore.total);
    });
  });
});

describe('evaluatePromptAgainstGuidelines', () => {
  it('returns evaluation with all required fields', () => {
    const result = evaluatePromptAgainstGuidelines('Create a React component');

    expect(result).toHaveProperty('overallScore');
    expect(result).toHaveProperty('guidelineScores');
    expect(result).toHaveProperty('goldenScore');
    expect(result).toHaveProperty('antiPatterns');
    expect(result).toHaveProperty('recommendations');
    expect(result).toHaveProperty('grade');
  });

  it('assigns appropriate grade', () => {
    const goodPrompt = `
      목표: 사용자 인증 시스템 구현

      기술 스택: React + TypeScript + Firebase

      요구사항:
      1. 이메일/비밀번호 로그인
      2. 소셜 로그인 (Google, GitHub)
      3. 세션 관리

      \`\`\`typescript
      interface User {
        id: string;
        email: string;
      }
      \`\`\`

      성공 기준: 모든 인증 플로우 작동
      다음 단계: 테스트 코드 작성
    `;

    const poorPrompt = '이거 해줘';

    const goodResult = evaluatePromptAgainstGuidelines(goodPrompt);
    const poorResult = evaluatePromptAgainstGuidelines(poorPrompt);

    // Good prompt should get better grade
    const gradeOrder = { A: 0, B: 1, C: 2, D: 3, F: 4 };
    expect(gradeOrder[goodResult.grade]).toBeLessThanOrEqual(gradeOrder[poorResult.grade]);
  });

  it('detects anti-patterns', () => {
    const vaguePrompt = '이거';

    const result = evaluatePromptAgainstGuidelines(vaguePrompt);

    expect(result.antiPatterns.length).toBeGreaterThan(0);
  });

  it('generates recommendations', () => {
    const incompletePrompt = '함수 만들어줘';

    const result = evaluatePromptAgainstGuidelines(incompletePrompt);

    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

describe('evaluatePromptsAgainstGuidelines', () => {
  it('evaluates multiple prompts', () => {
    const prompts = [
      'Create a React component',
      'Fix the bug',
      'Write tests',
    ];

    const result = evaluatePromptsAgainstGuidelines(prompts);

    expect(result.evaluations).toHaveLength(3);
    expect(result.summary).toBeDefined();
  });

  it('calculates summary statistics', () => {
    const prompts = [
      '로그인 기능을 React로 구현해주세요',
      '버그를 수정해주세요',
    ];

    const result = evaluatePromptsAgainstGuidelines(prompts);

    // averageScore is a weighted sum (can be 0-1 based on guideline weights)
    expect(result.summary.averageScore).toBeGreaterThanOrEqual(0);
    // averageGOLDEN (not goldenAverages) has the GOLDEN dimension averages
    expect(result.summary.averageGOLDEN).toBeDefined();
    expect(result.summary.averageGOLDEN.goal).toBeGreaterThanOrEqual(0);
    expect(result.summary.averageGOLDEN.goal).toBeLessThanOrEqual(1);
    expect(result.summary.gradeDistribution).toBeDefined();
  });

  it('handles empty array', () => {
    const result = evaluatePromptsAgainstGuidelines([]);

    expect(result.evaluations).toHaveLength(0);
    // For empty arrays, summary has default values
    expect(result.summary.averageScore).toBe(0);
    expect(result.summary.averageGOLDEN.total).toBe(0);
  });
});
