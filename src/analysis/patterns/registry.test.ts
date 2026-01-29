import { describe, it, expect } from 'vitest';
import {
    getPatterns,
    getKeywords,
    matchesPattern,
    findMatchingKeywords,
    countMatches
} from './registry.js';

describe('registry', () => {
    describe('getPatterns', () => {
        it('should return intent patterns', () => {
            const patterns = getPatterns('intent');
            expect(patterns).toBeDefined();
            expect(patterns['command']).toBeDefined();
        });

        it('should return category patterns', () => {
            const patterns = getPatterns('category');
            expect(patterns).toBeDefined();
            expect(patterns['bug-fix']).toBeDefined();
        });
    });

    describe('getKeywords', () => {
        it('should return keywords for intent', () => {
            const keywords = getKeywords('intent', 'question');
            expect(keywords).toContain('어떻게');
            expect(keywords).toContain('how');
        });

        it('should return keywords for signal', () => {
            const keywords = getKeywords('signal', 'positive');
            expect(keywords).toContain('감사');
            expect(keywords).toContain('thank');
        });
    });

    describe('matchesPattern', () => {
        it('should match intent pattern', () => {
            expect(matchesPattern('이거 어떻게 해요?', 'intent', 'question')).toBe(true);
        });

        it('should match category pattern', () => {
            expect(matchesPattern('새로운 기능을 작성해줘', 'category', 'code-generation')).toBe(true);
        });

        it('should match signal pattern', () => {
            expect(matchesPattern('정말 고마워요', 'signal', 'positive')).toBe(true);
        });
    });

    describe('findMatchingKeywords', () => {
        it('should find matching keywords across types', () => {
            const intentMatches = findMatchingKeywords('어떻게 하나요?', 'intent', 'question');
            expect(intentMatches).toContain('어떻게');

            const signalMatches = findMatchingKeywords('감사합니다!', 'signal', 'positive');
            expect(signalMatches).toContain('감사');
        });
    });

    describe('countMatches', () => {
        it('should count matches correctly', () => {
            const count = countMatches('감사합니다 정말 완벽해요', 'signal', 'positive');
            expect(count).toBe(2);
        });

        it('should count for non-signal types as well', () => {
            const count = countMatches('먼저 하고 나중에 해요', 'intent', 'instruction');
            expect(count).toBe(2); // '먼저', '나중에'
        });
    });
});
