/**
 * Prompt Classifier
 * Rule-based classification of user prompts by intent and task category
 */

import {
  containsPattern,
  countPatternMatches,
  findMatchingKeywords,
} from './patterns.js';

/**
 * Prompt intent types
 */
export type PromptIntent =
  | 'command' // Direct instructions: "만들어줘", "create"
  | 'question' // Questions: "왜", "how"
  | 'instruction' // Detailed instructions with context
  | 'feedback' // Response to AI output: "좋아", "아니"
  | 'context' // Providing background information
  | 'clarification' // Asking for clarification
  | 'unknown';

/**
 * Task category types
 */
export type TaskCategory =
  | 'code-generation' // Creating new code
  | 'code-review' // Reviewing existing code
  | 'bug-fix' // Fixing bugs
  | 'refactoring' // Improving code structure
  | 'explanation' // Explaining concepts
  | 'documentation' // Writing docs
  | 'testing' // Writing tests
  | 'architecture' // System design
  | 'deployment' // DevOps tasks
  | 'data-analysis' // Data work
  | 'general' // General tasks
  | 'unknown';

/**
 * Classification result
 */
export interface ClassificationResult {
  intent: PromptIntent;
  intentConfidence: number;
  taskCategory: TaskCategory;
  categoryConfidence: number;
  matchedKeywords: string[];
  features: PromptFeatures;
}

/**
 * Type alias for backward compatibility
 */
export type PromptClassification = ClassificationResult;

/**
 * Extracted prompt features
 */
