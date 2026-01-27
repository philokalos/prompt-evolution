/**
 * Re-export shim for backward compatibility
 * All implementation moved to ./rewriter/ directory
 */
export {
  // Types
  type ConfidenceFactors,
  type GOLDENScore,
  type GuidelineEvaluation,
  type VariantType,
  type RewriteResult,
  type TemplateContext,
  type SectionGenerator,
  type CategoryTemplate,
  type PromptComplexity,
  type GOLDENEvaluator,
  // Functions
  generatePromptVariants,
  generateAIRewrite,
  generateAIRewriteWithProviders,
  generateAllVariantsWithProviders,
  generateAIVariantWithProviders,
  generateAllVariants,
  generateAIVariantOnly,
  getCategoryExample,
} from './rewriter/index.js';

// Re-export provider types for backward compatibility
export type { ProviderConfig, ProviderType } from './providers/types.js';
