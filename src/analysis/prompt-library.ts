/**
 * Prompt Library Module
 * 실제 사용 사례 기반 프롬프트 패턴 추출 및 라이브러리 구축
 */

import { TaskCategory, PromptIntent, classifyPrompt, extractFeatures } from './classifier.js';

/**
 * 프롬프트 라이브러리 항목
 */
export interface PromptLibraryEntry {
  id: string;
  pattern: string;              // 재사용 가능한 프롬프트 템플릿
  category: TaskCategory;       // 작업 유형
  intent: PromptIntent;         // 의도 유형
  effectiveness: number;        // 효과성 점수 (0-1)
  frequency: number;            // 사용 빈도
  examples: PromptExample[];    // 실제 사용 예시
  keywords: string[];           // 핵심 키워드
  bestPractices: string[];      // 적용된 모범 사례
  antiPatterns: string[];       // 발견된 안티패턴
  averageLength: number;        // 평균 길이
  successRate: number;          // 성공률
}

/**
 * 프롬프트 예시
 */
export interface PromptExample {
  content: string;
  effectiveness: number;
  timestamp: Date;
  conversationId: string;
}

/**
 * 프롬프트 라이브러리
 */
export interface PromptLibrary {
  entries: PromptLibraryEntry[];
  totalPrompts: number;
  generatedAt: Date;
  topPatterns: PromptLibraryEntry[];  // 상위 효과성 패턴
  byCategory: Record<TaskCategory, PromptLibraryEntry[]>;
  byIntent: Record<PromptIntent, PromptLibraryEntry[]>;
}

/**
 * 분석용 프롬프트 데이터
 */
export interface PromptDataForLibrary {
  content: string;
  conversationId: string;
  timestamp: Date;
  effectiveness: number;
}

/**
 * 프롬프트 패턴 추출 - 유사 프롬프트 그룹화
 */
export function extractPromptPatterns(prompts: PromptDataForLibrary[]): PromptLibraryEntry[] {
  if (prompts.length === 0) return [];

  // 카테고리별로 그룹화
  const categoryGroups = new Map<TaskCategory, PromptDataForLibrary[]>();

  for (const prompt of prompts) {
    const classification = classifyPrompt(prompt.content);
    const category = classification.taskCategory;

    if (!categoryGroups.has(category)) {
      categoryGroups.set(category, []);
    }
    categoryGroups.get(category)!.push(prompt);
  }

  const entries: PromptLibraryEntry[] = [];
  let entryId = 1;

  // 각 카테고리에서 패턴 추출
  for (const [category, categoryPrompts] of categoryGroups) {
    if (category === 'unknown' || categoryPrompts.length < 2) continue;

    // 의도별로 다시 그룹화
    const intentGroups = new Map<PromptIntent, PromptDataForLibrary[]>();

    for (const prompt of categoryPrompts) {
      const classification = classifyPrompt(prompt.content);
      const intent = classification.intent;

      if (!intentGroups.has(intent)) {
        intentGroups.set(intent, []);
      }
      intentGroups.get(intent)!.push(prompt);
    }

    for (const [intent, intentPrompts] of intentGroups) {
      if (intentPrompts.length < 2) continue;

      // 키워드 추출
      const keywords = extractCommonKeywords(intentPrompts.map(p => p.content));

      // 패턴 템플릿 생성
      const pattern = generatePatternTemplate(intentPrompts.map(p => p.content), category, intent);

      // 모범 사례 분석
      const bestPractices = analyzeBestPractices(intentPrompts);

      // 안티패턴 탐지
      const antiPatterns = detectPromptAntiPatterns(intentPrompts);

      // 효과성 점수 계산
      const avgEffectiveness = intentPrompts.reduce((sum, p) => sum + p.effectiveness, 0) / intentPrompts.length;

      // 성공률 계산 (효과성 > 0.6을 성공으로 간주)
      const successCount = intentPrompts.filter(p => p.effectiveness >= 0.6).length;
      const successRate = successCount / intentPrompts.length;

      // 평균 길이
      const avgLength = intentPrompts.reduce((sum, p) => sum + p.content.length, 0) / intentPrompts.length;

      // 예시 선택 (효과성 높은 순으로 최대 3개)
      const examples: PromptExample[] = intentPrompts
        .sort((a, b) => b.effectiveness - a.effectiveness)
        .slice(0, 3)
        .map(p => ({
          content: p.content,
          effectiveness: p.effectiveness,
          timestamp: p.timestamp,
          conversationId: p.conversationId,
        }));

      entries.push({
        id: `pattern-${entryId++}`,
        pattern,
        category,
        intent,
        effectiveness: avgEffectiveness,
        frequency: intentPrompts.length,
        examples,
        keywords,
        bestPractices,
        antiPatterns,
        averageLength: avgLength,
        successRate,
      });
    }
  }

  // 효과성 순으로 정렬
  return entries.sort((a, b) => b.effectiveness - a.effectiveness);
}

