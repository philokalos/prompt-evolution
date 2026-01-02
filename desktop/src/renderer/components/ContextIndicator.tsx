import { useState } from 'react';
import { Folder, GitBranch, Cpu, Clock, ChevronDown, ChevronUp, Zap, Monitor, MousePointer } from 'lucide-react';

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
}

interface ContextIndicatorProps {
  context: SessionContextInfo | null | undefined;
}

/**
 * Displays current session context information
 * Compact header with expandable details
 */
export default function ContextIndicator({ context }: ContextIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!context) {
    return (
      <div className="mb-3 px-3 py-2 rounded-lg bg-dark-surface/50 border border-dark-border/50">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Folder size={12} className="text-gray-600" />
          <span>프로젝트 미감지</span>
          <span className="text-gray-600">- 텍스트 선택 후 ⌘⇧P로 분석하세요</span>
        </div>
      </div>
    );
  }

  // Extract project name from path
  const projectName = context.projectPath.split('/').pop() || 'Unknown';

  // Format last activity
  const lastActivity = typeof context.lastActivity === 'string'
    ? new Date(context.lastActivity)
    : context.lastActivity;
  const isRecent = Date.now() - lastActivity.getTime() < 60 * 60 * 1000; // Within 1 hour

  // Compact tech stack display (first 2)
  const compactTechStack = context.techStack.slice(0, 2);
  const extraTechCount = context.techStack.length - 2;

  return (
    <div className="mb-3">
      {/* Compact Header Bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-gradient-to-r from-accent-primary/10 to-dark-surface border border-accent-primary/20 hover:border-accent-primary/40 transition-all duration-200 group"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Source indicator - active window vs app path */}
          {context.source === 'active-window' ? (
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0" title="활성 창에서 감지됨">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-success"></span>
            </span>
          ) : isRecent ? (
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-warning opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-warning"></span>
            </span>
          ) : null}

          {/* Project name - more prominent */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Folder size={14} className="text-accent-primary flex-shrink-0" />
            <span className="text-sm font-medium text-gray-200 truncate">
              {projectName}
            </span>
          </div>

          {/* IDE badge */}
          {context.ideName && (
            <span className="px-2 py-0.5 bg-accent-secondary/20 text-accent-secondary text-xs rounded flex-shrink-0">
              {context.ideName}
            </span>
          )}

          {/* Git branch */}
          {context.gitBranch && (
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

        {/* Expand toggle */}
        <div className="flex items-center gap-1 text-gray-500 group-hover:text-gray-400 transition-colors flex-shrink-0 ml-2">
          {isExpanded ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-1 px-3 py-2 rounded-lg bg-dark-surface/50 border border-dark-border/50 space-y-2">
          {/* Detection source info */}
          {context.source && (
            <div className="flex items-center gap-2 text-xs">
              <MousePointer size={10} className="text-gray-500" />
              <span className="text-gray-500">
                {context.source === 'active-window' ? (
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

          {/* Activity indicator */}
          {!isRecent && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Clock size={10} />
              <span>마지막 활동: {formatTimeAgo(lastActivity)}</span>
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
 * Format time ago string
 */
function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
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
