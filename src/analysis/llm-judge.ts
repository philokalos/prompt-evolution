/**
 * LLM-as-a-Judge Module
 * Optional LLM-based evaluation for GOLDEN scores
 *
 * Features:
 * - Chain-of-Thought based evaluation
 * - Caching with TTL
 * - Score merging with rule-based results
 * - Graceful fallback when LLM unavailable
 */

import type { GOLDENScore } from '../shared/types/index.js';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LLM Judge configuration
 */
export interface LLMJudgeConfig {
  enabled: boolean;
  apiKey?: string;
  model?: string;
  cacheTTL?: number; // milliseconds, default 1 hour
  timeout?: number; // milliseconds, default 30 seconds
}

/**
 * LLM evaluation result
 */
export interface LLMEvaluationResult {
  scores: GOLDENScore;
  reasoning: string;
  confidence: number;
  cached: boolean;
}

/**
 * Merged evaluation result
 */
export interface MergedEvaluationResult {
  scores: GOLDENScore;
  source: 'rule-based' | 'llm' | 'merged';
  llmReasoning?: string;
  mergeDetails?: {
    dimension: string;
    ruleBasedScore: number;
    llmScore: number;
    finalScore: number;
    weight: 'llm-heavy' | 'balanced';
  }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache Implementation
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  result: LLMEvaluationResult;
  timestamp: number;
}

const evaluationCache = new Map<string, CacheEntry>();

/**
 * Generate a hash for cache key
 */
function hashPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}

/**
 * Get cached evaluation if valid
 */
function getFromCache(
  hash: string,
  ttl: number
): LLMEvaluationResult | null {
  const entry = evaluationCache.get(hash);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > ttl) {
    evaluationCache.delete(hash);
    return null;
  }

  return { ...entry.result, cached: true };
}

/**
 * Store evaluation in cache
 */
