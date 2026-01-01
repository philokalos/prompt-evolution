/**
 * History Pattern Analyzer
 * PromptLint - Analyzes user's prompt history to provide personalized recommendations
 */

import {
  getAnalysesByProject,
  getProjectGoldenAverages,
  getProjectWeaknesses,
  getHighScoringPrompts,
  getSimilarPromptsByCategory,
  type PromptHistoryRecord,
} from './db/history-repository.js';

export interface HistoryRecommendation {
  type: 'weakness' | 'improvement' | 'reference' | 'pattern';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  dimension?: string;
  examplePrompt?: string;
  improvement?: number; // percentage improvement potential
}

export interface ProjectPatternAnalysis {
  projectPath: string;
  totalAnalyses: number;
  averageScore: number;
  goldenAverages: Record<string, number> | null;
  weaknesses: Array<{
    dimension: string;
    averageScore: number;
    belowThresholdCount: number;
  }>;
  recommendations: HistoryRecommendation[];
  highScoringExamples: PromptHistoryRecord[];
}

export interface PromptContextRecommendations {
  basedOnProject: HistoryRecommendation[];
  basedOnCategory: HistoryRecommendation[];
  referencePrompts: PromptHistoryRecord[];
}

const DIMENSION_TIPS: Record<string, { name: string; tip: string }> = {
  goal: {
    name: '목표 명확성',
    tip: '프롬프트의 목적을 구체적으로 명시하세요. "~를 해줘" 대신 "~를 위해 ~를 해줘"처럼 목적을 포함하세요.',
  },
  output: {
    name: '출력 형식',
    tip: '원하는 출력 형식을 명시하세요. 예: "JSON 형식으로", "마크다운 테이블로", "3단계로 나눠서"',
  },
  limits: {
    name: '제약 조건',
    tip: '제약 조건을 명시하세요. 예: "100줄 이내로", "ES6 문법만 사용", "외부 라이브러리 없이"',
  },
  data: {
    name: '데이터/컨텍스트',
    tip: '필요한 배경 정보를 제공하세요. 현재 프로젝트 구조, 사용 중인 프레임워크, 관련 코드 등을 포함하세요.',
  },
  evaluation: {
    name: '평가 기준',
    tip: '성공 기준을 명시하세요. 예: "테스트가 통과해야 함", "기존 API와 호환되어야 함"',
  },
  next: {
    name: '다음 단계',
    tip: '후속 작업을 명시하세요. 예: "구현 후 테스트도 작성해줘", "완료되면 문서화 진행"',
  },
};

/**
 * Analyze project-specific patterns and generate recommendations
 */
export function analyzeProjectPatterns(projectPath: string): ProjectPatternAnalysis {
  const analyses = getAnalysesByProject(projectPath, 50);
  const goldenAverages = getProjectGoldenAverages(projectPath);
  const weaknesses = getProjectWeaknesses(projectPath);
  const highScoring = getHighScoringPrompts(projectPath, 80, 5);

  const totalAnalyses = analyses.length;
  const averageScore = totalAnalyses > 0
    ? Math.round(analyses.reduce((sum, a) => sum + a.overallScore, 0) / totalAnalyses)
    : 0;

  const recommendations = generateProjectRecommendations(
    weaknesses,
    goldenAverages,
    highScoring,
    averageScore
  );

  return {
    projectPath,
    totalAnalyses,
    averageScore,
    goldenAverages,
    weaknesses,
    recommendations,
    highScoringExamples: highScoring,
  };
}

/**
 * Generate personalized recommendations based on project history
 */
function generateProjectRecommendations(
  weaknesses: Array<{ dimension: string; averageScore: number; belowThresholdCount: number }>,
  goldenAverages: Record<string, number> | null,
  highScoring: PromptHistoryRecord[],
  averageScore: number
): HistoryRecommendation[] {
  const recommendations: HistoryRecommendation[] = [];

  // Weakness-based recommendations (high priority)
  if (weaknesses.length > 0) {
    const topWeakness = weaknesses[0];
    const dimensionKey = Object.entries(DIMENSION_TIPS).find(
      ([_, v]) => v.name === topWeakness.dimension
    )?.[0];

    if (dimensionKey) {
      recommendations.push({
        type: 'weakness',
        priority: 'high',
        title: `${topWeakness.dimension} 개선 필요`,
        message: DIMENSION_TIPS[dimensionKey].tip,
        dimension: dimensionKey,
        improvement: 60 - topWeakness.averageScore, // potential improvement to threshold
      });
    }

    // Add second weakness if exists
    if (weaknesses.length > 1) {
      const secondWeakness = weaknesses[1];
      const secondKey = Object.entries(DIMENSION_TIPS).find(
        ([_, v]) => v.name === secondWeakness.dimension
      )?.[0];

      if (secondKey) {
        recommendations.push({
          type: 'weakness',
          priority: 'medium',
          title: `${secondWeakness.dimension}도 확인하세요`,
          message: DIMENSION_TIPS[secondKey].tip,
          dimension: secondKey,
        });
      }
    }
  }

  // Reference prompt recommendations
  if (highScoring.length > 0) {
    const best = highScoring[0];
    recommendations.push({
      type: 'reference',
      priority: 'low',
      title: '참고할 만한 프롬프트',
      message: `이 프로젝트에서 ${best.grade} 등급(${best.overallScore}점)을 받은 프롬프트가 있습니다.`,
      examplePrompt: best.promptText.substring(0, 150) + (best.promptText.length > 150 ? '...' : ''),
    });
  }

  // Pattern-based recommendations
  if (goldenAverages) {
    const lowestDimension = Object.entries(goldenAverages).sort(
      ([, a], [, b]) => a - b
    )[0];

    if (lowestDimension && lowestDimension[1] < 70) {
      const tip = DIMENSION_TIPS[lowestDimension[0]];
      if (tip) {
        recommendations.push({
          type: 'pattern',
          priority: 'medium',
          title: `${tip.name} 패턴 분석`,
          message: `이 프로젝트에서 평균 ${lowestDimension[1]}점입니다. ${tip.tip}`,
          dimension: lowestDimension[0],
        });
      }
    }
  }

  // Overall improvement suggestion
  if (averageScore < 60) {
    recommendations.push({
      type: 'improvement',
      priority: 'high',
      title: '전반적인 프롬프트 품질 향상 필요',
      message: '이 프로젝트의 평균 점수가 낮습니다. GOLDEN 체크리스트를 참고하여 프롬프트를 구조화해보세요.',
      improvement: 60 - averageScore,
    });
  } else if (averageScore < 75) {
    recommendations.push({
      type: 'improvement',
      priority: 'medium',
      title: '프롬프트 품질 향상 가능',
      message: '좋은 프롬프트를 작성하고 있습니다. 몇 가지 개선으로 더 좋은 결과를 얻을 수 있습니다.',
      improvement: 75 - averageScore,
    });
  }

  return recommendations;
}

