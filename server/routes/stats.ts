import { Router } from 'express';
import {
  getConversationCount,
  getTotalTurnCount,
  getProjectStats,
  getDatabase,
} from '../../src/index.js';
import { getOverallStats } from '../repositories/index.js';

export const statsRouter = Router();

// GET /api/stats - Overall database statistics
statsRouter.get('/', async (req, res, next) => {
  try {
    const db = getDatabase();

    // Get basic counts using existing functions
    const conversations = getConversationCount();
    const turns = getTotalTurnCount();
    const projects = getProjectStats().length;

    // Get detailed stats from repository
    const stats = getOverallStats(db);

    res.json({
      conversations,
      turns,
      userPrompts: stats.userPrompts,
      avgEffectiveness: stats.avgEffectiveness,
      avgQuality: stats.avgQuality,
      projects,
      lastSync: stats.lastSync,
      lastAnalysis: stats.lastAnalysis,
      goldenScores: stats.goldenScores,
    });
  } catch (error) {
    next(error);
  }
});
