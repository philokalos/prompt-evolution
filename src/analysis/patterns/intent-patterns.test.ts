import { describe, it, expect } from 'vitest';
import { matchesIntent, findIntentKeywords, getIntentKeywords } from './intent-patterns.js';

describe('intent-patterns', () => {
    describe('matchesIntent', () => {
        it('should match Korean keywords for command intent', () => {
            expect(matchesIntent('이 기능을 구현해줘', 'command')).toBe(true);
            expect(matchesIntent('코드를 작성해주세요', 'command')).toBe(true);
        });

        it('should match English keywords with word boundaries', () => {
            expect(matchesIntent('Please create a new class', 'command')).toBe(true);
            expect(matchesIntent('Fix the following bug', 'command')).toBe(true);
        });

        it('should match question intent', () => {
            expect(matchesIntent('이게 왜 안되나요?', 'question')).toBe(true);
            expect(matchesIntent('How can I do this?', 'question')).toBe(true);
        });

        it('should match feedback intent (Korean)', () => {
            expect(matchesIntent('정말 고마워요!', 'feedback')).toBe(true);
        });

        it('should match feedback intent (English)', () => {
            expect(matchesIntent('This is perfect', 'feedback')).toBe(true);
        });

        it('should match feedback intent (Korean negative)', () => {
            expect(matchesIntent('틀렸어요 다시 해주세요', 'feedback')).toBe(true);
        });

        it('should be case-insensitive for English keywords', () => {
            expect(matchesIntent('HOW DOES IT WORK', 'question')).toBe(true);
            expect(matchesIntent('THANK YOU', 'feedback')).toBe(true);
        });

        it('should return false for unknown intent', () => {
            expect(matchesIntent('some text', 'non-existent-intent')).toBe(false);
        });
    });

    describe('findIntentKeywords', () => {
        it('should find matching Korean keywords', () => {
            const matched = findIntentKeywords('먼저 코드를 작성하고 나중에 리팩토링해줘', 'instruction');
            expect(matched).toContain('먼저');
            expect(matched).toContain('나중에');
        });

        it('should find matching English keywords', () => {
            const matched = findIntentKeywords('First do this then do that', 'instruction');
            expect(matched).toContain('first');
            expect(matched).toContain('then');
        });
    });

    describe('getIntentKeywords', () => {
        it('should return all keywords for an intent', () => {
            const keywords = getIntentKeywords('clarification');
            expect(keywords).toContain('구체적으로');
            expect(keywords).toContain('clarify');
            expect(keywords).toContain('elaborate');
        });

        it('should return empty array for unknown intent', () => {
            expect(getIntentKeywords('unknown')).toEqual([]);
        });
    });
});
