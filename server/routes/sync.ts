import { Router } from 'express';
import {
  importIncremental,
  analyzeRecent,
  fullRefresh,
  getSyncStatus,
} from '../services/sync-service.js';
import { getSchedulerStatus, getNextScheduledSync } from '../services/scheduler.js';

export const syncRouter = Router();

type SyncMode = 'incremental' | 'analyze' | 'full';

// POST /api/sync - Trigger manual data sync
syncRouter.post('/', async (req, res, next) => {
  try {
    const { mode = 'incremental', project, hoursBack = 24 } = req.body as {
      mode?: SyncMode;
      project?: string;
      hoursBack?: number;
    };
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
