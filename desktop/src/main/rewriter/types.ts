/**
 * Shared types and interfaces for the prompt rewriter system
 */

import type { SessionContext } from '../session-context.js';
import type { ProviderType } from '../providers/types.js';

/**
 * Confidence calculation factors
 */
export interface ConfidenceFactors {
  classificationConfidence: number; // 0-1, from classifier
  dimensionsImproved: number; // 0-6, count of GOLDEN dimensions improved
  antiPatternFree: number; // 0-1, 1 if no anti-patterns, lower if patterns remain
  templateMatch: number; // 0-1, how well template fits category
  contextRichness: number; // 0-1, how much context was available
}

export interface GOLDENScore {
  goal: number;
  output: number;
  limits: number;
  data: number;
  evaluation: number;
  next: number;
  total: number;
}

export interface GuidelineEvaluation {
  overallScore: number;
  guidelineScores: Array<{
    guideline: string;
    name: string;
    description: string;
    score: number;
    weight: number;
    evidence: string[];
    suggestion: string;
  }>;
  goldenScore: GOLDENScore;
  antiPatterns?: Array<{
    pattern: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
    example?: string;
    fix: string;
  }>;
  recommendations: string[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export type VariantType = 'conservative' | 'balanced' | 'comprehensive' | 'ai' | 'cosp';

export interface RewriteResult {
  rewrittenPrompt: string;
  keyChanges: string[];
  confidence: number;
  variant: VariantType;
  variantLabel: string;
  isAiGenerated?: boolean;
  aiExplanation?: string;
  needsSetup?: boolean; // API 미설정 시 true
  isLoading?: boolean; // Phase 3.1: 비동기 AI 로딩 상태
  // Multi-provider metadata
  provider?: ProviderType; // 사용된 프로바이더
  wasFallback?: boolean; // Fallback 발생 여부
  fallbackReason?: string; // Fallback 사유
}

/**
 * 템플릿 생성 컨텍스트
 */
export interface TemplateContext {
  original: string;
  coreRequest: string;
  category: string;
  evaluation: GuidelineEvaluation;
  sessionContext?: SessionContext;
  extractedCode?: string | null;
  extractedError?: string | null;
  techStack: string[];
  complexity: PromptComplexity;
}

/**
 * 섹션 생성기 타입
 */
export type SectionGenerator = (ctx: TemplateContext) => string | null;

/**
 * 카테고리별 템플릿 인터페이스
 * 각 카테고리에 최적화된 프롬프트 구조 정의
 */
export interface CategoryTemplate {
  /** 필수 섹션들 (순서대로 출력) */
  requiredSections: Array<{
    tag: string;
    generator: SectionGenerator;
  }>;
  /** 기본 Think mode (카테고리 특성 반영) */
  defaultThinkMode: 'think' | 'think hard' | 'think harder' | null;
  /** 카테고리별 품질 체크포인트 */
  qualityFactors: string[];
  /** Few-shot 예시 (AI 리라이트용) */
  example: {
    before: string;
    after: string;
    improvement: string;
  };
}

/**
 * 프롬프트 복잡도 유형
 */
export type PromptComplexity = 'simple' | 'medium' | 'complex' | 'advanced';

/**
 * GOLDEN 점수 평가 함수 타입
 */
export type GOLDENEvaluator = (text: string) => {
  total: number;
  goal: number;
  output: number;
  limits: number;
  data: number;
  evaluation: number;
  next: number;
};
