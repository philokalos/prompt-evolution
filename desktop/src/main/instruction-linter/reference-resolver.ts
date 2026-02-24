/**
 * Reference Resolver
 *
 * Resolves @path references found in CLAUDE.md-style files.
 * Checks if referenced files exist and reads their content.
 * Only resolves 1 level deep (no recursion into resolved files).
 */

import fs from 'node:fs';
import path from 'node:path';

export interface ResolvedReference {
  path: string;
  resolvedPath?: string;
  exists: boolean;
  content?: string;
  lineCount?: number;
}

/**
 * Resolve an array of reference paths relative to a base directory.
 * Returns metadata for each reference including existence, content, and line count.
 * Does not recurse into resolved files' own references.
 */
export function resolveReferences(
  references: string[],
  basePath: string,
): ResolvedReference[] {
  return references.map((ref) => {
    const resolvedPath = path.resolve(basePath, ref);

    if (!fs.existsSync(resolvedPath)) {
      return {
        path: ref,
        resolvedPath,
        exists: false,
      };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const lineCount = content.split('\n').length;

    return {
      path: ref,
      resolvedPath,
      exists: true,
      content,
      lineCount,
    };
  });
}
