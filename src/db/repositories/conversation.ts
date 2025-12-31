/**
 * Conversation Repository
 * CRUD operations for conversations table
 */

import { getDatabase } from '../connection.js';
import type { ParsedConversation } from '../../types/index.js';

export interface ConversationRow {
  id: string;
  project: string;
  project_path: string | null;
  model: string | null;
  started_at: string | null;
  ended_at: string | null;
  total_input_tokens: number;
  total_output_tokens: number;
  turn_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Insert a new conversation
 */
export function insertConversation(conversation: ParsedConversation): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO conversations (
      id, project, project_path, model,
      started_at, ended_at,
      total_input_tokens, total_output_tokens,
      turn_count, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  stmt.run(
    conversation.id,
    conversation.project,
    conversation.projectPath,
    conversation.model,
    conversation.startedAt.toISOString(),
    conversation.endedAt.toISOString(),
    conversation.totalInputTokens,
    conversation.totalOutputTokens,
    conversation.turns.length
  );
}

/**
 * Get conversation by ID
 */
export function getConversationById(id: string): ConversationRow | undefined {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
  return stmt.get(id) as ConversationRow | undefined;
}

/**
 * Get all conversations
 */
export function getAllConversations(options?: {
  limit?: number;
  offset?: number;
  orderBy?: 'started_at' | 'created_at' | 'turn_count';
  order?: 'ASC' | 'DESC';
}): ConversationRow[] {
  const db = getDatabase();
  const orderBy = options?.orderBy || 'started_at';
  const order = options?.order || 'DESC';
  const limit = options?.limit || 100;
  const offset = options?.offset || 0;

  const stmt = db.prepare(`
    SELECT * FROM conversations
    ORDER BY ${orderBy} ${order}
    LIMIT ? OFFSET ?
  `);

  return stmt.all(limit, offset) as ConversationRow[];
}

/**
 * Get conversations by project
 */
export function getConversationsByProject(project: string): ConversationRow[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM conversations
    WHERE project = ?
    ORDER BY started_at DESC
  `);
  return stmt.all(project) as ConversationRow[];
}

/**
 * Get conversation count
 */
export function getConversationCount(): number {
  const db = getDatabase();
  const result = db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number };
  return result.count;
}

/**
 * Get total token usage
 */
export function getTotalTokenUsage(): { input: number; output: number } {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT
      COALESCE(SUM(total_input_tokens), 0) as input,
      COALESCE(SUM(total_output_tokens), 0) as output
    FROM conversations
  `).get() as { input: number; output: number };
  return result;
}

/**
 * Check if conversation exists
 */
export function conversationExists(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('SELECT 1 FROM conversations WHERE id = ?').get(id);
  return result !== undefined;
}

/**
 * Delete conversation
 */
export function deleteConversation(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
}

/**
 * Get projects with conversation counts
 */
export function getProjectStats(): Array<{ project: string; project_path: string; count: number }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT
      project,
      project_path,
      COUNT(*) as count
    FROM conversations
    GROUP BY project
    ORDER BY count DESC
  `);
  return stmt.all() as Array<{ project: string; project_path: string; count: number }>;
}

/**
 * Get conversations in date range
 */
export function getConversationsInRange(startDate: Date, endDate: Date): ConversationRow[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM conversations
    WHERE started_at >= ? AND started_at <= ?
    ORDER BY started_at DESC
  `);
  return stmt.all(startDate.toISOString(), endDate.toISOString()) as ConversationRow[];
}