/**
 * Get recommendations based on current prompt context
 */
export function getContextRecommendations(
  currentCategory: string | undefined,
  projectPath: string | undefined
): PromptContextRecommendations {
  const basedOnProject: HistoryRecommendation[] = [];
  const basedOnCategory: HistoryRecommendation[] = [];
  let referencePrompts: PromptHistoryRecord[] = [];

  // Project-based recommendations
  if (projectPath) {
    const projectAnalysis = analyzeProjectPatterns(projectPath);
    basedOnProject.push(...projectAnalysis.recommendations.slice(0, 3));
    referencePrompts = projectAnalysis.highScoringExamples;
  }

  // Category-based recommendations
  if (currentCategory && currentCategory !== 'unknown') {
    const similarPrompts = getSimilarPromptsByCategory(
      currentCategory,
      projectPath,
      5
    );

    if (similarPrompts.length > 0) {
      const avgScore = Math.round(
        similarPrompts.reduce((sum, p) => sum + p.overallScore, 0) / similarPrompts.length
      );

      basedOnCategory.push({
        type: 'pattern',
        priority: 'low',
        title: `${getCategoryLabel(currentCategory)} 작업 패턴`,
        message: `이 유형의 작업에서 평균 ${avgScore}점을 기록했습니다.`,
      });

      // Find the best prompt in this category
      const bestInCategory = similarPrompts[0];
      if (bestInCategory && bestInCategory.overallScore >= 75) {
        basedOnCategory.push({
          type: 'reference',
          priority: 'low',
          title: '비슷한 작업의 좋은 예시',
          message: `${bestInCategory.grade} 등급 프롬프트를 참고하세요.`,
          examplePrompt: bestInCategory.promptText.substring(0, 100) + '...',
        });
      }

      // Merge with reference prompts (prioritize category matches)
      if (similarPrompts.length > 0) {
        referencePrompts = [...similarPrompts, ...referencePrompts].slice(0, 5);
      }
    }
  }

  return {
    basedOnProject,
    basedOnCategory,
    referencePrompts,
  };
}

/**
 * Get category label in Korean
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'code-generation': '코드 생성',
    'code-review': '코드 리뷰',
    'bug-fix': '버그 수정',
    'refactoring': '리팩토링',
    'explanation': '설명/질문',
    'documentation': '문서화',
    'testing': '테스트',
    'architecture': '아키텍처',
    'deployment': '배포',
    'data-analysis': '데이터 분석',
    'general': '일반',
  };
  return labels[category] || category;
}

/**
 * Merge current analysis result with history-based recommendations
 */
export function enrichAnalysisWithHistory(
  analysis: {
    overallScore: number;
    goldenScores: Record<string, number>;
    issues: Array<{ severity: string; message: string; suggestion: string }>;
  },
  projectPath: string | undefined,
  category: string | undefined
): {
  historyRecommendations: HistoryRecommendation[];
  comparisonWithHistory: {
    betterThanAverage: boolean;
    scoreDiff: number;
    improvement: string | null;
  } | null;
} {
  if (!projectPath) {
    return {
      historyRecommendations: [],
      comparisonWithHistory: null,
    };
  }

  const contextRecs = getContextRecommendations(category, projectPath);
  const projectAverages = getProjectGoldenAverages(projectPath);

  let comparisonWithHistory: {
    betterThanAverage: boolean;
    scoreDiff: number;
    improvement: string | null;
  } | null = null;

  if (projectAverages) {
    const projectAvg = Math.round(
      Object.values(projectAverages).reduce((a, b) => a + b, 0) / 6
    );
    const scoreDiff = analysis.overallScore - projectAvg;
    const betterThanAverage = scoreDiff > 0;

    let improvement: string | null = null;
    if (betterThanAverage && scoreDiff >= 10) {
      improvement = '이전보다 크게 개선되었습니다!';
    } else if (betterThanAverage && scoreDiff >= 5) {
      improvement = '이전보다 개선되었습니다.';
    } else if (!betterThanAverage && scoreDiff <= -10) {
      improvement = '이전 프롬프트보다 품질이 낮습니다. 개선이 필요합니다.';
    }

    comparisonWithHistory = {
      betterThanAverage,
      scoreDiff,
      improvement,
    };
  }

  // Combine and prioritize recommendations
  const allRecommendations = [
    ...contextRecs.basedOnProject,
    ...contextRecs.basedOnCategory,
  ];

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  allRecommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    historyRecommendations: allRecommendations.slice(0, 5),
    comparisonWithHistory,
  };
}
