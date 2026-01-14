/**
 * Signal Patterns
 * Keywords and patterns for detecting conversation quality signals
 * (Moved from patterns.ts)
 */

export interface LanguagePatterns {
  ko: string[];
  en: string[];
}

/**
 * Positive feedback keywords (user satisfaction)
 */
export const POSITIVE_KEYWORDS: LanguagePatterns = {
  ko: [
    '감사', '고마워', '고맙', '완벽', '훌륭', '좋아', '좋네', '잘했',
    '대박', '멋져', '최고', '정확', '딱이야', '바로 이거', '원하던',
    '해결됐', '작동해', '동작해', '성공', '완료', 'ㄱㅅ', 'ㄳ', '굿',
  ],
  en: [
    'thank', 'thanks', 'perfect', 'excellent', 'great', 'awesome',
    'amazing', 'wonderful', 'exactly', 'works', 'working', 'solved',
    'fixed', 'done', 'nice', 'good job', 'well done', 'brilliant',
    'love it', 'nailed it', 'spot on', 'helpful', 'appreciate',
  ],
};

/**
 * Negative feedback keywords (user frustration)
 */
export const NEGATIVE_KEYWORDS: LanguagePatterns = {
  ko: [
    '아니', '틀렸', '잘못', '다시', '안돼', '안됨', '실패', '에러',
    '오류', '버그', '문제', '이상해', '왜 이래', '뭐야', '짜증',
    '답답', '이해 못', '모르겠', '헷갈', '복잡', '어려워',
  ],
  en: [
    'no', 'wrong', 'incorrect', 'error', 'bug', 'issue', 'problem',
    'fail', 'failed', 'broken', 'not working', "doesn't work", "don't work",
    'again', 'retry', 'redo', 'fix this', 'try again', 'confused',
    'frustrat', 'annoying', 'terrible', 'useless', 'waste',
  ],
};

/**
 * Retry indicator patterns
 */
export const RETRY_PATTERNS: LanguagePatterns = {
  ko: [
    '다시 해', '다시 시도', '한번 더', '다시 만들', '다시 작성',
    '수정해', '고쳐', '바꿔', '변경해', '다르게', '다른 방법',
  ],
  en: [
    'try again', 'redo', 'retry', 'again please', 'one more time',
    'do it again', 'start over', 'different approach', 'another way',
    'change this', 'modify', 'fix this', 'correct this',
  ],
};

/**
 * Task completion indicators
 */
export const COMPLETION_PATTERNS: LanguagePatterns = {
  ko: [
    '완료', '끝', '다 됐', '마무리', '완성', '배포', '커밋', '푸시',
    '머지', '릴리즈', '종료', '마침',
  ],
  en: [
    'done', 'complete', 'finished', 'deployed', 'committed', 'pushed',
    'merged', 'released', 'shipped', 'live', 'end', 'wrap up',
  ],
};

/**
 * Question patterns (user asking for help)
 */
export const QUESTION_PATTERNS: LanguagePatterns = {
  ko: [
    '어떻게', '왜', '뭐', '무엇', '언제', '어디', '누가', '얼마나',
    '할 수 있', '가능해', '되나요', '인가요', '일까', '는지',
  ],
  en: [
    'how', 'why', 'what', 'when', 'where', 'who', 'which', 'can you',
    'could you', 'would you', 'is it possible', 'do you know',
    'help me', 'explain', 'tell me', 'show me',
  ],
};

/**
 * Command patterns (direct instructions)
 */
export const COMMAND_PATTERNS: LanguagePatterns = {
  ko: [
    '해줘', '만들어', '작성해', '생성해', '추가해', '삭제해', '수정해',
    '변경해', '실행해', '테스트해', '빌드해', '배포해', '설치해',
  ],
  en: [
    'create', 'make', 'build', 'write', 'add', 'remove', 'delete',
    'update', 'modify', 'change', 'run', 'execute', 'test', 'deploy',
    'install', 'implement', 'fix', 'refactor',
  ],
};

/**
 * Context providing patterns
 */
export const CONTEXT_PATTERNS: LanguagePatterns = {
  ko: [
    '현재', '지금', '상황', '배경', '목표', '원하는', '필요한',
    '요구사항', '스펙', '조건', '제약', '환경',
  ],
  en: [
    'currently', 'right now', 'situation', 'background', 'goal',
    'objective', 'requirement', 'spec', 'constraint', 'condition',
    'environment', 'context', 'scenario', 'use case',
  ],
};

/**
 * All signal patterns combined
 */
export const ALL_SIGNAL_PATTERNS = {
  positive: POSITIVE_KEYWORDS,
  negative: NEGATIVE_KEYWORDS,
  retry: RETRY_PATTERNS,
  completion: COMPLETION_PATTERNS,
  question: QUESTION_PATTERNS,
  command: COMMAND_PATTERNS,
  context: CONTEXT_PATTERNS,
};

/**
 * Signal types
 */
export type SignalType =
  | 'positive_feedback'
  | 'negative_feedback'
  | 'retry_attempt'
  | 'task_completion'
  | 'question'
  | 'command'
  | 'context_providing';

/**
 * Get all keywords for a signal pattern type
 */
export function getSignalKeywords(patternType: keyof typeof ALL_SIGNAL_PATTERNS): string[] {
  const patterns = ALL_SIGNAL_PATTERNS[patternType];
  return [...patterns.ko, ...patterns.en];
}

/**
 * Check if text contains signal pattern
 */
export function containsSignalPattern(
  text: string,
  patternType: keyof typeof ALL_SIGNAL_PATTERNS
): boolean {
  const keywords = getSignalKeywords(patternType);
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Find matching signal keywords in text
 */
export function findSignalKeywords(
  text: string,
  patternType: keyof typeof ALL_SIGNAL_PATTERNS
): string[] {
  const keywords = getSignalKeywords(patternType);
  const lowerText = text.toLowerCase();
  return keywords.filter((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  );
}

/**
 * Count signal pattern matches in text
 */
export function countSignalMatches(
  text: string,
  patternType: keyof typeof ALL_SIGNAL_PATTERNS
): number {
  return findSignalKeywords(text, patternType).length;
}