/**
 * 공통 키워드 추출
 */
function extractCommonKeywords(texts: string[]): string[] {
  const wordCounts = new Map<string, number>();
  const stopWords = new Set([
    '이', '가', '은', '는', '을', '를', '에', '의', '로', '으로', '와', '과',
    'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    '해줘', '해', '좀', '이거', '저거', '것', '수', '있', '없',
    'please', 'can', 'you', 'could', 'would', 'should', 'this', 'that',
  ]);

  for (const text of texts) {
    // 단어 추출 (한글, 영문, 숫자)
    const words = text.toLowerCase()
      .match(/[가-힣]+|[a-z]+/gi) || [];

    const uniqueWords = new Set(words);
    for (const word of uniqueWords) {
      if (word.length >= 2 && !stopWords.has(word)) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
  }

  // 빈도가 높은 상위 10개 키워드
  return Array.from(wordCounts.entries())
    .filter(([_, count]) => count >= Math.max(2, texts.length * 0.3))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * 패턴 템플릿 생성
 */
function generatePatternTemplate(texts: string[], category: TaskCategory, intent: PromptIntent): string {
  // 카테고리와 의도별 템플릿 프리픽스
  const prefixes: Record<TaskCategory, string> = {
    'code-generation': '[코드 생성]',
    'code-review': '[코드 리뷰]',
    'bug-fix': '[버그 수정]',
    'refactoring': '[리팩토링]',
    'explanation': '[설명 요청]',
    'documentation': '[문서화]',
    'testing': '[테스트]',
    'architecture': '[아키텍처]',
    'deployment': '[배포]',
    'data-analysis': '[데이터 분석]',
    'general': '[일반]',
    'unknown': '[미분류]',
  };

  const intentSuffixes: Record<PromptIntent, string> = {
    'command': '~해줘/해라',
    'question': '~인가요?/뭔가요?',
    'instruction': '(상세 지시)',
    'feedback': '(피드백)',
    'context': '(컨텍스트 제공)',
    'clarification': '~가 뭔가요?/설명해줘',
    'unknown': '',
  };

  // 공통 키워드 기반 템플릿
  const keywords = extractCommonKeywords(texts);
  const keywordPart = keywords.length > 0 ? `[${keywords.slice(0, 3).join(', ')}]` : '';

  return `${prefixes[category]} ${keywordPart} ${intentSuffixes[intent]}`.trim();
}

/**
 * 모범 사례 분석
 */
function analyzeBestPractices(prompts: PromptDataForLibrary[]): string[] {
  const practices: string[] = [];

  // 효과적인 프롬프트 분석 (상위 30%)
  const sorted = [...prompts].sort((a, b) => b.effectiveness - a.effectiveness);
  const topPrompts = sorted.slice(0, Math.max(1, Math.ceil(prompts.length * 0.3)));

  // 특성 분석
  for (const prompt of topPrompts) {
    const features = extractFeatures(prompt.content);

    // 코드 블록 사용
    if (features.hasCodeBlock) {
      if (!practices.includes('코드 블록으로 예시 제공')) {
        practices.push('코드 블록으로 예시 제공');
      }
    }

    // 파일 경로 명시
    if (features.hasFilePath) {
      if (!practices.includes('구체적인 파일 경로 명시')) {
        practices.push('구체적인 파일 경로 명시');
      }
    }

    // URL 참조
    if (features.hasUrl) {
      if (!practices.includes('관련 URL/문서 참조')) {
        practices.push('관련 URL/문서 참조');
      }
    }

    // 적절한 길이 (50-300자)
    if (features.length >= 50 && features.length <= 300) {
      if (!practices.includes('적절한 프롬프트 길이 (50-300자)')) {
        practices.push('적절한 프롬프트 길이 (50-300자)');
      }
    }

    // 구체적인 지시 (단어 수 10개 이상)
    if (features.wordCount >= 10) {
      if (!practices.includes('구체적이고 상세한 지시')) {
        practices.push('구체적이고 상세한 지시');
      }
    }
  }

  // 컨텍스트 패턴 분석
  const contextPatterns = [
    { pattern: /현재|지금|상황/, practice: '현재 상황 설명' },
    { pattern: /목표|원하는|필요/, practice: '목표/기대 결과 명시' },
    { pattern: /에러|오류|문제/, practice: '문제 상황 구체적 설명' },
    { pattern: /버전|환경|설정/, practice: '환경/버전 정보 제공' },
  ];

  for (const { pattern, practice } of contextPatterns) {
    const hasPattern = topPrompts.some(p => pattern.test(p.content));
    if (hasPattern && !practices.includes(practice)) {
      practices.push(practice);
    }
  }

  return practices;
}

/**
 * 프롬프트 안티패턴 탐지
 */
function detectPromptAntiPatterns(prompts: PromptDataForLibrary[]): string[] {
  const antiPatterns: string[] = [];

  // 비효과적인 프롬프트 분석 (하위 30%)
  const sorted = [...prompts].sort((a, b) => a.effectiveness - b.effectiveness);
  const bottomPrompts = sorted.slice(0, Math.max(1, Math.ceil(prompts.length * 0.3)));

  for (const prompt of bottomPrompts) {
    const content = prompt.content;
    const features = extractFeatures(content);

    // 너무 짧은 프롬프트
    if (features.length < 20) {
      if (!antiPatterns.includes('너무 짧은 프롬프트 (20자 미만)')) {
        antiPatterns.push('너무 짧은 프롬프트 (20자 미만)');
      }
    }

    // 모호한 지시어
    if (/이거|저거|그거|이것|저것|그것/.test(content)) {
      if (!antiPatterns.includes('모호한 지시어 사용 (이거, 저거)')) {
        antiPatterns.push('모호한 지시어 사용 (이거, 저거)');
      }
    }

    // 맥락 없는 요청
    if (features.wordCount < 5 && !features.hasCodeBlock && !features.hasFilePath) {
      if (!antiPatterns.includes('맥락 없는 짧은 요청')) {
        antiPatterns.push('맥락 없는 짧은 요청');
      }
    }

    // "해줘"만 있는 경우
    if (/^.{0,10}해줘$/.test(content.trim())) {
      if (!antiPatterns.includes('구체적 지시 없이 "해줘"만 사용')) {
        antiPatterns.push('구체적 지시 없이 "해줘"만 사용');
      }
    }

    // 연속 재시도 표현
    if (/다시|again|retry|한번 더/.test(content)) {
      if (!antiPatterns.includes('불명확한 재시도 요청')) {
        antiPatterns.push('불명확한 재시도 요청');
      }
    }
  }

  return antiPatterns;
}

/**
 * 효과성별 분류
 */
export function classifyByEffectiveness(entries: PromptLibraryEntry[]): {
  high: PromptLibraryEntry[];    // 효과성 >= 0.7
  medium: PromptLibraryEntry[];  // 0.4 <= 효과성 < 0.7
  low: PromptLibraryEntry[];     // 효과성 < 0.4
} {
  return {
    high: entries.filter(e => e.effectiveness >= 0.7),
    medium: entries.filter(e => e.effectiveness >= 0.4 && e.effectiveness < 0.7),
    low: entries.filter(e => e.effectiveness < 0.4),
  };
}

/**
 * 재사용 가능 템플릿 생성
 */
export function generateReusableTemplates(entries: PromptLibraryEntry[]): string[] {
  // 효과성 높은 패턴에서 템플릿 추출
  const highEffectiveness = entries.filter(e => e.effectiveness >= 0.7);

  return highEffectiveness.map(entry => {
    const template = `
## ${entry.pattern}

**카테고리**: ${entry.category}
**의도**: ${entry.intent}
**효과성**: ${(entry.effectiveness * 100).toFixed(1)}%
**사용 빈도**: ${entry.frequency}회

### 모범 사례
${entry.bestPractices.map(p => `- ${p}`).join('\n') || '- 없음'}

### 예시 프롬프트
${entry.examples.slice(0, 2).map(e => `> ${truncate(e.content, 100)}`).join('\n\n')}

### 피해야 할 패턴
${entry.antiPatterns.map(a => `- ${a}`).join('\n') || '- 없음'}
`.trim();

    return template;
  });
}

/**
 * 최우수 프롬프트 선정 (카테고리별 Top 3)
 */
export function identifyBestExamples(prompts: PromptDataForLibrary[]): Map<TaskCategory, PromptDataForLibrary[]> {
  const categoryBest = new Map<TaskCategory, PromptDataForLibrary[]>();

  // 카테고리별 그룹화
  const categoryGroups = new Map<TaskCategory, PromptDataForLibrary[]>();

  for (const prompt of prompts) {
    const classification = classifyPrompt(prompt.content);
    const category = classification.taskCategory;

    if (!categoryGroups.has(category)) {
      categoryGroups.set(category, []);
    }
    categoryGroups.get(category)!.push(prompt);
  }

  // 각 카테고리에서 상위 3개 선택
  for (const [category, categoryPrompts] of categoryGroups) {
    const top3 = categoryPrompts
      .filter(p => p.effectiveness >= 0.5)  // 최소 효과성 필터
      .sort((a, b) => b.effectiveness - a.effectiveness)
      .slice(0, 3);

    if (top3.length > 0) {
      categoryBest.set(category, top3);
    }
  }

  return categoryBest;
}

/**
 * 프롬프트 라이브러리 생성
 */
export function buildPromptLibrary(prompts: PromptDataForLibrary[]): PromptLibrary {
  const entries = extractPromptPatterns(prompts);

  // 카테고리별 그룹화
  const byCategory: Record<TaskCategory, PromptLibraryEntry[]> = {
    'code-generation': [],
    'code-review': [],
    'bug-fix': [],
    'refactoring': [],
    'explanation': [],
    'documentation': [],
    'testing': [],
    'architecture': [],
    'deployment': [],
    'data-analysis': [],
    'general': [],
    'unknown': [],
  };

  // 의도별 그룹화
  const byIntent: Record<PromptIntent, PromptLibraryEntry[]> = {
    'command': [],
    'question': [],
    'instruction': [],
    'feedback': [],
    'context': [],
    'clarification': [],
    'unknown': [],
  };

  for (const entry of entries) {
    byCategory[entry.category].push(entry);
    byIntent[entry.intent].push(entry);
  }

  // 상위 패턴 (효과성 >= 0.7, 빈도 >= 3)
  const topPatterns = entries
    .filter(e => e.effectiveness >= 0.7 && e.frequency >= 3)
    .slice(0, 10);

  return {
    entries,
    totalPrompts: prompts.length,
    generatedAt: new Date(),
    topPatterns,
    byCategory,
    byIntent,
  };
}

/**
 * 문자열 자르기
 */
function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
