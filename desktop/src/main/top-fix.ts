/**
 * TopFix Computation
 * Pure function that extracts the single most impactful improvement
 * from an analysis result. Used by the "Top 1 Fix" UI feature.
 */

// =============================================================================
// Types
// =============================================================================

export interface TopFix {
  dimension: string;
  scoreDelta: number;
  issueDescription: string;
  beforeSnippet: string;
  afterSnippet: string;
  totalIssueCount: number;
}

export interface TopFixInput {
  goldenScores: Record<string, number>;
  issues: Array<{
    severity: 'high' | 'medium' | 'low';
    category: string;
    message: string;
    suggestion?: string;
  }>;
  originalText: string;
  promptVariants: Array<{
    rewrittenPrompt: string;
    variant: string;
    confidence: number;
    keyChanges?: string[];
    variantLabel?: string;
  }>;
  overallScore: number;
  grade: string;
}

// =============================================================================
// Constants
// =============================================================================

const GOLDEN_DIMENSIONS = ['goal', 'output', 'limits', 'data', 'evaluation', 'next'] as const;

const DIMENSION_CATEGORY_MAP: Record<string, string[]> = {
  goal: ['vague-goal', 'unclear-goal', 'missing-goal'],
  output: ['missing-output', 'no-output', 'unclear-output'],
  limits: ['no-constraints', 'missing-limits', 'no-limits'],
  data: ['lacking-context', 'missing-data', 'no-context'],
  evaluation: ['no-criteria', 'missing-evaluation', 'no-evaluation'],
  next: ['no-next-steps', 'missing-next', 'no-followup'],
};

const DIMENSION_FALLBACK_DESCRIPTIONS: Record<string, string> = {
  goal: 'Improve goal clarity for better results',
  output: 'Specify the desired output format',
  limits: 'Add constraints and boundaries',
  data: 'Provide more context and data',
  evaluation: 'Define success criteria',
  next: 'Add next steps or expected follow-up actions',
};

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const MAX_SNIPPET_LENGTH = 500;

// =============================================================================
// Helpers
// =============================================================================

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Compute the single most impactful fix from analysis results.
 * Returns null if the prompt is already A-grade, has no issues, or no variants.
 */
export function computeTopFix(input: TopFixInput): TopFix | null {
  const { goldenScores, issues, originalText, promptVariants, grade } = input;

  // No fix needed for A-grade, no issues, or no variants to suggest
  if (grade === 'A') return null;
  if (issues.length === 0) return null;
  if (promptVariants.length === 0) return null;

  // Find the dimension with the lowest score
  let lowestDimension: string = GOLDEN_DIMENSIONS[0];
  let lowestScore = goldenScores[GOLDEN_DIMENSIONS[0]] ?? 100;

  for (const dim of GOLDEN_DIMENSIONS) {
    const score = goldenScores[dim] ?? 100;
    if (score < lowestScore) {
      lowestScore = score;
      lowestDimension = dim;
    }
  }

  // Find matching issues for the weakest dimension
  const matchingCategories = DIMENSION_CATEGORY_MAP[lowestDimension] ?? [];
  const matchingIssues = issues
    .filter((issue) => matchingCategories.includes(issue.category))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  // Use highest-severity matching issue message, or fallback
  const issueDescription =
    matchingIssues.length > 0
      ? matchingIssues[0].message
      : DIMENSION_FALLBACK_DESCRIPTIONS[lowestDimension] ?? `Improve ${lowestDimension} dimension`;

  // Score delta: gap from perfect score (100) normalized to 0-1
  const scoreDelta = (100 - lowestScore) / 100;

  // Select highest-confidence variant for the "after" snippet
  const bestVariant = [...promptVariants].sort((a, b) => b.confidence - a.confidence)[0];

  return {
    dimension: lowestDimension,
    scoreDelta,
    issueDescription,
    beforeSnippet: truncate(originalText, MAX_SNIPPET_LENGTH),
    afterSnippet: truncate(bestVariant.rewrittenPrompt, MAX_SNIPPET_LENGTH),
    totalIssueCount: issues.length,
  };
}
