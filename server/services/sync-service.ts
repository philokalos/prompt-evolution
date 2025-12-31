/**
 * Sync Service
 * Handles data synchronization from Claude Code projects to the database
 */

import {
  listProjects,
  listSessions,
  parseSession,
  insertConversation,
  insertTurns,
  conversationExists,
  detectTurnSignals,
  insertQualitySignal,
  getDatabase,
  type TurnForAnalysis,
} from '../../src/index.js';

export interface SyncResult {
  imported: number;
  analyzed: number;
  skipped: number;
  errors: string[];
}

export interface SyncStatus {
  isRunning: boolean;
  lastSync: Date | null;
  lastResult: SyncResult | null;
}

let syncStatus: SyncStatus = {
  isRunning: false,
  lastSync: null,
  lastResult: null,
};

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

/**
 * Import new sessions incrementally
 */
export async function importIncremental(projectFilter?: string): Promise<SyncResult> {
  if (syncStatus.isRunning) {
    return { imported: 0, analyzed: 0, skipped: 0, errors: ['Sync already in progress'] };
  }

  syncStatus.isRunning = true;
  const result: SyncResult = { imported: 0, analyzed: 0, skipped: 0, errors: [] };

  try {
    const projects = listProjects();
    const targetProjects = projectFilter
      ? projects.filter((projectId) => projectId === projectFilter)
      : projects;

    for (const projectId of targetProjects) {
      try {
        const sessions = listSessions(projectId);

        for (const sessionId of sessions) {
          try {
            // Skip if already imported
            if (conversationExists(sessionId)) {
              result.skipped++;
              continue;
            }

            // Parse and import
            const conversation = parseSession(projectId, sessionId);
            if (conversation) {
              insertConversation(conversation);
              insertTurns(conversation.id, conversation.turns);
              result.imported++;
            }
          } catch (err) {
            result.errors.push(`Session ${sessionId}: ${String(err)}`);
          }
        }
      } catch (err) {
        result.errors.push(`Project ${projectId}: ${String(err)}`);
      }
    }

    syncStatus.lastSync = new Date();
    syncStatus.lastResult = result;
  } finally {
    syncStatus.isRunning = false;
  }

  return result;
}

/**
 * Analyze recent conversations
 */
export async function analyzeRecent(hoursBack: number = 24): Promise<SyncResult> {
  if (syncStatus.isRunning) {
    return { imported: 0, analyzed: 0, skipped: 0, errors: ['Sync already in progress'] };
  }

  syncStatus.isRunning = true;
  const result: SyncResult = { imported: 0, analyzed: 0, skipped: 0, errors: [] };

  try {
    const db = getDatabase();
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hoursBack);

    // Get recent conversations
    const conversations = db
      .prepare(
        `
        SELECT id FROM conversations
        WHERE created_at >= ?
        ORDER BY created_at DESC
      `
      )
      .all(cutoff.toISOString()) as Array<{ id: string }>;

    for (const conv of conversations) {
      try {
        // Get turns for this conversation
        const turns = db
          .prepare(
            `
            SELECT id, role, content, turn_index
            FROM turns
            WHERE conversation_id = ?
            ORDER BY turn_index ASC
          `
          )
          .all(conv.id) as Array<{
          id: string;
          role: 'user' | 'assistant';
          content: string | null;
          turn_index: number;
        }>;

        // Run signal detection on user turns
        const userTurns = turns.filter(
          (t) => t.role === 'user' && t.content
        );

        for (const turn of userTurns) {
          const turnData: TurnForAnalysis = {
            id: turn.id,
            role: 'user',
            content: turn.content!,
            turnIndex: turn.turn_index,
          };

          const signals = detectTurnSignals(turnData);

          for (const signal of signals) {
            insertQualitySignal(conv.id, signal.type, {
              turnId: turn.id,
              value: signal.confidence,
              metadata: { keywords: signal.keywords },
            });
          }
        }

        result.analyzed++;
      } catch (err) {
        result.errors.push(`Conversation ${conv.id}: ${String(err)}`);
      }
    }

    syncStatus.lastSync = new Date();
    syncStatus.lastResult = result;
  } finally {
    syncStatus.isRunning = false;
  }

  return result;
}

/**
 * Full refresh - import all and re-analyze
 */
export async function fullRefresh(projectFilter?: string): Promise<SyncResult> {
  const importResult = await importIncremental(projectFilter);
  const analyzeResult = await analyzeRecent(24 * 30); // Last 30 days

  return {
    imported: importResult.imported,
    analyzed: analyzeResult.analyzed,
    skipped: importResult.skipped,
    errors: [...importResult.errors, ...analyzeResult.errors],
  };
}
