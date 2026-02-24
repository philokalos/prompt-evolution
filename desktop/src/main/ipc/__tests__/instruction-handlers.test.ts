/**
 * Instruction IPC Handlers Unit Tests
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { InstructionHandlerDeps } from '../instruction-handlers.js';

// Mock Electron modules
const mockIpcHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mockIpcHandlers.set(channel, handler);
    }),
  },
}));

describe('Instruction Handlers', () => {
  let deps: InstructionHandlerDeps;

  const mockLintResult = {
    filePath: '/tmp/project/CLAUDE.md',
    fileFormat: 'claude-md',
    overallScore: 72,
    grade: 'B',
    goldenScores: { goal: 0.8, output: 0.7, limits: 0.6, data: 0.75, evaluation: 0.65, next: 0.7, total: 0.72 },
    issues: [{ severity: 'medium', type: 'vague', description: 'Vague instruction', location: { lineStart: 5, lineEnd: 5 } }],
    suggestions: [{ issueIndex: 0, type: 'specify', suggestedText: 'Be specific', description: 'Clarify' }],
    sections: [{ heading: 'Setup', level: 1, content: 'Install deps', lineStart: 1, lineEnd: 3, codeBlocks: [], references: [] }],
    references: [],
    fileSize: 1024,
    lineCount: 50,
    analyzedAt: '2026-01-01T00:00:00.000Z',
  };

  const mockDetectedFiles = [
    { path: '/tmp/project/CLAUDE.md', format: 'claude-md', size: 1024, lastModified: '2026-01-01' },
    { path: '/tmp/project/.cursorrules', format: 'cursorrules', size: 512, lastModified: '2026-01-02' },
  ];

  const mockHistory = [
    { id: 1, filePath: '/tmp/project/CLAUDE.md', overallScore: 72, grade: 'B', analyzedAt: '2026-01-01' },
    { id: 2, filePath: '/tmp/project/CLAUDE.md', overallScore: 80, grade: 'B', analyzedAt: '2026-01-02' },
  ];

  const mockGenerateResult = {
    draft: '# CLAUDE.md\n\n## Commands\n\nnpm run dev\n',
    detectedStack: { languages: ['typescript'], frameworks: ['react'], buildTools: ['vite'], testFrameworks: ['vitest'] },
    confidence: 0.85,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockIpcHandlers.clear();

    deps = {
      lintFile: vi.fn().mockReturnValue(mockLintResult),
      saveLintResult: vi.fn().mockReturnValue(1),
      detectFiles: vi.fn().mockReturnValue(mockDetectedFiles),
      getHistory: vi.fn().mockReturnValue(mockHistory),
      generateClaudeMd: vi.fn().mockReturnValue(mockGenerateResult),
      saveInstructionFile: vi.fn().mockReturnValue({ success: true }),
    };

    const { registerInstructionHandlers } = await import('../instruction-handlers.js');
    registerInstructionHandlers(deps);
  });

  describe('IPC registration', () => {
    it('should register all instruction handlers', () => {
      expect(mockIpcHandlers.has('lint-instruction-file')).toBe(true);
      expect(mockIpcHandlers.has('detect-instruction-files')).toBe(true);
      expect(mockIpcHandlers.has('get-instruction-history')).toBe(true);
      expect(mockIpcHandlers.has('generate-claude-md')).toBe(true);
      expect(mockIpcHandlers.has('save-instruction-file')).toBe(true);
    });

    it('should have correct number of handlers', () => {
      expect(mockIpcHandlers.size).toBe(5);
    });
  });

  describe('lint-instruction-file', () => {
    it('should lint file and save result', async () => {
      const handler = mockIpcHandlers.get('lint-instruction-file')!;
      const result = await handler(null, { filePath: '/tmp/project/CLAUDE.md' });

      expect(deps.lintFile).toHaveBeenCalledWith('/tmp/project/CLAUDE.md');
      expect(deps.saveLintResult).toHaveBeenCalledWith(mockLintResult);
      expect(result).toEqual(mockLintResult);
    });

    it('should reject empty filePath', async () => {
      const handler = mockIpcHandlers.get('lint-instruction-file')!;
      const result = await handler(null, { filePath: '' });

      expect(result).toEqual({ error: 'Invalid file path' });
      expect(deps.lintFile).not.toHaveBeenCalled();
    });

    it('should reject missing filePath', async () => {
      const handler = mockIpcHandlers.get('lint-instruction-file')!;
      const result = await handler(null, {});

      expect(result).toEqual({ error: 'Invalid file path' });
    });

    it('should reject paths outside home/tmp', async () => {
      const handler = mockIpcHandlers.get('lint-instruction-file')!;
      const result = await handler(null, { filePath: '/etc/passwd' });

      expect(result).toEqual({ error: 'Invalid file path' });
      expect(deps.lintFile).not.toHaveBeenCalled();
    });
  });

  describe('detect-instruction-files', () => {
    it('should detect files for a project path', async () => {
      const handler = mockIpcHandlers.get('detect-instruction-files')!;
      const result = await handler(null, { projectPath: '/tmp/project' });

      expect(deps.detectFiles).toHaveBeenCalledWith('/tmp/project');
      expect(result).toEqual(mockDetectedFiles);
    });

    it('should allow undefined projectPath', async () => {
      const handler = mockIpcHandlers.get('detect-instruction-files')!;
      await handler(null, {});

      expect(deps.detectFiles).toHaveBeenCalledWith(undefined);
    });

    it('should reject invalid projectPath', async () => {
      const handler = mockIpcHandlers.get('detect-instruction-files')!;
      const result = await handler(null, { projectPath: '/etc/shadow' });

      expect(result).toEqual({ error: 'Invalid project path' });
      expect(deps.detectFiles).not.toHaveBeenCalled();
    });
  });

  describe('get-instruction-history', () => {
    it('should return history with default options', async () => {
      const handler = mockIpcHandlers.get('get-instruction-history')!;
      const result = await handler(null, {});

      expect(deps.getHistory).toHaveBeenCalledWith({
        filePath: undefined,
        limit: undefined,
      });
      expect(result).toEqual(mockHistory);
    });

    it('should pass filePath and limit', async () => {
      const handler = mockIpcHandlers.get('get-instruction-history')!;
      await handler(null, { filePath: '/tmp/project/CLAUDE.md', limit: 10 });

      expect(deps.getHistory).toHaveBeenCalledWith({
        filePath: '/tmp/project/CLAUDE.md',
        limit: 10,
      });
    });

    it('should reject non-number limit', async () => {
      const handler = mockIpcHandlers.get('get-instruction-history')!;
      const result = await handler(null, { limit: 'abc' });

      expect(result).toEqual({ error: 'Invalid limit' });
      expect(deps.getHistory).not.toHaveBeenCalled();
    });
  });

  describe('generate-claude-md', () => {
    it('should generate CLAUDE.md draft for project', async () => {
      const handler = mockIpcHandlers.get('generate-claude-md')!;
      const result = await handler(null, { projectPath: '/tmp/project' });

      expect(deps.generateClaudeMd).toHaveBeenCalledWith('/tmp/project');
      expect(result).toEqual(mockGenerateResult);
    });

    it('should reject empty projectPath', async () => {
      const handler = mockIpcHandlers.get('generate-claude-md')!;
      const result = await handler(null, { projectPath: '' });

      expect(result).toEqual({ error: 'Invalid project path' });
      expect(deps.generateClaudeMd).not.toHaveBeenCalled();
    });

    it('should reject paths outside home/tmp', async () => {
      const handler = mockIpcHandlers.get('generate-claude-md')!;
      const result = await handler(null, { projectPath: '/var/log' });

      expect(result).toEqual({ error: 'Invalid project path' });
    });
  });

  describe('save-instruction-file', () => {
    it('should save file with content', async () => {
      const handler = mockIpcHandlers.get('save-instruction-file')!;
      const result = await handler(null, {
        filePath: '/tmp/project/CLAUDE.md',
        content: '# CLAUDE.md\n\nNew content',
      });

      expect(deps.saveInstructionFile).toHaveBeenCalledWith(
        '/tmp/project/CLAUDE.md',
        '# CLAUDE.md\n\nNew content',
      );
      expect(result).toEqual({ success: true });
    });

    it('should reject empty filePath', async () => {
      const handler = mockIpcHandlers.get('save-instruction-file')!;
      const result = await handler(null, { filePath: '', content: 'test' });

      expect(result).toEqual({ error: 'Invalid file path' });
    });

    it('should reject missing content', async () => {
      const handler = mockIpcHandlers.get('save-instruction-file')!;
      const result = await handler(null, { filePath: '/tmp/test.md' });

      expect(result).toEqual({ error: 'Invalid content' });
    });

    it('should reject paths outside home/tmp', async () => {
      const handler = mockIpcHandlers.get('save-instruction-file')!;
      const result = await handler(null, { filePath: '/etc/test.md', content: 'x' });

      expect(result).toEqual({ error: 'Invalid file path' });
    });
  });

  describe('error handling', () => {
    it('should propagate errors from lintFile', async () => {
      (deps.lintFile as Mock).mockImplementation(() => {
        throw new Error('File not found');
      });
      const handler = mockIpcHandlers.get('lint-instruction-file')!;

      await expect(handler(null, { filePath: '/tmp/test/CLAUDE.md' })).rejects.toThrow('File not found');
    });

    it('should propagate errors from generateClaudeMd', async () => {
      (deps.generateClaudeMd as Mock).mockImplementation(() => {
        throw new Error('Generation failed');
      });
      const handler = mockIpcHandlers.get('generate-claude-md')!;

      await expect(handler(null, { projectPath: '/tmp/project' })).rejects.toThrow('Generation failed');
    });
  });
});
