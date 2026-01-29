import { describe, it, expect, vi } from 'vitest';
import { getOverallStats } from './stats-repository.js';
import type { Database } from 'better-sqlite3';

describe('stats-repository', () => {
    describe('getOverallStats', () => {
        it('should return aggregated stats from multiple queries', () => {
            // Mock different results based on the query string passed to prepare
            const mockPrepare = vi.fn().mockImplementation((query: string) => {
                return {
                    get: vi.fn().mockImplementation(() => {
                        if (query.includes('FROM turns')) return { count: 100 };
                        if (query.includes('avgEffectiveness')) return { avgEffectiveness: 0.85 };
                        if (query.includes('avgQuality')) return { avgQuality: 0.92 };
                        if (query.includes('FROM conversations')) return { lastSync: '2023-01-01T10:00:00Z' };
                        if (query.includes('FROM quality_signals') && !query.includes('WHERE signal_type = ?')) {
                            return { lastAnalysis: '2023-01-01T11:00:00Z' };
                        }
                        if (query.includes('WHERE signal_type = ?')) return { avgScore: 0.8 };
                        return {};
                    })
                };
            });

            const mockDb = {
                prepare: mockPrepare,
            } as unknown as Database;

            const result = getOverallStats(mockDb);

            expect(result.userPrompts).toBe(100);
            expect(result.avgEffectiveness).toBe(0.85);
            expect(result.avgQuality).toBe(0.92);
            expect(result.lastSync).toBe('2023-01-01T10:00:00Z');
            expect(result.lastAnalysis).toBe('2023-01-01T11:00:00Z');
            expect(result.goldenScores.goal).toBe(80);
        });

        it('should handle null values from database gracefully', () => {
            const mockGet = vi.fn().mockReturnValue({});
            const mockPrepare = vi.fn().mockReturnValue({ get: mockGet });
            const mockDb = {
                prepare: mockPrepare,
            } as unknown as Database;

            const result = getOverallStats(mockDb);

            expect(result.avgEffectiveness).toBe(0);
            expect(result.avgQuality).toBe(0);
            expect(result.goldenScores.goal).toBe(0);
            expect(result.lastSync).toBeUndefined();
        });
    });
});
