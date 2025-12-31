/**
 * Signal Detector
 * Detects quality signals from conversation turns
 */

import {
  containsPattern,
  findMatchingKeywords,
  countPatternMatches,
  type SignalType,
} from './patterns.js';

/**
 * Detected signal from a turn
 */
export interface DetectedSignal {
  type: SignalType;
  turnId: string;
  turnIndex: number;
  keywords: string[];
  confidence: number; // 0-1
}

/**
 * Quality signals for a conversation
 */
export interface ConversationSignals {
  conversationId: string;
  signals: DetectedSignal[];
  summary: SignalSummary;
}

/**
 * Summary of signals
 */
export interface SignalSummary {
  positiveCount: number;
  negativeCount: number;
  retryCount: number;
  completionCount: number;
  questionCount: number;
  commandCount: number;
  contextCount: number;
  // Derived metrics
  sentimentScore: number; // -1 to 1
  retryRate: number; // 0 to 1
  hasCompletion: boolean;
}

/**
 * Turn data for analysis
 */
export interface TurnForAnalysis {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  turnIndex: number;
}

/**
 * Detect signals from a single turn
 */
export function detectTurnSignals(turn: TurnForAnalysis): DetectedSignal[] {
  const signals: DetectedSignal[] = [];

  // Only analyze user turns for quality signals
  if (turn.role !== 'user') {
    return signals;
  }

  const content = turn.content;

  // Check for positive feedback
  if (containsPattern(content, 'positive')) {
    const keywords = findMatchingKeywords(content, 'positive');
    signals.push({
      type: 'positive_feedback',
      turnId: turn.id,
      turnIndex: turn.turnIndex,
      keywords,
      confidence: calculateConfidence(keywords.length, content.length),
    });
  }

  // Check for negative feedback
  if (containsPattern(content, 'negative')) {
    const keywords = findMatchingKeywords(content, 'negative');
    signals.push({
      type: 'negative_feedback',
      turnId: turn.id,
      turnIndex: turn.turnIndex,
      keywords,
      confidence: calculateConfidence(keywords.length, content.length),
    });
  }

  // Check for retry attempts
  if (containsPattern(content, 'retry')) {
    const keywords = findMatchingKeywords(content, 'retry');
    signals.push({
      type: 'retry_attempt',
      turnId: turn.id,
      turnIndex: turn.turnIndex,
      keywords,
      confidence: calculateConfidence(keywords.length, content.length),
    });
  }

  // Check for task completion
  if (containsPattern(content, 'completion')) {
    const keywords = findMatchingKeywords(content, 'completion');
    signals.push({
      type: 'task_completion',
      turnId: turn.id,
      turnIndex: turn.turnIndex,
      keywords,
      confidence: calculateConfidence(keywords.length, content.length),
    });
  }

  // Check for questions
  if (containsPattern(content, 'question')) {
    const keywords = findMatchingKeywords(content, 'question');
    signals.push({
      type: 'question',
      turnId: turn.id,
      turnIndex: turn.turnIndex,
      keywords,
      confidence: calculateConfidence(keywords.length, content.length),
    });
  }

  // Check for commands
  if (containsPattern(content, 'command')) {
    const keywords = findMatchingKeywords(content, 'command');
    signals.push({
      type: 'command',
      turnId: turn.id,
      turnIndex: turn.turnIndex,
      keywords,
      confidence: calculateConfidence(keywords.length, content.length),
    });
  }

  // Check for context providing
  if (containsPattern(content, 'context')) {
    const keywords = findMatchingKeywords(content, 'context');
    signals.push({
      type: 'context_providing',
      turnId: turn.id,
      turnIndex: turn.turnIndex,
      keywords,
      confidence: calculateConfidence(keywords.length, content.length),
    });
  }

  return signals;
}

/**
 * Detect signals from all turns in a conversation
 */
export function detectConversationSignals(
  conversationId: string,
  turns: TurnForAnalysis[]
): ConversationSignals {
  const allSignals: DetectedSignal[] = [];

  for (const turn of turns) {
    const turnSignals = detectTurnSignals(turn);
    allSignals.push(...turnSignals);
  }

  const summary = calculateSummary(allSignals, turns.length);

  return {
    conversationId,
    signals: allSignals,
    summary,
  };
}

/**
 * Calculate confidence based on keyword matches and content length
 */
function calculateConfidence(keywordCount: number, contentLength: number): number {
  // Base confidence from keyword count
  const baseConfidence = Math.min(keywordCount * 0.3, 0.9);

  // Adjust for content length (shorter content with keywords = higher confidence)
  const lengthFactor = contentLength < 100 ? 1.1 : contentLength < 500 ? 1.0 : 0.9;

  return Math.min(baseConfidence * lengthFactor, 1.0);
}

/**
 * Calculate summary from detected signals
 */
function calculateSummary(
  signals: DetectedSignal[],
  totalTurns: number
): SignalSummary {
  const positiveCount = signals.filter(
    (s) => s.type === 'positive_feedback'
  ).length;
  const negativeCount = signals.filter(
    (s) => s.type === 'negative_feedback'
  ).length;
  const retryCount = signals.filter((s) => s.type === 'retry_attempt').length;
  const completionCount = signals.filter(
    (s) => s.type === 'task_completion'
  ).length;
  const questionCount = signals.filter((s) => s.type === 'question').length;
  const commandCount = signals.filter((s) => s.type === 'command').length;
  const contextCount = signals.filter((s) => s.type === 'context_providing').length;

  // Calculate sentiment score (-1 to 1)
  const totalFeedback = positiveCount + negativeCount;
  const sentimentScore =
    totalFeedback > 0 ? (positiveCount - negativeCount) / totalFeedback : 0;

  // Calculate retry rate
  const userTurns = Math.ceil(totalTurns / 2); // Approximate user turns
  const retryRate = userTurns > 0 ? retryCount / userTurns : 0;

  return {
    positiveCount,
    negativeCount,
    retryCount,
    completionCount,
    questionCount,
    commandCount,
    contextCount,
    sentimentScore,
    retryRate,
    hasCompletion: completionCount > 0,
  };
}

/**
 * Get the dominant signal type for a turn
 */
export function getDominantSignalType(
  turn: TurnForAnalysis
): SignalType | null {
  const signals = detectTurnSignals(turn);

  if (signals.length === 0) return null;

  // Sort by confidence and return the highest
  signals.sort((a, b) => b.confidence - a.confidence);
  return signals[0].type;
}

/**
 * Classify user prompt intent (basic version for signal detection)
 * Note: Use classifier.ts for more detailed classification
 */
export type BasicPromptIntent =
  | 'command'
  | 'question'
  | 'feedback'
  | 'context'
  | 'unknown';

export function classifyBasicPromptIntent(content: string): BasicPromptIntent {
  const commandScore = countPatternMatches(content, 'command');
  const questionScore = countPatternMatches(content, 'question');
  const feedbackScore =
    countPatternMatches(content, 'positive') +
    countPatternMatches(content, 'negative');
  const contextScore = countPatternMatches(content, 'context');

  const maxScore = Math.max(
    commandScore,
    questionScore,
    feedbackScore,
    contextScore
  );

  if (maxScore === 0) return 'unknown';

  if (commandScore === maxScore) return 'command';
  if (questionScore === maxScore) return 'question';
  if (feedbackScore === maxScore) return 'feedback';
  if (contextScore === maxScore) return 'context';

  return 'unknown';
}
