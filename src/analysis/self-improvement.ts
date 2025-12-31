/**
 * Self-Improvement Module
 * 자기 학습 및 프롬프트 개선을 위한 피드백 생성
 */

import { TaskCategory, PromptIntent, classifyPrompt, extractFeatures } from './classifier.js';
import {
  evaluatePromptAgainstGuidelines,
  GuidelineEvaluation,
  GOLDENScore,
} from './guidelines-evaluator.js';

/**
 * 자기 개선 피드백
 */
export interface SelfImprovementFeedback {
  // 개선이 필요한 영역
  areasForImprovement: ImprovementArea[];

  // 잘하고 있는 영역
  strengths: StrengthArea[];

  // 학습 우선순위
  learningPriorities: LearningPriority[];

  // Before/After 예시
  rewriteExamples: RewriteExample[];

  // 개선 추이 (시간순)
  progressTrend: ProgressPoint[];

  // 주간 목표
  weeklyGoals: WeeklyGoal[];

  // 전체 요약
  summary: ImprovementSummary;
}

/**
 * 개선 영역
 */
export interface ImprovementArea {
  area: string;
  currentScore: number;
  targetScore: number;
  gap: number;
  specificAdvice: string;
  examples: {
    before: string;
    after: string;
    explanation: string;
  }[];
  priority: 'high' | 'medium' | 'low';
  estimatedImpact: string;
}

/**
 * 강점 영역
 */
export interface StrengthArea {
  area: string;
  score: number;
  evidence: string[];
  tip: string;
}

/**
 * 학습 우선순위
 */
export interface LearningPriority {
  rank: number;
  topic: string;
  reason: string;
  resources: ResourceLink[];
  exercises: string[];
}

/**
 * 학습 자료 링크
 */
export interface ResourceLink {
  title: string;
  url: string;
  type: 'article' | 'video' | 'documentation' | 'tutorial';
}

/**
 * Before/After 리라이트 예시
 */
export interface RewriteExample {
  category: TaskCategory;
  before: {
    prompt: string;
    issues: string[];
    score: number;
  };
  after: {
    prompt: string;
    improvements: string[];
    score: number;
  };
  keyChanges: string[];
}

/**
 * 진행 추이 포인트
 */
export interface ProgressPoint {
  date: Date;
  averageScore: number;
  promptCount: number;
  topCategory: TaskCategory;
}

/**
 * 주간 목표
 */
