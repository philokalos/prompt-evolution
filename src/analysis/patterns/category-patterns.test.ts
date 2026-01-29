import { describe, it, expect } from 'vitest';
import { matchesCategory, findCategoryKeywords, getCategoryKeywords } from './category-patterns.js';

describe('category-patterns', () => {
    describe('matchesCategory', () => {
        it('should match Korean keywords for code-generation', () => {
            expect(matchesCategory('새로운 기능을 만들어줘', 'code-generation')).toBe(true);
            expect(matchesCategory('API를 구현해봐', 'code-generation')).toBe(true);
        });

        it('should match English keywords with word boundaries', () => {
            expect(matchesCategory('Please implement the login feature', 'code-generation')).toBe(true);
            expect(matchesCategory('Write a function to add two numbers', 'code-generation')).toBe(true);
            // Negative case: word boundary check
            expect(matchesCategory('readdress the issue', 'code-generation')).toBe(false); // 'add' is within 'readdress'
        });

        it('should match bug-fix category', () => {
            expect(matchesCategory('에러가 발생했어요', 'bug-fix')).toBe(true);
            expect(matchesCategory('fix this bug', 'bug-fix')).toBe(true);
        });

        it('should be case-insensitive for English keywords', () => {
            expect(matchesCategory('FIX THE BUG', 'bug-fix')).toBe(true);
            expect(matchesCategory('IMPLEMENT stuff', 'code-generation')).toBe(true);
        });

        it('should return false for unknown category', () => {
            expect(matchesCategory('some text', 'non-existent-category')).toBe(false);
        });
    });

    describe('findCategoryKeywords', () => {
        it('should find matching Korean keywords', () => {
            const matched = findCategoryKeywords('코드를 리팩토링하고 개선해줘', 'refactoring');
            expect(matched).toContain('리팩토링');
            expect(matched).toContain('개선');
        });

        it('should find matching English keywords', () => {
            const matched = findCategoryKeywords('Refactor and improve the code', 'refactoring');
            expect(matched).toContain('refactor');
            expect(matched).toContain('improve');
        });

        it('should return empty array for no matches', () => {
            expect(findCategoryKeywords('hello world', 'bug-fix')).toEqual([]);
        });
    });

    describe('getCategoryKeywords', () => {
        it('should return all keywords for a category', () => {
            const keywords = getCategoryKeywords('testing');
            expect(keywords).toContain('테스트');
            expect(keywords).toContain('test');
            expect(keywords).toContain('vitest');
        });

        it('should return empty array for unknown category', () => {
            expect(getCategoryKeywords('unknown')).toEqual([]);
        });
    });
});
