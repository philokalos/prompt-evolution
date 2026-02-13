import { Router } from 'express';
import { z } from 'zod';
import {
  importIncremental,
  analyzeRecent,
  fullRefresh,
  getSyncStatus,
} from '../services/sync-service.js';
import { getSchedulerStatus, getNextScheduledSync } from '../services/scheduler.js';

export const syncRouter = Router();

const syncBodySchema = z.object({
  mode: z.enum(['incremental', 'analyze', 'full']).default('incremental'),
  project: z.string().max(200).regex(/^[\w\s./-]+$/).optional(),
  hoursBack: z.number().int().min(1).max(720).default(24),
});

// POST /api/sync - Trigger manual data sync
syncRouter.post('/', async (req, res, next) => {
  try {
    const parsed = syncBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }
    const { mode, project, hoursBack } = parsed.data;
    const startTime = Date.now();

    let result;

    switch (mode) {
      case 'incremental':
        result = await importIncremental(project);
        break;
      case 'analyze':
        result = await analyzeRecent(hoursBack);
        break;
      case 'full':
        result = await fullRefresh(project);
        break;
      default:
        result = await importIncremental(project);
    }

    res.json({
      success: result.errors.length === 0,
      mode,
      project: project || null,
      imported: result.imported,
      analyzed: result.analyzed,
      skipped: result.skipped,
      errors: result.errors,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sync/status - Get sync status
syncRouter.get('/status', async (req, res, next) => {
  try {
    const syncStatus = getSyncStatus();
    const schedulerStatus = getSchedulerStatus();
    const nextSync = getNextScheduledSync();

    res.json({
      isRunning: syncStatus.isRunning,
      lastSync: syncStatus.lastSync?.toISOString() || null,
      lastResult: syncStatus.lastResult,
      nextScheduledSync: nextSync?.toISOString() || null,
      scheduler: schedulerStatus,
    });
  } catch (error) {
    next(error);
  }
});
