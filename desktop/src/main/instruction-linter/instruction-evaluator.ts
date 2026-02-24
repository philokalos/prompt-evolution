/**
 * GOLDEN for Instructions Evaluator
 *
 * Scores CLAUDE.md-style instruction files across 6 adapted dimensions:
 *   Goal:       project description, tech stack presence
 *   Output:     coding conventions, style rules, examples
 *   Limits:     anti-patterns, forbidden patterns, constraints
 *   Data:       file structure, environment, dependencies
 *   Evaluation: test commands, verification criteria, quality gates
 *   Next:       workflow, CI/CD, deployment, branching
 *
 * Each dimension 0-1. Overall = average × 100. Grade A-F.
 */

import type { ParsedSection } from './markdown-parser.js';

// =============================================================================
// Types
// =============================================================================

export interface EvaluatorInput {
  sections: ParsedSection[];
  fullText: string;
  lineCount: number;
}

export interface EvaluatorResult {
  goldenScores: {
    goal: number;
    output: number;
    limits: number;
    data: number;
    evaluation: number;
    next: number;
    total: number;
  };
  overallScore: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

// =============================================================================
// Patterns
// =============================================================================

// Heading patterns that signal each dimension
const GOAL_HEADINGS = /overview|project|about|introduction|description|tech\s*stack|stack|summary/i;
const OUTPUT_HEADINGS = /style|convention|pattern|naming|format|example|key pattern|code style/i;
const LIMITS_HEADINGS = /anti.?pattern|forbidden|constraint|rule|critical|pitfall|wrong|gotcha|don'?t|limit/i;
const DATA_HEADINGS = /architect|structure|file|director|depend|environment|config|module|key module/i;
const EVAL_HEADINGS = /test|quality|coverage|verif|lint|ci check|command/i;
const NEXT_HEADINGS = /workflow|deploy|ci|cd|pipeline|branch|release|process|contributing/i;

// Content patterns (regex collections per dimension)
const TECH_STACK_KEYWORDS = /\b(react|vue|angular|svelte|next\.?js|nuxt|node\.?js|express|django|flask|fastapi|rails|spring|laravel|go|rust|python|typescript|javascript|java|kotlin|swift|c\+\+|c#|ruby|php|elixir|dart|flutter)\b/gi;
const PROJECT_DESC_SIGNALS = /\b(application|app|platform|tool|service|library|framework|system|api|cli|dashboard|web|mobile|desktop)\b/i;

const CONVENTION_KEYWORDS = /\b(camelCase|PascalCase|kebab.?case|snake_case|naming|convention|prefer|always use|style|indent|semicolon|trailing comma|return type|typed)\b/i;
const CODE_EXAMPLE_SIGNALS = /```|\/\/\s*(correct|wrong|good|bad|example)/i;

const NEGATIVE_CONSTRAINTS = /\b(never|don'?t|do not|avoid|forbidden|prohibited|must not|should not|no\s+\w+|anti.?pattern|wrong)\b/i;

const FILE_PATH_PATTERN = /(?:^|\s)([\w.-]+\/[\w.-]+(?:\/[\w.-]+)*)\b/gm;
const DEPENDENCY_SIGNALS = /\b(dependency|dependencies|package|import|require|module|version)\b/i;
const ENV_SIGNALS = /\b(environment|env|variable|config|\.env|secret|key|credential)\b/i;
const DIR_STRUCTURE_SIGNALS = /(?:src|lib|app|components|hooks|utils|api|config|test|spec)\/\s/i;

const TEST_COMMAND_PATTERN = /\b(npm\s+test|npm\s+run\s+test|jest|vitest|pytest|cargo\s+test|go\s+test|rspec|mocha|playwright|cypress)\b/i;
const LINT_COMMAND_PATTERN = /\b(npm\s+run\s+lint|eslint|prettier|rubocop|pylint|clippy|golangci)\b/i;
const COVERAGE_SIGNALS = /\b(coverage|percent|%|\d+%|threshold|minimum)\b/i;
const QUALITY_SIGNALS = /\b(ci|pass|check|gate|require|must pass|pr|pull request|review)\b/i;

const WORKFLOW_SIGNALS = /\b(branch|merge|pr|pull request|review|step|feature branch|main|develop)\b/i;
const CI_SIGNALS = /\b(ci|cd|github actions|jenkins|circleci|travis|gitlab|pipeline|deploy|deployment|vercel|netlify|aws|gcp|docker)\b/i;
const SEQUENTIAL_SIGNALS = /\b(\d+\.\s|step\s+\d+|first|then|next|finally|after)\b/i;

// =============================================================================
// Grade Calculation
// =============================================================================

export function calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 0.9) return 'A';
  if (score >= 0.75) return 'B';
  if (score >= 0.6) return 'C';
  if (score >= 0.4) return 'D';
  return 'F';
}

// =============================================================================
// Dimension Scorers
// =============================================================================

function scoreGoal(sections: ParsedSection[], fullText: string): number {
  let score = 0;

  // Heading signals
  const hasGoalHeading = sections.some(s => GOAL_HEADINGS.test(s.heading));
  if (hasGoalHeading) score += 0.25;

  // Tech stack keywords
  const techMatches = fullText.match(TECH_STACK_KEYWORDS);
  if (techMatches) {
    const uniqueTechs = new Set(techMatches.map(t => t.toLowerCase()));
    score += Math.min(uniqueTechs.size * 0.1, 0.4);
  }

  // Project description
  if (PROJECT_DESC_SIGNALS.test(fullText)) score += 0.2;

  // Has meaningful content under goal-related headings
  for (const s of sections) {
    if (GOAL_HEADINGS.test(s.heading) && s.content.trim().length > 20) {
      score += 0.15;
      break;
    }
  }

  return Math.min(score, 1);
}

function scoreOutput(sections: ParsedSection[], fullText: string): number {
  let score = 0;

  // Heading signals
  const hasOutputHeading = sections.some(s => OUTPUT_HEADINGS.test(s.heading));
  if (hasOutputHeading) score += 0.2;

  // Convention keywords
  if (CONVENTION_KEYWORDS.test(fullText)) score += 0.3;

  // Code examples
  const hasCodeExamples = sections.some(s => s.codeBlocks.length > 0);
  if (hasCodeExamples) score += 0.2;

  // Code example signals in text
  if (CODE_EXAMPLE_SIGNALS.test(fullText)) score += 0.15;

  // Table with patterns (common in CLAUDE.md)
  if (/\|.*\|.*\|/m.test(fullText)) score += 0.15;

  return Math.min(score, 1);
}

function scoreLimits(sections: ParsedSection[], fullText: string): number {
  let score = 0;

  // Heading signals
  const hasLimitsHeading = sections.some(s => LIMITS_HEADINGS.test(s.heading));
  if (hasLimitsHeading) score += 0.25;

  // Count negative constraints
  const lines = fullText.split('\n');
  let constraintCount = 0;
  for (const line of lines) {
    if (NEGATIVE_CONSTRAINTS.test(line)) constraintCount++;
  }
  score += Math.min(constraintCount * 0.08, 0.45);

  // Wrong/Correct table pattern
  if (/wrong|incorrect/i.test(fullText) && /correct|right/i.test(fullText)) {
    score += 0.2;
  }

  // Explicit "do not" / "must not" patterns
  const strongConstraints = fullText.match(/\b(must not|must never|do not|never)\b/gi);
  if (strongConstraints && strongConstraints.length >= 2) {
    score += 0.1;
  }

  return Math.min(score, 1);
}

function scoreData(sections: ParsedSection[], fullText: string): number {
  let score = 0;

  // Heading signals
  const hasDataHeading = sections.some(s => DATA_HEADINGS.test(s.heading));
  if (hasDataHeading) score += 0.2;

  // File paths
  const pathMatches = fullText.match(FILE_PATH_PATTERN);
  if (pathMatches) {
    score += Math.min(pathMatches.length * 0.05, 0.25);
  }

  // Directory structure
  if (DIR_STRUCTURE_SIGNALS.test(fullText)) score += 0.2;

  // Dependency info
  if (DEPENDENCY_SIGNALS.test(fullText)) score += 0.15;

  // Environment variables
  if (ENV_SIGNALS.test(fullText)) score += 0.15;

  // Config file mentions
  if (/\b(tsconfig|vite\.config|webpack|babel|\.eslintrc|firebase\.json|package\.json|Cargo\.toml|go\.mod)\b/i.test(fullText)) {
    score += 0.1;
  }

  return Math.min(score, 1);
}

function scoreEvaluation(sections: ParsedSection[], fullText: string): number {
  let score = 0;

  // Heading signals
  const hasEvalHeading = sections.some(s => EVAL_HEADINGS.test(s.heading));
  if (hasEvalHeading) score += 0.2;

  // Test commands
  if (TEST_COMMAND_PATTERN.test(fullText)) score += 0.25;

  // Lint commands
  if (LINT_COMMAND_PATTERN.test(fullText)) score += 0.2;

  // Coverage/quality thresholds
  if (COVERAGE_SIGNALS.test(fullText)) score += 0.15;

  // Quality gate signals
  if (QUALITY_SIGNALS.test(fullText)) score += 0.15;

  // Code blocks with commands
  const hasCommandBlocks = sections.some(s =>
    s.codeBlocks.some(b => TEST_COMMAND_PATTERN.test(b) || LINT_COMMAND_PATTERN.test(b))
  );
  if (hasCommandBlocks) score += 0.15;

  return Math.min(score, 1);
}

function scoreNext(sections: ParsedSection[], fullText: string): number {
  let score = 0;

  // Heading signals
  const hasNextHeading = sections.some(s => NEXT_HEADINGS.test(s.heading));
  if (hasNextHeading) score += 0.25;

  // Workflow signals
  if (WORKFLOW_SIGNALS.test(fullText)) score += 0.2;

  // CI/CD signals
  if (CI_SIGNALS.test(fullText)) score += 0.25;

  // Sequential/numbered steps
  if (SEQUENTIAL_SIGNALS.test(fullText)) score += 0.15;

  // Deployment info
  if (/\b(deploy|staging|production|release|publish)\b/i.test(fullText)) {
    score += 0.15;
  }

  return Math.min(score, 1);
}

// =============================================================================
// Main Evaluator
// =============================================================================

export function evaluateInstructions(input: EvaluatorInput): EvaluatorResult {
  const { sections, fullText, lineCount: _lineCount } = input;

  if (sections.length === 0 && fullText.trim() === '') {
    return {
      goldenScores: { goal: 0, output: 0, limits: 0, data: 0, evaluation: 0, next: 0, total: 0 },
      overallScore: 0,
      grade: 'F',
    };
  }

  const goal = scoreGoal(sections, fullText);
  const output = scoreOutput(sections, fullText);
  const limits = scoreLimits(sections, fullText);
  const data = scoreData(sections, fullText);
  const evaluation = scoreEvaluation(sections, fullText);
  const next = scoreNext(sections, fullText);

  const total = Math.min((goal + output + limits + data + evaluation + next) / 6, 1);
  const overallScore = Math.round(total * 100);
  const grade = calculateGrade(total);

  return {
    goldenScores: { goal, output, limits, data, evaluation, next, total },
    overallScore,
    grade,
  };
}