export interface WeeklyGoal {
  goal: string;
  metric: string;
  currentValue: number;
  targetValue: number;
  actionItems: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * 개선 요약
 */
export interface ImprovementSummary {
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  mainMessage: string;
  keyInsights: string[];
  quickWins: string[];
  longTermGoals: string[];
}

/**
 * 분석용 프롬프트 데이터
 */
export interface PromptDataForImprovement {
  content: string;
  conversationId: string;
  timestamp: Date;
  effectiveness: number;
}

/**
 * 자기 개선 피드백 생성
 */
export function generateSelfImprovementFeedback(
  prompts: PromptDataForImprovement[]
): SelfImprovementFeedback {
  if (prompts.length === 0) {
    return createEmptyFeedback();
  }

  // 모든 프롬프트 평가
  const evaluations = prompts.map(p => ({
    ...p,
    evaluation: evaluatePromptAgainstGuidelines(p.content),
    classification: classifyPrompt(p.content),
  }));

  // 개선 영역 분석
  const areasForImprovement = analyzeImprovementAreas(evaluations);

  // 강점 분석
  const strengths = analyzeStrengths(evaluations);

  // 학습 우선순위 결정
  const learningPriorities = prioritizeLearning(areasForImprovement);

  // Before/After 예시 생성
  const rewriteExamples = generateRewriteExamples(evaluations);

  // 진행 추이
  const progressTrend = calculateProgressTrend(evaluations);

  // 주간 목표
  const weeklyGoals = generateWeeklyGoals(areasForImprovement, evaluations);

  // 전체 요약
  const summary = generateSummary(evaluations, areasForImprovement, strengths);

  return {
    areasForImprovement,
    strengths,
    learningPriorities,
    rewriteExamples,
    progressTrend,
    weeklyGoals,
    summary,
  };
}

/**
 * 개선 영역 분석
 */
function analyzeImprovementAreas(
  evaluations: Array<{
    content: string;
    effectiveness: number;
    evaluation: GuidelineEvaluation;
  }>
): ImprovementArea[] {
  const areas: ImprovementArea[] = [];

  // 가이드라인별 평균 점수 계산
  const guidelineScores = new Map<string, { total: number; count: number; name: string }>();

  for (const e of evaluations) {
    for (const gs of e.evaluation.guidelineScores) {
      if (!guidelineScores.has(gs.guideline)) {
        guidelineScores.set(gs.guideline, { total: 0, count: 0, name: gs.name });
      }
      const data = guidelineScores.get(gs.guideline)!;
      data.total += gs.score;
      data.count++;
    }
  }

  // 낮은 점수 영역 식별
  for (const [guideline, data] of guidelineScores) {
    const avgScore = data.total / data.count;

    if (avgScore < 0.6) {
      const lowScoreExamples = evaluations
        .filter(e => {
          const gs = e.evaluation.guidelineScores.find(g => g.guideline === guideline);
          return gs && gs.score < 0.5;
        })
        .slice(0, 2);

      areas.push({
        area: data.name,
        currentScore: avgScore,
        targetScore: 0.8,
        gap: 0.8 - avgScore,
        specificAdvice: getAdviceForGuideline(guideline),
        examples: lowScoreExamples.map(e => ({
          before: truncate(e.content, 100),
          after: generateImprovedPrompt(e.content, guideline),
          explanation: getExplanationForImprovement(guideline),
        })),
        priority: avgScore < 0.3 ? 'high' : avgScore < 0.5 ? 'medium' : 'low',
        estimatedImpact: getEstimatedImpact(guideline),
      });
    }
  }

  // 우선순위 정렬
  return areas.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * 강점 분석
 */
function analyzeStrengths(
  evaluations: Array<{
    content: string;
    effectiveness: number;
    evaluation: GuidelineEvaluation;
  }>
): StrengthArea[] {
  const strengths: StrengthArea[] = [];

  // 가이드라인별 평균 점수 계산
  const guidelineScores = new Map<string, { total: number; count: number; name: string; evidence: string[] }>();

  for (const e of evaluations) {
    for (const gs of e.evaluation.guidelineScores) {
      if (!guidelineScores.has(gs.guideline)) {
        guidelineScores.set(gs.guideline, { total: 0, count: 0, name: gs.name, evidence: [] });
      }
      const data = guidelineScores.get(gs.guideline)!;
      data.total += gs.score;
      data.count++;
      if (gs.score >= 0.7) {
        data.evidence.push(...gs.evidence);
      }
    }
  }

  // 높은 점수 영역 식별
  for (const [_, data] of guidelineScores) {
    const avgScore = data.total / data.count;

    if (avgScore >= 0.7) {
      strengths.push({
        area: data.name,
        score: avgScore,
        evidence: [...new Set(data.evidence)].slice(0, 5),
        tip: `${data.name} 활용을 계속 유지하세요. 이 강점을 다른 영역에도 적용해보세요.`,
      });
    }
  }

  return strengths.sort((a, b) => b.score - a.score);
}

/**
 * 학습 우선순위 결정
 */
function prioritizeLearning(areas: ImprovementArea[]): LearningPriority[] {
  const priorities: LearningPriority[] = [];

  const resources: Record<string, ResourceLink[]> = {
    '명시적 지시': [
      { title: 'Anthropic Prompt Engineering Guide', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering', type: 'documentation' },
      { title: 'Be Clear and Direct', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct', type: 'article' },
    ],
    '컨텍스트 제공': [
      { title: 'Provide Context', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct#provide-context', type: 'documentation' },
    ],
    'XML 태그 활용': [
      { title: 'Use XML Tags', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags', type: 'documentation' },
    ],
    '단계별 사고': [
      { title: 'Chain of Thought', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/chain-of-thought', type: 'article' },
    ],
    '출력 형식 명시': [
      { title: 'Specify Output Format', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct#specify-the-output-format', type: 'documentation' },
    ],
    '제약조건 명시': [
      { title: 'Define Boundaries', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct', type: 'documentation' },
    ],
  };

  const exercises: Record<string, string[]> = {
    '명시적 지시': [
      '오늘 3개의 프롬프트에 구체적인 동사 사용하기',
      '모호한 표현 대신 정확한 대상 명시하기',
    ],
    '컨텍스트 제공': [
      '프롬프트 시작 시 현재 상황 한 문장으로 설명하기',
      '기술 스택/버전 정보 항상 포함하기',
    ],
    'XML 태그 활용': [
      '<context>, <requirement>, <output> 태그로 프롬프트 구조화하기',
      '복잡한 요청 시 마크다운 리스트 활용하기',
    ],
    '단계별 사고': [
      '"단계별로 설명해줘" 추가하기',
      '복잡한 문제에 "왜" 질문 포함하기',
    ],
    '출력 형식 명시': [
      '원하는 출력 형식(JSON, 표, 리스트) 명시하기',
      '응답 길이 가이드 제공하기',
    ],
    '제약조건 명시': [
      '사용하면 안 되는 것 명시하기',
      '범위 한정 조건 추가하기',
    ],
  };

  for (let i = 0; i < Math.min(areas.length, 3); i++) {
    const area = areas[i];
    priorities.push({
      rank: i + 1,
      topic: area.area,
      reason: `현재 점수 ${(area.currentScore * 100).toFixed(0)}%로, ${area.gap > 0.3 ? '즉각적인' : '점진적인'} 개선이 필요합니다.`,
      resources: resources[area.area] || [],
      exercises: exercises[area.area] || ['해당 영역 연습 문제 준비 중'],
    });
  }

  return priorities;
}

/**
 * Before/After 예시 생성
 */
function generateRewriteExamples(
  evaluations: Array<{
    content: string;
    effectiveness: number;
    evaluation: GuidelineEvaluation;
    classification: { taskCategory: TaskCategory };
  }>
): RewriteExample[] {
  const examples: RewriteExample[] = [];

  // 낮은 효과성 프롬프트 선택
  const lowScorePrompts = evaluations
    .filter(e => e.evaluation.overallScore < 0.5)
    .sort((a, b) => a.evaluation.overallScore - b.evaluation.overallScore)
    .slice(0, 3);

  for (const prompt of lowScorePrompts) {
    const issues = prompt.evaluation.guidelineScores
      .filter(gs => gs.score < 0.5)
      .map(gs => gs.name);

    const improvedPrompt = generateComprehensiveImprovement(prompt.content);

    examples.push({
      category: prompt.classification.taskCategory,
      before: {
        prompt: prompt.content,
        issues,
        score: prompt.evaluation.overallScore,
      },
      after: {
        prompt: improvedPrompt.text,
        improvements: improvedPrompt.improvements,
        score: improvedPrompt.estimatedScore,
      },
      keyChanges: improvedPrompt.keyChanges,
    });
  }

  return examples;
}

/**
 * 종합 개선 프롬프트 생성
 */
function generateComprehensiveImprovement(original: string): {
  text: string;
  improvements: string[];
  estimatedScore: number;
  keyChanges: string[];
} {
  const features = extractFeatures(original);
  const classification = classifyPrompt(original);
  const improvements: string[] = [];
  const keyChanges: string[] = [];

  let improved = original;

  // 1. 너무 짧으면 확장
  if (features.length < 30) {
    improved = `[${getCategoryLabel(classification.taskCategory)}] ${improved}`;
    improvements.push('작업 유형 명시 추가');
    keyChanges.push('카테고리 태그 추가');
  }

  // 2. 컨텍스트 추가
  if (!/현재|상황|context/i.test(improved)) {
    improved = `현재 상황: [프로젝트/환경 설명]\n\n${improved}`;
    improvements.push('컨텍스트 섹션 추가');
    keyChanges.push('배경 정보 제공');
  }

  // 3. 출력 형식 추가
  if (!/형식|format|JSON|table/i.test(improved)) {
    improved += '\n\n원하는 출력 형식: [코드/설명/단계별 가이드]';
    improvements.push('출력 형식 명시');
    keyChanges.push('기대 결과 정의');
  }

  // 4. 구체적 지시 확인
  if (features.wordCount < 10) {
    improved = improved.replace(/해줘$|해$/, '해줘. 구체적인 예시와 함께 설명해줘.');
    improvements.push('구체적 요청 추가');
    keyChanges.push('상세 지시 보강');
  }

  // 예상 점수 (개선 수에 따라)
  const estimatedScore = Math.min(0.5 + improvements.length * 0.15, 0.95);

  return {
    text: improved,
    improvements,
    estimatedScore,
    keyChanges,
  };
}

/**
 * 진행 추이 계산
 */
function calculateProgressTrend(
  evaluations: Array<{
    timestamp: Date;
    evaluation: GuidelineEvaluation;
    classification: { taskCategory: TaskCategory };
  }>
): ProgressPoint[] {
  // 날짜별 그룹화
  const dateGroups = new Map<string, typeof evaluations>();

  for (const e of evaluations) {
    const dateKey = e.timestamp.toISOString().split('T')[0];
    if (!dateGroups.has(dateKey)) {
      dateGroups.set(dateKey, []);
    }
    dateGroups.get(dateKey)!.push(e);
  }

  // 날짜별 평균 계산
  const trend: ProgressPoint[] = [];

  for (const [dateStr, evals] of dateGroups) {
    const avgScore = evals.reduce((sum, e) => sum + e.evaluation.overallScore, 0) / evals.length;

    // 가장 많이 사용된 카테고리
    const categoryCounts = new Map<TaskCategory, number>();
    for (const e of evals) {
      const cat = e.classification.taskCategory;
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }

    let topCategory: TaskCategory = 'unknown';
    let maxCount = 0;
    for (const [cat, count] of categoryCounts) {
      if (count > maxCount) {
        maxCount = count;
        topCategory = cat;
      }
    }

    trend.push({
      date: new Date(dateStr),
      averageScore: avgScore,
      promptCount: evals.length,
      topCategory,
    });
  }

  return trend.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * 주간 목표 생성
 */
function generateWeeklyGoals(
  areas: ImprovementArea[],
  evaluations: Array<{ evaluation: GuidelineEvaluation }>
): WeeklyGoal[] {
  const goals: WeeklyGoal[] = [];

  // 현재 평균 점수
  const currentAvg = evaluations.reduce((sum, e) => sum + e.evaluation.overallScore, 0) / evaluations.length;

  // 목표 1: 전체 점수 향상
  goals.push({
    goal: '전체 가이드라인 준수도 향상',
    metric: '평균 점수',
    currentValue: currentAvg,
    targetValue: Math.min(currentAvg + 0.1, 0.9),
    actionItems: [
      '모든 프롬프트에 컨텍스트 추가하기',
      '출력 형식 항상 명시하기',
    ],
    difficulty: currentAvg < 0.5 ? 'easy' : 'medium',
  });

  // 목표 2: 가장 낮은 영역 집중 개선
  if (areas.length > 0) {
    const weakest = areas[0];
    goals.push({
      goal: `${weakest.area} 개선`,
      metric: `${weakest.area} 점수`,
      currentValue: weakest.currentScore,
      targetValue: Math.min(weakest.currentScore + 0.2, 0.8),
      actionItems: [weakest.specificAdvice],
      difficulty: weakest.priority === 'high' ? 'hard' : 'medium',
    });
  }

  // 목표 3: 일일 연습
  goals.push({
    goal: '일일 프롬프트 품질 연습',
    metric: '고품질 프롬프트 비율',
    currentValue: evaluations.filter(e => e.evaluation.overallScore >= 0.7).length / evaluations.length,
    targetValue: 0.5,
    actionItems: [
      '프롬프트 작성 전 체크리스트 확인',
      '하루 최소 3개 프롬프트에 GOLDEN 적용',
    ],
    difficulty: 'easy',
  });

  return goals;
}

/**
 * 전체 요약 생성
 */
function generateSummary(
  evaluations: Array<{ evaluation: GuidelineEvaluation }>,
  areas: ImprovementArea[],
  strengths: StrengthArea[]
): ImprovementSummary {
  const avgScore = evaluations.reduce((sum, e) => sum + e.evaluation.overallScore, 0) / evaluations.length;

  // 등급 결정
  const grade = avgScore >= 0.8 ? 'A' : avgScore >= 0.65 ? 'B' : avgScore >= 0.5 ? 'C' : avgScore >= 0.35 ? 'D' : 'F';

  // 메인 메시지
  let mainMessage: string;
  switch (grade) {
    case 'A':
      mainMessage = '훌륭합니다! 프롬프트 작성 실력이 매우 뛰어납니다. 세부 최적화에 집중하세요.';
      break;
    case 'B':
      mainMessage = '좋은 프롬프트 습관을 가지고 있습니다. 몇 가지 영역만 개선하면 됩니다.';
      break;
    case 'C':
      mainMessage = '기본기는 있지만 개선 여지가 있습니다. 학습 우선순위에 따라 연습하세요.';
      break;
    case 'D':
      mainMessage = '프롬프트 작성에 어려움이 있습니다. 기본 가이드라인부터 학습하세요.';
      break;
    default:
      mainMessage = '프롬프트 엔지니어링 기초부터 시작해야 합니다. 학습 자료를 참고하세요.';
  }

  // 핵심 인사이트
  const keyInsights: string[] = [];
  if (strengths.length > 0) {
    keyInsights.push(`강점: ${strengths[0].area} (${(strengths[0].score * 100).toFixed(0)}%)`);
  }
  if (areas.length > 0) {
    keyInsights.push(`개선 필요: ${areas[0].area} (${(areas[0].currentScore * 100).toFixed(0)}%)`);
  }
  keyInsights.push(`분석된 프롬프트: ${evaluations.length}개`);

  // 빠른 개선 (Quick Wins)
  const quickWins = areas
    .filter(a => a.priority === 'low' || a.gap < 0.3)
    .slice(0, 3)
    .map(a => a.specificAdvice);

  // 장기 목표
  const longTermGoals = areas
    .filter(a => a.priority === 'high')
    .slice(0, 2)
    .map(a => `${a.area}: ${a.specificAdvice}`);

  return {
    overallGrade: grade,
    mainMessage,
    keyInsights,
    quickWins: quickWins.length > 0 ? quickWins : ['현재 개선이 필요한 빠른 승리 항목이 없습니다.'],
    longTermGoals: longTermGoals.length > 0 ? longTermGoals : ['꾸준한 연습으로 전체 점수 향상'],
  };
}

// 헬퍼 함수들

function getAdviceForGuideline(guideline: string): string {
  const advice: Record<string, string> = {
    beExplicit: '구체적인 동사와 명확한 대상을 사용하세요. "이거 해줘" 대신 "UserService에 로그인 메서드 추가해줘"',
    addContext: '현재 상황, 목표, 기술 스택을 프롬프트 시작 부분에 포함하세요.',
    useXMLTags: '<context>, <requirement>, <output> 같은 태그로 프롬프트를 구조화하세요.',
    chainOfThought: '"단계별로 설명해줘" 또는 "왜 이 방법인지도 알려줘"를 추가하세요.',
    specificOutput: '원하는 출력 형식(JSON, 표, 코드 등)을 명시하세요.',
    constraints: '제약조건("외부 라이브러리 없이", "TypeScript만")을 명시하세요.',
  };
  return advice[guideline] || '해당 영역의 개선 방법을 연습하세요.';
}

function generateImprovedPrompt(original: string, guideline: string): string {
  const templates: Record<string, (text: string) => string> = {
    beExplicit: (t) => `[구체적 작업] ${t.replace(/이거|저거/, '해당 기능을')}`,
    addContext: (t) => `현재 상황: [프로젝트 설명]\n\n${t}`,
    useXMLTags: (t) => `<request>\n${t}\n</request>`,
    chainOfThought: (t) => `${t}\n\n단계별로 설명해줘.`,
    specificOutput: (t) => `${t}\n\n출력 형식: [코드/설명]`,
    constraints: (t) => `${t} (제약조건: [명시])`,
  };

  const transformer = templates[guideline];
  return transformer ? transformer(original) : original;
}

function getExplanationForImprovement(guideline: string): string {
  const explanations: Record<string, string> = {
    beExplicit: '모호한 표현을 구체적인 지시로 변경',
    addContext: '배경 정보 섹션 추가',
    useXMLTags: 'XML 태그로 구조화',
    chainOfThought: '단계별 사고 요청 추가',
    specificOutput: '출력 형식 명시',
    constraints: '제약조건 추가',
  };
  return explanations[guideline] || '가이드라인에 맞게 개선';
}

function getEstimatedImpact(guideline: string): string {
  const impacts: Record<string, string> = {
    beExplicit: 'AI 응답의 정확도가 크게 향상됩니다.',
    addContext: 'AI가 더 적절한 맥락에서 답변합니다.',
    useXMLTags: '복잡한 요청의 이해도가 향상됩니다.',
    chainOfThought: '더 깊이 있는 분석과 설명을 받습니다.',
    specificOutput: '원하는 형식의 결과를 바로 받습니다.',
    constraints: '불필요한 반복 수정이 줄어듭니다.',
  };
  return impacts[guideline] || '전반적인 응답 품질이 향상됩니다.';
}

function getCategoryLabel(category: TaskCategory): string {
  const labels: Record<TaskCategory, string> = {
    'code-generation': '코드 생성',
    'code-review': '코드 리뷰',
    'bug-fix': '버그 수정',
    'refactoring': '리팩토링',
    'explanation': '설명',
    'documentation': '문서화',
    'testing': '테스트',
    'architecture': '아키텍처',
    'deployment': '배포',
    'data-analysis': '데이터 분석',
    'general': '일반',
    'unknown': '미분류',
  };
  return labels[category];
}

function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

function createEmptyFeedback(): SelfImprovementFeedback {
  return {
    areasForImprovement: [],
    strengths: [],
    learningPriorities: [],
    rewriteExamples: [],
    progressTrend: [],
    weeklyGoals: [],
    summary: {
      overallGrade: 'F',
      mainMessage: '분석할 프롬프트가 없습니다.',
      keyInsights: [],
      quickWins: [],
      longTermGoals: [],
    },
  };
}
