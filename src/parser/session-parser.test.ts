import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseJsonlFile, parseSession } from './session-parser.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock fs module
vi.mock('fs', () => ({
    readFileSync: vi.fn(),
}));

describe('session-parser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('parseJsonlFile', () => {
        it('should parse valid JSONL content', () => {
            const mockContent = `{"type":"user","uuid":"1","timestamp":"2024-01-01T10:00:00Z","message":{"content":"Hello"}}\n{"type":"assistant","uuid":"2","timestamp":"2024-01-01T10:00:01Z","message":{"content":[{"type":"text","text":"Hi"}]}}`;

            vi.mocked(readFileSync).mockReturnValue(mockContent);

            const result = parseJsonlFile('/fake/path.jsonl');

            expect(result).toHaveLength(2);
            expect(result[0].type).toBe('user');
            expect(result[1].type).toBe('assistant');
        });

        it('should skip empty lines', () => {
            const mockContent = `{"type":"user","uuid":"1","message":{"content":"Test"}}\n\n\n{"type":"assistant","uuid":"2","message":{"content":[]}}`;

            vi.mocked(readFileSync).mockReturnValue(mockContent);

            const result = parseJsonlFile('/fake/path.jsonl');

            expect(result).toHaveLength(2);
        });

        it('should skip malformed JSON lines', () => {
            const mockContent = `{"type":"user","uuid":"1","message":{"content":"Valid"}}\n{invalid json}\n{"type":"assistant","uuid":"2","message":{"content":[]}}`;

            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            vi.mocked(readFileSync).mockReturnValue(mockContent);

            const result = parseJsonlFile('/fake/path.jsonl');

            expect(result).toHaveLength(2);
            expect(consoleWarnSpy).toHaveBeenCalled();

            consoleWarnSpy.mockRestore();
        });

        it('should return empty array on file read error', () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            vi.mocked(readFileSync).mockImplementation(() => {
                throw new Error('File not found');
            });

            const result = parseJsonlFile('/nonexistent/path.jsonl');

            expect(result).toEqual([]);
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });
    });

    describe('parseSession', () => {
        it('should parse a complete session with user and assistant turns', () => {
            const mockContent = `{"type":"user","uuid":"u1","timestamp":"2024-01-01T10:00:00Z","message":{"content":"Create a function"},"parentUuid":null}\n{"type":"assistant","uuid":"a1","timestamp":"2024-01-01T10:00:05Z","message":{"content":[{"type":"text","text":"Here is the function"}],"model":"claude-3","usage":{"input_tokens":10,"output_tokens":20}},"parentUuid":"u1"}`;

            vi.mocked(readFileSync).mockReturnValue(mockContent);

            const result = parseSession('test-project', 'session-123.jsonl');

            expect(result).not.toBeNull();
            expect(result?.id).toBe('session-123');
            expect(result?.project).toBe('test-project');
            expect(result?.turns).toHaveLength(2);
            expect(result?.turns[0].role).toBe('user');
            expect(result?.turns[0].content).toBe('Create a function');
            expect(result?.turns[1].role).toBe('assistant');
            expect(result?.turns[1].content).toBe('Here is the function');
            expect(result?.model).toBe('claude-3');
            expect(result?.totalInputTokens).toBe(10);
            expect(result?.totalOutputTokens).toBe(20);
        });

        it('should handle array content in user messages', () => {
            const mockContent = `{"type":"user","uuid":"u1","timestamp":"2024-01-01T10:00:00Z","message":{"content":[{"type":"text","text":"First part"},{"type":"text","text":"Second part"}]}}`;

            vi.mocked(readFileSync).mockReturnValue(mockContent);

            const result = parseSession('test-project', 'session-456.jsonl');

            expect(result?.turns).toHaveLength(1);
            expect(result?.turns[0].content).toBe('First part\nSecond part');
        });

        it('should extract thinking and tools from assistant messages', () => {
            const mockContent = `{"type":"assistant","uuid":"a1","timestamp":"2024-01-01T10:00:00Z","message":{"content":[{"type":"thinking","thinking":"Let me think..."},{"type":"text","text":"Response"},{"type":"tool_use","name":"read_file","id":"t1","input":{}}],"model":"claude-3"}}`;

            vi.mocked(readFileSync).mockReturnValue(mockContent);

            const result = parseSession('test-project', 'session-789.jsonl');

            expect(result?.turns).toHaveLength(1);
            expect(result?.turns[0].thinking).toBe('Let me think...');
            expect(result?.turns[0].toolsUsed).toEqual(['read_file']);
        });

        it('should skip empty user content', () => {
            const mockContent = `{"type":"user","uuid":"u1","timestamp":"2024-01-01T10:00:00Z","message":{"content":""}}\n{"type":"user","uuid":"u2","timestamp":"2024-01-01T10:00:01Z","message":{"content":"Valid content"}}`;

            vi.mocked(readFileSync).mockReturnValue(mockContent);

            const result = parseSession('test-project', 'session-empty.jsonl');

            expect(result?.turns).toHaveLength(1);
            expect(result?.turns[0].content).toBe('Valid content');
        });

        it('should collect summaries', () => {
            const mockContent = `{"type":"summary","summary":"This is a summary","timestamp":"2024-01-01T10:00:00Z"}\n{"type":"user","uuid":"u1","timestamp":"2024-01-01T10:00:01Z","message":{"content":"Test"}}`;

            vi.mocked(readFileSync).mockReturnValue(mockContent);

            const result = parseSession('test-project', 'session-summary.jsonl');

            expect(result?.summaries).toHaveLength(1);
            expect(result?.summaries[0]).toBe('This is a summary');
        });

        it('should return null for empty file', () => {
            vi.mocked(readFileSync).mockReturnValue('');

            const result = parseSession('test-project', 'empty.jsonl');

            expect(result).toBeNull();
        });

        it('should track start and end times', () => {
            const mockContent = `{"type":"user","uuid":"u1","timestamp":"2024-01-01T10:00:00Z","message":{"content":"First"}}\n{"type":"user","uuid":"u2","timestamp":"2024-01-01T10:05:00Z","message":{"content":"Last"}}`;

            vi.mocked(readFileSync).mockReturnValue(mockContent);

            const result = parseSession('test-project', 'session-time.jsonl');

            expect(result?.startedAt).toEqual(new Date('2024-01-01T10:00:00Z'));
            expect(result?.endedAt).toEqual(new Date('2024-01-01T10:05:00Z'));
        });

        it('should decode project path', () => {
            const mockContent = `{"type":"user","uuid":"u1","timestamp":"2024-01-01T10:00:00Z","message":{"content":"Test"}}`;

            vi.mocked(readFileSync).mockReturnValue(mockContent);

            const result = parseSession('home-user-projects', 'session.jsonl');

            expect(result?.projectPath).toBe('home/user/projects');
        });
    });
});
