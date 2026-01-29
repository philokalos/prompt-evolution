import { describe, it, expect, vi } from 'vitest';
import { getPromptDataFromConversations } from './insights-repository.js';
import type { Database } from 'better-sqlite3';

describe('insights-repository', () => {
    describe('getPromptDataFromConversations', () => {
        it('should return empty array if no conversation IDs are provided', () => {
            const mockDb = {
                prepare: vi.fn(),
            } as unknown as Database;

            const result = getPromptDataFromConversations(mockDb, []);
            expect(result).toEqual([]);
            expect(mockDb.prepare).not.toHaveBeenCalled();
        });

        it('should query the database and return mapped prompt data', () => {
            const mockTurns = [
                { content: 'Hello', conversation_id: 'conv1', timestamp: '2023-01-01T10:00:00Z' },
                { content: 'World', conversation_id: 'conv1', timestamp: '2023-01-01T10:05:00Z' },
            ];

            const mockAll = vi.fn().mockReturnValue(mockTurns);
            const mockPrepare = vi.fn().mockReturnValue({ all: mockAll });
            const mockDb = {
                prepare: mockPrepare,
            } as unknown as Database;

            const conversationIds = ['conv1'];
            const result = getPromptDataFromConversations(mockDb, conversationIds);

            expect(mockPrepare).toHaveBeenCalled();
            expect(mockAll).toHaveBeenCalledWith('conv1');
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                content: 'Hello',
                conversationId: 'conv1',
                timestamp: new Date('2023-01-01T10:00:00Z'),
                effectiveness: undefined,
            });
            expect(result[1].content).toBe('World');
        });

        it('should handle missing timestamps correctly', () => {
            const mockTurns = [
                { content: 'No date', conversation_id: 'conv2', timestamp: null },
            ];

            const mockAll = vi.fn().mockReturnValue(mockTurns);
            const mockPrepare = vi.fn().mockReturnValue({ all: mockAll });
            const mockDb = {
                prepare: mockPrepare,
            } as unknown as Database;

            const result = getPromptDataFromConversations(mockDb, ['conv2']);
            expect(result[0].timestamp).toBeUndefined();
        });
    });
});
