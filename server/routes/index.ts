import { Router } from 'express';
import { statsRouter } from './stats.js';
import { insightsRouter } from './insights.js';
import { projectsRouter } from './projects.js';
import { trendsRouter } from './trends.js';
import { syncRouter } from './sync.js';

export const apiRouter = Router();

// Mount routes
apiRouter.use('/stats', statsRouter);
apiRouter.use('/insights', insightsRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/trends', trendsRouter);
apiRouter.use('/sync', syncRouter);

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
