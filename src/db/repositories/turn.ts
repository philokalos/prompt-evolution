/**
 * Turn Repository
 * CRUD operations for turns table
 */

import { getDatabase } from '../connection.js';
import type { ParsedTurn } from '../../types/index.js';

export interface TurnRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string | null;
  timestamp: string | null;
  parent_id: string | null;
  model: string | null;
  thinking: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  turn_index: number;
}

/**
 * Insert a single turn
 */
export function insertTurn(
  conversationId: string,
  turn: ParsedTurn,
  turnIndex: number
): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO turns (
      id, conversation_id, role, content, timestamp,
      parent_id, model, thinking, input_tokens, output_tokens, turn_index
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    turn.id,
    conversationId,
    turn.role,
    turn.content,
    turn.timestamp.toISOString(),
    turn.parentId || null,
    turn.model || null,
    turn.thinking || null,
    turn.inputTokens || null,
    turn.outputTokens || null,
    turnIndex
  );
}

/**
 * Insert multiple turns for a conversation (batch insert)
 */
export function insertTurns(conversationId: string, turns: ParsedTurn[]): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO turns (
      id, conversation_id, role, content, timestamp,
      parent_id, model, thinking, input_tokens, output_tokens, turn_index
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: ParsedTurn[]) => {
    items.forEach((turn, index) => {
      stmt.run(
        turn.id,
        conversationId,
        turn.role,
        turn.content,
        turn.timestamp.toISOString(),
        turn.parentId || null,
        turn.model || null,
        turn.thinking || null,
        turn.inputTokens || null,
        turn.outputTokens || null,
        index
      );
    });
  });

  insertMany(turns);
}

/**
 * Get turn by ID
 */
export function getTurnById(id: string): TurnRow | undefined {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM turns WHERE id = ?');
  return stmt.get(id) as TurnRow | undefined;
}

/**
 * Get all turns for a conversation
 */
export function getTurnsByConversationId(conversationId: string): TurnRow[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM turns
    WHERE conversation_id = ?
    ORDER BY turn_index ASC
  `);
  return stmt.all(conversationId) as TurnRow[];
}

/**
 * Get turns by role
 */
export function getTurnsByRole(
  conversationId: string,
  role: 'user' | 'assistant'
): TurnRow[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM turns
    WHERE conversation_id = ? AND role = ?
    ORDER BY turn_index ASC
  `);
  return stmt.all(conversationId, role) as TurnRow[];
}

/**
 * Get turn count for a conversation
 */
export function getTurnCount(conversationId: string): number {
  const db = getDatabase();
  const result = db
    .prepare('SELECT COUNT(*) as count FROM turns WHERE conversation_id = ?')
    .get(conversationId) as { count: number };
  return result.count;
}

/**
 * Get total turn count across all conversations
 */
export function getTotalTurnCount(): number {
  const db = getDatabase();
  const result = db.prepare('SELECT COUNT(*) as count FROM turns').get() as {
    count: number;
  };
  return result.count;
}

/**
 * Get turns with thinking content (for analysis)
 */
export function getTurnsWithThinking(limit: number = 100): TurnRow[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM turns
    WHERE thinking IS NOT NULL AND thinking != ''
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(limit) as TurnRow[];
}

/**
 * Get user turns containing specific text (for pattern analysis)
 */
export function searchUserTurns(searchText: string, limit: number = 50): TurnRow[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM turns
    WHERE role = 'user' AND content LIKE ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(`%${searchText}%`, limit) as TurnRow[];
}

/**
 * Delete turns for a conversation
 */
export function deleteTurnsByConversationId(conversationId: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM turns WHERE conversation_id = ?').run(conversationId);
}

/**
 * Get token statistics for turns
 */
export function getTurnTokenStats(conversationId: string): {
  totalInput: number;
  totalOutput: number;
  avgInputPerTurn: number;
  avgOutputPerTurn: number;
} {
  const db = getDatabase();
  const result = db
    .prepare(
      `
    SELECT
      COALESCE(SUM(input_tokens), 0) as totalInput,
      COALESCE(SUM(output_tokens), 0) as totalOutput,
      COALESCE(AVG(input_tokens), 0) as avgInputPerTurn,
      COALESCE(AVG(output_tokens), 0) as avgOutputPerTurn
    FROM turns
    WHERE conversation_id = ?
  `
    )
    .get(conversationId) as {
    totalInput: number;
    totalOutput: number;
    avgInputPerTurn: number;
    avgOutputPerTurn: number;
  };
  return result;
}

/**
 * Get recent turns across all conversations
 */
export function getRecentTurns(limit: number = 100): TurnRow[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM turns
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(limit) as TurnRow[];
}
