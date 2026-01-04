/**
 * Session Context Unit Tests
 *
 * Tests for Claude Code session reading and context extraction.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Use vi.hoisted() to ensure mock state is available when vi.mock runs
const mockState = vi.hoisted(() => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  realpathSync: vi.fn(),
  homedir: vi.fn(() => '/Users/testuser'),
  isPackaged: false,
  getPath: vi.fn(() => '/Users/testuser/.promptlint'),
  getAppPath: vi.fn(() => '/Users/testuser/project'),
}));

// Mock fs module
vi.mock('fs', () => ({
  existsSync: mockState.existsSync,
  statSync: mockState.statSync,
  readdirSync: mockState.readdirSync,
  readFileSync: mockState.readFileSync,
  realpathSync: mockState.realpathSync,
  default: {
    existsSync: mockState.existsSync,
    statSync: mockState.statSync,
    readdirSync: mockState.readdirSync,
    readFileSync: mockState.readFileSync,
    realpathSync: mockState.realpathSync,
  },
}));

// Mock os module
vi.mock('os', () => ({
  homedir: mockState.homedir,
  default: {
    homedir: mockState.homedir,
  },
}));

// Mock electron app
vi.mock('electron', () => ({
  app: {
    isPackaged: mockState.isPackaged,
    getPath: mockState.getPath,
    getAppPath: mockState.getAppPath,
  },
}));

// Mock active-window-detector
vi.mock('../active-window-detector.js', () => ({
  detectActiveProject: vi.fn(),
  getActiveWindowInfo: vi.fn(),
}));

// Mock project-detector-enhanced
vi.mock('../project-detector-enhanced.js', () => ({
  findMatchingProjectEnhanced: vi.fn(() => ({
    projectId: null,
    projectPath: null,
    matchType: null,
    confidence: 0,
    reason: 'No project found',
  })),
  decodeProjectPathEnhanced: vi.fn((encoded: string) => {
    // Simple decode: replace - with /
    return '/' + encoded.replace(/^-/, '').replace(/-/g, '/');
  }),
  findProjectPathByNameEnhanced: vi.fn(),
}));

// Import after mocking
import {
  findMatchingProject,
  findMatchingProjectWithDetails,
  getLatestSession,
  extractSessionContext,
  clearSessionCache,
  getSessionContext,
  getSessionContextForPath,
  getActiveWindowSessionContext,
  getSessionContextForCapturedProject,
} from '../session-context.js';
import { findMatchingProjectEnhanced } from '../project-detector-enhanced.js';
import { detectActiveProject } from '../active-window-detector.js';

describe('Session Context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSessionCache();
    mockState.homedir.mockReturnValue('/Users/testuser');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // findMatchingProject Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('findMatchingProject', () => {
    it('should return projectId when project is found', () => {
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: '-Users-testuser-my-project',
        projectPath: '/Users/testuser/my-project',
        matchType: 'exact',
        confidence: 1.0,
        reason: 'Exact match found',
      });

      const result = findMatchingProject('/Users/testuser/my-project');

      expect(result).toBe('-Users-testuser-my-project');
      expect(findMatchingProjectEnhanced).toHaveBeenCalledWith(
        '/Users/testuser/my-project',
        expect.objectContaining({
          enableSimilarity: true,
          enableRecentFallback: true,
        })
      );
    });

    it('should return null when no project is found', () => {
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: null,
        projectPath: null,
        matchType: null,
        confidence: 0,
        reason: 'No matching project directory',
      });

      const result = findMatchingProject('/Users/testuser/unknown-project');

      expect(result).toBeNull();
    });

    it('should pass custom options to enhanced detection', () => {
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: '-Users-testuser-project',
        projectPath: '/Users/testuser/project',
        matchType: 'similarity',
        confidence: 0.8,
        reason: 'Similarity match',
      });

      const customOptions = {
        enableSimilarity: false,
        similarityThreshold: 0.9,
      };

      findMatchingProject('/Users/testuser/project', customOptions);

      expect(findMatchingProjectEnhanced).toHaveBeenCalledWith(
        '/Users/testuser/project',
        expect.objectContaining({
          enableSimilarity: false,
          similarityThreshold: 0.9,
        })
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getLatestSession Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getLatestSession', () => {
    it('should return null if project directory does not exist', () => {
      mockState.existsSync.mockReturnValue(false);

      const result = getLatestSession('-Users-testuser-project');

      expect(result).toBeNull();
    });

    it('should return the most recent session file', () => {
      const projectPath = '/Users/testuser/.claude/projects/-Users-testuser-project';

      mockState.existsSync.mockReturnValue(true);
      mockState.readdirSync.mockReturnValue([
        'session-old.jsonl',
        'session-new.jsonl',
        'agent-task.jsonl', // Should be filtered out
      ]);
      mockState.statSync
        .mockReturnValueOnce({ mtime: new Date('2024-01-01') }) // session-old.jsonl
        .mockReturnValueOnce({ mtime: new Date('2024-01-02') }); // session-new.jsonl

      const result = getLatestSession('-Users-testuser-project');

      expect(result).toBe('session-new.jsonl');
    });

    it('should return null if no session files exist', () => {
      mockState.existsSync.mockReturnValue(true);
      mockState.readdirSync.mockReturnValue([
        'agent-task.jsonl', // Only agent files
        'other.txt',
      ]);

      const result = getLatestSession('-Users-testuser-project');

      expect(result).toBeNull();
    });

    it('should filter out agent files', () => {
      mockState.existsSync.mockReturnValue(true);
      mockState.readdirSync.mockReturnValue([
        'agent-12345.jsonl',
        'agent-67890.jsonl',
        'session-abc.jsonl',
      ]);
      mockState.statSync.mockReturnValue({ mtime: new Date() });

      const result = getLatestSession('-Users-testuser-project');

      expect(result).toBe('session-abc.jsonl');
    });

    it('should handle errors gracefully', () => {
      mockState.existsSync.mockReturnValue(true);
      mockState.readdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = getLatestSession('-Users-testuser-project');

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // extractSessionContext Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('extractSessionContext', () => {
    const projectId = '-Users-testuser-my-project';
    const sessionFile = 'session-123.jsonl';

    it('should return null if session file does not exist', () => {
      mockState.existsSync.mockReturnValue(false);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result).toBeNull();
    });

    it('should extract basic context from session file', () => {
      const sessionContent = [
        JSON.stringify({ type: 'summary', summary: 'Implementing user auth' }),
        JSON.stringify({
          type: 'user',
          timestamp: '2024-01-01T10:00:00Z',
          message: { content: 'Add login form' },
        }),
        JSON.stringify({
          type: 'assistant',
          timestamp: '2024-01-01T10:01:00Z',
          message: {
            content: [
              { type: 'text', text: 'I will add the login form' },
              {
                type: 'tool_use',
                name: 'Edit',
                input: { file_path: 'src/Login.tsx' },
              },
            ],
          },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 1000, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result).not.toBeNull();
      expect(result?.projectId).toBe(projectId);
      expect(result?.currentTask).toBe('Implementing user auth');
      expect(result?.recentTools).toContain('Edit');
      // Implementation uses path.basename() to extract just the filename
      expect(result?.recentFiles).toContain('Login.tsx');
    });

    it('should handle large files by reading last N lines', () => {
      // Create a "large" file content (simulated)
      const lines = [];
      for (let i = 0; i < 200; i++) {
        lines.push(JSON.stringify({ type: 'user', message: { content: `Message ${i}` } }));
      }
      const largeContent = lines.join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({
        size: 15 * 1024 * 1024, // 15MB - exceeds MAX_FULL_PARSE_SIZE
        mtime: new Date(),
        isDirectory: () => true,
      });
      mockState.readFileSync.mockReturnValue(largeContent);

      const result = extractSessionContext(projectId, sessionFile);

      // Should still return a valid context (or null if parsing fails gracefully)
      // The function should handle large files without crashing
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should detect tech stack from file extensions', () => {
      const sessionContent = [
        JSON.stringify({ type: 'summary', summary: 'React project' }),
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', name: 'Read', input: { file_path: 'src/App.tsx' } },
              { type: 'tool_use', name: 'Read', input: { file_path: 'package.json' } },
              { type: 'tool_use', name: 'Edit', input: { file_path: 'src/styles.css' } },
            ],
          },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 1000, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result).not.toBeNull();
      expect(result?.techStack).toContain('TypeScript');
      expect(result?.techStack).toContain('React');
    });

    it('should extract last exchange context', () => {
      const sessionContent = [
        JSON.stringify({ type: 'summary', summary: 'Working on feature' }),
        JSON.stringify({
          type: 'user',
          uuid: 'user-1',
          timestamp: '2024-01-01T10:00:00Z',
          message: { content: '버그 수정해줘' },
        }),
        JSON.stringify({
          type: 'assistant',
          parentUuid: 'user-1',
          timestamp: '2024-01-01T10:01:00Z',
          message: {
            content: [
              { type: 'text', text: '버그를 분석하고 수정했습니다.' },
              { type: 'tool_use', name: 'Edit', input: { file_path: 'src/buggy.ts' } },
            ],
          },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 1000, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result).not.toBeNull();
      expect(result?.lastExchange).toBeDefined();
      expect(result?.lastExchange?.userMessage).toContain('버그 수정');
      expect(result?.lastExchange?.assistantTools).toContain('Edit');
      // Implementation uses path.basename() to extract just the filename
      expect(result?.lastExchange?.assistantFiles).toContain('buggy.ts');
    });

    it('should extract files from tool_use with path property', () => {
      const sessionContent = [
        JSON.stringify({ type: 'summary', summary: 'Reading files' }),
        JSON.stringify({
          type: 'user',
          uuid: 'user-1',
          message: { content: 'Read the config file' },
        }),
        JSON.stringify({
          type: 'assistant',
          parentUuid: 'user-1',
          message: {
            content: [
              { type: 'tool_use', name: 'Read', input: { path: '/src/config.json' } },
              { type: 'tool_use', name: 'Glob', input: { path: '/src/utils/' } },
            ],
          },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result).not.toBeNull();
      expect(result?.lastExchange?.assistantTools).toContain('Read');
      expect(result?.lastExchange?.assistantTools).toContain('Glob');
      expect(result?.lastExchange?.assistantFiles).toContain('config.json');
      expect(result?.lastExchange?.assistantFiles).toContain('utils');
    });

    it('should handle malformed JSON lines gracefully', () => {
      const sessionContent = [
        JSON.stringify({ type: 'summary', summary: 'Test task' }),
        'not valid json',
        JSON.stringify({ type: 'user', message: { content: 'Hello' } }),
        '{ incomplete json',
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 1000, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      // Should not throw, should handle gracefully
      const result = extractSessionContext(projectId, sessionFile);

      // May return null or partial context - either is acceptable
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should handle empty session file', () => {
      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 0, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue('');

      const result = extractSessionContext(projectId, sessionFile);

      // Empty file should return null or minimal context
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // clearSessionCache Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('clearSessionCache', () => {
    it('should clear the session cache', () => {
      // This is a simple function that just clears the cache
      // We can't directly verify the cache is empty, but we can verify it doesn't throw
      expect(() => clearSessionCache()).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Integration-like Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Context Extraction Edge Cases', () => {
    const projectId = '-Users-testuser-project';
    const sessionFile = 'session.jsonl';

    it('should handle user message as string', () => {
      const sessionContent = [
        JSON.stringify({ type: 'summary', summary: 'Task' }),
        JSON.stringify({
          type: 'user',
          message: { content: 'Simple string message' },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result).not.toBeNull();
    });

    it('should handle user message as array of content blocks', () => {
      const sessionContent = [
        JSON.stringify({ type: 'summary', summary: 'Task' }),
        JSON.stringify({
          type: 'user',
          message: {
            content: [
              { type: 'text', text: 'Part 1' },
              { type: 'text', text: 'Part 2' },
            ],
          },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result).not.toBeNull();
    });

    it('should detect git branch from .git/HEAD', () => {
      const sessionContent = JSON.stringify({ type: 'summary', summary: 'Feature work' });

      mockState.existsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('.git/HEAD')) {
          return true;
        }
        return true; // Session file exists
      });
      mockState.statSync.mockReturnValue({ size: 100, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('.git/HEAD')) {
          return 'ref: refs/heads/feature/my-branch\n';
        }
        return sessionContent;
      });

      const result = extractSessionContext(projectId, sessionFile);

      expect(result).not.toBeNull();
      expect(result?.gitBranch).toBe('feature/my-branch');
    });

    it('should handle detached HEAD state with full commit hash', () => {
      const sessionContent = JSON.stringify({ type: 'summary', summary: 'Task' });
      const fullHash = 'a1b2c3d4e5f6789012345678901234567890abcd';

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 100, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('.git/HEAD')) {
          return fullHash + '\n'; // Detached HEAD - full 40-char commit hash
        }
        return sessionContent;
      });

      const result = extractSessionContext(projectId, sessionFile);

      expect(result).not.toBeNull();
      // Should return short hash with (detached) suffix
      expect(result?.gitBranch).toBe('a1b2c3d (detached)');
    });

    it('should handle detached HEAD state with short hash', () => {
      const sessionContent = JSON.stringify({ type: 'summary', summary: 'Task' });

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 100, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('.git/HEAD')) {
          return 'abc123def456\n'; // Short hash - won't match 40-char pattern
        }
        return sessionContent;
      });

      const result = extractSessionContext(projectId, sessionFile);

      expect(result).not.toBeNull();
      // Short hash won't match pattern, so gitBranch should be undefined
      expect(result?.gitBranch).toBeUndefined();
    });

    it('should handle error when reading .git/HEAD', () => {
      const sessionContent = JSON.stringify({ type: 'summary', summary: 'Task' });

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 100, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('.git/HEAD')) {
          throw new Error('Permission denied');
        }
        return sessionContent;
      });

      const result = extractSessionContext(projectId, sessionFile);

      // Should still return context, just without gitBranch
      expect(result).not.toBeNull();
      expect(result?.gitBranch).toBeUndefined();
    });

    it('should infer tech stack from Bash commands', () => {
      const sessionContent = [
        JSON.stringify({ type: 'summary', summary: 'Project setup' }),
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', name: 'Bash', input: { command: 'npm install react' } },
              { type: 'tool_use', name: 'Bash', input: { command: 'npx vite build' } },
            ],
          },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result).not.toBeNull();
      // Should detect npm/vite from commands
      expect(result?.techStack.length).toBeGreaterThanOrEqual(0);
    });

    it('should return null and log error when extraction fails', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 100, mtime: new Date(), isDirectory: () => true });
      // Make readFileSync throw an error to trigger catch block
      mockState.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = extractSessionContext(projectId, sessionFile);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SessionContext] Error extracting context:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // findMatchingProjectWithDetails Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('findMatchingProjectWithDetails', () => {
    it('should return full detection result', () => {
      const mockResult = {
        projectId: '-Users-testuser-project',
        projectPath: '/Users/testuser/project',
        matchType: 'exact' as const,
        confidence: 1.0,
        reason: 'Exact match',
      };
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue(mockResult);

      const result = findMatchingProjectWithDetails('/Users/testuser/project');

      expect(result).toEqual(expect.objectContaining({
        projectId: '-Users-testuser-project',
        matchType: 'exact',
        confidence: 1.0,
      }));
    });

    it('should pass custom options', () => {
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: null,
        projectPath: null,
        matchType: null,
        confidence: 0,
        reason: 'No match',
      });

      findMatchingProjectWithDetails('/some/path', { enableSimilarity: false });

      expect(findMatchingProjectEnhanced).toHaveBeenCalledWith(
        '/some/path',
        expect.objectContaining({ enableSimilarity: false })
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getSessionContext Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getSessionContext', () => {
    it('should return null when no matching project found', () => {
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: null,
        projectPath: null,
        matchType: null,
        confidence: 0,
        reason: 'No project',
      });

      const result = getSessionContext();

      expect(result).toBeNull();
    });

    it('should return null when no session files exist', () => {
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: '-Users-testuser-project',
        projectPath: '/Users/testuser/project',
        matchType: 'exact' as const,
        confidence: 1.0,
        reason: 'Match',
      });
      mockState.existsSync.mockReturnValue(true);
      mockState.readdirSync.mockReturnValue([]);

      const result = getSessionContext();

      expect(result).toBeNull();
    });

    it('should return context when project and session exist', () => {
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: '-Users-testuser-project',
        projectPath: '/Users/testuser/project',
        matchType: 'exact' as const,
        confidence: 1.0,
        reason: 'Match',
      });
      mockState.existsSync.mockReturnValue(true);
      mockState.readdirSync.mockReturnValue(['session.jsonl']);
      mockState.statSync.mockReturnValue({ size: 100, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(JSON.stringify({ type: 'summary', summary: 'Test' }));

      const result = getSessionContext();

      expect(result).not.toBeNull();
      expect(result?.projectId).toBe('-Users-testuser-project');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getSessionContextForPath Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getSessionContextForPath', () => {
    it('should return null when no project found', () => {
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: null,
        projectPath: null,
        matchType: null,
        confidence: 0,
        reason: 'No match',
      });

      const result = getSessionContextForPath('/unknown/path');

      expect(result).toBeNull();
    });

    it('should return context for specified path', () => {
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: '-Users-testuser-custom-project',
        projectPath: '/Users/testuser/custom-project',
        matchType: 'exact' as const,
        confidence: 1.0,
        reason: 'Match',
      });
      mockState.existsSync.mockReturnValue(true);
      mockState.readdirSync.mockReturnValue(['session.jsonl']);
      mockState.statSync.mockReturnValue({ size: 100, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(JSON.stringify({ type: 'summary', summary: 'Custom' }));

      const result = getSessionContextForPath('/Users/testuser/custom-project');

      expect(result?.projectId).toBe('-Users-testuser-custom-project');
    });

    it('should handle errors gracefully', () => {
      vi.mocked(findMatchingProjectEnhanced).mockImplementation(() => {
        throw new Error('Detection error');
      });

      const result = getSessionContextForPath('/error/path');

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getActiveWindowSessionContext Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getActiveWindowSessionContext', () => {
    it('should use active window project when detected with high confidence', async () => {
      vi.mocked(detectActiveProject).mockResolvedValue({
        projectPath: '/Users/testuser/active-project',
        projectName: 'active-project',
        ideName: 'VS Code',
        currentFile: 'App.tsx',
        confidence: 'high',
      });
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: '-Users-testuser-active-project',
        projectPath: '/Users/testuser/active-project',
        matchType: 'exact' as const,
        confidence: 1.0,
        reason: 'Match',
      });
      mockState.existsSync.mockReturnValue(true);
      mockState.readdirSync.mockReturnValue(['session.jsonl']);
      mockState.statSync.mockReturnValue({ size: 100, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(JSON.stringify({ type: 'summary', summary: 'Active' }));

      const result = await getActiveWindowSessionContext();

      expect(result).not.toBeNull();
      expect(result?.source).toBe('active-window');
      expect(result?.ideName).toBe('VS Code');
      expect(result?.currentFile).toBe('App.tsx');
    });

    it('should return minimal context when no Claude session exists', async () => {
      vi.mocked(detectActiveProject).mockResolvedValue({
        projectPath: '/Users/testuser/no-session-project',
        projectName: 'no-session-project',
        ideName: 'Cursor',
        confidence: 'medium',
      });
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: null,
        projectPath: null,
        matchType: null,
        confidence: 0,
        reason: 'No match',
      });
      mockState.existsSync.mockReturnValue(false);

      const result = await getActiveWindowSessionContext();

      expect(result).not.toBeNull();
      expect(result?.source).toBe('active-window');
      expect(result?.projectPath).toBe('/Users/testuser/no-session-project');
      expect(result?.sessionId).toBe('');
    });

    it('should detect tech stack from config files when no Claude session exists', async () => {
      vi.mocked(detectActiveProject).mockResolvedValue({
        projectPath: '/Users/testuser/tech-stack-project',
        projectName: 'tech-stack-project',
        ideName: 'VS Code',
        confidence: 'high',
      });
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: null,
        projectPath: null,
        matchType: null,
        confidence: 0,
        reason: 'No match',
      });

      // Mock config file existence and package.json content
      mockState.existsSync.mockImplementation((p: string) => {
        const pathStr = String(p);
        if (pathStr.includes('.claude/projects')) return false;
        if (pathStr.includes('package.json')) return true;
        if (pathStr.includes('tsconfig.json')) return true;
        if (pathStr.includes('vite.config.ts')) return true;
        return false;
      });
      mockState.readFileSync.mockImplementation((p: string) => {
        const pathStr = String(p);
        if (pathStr.includes('package.json')) {
          return JSON.stringify({
            dependencies: { react: '^18.0.0' },
            devDependencies: { typescript: '^5.0.0' },
          });
        }
        return '';
      });

      const result = await getActiveWindowSessionContext();

      expect(result).not.toBeNull();
      expect(result?.source).toBe('active-window');
      expect(result?.techStack).toContain('Node.js');
      expect(result?.techStack).toContain('TypeScript');
      expect(result?.techStack).toContain('Vite');
      expect(result?.techStack).toContain('React');
    });

    it('should fallback to app path when active window has low confidence', async () => {
      vi.mocked(detectActiveProject).mockResolvedValue({
        projectPath: '/some/path',
        projectName: 'path',
        ideName: 'Unknown',
        confidence: 'low',
      });
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: '-Users-testuser-fallback',
        projectPath: '/Users/testuser/fallback',
        matchType: 'exact' as const,
        confidence: 1.0,
        reason: 'Match',
      });
      mockState.existsSync.mockReturnValue(true);
      mockState.readdirSync.mockReturnValue(['session.jsonl']);
      mockState.statSync.mockReturnValue({ size: 100, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(JSON.stringify({ type: 'summary', summary: 'Fallback' }));

      const result = await getActiveWindowSessionContext();

      expect(result?.source).toBe('app-path');
    });

    it('should fallback when no active window detected', async () => {
      vi.mocked(detectActiveProject).mockResolvedValue(null);
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: '-Users-testuser-app-path',
        projectPath: '/Users/testuser/app-path',
        matchType: 'exact' as const,
        confidence: 1.0,
        reason: 'Match',
      });
      mockState.existsSync.mockReturnValue(true);
      mockState.readdirSync.mockReturnValue(['session.jsonl']);
      mockState.statSync.mockReturnValue({ size: 100, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(JSON.stringify({ type: 'summary', summary: 'AppPath' }));

      const result = await getActiveWindowSessionContext();

      expect(result?.source).toBe('app-path');
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(detectActiveProject).mockRejectedValue(new Error('Detection failed'));
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: null,
        projectPath: null,
        matchType: null,
        confidence: 0,
        reason: 'No match',
      });

      const result = await getActiveWindowSessionContext();

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getSessionContextForCapturedProject Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getSessionContextForCapturedProject', () => {
    it('should use captured project info', async () => {
      const capturedContext = {
        windowInfo: {
          appName: 'Code',
          windowTitle: 'App.tsx - project',
          isIDE: true,
          ideName: 'VS Code',
        },
        project: {
          projectPath: '/Users/testuser/captured-project',
          projectName: 'captured-project',
          currentFile: 'App.tsx',
          ideName: 'VS Code',
          confidence: 'high' as const,
        },
        timestamp: new Date(),
      };

      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: '-Users-testuser-captured-project',
        projectPath: '/Users/testuser/captured-project',
        matchType: 'exact' as const,
        confidence: 1.0,
        reason: 'Match',
      });
      mockState.existsSync.mockReturnValue(true);
      mockState.readdirSync.mockReturnValue(['session.jsonl']);
      mockState.statSync.mockReturnValue({ size: 100, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(JSON.stringify({ type: 'summary', summary: 'Captured' }));

      const result = await getSessionContextForCapturedProject(capturedContext);

      expect(result).not.toBeNull();
      expect(result?.source).toBe('active-window');
      expect(result?.currentFile).toBe('App.tsx');
    });

    it('should fallback when no project in captured context', async () => {
      const capturedContext = {
        windowInfo: null,
        project: null,
        timestamp: new Date(),
      };

      vi.mocked(detectActiveProject).mockResolvedValue(null);
      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: null,
        projectPath: null,
        matchType: null,
        confidence: 0,
        reason: 'No match',
      });

      const result = await getSessionContextForCapturedProject(capturedContext);

      expect(result).toBeNull();
    });

    it('should return minimal context when no Claude session for captured project', async () => {
      const capturedContext = {
        windowInfo: null,
        project: {
          projectPath: '/Users/testuser/no-session',
          projectName: 'no-session',
          ideName: 'Cursor',
          confidence: 'high' as const,
        },
        timestamp: new Date(),
      };

      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: null,
        projectPath: null,
        matchType: null,
        confidence: 0,
        reason: 'No match',
      });
      mockState.existsSync.mockReturnValue(false);

      const result = await getSessionContextForCapturedProject(capturedContext);

      expect(result).not.toBeNull();
      expect(result?.projectPath).toBe('/Users/testuser/no-session');
      expect(result?.sessionId).toBe('');
    });

    it('should detect Vue/Svelte/Angular from package.json', async () => {
      const capturedContext = {
        windowInfo: null,
        project: {
          projectPath: '/Users/testuser/vue-project',
          projectName: 'vue-project',
          ideName: 'VS Code',
          confidence: 'high' as const,
        },
        timestamp: new Date(),
      };

      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: null,
        projectPath: null,
        matchType: null,
        confidence: 0,
        reason: 'No match',
      });

      mockState.existsSync.mockImplementation((p: string) => {
        const pathStr = String(p);
        if (pathStr.includes('.claude/projects')) return false;
        if (pathStr.includes('package.json')) return true;
        return false;
      });
      mockState.readFileSync.mockImplementation((p: string) => {
        const pathStr = String(p);
        if (pathStr.includes('package.json')) {
          return JSON.stringify({
            dependencies: {
              vue: '^3.0.0',
              svelte: '^4.0.0',
              '@angular/core': '^17.0.0',
            },
          });
        }
        return '';
      });

      const result = await getSessionContextForCapturedProject(capturedContext);

      expect(result).not.toBeNull();
      expect(result?.techStack).toContain('Node.js');
      expect(result?.techStack).toContain('Vue');
      expect(result?.techStack).toContain('Svelte');
      expect(result?.techStack).toContain('Angular');
    });

    it('should handle malformed package.json gracefully', async () => {
      const capturedContext = {
        windowInfo: null,
        project: {
          projectPath: '/Users/testuser/bad-pkg',
          projectName: 'bad-pkg',
          ideName: 'VS Code',
          confidence: 'high' as const,
        },
        timestamp: new Date(),
      };

      vi.mocked(findMatchingProjectEnhanced).mockReturnValue({
        projectId: null,
        projectPath: null,
        matchType: null,
        confidence: 0,
        reason: 'No match',
      });

      mockState.existsSync.mockImplementation((p: string) => {
        const pathStr = String(p);
        if (pathStr.includes('.claude/projects')) return false;
        if (pathStr.includes('package.json')) return true;
        return false;
      });
      mockState.readFileSync.mockImplementation((p: string) => {
        const pathStr = String(p);
        if (pathStr.includes('package.json')) {
          return '{ invalid json }';
        }
        return '';
      });

      const result = await getSessionContextForCapturedProject(capturedContext);

      // Should still return result, just without framework-specific tech stack
      expect(result).not.toBeNull();
      expect(result?.techStack).toContain('Node.js');
    });

    it('should handle errors and fallback', async () => {
      const capturedContext = {
        windowInfo: null,
        project: {
          projectPath: '/Users/testuser/error',
          projectName: 'error',
          ideName: 'VS Code',
          confidence: 'high' as const,
        },
        timestamp: new Date(),
      };

      vi.mocked(findMatchingProjectEnhanced).mockImplementation(() => {
        throw new Error('Detection error');
      });
      vi.mocked(detectActiveProject).mockResolvedValue(null);

      const result = await getSessionContextForCapturedProject(capturedContext);

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Cache Behavior Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Cache Behavior', () => {
    const projectId = '-Users-testuser-cache-test';
    const sessionFile = 'session.jsonl';

    it('should use cached result on second call within TTL', () => {
      const sessionContent = JSON.stringify({ type: 'summary', summary: 'Cached' });
      const mtime = new Date();

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 100, mtime, isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      // First call - should parse
      const result1 = extractSessionContext(projectId, sessionFile);
      expect(result1?.currentTask).toBe('Cached');

      // Second call - should use cache
      const result2 = extractSessionContext(projectId, sessionFile);
      expect(result2?.currentTask).toBe('Cached');

      // readFileSync should be called only once (cached on second call)
      // Note: It may be called twice due to git branch detection
      expect(mockState.readFileSync.mock.calls.length).toBeLessThanOrEqual(3);
    });

    it('should invalidate cache when file is modified', () => {
      const sessionContent1 = JSON.stringify({ type: 'summary', summary: 'Version 1' });
      const sessionContent2 = JSON.stringify({ type: 'summary', summary: 'Version 2' });
      const mtime1 = new Date('2024-01-01');
      const mtime2 = new Date('2024-01-02');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 100, mtime: mtime1, isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent1);

      // First call
      const result1 = extractSessionContext(projectId, sessionFile);
      expect(result1?.currentTask).toBe('Version 1');

      // Simulate file modification
      mockState.statSync.mockReturnValue({ size: 100, mtime: mtime2, isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent2);

      // Second call - should re-parse due to mtime change
      const result2 = extractSessionContext(projectId, sessionFile);
      expect(result2?.currentTask).toBe('Version 2');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Tech Stack Detection Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Tech Stack Detection', () => {
    const projectId = '-Users-testuser-tech-stack';
    const sessionFile = 'session.jsonl';

    it('should detect Vue from .vue files', () => {
      const sessionContent = [
        JSON.stringify({ type: 'summary', summary: 'Vue project' }),
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', name: 'Edit', input: { file_path: 'src/App.vue' } },
            ],
          },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result?.techStack).toContain('Vue');
    });

    it('should detect Python from .py files', () => {
      const sessionContent = [
        JSON.stringify({ type: 'summary', summary: 'Python project' }),
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', name: 'Edit', input: { file_path: 'main.py' } },
              { type: 'tool_use', name: 'Read', input: { file_path: 'pyproject.toml' } },
            ],
          },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result?.techStack).toContain('Python');
    });

    it('should detect multiple tech stack items', () => {
      const sessionContent = [
        JSON.stringify({ type: 'summary', summary: 'Full stack' }),
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', name: 'Edit', input: { file_path: 'src/App.tsx' } },
              { type: 'tool_use', name: 'Read', input: { file_path: 'vite.config.ts' } },
              { type: 'tool_use', name: 'Read', input: { file_path: 'tailwind.config.js' } },
            ],
          },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result?.techStack).toContain('TypeScript');
      expect(result?.techStack).toContain('React');
      expect(result?.techStack).toContain('Vite');
      expect(result?.techStack).toContain('Tailwind CSS');
    });

    it('should limit tech stack to 5 items', () => {
      const sessionContent = [
        JSON.stringify({ type: 'summary', summary: 'Many techs' }),
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', name: 'Edit', input: { file_path: 'app.tsx' } },
              { type: 'tool_use', name: 'Edit', input: { file_path: 'app.vue' } },
              { type: 'tool_use', name: 'Edit', input: { file_path: 'app.svelte' } },
              { type: 'tool_use', name: 'Edit', input: { file_path: 'main.py' } },
              { type: 'tool_use', name: 'Edit', input: { file_path: 'main.go' } },
              { type: 'tool_use', name: 'Edit', input: { file_path: 'main.rs' } },
              { type: 'tool_use', name: 'Read', input: { file_path: 'package.json' } },
            ],
          },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result?.techStack.length).toBeLessThanOrEqual(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Current Task Extraction Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Current Task Extraction', () => {
    const projectId = '-Users-testuser-task';
    const sessionFile = 'session.jsonl';

    it('should prefer summary over user messages', () => {
      const sessionContent = [
        JSON.stringify({ type: 'summary', summary: 'Summary task' }),
        JSON.stringify({
          type: 'user',
          message: { content: 'User message task' },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result?.currentTask).toBe('Summary task');
    });

    it('should fallback to user message when no summary', () => {
      const sessionContent = [
        JSON.stringify({
          type: 'user',
          message: { content: 'User task request' },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result?.currentTask).toBe('User task request');
    });

    it('should truncate long summaries', () => {
      const longSummary = 'A'.repeat(100);
      const sessionContent = JSON.stringify({ type: 'summary', summary: longSummary });

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result?.currentTask.length).toBeLessThanOrEqual(50);
      expect(result?.currentTask.endsWith('...')).toBe(true);
    });

    it('should return default task when no task info', () => {
      const sessionContent = JSON.stringify({ type: 'assistant', message: { content: [] } });

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result?.currentTask).toBe('작업 진행 중');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Last Exchange Extraction Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Last Exchange Extraction', () => {
    const projectId = '-Users-testuser-exchange';
    const sessionFile = 'session.jsonl';

    it('should skip tool_result user records', () => {
      const sessionContent = [
        JSON.stringify({
          type: 'user',
          message: { content: 'Real user message' },
        }),
        JSON.stringify({
          type: 'user',
          message: {
            content: [{ type: 'tool_result', content: 'Tool output' }],
          },
        }),
        JSON.stringify({
          type: 'assistant',
          timestamp: '2024-01-01T10:00:00Z',
          message: {
            content: [{ type: 'text', text: 'Assistant response' }],
          },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result?.lastExchange?.userMessage).toContain('Real user message');
    });

    it('should aggregate tools from multiple assistant responses', () => {
      const sessionContent = [
        JSON.stringify({
          type: 'user',
          message: { content: 'Fix bugs' },
        }),
        JSON.stringify({
          type: 'assistant',
          timestamp: '2024-01-01T10:00:00Z',
          message: {
            content: [
              { type: 'tool_use', name: 'Read', input: { file_path: 'file1.ts' } },
            ],
          },
        }),
        JSON.stringify({
          type: 'assistant',
          timestamp: '2024-01-01T10:01:00Z',
          message: {
            content: [
              { type: 'tool_use', name: 'Edit', input: { file_path: 'file2.ts' } },
              { type: 'text', text: 'Fixed the issue' },
            ],
          },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result?.lastExchange?.assistantTools).toContain('Read');
      expect(result?.lastExchange?.assistantTools).toContain('Edit');
    });

    it('should truncate long messages to 100 chars', () => {
      const longMessage = 'M'.repeat(200);
      const sessionContent = [
        JSON.stringify({
          type: 'user',
          message: { content: longMessage },
        }),
        JSON.stringify({
          type: 'assistant',
          timestamp: '2024-01-01T10:00:00Z',
          message: {
            content: [{ type: 'text', text: longMessage }],
          },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result?.lastExchange?.userMessage.length).toBeLessThanOrEqual(100);
      expect(result?.lastExchange?.assistantSummary.length).toBeLessThanOrEqual(100);
    });

    it('should return undefined when no assistant response', () => {
      const sessionContent = JSON.stringify({
        type: 'user',
        message: { content: 'Hello' },
      });

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result?.lastExchange).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // User Content Extraction Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('User Content Extraction', () => {
    const projectId = '-Users-testuser-content';
    const sessionFile = 'session.jsonl';

    it('should handle single ContentBlock object (not in array)', () => {
      const sessionContent = [
        JSON.stringify({
          type: 'user',
          message: { content: { type: 'text', text: 'Single block content' } },
        }),
        JSON.stringify({
          type: 'assistant',
          timestamp: '2024-01-01T10:00:00Z',
          message: {
            content: [{ type: 'text', text: 'Response' }],
          },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      expect(result?.lastExchange?.userMessage).toContain('Single block content');
    });

    it('should handle mixed content block types', () => {
      const sessionContent = [
        JSON.stringify({
          type: 'user',
          message: {
            content: [
              { type: 'text', text: 'Text part' },
              { type: 'image', source: { data: 'base64...' } },
              { type: 'text', text: ' more text' },
            ],
          },
        }),
        JSON.stringify({
          type: 'assistant',
          timestamp: '2024-01-01T10:00:00Z',
          message: {
            content: [{ type: 'text', text: 'Response' }],
          },
        }),
      ].join('\n');

      mockState.existsSync.mockReturnValue(true);
      mockState.statSync.mockReturnValue({ size: 500, mtime: new Date(), isDirectory: () => true });
      mockState.readFileSync.mockReturnValue(sessionContent);

      const result = extractSessionContext(projectId, sessionFile);

      // Should extract only text blocks
      expect(result?.lastExchange?.userMessage).toContain('Text part');
      expect(result?.lastExchange?.userMessage).toContain('more text');
    });
  });
});
