/**
 * SQLite Schema Definition
 * Prompt Evolution - Data Pipeline
 */

export const SCHEMA = `
-- Conversations (세션 메타데이터)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  project_path TEXT,
  model TEXT,
  started_at DATETIME,
  ended_at DATETIME,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  turn_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Turns (개별 대화 턴)
CREATE TABLE IF NOT EXISTS turns (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT,
  timestamp DATETIME,
  parent_id TEXT,
  model TEXT,
  thinking TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  turn_index INTEGER,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Tool Usages (도구 사용 내역)
CREATE TABLE IF NOT EXISTS tool_usages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  turn_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  timestamp DATETIME,
  FOREIGN KEY (turn_id) REFERENCES turns(id) ON DELETE CASCADE
);

-- Quality Signals (품질 신호 - Phase 2에서 확장)
CREATE TABLE IF NOT EXISTS quality_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  turn_id TEXT,
  value REAL,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (turn_id) REFERENCES turns(id) ON DELETE CASCADE
);

-- Summaries (세션 요약)
CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_turns_conversation ON turns(conversation_id);
CREATE INDEX IF NOT EXISTS idx_turns_role ON turns(role);
CREATE INDEX IF NOT EXISTS idx_turns_timestamp ON turns(timestamp);
CREATE INDEX IF NOT EXISTS idx_tool_usages_turn ON tool_usages(turn_id);
CREATE INDEX IF NOT EXISTS idx_tool_usages_name ON tool_usages(tool_name);
CREATE INDEX IF NOT EXISTS idx_quality_signals_conversation ON quality_signals(conversation_id);
CREATE INDEX IF NOT EXISTS idx_quality_signals_type ON quality_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project);
CREATE INDEX IF NOT EXISTS idx_conversations_started ON conversations(started_at);
`;

// Schema version for migrations
export const SCHEMA_VERSION = 1;

// Table names for reference
export const TABLES = {
  CONVERSATIONS: 'conversations',
  TURNS: 'turns',
  TOOL_USAGES: 'tool_usages',
  QUALITY_SIGNALS: 'quality_signals',
  SUMMARIES: 'summaries',
} as const;
