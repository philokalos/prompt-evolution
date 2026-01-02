/**
 * Session Context Reader
 * Reads Claude Code session data to provide context for prompt rewriting
 *
 * v2.0: Enhanced project detection with bidirectional matching, symlink support,
 *       and similarity-based fallback
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { app } from 'electron';
import { detectActiveProject, type DetectedProject } from './active-window-detector.js';
import {
  findMatchingProjectEnhanced,
  decodeProjectPathEnhanced,
  findProjectPathByNameEnhanced,
  type DetectionResult,
  type DetectionOptions,
} from './project-detector-enhanced.js';

// Claude Code projects directory
const CLAUDE_PROJECTS_PATH = path.join(homedir(), '.claude', 'projects');

// Max file size to fully parse (10MB)
const MAX_FULL_PARSE_SIZE = 10 * 1024 * 1024;

// Max lines to parse from large files
const MAX_LINES_LARGE_FILE = 100;

// Cache settings
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

// Cache structure
interface CacheEntry {
  context: SessionContext | null;
  timestamp: number;
  sessionMtime: number;
}

// In-memory cache for session context
const sessionCache: Map<string, CacheEntry> = new Map();

/**
 * Last exchange context - the most recent user-assistant pair
 * Truncated to 100 chars for efficiency
 */
export interface LastExchangeContext {
  userMessage: string;          // 직전 사용자 메시지 (100자 이내)
  assistantSummary: string;     // 직전 Claude 응답 요약 (100자 이내)
  assistantTools: string[];     // 응답에서 사용된 도구들
  assistantFiles: string[];     // 응답에서 수정된 파일들
  timestamp: Date;
}

// Session context interface
export interface SessionContext {
  projectPath: string;      // /Users/foo/project
  projectId: string;        // -Users-foo-project
  sessionId: string;        // session UUID
  currentTask: string;      // "React 컴포넌트 구현" (from summary or inferred)
  techStack: string[];      // ['React', 'TypeScript', 'Vite']
  recentTools: string[];    // ['Edit', 'Read', 'Bash']
  recentFiles: string[];    // recent file patterns
  lastActivity: Date;
  gitBranch?: string;
  lastExchange?: LastExchangeContext;  // 직전 대화 교환 (새 필드)
}

// Claude Code record types (simplified for context extraction)
interface ClaudeRecord {
  type: 'user' | 'assistant' | 'summary' | 'system';
  timestamp?: string;
  uuid?: string;
  summary?: string;
  message?: {
    content: unknown;
  };
}

interface ToolUseBlock {
  type: 'tool_use';
  name: string;
  input?: {
    file_path?: string;
    path?: string;
    command?: string;
  };
}

/**
 * Encode a filesystem path to Claude Code project ID format
 * /Users/foo/project → -Users-foo-project
 */
