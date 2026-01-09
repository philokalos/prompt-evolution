import { useState, useMemo, useEffect, useRef } from 'react';
import { Folder, GitBranch, Cpu, Clock, ChevronDown, ChevronUp, Zap, Monitor, MousePointer, MessageSquare, FileCode, Check, RefreshCw } from 'lucide-react';

export interface SessionContextInfo {
  projectPath: string;
  projectId: string;
  sessionId: string;
  currentTask: string;
  techStack: string[];
  recentTools: string[];
  recentFiles: string[];
  lastActivity: string | Date;
  gitBranch?: string;
  // Active window detection fields
  source?: 'active-window' | 'app-path';
  ideName?: string;
  currentFile?: string;
  confidence?: 'high' | 'medium' | 'low';
  isManual?: boolean; // True if manually selected
  // 직전 대화 컨텍스트 (새 필드)
  lastExchange?: {
    userMessage: string;
    assistantSummary: string;
    assistantTools: string[];
    assistantFiles: string[];
    timestamp: string | Date;
  };
}

export interface DetectedProject {
  projectPath: string;
  projectName: string;
  ideName: string;
  confidence: 'high' | 'medium' | 'low';
  currentFile?: string;
  isManual?: boolean;
}

interface ContextIndicatorProps {
  context: SessionContextInfo | null | undefined;
  onProjectSelect?: (projectPath: string | null) => void;
  onLoadProjects?: () => Promise<DetectedProject[]>;
}

/**
 * Displays current session context information
 * With dropdown for project selection
 */
