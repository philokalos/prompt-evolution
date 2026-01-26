/**
 * Ghost Bar Analysis Module
 *
 * Provides analysis caching and variant selection for Ghost Bar.
 * Uses text hash-based Map cache with 5-minute TTL.
 */

import * as crypto from 'crypto';
import type { GhostBarState, Grade, VariantType } from './ghost-bar-types.js';
import type { AnalysisResult, RewriteResult } from './learning-engine.js';

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ANALYSIS_TIMEOUT_MS = 5000; // 5 seconds

// Cached analysis entry
interface CachedAnalysis {
  textHash: string;
  result: AnalysisResult;
  timestamp: number;
}

// Analysis cache (Map with text hash as key)
const analysisCache = new Map<string, CachedAnalysis>();

// Current analysis state (for cancellation)
let currentAnalysisAbortController: AbortController | null = null;

/**
 * Calculate MD5 hash of text for cache key
 */
function calculateTextHash(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex');
}

/**
 * Check if cached entry is still valid
 */
function isCacheValid(entry: CachedAnalysis): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/**
 * Clean up expired cache entries
 */
function cleanupExpiredCache(): void {
  const now = Date.now();
  for (const [hash, entry] of analysisCache.entries()) {
    if (now - entry.timestamp >= CACHE_TTL_MS) {
      analysisCache.delete(hash);
    }
  }
}

/**
 * Get cached analysis result
 */
export function getCachedAnalysis(text: string): AnalysisResult | null {
  const hash = calculateTextHash(text);
  const entry = analysisCache.get(hash);

  if (entry && isCacheValid(entry)) {
    console.log('[GhostBarAnalysis] Cache hit for hash:', hash.substring(0, 8));
    return entry.result;
  }

  if (entry) {
    // Expired entry, remove it
    analysisCache.delete(hash);
  }

  return null;
}

/**
 * Store analysis result in cache
 */
export function cacheAnalysis(text: string, result: AnalysisResult): void {
  const hash = calculateTextHash(text);
  analysisCache.set(hash, {
    textHash: hash,
    result,
    timestamp: Date.now(),
  });
  console.log('[GhostBarAnalysis] Cached analysis for hash:', hash.substring(0, 8));

  // Periodically clean up expired entries
  if (analysisCache.size > 50) {
    cleanupExpiredCache();
  }
}

/**
 * Score to grade conversion
 */
export function scoreToGrade(score: number): Grade {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

/**
 * Select the best variant from analysis results
 * Priority: AI variant first (if successful), then Balanced variant
 */
export function selectBestVariant(
  result: AnalysisResult
): { variant: RewriteResult; type: VariantType } | null {
  const variants = result.promptVariants;

  if (!variants || variants.length === 0) {
    console.log('[GhostBarAnalysis] No variants available');
    return null;
  }

  // Find AI variant (isAiGenerated: true, not needsSetup)
  const aiVariant = variants.find(
    (v) => v.variant === 'ai' && v.isAiGenerated && !v.needsSetup && v.rewrittenPrompt
  );

  if (aiVariant) {
    console.log('[GhostBarAnalysis] Selected AI variant');
    return { variant: aiVariant, type: 'ai' };
  }

  // Fallback to Balanced variant
  const balancedVariant = variants.find(
    (v) => v.variant === 'balanced' && v.rewrittenPrompt
  );

  if (balancedVariant) {
    console.log('[GhostBarAnalysis] Selected Balanced variant (AI fallback)');
    return { variant: balancedVariant, type: 'balanced' };
  }

  // Further fallback to any available variant with rewritten prompt
  const anyVariant = variants.find((v) => v.rewrittenPrompt && !v.needsSetup);

  if (anyVariant) {
    console.log('[GhostBarAnalysis] Selected fallback variant:', anyVariant.variant);
    return { variant: anyVariant, type: anyVariant.variant as VariantType };
  }

  console.log('[GhostBarAnalysis] No suitable variant found');
  return null;
}

/**
 * Analyze prompt with timeout
 * Returns null if analysis times out or fails
 */
export async function analyzeWithTimeout(
  text: string,
  analyzePromptFn: (text: string) => Promise<AnalysisResult>
): Promise<AnalysisResult | null> {
  // Cancel any previous analysis
  if (currentAnalysisAbortController) {
    currentAnalysisAbortController.abort();
  }

  currentAnalysisAbortController = new AbortController();
  const signal = currentAnalysisAbortController.signal;

  // Check cache first
  const cached = getCachedAnalysis(text);
  if (cached) {
    return cached;
  }

  try {
    // Create timeout promise
    const timeoutPromise = new Promise<null>((resolve) => {
      const timeoutId = setTimeout(() => resolve(null), ANALYSIS_TIMEOUT_MS);

      // Clear timeout if aborted
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        resolve(null);
      });
    });

    // Race between analysis and timeout
    const result = await Promise.race([
      analyzePromptFn(text),
      timeoutPromise,
    ]);

    if (signal.aborted) {
      console.log('[GhostBarAnalysis] Analysis was cancelled');
      return null;
    }

    if (!result) {
      console.warn('[GhostBarAnalysis] Analysis timed out');
      return null;
    }

    // Cache successful result
    cacheAnalysis(text, result);
    return result;
  } catch (error) {
    if (signal.aborted) {
      console.log('[GhostBarAnalysis] Analysis was cancelled');
      return null;
    }
    console.error('[GhostBarAnalysis] Analysis failed:', error);
    return null;
  } finally {
    currentAnalysisAbortController = null;
  }
}

/**
 * Cancel current analysis (for re-copy scenarios)
 */
export function cancelCurrentAnalysis(): void {
  if (currentAnalysisAbortController) {
    currentAnalysisAbortController.abort();
    currentAnalysisAbortController = null;
    console.log('[GhostBarAnalysis] Analysis cancelled');
  }
}

/**
 * Check if analysis can be improved (not already A-grade)
 */
export function canBeImproved(result: AnalysisResult): boolean {
  return result.grade !== 'A';
}

/**
 * Create GhostBarState from analysis result
 */
export function createGhostBarState(
  originalText: string,
  result: AnalysisResult,
  sourceApp: string | null,
  isBlockedApp: boolean
): GhostBarState | null {
  const selected = selectBestVariant(result);

  if (!selected) {
    return null;
  }

  const { variant, type } = selected;

  // Calculate improved score (estimate from variant confidence)
  // If variant has confidence, use it; otherwise estimate based on variant type
  let improvedScore: number;
  if (variant.confidence > 0) {
    improvedScore = Math.min(100, result.overallScore + Math.round(variant.confidence * 30));
  } else {
    // Estimate based on variant type
    const boostMap: Record<VariantType, number> = {
      ai: 30,
      comprehensive: 25,
      balanced: 20,
      conservative: 10,
    };
    improvedScore = Math.min(100, result.overallScore + (boostMap[type] || 15));
  }

  return {
    id: crypto.randomUUID(),
    originalText,
    improvedText: variant.rewrittenPrompt,
    originalGrade: result.grade as Grade,
    improvedGrade: scoreToGrade(improvedScore),
    originalScore: result.overallScore,
    improvedScore,
    variantType: type,
    isBlockedApp,
    sourceApp,
  };
}

/**
 * Clear analysis cache
 */
export function clearAnalysisCache(): void {
  analysisCache.clear();
  console.log('[GhostBarAnalysis] Cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; validEntries: number } {
  let validEntries = 0;
  for (const entry of analysisCache.values()) {
    if (isCacheValid(entry)) {
      validEntries++;
    }
  }
  return {
    size: analysisCache.size,
    validEntries,
  };
}
