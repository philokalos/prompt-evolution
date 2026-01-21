/**
 * Active Window Detector
 * macOS: AppleScript로 현재 활성 IDE 창의 프로젝트를 감지
 * 창 전환 시 자동으로 프로젝트 컨텍스트 업데이트
 *
 * v2.0: Enhanced project path finding with deeper search and custom paths
 *
 * Note: AppleScript-based features are disabled in Mac App Store builds
 * due to sandbox restrictions. In MAS mode, this module returns null
 * for active window detection (project detection unavailable).
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

const execAsync = promisify(exec);

/**
 * Check if the app is running in MAS (Mac App Store) sandbox mode.
 * MAS apps cannot use AppleScript to control other applications.
 */
function isMASBuild(): boolean {
  console.log('[ActiveWindow] Checking MAS build status...');
  console.log('[ActiveWindow] app.isPackaged:', app.isPackaged);

  if (!app.isPackaged) {
    console.log('[ActiveWindow] Not packaged, returning false');
    return false;
  }

  try {
    const receiptPath = path.join(app.getAppPath(), '..', '_MASReceipt', 'receipt');
    console.log('[ActiveWindow] Receipt path:', receiptPath);
    console.log('[ActiveWindow] Receipt exists:', fs.existsSync(receiptPath));

    if (fs.existsSync(receiptPath)) {
      console.log('[ActiveWindow] MAS receipt found!');
      return true;
    }

    const homePath = app.getPath('home');
    console.log('[ActiveWindow] Home path:', homePath);
    console.log('[ActiveWindow] Contains /Library/Containers/:', homePath.includes('/Library/Containers/'));

    if (homePath.includes('/Library/Containers/')) {
      console.log('[ActiveWindow] Sandbox container path detected!');
      return true;
    }
  } catch (error) {
    // If detection fails, assume not MAS
    console.log('[ActiveWindow] Detection error:', error);
  }

  console.log('[ActiveWindow] Not MAS build');
  return false;
}

// Cache the MAS detection result
let _isMASBuild: boolean | null = null;
function checkMASBuild(): boolean {
  if (_isMASBuild === null) {
    _isMASBuild = isMASBuild();
    if (_isMASBuild) {
      console.log('[ActiveWindow] MAS build detected - AppleScript features disabled');
    }
  }
  return _isMASBuild;
}

// 지연 로딩: 순환 의존성 방지
let findProjectPathByNameEnhanced: ((name: string, options?: Record<string, unknown>) => string | null) | null = null;

async function _getEnhancedFinder(): Promise<typeof findProjectPathByNameEnhanced> {
  if (!findProjectPathByNameEnhanced) {
    try {
      const module = await import('./project-detector-enhanced.js');
      findProjectPathByNameEnhanced = module.findProjectPathByNameEnhanced;
    } catch {
      // 폴백: 기존 함수 사용
      findProjectPathByNameEnhanced = null;
    }
  }
  return findProjectPathByNameEnhanced;
}

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
const _projectPathCache = new Map<string, boolean>();

/**
 * AppleScript로 현재 활성 창 정보 가져오기
 *
 * Note: In MAS builds, this returns null as AppleScript is not available.
 */
