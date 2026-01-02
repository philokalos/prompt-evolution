/**
 * Enhanced Project Detector
 * 기존 감지 로직의 문제점을 해결한 개선된 프로젝트 감지 시스템
 *
 * 개선 사항:
 * 1. 양방향 부분 매칭 (cwd → project, project → cwd)
 * 2. 동적 대시 결합 (무제한)
 * 3. 유사도 기반 폴백 매칭
 * 4. 확장 가능한 검색 경로
 * 5. Claude Code 세션 기반 최근 프로젝트 우선
 * 6. Symlink 해석 지원
 * 7. 상세한 실패 원인 로깅
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

// Claude Code projects directory
const CLAUDE_PROJECTS_PATH = path.join(homedir(), '.claude', 'projects');

// 감지 결과 인터페이스
export interface DetectionResult {
  projectId: string | null;
  projectPath: string | null;
  matchType: 'exact' | 'partial-cwd-in-project' | 'partial-project-in-cwd' | 'similarity' | 'recent' | null;
  confidence: number; // 0.0 - 1.0
  reason: string;
}

// 디버그 로그 인터페이스
export interface DetectionLog {
  step: string;
  input: string;
  result: string;
  duration: number;
}

// 감지 옵션
export interface DetectionOptions {
  enableSimilarity?: boolean;      // 유사도 매칭 활성화 (기본: true)
  enableRecentFallback?: boolean;  // 최근 프로젝트 폴백 (기본: true)
  maxDashCombine?: number;         // 대시 결합 최대 길이 (기본: 10)
  similarityThreshold?: number;    // 유사도 임계값 (기본: 0.7)
  customSearchPaths?: string[];    // 추가 검색 경로
  debug?: boolean;                 // 디버그 로깅
}

const defaultOptions: Required<DetectionOptions> = {
  enableSimilarity: true,
  enableRecentFallback: true,
  maxDashCombine: 10,
  similarityThreshold: 0.7,
  customSearchPaths: [],
  debug: false,
};

// 디버그 로그 저장
const debugLogs: DetectionLog[] = [];

function log(step: string, input: string, result: string, startTime: number): void {
  const duration = Date.now() - startTime;
  debugLogs.push({ step, input, result, duration });
  console.log(`[ProjectDetector] ${step}: ${input} → ${result} (${duration}ms)`);
}

/**
 * 개선된 경로 디코딩 - 동적 대시 결합
 * 기존 문제: j - i < 4 제한으로 5개 이상 대시 폴더 실패
 */
export function decodeProjectPathEnhanced(
  encoded: string,
  options: Pick<DetectionOptions, 'maxDashCombine' | 'debug'> = {}
): string | null {
  const opts = { ...defaultOptions, ...options };
  const start = Date.now();

  // Remove leading dash (represents root /)
  const withoutLeading = encoded.replace(/^-/, '');
  const parts = withoutLeading.split('-');

  if (parts.length === 0) {
    if (opts.debug) log('decode', encoded, 'empty parts', start);
    return null;
  }

  let currentPath = '/';
  let i = 0;

  while (i < parts.length) {
    const part = parts[i];
    const testPath = path.join(currentPath, part);

    // Check if this single part exists as a directory
    if (existsAsDirectory(testPath)) {
      currentPath = testPath;
      i++;
      continue;
    }

    // 개선: 동적 대시 결합 (최대 maxDashCombine까지)
    let combined = part;
    let found = false;

    for (let j = i + 1; j < parts.length && j - i < opts.maxDashCombine; j++) {
      combined += '-' + parts[j];
      const combinedPath = path.join(currentPath, combined);

      if (existsAsDirectory(combinedPath)) {
        currentPath = combinedPath;
        i = j + 1;
        found = true;
        break;
      }
    }

    // 못 찾으면 단일 파트로 진행 (경로가 존재하지 않을 수 있음)
    if (!found) {
      currentPath = path.join(currentPath, part);
      i++;
    }
  }

  // 개선: 최종 경로 검증
  if (!fs.existsSync(currentPath)) {
    if (opts.debug) log('decode', encoded, `path not found: ${currentPath}`, start);
    return null;
  }

  if (opts.debug) log('decode', encoded, currentPath, start);
  return currentPath;
}

