/**
 * AI-based Prompt Classifier
 * Uses OpenAI API for complex classification when rule-based is insufficient
 */

import type {
  PromptIntent,
  TaskCategory,
  ClassificationResult,
} from './classifier.js';
import { classifyPrompt as ruleBasedClassify } from './classifier.js';

/**
 * AI classification configuration
 */
export interface AIClassifierConfig {
  apiKey?: string;
  model?: string;
  confidenceThreshold?: number;
  enableFallback?: boolean;
}

/**
 * Enhanced classification result with AI insights
 */
export interface AIClassificationResult extends ClassificationResult {
  aiEnhanced: boolean;
  reasoning?: string;
  suggestions?: string[];
  alternativeIntents?: Array<{ intent: PromptIntent; confidence: number }>;
  alternativeCategories?: Array<{ category: TaskCategory; confidence: number }>;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<AIClassifierConfig> = {
  apiKey: process.env.OPENAI_API_KEY || '',
  model: 'gpt-4o-mini',
  confidenceThreshold: 0.7,
  enableFallback: true,
};

/**
 * AI Classifier class
 */
export class AIClassifier {
  private config: Required<AIClassifierConfig>;
  private isAvailable: boolean;

  constructor(config: AIClassifierConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.isAvailable = !!this.config.apiKey;
  }

  /**
   * Check if AI classification is available
   */
  isEnabled(): boolean {
    return this.isAvailable;
  }

  /**
   * Classify prompt with AI assistance
   */
  async classify(text: string): Promise<AIClassificationResult> {
    // First, get rule-based classification
    const ruleResult = ruleBasedClassify(text);

    // If confidence is high enough, return rule-based result
    if (
      ruleResult.intentConfidence >= this.config.confidenceThreshold &&
      ruleResult.categoryConfidence >= this.config.confidenceThreshold
    ) {
      return {
        ...ruleResult,
        aiEnhanced: false,
      };
    }

    // If AI is not available, return rule-based with fallback note
    if (!this.isAvailable) {
      return {
        ...ruleResult,
        aiEnhanced: false,
        reasoning: 'AI classification unavailable, using rule-based only',
      };
    }

    // Use AI for enhanced classification
    try {
      const aiResult = await this.callAI(text, ruleResult);
      return aiResult;
    } catch (error) {
      if (this.config.enableFallback) {
        return {
          ...ruleResult,
          aiEnhanced: false,
          reasoning: `AI classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
      throw error;
    }
  }

  /**
   * Call OpenAI API for classification
   */
  private async callAI(
    text: string,
    ruleResult: ClassificationResult
  ): Promise<AIClassificationResult> {
    const systemPrompt = `You are a prompt classification expert. Analyze the given user prompt and classify it.

Intent types:
- command: Direct instructions like "만들어줘", "create", "build"
- question: Questions like "왜", "how", "what is"
- instruction: Detailed instructions with context
- feedback: Response to AI output like "좋아", "아니", "수정해"
- context: Providing background information
- clarification: Asking for clarification

Task categories:
- code-generation: Creating new code
- code-review: Reviewing existing code
- bug-fix: Fixing bugs
- refactoring: Improving code structure
- explanation: Explaining concepts
- documentation: Writing docs
- testing: Writing tests
- architecture: System design
- deployment: DevOps tasks
- data-analysis: Data work
- general: General tasks

Respond in JSON format:
{
  "intent": "string",
  "intentConfidence": number,
  "taskCategory": "string",
  "categoryConfidence": number,
  "reasoning": "string",
  "suggestions": ["string"],
  "alternativeIntents": [{"intent": "string", "confidence": number}],
  "alternativeCategories": [{"category": "string", "confidence": number}]
}`;

    const userPrompt = `Classify this prompt:

"${text.slice(0, 2000)}"

Rule-based classification suggested:
- Intent: ${ruleResult.intent} (confidence: ${ruleResult.intentConfidence.toFixed(2)})
- Category: ${ruleResult.taskCategory} (confidence: ${ruleResult.categoryConfidence.toFixed(2)})
- Matched keywords: ${ruleResult.matchedKeywords.join(', ') || 'none'}

Please provide your classification analysis.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    const aiOutput = JSON.parse(content);

    return {
      intent: this.validateIntent(aiOutput.intent) || ruleResult.intent,
      intentConfidence: aiOutput.intentConfidence || ruleResult.intentConfidence,
      taskCategory: this.validateCategory(aiOutput.taskCategory) || ruleResult.taskCategory,
      categoryConfidence: aiOutput.categoryConfidence || ruleResult.categoryConfidence,
      matchedKeywords: ruleResult.matchedKeywords,
      features: ruleResult.features,
      aiEnhanced: true,
      reasoning: aiOutput.reasoning,
      suggestions: aiOutput.suggestions,
      alternativeIntents: aiOutput.alternativeIntents,
      alternativeCategories: aiOutput.alternativeCategories,
    };
  }

  /**
   * Validate intent value
   */
  private validateIntent(intent: string): PromptIntent | null {
    const validIntents: PromptIntent[] = [
      'command',
      'question',
      'instruction',
      'feedback',
      'context',
      'clarification',
      'unknown',
    ];
    return validIntents.includes(intent as PromptIntent)
      ? (intent as PromptIntent)
      : null;
  }

  /**
   * Validate category value
   */
  private validateCategory(category: string): TaskCategory | null {
    const validCategories: TaskCategory[] = [
      'code-generation',
      'code-review',
      'bug-fix',
      'refactoring',
      'explanation',
      'documentation',
      'testing',
      'architecture',
      'deployment',
      'data-analysis',
      'general',
      'unknown',
    ];
    return validCategories.includes(category as TaskCategory)
      ? (category as TaskCategory)
      : null;
  }

  /**
   * Batch classify multiple prompts
   */
  async classifyBatch(
    texts: string[],
    options: { parallel?: boolean; batchSize?: number } = {}
  ): Promise<AIClassificationResult[]> {
    const { parallel = false, batchSize = 5 } = options;

    if (parallel) {
      // Process in parallel batches
      const results: AIClassificationResult[] = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map((t) => this.classify(t)));
        results.push(...batchResults);
      }
      return results;
    } else {
      // Process sequentially
      const results: AIClassificationResult[] = [];
      for (const text of texts) {
        results.push(await this.classify(text));
      }
      return results;
    }
  }
}

/**
 * Default classifier instance
 */
let defaultClassifier: AIClassifier | null = null;

/**
 * Get or create default classifier
 */
export function getAIClassifier(config?: AIClassifierConfig): AIClassifier {
  if (!defaultClassifier || config) {
    defaultClassifier = new AIClassifier(config);
  }
  return defaultClassifier;
}

/**
 * Simple classify function using default classifier
 */
export async function aiClassifyPrompt(
  text: string,
  config?: AIClassifierConfig
): Promise<AIClassificationResult> {
  const classifier = getAIClassifier(config);
  return classifier.classify(text);
}

/**
 * Check if AI classification is available
 */
export function isAIClassificationAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