function setCache(hash: string, result: LLMEvaluationResult): void {
  evaluationCache.set(hash, {
    result,
    timestamp: Date.now(),
  });

  // Clean old entries if cache is too large (max 100 entries)
  if (evaluationCache.size > 100) {
    const now = Date.now();
    const defaultTTL = 60 * 60 * 1000; // 1 hour
    for (const [key, entry] of evaluationCache) {
      if (now - entry.timestamp > defaultTTL) {
        evaluationCache.delete(key);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM Evaluation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * System prompt for GOLDEN evaluation
 */
const GOLDEN_JUDGE_SYSTEM_PROMPT = `You are an expert prompt quality evaluator. Evaluate the given prompt against the GOLDEN checklist framework.

GOLDEN Dimensions:
- Goal (G): Is the objective clear and specific?
- Output (O): Is the expected output format defined?
- Limits (L): Are constraints and boundaries specified?
- Data (D): Is relevant context/data provided?
- Evaluation (E): Are success criteria defined?
- Next (N): Are follow-up steps mentioned?

For each dimension, provide:
1. A score from 0.0 to 1.0
2. Brief reasoning (1-2 sentences)

Respond in JSON format:
{
  "goal": { "score": 0.0-1.0, "reason": "..." },
  "output": { "score": 0.0-1.0, "reason": "..." },
  "limits": { "score": 0.0-1.0, "reason": "..." },
  "data": { "score": 0.0-1.0, "reason": "..." },
  "evaluation": { "score": 0.0-1.0, "reason": "..." },
  "next": { "score": 0.0-1.0, "reason": "..." },
  "overall_reasoning": "Brief overall assessment"
}

Be strict but fair. Consider both explicit mentions and implicit understanding.`;

/**
 * Call LLM for GOLDEN evaluation
 */
async function callLLMForEvaluation(
  prompt: string,
  config: LLMJudgeConfig
): Promise<LLMEvaluationResult | null> {
  if (!config.apiKey) {
    return null;
  }

  const model = config.model || 'claude-3-haiku-20240307';
  const timeout = config.timeout || 30000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: GOLDEN_JUDGE_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Evaluate this prompt:\n\n${prompt}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[LLM Judge] API error: ${response.status}`);
      return null;
    }

    const data = await response.json() as { content?: Array<{ text?: string }> };
    const content = data.content?.[0]?.text;

    if (!content) {
      console.warn('[LLM Judge] Empty response');
      return null;
    }

    // Parse JSON response
    const parsed = parseEvaluationResponse(content);
    if (!parsed) {
      console.warn('[LLM Judge] Failed to parse response');
      return null;
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[LLM Judge] Request timed out');
    } else {
      console.warn('[LLM Judge] Request failed:', error);
    }
    return null;
  }
}

/**
 * Parse LLM evaluation response
 */
function parseEvaluationResponse(content: string): LLMEvaluationResult | null {
  try {
    // Extract JSON from response (may have markdown wrapper)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Extract scores
    const scores: GOLDENScore = {
      goal: clampScore(parsed.goal?.score),
      output: clampScore(parsed.output?.score),
      limits: clampScore(parsed.limits?.score),
      data: clampScore(parsed.data?.score),
      evaluation: clampScore(parsed.evaluation?.score),
      next: clampScore(parsed.next?.score),
      total: 0,
    };

    // Calculate total
    scores.total = (
      scores.goal + scores.output + scores.limits +
      scores.data + scores.evaluation + scores.next
    ) / 6;

    // Build reasoning
    const reasoningParts: string[] = [];
    if (parsed.goal?.reason) reasoningParts.push(`Goal: ${parsed.goal.reason}`);
    if (parsed.output?.reason) reasoningParts.push(`Output: ${parsed.output.reason}`);
    if (parsed.limits?.reason) reasoningParts.push(`Limits: ${parsed.limits.reason}`);
    if (parsed.data?.reason) reasoningParts.push(`Data: ${parsed.data.reason}`);
    if (parsed.evaluation?.reason) reasoningParts.push(`Evaluation: ${parsed.evaluation.reason}`);
    if (parsed.next?.reason) reasoningParts.push(`Next: ${parsed.next.reason}`);
    if (parsed.overall_reasoning) reasoningParts.push(`Overall: ${parsed.overall_reasoning}`);

    return {
      scores,
      reasoning: reasoningParts.join('\n'),
      confidence: 0.85, // LLM evaluation confidence
      cached: false,
    };
  } catch (error) {
    console.warn('[LLM Judge] JSON parse error:', error);
    return null;
  }
}

/**
 * Clamp score to valid range
 */
function clampScore(value: unknown): number {
  if (typeof value !== 'number' || isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate prompt with LLM (with caching)
 */
export async function evaluateWithLLM(
  prompt: string,
  config: LLMJudgeConfig
): Promise<LLMEvaluationResult | null> {
  if (!config.enabled || !config.apiKey) {
    return null;
  }

  const hash = hashPrompt(prompt);
  const ttl = config.cacheTTL || 60 * 60 * 1000; // 1 hour default

  // Check cache first
  const cached = getFromCache(hash, ttl);
  if (cached) {
    return cached;
  }

  // Call LLM
  const result = await callLLMForEvaluation(prompt, config);
  if (result) {
    setCache(hash, result);
  }

  return result;
}

/**
 * Merge rule-based and LLM-based scores
 *
 * Strategy:
 * - Large difference (>0.25): Trust LLM more (70%)
 * - Small difference: Balanced average (LLM 55%)
 */
export function mergeScores(
  ruleBased: GOLDENScore,
  llmBased: GOLDENScore
): MergedEvaluationResult {
  const LARGE_DIFF_THRESHOLD = 0.25;
  const merged: GOLDENScore = { ...ruleBased };
  const mergeDetails: MergedEvaluationResult['mergeDetails'] = [];

  const dimensions = ['goal', 'output', 'limits', 'data', 'evaluation', 'next'] as const;

  for (const dim of dimensions) {
    const ruleScore = ruleBased[dim];
    const llmScore = llmBased[dim];
    const diff = Math.abs(ruleScore - llmScore);

    let finalScore: number;
    let weight: 'llm-heavy' | 'balanced';

    if (diff > LARGE_DIFF_THRESHOLD) {
      // Large difference: trust LLM more (70%)
      finalScore = ruleScore * 0.3 + llmScore * 0.7;
      weight = 'llm-heavy';
    } else {
      // Small difference: balanced (LLM 55%)
      finalScore = ruleScore * 0.45 + llmScore * 0.55;
      weight = 'balanced';
    }

    merged[dim] = Math.min(1, Math.max(0, finalScore));

    mergeDetails.push({
      dimension: dim,
      ruleBasedScore: ruleScore,
      llmScore: llmScore,
      finalScore: merged[dim],
      weight,
    });
  }

  // Recalculate total
  merged.total = dimensions.reduce((sum, dim) => sum + merged[dim], 0) / dimensions.length;

  return {
    scores: merged,
    source: 'merged',
    mergeDetails,
  };
}

/**
 * Hybrid evaluation: Rule-based with optional LLM enhancement
 */
export async function evaluateWithHybrid(
  prompt: string,
  ruleBasedResult: GOLDENScore,
  config: LLMJudgeConfig
): Promise<MergedEvaluationResult> {
  // If LLM is not enabled or available, return rule-based result
  if (!config.enabled || !config.apiKey) {
    return {
      scores: ruleBasedResult,
      source: 'rule-based',
    };
  }

  // Try LLM evaluation
  const llmResult = await evaluateWithLLM(prompt, config);

  if (!llmResult) {
    // LLM failed, return rule-based result
    return {
      scores: ruleBasedResult,
      source: 'rule-based',
    };
  }

  // Merge scores
  const merged = mergeScores(ruleBasedResult, llmResult.scores);
  merged.llmReasoning = llmResult.reasoning;

  return merged;
}

/**
 * Clear evaluation cache
 */
export function clearEvaluationCache(): void {
  evaluationCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; oldestEntry: number | null } {
  let oldest: number | null = null;
  for (const entry of evaluationCache.values()) {
    if (oldest === null || entry.timestamp < oldest) {
      oldest = entry.timestamp;
    }
  }
  return {
    size: evaluationCache.size,
    oldestEntry: oldest,
  };
}
