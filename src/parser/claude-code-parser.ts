/**
 * Claude Code JSONL 파서
 * ~/.claude/projects/ 내의 대화 로그를 파싱
 */

import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CLAUDE_PROJECTS_PATH = join(homedir(), '.claude', 'projects');

/**
 * 모든 프로젝트 목록 조회
 */
export function listProjects(): string[] {
  try {
    const entries = readdirSync(CLAUDE_PROJECTS_PATH);
    return entries.filter(entry => {
      const fullPath = join(CLAUDE_PROJECTS_PATH, entry);
      return statSync(fullPath).isDirectory();
    });
  } catch (error) {
    console.error('프로젝트 목록 조회 실패:', error);
    return [];
  }
}

/**
 * 프로젝트 내 세션 파일 목록 조회
 */
export function listSessions(projectName: string): string[] {
  const projectPath = join(CLAUDE_PROJECTS_PATH, projectName);
  try {
    const entries = readdirSync(projectPath);
    return entries.filter(entry => entry.endsWith('.jsonl'));
  } catch (error) {
    console.error(`세션 목록 조회 실패 (${projectName}):`, error);
    return [];
  }
}
