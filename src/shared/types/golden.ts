/**
 * GOLDEN Framework Types
 * Shared types for GOLDEN checklist scoring and guidelines evaluation
 */

/**
 * GOLDEN 체크리스트 점수
 * Goal, Output, Limits, Data, Evaluation, Next
 */
export interface GOLDENScore {
  goal: number;       // 목표 명확성
  output: number;     // 출력 형식
  limits: number;     // 제약조건
  data: number;       // 데이터/컨텍스트
  evaluation: number; // 평가 기준
  next: number;       // 다음 단계
  total: number;      // 총점
}

/**
 * Type alias for desktop compatibility
 */
export type GoldenScores = Omit<GOLDENScore, 'total'>;

/**
 * Grade classification
 */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * 가이드라인 평가 결과
 */
export interface GuidelineEvaluation {
  overallScore: number;           // 전체 준수도 (0-1)
  guidelineScores: GuidelineScore[];  // 개별 가이드라인 점수
  goldenScore: GOLDENScore;       // GOLDEN 체크리스트 점수
  antiPatterns: DetectedAntiPattern[];  // 탐지된 안티패턴
  recommendations: string[];      // 개선 권장사항
  grade: Grade;  // 등급
}

/**
 * 개별 가이드라인 점수
 */
export interface GuidelineScore {
  guideline: string;
  name: string;
  description: string;
  score: number;
  weight: number;
  evidence: string[];
  suggestion: string;
}

/**
 * 탐지된 안티패턴
 */
export interface DetectedAntiPattern {
  pattern: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  example?: string;
  fix: string;
}
