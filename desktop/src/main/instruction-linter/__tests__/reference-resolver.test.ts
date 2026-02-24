/**
 * Reference Resolver Tests
 *
 * Tests for resolveReferences() that resolves @path references
 * from CLAUDE.md-style files into file metadata.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveReferences, type ResolvedReference } from '../reference-resolver.js';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

import fs from 'node:fs';

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);

describe('resolveReferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve an existing file with content and lineCount', () => {
    const fileContent = 'line one\nline two\nline three';
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(fileContent);

    const result = resolveReferences(
      ['.claude/rules/security.md'],
      '/project',
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual<ResolvedReference>({
      path: '.claude/rules/security.md',
      resolvedPath: '/project/.claude/rules/security.md',
      exists: true,
      content: fileContent,
      lineCount: 3,
    });
    expect(mockExistsSync).toHaveBeenCalledWith(
      '/project/.claude/rules/security.md',
    );
    expect(mockReadFileSync).toHaveBeenCalledWith(
      '/project/.claude/rules/security.md',
      'utf-8',
    );
  });

  it('should return exists: false for a missing file without content', () => {
    mockExistsSync.mockReturnValue(false);

    const result = resolveReferences(
      ['.claude/rules/missing.md'],
      '/project',
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual<ResolvedReference>({
      path: '.claude/rules/missing.md',
      resolvedPath: '/project/.claude/rules/missing.md',
      exists: false,
    });
    expect(result[0].content).toBeUndefined();
    expect(result[0].lineCount).toBeUndefined();
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('should only resolve 1 level deep (no recursion)', () => {
    const contentWithRef = '# Rules\n\n@.claude/rules/nested.md\n\nSome rule.';
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(contentWithRef);

    const result = resolveReferences(
      ['.claude/rules/parent.md'],
      '/project',
    );

    // Should resolve parent.md but NOT follow nested.md reference
    expect(result).toHaveLength(1);
    expect(result[0].exists).toBe(true);
    expect(result[0].content).toContain('@.claude/rules/nested.md');
    // existsSync called only once (for parent.md)
    expect(mockExistsSync).toHaveBeenCalledTimes(1);
    // readFileSync called only once (for parent.md)
    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
  });

  it('should resolve paths relative to basePath', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('content');

    resolveReferences(['src/config.ts'], '/home/user/my-project');

    expect(mockExistsSync).toHaveBeenCalledWith(
      '/home/user/my-project/src/config.ts',
    );
    expect(mockReadFileSync).toHaveBeenCalledWith(
      '/home/user/my-project/src/config.ts',
      'utf-8',
    );
  });

  it('should return an empty array for empty references', () => {
    const result = resolveReferences([], '/project');

    expect(result).toEqual([]);
    expect(mockExistsSync).not.toHaveBeenCalled();
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('should handle multiple references with mixed existence', () => {
    mockExistsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    mockReadFileSync
      .mockReturnValueOnce('first file')
      .mockReturnValueOnce('third file\nwith two lines');

    const result = resolveReferences(
      ['a.md', 'b.md', 'c.md'],
      '/base',
    );

    expect(result).toHaveLength(3);
    expect(result[0].exists).toBe(true);
    expect(result[0].content).toBe('first file');
    expect(result[0].lineCount).toBe(1);

    expect(result[1].exists).toBe(false);
    expect(result[1].content).toBeUndefined();

    expect(result[2].exists).toBe(true);
    expect(result[2].content).toBe('third file\nwith two lines');
    expect(result[2].lineCount).toBe(2);
  });
});
