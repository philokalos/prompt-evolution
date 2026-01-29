import { describe, it, expect } from 'vitest';
import {
    containsSignalPattern,
    findSignalKeywords,
    countSignalMatches,
    getSignalKeywords
} from './signal-patterns.js';

describe('signal-patterns', () => {
    describe('containsSignalPattern', () => {
        it('should detect positive feedback', () => {
            expect(containsSignalPattern('정말 완벽해요!', 'positive')).toBe(true);
            expect(containsSignalPattern('This is amazing', 'positive')).toBe(true);
        });

        it('should detect negative feedback', () => {
            expect(containsSignalPattern('버그가 있어요', 'negative')).toBe(true);
            expect(containsSignalPattern('This is broken', 'negative')).toBe(true);
        });

        it('should detect retry patterns', () => {
            expect(containsSignalPattern('다시 해보세요', 'retry')).toBe(true);
            expect(containsSignalPattern('try again please', 'retry')).toBe(true);
        });

        it('should handle case insensitivity', () => {
            expect(containsSignalPattern('DONE', 'completion')).toBe(true);
            expect(containsSignalPattern('완료', 'completion')).toBe(true);
        });
    });

    describe('findSignalKeywords', () => {
        it('should extract all matching keywords', () => {
            const matched = findSignalKeywords('감사합니다 정말 완벽해요', 'positive');
            expect(matched).toContain('감사');
            expect(matched).toContain('완벽');
        });

        it('should return empty list if no match', () => {
            expect(findSignalKeywords('hello', 'positive')).toEqual([]);
        });
    });

    describe('countSignalMatches', () => {
        it('should count the number of matching keywords', () => {
            const count = countSignalMatches('버그가 있고 에러가 나요', 'negative');
            expect(count).toBe(2); // '버그', '에러'
        });
    });

    describe('getSignalKeywords', () => {
        it('should return combined keywords for a type', () => {
            const keywords = getSignalKeywords('command');
            expect(keywords).toContain('해줘');
            expect(keywords).toContain('create');
        });
    });
});