export default function ContextIndicator({ context, onProjectSelect, onLoadProjects }: ContextIndicatorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [allProjects, setAllProjects] = useState<DetectedProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debug: Log context changes
  console.log('[ContextIndicator] Render - context:', context?.projectPath || 'null', 'isDropdownOpen:', isDropdownOpen);

  // All hooks must be called before any conditional returns
  // Compute time-based values only when context exists
  const { isRecent, timeAgo } = useMemo(() => {
    if (!context) return { isRecent: false, timeAgo: '' };
    const now = Date.now();
    const activity = typeof context.lastActivity === 'string'
      ? new Date(context.lastActivity)
      : context.lastActivity;
    const recent = now - activity.getTime() < 60 * 60 * 1000; // Within 1 hour
    const ago = formatTimeAgo(activity, now);
    return { isRecent: recent, timeAgo: ago };
  }, [context]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      console.log('[ContextIndicator] handleClickOutside triggered');
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        console.log('[ContextIndicator] Click was outside, closing dropdown');
        setIsDropdownOpen(false);
      } else {
        console.log('[ContextIndicator] Click was inside, keeping dropdown open');
      }
    }

    if (isDropdownOpen) {
      // Delay listener attachment to avoid capturing the same click that opened the dropdown
      const timeoutId = setTimeout(() => {
        console.log('[ContextIndicator] Adding mousedown listener');
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);

      return () => {
        clearTimeout(timeoutId);
        console.log('[ContextIndicator] Removing mousedown listener');
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isDropdownOpen]);

  // Load projects when dropdown opens
  const handleDropdownToggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event from bubbling to document
    console.log('[ContextIndicator] handleDropdownToggle called, isDropdownOpen:', isDropdownOpen);
    if (!isDropdownOpen && onLoadProjects) {
      setIsLoadingProjects(true);
      try {
        console.log('[ContextIndicator] Loading projects...');
        const projects = await onLoadProjects();
        console.log('[ContextIndicator] Projects loaded:', projects.length, projects);
        setAllProjects(projects);
      } catch (error) {
        console.error('[ContextIndicator] Failed to load projects:', error);
      } finally {
        setIsLoadingProjects(false);
      }
    }
    setIsDropdownOpen(!isDropdownOpen);
    console.log('[ContextIndicator] isDropdownOpen set to:', !isDropdownOpen);
  };

  const handleProjectSelect = (projectPath: string | null) => {
    onProjectSelect?.(projectPath);
    setIsDropdownOpen(false);
  };

  // Extract project name from path (or use default)
  const projectName = context?.projectPath.split('/').pop() || '프로젝트 미감지';
  const isManualMode = context?.isManual === true;

  // Compact tech stack display (first 2)
  const compactTechStack = context?.techStack.slice(0, 2) || [];
  const extraTechCount = (context?.techStack.length || 0) - 2;

  return (
    <div className="mb-3 relative" ref={dropdownRef}>
      {/* Compact Header Bar */}
      <button
        onClick={handleDropdownToggle}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-gradient-to-r ${
          isManualMode
            ? 'from-amber-500/10 to-dark-surface border-amber-500/20 hover:border-amber-500/40'
            : 'from-accent-primary/10 to-dark-surface border-accent-primary/20 hover:border-accent-primary/40'
        } border transition-all duration-200 group`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Source indicator */}
          {isManualMode ? (
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0" title="수동 선택됨">
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
            </span>
          ) : context?.source === 'active-window' ? (
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0" title="활성 창에서 감지됨">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-success"></span>
            </span>
          ) : isRecent ? (
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-warning opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-warning"></span>
            </span>
          ) : context ? null : (
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0" title="프로젝트 미감지">
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gray-600"></span>
            </span>
          )}

          {/* Project name - more prominent */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Folder size={14} className={isManualMode ? 'text-amber-400 flex-shrink-0' : context ? 'text-accent-primary flex-shrink-0' : 'text-gray-600 flex-shrink-0'} />
            <span className={`text-sm font-medium truncate ${context ? 'text-gray-200' : 'text-gray-500'}`}>
              {projectName}
            </span>
          </div>

          {/* IDE badge */}
          {context?.ideName && (
            <span className={`px-2 py-0.5 text-xs rounded flex-shrink-0 ${
              isManualMode
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-accent-secondary/20 text-accent-secondary'
            }`}>
              {isManualMode ? '수동' : context.ideName}
            </span>
          )}

          {/* Git branch */}
          {context?.gitBranch && (
            <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
              <GitBranch size={10} />
              <span className="truncate max-w-[60px]">{context.gitBranch}</span>
            </div>
          )}

          {/* Compact tech stack */}
          {compactTechStack.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
              <span className="text-gray-600">•</span>
              {compactTechStack.map((tech, index) => (
                <span
                  key={index}
                  className="text-xs text-gray-500"
                >
                  {tech}
                </span>
              ))}
              {extraTechCount > 0 && (
                <span className="text-xs text-gray-600">+{extraTechCount}</span>
              )}
            </div>
          )}
        </div>

        {/* Dropdown toggle */}
        <div className="flex items-center gap-1 text-gray-500 group-hover:text-gray-400 transition-colors flex-shrink-0 ml-2">
          {isDropdownOpen ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )}
        </div>
      </button>

      {/* Dropdown Menu - inline instead of absolute to avoid overflow clipping */}
      {isDropdownOpen && (
        <div className="mt-1 bg-dark-surface border border-dark-border rounded-lg shadow-xl overflow-hidden">
          {isLoadingProjects ? (
            <div className="px-3 py-4 flex items-center justify-center text-sm text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-primary mr-2"></div>
              프로젝트 로딩 중...
            </div>
          ) : allProjects.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              열린 IDE 프로젝트가 없습니다
            </div>
          ) : (
            <div className="max-h-[200px] overflow-y-auto">
              {allProjects.map((project) => (
                <button
                  key={project.projectPath}
                  onClick={() => handleProjectSelect(project.projectPath)}
                  className={`w-full px-3 py-2.5 flex items-center gap-2 hover:bg-dark-hover transition-colors text-left ${
                    context?.projectPath === project.projectPath ? 'bg-dark-hover' : ''
                  }`}
                >
                  {context?.projectPath === project.projectPath ? (
                    <Check size={14} className="text-accent-primary flex-shrink-0" />
                  ) : (
                    <div className="w-[14px]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-200 truncate">
                        {project.projectName}
                      </span>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {project.ideName}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Auto-detect option */}
          <div className="border-t border-dark-border">
            <button
              onClick={() => handleProjectSelect(null)}
              className={`w-full px-3 py-2.5 flex items-center gap-2 hover:bg-dark-hover transition-colors text-left ${
                !isManualMode ? 'bg-dark-hover' : ''
              }`}
            >
              <RefreshCw size={14} className={!isManualMode ? 'text-accent-success' : 'text-gray-500'} />
              <span className={`text-sm ${!isManualMode ? 'text-accent-success' : 'text-gray-400'}`}>
                자동 감지 (현재 활성 창)
              </span>
              {!isManualMode && (
                <Check size={14} className="text-accent-success ml-auto" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Expandable Details (click on chevron or secondary area) */}
      {!isDropdownOpen && context && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-400 transition-colors flex items-center justify-center gap-1"
        >
          <span>{isExpanded ? '상세 정보 접기' : '상세 정보 보기'}</span>
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}

      {/* Expanded Details */}
      {isExpanded && !isDropdownOpen && context && (
        <div className="mt-1 px-3 py-2 rounded-lg bg-dark-surface/50 border border-dark-border/50 space-y-2">
          {/* Detection source info */}
          {context.source && (
            <div className="flex items-center gap-2 text-xs">
              <MousePointer size={10} className="text-gray-500" />
              <span className="text-gray-500">
                {isManualMode ? (
                  <>
                    <span className="text-amber-400">●</span> 수동 선택됨
                  </>
                ) : context.source === 'active-window' ? (
                  <>
                    <span className="text-accent-success">●</span> {context.ideName || 'IDE'}에서 감지
                    {context.confidence && (
                      <span className="ml-1 text-gray-600">
                        ({context.confidence === 'high' ? '높은 신뢰도' : context.confidence === 'medium' ? '중간 신뢰도' : '낮은 신뢰도'})
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-accent-warning">●</span> 앱 경로에서 추정
                  </>
                )}
              </span>
            </div>
          )}

          {/* Current file (from active window) */}
          {context.currentFile && (
            <div className="flex items-start gap-2">
              <Monitor size={12} className="text-accent-secondary flex-shrink-0 mt-0.5" />
              <span className="text-xs text-gray-400 truncate">{context.currentFile}</span>
            </div>
          )}

          {/* Current Task */}
          {context.currentTask && context.currentTask !== '작업 진행 중' && (
            <div className="flex items-start gap-2">
              <Zap size={12} className="text-accent-warning flex-shrink-0 mt-0.5" />
              <span className="text-xs text-gray-400 line-clamp-2">{context.currentTask}</span>
            </div>
          )}

          {/* Full Tech Stack */}
          {context.techStack.length > 0 && (
            <div className="flex items-center gap-2">
              <Cpu size={12} className="text-gray-500 flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {context.techStack.map((tech, index) => (
                  <span
                    key={index}
                    className="px-1.5 py-0.5 bg-dark-hover text-gray-400 text-xs rounded"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 직전 대화 컨텍스트 */}
          {context.lastExchange && (
            <div className="mt-2 pt-2 border-t border-dark-border/50 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-accent-primary">
                <MessageSquare size={10} />
                <span className="font-medium">직전 대화</span>
              </div>
              {context.lastExchange.assistantSummary && (
                <div className="text-xs text-gray-400 pl-4 line-clamp-2">
                  {context.lastExchange.assistantSummary}
                </div>
              )}
              {context.lastExchange.assistantFiles.length > 0 && (
                <div className="flex items-center gap-2 pl-4">
                  <FileCode size={10} className="text-accent-secondary flex-shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {context.lastExchange.assistantFiles.slice(0, 3).map((file, index) => (
                      <span
                        key={index}
                        className="px-1.5 py-0.5 bg-accent-secondary/10 text-accent-secondary text-[10px] rounded"
                      >
                        {file.split('/').pop()}
                      </span>
                    ))}
                    {context.lastExchange.assistantFiles.length > 3 && (
                      <span className="text-[10px] text-gray-600">
                        +{context.lastExchange.assistantFiles.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity indicator */}
          {!isRecent && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Clock size={10} />
              <span>마지막 활동: {timeAgo}</span>
            </div>
          )}

          {/* Full path (subtle) */}
          <div className="text-[10px] text-gray-600 truncate">
            {context.projectPath}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Format time ago string (pure function - now passed as parameter)
 */
function formatTimeAgo(date: Date, now: number): string {
  const diff = now - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}일 전`;
  }
  if (hours > 0) {
    return `${hours}시간 전`;
  }
  return '방금 전';
}
