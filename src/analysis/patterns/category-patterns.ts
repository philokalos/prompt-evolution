/**
 * Category Patterns
 * Patterns for classifying task categories
 */

export interface LanguagePatterns {
  ko: string[];
  en: string[];
}

/**
 * Task category pattern definitions
 */
export const CATEGORY_PATTERNS: Record<string, LanguagePatterns> = {
  'code-generation': {
    ko: ['만들어', '생성', '구현', '작성', '새로운', '추가'],
    en: ['create', 'generate', 'implement', 'write', 'new', 'add', 'build'],
  },
  'code-review': {
    ko: ['리뷰', '검토', '확인', '봐줘', '어떤가', '괜찮'],
    en: ['review', 'check', 'look at', 'examine', 'assess', 'evaluate'],
  },
  'bug-fix': {
    ko: ['버그', '오류', '에러', '문제', '안돼', '안됨', '수정', '고쳐'],
    en: ['bug', 'error', 'issue', 'problem', 'not working', 'fix', 'debug'],
  },
  refactoring: {
    ko: ['리팩토링', '리팩터', '개선', '정리', '최적화', '구조'],
    en: ['refactor', 'improve', 'clean', 'optimize', 'restructure', 'simplify'],
  },
  explanation: {
    ko: ['설명', '알려줘', '뭐야', '이해', '의미', '작동', '원리'],
    en: ['explain', 'tell me', 'what is', 'understand', 'meaning', 'how does', 'work'],
  },
  documentation: {
    ko: ['문서', '주석', '설명', 'README', '가이드', '매뉴얼'],
    en: ['document', 'comment', 'readme', 'guide', 'manual', 'docs', 'jsdoc'],
  },
  testing: {
    ko: ['테스트', '검증', '단위', '통합', '커버리지', 'jest', 'vitest'],
    en: ['test', 'spec', 'unit', 'integration', 'coverage', 'jest', 'vitest', 'e2e'],
  },
  architecture: {
    ko: ['설계', '아키텍처', '구조', '패턴', '디자인', '시스템'],
    en: ['architecture', 'design', 'structure', 'pattern', 'system', 'schema'],
  },
  deployment: {
    ko: ['배포', '빌드', '도커', 'CI', 'CD', '서버', '호스팅'],
    en: ['deploy', 'build', 'docker', 'ci', 'cd', 'server', 'hosting', 'kubernetes'],
  },
  'data-analysis': {
    ko: ['데이터', '분석', '쿼리', 'SQL', '통계', '그래프'],
    en: ['data', 'analysis', 'query', 'sql', 'statistics', 'chart', 'graph'],
  },
};

/**
 * Get all keywords for a category
 */
export function getCategoryKeywords(category: string): string[] {
  const patterns = CATEGORY_PATTERNS[category];
  if (!patterns) return [];
  return [...patterns.ko, ...patterns.en];
}

/**
 * Check if text matches category pattern
 */
export function matchesCategory(text: string, category: string): boolean {
  const keywords = getCategoryKeywords(category);
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Find matching category keywords in text
 */
export function findCategoryKeywords(text: string, category: string): string[] {
  const keywords = getCategoryKeywords(category);
  const lowerText = text.toLowerCase();
  return keywords.filter((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  );
}
