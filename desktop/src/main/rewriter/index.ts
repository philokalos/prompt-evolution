/**
 * Prompt Rewriter Engine v3
 * Barrel re-export file for all rewriter modules
 */

// Types
export type {
  ConfidenceFactors,
  GOLDENScore,
  GuidelineEvaluation,
  VariantType,
  RewriteResult,
  TemplateContext,
  SectionGenerator,
  CategoryTemplate,
  PromptComplexity,
  GOLDENEvaluator,
} from './types.js';

// Confidence
export {
  calculateCalibratedConfidence,
  countImprovedDimensions,
  calculateAntiPatternFreeScore,
  calculateContextRichness,
} from './confidence.js';

// Text analysis
export {
  detectPrimaryVerb,
  inferOutputFormat,
  buildMinimalContext,
  extractCodeFromPrompt,
  extractErrorFromPrompt,
  _inferWorkFromTools,
  getTechStackConstraints,
  extractCoreRequest,
  _detectLanguage,
  detectCategory,
  getCategoryLabel,
  detectComplexity,
  selectThinkMode,
  getSuccessCriteria,
} from './text-analysis.js';

// Templates
export {
  CATEGORY_TEMPLATES,
  generateFromTemplate,
  createTemplateContext,
  getCategoryExample,
  buildXMLPrompt,
  buildContextSection,
  buildOutputSection,
  buildLimitsSection,
  buildDataSection,
} from './templates.js';

// Variants
export {
  generateCOSPRewrite,
  _generateConservativeRewrite,
  _generateBalancedRewrite,
  _generateComprehensiveRewrite,
  generateAIRewrite,
  generateAIRewriteWithProviders,
  generateAllVariantsWithProviders,
  generateAIVariantWithProviders,
  generateAllVariants,
  generateAIVariantOnly,
  createAIPlaceholder,
  generatePromptVariants,
} from './variants.js';
