/**
 * Tool Usage Repository
 * CRUD operations for tool_usages table
 */

import { getDatabase } from '../connection.js';

export interface ToolUsageRow {
  id: number;
  turn_id: string;
  tool_name: string;
  timestamp: string | null;
}

/**
 * Insert a single tool usage
 */
export function insertToolUsage(
  turnId: string,
  toolName: string,
  timestamp?: Date
): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO tool_usages (turn_id, tool_name, timestamp)
    VALUES (?, ?, ?)
  `);

  stmt.run(turnId, toolName, timestamp?.toISOString() || null);
}

/**
 * Insert multiple tool usages for a turn (batch insert)
 */
export function insertToolUsages(
  turnId: string,
  toolNames: string[],
  timestamp?: Date
): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO tool_usages (turn_id, tool_name, timestamp)
    VALUES (?, ?, ?)
  `);

  const insertMany = db.transaction((tools: string[]) => {
    const ts = timestamp?.toISOString() || null;
    tools.forEach((toolName) => {
      stmt.run(turnId, toolName, ts);
    });
  });

  insertMany(toolNames);
}

/**
 * Get tool usages by turn ID
 */
export function getToolUsagesByTurnId(turnId: string): ToolUsageRow[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM tool_usages
    WHERE turn_id = ?
    ORDER BY id ASC
  `);
  return stmt.all(turnId) as ToolUsageRow[];
}

/**
 * Get all tool usages for a conversation (via turns)
 */
export function getToolUsagesByConversationId(
  conversationId: string
): ToolUsageRow[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT tu.* FROM tool_usages tu
    JOIN turns t ON tu.turn_id = t.id
    WHERE t.conversation_id = ?
    ORDER BY tu.id ASC
  `);
  return stmt.all(conversationId) as ToolUsageRow[];
}

/**
 * Get tool usage statistics (most used tools)
 */
export function getToolUsageStats(): Array<{ tool_name: string; count: number }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT tool_name, COUNT(*) as count
    FROM tool_usages
    GROUP BY tool_name
    ORDER BY count DESC
  `);
  return stmt.all() as Array<{ tool_name: string; count: number }>;
}

/**
 * Get tool usage count by tool name
 */
export function getToolUsageCount(toolName: string): number {
  const db = getDatabase();
  const result = db
    .prepare('SELECT COUNT(*) as count FROM tool_usages WHERE tool_name = ?')
    .get(toolName) as { count: number };
  return result.count;
}

/**
 * Get total tool usage count
 */
export function getTotalToolUsageCount(): number {
  const db = getDatabase();
  const result = db
    .prepare('SELECT COUNT(*) as count FROM tool_usages')
    .get() as { count: number };
  return result.count;
}

/**
 * Get tools used in a specific time range
 */
export function getToolUsagesInRange(
  startDate: Date,
  endDate: Date
): ToolUsageRow[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM tool_usages
    WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp DESC
  `);
  return stmt.all(
    startDate.toISOString(),
    endDate.toISOString()
  ) as ToolUsageRow[];
}

/**
 * Get tool usage patterns by project
 */
export function getToolUsageByProject(): Array<{
  project: string;
  tool_name: string;
  count: number;
}> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT c.project, tu.tool_name, COUNT(*) as count
    FROM tool_usages tu
    JOIN turns t ON tu.turn_id = t.id
    JOIN conversations c ON t.conversation_id = c.id
    GROUP BY c.project, tu.tool_name
    ORDER BY c.project, count DESC
  `);
  return stmt.all() as Array<{
    project: string;
    tool_name: string;
    count: number;
  }>;
}

/**
 * Delete tool usages by turn ID
 */
export function deleteToolUsagesByTurnId(turnId: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM tool_usages WHERE turn_id = ?').run(turnId);
}

/**
 * Get distinct tool names
 */
export function getDistinctToolNames(): string[] {
  const db = getDatabase();
  const result = db
    .prepare('SELECT DISTINCT tool_name FROM tool_usages ORDER BY tool_name')
    .all() as Array<{ tool_name: string }>;
  return result.map((r) => r.tool_name);
}

/**
 * Get tool usage trend over time (daily counts)
 */
export function getToolUsageTrend(
  toolName?: string,
  days: number = 30
): Array<{ date: string; count: number }> {
  const db = getDatabase();

  const baseQuery = `
    SELECT DATE(timestamp) as date, COUNT(*) as count
    FROM tool_usages
    WHERE timestamp >= DATE('now', '-${days} days')
    ${toolName ? 'AND tool_name = ?' : ''}
    GROUP BY DATE(timestamp)
    ORDER BY date ASC
  `;

  const stmt = db.prepare(baseQuery);
  return (toolName ? stmt.all(toolName) : stmt.all()) as Array<{
    date: string;
    count: number;
  }>;
}
