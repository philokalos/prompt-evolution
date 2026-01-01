/**
 * Active Window Detector
 * macOS: AppleScript로 현재 활성 IDE 창의 프로젝트를 감지
 * 창 전환 시 자동으로 프로젝트 컨텍스트 업데이트
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

// 지원하는 IDE 목록
const SUPPORTED_IDES = [
  'Code',           // VS Code
  'Cursor',         // Cursor
  'WebStorm',       // JetBrains WebStorm
  'IntelliJ IDEA',  // JetBrains IntelliJ
  'PyCharm',        // JetBrains PyCharm
  'Terminal',       // macOS Terminal
  'iTerm2',         // iTerm
  'Warp',           // Warp terminal
] as const;

type SupportedIDE = typeof SUPPORTED_IDES[number];

export interface ActiveWindowInfo {
  appName: string;
  windowTitle: string;
  isIDE: boolean;
  ideName?: SupportedIDE;
}

export interface DetectedProject {
  projectPath: string;
  projectName: string;
  currentFile?: string;
  ideName: string;
  confidence: 'high' | 'medium' | 'low';
}

// 캐시: 프로젝트 경로 유효성 검증 결과
const projectPathCache = new Map<string, boolean>();

/**
 * AppleScript로 현재 활성 창 정보 가져오기
 */
export async function getActiveWindowInfo(): Promise<ActiveWindowInfo | null> {
  if (process.platform !== 'darwin') {
    console.log('[ActiveWindow] Not macOS, skipping');
    return null;
  }

  const script = `
    tell application "System Events"
      set frontApp to first application process whose frontmost is true
      set appName to name of frontApp

      try
        set windowTitle to name of front window of frontApp
      on error
        set windowTitle to ""
      end try

      return appName & "|DELIMITER|" & windowTitle
    end tell
  `;

  try {
    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
    const [appName, windowTitle] = stdout.trim().split('|DELIMITER|');

    if (!appName) {
      return null;
    }

    // IDE 여부 판단
    const ideName = SUPPORTED_IDES.find(ide =>
      appName.includes(ide) || appName === ide
    );

    return {
      appName,
      windowTitle: windowTitle || '',
      isIDE: !!ideName,
      ideName,
    };
  } catch (error) {
    console.error('[ActiveWindow] Failed to get active window:', error);
    return null;
  }
}

/**
 * VS Code / Cursor 창 제목에서 프로젝트 경로 추출
 * 패턴: "file.ts — project-name — Visual Studio Code"
 *       "file.ts — folder — Cursor"
 *       "● file.ts — project-name — Cursor" (unsaved)
 */
function parseVSCodeWindowTitle(windowTitle: string, appName: string): DetectedProject | null {
  // 창 제목이 없거나 너무 짧으면 무시
  if (!windowTitle || windowTitle.length < 3) {
    return null;
  }

  // Welcome 탭 등 무시
  if (windowTitle.startsWith('Welcome') || windowTitle.startsWith('Get Started')) {
    return null;
  }

  // 패턴: "file.ts — project-name — IDE"
  // em dash (—) 또는 hyphen-minus (-) 처리
  const parts = windowTitle.split(/\s[—–-]\s/);

  if (parts.length >= 2) {
    // 마지막 부분이 IDE 이름이면 제거
    let projectPart = parts.length >= 3 ? parts[1] : parts[0];
    const filePart = parts[0].replace(/^[●*]\s*/, ''); // 수정됨 표시 제거

    // 프로젝트 이름으로 실제 경로 찾기
    const projectPath = findProjectPathByName(projectPart.trim());

    if (projectPath) {
      return {
        projectPath,
        projectName: path.basename(projectPath),
        currentFile: filePart,
        ideName: appName.includes('Cursor') ? 'Cursor' : 'VS Code',
        confidence: 'high',
      };
    }

    // 경로를 못 찾았지만 프로젝트 이름은 있음
    return {
      projectPath: projectPart.trim(),
      projectName: projectPart.trim(),
      currentFile: filePart,
      ideName: appName.includes('Cursor') ? 'Cursor' : 'VS Code',
      confidence: 'low',
    };
  }

  return null;
}

/**
 * JetBrains IDE 창 제목에서 프로젝트 경로 추출
 * 패턴: "project-name – file.ts"
 */
function parseJetBrainsWindowTitle(windowTitle: string, appName: string): DetectedProject | null {
  if (!windowTitle || windowTitle.length < 3) {
    return null;
  }

  // 패턴: "project-name – file.ts" 또는 "project-name [path] – file.ts"
  const parts = windowTitle.split(/\s[–-]\s/);

  if (parts.length >= 1) {
    let projectPart = parts[0];
    const filePart = parts.length >= 2 ? parts[parts.length - 1] : undefined;

    // [path] 부분 추출
    const pathMatch = projectPart.match(/\[(.+)\]/);
    if (pathMatch) {
      const projectPath = pathMatch[1];
      if (fs.existsSync(projectPath)) {
        return {
          projectPath,
          projectName: path.basename(projectPath),
          currentFile: filePart,
          ideName: appName,
          confidence: 'high',
        };
      }
    }

    // 프로젝트 이름만 있는 경우
    projectPart = projectPart.replace(/\s*\[.+\]/, '').trim();
    const projectPath = findProjectPathByName(projectPart);

    if (projectPath) {
      return {
        projectPath,
        projectName: path.basename(projectPath),
        currentFile: filePart,
        ideName: appName,
        confidence: 'high',
      };
    }
  }

  return null;
}

