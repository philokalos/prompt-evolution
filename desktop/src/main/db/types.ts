/**
 * Prompt History Types
 * PromptLint - Shared interfaces for prompt analysis history
 */

export interface PromptHistoryRecord {
  id?: number;
  promptText: string;
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  goldenScores: {
    goal: number;
    output: number;
    limits: number;
    data: number;
    evaluation: number;
    next: number;
  };
  issues?: Array<{
    severity: 'high' | 'medium' | 'low';
    message: string;
    suggestion: string;
  }>;
  improvedPrompt?: string;
  sourceApp?: string;
  projectPath?: string;
  intent?: string;
  category?: string;
  analyzedAt?: Date;
}

export interface ProgressSnapshot {
  period: 'daily' | 'weekly' | 'monthly';
  averageScore: number;
  totalAnalyses: number;
  topWeaknesses: string[];
  scoreDistribution: Record<string, number>;
  snapshotDate: string;
}

export interface WeaknessStats {
  type: string;
  frequency: number;
  lastSeen: Date;
}

export interface IssuePattern {
  category: string;
  severity: 'high' | 'medium' | 'low';
  count: number;
  recentCount: number; // last 7 days
  trend: 'improving' | 'stable' | 'worsening';
  lastSeen: Date;
}

export interface GoldenDimensionTrend {
  dimension: string;
  weeklyData: Array<{
    weekStart: string;
    avgScore: number;
    improvement: number;
  }>;
}

export interface ConsecutiveImprovement {
  startDate: string;
  endDate: string;
  improvementCount: number;
  scoreIncrease: number;
  averageGain: number;
}

export interface CategoryPerformance {
  category: string;
  count: number;
  averageScore: number;
  bestScore: number;
  trend: 'improving' | 'stable' | 'declining';
  commonWeakness?: string;
}
