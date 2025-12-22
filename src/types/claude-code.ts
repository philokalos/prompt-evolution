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

export interface UserRecord extends BaseRecord {
  type: 'user';
  message: {
    role: 'user';
    content: string;
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