/**
 * 터미널 창 제목에서 경로 추출
 * 패턴: "user@host: /path/to/project" 또는 "~/project — zsh"
 */
function parseTerminalWindowTitle(windowTitle: string, appName: string): DetectedProject | null {
  if (!windowTitle || windowTitle.length < 3) {
    return null;
  }

  // 패턴 1: "user@host: /path/to/project"
  const colonMatch = windowTitle.match(/:\s*([~/].+?)(?:\s|$)/);
  if (colonMatch) {
    const pathPart = colonMatch[1].replace(/^~/, process.env.HOME || '');
    if (fs.existsSync(pathPart)) {
      return {
        projectPath: pathPart,
        projectName: path.basename(pathPart),
        ideName: appName,
        confidence: 'medium',
      };
    }
  }

  // 패턴 2: "~/project" 또는 "/path/to/project"
  const pathMatch = windowTitle.match(/^([~/][^\s—–-]+)/);
  if (pathMatch) {
    const pathPart = pathMatch[1].replace(/^~/, process.env.HOME || '');
    if (fs.existsSync(pathPart)) {
      return {
        projectPath: pathPart,
        projectName: path.basename(pathPart),
        ideName: appName,
        confidence: 'medium',
      };
    }
  }

  return null;
}

/**
 * 프로젝트 이름으로 실제 경로 찾기
 * Claude Code 세션 디렉토리 또는 일반적인 개발 폴더 검색
 */
function findProjectPathByName(projectName: string): string | null {
  // 캐시 확인
  const cacheKey = projectName.toLowerCase();

  // 일반적인 개발 디렉토리
  const searchPaths = [
    path.join(process.env.HOME || '', 'Development'),
    path.join(process.env.HOME || '', 'Projects'),
    path.join(process.env.HOME || '', 'Code'),
    path.join(process.env.HOME || '', 'dev'),
    path.join(process.env.HOME || '', 'projects'),
    path.join(process.env.HOME || '', 'code'),
    path.join(process.env.HOME || '', 'workspace'),
    path.join(process.env.HOME || '', 'src'),
  ];

  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;

    try {
      // 직접 매칭
      const directPath = path.join(searchPath, projectName);
      if (fs.existsSync(directPath) && fs.statSync(directPath).isDirectory()) {
        return directPath;
      }

      // 1단계 하위 검색 (active, personal 등의 그룹 폴더)
      const entries = fs.readdirSync(searchPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const subPath = path.join(searchPath, entry.name, projectName);
        if (fs.existsSync(subPath) && fs.statSync(subPath).isDirectory()) {
          return subPath;
        }

        // 대소문자 무시 매칭
        if (entry.name.toLowerCase() === projectName.toLowerCase()) {
          return path.join(searchPath, entry.name);
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * 창 제목에서 프로젝트 정보 추출 (IDE별 파서 선택)
 */
export function parseWindowTitle(windowInfo: ActiveWindowInfo): DetectedProject | null {
  const { appName, windowTitle, ideName } = windowInfo;

  if (!ideName) {
    return null;
  }

  switch (ideName) {
    case 'Code':
    case 'Cursor':
      return parseVSCodeWindowTitle(windowTitle, appName);

    case 'WebStorm':
    case 'IntelliJ IDEA':
    case 'PyCharm':
      return parseJetBrainsWindowTitle(windowTitle, appName);

    case 'Terminal':
    case 'iTerm2':
    case 'Warp':
      return parseTerminalWindowTitle(windowTitle, appName);

    default:
      return null;
  }
}

/**
 * 현재 활성 IDE의 프로젝트 감지 (메인 함수)
 */
export async function detectActiveProject(): Promise<DetectedProject | null> {
  const windowInfo = await getActiveWindowInfo();

  if (!windowInfo) {
    console.log('[ActiveWindow] No active window info');
    return null;
  }

  console.log('[ActiveWindow] Active:', windowInfo.appName, '|', windowInfo.windowTitle);

  if (!windowInfo.isIDE) {
    console.log('[ActiveWindow] Not a supported IDE');
    return null;
  }

  const project = parseWindowTitle(windowInfo);

  if (project) {
    console.log('[ActiveWindow] Detected project:', project.projectPath, `(${project.confidence})`);
  } else {
    console.log('[ActiveWindow] Could not parse project from window title');
  }

  return project;
}

// 폴링 기반 창 전환 감지 (옵션)
let pollingInterval: NodeJS.Timeout | null = null;
let lastDetectedProject: string | null = null;
type ProjectChangeCallback = (project: DetectedProject | null) => void;
let onProjectChangeCallback: ProjectChangeCallback | null = null;

/**
 * 창 전환 감지 폴링 시작
 */
export function startWindowPolling(
  intervalMs: number = 1000,
  onProjectChange: ProjectChangeCallback
): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  onProjectChangeCallback = onProjectChange;

  pollingInterval = setInterval(async () => {
    const project = await detectActiveProject();
    const currentPath = project?.projectPath || null;

    if (currentPath !== lastDetectedProject) {
      lastDetectedProject = currentPath;
      onProjectChangeCallback?.(project);
    }
  }, intervalMs);

  console.log(`[ActiveWindow] Started polling every ${intervalMs}ms`);
}

/**
 * 창 전환 감지 폴링 중지
 */
export function stopWindowPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('[ActiveWindow] Stopped polling');
  }
}

/**
 * 현재 감지된 프로젝트 가져오기
 */
export function getLastDetectedProject(): string | null {
  return lastDetectedProject;
}
