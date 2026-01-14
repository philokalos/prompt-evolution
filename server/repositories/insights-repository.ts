/**
 * Insights Repository
 * Database queries for insights endpoints
 */

import type { Database } from 'better-sqlite3';
import type { PromptData } from '../../src/index.js';

/**
 * Get prompt data from conversations
 */
export function getPromptDataFromConversations(
  db: Database,
  conversationIds: string[]
): PromptData[] {
  if (conversationIds.length === 0) return [];

  // Create placeholders for IN clause
  const placeholders = conversationIds.map(() => '?').join(',');

  const turns = db
    .prepare(
      `
      SELECT t.content, t.conversation_id, t.timestamp
      FROM turns t
      WHERE t.role = 'user'
        AND t.conversation_id IN (${placeholders})
        AND t.content IS NOT NULL
        AND t.content != ''
      ORDER BY t.timestamp DESC
    `
    )
    .all(...conversationIds) as Array<{
    content: string;
    conversation_id: string;
    timestamp: string;
  }>;

  return turns.map((t) => ({
    content: t.content,
    conversationId: t.conversation_id,
    timestamp: t.timestamp ? new Date(t.timestamp) : undefined,
    effectiveness: undefined, // Could be enhanced with quality_signals data
  }));
}
