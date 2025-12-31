// Claude Code JSONL 레코드 타입

export type RecordType = 'summary' | 'system' | 'user' | 'assistant';

export interface BaseRecord {
  type: RecordType;
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  sessionId?: string;
}

export interface SummaryRecord extends BaseRecord {
  type: 'summary';
  summary: string;
  leafUuid: string;
}

export interface SystemRecord extends BaseRecord {
  type: 'system';
  subtype: string;
  content: string;
  level: string;
  cwd?: string;
  gitBranch?: string;
  version?: string;
}

// User message content can be string or array of content blocks
export type UserContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_result'; tool_use_id: string; content: string };

export type UserContent = string | UserContentBlock[];

export interface UserRecord extends BaseRecord {
  type: 'user';
  message: {
    role: 'user';
    content: UserContent;
  };
  cwd?: string;
  gitBranch?: string;
  version?: string;
  thinkingMetadata?: {
    level: string;
    disabled: boolean;
    triggers: string[];
  };
}