function encodeProjectPath(fsPath: string): string {
  return fsPath.replace(/\//g, '-');
}

/**
 * Decode Claude Code project ID to filesystem path
 * -Users-foo-my-project → /Users/foo/my-project
 *
 * The encoding replaces / with -, but we need to figure out which
 * dashes were originally slashes vs. which were dashes in folder names.
 * We do this by checking the filesystem.
 */
function decodeProjectPath(encoded: string): string {
  // Remove leading dash (represents root /)
  const withoutLeading = encoded.replace(/^-/, '');
  const parts = withoutLeading.split('-');

  // Try to reconstruct the path by checking filesystem
  let currentPath = '/';
  let i = 0;

  while (i < parts.length) {
    const part = parts[i];
    const testPath = path.join(currentPath, part);

    // Check if this single part exists as a directory
    if (fs.existsSync(testPath) && fs.statSync(testPath).isDirectory()) {
      currentPath = testPath;
      i++;
    } else {
      // Try combining with next parts (for dashed folder names like claude-projects)
      let combined = part;
      let found = false;

      for (let j = i + 1; j < parts.length && j - i < 4; j++) {
        combined += '-' + parts[j];
        const combinedPath = path.join(currentPath, combined);

        if (fs.existsSync(combinedPath) && fs.statSync(combinedPath).isDirectory()) {
          currentPath = combinedPath;
          i = j + 1;
          found = true;
          break;
        }
      }

      // If no path exists, just use the single part and continue
      if (!found) {
        currentPath = path.join(currentPath, part);
        i++;
      }
    }
  }

  return currentPath;
}

/**
 * Enhanced detection options (can be configured per-call)
 */
const defaultDetectionOptions: DetectionOptions = {
  enableSimilarity: true,
  enableRecentFallback: true,
  maxDashCombine: 10,
  similarityThreshold: 0.7,
  customSearchPaths: [],
  debug: false,
};

/**
 * Find matching Claude Code project for current working directory
 * v2.0: Uses enhanced detection with bidirectional matching and fallbacks
 *
 * @param cwd - Current working directory
 * @param options - Optional detection configuration
 * @returns projectId or null
 */
export function findMatchingProject(cwd: string, options?: DetectionOptions): string | null {
  const result = findMatchingProjectEnhanced(cwd, {
    ...defaultDetectionOptions,
    ...options,
  });

  if (result.projectId) {
    console.log(`[SessionContext] Found project: ${result.projectId} (${result.matchType}, confidence: ${(result.confidence * 100).toFixed(0)}%)`);
  } else {
    console.log(`[SessionContext] No project found: ${result.reason}`);
  }

  return result.projectId;
}

/**
 * Find matching project with full detection result
 * Use this when you need confidence scores and match types
 */
export function findMatchingProjectWithDetails(cwd: string, options?: DetectionOptions): DetectionResult {
  return findMatchingProjectEnhanced(cwd, {
    ...defaultDetectionOptions,
    ...options,
  });
}

/**
 * Legacy function - kept for backward compatibility
 * @deprecated Use findMatchingProject instead
 */
function findMatchingProjectLegacy(cwd: string): string | null {
  if (!fs.existsSync(CLAUDE_PROJECTS_PATH)) {
    return null;
  }

  const encodedCwd = encodeProjectPath(cwd);

  try {
    const projects = fs.readdirSync(CLAUDE_PROJECTS_PATH, { withFileTypes: true });

    // Exact match first
    for (const entry of projects) {
      if (entry.isDirectory() && entry.name === encodedCwd) {
        return entry.name;
      }
    }

    // Partial match (cwd is subdirectory of project)
    for (const entry of projects) {
      if (entry.isDirectory()) {
        const decodedPath = decodeProjectPath(entry.name);
        if (cwd.startsWith(decodedPath)) {
          return entry.name;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[SessionContext] Error finding project:', error);
    return null;
  }
}

/**
 * Get the most recent session file in a project
 */
export function getLatestSession(projectId: string): string | null {
  const projectPath = path.join(CLAUDE_PROJECTS_PATH, projectId);

  if (!fs.existsSync(projectPath)) {
    return null;
  }

  try {
    const files = fs.readdirSync(projectPath)
      .filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'))
      .map(f => ({
        name: f,
        mtime: fs.statSync(path.join(projectPath, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime);

    return files.length > 0 ? files[0].name : null;
  } catch (error) {
    console.error('[SessionContext] Error getting latest session:', error);
    return null;
  }
}

/**
 * Parse JSONL file with size-aware handling
 */
function parseJsonlFile(filePath: string): ClaudeRecord[] {
  const stats = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // For large files, only parse last N lines
  const linesToParse = stats.size > MAX_FULL_PARSE_SIZE
    ? lines.slice(-MAX_LINES_LARGE_FILE)
    : lines;

  const records: ClaudeRecord[] = [];
  for (const line of linesToParse) {
    try {
      const record = JSON.parse(line) as ClaudeRecord;
      records.push(record);
    } catch {
      continue; // Skip invalid lines
    }
  }

  return records;
}

/**
 * Extract tech stack from file patterns and tool usage
 */
function detectTechStack(files: string[], tools: string[]): string[] {
  const stack = new Set<string>();

  // File extension patterns
  const patterns: Record<string, string[]> = {
    '.tsx': ['React', 'TypeScript'],
    '.jsx': ['React'],
    '.ts': ['TypeScript'],
    '.vue': ['Vue'],
    '.svelte': ['Svelte'],
    '.py': ['Python'],
    '.go': ['Go'],
    '.rs': ['Rust'],
    '.swift': ['Swift'],
    '.kt': ['Kotlin'],
  };

  // Config file patterns
  const configPatterns: Record<string, string> = {
    'vite.config': 'Vite',
    'next.config': 'Next.js',
    'nuxt.config': 'Nuxt',
    'webpack.config': 'Webpack',
    'tailwind.config': 'Tailwind CSS',
    'firebase.json': 'Firebase',
    'package.json': 'Node.js',
    'Cargo.toml': 'Rust',
    'go.mod': 'Go',
    'pyproject.toml': 'Python',
    'electron-builder': 'Electron',
  };

  for (const file of files) {
    // Check extensions
    for (const [ext, techs] of Object.entries(patterns)) {
      if (file.endsWith(ext)) {
        techs.forEach(t => stack.add(t));
      }
    }

    // Check config files
    for (const [pattern, tech] of Object.entries(configPatterns)) {
      if (file.includes(pattern)) {
        stack.add(tech);
      }
    }
  }

  // Tool-based detection
  if (tools.includes('Bash')) {
    // Check for common framework patterns in commands
    // This is a heuristic based on common tool usage
  }

  return Array.from(stack).slice(0, 5); // Limit to 5 most relevant
}

/**
 * Extract current task from summaries or infer from recent activity
 */
function extractCurrentTask(records: ClaudeRecord[]): string {
  // Look for summary records (most reliable)
  const summaries = records
    .filter(r => r.type === 'summary' && r.summary)
    .map(r => r.summary!)
    .reverse();

  if (summaries.length > 0) {
    // Get most recent summary, truncate if too long
    const summary = summaries[0];
    if (summary.length > 50) {
      return summary.substring(0, 47) + '...';
    }
    return summary;
  }

  // Fallback: Extract from recent user messages
  const userMessages = records
    .filter(r => r.type === 'user' && r.message?.content)
    .slice(-3)
    .map(r => {
      const content = r.message?.content;
      if (typeof content === 'string') {
        return content;
      }
      if (Array.isArray(content)) {
        const textBlock = content.find((b: { type: string }) => b.type === 'text');
        return textBlock?.text || '';
      }
      return '';
    })
    .filter(Boolean);

  if (userMessages.length > 0) {
    const lastMessage = userMessages[userMessages.length - 1];
    if (lastMessage.length > 50) {
      return lastMessage.substring(0, 47) + '...';
    }
    return lastMessage;
  }

  return '작업 진행 중';
}

/**
 * Extract recent tools and files from session
 */
function extractToolsAndFiles(records: ClaudeRecord[]): { tools: string[]; files: string[] } {
  const tools = new Set<string>();
  const files = new Set<string>();

  // Look at recent assistant records for tool usage
  const recentRecords = records.filter(r => r.type === 'assistant').slice(-20);

  for (const record of recentRecords) {
    const content = record.message?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if ((block as ToolUseBlock).type === 'tool_use') {
        const toolBlock = block as ToolUseBlock;
        tools.add(toolBlock.name);

        // Extract file paths from tool inputs
        const input = toolBlock.input;
        if (input?.file_path) {
          files.add(path.basename(input.file_path));
        }
        if (input?.path) {
          files.add(path.basename(input.path));
        }
      }
    }
  }

  return {
    tools: Array.from(tools).slice(0, 10),
    files: Array.from(files).slice(0, 10)
  };
}

/**
 * Extract tools and files from a single content array
 */
function extractToolsFromContent(content: unknown): { tools: string[]; files: string[] } {
  const tools: string[] = [];
  const files: string[] = [];

  if (!Array.isArray(content)) return { tools, files };

  for (const block of content) {
    if ((block as ToolUseBlock).type === 'tool_use') {
      const toolBlock = block as ToolUseBlock;
      tools.push(toolBlock.name);

      const input = toolBlock.input;
      if (input?.file_path) {
        files.push(path.basename(input.file_path));
      }
      if (input?.path) {
        files.push(path.basename(input.path));
      }
    }
  }

  return { tools, files };
}

/**
 * Extract text content from assistant response
 */
function extractTextFromContent(content: unknown): string {
  if (!Array.isArray(content)) return '';

  return content
    .filter((block): block is { type: 'text'; text: string } =>
      typeof block === 'object' && block !== null && (block as { type: string }).type === 'text'
    )
    .map(block => block.text)
    .join('\n');
}

/**
 * Extract user content (handles string | ContentBlock[])
 */
function extractUserContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((block): block is { type: 'text'; text: string } =>
        typeof block === 'object' && block !== null && (block as { type: string }).type === 'text'
      )
      .map(block => block.text)
      .join('\n');
  }
  return '';
}

/**
 * Truncate text to specified length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Extract the last user-assistant exchange from session records
 * Returns 100-char summaries for efficiency
 */
function extractLastExchange(records: ClaudeRecord[]): LastExchangeContext | undefined {
  // Find the last assistant record
  const reversedRecords = [...records].reverse();
  const lastAssistant = reversedRecords.find(r => r.type === 'assistant');

  if (!lastAssistant) return undefined;

  // Find the user message that preceded this assistant response
  const assistantIdx = reversedRecords.indexOf(lastAssistant);
  const lastUser = reversedRecords.slice(assistantIdx + 1)
    .find(r => r.type === 'user');

  // Extract assistant response text (100 char summary)
  const content = lastAssistant.message?.content;
  const fullText = extractTextFromContent(content);
  const assistantSummary = truncateText(fullText, 100);

  // Extract tools and files from assistant response
  const { tools, files } = extractToolsFromContent(content);

  // Extract user message (100 char summary)
  const userText = extractUserContent(lastUser?.message?.content);
  const userSummary = truncateText(userText, 100);

  return {
    userMessage: userSummary,
    assistantSummary,
    assistantTools: tools.slice(0, 5),
    assistantFiles: files.slice(0, 5),
    timestamp: new Date(lastAssistant.timestamp || Date.now()),
  };
}

/**
 * Extract git branch from project directory
 * Reads directly from .git/HEAD file for reliability
 */
function extractGitBranch(projectPath: string): string | undefined {
  try {
    // Try to read .git/HEAD directly
    const gitHeadPath = path.join(projectPath, '.git', 'HEAD');

    if (!fs.existsSync(gitHeadPath)) {
      return undefined;
    }

    const headContent = fs.readFileSync(gitHeadPath, 'utf-8').trim();

    // Format: "ref: refs/heads/branch-name" or commit hash for detached HEAD
    if (headContent.startsWith('ref: refs/heads/')) {
      return headContent.replace('ref: refs/heads/', '');
    }

    // Detached HEAD - return short hash
    if (/^[a-f0-9]{40}$/.test(headContent)) {
      return headContent.substring(0, 7) + ' (detached)';
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract session context from a project session (with caching)
 */
export function extractSessionContext(projectId: string, sessionFile: string): SessionContext | null {
  const filePath = path.join(CLAUDE_PROJECTS_PATH, projectId, sessionFile);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const stats = fs.statSync(filePath);
    const sessionMtime = stats.mtime.getTime();
    const cacheKey = `${projectId}:${sessionFile}`;

    // Check cache
    const cached = sessionCache.get(cacheKey);
    const now = Date.now();

    if (cached) {
      // Cache hit: valid if TTL not expired AND file not modified
      const isTTLValid = now - cached.timestamp < CACHE_TTL_MS;
      const isFileUnchanged = cached.sessionMtime === sessionMtime;

      if (isTTLValid && isFileUnchanged) {
        console.log('[SessionContext] Cache hit for:', cacheKey);
        return cached.context;
      }
    }

    console.log('[SessionContext] Parsing session:', sessionFile);
    const records = parseJsonlFile(filePath);

    if (records.length === 0) {
      // Cache null result too
      sessionCache.set(cacheKey, { context: null, timestamp: now, sessionMtime });
      return null;
    }

    // Extract tools and files
    const { tools, files } = extractToolsAndFiles(records);

    // Get last timestamp
    const lastRecord = records.filter(r => r.timestamp).pop();
    const lastActivity = lastRecord?.timestamp
      ? new Date(lastRecord.timestamp)
      : new Date();

    // Decode project path for git branch and display
    const decodedProjectPath = decodeProjectPath(projectId);

    // Extract last exchange for context about the most recent interaction
    const lastExchange = extractLastExchange(records);

    const context: SessionContext = {
      projectPath: decodedProjectPath,
      projectId,
      sessionId: path.basename(sessionFile, '.jsonl'),
      currentTask: extractCurrentTask(records),
      techStack: detectTechStack(files, tools),
      recentTools: tools,
      recentFiles: files,
      lastActivity,
      gitBranch: extractGitBranch(decodedProjectPath),
      lastExchange,
    };

    // Update cache
    sessionCache.set(cacheKey, { context, timestamp: now, sessionMtime });

    return context;
  } catch (error) {
    console.error('[SessionContext] Error extracting context:', error);
    return null;
  }
}

/**
 * Clear session context cache
 */
export function clearSessionCache(): void {
  sessionCache.clear();
  console.log('[SessionContext] Cache cleared');
}

/**
 * Main entry point: Get session context for current app
 * Uses app.getAppPath() or process.cwd() to determine current project
 */
export function getSessionContext(): SessionContext | null {
  try {
    // Get current working directory
    const cwd = app.isPackaged
      ? process.cwd()
      : path.dirname(app.getAppPath());

    console.log('[SessionContext] Looking for project matching:', cwd);

    // Find matching project
    const projectId = findMatchingProject(cwd);
    if (!projectId) {
      console.log('[SessionContext] No matching project found');
      return null;
    }

    console.log('[SessionContext] Found project:', projectId);

    // Get latest session
    const sessionFile = getLatestSession(projectId);
    if (!sessionFile) {
      console.log('[SessionContext] No session files found');
      return null;
    }

    console.log('[SessionContext] Using session:', sessionFile);

    // Extract context
    return extractSessionContext(projectId, sessionFile);
  } catch (error) {
    console.error('[SessionContext] Error getting context:', error);
    return null;
  }
}

/**
 * Get session context for a specific path (for testing/debugging)
 */
export function getSessionContextForPath(targetPath: string): SessionContext | null {
  try {
    const projectId = findMatchingProject(targetPath);
    if (!projectId) return null;

    const sessionFile = getLatestSession(projectId);
    if (!sessionFile) return null;

    return extractSessionContext(projectId, sessionFile);
  } catch (error) {
    console.error('[SessionContext] Error getting context for path:', error);
    return null;
  }
}

/**
 * Extended session context with active window info
 */
export interface ActiveSessionContext extends SessionContext {
  source: 'active-window' | 'app-path';
  ideName?: string;
  currentFile?: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Get session context from currently active IDE window
 * Falls back to app path if IDE detection fails
 */
export async function getActiveWindowSessionContext(): Promise<ActiveSessionContext | null> {
  try {
    // Try to detect active IDE window first
    const activeProject = await detectActiveProject();
    console.log('[SessionContext] Active window detection result:', activeProject);

    if (activeProject && activeProject.confidence !== 'low') {
      console.log('[SessionContext] Using active window project:', activeProject.projectPath, `(${activeProject.ideName})`);

      // Find matching Claude Code project
      const projectId = findMatchingProject(activeProject.projectPath);

      if (projectId) {
        const sessionFile = getLatestSession(projectId);

        if (sessionFile) {
          const baseContext = extractSessionContext(projectId, sessionFile);

          if (baseContext) {
            return {
              ...baseContext,
              source: 'active-window',
              ideName: activeProject.ideName,
              currentFile: activeProject.currentFile,
              confidence: activeProject.confidence,
            };
          }
        }
      }

      // No Claude Code session, but we have project info
      // Return minimal context from active window
      return {
        projectPath: activeProject.projectPath,
        projectId: encodeProjectPath(activeProject.projectPath),
        sessionId: '',
        currentTask: activeProject.currentFile || '작업 진행 중',
        techStack: detectTechStackFromPath(activeProject.projectPath),
        recentTools: [],
        recentFiles: activeProject.currentFile ? [activeProject.currentFile] : [],
        lastActivity: new Date(),
        gitBranch: extractGitBranch(activeProject.projectPath),
        source: 'active-window',
        ideName: activeProject.ideName,
        currentFile: activeProject.currentFile,
        confidence: activeProject.confidence,
      };
    }

    // Fallback to app path based context
    console.log('[SessionContext] Falling back to app path context');
    const baseContext = getSessionContext();

    if (baseContext) {
      return {
        ...baseContext,
        source: 'app-path',
        confidence: 'medium',
      };
    }

    return null;
  } catch (error) {
    console.error('[SessionContext] Error getting active window context:', error);
    return null;
  }
}

/**
 * Detect tech stack from project path (for when no Claude session exists)
 */
function detectTechStackFromPath(projectPath: string): string[] {
  const stack = new Set<string>();

  const configChecks: Record<string, string> = {
    'package.json': 'Node.js',
    'tsconfig.json': 'TypeScript',
    'vite.config.ts': 'Vite',
    'vite.config.js': 'Vite',
    'next.config.js': 'Next.js',
    'next.config.ts': 'Next.js',
    'nuxt.config.ts': 'Nuxt',
    'tailwind.config.js': 'Tailwind CSS',
    'tailwind.config.ts': 'Tailwind CSS',
    'firebase.json': 'Firebase',
    'Cargo.toml': 'Rust',
    'go.mod': 'Go',
    'pyproject.toml': 'Python',
    'requirements.txt': 'Python',
    'electron-builder.json': 'Electron',
    'electron-builder.yml': 'Electron',
  };

  for (const [file, tech] of Object.entries(configChecks)) {
    if (fs.existsSync(path.join(projectPath, file))) {
      stack.add(tech);
    }
  }

  // Check for React in package.json
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps.react) stack.add('React');
      if (deps.vue) stack.add('Vue');
      if (deps.svelte) stack.add('Svelte');
      if (deps['@angular/core']) stack.add('Angular');
    } catch {
      // Ignore parse errors
    }
  }

  return Array.from(stack).slice(0, 5);
}

/**
 * Captured context interface (matches CapturedContext from index.ts)
 * Defined here to avoid circular dependency
 */
interface CapturedContextLike {
  windowInfo: {
    appName: string;
    windowTitle: string;
    isIDE: boolean;
    ideName?: string;
  } | null;
  project: {
    projectPath: string;
    projectName: string;
    currentFile?: string;
    ideName: string;
    confidence: 'high' | 'medium' | 'low';
  } | null;
  timestamp: Date;
}

/**
 * Get session context for a captured project (from hotkey time)
 * Uses the captured project info instead of real-time detection
 */
export async function getSessionContextForCapturedProject(
  capturedContext: CapturedContextLike
): Promise<ActiveSessionContext | null> {
  try {
    const { project, windowInfo } = capturedContext;

    if (!project) {
      console.log('[SessionContext] No project in captured context, falling back');
      return getActiveWindowSessionContext();
    }

    console.log('[SessionContext] Using captured project:', project.projectPath, `(${project.ideName})`);

    // Find matching Claude Code project
    const projectId = findMatchingProject(project.projectPath);

    if (projectId) {
      const sessionFile = getLatestSession(projectId);

      if (sessionFile) {
        const baseContext = extractSessionContext(projectId, sessionFile);

        if (baseContext) {
          return {
            ...baseContext,
            source: 'active-window',
            ideName: project.ideName,
            currentFile: project.currentFile,
            confidence: project.confidence,
          };
        }
      }
    }

    // No Claude Code session, but we have project info from capture
    // Return minimal context
    return {
      projectPath: project.projectPath,
      projectId: encodeProjectPath(project.projectPath),
      sessionId: '',
      currentTask: project.currentFile || '작업 진행 중',
      techStack: detectTechStackFromPath(project.projectPath),
      recentTools: [],
      recentFiles: project.currentFile ? [project.currentFile] : [],
      lastActivity: new Date(),
      gitBranch: extractGitBranch(project.projectPath),
      source: 'active-window',
      ideName: project.ideName,
      currentFile: project.currentFile,
      confidence: project.confidence,
    };
  } catch (error) {
    console.error('[SessionContext] Error getting captured project context:', error);
    return getActiveWindowSessionContext();
  }
}
