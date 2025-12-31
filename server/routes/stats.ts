import { Router } from 'express';
import {
  getConversationCount,
  getTotalTurnCount,
  getProjectStats,
  getDatabase,
} from '../../src/index.js';

export const statsRouter = Router();

// GET /api/stats - Overall database statistics
statsRouter.get('/', async (req, res, next) => {
  try {
    const db = getDatabase();

    // Get basic counts
    const conversations = getConversationCount();
    const turns = getTotalTurnCount();
    const projects = getProjectStats().length;

    // Get user prompt count
    const userPromptsResult = db
      .prepare("SELECT COUNT(*) as count FROM turns WHERE role = 'user'")
      .get() as { count: number };
    const userPrompts = userPromptsResult.count;

    // Get average effectiveness (from quality_signals if available)
    const effectivenessResult = db
      .prepare(
        `
        SELECT AVG(CAST(value AS REAL)) as avgEffectiveness
        FROM quality_signals
        WHERE signal_type = 'effectiveness'
      `
      )
      .get() as { avgEffectiveness: number | null };
    const avgEffectiveness = effectivenessResult.avgEffectiveness ?? 0;

    // Get average quality (from quality_signals if available)
    const qualityResult = db
      .prepare(
        `
        SELECT AVG(CAST(value AS REAL)) as avgQuality
        FROM quality_signals
        WHERE signal_type = 'quality'
      `
      )
      .get() as { avgQuality: number | null };
    const avgQuality = qualityResult.avgQuality ?? 0;

    // Get last sync time (most recent conversation)
    const lastSyncResult = db
      .prepare(
        `
        SELECT MAX(created_at) as lastSync
        FROM conversations
      `
      )
      .get() as { lastSync: string | null };

    // Get last analysis time (most recent quality signal)
    const lastAnalysisResult = db
      .prepare(
        `
        SELECT MAX(created_at) as lastAnalysis
        FROM quality_signals
      `
      )
      .get() as { lastAnalysis: string | null };

    res.json({
      conversations,
      turns,
      userPrompts,
      avgEffectiveness: Math.round(avgEffectiveness * 100) / 100,
      avgQuality: Math.round(avgQuality * 100) / 100,
      projects,
      lastSync: lastSyncResult.lastSync,
      lastAnalysis: lastAnalysisResult.lastAnalysis,
    });
  } catch (error) {
    next(error);
  }
});
