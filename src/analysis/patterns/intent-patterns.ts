/**
 * Intent Patterns
 * Patterns for classifying prompt intent
 */

export interface LanguagePatterns {
  ko: string[];
  en: string[];
}

/**
 * Intent pattern definitions
 */
export const INTENT_PATTERNS: Record<string, LanguagePatterns> = {
  command: {
    ko: [
      '해줘', '해주세요', '만들어', '작성해', '생성해', '추가해',
      '삭제해', '수정해', '변경해', '바꿔', '고쳐', '실행해',
    ],
    en: [
      'create', 'make', 'build', 'write', 'add', 'remove', 'delete',
      'update', 'modify', 'change', 'fix', 'run', 'execute', 'implement',
    ],
  },
  question: {
    ko: [
      '어떻게', '왜', '뭐', '무엇', '언제', '어디', '누가',
      '할 수 있나', '가능한가', '어떤가요', '인가요',
    ],
    en: [
      'how', 'why', 'what', 'when', 'where', 'who', 'which', 'can',
      'could', 'would', 'is it possible', 'do you know',
    ],
  },
  instruction: {
    ko: [
      '먼저', '다음', '그리고', '이후', '나중에', '순서대로',
      '단계별로', '과정', '절차', '방법',
    ],
    en: [
      'first', 'then', 'next', 'after', 'finally', 'step', 'process',
      'procedure', 'method', 'approach', 'way to',
    ],
  },
  feedback: {
    ko: [
      '감사', '고마워', '완벽', '좋아', '아니', '틀렸', '잘못',
      '안돼', '에러', '문제', '대박', '최고',
    ],
    en: [
      'thank', 'thanks', 'perfect', 'great', 'awesome', 'no', 'wrong',
      'incorrect', 'error', 'issue', 'problem', 'excellent',
    ],
  },
  context: {
    ko: [
      '현재', '지금', '상황', '환경', '사용 중', '프로젝트',
      '목표', '원하는', '필요한', '조건',
    ],
    en: [
      'currently', 'right now', 'situation', 'environment', 'using',
      'project', 'goal', 'need', 'want', 'require', 'condition',
    ],
  },
  clarification: {
    ko: [
      '무슨 뜻', '이해가 안', '다시 설명', '예를 들어', '예시',
      '구체적으로', '자세히', '명확하게',
    ],
    en: [
      'what do you mean', "don't understand", 'explain again', 'for example',
      'example', 'specifically', 'more detail', 'clarify', 'elaborate',
    ],
  },
};

/**
 * Get all keywords for an intent type
 */
export function getIntentKeywords(intent: string): string[] {
  const patterns = INTENT_PATTERNS[intent];
  if (!patterns) return [];
  return [...patterns.ko, ...patterns.en];
}

/**
 * Check if text matches intent pattern (language-aware matching)
 * Korean: substring matching | English: word boundary matching
 */
export function matchesIntent(text: string, intent: string): boolean {
  const patterns = INTENT_PATTERNS[intent];
  if (!patterns) return false;
  const lowerText = text.toLowerCase();
  // Korean: substring matching
  const koMatch = patterns.ko.some((kw) => lowerText.includes(kw.toLowerCase()));
  // English: word boundary matching
  const enMatch = patterns.en.some((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
  });
  return koMatch || enMatch;
}

/**
 * Find matching intent keywords in text (language-aware matching)
 */
export function findIntentKeywords(text: string, intent: string): string[] {
  const patterns = INTENT_PATTERNS[intent];
  if (!patterns) return [];
  const lowerText = text.toLowerCase();
  const matched: string[] = [];
  // Korean: substring matching
  patterns.ko.forEach((kw) => {
    if (lowerText.includes(kw.toLowerCase())) matched.push(kw);
  });
  // English: word boundary matching
  patterns.en.forEach((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) matched.push(kw);
  });
  return matched;
}
