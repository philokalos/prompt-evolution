/**
 * Quality Signal Repository
 * CRUD operations for quality_signals table
 */

import { getDatabase } from '../connection.js';
import type { SignalType } from '../../analysis/patterns.js';

export interface QualitySignalRow {
  id: number;
  conversation_id: string;
  signal_type: string;
  turn_id: string | null;
  value: number | null;
  metadata: string | null;
  created_at: string;
}

/**
 * Insert a single quality signal
 */
export function insertQualitySignal(
  conversationId: string,
  signalType: SignalType,
  options?: {
    turnId?: string;
    value?: number;
    metadata?: Record<string, unknown>;
  }
): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO quality_signals (
      conversation_id, signal_type, turn_id, value, metadata
    ) VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    conversationId,
    signalType,
    options?.turnId || null,
    options?.value || null,
    options?.metadata ? JSON.stringify(options.metadata) : null
  );
}

/**
 * Insert multiple quality signals (batch)
 */
export function insertQualitySignals(
  conversationId: string,
  signals: Array<{
    signalType: SignalType;
    turnId?: string;
    value?: number;
    metadata?: Record<string, unknown>;
  }>
): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO quality_signals (
      conversation_id, signal_type, turn_id, value, metadata
    ) VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction(
    (
      items: Array<{
        signalType: SignalType;
        turnId?: string;
        value?: number;
        metadata?: Record<string, unknown>;
      }>
    ) => {
      for (const signal of items) {
        stmt.run(
          conversationId,
          signal.signalType,
          signal.turnId || null,
          signal.value || null,
          signal.metadata ? JSON.stringify(signal.metadata) : null
        );
      }
    }
  );

  insertMany(signals);
}

/**
 * Get signals by conversation ID
 */
export function getSignalsByConversationId(
  conversationId: string
): QualitySignalRow[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM quality_signals
    WHERE conversation_id = ?
    ORDER BY id ASC
  `);
  return stmt.all(conversationId) as QualitySignalRow[];
}

/**
 * Get signals by type
 */
export function getSignalsByType(signalType: SignalType): QualitySignalRow[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM quality_signals
    WHERE signal_type = ?
    ORDER BY created_at DESC
  `);
  return stmt.all(signalType) as QualitySignalRow[];
}

/**
 * Get signal statistics
 */
export function getSignalStats(): Array<{ signal_type: string; count: number }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT signal_type, COUNT(*) as count
    FROM quality_signals
    GROUP BY signal_type
    ORDER BY count DESC
  `);
  return stmt.all() as Array<{ signal_type: string; count: number }>;
}

/**
 * Get total signal count
 */
export function getTotalSignalCount(): number {
  const db = getDatabase();
  const result = db
    .prepare('SELECT COUNT(*) as count FROM quality_signals')
    .get() as { count: number };
  return result.count;
}

/**
 * Get conversations with effectiveness score
 */
export function getConversationsWithEffectiveness(): Array<{
  conversation_id: string;
  effectiveness: number;
}> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT conversation_id, value as effectiveness
    FROM quality_signals
    WHERE signal_type = 'effectiveness_score'
    ORDER BY value DESC
  `);
  return stmt.all() as Array<{
    conversation_id: string;
    effectiveness: number;
  }>;
}

/**
 * Save effectiveness score for a conversation
 */
export function saveEffectivenessScore(
  conversationId: string,
  score: number,
  components: Record<string, number>
): void {
  // Delete existing effectiveness score if any
  const db = getDatabase();
  db.prepare(
    "DELETE FROM quality_signals WHERE conversation_id = ? AND signal_type = 'effectiveness_score'"
  ).run(conversationId);

  // Insert new score
  insertQualitySignal(conversationId, 'positive_feedback', {
    value: score,
    metadata: { type: 'effectiveness_score', components },
  });
}

/**
 * Get signal distribution by project
 */
export function getSignalDistributionByProject(): Array<{
  project: string;
  signal_type: string;
  count: number;
}> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT c.project, qs.signal_type, COUNT(*) as count
    FROM quality_signals qs
    JOIN conversations c ON qs.conversation_id = c.id
    GROUP BY c.project, qs.signal_type
    ORDER BY c.project, count DESC
  `);
  return stmt.all() as Array<{
    project: string;
    signal_type: string;
    count: number;
  }>;
}

/**
 * Delete signals for a conversation
 */
export function deleteSignalsByConversationId(conversationId: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM quality_signals WHERE conversation_id = ?').run(
    conversationId
  );
}

/**
 * Check if conversation has been analyzed
 */
export function hasBeenAnalyzed(conversationId: string): boolean {
  const db = getDatabase();
  const result = db
    .prepare('SELECT 1 FROM quality_signals WHERE conversation_id = ? LIMIT 1')
    .get(conversationId);
  return result !== undefined;
}

/**
 * Get average effectiveness by project
 */
export function getAverageEffectivenessByProject(): Array<{
  project: string;
  avg_effectiveness: number;
  conversation_count: number;
}> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT
      c.project,
      AVG(qs.value) as avg_effectiveness,
      COUNT(DISTINCT c.id) as conversation_count
    FROM quality_signals qs
    JOIN conversations c ON qs.conversation_id = c.id
    WHERE qs.signal_type = 'positive_feedback' AND qs.metadata LIKE '%effectiveness_score%'
    GROUP BY c.project
    ORDER BY avg_effectiveness DESC
  `);
  return stmt.all() as Array<{
    project: string;
    avg_effectiveness: number;
    conversation_count: number;
  }>;
}