/**
 * 디렉토리 존재 확인 (symlink 포함)
 */
function existsAsDirectory(testPath: string): boolean {
  try {
    const stat = fs.statSync(testPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Symlink를 해석하여 실제 경로 반환
 */
function resolveSymlink(pathToResolve: string): string {
  try {
    return fs.realpathSync(pathToResolve);
  } catch {
    return pathToResolve;
  }
}

/**
 * 경로 정규화 (trailing slash 제거, resolve)
 */
function normalizePath(p: string): string {
  return path.resolve(p).replace(/\/$/, '');
}

/**
 * Levenshtein 거리 기반 유사도 계산
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  // 경로의 마지막 부분(프로젝트명) 비교에 가중치
  const name1 = path.basename(s1);
  const name2 = path.basename(s2);

  const matrix: number[][] = [];
  for (let i = 0; i <= name1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= name2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= name1.length; i++) {
    for (let j = 1; j <= name2.length; j++) {
      const cost = name1[i - 1] === name2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(name1.length, name2.length);
  return 1 - matrix[name1.length][name2.length] / maxLen;
}

/**
 * 모든 Claude Code 프로젝트 ID 가져오기
 */
function getClaudeProjects(): string[] {
  if (!fs.existsSync(CLAUDE_PROJECTS_PATH)) {
    return [];
  }

  try {
    return fs.readdirSync(CLAUDE_PROJECTS_PATH, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch {
    return [];
  }
}

/**
 * 최근 활동 프로젝트 가져오기 (세션 파일 기준)
 */
function getRecentProjects(limit: number = 5): Array<{ projectId: string; lastModified: number }> {
  const projects = getClaudeProjects();
  const projectsWithTime: Array<{ projectId: string; lastModified: number }> = [];

  for (const projectId of projects) {
    const projectPath = path.join(CLAUDE_PROJECTS_PATH, projectId);
    try {
      const files = fs.readdirSync(projectPath)
        .filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'));

      if (files.length === 0) continue;

      const latestMtime = Math.max(
        ...files.map(f => fs.statSync(path.join(projectPath, f)).mtime.getTime())
      );

      projectsWithTime.push({ projectId, lastModified: latestMtime });
    } catch {
      continue;
    }
  }

  return projectsWithTime
    .sort((a, b) => b.lastModified - a.lastModified)
    .slice(0, limit);
}

/**
 * 개선된 프로젝트 매칭 - 양방향 부분 매칭 지원
 */
export function findMatchingProjectEnhanced(
  cwd: string,
  options: DetectionOptions = {}
): DetectionResult {
  const opts = { ...defaultOptions, ...options };
  const start = Date.now();
  const normalizedCwd = normalizePath(cwd);
  const resolvedCwd = resolveSymlink(normalizedCwd);

  if (!fs.existsSync(CLAUDE_PROJECTS_PATH)) {
    return {
      projectId: null,
      projectPath: null,
      matchType: null,
      confidence: 0,
      reason: 'Claude projects directory not found',
    };
  }

  const encodedCwd = normalizedCwd.replace(/\//g, '-');
  const projects = getClaudeProjects();

  // 1단계: 정확한 매칭
  for (const projectId of projects) {
    if (projectId === encodedCwd) {
      const decodedPath = decodeProjectPathEnhanced(projectId, opts);
      if (opts.debug) log('exact-match', cwd, projectId, start);
      return {
        projectId,
        projectPath: decodedPath,
        matchType: 'exact',
        confidence: 1.0,
        reason: 'Exact path match',
      };
    }
  }

  // 2단계: 부분 매칭 (양방향)
  const partialMatches: Array<{
    projectId: string;
    projectPath: string;
    type: 'partial-cwd-in-project' | 'partial-project-in-cwd';
    depth: number;
  }> = [];

  for (const projectId of projects) {
    const decodedPath = decodeProjectPathEnhanced(projectId, opts);
    if (!decodedPath) continue;

    const normalizedProjectPath = normalizePath(decodedPath);
    const resolvedProjectPath = resolveSymlink(normalizedProjectPath);

    // 케이스 A: cwd가 project의 하위 디렉토리 (기존 로직)
    if (resolvedCwd.startsWith(resolvedProjectPath + '/')) {
      const depth = resolvedCwd.replace(resolvedProjectPath, '').split('/').length - 1;
      partialMatches.push({
        projectId,
        projectPath: decodedPath,
        type: 'partial-cwd-in-project',
        depth,
      });
    }

    // 케이스 B: project가 cwd의 하위 디렉토리 (새로 추가 - 모노레포 지원)
    if (resolvedProjectPath.startsWith(resolvedCwd + '/')) {
      const depth = resolvedProjectPath.replace(resolvedCwd, '').split('/').length - 1;
      partialMatches.push({
        projectId,
        projectPath: decodedPath,
        type: 'partial-project-in-cwd',
        depth,
      });
    }
  }

  // 부분 매칭이 있으면 가장 가까운 것 선택
  if (partialMatches.length > 0) {
    // cwd가 project 하위인 경우 우선 (더 구체적인 매칭)
    const cwdInProject = partialMatches
      .filter(m => m.type === 'partial-cwd-in-project')
      .sort((a, b) => a.depth - b.depth);

    if (cwdInProject.length > 0) {
      const best = cwdInProject[0];
      if (opts.debug) log('partial-match', cwd, `${best.projectId} (depth: ${best.depth})`, start);
      return {
        projectId: best.projectId,
        projectPath: best.projectPath,
        matchType: 'partial-cwd-in-project',
        confidence: Math.max(0.8, 1 - best.depth * 0.05),
        reason: `CWD is ${best.depth} level(s) deep in project`,
      };
    }

    // project가 cwd 하위인 경우 (모노레포 루트에서 작업)
    const projectInCwd = partialMatches
      .filter(m => m.type === 'partial-project-in-cwd')
      .sort((a, b) => a.depth - b.depth);

    if (projectInCwd.length > 0) {
      const best = projectInCwd[0];
      if (opts.debug) log('partial-match-reverse', cwd, `${best.projectId} (depth: ${best.depth})`, start);
      return {
        projectId: best.projectId,
        projectPath: best.projectPath,
        matchType: 'partial-project-in-cwd',
        confidence: Math.max(0.6, 0.8 - best.depth * 0.1),
        reason: `Project is ${best.depth} level(s) deep from CWD (monorepo pattern)`,
      };
    }
  }

  // 3단계: 유사도 기반 매칭 (옵션)
  if (opts.enableSimilarity) {
    const similarityMatches: Array<{
      projectId: string;
      projectPath: string;
      similarity: number;
    }> = [];

    for (const projectId of projects) {
      const decodedPath = decodeProjectPathEnhanced(projectId, opts);
      if (!decodedPath) continue;

      const similarity = calculateSimilarity(normalizedCwd, decodedPath);
      if (similarity >= opts.similarityThreshold) {
        similarityMatches.push({ projectId, projectPath: decodedPath, similarity });
      }
    }

    if (similarityMatches.length > 0) {
      const best = similarityMatches.sort((a, b) => b.similarity - a.similarity)[0];
      if (opts.debug) log('similarity-match', cwd, `${best.projectId} (${(best.similarity * 100).toFixed(1)}%)`, start);
      return {
        projectId: best.projectId,
        projectPath: best.projectPath,
        matchType: 'similarity',
        confidence: best.similarity * 0.8, // 유사도 매칭은 신뢰도 낮춤
        reason: `Similar path (${(best.similarity * 100).toFixed(1)}% match)`,
      };
    }
  }

  // 4단계: 최근 프로젝트 폴백 (옵션)
  if (opts.enableRecentFallback) {
    const recentProjects = getRecentProjects(1);
    if (recentProjects.length > 0) {
      const recent = recentProjects[0];
      const decodedPath = decodeProjectPathEnhanced(recent.projectId, opts);
      if (opts.debug) log('recent-fallback', cwd, recent.projectId, start);
      return {
        projectId: recent.projectId,
        projectPath: decodedPath,
        matchType: 'recent',
        confidence: 0.3,
        reason: 'Fallback to most recently active project',
      };
    }
  }

  if (opts.debug) log('no-match', cwd, 'null', start);
  return {
    projectId: null,
    projectPath: null,
    matchType: null,
    confidence: 0,
    reason: 'No matching project found',
  };
}

/**
 * 개선된 프로젝트 이름으로 경로 찾기
 * 기존 문제: 하드코딩된 경로, 2단계 깊이 제한
 */
export function findProjectPathByNameEnhanced(
  projectName: string,
  options: DetectionOptions = {}
): string | null {
  const opts = { ...defaultOptions, ...options };
  const start = Date.now();

  // 기본 검색 경로 + 커스텀 경로
  const searchPaths = [
    path.join(homedir(), 'Development'),
    path.join(homedir(), 'Projects'),
    path.join(homedir(), 'Code'),
    path.join(homedir(), 'dev'),
    path.join(homedir(), 'projects'),
    path.join(homedir(), 'code'),
    path.join(homedir(), 'workspace'),
    path.join(homedir(), 'src'),
    path.join(homedir(), 'work'),
    '/opt/projects',
    '/var/www',
    ...opts.customSearchPaths,
  ];

  const normalizedName = projectName.toLowerCase();

  // 1단계: 직접 매칭 (모든 검색 경로)
  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;

    const directPath = path.join(searchPath, projectName);
    if (existsAsDirectory(directPath)) {
      if (opts.debug) log('find-by-name-direct', projectName, directPath, start);
      return directPath;
    }

    // 대소문자 무시 매칭
    try {
      const entries = fs.readdirSync(searchPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.toLowerCase() === normalizedName) {
          const foundPath = path.join(searchPath, entry.name);
          if (opts.debug) log('find-by-name-case-insensitive', projectName, foundPath, start);
          return foundPath;
        }
      }
    } catch {
      continue;
    }
  }

  // 2단계: 3단계 깊이까지 검색 (기존 2단계 → 3단계로 확장)
  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;

    const result = searchRecursive(searchPath, normalizedName, 3);
    if (result) {
      if (opts.debug) log('find-by-name-recursive', projectName, result, start);
      return result;
    }
  }

  // 3단계: Claude Code 프로젝트에서 검색
  const projects = getClaudeProjects();
  for (const projectId of projects) {
    const decodedPath = decodeProjectPathEnhanced(projectId, opts);
    if (!decodedPath) continue;

    if (path.basename(decodedPath).toLowerCase() === normalizedName) {
      if (opts.debug) log('find-by-name-claude', projectName, decodedPath, start);
      return decodedPath;
    }
  }

  if (opts.debug) log('find-by-name', projectName, 'not found', start);
  return null;
}

/**
 * 재귀적 디렉토리 검색 (깊이 제한)
 */
function searchRecursive(basePath: string, targetName: string, maxDepth: number, currentDepth: number = 0): string | null {
  if (currentDepth >= maxDepth) return null;

  try {
    const entries = fs.readdirSync(basePath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue; // 숨김 폴더 제외

      const fullPath = path.join(basePath, entry.name);

      // 현재 레벨에서 매칭
      if (entry.name.toLowerCase() === targetName) {
        return fullPath;
      }

      // 하위 검색
      const subResult = searchRecursive(fullPath, targetName, maxDepth, currentDepth + 1);
      if (subResult) return subResult;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * 디버그 로그 가져오기
 */
export function getDetectionLogs(): DetectionLog[] {
  return [...debugLogs];
}

/**
 * 디버그 로그 초기화
 */
export function clearDetectionLogs(): void {
  debugLogs.length = 0;
}

/**
 * 감지 통계
 */
export interface DetectionStats {
  totalProjects: number;
  projectsWithSessions: number;
  recentProjects: Array<{ projectId: string; projectPath: string | null; lastModified: Date }>;
}

export function getDetectionStats(): DetectionStats {
  const projects = getClaudeProjects();
  const recentProjects = getRecentProjects(10);

  return {
    totalProjects: projects.length,
    projectsWithSessions: recentProjects.length,
    recentProjects: recentProjects.map(p => ({
      projectId: p.projectId,
      projectPath: decodeProjectPathEnhanced(p.projectId),
      lastModified: new Date(p.lastModified),
    })),
  };
}