export interface PromptFeatures {
  length: number;
  wordCount: number;
  hasCodeBlock: boolean;
  hasUrl: boolean;
  hasFilePath: boolean;
  hasQuestionMark: boolean;
  hasExclamationMark: boolean;
  languageHint: 'ko' | 'en' | 'mixed';
  complexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Intent classification patterns
 */
const INTENT_PATTERNS = {
  command: {
    ko: [
      '해줘', '만들어', '작성해', '생성해', '추가해', '삭제해', '수정해',
      '변경해', '실행해', '설치해', '빌드해', '배포해', '테스트해',
      '구현해', '적용해', '설정해', '확인해', '보여줘', '알려줘',
    ],
    en: [
      'create', 'make', 'build', 'write', 'add', 'remove', 'delete',
      'update', 'modify', 'change', 'run', 'execute', 'install',
      'deploy', 'test', 'implement', 'show', 'tell', 'fix', 'refactor',
    ],
  },
  question: {
    ko: [
      '뭐야', '뭔가', '무엇', '왜', '어떻게', '언제', '어디', '누가',
      '얼마나', '몇', '인가요', '일까', '는지', '나요', '을까',
    ],
    en: [
      'what', 'why', 'how', 'when', 'where', 'who', 'which', 'whose',
      'is it', 'are there', 'can you', 'could you', 'would you',
      'do you', 'does it', 'should i', 'is there',
    ],
  },
  feedback: {
    ko: [
      '좋아', '좋네', '훌륭', '완벽', '고마워', '감사', '아니', '틀렸',
      '잘못', '다시', '수정', '바꿔', 'ㅇㅋ', 'ㄱㅅ', '굿',
    ],
    en: [
      'good', 'great', 'perfect', 'thanks', 'thank you', 'no', 'wrong',
      'incorrect', 'again', 'change', 'modify', 'ok', 'okay', 'nice',
      'awesome', 'not what', "that's not",
    ],
  },
  context: {
    ko: [
      '현재', '지금', '상황', '배경', '목표', '원하는', '필요한',
      '프로젝트', '환경', '버전', '사용하고', '있는데', '있어서',
    ],
    en: [
      'currently', 'right now', 'situation', 'background', 'goal',
      'want to', 'need to', 'project', 'environment', 'version',
      'using', 'working on', 'trying to', 'context',
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
 * Task category patterns
 */
const CATEGORY_PATTERNS = {
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
 * Extract features from prompt text
 */
export function extractFeatures(text: string): PromptFeatures {
  const length = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const hasCodeBlock = /```[\s\S]*?```/.test(text) || /`[^`]+`/.test(text);
  const hasUrl = /https?:\/\/[^\s]+/.test(text);
  const hasFilePath = /[\/\\][\w.-]+\.[a-z]+/i.test(text) || /src\/|\.tsx?|\.jsx?/.test(text);
  const hasQuestionMark = text.includes('?');
  const hasExclamationMark = text.includes('!');

  // Detect language
  const koChars = (text.match(/[가-힣]/g) || []).length;
  const enChars = (text.match(/[a-zA-Z]/g) || []).length;
  let languageHint: 'ko' | 'en' | 'mixed';
  if (koChars > enChars * 2) {
    languageHint = 'ko';
  } else if (enChars > koChars * 2) {
    languageHint = 'en';
  } else {
    languageHint = 'mixed';
  }

  // Estimate complexity
  let complexity: 'simple' | 'moderate' | 'complex';
  if (wordCount < 10 && !hasCodeBlock) {
    complexity = 'simple';
  } else if (wordCount < 50 || (hasCodeBlock && wordCount < 100)) {
    complexity = 'moderate';
  } else {
    complexity = 'complex';
  }

  return {
    length,
    wordCount,
    hasCodeBlock,
    hasUrl,
    hasFilePath,
    hasQuestionMark,
    hasExclamationMark,
    languageHint,
    complexity,
  };
}

/**
 * Classify prompt intent
 */
export function classifyIntent(text: string): {
  intent: PromptIntent;
  confidence: number;
  matchedKeywords: string[];
} {
  const lowerText = text.toLowerCase();
  const features = extractFeatures(text);
  const allMatched: string[] = [];

  // Score each intent
  const scores: Record<string, number> = {
    command: 0,
    question: 0,
    feedback: 0,
    context: 0,
    clarification: 0,
  };

  // Check patterns
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    const allKeywords = [...patterns.ko, ...patterns.en];
    for (const keyword of allKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        scores[intent]++;
        allMatched.push(keyword);
      }
    }
  }

  // Boost question score if has question mark
  if (features.hasQuestionMark) {
    scores.question += 2;
  }

  // Find highest scoring intent
  let maxIntent: PromptIntent = 'unknown';
  let maxScore = 0;

  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxIntent = intent as PromptIntent;
    }
  }

  // If command and question tie, prefer command if no question mark
  if (scores.command === scores.question && !features.hasQuestionMark) {
    maxIntent = 'command';
  }

  // Calculate confidence
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence =
    totalScore > 0 ? Math.min(maxScore / totalScore + 0.2, 1.0) : 0.5;

  // If no matches, try to infer from features
  if (maxScore === 0) {
    if (features.hasQuestionMark) {
      maxIntent = 'question';
    } else if (features.complexity === 'complex') {
      maxIntent = 'instruction';
    } else {
      maxIntent = 'command';
    }
  }

  return {
    intent: maxIntent,
    confidence,
    matchedKeywords: allMatched,
  };
}

/**
 * Classify task category
 */
export function classifyTaskCategory(text: string): {
  category: TaskCategory;
  confidence: number;
} {
  const lowerText = text.toLowerCase();

  const scores: Record<string, number> = {};

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    scores[category] = 0;
    const allKeywords = [...patterns.ko, ...patterns.en];
    for (const keyword of allKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        scores[category]++;
      }
    }
  }

  let maxCategory: TaskCategory = 'general';
  let maxScore = 0;

  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxCategory = category as TaskCategory;
    }
  }

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence =
    totalScore > 0 ? Math.min(maxScore / totalScore + 0.15, 1.0) : 0.3;

  if (maxScore === 0) {
    maxCategory = 'unknown';
  }

  return {
    category: maxCategory,
    confidence,
  };
}

/**
 * Full classification of a prompt
 */
export function classifyPrompt(text: string): ClassificationResult {
  const features = extractFeatures(text);
  const intentResult = classifyIntent(text);
  const categoryResult = classifyTaskCategory(text);

  return {
    intent: intentResult.intent,
    intentConfidence: intentResult.confidence,
    taskCategory: categoryResult.category,
    categoryConfidence: categoryResult.confidence,
    matchedKeywords: intentResult.matchedKeywords,
    features,
  };
}

/**
 * Get human-readable intent label
 */
export function getIntentLabel(intent: PromptIntent): string {
  const labels: Record<PromptIntent, string> = {
    command: '⚡ 명령',
    question: '❓ 질문',
    instruction: '📝 지시',
    feedback: '💬 피드백',
    context: '📋 컨텍스트',
    clarification: '🔍 명확화 요청',
    unknown: '❔ 미분류',
  };
  return labels[intent];
}

/**
 * Get human-readable category label
 */
export function getCategoryLabel(category: TaskCategory): string {
  const labels: Record<TaskCategory, string> = {
    'code-generation': '🔨 코드 생성',
    'code-review': '👀 코드 리뷰',
    'bug-fix': '🐛 버그 수정',
    refactoring: '♻️ 리팩토링',
    explanation: '💡 설명',
    documentation: '📖 문서화',
    testing: '🧪 테스트',
    architecture: '🏗️ 아키텍처',
    deployment: '🚀 배포',
    'data-analysis': '📊 데이터 분석',
    general: '📌 일반',
    unknown: '❔ 미분류',
  };
  return labels[category];
}

/**
 * Batch classify multiple prompts
 */
export function classifyPrompts(texts: string[]): ClassificationResult[] {
  return texts.map(classifyPrompt);
}

/**
 * Get classification statistics
 */
export interface ClassificationStats {
  totalPrompts: number;
  intentDistribution: Record<PromptIntent, number>;
  categoryDistribution: Record<TaskCategory, number>;
  avgIntentConfidence: number;
  avgCategoryConfidence: number;
}

export function getClassificationStats(
  results: ClassificationResult[]
): ClassificationStats {
  const stats: ClassificationStats = {
    totalPrompts: results.length,
    intentDistribution: {
      command: 0,
      question: 0,
      instruction: 0,
      feedback: 0,
      context: 0,
      clarification: 0,
      unknown: 0,
    },
    categoryDistribution: {
      'code-generation': 0,
      'code-review': 0,
      'bug-fix': 0,
      refactoring: 0,
      explanation: 0,
      documentation: 0,
      testing: 0,
      architecture: 0,
      deployment: 0,
      'data-analysis': 0,
      general: 0,
      unknown: 0,
    },
    avgIntentConfidence: 0,
    avgCategoryConfidence: 0,
  };

  if (results.length === 0) return stats;

  let totalIntentConf = 0;
  let totalCategoryConf = 0;

  for (const result of results) {
    stats.intentDistribution[result.intent]++;
    stats.categoryDistribution[result.taskCategory]++;
    totalIntentConf += result.intentConfidence;
    totalCategoryConf += result.categoryConfidence;
  }

  stats.avgIntentConfidence = totalIntentConf / results.length;
  stats.avgCategoryConfidence = totalCategoryConf / results.length;

  return stats;
}
