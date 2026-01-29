import { describe, it, expect } from 'vitest';
import {
    calculateEffectiveness,
    getGrade,
    getGradeDescription,
    analyzeEffectiveness,
    calculatePromptQuality,
    analyzeClassificationPatterns,
    calculateAggregateEffectiveness,
    compareEffectiveness,
    EFFECTIVENESS_WEIGHTS,
} from './scorer.js';
import type { ConversationSignals } from './signal-detector.js';
import type { ClassificationResult } from './classifier.js';

describe('scorer', () => {
    describe('calculateEffectiveness', () => {
        it('should calculate effectiveness from conversation signals', () => {
            const signals: ConversationSignals = {
                conversationId: 'test-1',
                summary: {
                    positiveCount: 5,
                    negativeCount: 1,
                    retryCount: 0,
                    completionCount: 1,
                    questionCount: 3,
                    commandCount: 7,
                    contextCount: 2,
                    sentimentScore: 0.8,
                    retryRate: 0,
                    hasCompletion: true,
                },
                signals: [],
            };

            const result = calculateEffectiveness(signals);

            expect(result.sentimentScore).toBeCloseTo(0.9); // (0.8 + 1) / 2
            expect(result.completionScore).toBe(1.0);
            expect(result.efficiencyScore).toBe(1.0); // no retries
            expect(result.engagementScore).toBeGreaterThan(0);
            expect(result.overall).toBeGreaterThan(0.7);
        });

        it('should handle negative sentiment correctly', () => {
            const signals: ConversationSignals = {
                conversationId: 'test-2',
                summary: {
                    positiveCount: 0,
                    negativeCount: 5,
                    retryCount: 3,
                    completionCount: 0,
                    questionCount: 1,
                    commandCount: 1,
                    contextCount: 0,
                    sentimentScore: -0.6,
                    retryRate: 0.5,
                    hasCompletion: false,
                },
                signals: [],
            };

            const result = calculateEffectiveness(signals);

            expect(result.sentimentScore).toBeCloseTo(0.2); // (-0.6 + 1) / 2
            expect(result.completionScore).toBe(0.5);
            expect(result.efficiencyScore).toBe(0); // high retry rate
        });

        it('should apply correct weights to overall score', () => {
            const signals: ConversationSignals = {
                conversationId: 'test-3',
                summary: {
                    positiveCount: 2,
                    negativeCount: 2,
                    retryCount: 0,
                    completionCount: 1,
                    questionCount: 1,
                    commandCount: 1,
                    contextCount: 1,
                    sentimentScore: 0,
                    retryRate: 0,
                    hasCompletion: true,
                },
                signals: [],
            };

            const result = calculateEffectiveness(signals);

            const expectedOverall =
                result.sentimentScore * EFFECTIVENESS_WEIGHTS.sentiment +
                result.completionScore * EFFECTIVENESS_WEIGHTS.completion +
                result.efficiencyScore * EFFECTIVENESS_WEIGHTS.efficiency +
                result.engagementScore * EFFECTIVENESS_WEIGHTS.engagement;

            expect(result.overall).toBeCloseTo(expectedOverall);
        });
    });

    describe('getGrade', () => {
        it('should return correct grade for each score range', () => {
            expect(getGrade(0.95)).toBe('A');
            expect(getGrade(0.9)).toBe('A');
            expect(getGrade(0.8)).toBe('B');
            expect(getGrade(0.75)).toBe('B');
            expect(getGrade(0.65)).toBe('C');
            expect(getGrade(0.6)).toBe('C');
            expect(getGrade(0.5)).toBe('D');
            expect(getGrade(0.4)).toBe('D');
            expect(getGrade(0.3)).toBe('F');
            expect(getGrade(0.0)).toBe('F');
        });
    });

    describe('getGradeDescription', () => {
        it('should return Korean descriptions for all grades', () => {
            expect(getGradeDescription('A')).toContain('매우 효과적');
            expect(getGradeDescription('B')).toContain('효과적');
            expect(getGradeDescription('C')).toContain('보통');
            expect(getGradeDescription('D')).toContain('비효율적');
            expect(getGradeDescription('F')).toContain('매우 비효율적');
        });
    });

    describe('analyzeEffectiveness', () => {
        it('should generate insights and recommendations', () => {
            const signals: ConversationSignals = {
                conversationId: 'test-4',
                summary: {
                    positiveCount: 1,
                    negativeCount: 5,
                    retryCount: 4,
                    completionCount: 0,
                    questionCount: 2,
                    commandCount: 2,
                    contextCount: 0,
                    sentimentScore: -0.5,
                    retryRate: 0.6,
                    hasCompletion: false,
                },
                signals: [],
            };

            const analysis = analyzeEffectiveness(signals);

            expect(analysis.grade).toBeDefined();
            expect(analysis.insights.length).toBeGreaterThan(0);
            expect(analysis.recommendations.length).toBeGreaterThan(0);
            expect(analysis.insights).toContain('부정적인 피드백이 많음');
            expect(analysis.insights).toContain('재시도가 많았음');
        });

        it('should recognize high-quality conversations', () => {
            const signals: ConversationSignals = {
                conversationId: 'test-5',
                summary: {
                    positiveCount: 10,
                    negativeCount: 0,
                    retryCount: 0,
                    completionCount: 1,
                    questionCount: 2,
                    commandCount: 5,
                    contextCount: 3,
                    sentimentScore: 0.9,
                    retryRate: 0,
                    hasCompletion: true,
                },
                signals: [],
            };

            const analysis = analyzeEffectiveness(signals);

            expect(analysis.score.overall).toBeGreaterThan(0.7);
            expect(analysis.grade).toMatch(/^[AB]$/); // Accept A or B for high quality
            expect(analysis.insights).toContain('긍정적인 피드백이 많음');
        });
    });

    describe('calculatePromptQuality', () => {
        it('should calculate quality from classification', () => {
            const classification: ClassificationResult = {
                intent: 'command',
                taskCategory: 'code-generation',
                intentConfidence: 0.9,
                categoryConfidence: 0.85,
                matchedKeywords: [],
                features: {
                    languageHint: 'ko',
                    hasCodeBlock: true,
                    hasFilePath: true,
                    hasUrl: false,
                    wordCount: 50,
                    length: 200,
                    hasQuestionMark: false,
                    hasExclamationMark: false,
                    complexity: 'moderate',
                },
            };

            const quality = calculatePromptQuality(classification);

            expect(quality.clarity).toBeCloseTo(0.875); // (0.9 + 0.85) / 2
            expect(quality.structure).toBeGreaterThan(0.5);
            expect(quality.context).toBeGreaterThan(0.3);
            expect(quality.overall).toBeGreaterThan(0);
        });

        it('should penalize overly complex prompts', () => {
            const simple: ClassificationResult = {
                intent: 'command',
                taskCategory: 'code-generation',
                intentConfidence: 0.8,
                categoryConfidence: 0.8,
                matchedKeywords: [],
                features: {
                    languageHint: 'en',
                    hasCodeBlock: false,
                    hasFilePath: false,
                    hasUrl: false,
                    wordCount: 15,
                    length: 60,
                    hasQuestionMark: false,
                    hasExclamationMark: false,
                    complexity: 'moderate',
                },
            };

            const complex: ClassificationResult = {
                ...simple,
                features: {
                    ...simple.features,
                    complexity: 'complex',
                    wordCount: 150,
                },
            };

            const simpleQuality = calculatePromptQuality(simple);
            const complexQuality = calculatePromptQuality(complex);

            expect(simpleQuality.structure).toBeGreaterThanOrEqual(complexQuality.structure);
        });
    });

    describe('analyzeClassificationPatterns', () => {
        it('should analyze patterns from multiple prompts', () => {
            const prompts = [
                '새로운 기능을 만들어줘',
                '이 코드를 리팩토링해줘',
                '버그를 수정해줘',
                '테스트를 작성해줘',
            ];

            const insights = analyzeClassificationPatterns(prompts);

            expect(insights.dominantIntent).toBeDefined();
            expect(insights.dominantCategory).toBeDefined();
            expect(insights.averageQuality.overall).toBeGreaterThan(0);
        });

        it('should handle empty prompt list', () => {
            const insights = analyzeClassificationPatterns([]);

            expect(insights.dominantIntent).toBe('unknown');
            expect(insights.dominantCategory).toBe('unknown');
            expect(insights.averageQuality.overall).toBe(0);
        });

        it('should generate recommendations based on quality', () => {
            const lowQualityPrompts = ['해줘', '뭐야', '이거'];

            const insights = analyzeClassificationPatterns(lowQualityPrompts);

            expect(insights.recommendations.length).toBeGreaterThan(0);
        });
    });

    describe('calculateAggregateEffectiveness', () => {
        it('should aggregate multiple conversation signals', () => {
            const signals: ConversationSignals[] = [
                {
                    conversationId: 'c1',
                    summary: {
                        positiveCount: 5,
                        negativeCount: 0,
                        retryCount: 0,
                        completionCount: 1,
                        questionCount: 1,
                        commandCount: 3,
                        contextCount: 1,
                        sentimentScore: 0.8,
                        retryRate: 0,
                        hasCompletion: true,
                    },
                    signals: [],
                },
                {
                    conversationId: 'c2',
                    summary: {
                        positiveCount: 2,
                        negativeCount: 3,
                        retryCount: 2,
                        completionCount: 0,
                        questionCount: 2,
                        commandCount: 2,
                        contextCount: 0,
                        sentimentScore: -0.2,
                        retryRate: 0.4,
                        hasCompletion: false,
                    },
                    signals: [],
                },
            ];

            const aggregate = calculateAggregateEffectiveness(signals);

            expect(aggregate.totalConversations).toBe(2);
            expect(aggregate.averageScore).toBeGreaterThan(0);
            expect(aggregate.averageGrade).toBeDefined();
            expect(aggregate.scoreDistribution).toBeDefined();
        });

        it('should handle empty signal list', () => {
            const aggregate = calculateAggregateEffectiveness([]);

            expect(aggregate.totalConversations).toBe(0);
            expect(aggregate.averageScore).toBe(0);
            expect(aggregate.averageGrade).toBe('F');
        });
    });

    describe('compareEffectiveness', () => {
        it('should compare two conversations', () => {
            const signals1: ConversationSignals = {
                conversationId: 'c1',
                summary: {
                    positiveCount: 8,
                    negativeCount: 0,
                    retryCount: 0,
                    completionCount: 1,
                    questionCount: 2,
                    commandCount: 5,
                    contextCount: 2,
                    sentimentScore: 0.9,
                    retryRate: 0,
                    hasCompletion: true,
                },
                signals: [],
            };

            const signals2: ConversationSignals = {
                conversationId: 'c2',
                summary: {
                    positiveCount: 2,
                    negativeCount: 4,
                    retryCount: 3,
                    completionCount: 0,
                    questionCount: 3,
                    commandCount: 2,
                    contextCount: 0,
                    sentimentScore: -0.3,
                    retryRate: 0.5,
                    hasCompletion: false,
                },
                signals: [],
            };

            const comparison = compareEffectiveness(signals1, signals2);

            expect(comparison.conversation1Id).toBe('c1');
            expect(comparison.conversation2Id).toBe('c2');
            expect(comparison.score1).toBeGreaterThan(comparison.score2);
            expect(comparison.winner).toBe('conversation1');
            expect(comparison.insights.length).toBeGreaterThan(0);
        });

        it('should detect ties for similar scores', () => {
            const signals1: ConversationSignals = {
                conversationId: 'c1',
                summary: {
                    positiveCount: 3,
                    negativeCount: 2,
                    retryCount: 1,
                    completionCount: 1,
                    questionCount: 2,
                    commandCount: 3,
                    contextCount: 1,
                    sentimentScore: 0.2,
                    retryRate: 0.2,
                    hasCompletion: true,
                },
                signals: [],
            };

            const signals2: ConversationSignals = {
                ...signals1,
                conversationId: 'c2',
            };

            const comparison = compareEffectiveness(signals1, signals2);

            expect(comparison.winner).toBe('tie');
        });
    });
});