export async function getActiveWindowInfo(): Promise<ActiveWindowInfo | null> {
  if (process.platform !== 'darwin') {
    console.log('[ActiveWindow] Not macOS, skipping');
    return null;
  }

  // MAS sandbox doesn't allow AppleScript to query System Events
  if (checkMASBuild()) {
    console.log('[ActiveWindow] MAS build - cannot detect active window');
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
    // Escape single quotes and backticks to prevent command injection
    const escapedScript = script.replace(/'/g, "'\"'\"'").replace(/`/g, '\\`');
    const { stdout } = await execAsync(`osascript -e '${escapedScript}'`);
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
 * v2.0: 추가 패턴 지원 (Remote-SSH, Workspace, WSL)
 *
 * 지원 패턴:
 * - "file.ts — project-name — Visual Studio Code"
 * - "file.ts — folder — Cursor"
 * - "● file.ts — project-name — Cursor" (unsaved)
 * - "[SSH: host] file.ts — project-name — VS Code" (Remote-SSH)
 * - "file.ts — project-name (Workspace) — VS Code" (Workspace)
 * - "[WSL: distro] file.ts — project — VS Code" (WSL)
 */
// Maximum window title length to prevent ReDoS attacks
const MAX_WINDOW_TITLE_LENGTH = 1000;

function parseVSCodeWindowTitle(windowTitle: string, appName: string): DetectedProject | null {
  // 창 제목이 없거나 너무 짧으면 무시
  if (!windowTitle || windowTitle.length < 3) {
    return null;
  }

  // Length limit to prevent ReDoS attacks from maliciously long titles
  if (windowTitle.length > MAX_WINDOW_TITLE_LENGTH) {
    console.warn(`[ActiveWindow] Window title too long (${windowTitle.length} chars), skipping`);
    return null;
  }

  // Welcome 탭 등 무시
  const ignorePatterns = ['Welcome', 'Get Started', 'Settings', 'Extension', 'Keyboard Shortcuts'];
  if (ignorePatterns.some(pattern => windowTitle.startsWith(pattern))) {
    return null;
  }

  // Remote/WSL 프리픽스 제거
  let cleanedTitle = windowTitle;
  let isRemote = false;

  // [SSH: host] 또는 [WSL: distro] 패턴
  const remotePrefixMatch = windowTitle.match(/^\[(SSH|WSL|Dev Container):\s*[^\]]+\]\s*/);
  if (remotePrefixMatch) {
    cleanedTitle = windowTitle.slice(remotePrefixMatch[0].length);
    isRemote = true;
  }

  // 패턴: "file.ts — project-name — IDE"
  // em dash (—) 또는 hyphen-minus (-) 처리
  const parts = cleanedTitle.split(/\s[—–-]\s/);

  if (parts.length >= 2) {
    let projectPart: string;
    let filePart: string | undefined;

    // Source Control 패턴 감지: "커밋해시 - 메시지 … (파일수) — 프로젝트"
    // 첫 부분이 7자 hex (git short hash)이면 마지막 부분이 프로젝트 이름
    if (parts[0].match(/^[0-9a-f]{7}$/)) {
      projectPart = parts[parts.length - 1]; // 맨 끝이 프로젝트 이름
      filePart = undefined; // Source Control 뷰는 파일 없음
    } else {
      // 일반 패턴: "file.ts — project-name — IDE"
      // 마지막 부분이 IDE 이름이면 제거 (Visual Studio Code, VS Code, Cursor 등)
      projectPart = parts.length >= 3 ? parts[1] : parts[0];
      filePart = parts[0].replace(/^[●*]\s*/, ''); // 수정됨 표시 제거
    }

    // (Workspace) 접미사 제거
    projectPart = projectPart.replace(/\s*\(Workspace\)\s*$/i, '').trim();

    // 프로젝트 이름으로 실제 경로 찾기
    const projectPath = findProjectPathByName(projectPart);

    if (projectPath) {
      return {
        projectPath,
        projectName: path.basename(projectPath),
        currentFile: filePart,
        ideName: appName.includes('Cursor') ? 'Cursor' : 'VS Code',
        confidence: isRemote ? 'medium' : 'high', // 리모트는 신뢰도 낮춤
      };
    }

    // 경로를 못 찾았지만 프로젝트 이름으로 보이는 경우
    // 프로젝트 이름처럼 보이는지 검증 (알파벳, 숫자, 하이픈, 언더스코어만)
    // 특수문자나 공백이 포함된 창 제목 fragment는 거부
    if (/^[\w-]+$/.test(projectPart) && projectPart.length >= 2 && projectPart.length <= 100) {
      return {
        projectPath: projectPart,
        projectName: projectPart,
        currentFile: filePart,
        ideName: appName.includes('Cursor') ? 'Cursor' : 'VS Code',
        confidence: 'low',
      };
    }

    // 프로젝트 이름 형식이 아니면 null 반환
    return null;
  }

  // 단일 이름 창 타이틀 (parts.length === 1)
  // Cursor/VS Code에서 창 타이틀이 프로젝트 이름만 있는 경우
  if (parts.length === 1) {
    const projectPart = cleanedTitle.trim();

    // 빈 문자열이나 파일 확장자가 있는 경우 무시 (파일 이름일 가능성)
    if (!projectPart || /\.\w{1,5}$/.test(projectPart)) {
      return null;
    }

    // 프로젝트 이름으로 실제 경로 찾기
    const projectPath = findProjectPathByName(projectPart);

    if (projectPath) {
      console.log(`[ActiveWindow] Single-name title matched: ${projectPart} -> ${projectPath}`);
      return {
        projectPath,
        projectName: path.basename(projectPath),
        currentFile: undefined,
        ideName: appName.includes('Cursor') ? 'Cursor' : 'VS Code',
        confidence: isRemote ? 'low' : 'medium', // 단일 이름은 신뢰도 중간
      };
    }

    // 경로를 못 찾았지만 프로젝트 이름으로 보이는 경우
    // 프로젝트 이름처럼 보이는지 검증 (알파벳, 숫자, 하이픈, 언더스코어만)
    if (/^[\w-]+$/.test(projectPart) && projectPart.length >= 2) {
      return {
        projectPath: projectPart,
        projectName: projectPart,
        currentFile: undefined,
        ideName: appName.includes('Cursor') ? 'Cursor' : 'VS Code',
        confidence: 'low',
      };
    }
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
 * v2.0: 추가 프롬프트 패턴 지원 (starship, powerlevel10k 등)
 *
 * 지원 패턴:
 * - "user@host: /path/to/project"
 * - "~/project — zsh"
 * - "project on main ➜" (starship)
 * - "λ ~/project" (oh-my-zsh)
 * - "user@host /path/to/project (branch)"
 */
function parseTerminalWindowTitle(windowTitle: string, appName: string): DetectedProject | null {
  if (!windowTitle || windowTitle.length < 3) {
    return null;
  }

  // 패턴 1: "user@host: /path/to/project" 또는 "user@host /path"
  const colonMatch = windowTitle.match(/(?:@[^:]+)?[:\s]\s*([~/][^\s—–-]+)/);
  if (colonMatch) {
    const pathPart = colonMatch[1].replace(/^~/, process.env.HOME || '');
    if (fs.existsSync(pathPart) && fs.statSync(pathPart).isDirectory()) {
      return {
        projectPath: pathPart,
        projectName: path.basename(pathPart),
        ideName: appName,
        confidence: 'medium',
      };
    }
  }

  // 패턴 2: "~/project" 또는 "/path/to/project" (창 제목 시작)
  const pathMatch = windowTitle.match(/^(?:[λ➜❯]\s+)?([~/][^\s—–-]+)/);
  if (pathMatch) {
    const pathPart = pathMatch[1].replace(/^~/, process.env.HOME || '');
    if (fs.existsSync(pathPart) && fs.statSync(pathPart).isDirectory()) {
      return {
        projectPath: pathPart,
        projectName: path.basename(pathPart),
        ideName: appName,
        confidence: 'medium',
      };
    }
  }

  // 패턴 3: "project on main" 또는 "project on branch ➜" (starship 스타일)
  const starshipMatch = windowTitle.match(/^([a-zA-Z0-9_-]+)\s+on\s+([a-zA-Z0-9_/-]+)/);
  if (starshipMatch) {
    const projectName = starshipMatch[1];
    const projectPath = findProjectPathByName(projectName);
    if (projectPath) {
      return {
        projectPath,
        projectName: path.basename(projectPath),
        ideName: appName,
        confidence: 'medium',
      };
    }
  }

  // 패턴 4: 끝에 있는 경로 패턴 (일부 zsh 테마)
  const endPathMatch = windowTitle.match(/([~/][^\s]+)\s*$/);
  if (endPathMatch) {
    const pathPart = endPathMatch[1].replace(/^~/, process.env.HOME || '');
    if (fs.existsSync(pathPart) && fs.statSync(pathPart).isDirectory()) {
      return {
        projectPath: pathPart,
        projectName: path.basename(pathPart),
        ideName: appName,
        confidence: 'low', // 끝에 있는 패턴은 신뢰도 낮음
      };
    }
  }

  return null;
}

/**
 * 프로젝트 이름으로 실제 경로 찾기
 * v2.0: Enhanced version with deeper search (3 levels) and custom paths
 * Claude Code 세션 디렉토리 또는 일반적인 개발 폴더 검색
 */
function findProjectPathByName(projectName: string): string | null {
  // 향상된 탐색기 사용 시도 (비동기 로딩 완료된 경우)
  if (findProjectPathByNameEnhanced) {
    const result = findProjectPathByNameEnhanced(projectName);
    if (result) return result;
  }

  // 폴백: 기존 로직 (2단계 깊이)
  const searchPaths = [
    path.join(process.env.HOME || '', 'Development'),
    path.join(process.env.HOME || '', 'Projects'),
    path.join(process.env.HOME || '', 'Code'),
    path.join(process.env.HOME || '', 'dev'),
    path.join(process.env.HOME || '', 'projects'),
    path.join(process.env.HOME || '', 'code'),
    path.join(process.env.HOME || '', 'workspace'),
    path.join(process.env.HOME || '', 'src'),
    path.join(process.env.HOME || '', 'work'), // 추가
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

        // 2단계 하위 검색 (추가)
        try {
          const subEntries = fs.readdirSync(path.join(searchPath, entry.name), { withFileTypes: true });
          for (const subEntry of subEntries) {
            if (!subEntry.isDirectory()) continue;

            const deepPath = path.join(searchPath, entry.name, subEntry.name, projectName);
            if (fs.existsSync(deepPath) && fs.statSync(deepPath).isDirectory()) {
              return deepPath;
            }

            if (subEntry.name.toLowerCase() === projectName.toLowerCase()) {
              return path.join(searchPath, entry.name, subEntry.name);
            }
          }
        } catch {
          continue;
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
  // Write to file for debugging
  const fs = await import('fs');
  const logPath = '/tmp/promptlint-debug.log';
  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
    console.log(msg);
  };

  log('[ActiveWindow] detectActiveProject called');

  const windowInfo = await getActiveWindowInfo();

  if (!windowInfo) {
    log('[ActiveWindow] No active window info');
    return null;
  }

  log(`[ActiveWindow] Active: ${windowInfo.appName} | ${windowInfo.windowTitle}`);
  log(`[ActiveWindow] isIDE: ${windowInfo.isIDE}, ideName: ${windowInfo.ideName}`);

  if (!windowInfo.isIDE) {
    log('[ActiveWindow] Not a supported IDE');
    return null;
  }

  const project = parseWindowTitle(windowInfo);

  if (project) {
    log(`[ActiveWindow] Detected project: ${project.projectPath} (${project.confidence})`);
  } else {
    log('[ActiveWindow] Could not parse project from window title');
  }

  return project;
}

// 폴링 기반 창 전환 감지 (옵션)
let pollingInterval: NodeJS.Timeout | null = null;
let lastDetectedProject: string | null = null;
type ProjectChangeCallback = (project: DetectedProject | null) => void;
let onProjectChangeCallback: ProjectChangeCallback | null = null;

// 최근 감지된 프로젝트 캐시 (projectPath -> {project, lastSeen})
// 폴링에서 감지된 프로젝트들을 기억하여 드롭다운에서 사용
interface CachedProject {
  project: DetectedProject;
  lastSeen: number;
}
const recentProjectsCache = new Map<string, CachedProject>();
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5분 후 만료

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

    // 프로젝트가 감지되면 캐시에 저장 (드롭다운용)
    if (project && project.projectPath) {
      recentProjectsCache.set(project.projectPath, {
        project,
        lastSeen: Date.now(),
      });
    }

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

// ============================================================================
// Multi-Project Detection (열린 모든 IDE 프로젝트 감지)
// ============================================================================

/**
 * 최근 감지된 모든 프로젝트 반환 (캐시 기반)
 * 폴링에서 감지된 프로젝트들을 캐시에서 가져옴
 * AppleScript 권한 문제 없이 빠르게 동작
 */
export async function detectAllOpenProjects(): Promise<DetectedProject[]> {
  const now = Date.now();
  const projects: DetectedProject[] = [];

  // 캐시에서 만료되지 않은 프로젝트들 수집
  for (const [path, cached] of recentProjectsCache.entries()) {
    if (now - cached.lastSeen < CACHE_EXPIRY_MS) {
      projects.push(cached.project);
    } else {
      // 만료된 항목 제거
      recentProjectsCache.delete(path);
    }
  }

  // lastSeen 기준 최신순 정렬
  projects.sort((a, b) => {
    const aCache = recentProjectsCache.get(a.projectPath);
    const bCache = recentProjectsCache.get(b.projectPath);
    return (bCache?.lastSeen || 0) - (aCache?.lastSeen || 0);
  });

  console.log(`[ActiveWindow] Returning ${projects.length} cached projects:`, projects.map(p => p.projectName));
  return projects;
}

// ============================================================================
// AI App Detection (Phase 3: Innovative Activation)
// ============================================================================

// AI 채팅 앱 목록 (앱 이름 또는 브라우저 탭 제목에서 감지)
const AI_CHAT_APPS = [
  'Claude',
  'ChatGPT',
  'Gemini',
  'Copilot',
  'Perplexity',
  'Poe',
  'Character.AI',
  'Pi',
  'Anthropic',
  'OpenAI',
] as const;

export type AIAppName = typeof AI_CHAT_APPS[number];

export interface DetectedAIApp {
  appName: string;
  aiAppType: AIAppName;
  windowTitle: string;
  isBrowser: boolean;
}

/**
 * 앱 이름 또는 창 제목이 AI 앱인지 확인
 */
export function isAIApp(appName: string, windowTitle: string): AIAppName | null {
  const combinedText = `${appName} ${windowTitle}`.toLowerCase();

  for (const aiApp of AI_CHAT_APPS) {
    if (combinedText.includes(aiApp.toLowerCase())) {
      return aiApp;
    }
  }

  // 추가 패턴: 브라우저 탭 URL/제목 패턴
  const urlPatterns = [
    { pattern: /claude\.ai/i, app: 'Claude' as const },
    { pattern: /chat\.openai\.com/i, app: 'ChatGPT' as const },
    { pattern: /chatgpt\.com/i, app: 'ChatGPT' as const },
    { pattern: /gemini\.google\.com/i, app: 'Gemini' as const },
    { pattern: /bard\.google\.com/i, app: 'Gemini' as const },
    { pattern: /copilot\.microsoft\.com/i, app: 'Copilot' as const },
    { pattern: /perplexity\.ai/i, app: 'Perplexity' as const },
    { pattern: /poe\.com/i, app: 'Poe' as const },
  ];

  for (const { pattern, app } of urlPatterns) {
    if (pattern.test(windowTitle)) {
      return app;
    }
  }

  return null;
}

/**
 * 현재 활성 창이 AI 앱인지 감지
 */
export async function detectActiveAIApp(): Promise<DetectedAIApp | null> {
  const windowInfo = await getActiveWindowInfo();

  if (!windowInfo) {
    return null;
  }

  const { appName, windowTitle } = windowInfo;

  // 브라우저 여부 확인
  const browsers = ['Safari', 'Chrome', 'Firefox', 'Arc', 'Edge', 'Brave', 'Opera'];
  const isBrowser = browsers.some(browser =>
    appName.includes(browser) || appName === browser
  );

  const aiAppType = isAIApp(appName, windowTitle);

  if (aiAppType) {
    return {
      appName,
      aiAppType,
      windowTitle,
      isBrowser,
    };
  }

  return null;
}

// AI 앱 폴링 상태
let aiAppPollingInterval: NodeJS.Timeout | null = null;
let lastDetectedAIApp: AIAppName | null = null;
type AIAppChangeCallback = (aiApp: DetectedAIApp | null) => void;
let onAIAppChangeCallback: AIAppChangeCallback | null = null;

/**
 * AI 앱 감지 폴링 시작
 */
export function startAIAppPolling(
  intervalMs: number = 2000,
  onAIAppChange: AIAppChangeCallback
): void {
  if (aiAppPollingInterval) {
    clearInterval(aiAppPollingInterval);
  }

  onAIAppChangeCallback = onAIAppChange;

  aiAppPollingInterval = setInterval(async () => {
    const aiApp = await detectActiveAIApp();
    const currentAIApp = aiApp?.aiAppType || null;

    if (currentAIApp !== lastDetectedAIApp) {
      lastDetectedAIApp = currentAIApp;
      onAIAppChangeCallback?.(aiApp);
    }
  }, intervalMs);

  console.log(`[ActiveWindow] Started AI app polling every ${intervalMs}ms`);
}

/**
 * AI 앱 감지 폴링 중지
 */
export function stopAIAppPolling(): void {
  if (aiAppPollingInterval) {
    clearInterval(aiAppPollingInterval);
    aiAppPollingInterval = null;
    lastDetectedAIApp = null;
    console.log('[ActiveWindow] Stopped AI app polling');
  }
}

/**
 * 현재 감지된 AI 앱 가져오기
 */
export function getLastDetectedAIApp(): AIAppName | null {
  return lastDetectedAIApp;
}
