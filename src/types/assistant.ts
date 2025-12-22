// Claude Code JSONL 레코드 타입 (계속)

import type { BaseRecord } from './claude-code.js';

// Assistant 응답 콘텐츠 타입
export type AssistantContentItem = 
  | { type: 'thinking'; thinking: string; signature?: string }
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

export interface AssistantRecord extends BaseRecord {
  type: 'assistant';
  message: {
    model: string;
    id: string;
    role: 'assistant';
    content: AssistantContentItem[];
    stop_reason: string | null;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  requestId?: string;
}

// 파싱된 대화 구조
export interface ParsedConversation {
  id: string;
  project: string;
  projectPath: string;
  startedAt: Date;
  endedAt: Date;
  model: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  turns: ParsedTurn[];
  summaries: string[];
}

export interface ParsedTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  parentId?: string;
  
  // AI 응답 전용
  model?: string;
  thinking?: string;
  toolsUsed?: string[];
  inputTokens?: number;
  outputTokens?: number;
}

export type ClaudeCodeRecord = 
  | import('./claude-code.js').SummaryRecord 
  | import('./claude-code.js').SystemRecord 
  | import('./claude-code.js').UserRecord 
  | AssistantRecord;
