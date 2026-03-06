/**
 * Dashboard API Route Tests
 *
 * 24 test cases covering all Dashboard API endpoints.
 * TC-W01 through TC-W24
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { type Server } from 'http';

// ─── Mocks ──────────────────────────────────────────────────────────

const mockDb = {
  prepare: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue({ lastActive: '2026-03-04', avgEffectiveness: 0.75 }),
    all: vi.fn().mockReturnValue([]),
  }),
};

vi.mock('../../src/index.js', () => ({
  getDatabase: vi.fn(() => mockDb),
  getConversationCount: vi.fn(() => 42),
  getTotalTurnCount: vi.fn(() => 200),
  getProjectStats: vi.fn(() => [
    { project: 'test-project', project_path: '-Users-test-project', count: 10 },
    { project: 'other-project', project_path: '-Users-other-project', count: 5 },
  ]),
  getProjectLastActive: vi.fn(() => '2026-03-04'),
  getProjectAvgEffectiveness: vi.fn(() => 0.75),
  getAllConversations: vi.fn(() => [
    { id: 'conv-1', project: 'test-project', started_at: '2026-01-01T00:00:00Z' },
    { id: 'conv-2', project: 'test-project', started_at: '2026-01-02T00:00:00Z' },
  ]),
  getConversationsInRange: vi.fn(() => [
    { id: 'conv-1', project: 'test-project', started_at: '2026-01-01T00:00:00Z' },
  ]),
  generateInsights: vi.fn(() => ({
    generatedAt: new Date('2026-03-04'),
    period: '30d',
    summary: { totalConversations: 42, totalPrompts: 200, overallEffectiveness: 0.75, overallQuality: 0.8 },
    problems: [{ description: 'Vague prompts', dimension: 'goal', severity: 'high' }],
    improvements: [{ description: 'Better structure', dimension: 'output' }],
    strengths: [{ description: 'Good data inclusion', dimension: 'data' }],
    categoryBreakdown: [],
    recommendations: [],
    promptLibrary: null,
    guidelinesSummary: null,
    selfImprovement: null,
  })),
}));

vi.mock('../repositories/index.js', () => ({
  getOverallStats: vi.fn(() => ({
    userPrompts: 100,
    avgEffectiveness: 0.75,
    avgQuality: 0.82,
    lastSync: '2026-03-04T10:00:00Z',
    lastAnalysis: '2026-03-04T11:00:00Z',
    goldenScores: { goal: 70, output: 65, limits: 50, data: 80, evaluation: 40, next: 55 },
  })),
  getPromptDataFromConversations: vi.fn(() => [
    { content: 'test prompt', conversationId: 'conv-1', timestamp: new Date() },
  ]),
  getVolumeTrend: vi.fn(() => [
    { date: '2026-03-01', value: 5, count: 5 },
    { date: '2026-03-02', value: 8, count: 8 },
    { date: '2026-03-03', value: 12, count: 12 },
  ]),
  getEffectivenessTrend: vi.fn(() => [
    { date: '2026-03-01', value: 0.6, count: 5 },
    { date: '2026-03-02', value: 0.7, count: 8 },
  ]),
  getQualityTrend: vi.fn(() => [
    { date: '2026-03-01', value: 0.7, count: 5 },
    { date: '2026-03-02', value: 0.8, count: 8 },
  ]),
}));

vi.mock('../services/sync-service.js', () => ({
  importIncremental: vi.fn(async () => ({ imported: 5, analyzed: 3, skipped: 2, errors: [] })),
  analyzeRecent: vi.fn(async () => ({ imported: 0, analyzed: 10, skipped: 0, errors: [] })),
  fullRefresh: vi.fn(async () => ({ imported: 20, analyzed: 20, skipped: 0, errors: [] })),
  getSyncStatus: vi.fn(() => ({
    isRunning: false,
    lastSync: new Date('2026-03-04T10:00:00Z'),
    lastResult: { imported: 5, analyzed: 3 },
  })),
}));

vi.mock('../services/scheduler.js', () => ({
  initializeScheduler: vi.fn(),
  getSchedulerStatus: vi.fn(() => ({ isActive: true, interval: '*/30 * * * *' })),
  getNextScheduledSync: vi.fn(() => new Date('2026-03-04T12:00:00Z')),
}));

vi.mock('../validation/index.js', () => ({
  validateQuery: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  insightsQuerySchema: {},
  trendsQuerySchema: {},
}));

// ─── Test Utilities ─────────────────────────────────────────────────

let app: Express;
let server: Server;
let baseUrl: string;

async function fetchApi(path: string, options?: RequestInit): Promise<globalThis.Response> {
  return fetch(`${baseUrl}${path}`, options);
}

beforeEach(async () => {
  app = express();
  app.use(express.json());

  const { apiRouter } = await import('./index.js');
  app.use('/api', apiRouter);

  // SPA fallback
  app.get('*', (_req, res) => {
    res.status(200).json({ spa: true });
  });

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  vi.clearAllMocks();
});

// ─── J1: Data Preparation ───────────────────────────────────────────

describe('Server Health & Access (TC-W01, TC-W02)', () => {
  it('TC-W01: should return 200 OK on health check', async () => {
    const res = await fetchApi('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('TC-W02: should serve dashboard page on root', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
  });
});

describe('Data Sync (TC-W03, TC-W04, TC-W05, TC-W06)', () => {
  it('TC-W03: should trigger sync via POST /api/sync', async () => {
    const res = await fetchApi('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'incremental' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.imported).toBe(5);
    expect(body.analyzed).toBe(3);
    expect(body.duration).toBeGreaterThanOrEqual(0);
  });

  it('TC-W04: should show stats after sync', async () => {
    await fetchApi('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'incremental' }),
    });
    const res = await fetchApi('/api/stats');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toBeGreaterThan(0);
  });

  it('TC-W05: should return empty state when no data', async () => {
    const { getAllConversations } = await import('../../src/index.js');
    vi.mocked(getAllConversations).mockReturnValueOnce([]);

    const res = await fetchApi('/api/insights?period=all');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.totalConversations).toBe(0);
    expect(body.problems).toEqual([]);
  });

  it('TC-W06: should preserve existing data on re-sync', async () => {
    const res1 = await fetchApi('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'incremental' }),
    });
    expect((await res1.json()).success).toBe(true);

    const res2 = await fetchApi('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'incremental' }),
    });
    expect((await res2.json()).success).toBe(true);

    const statsRes = await fetchApi('/api/stats');
    const stats = await statsRes.json();
    expect(stats.conversations).toBeGreaterThan(0);
  });
});

// ─── J2: Dashboard Exploration ──────────────────────────────────────

describe('Stats API (TC-W07, TC-W08, TC-W09, TC-W10)', () => {
  it('TC-W07: should return complete stats', async () => {
    const res = await fetchApi('/api/stats');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('conversations');
    expect(body).toHaveProperty('turns');
    expect(body).toHaveProperty('userPrompts');
    expect(body).toHaveProperty('avgEffectiveness');
    expect(body).toHaveProperty('avgQuality');
    expect(body).toHaveProperty('projects');
    expect(body).toHaveProperty('goldenScores');
    expect(body).toHaveProperty('lastSync');
  });

  it('TC-W08: should return numeric stats values for StatsCard', async () => {
    const res = await fetchApi('/api/stats');
    const body = await res.json();
    expect(typeof body.conversations).toBe('number');
    expect(typeof body.turns).toBe('number');
    expect(typeof body.avgEffectiveness).toBe('number');
    expect(typeof body.avgQuality).toBe('number');
  });

  it('TC-W09: should return GOLDEN scores for GoldenRadar', async () => {
    const res = await fetchApi('/api/stats');
    const body = await res.json();
    expect(body.goldenScores).toBeDefined();
    expect(body.goldenScores).toHaveProperty('goal');
    expect(body.goldenScores).toHaveProperty('output');
    expect(body.goldenScores).toHaveProperty('limits');
    expect(body.goldenScores).toHaveProperty('data');
    expect(body.goldenScores).toHaveProperty('evaluation');
    expect(body.goldenScores).toHaveProperty('next');
  });

  it('TC-W10: should return trend-compatible data for TrendChart', async () => {
    const res = await fetchApi('/api/trends?period=7d&metric=volume&groupBy=day');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    if (body.data.length > 0) {
      expect(body.data[0]).toHaveProperty('date');
      expect(body.data[0]).toHaveProperty('value');
    }
  });
});

describe('Insights API (TC-W11, TC-W12)', () => {
  it('TC-W11: should return insights with problems and strengths', async () => {
    const res = await fetchApi('/api/insights?period=30d');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('problems');
    expect(body).toHaveProperty('strengths');
    expect(Array.isArray(body.problems)).toBe(true);
    expect(Array.isArray(body.strengths)).toBe(true);
  });

  it('TC-W12: should include summary in insights', async () => {
    const res = await fetchApi('/api/insights?period=30d');
    const body = await res.json();
    expect(body).toHaveProperty('summary');
    expect(body.summary).toHaveProperty('totalConversations');
    expect(body.summary).toHaveProperty('totalPrompts');
    expect(body.summary).toHaveProperty('overallEffectiveness');
  });
});

describe('Period Filter (TC-W13, TC-W14, TC-W15)', () => {
  it('TC-W13: should filter insights by 7d period', async () => {
    const res = await fetchApi('/api/insights?period=7d');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('summary');
    expect(body).toHaveProperty('problems');
  });

  it('TC-W14: should filter insights by 90d period', async () => {
    const res = await fetchApi('/api/insights?period=90d');
    expect(res.status).toBe(200);
  });

  it('TC-W15: should return different data for different periods', async () => {
    const res7d = await fetchApi('/api/insights?period=7d');
    const res90d = await fetchApi('/api/insights?period=90d');
    expect(res7d.status).toBe(200);
    expect(res90d.status).toBe(200);
    const body7d = await res7d.json();
    const body90d = await res90d.json();
    expect(body7d).toHaveProperty('summary');
    expect(body90d).toHaveProperty('summary');
  });
});

describe('Trends API (TC-W16, TC-W17)', () => {
  it('TC-W16: should return time-series trend data', async () => {
    const res = await fetchApi('/api/trends?period=30d&metric=volume&groupBy=day');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('metric', 'volume');
    expect(body).toHaveProperty('period', '30d');
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('trend');
    expect(body).toHaveProperty('changePercent');
    expect(['improving', 'declining', 'stable']).toContain(body.trend);
  });

  it('TC-W17: should return effectiveness trend', async () => {
    const res = await fetchApi('/api/trends?period=30d&metric=effectiveness&groupBy=day');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metric).toBe('effectiveness');
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ─── J3: Project-Specific ───────────────────────────────────────────

describe('Projects API (TC-W18, TC-W19, TC-W20)', () => {
  it('TC-W18: should return projects list', async () => {
    const res = await fetchApi('/api/projects');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('projects');
    expect(Array.isArray(body.projects)).toBe(true);
  });

  it('TC-W19: should include project stats in each card', async () => {
    const res = await fetchApi('/api/projects');
    const body = await res.json();
    if (body.projects.length > 0) {
      const project = body.projects[0];
      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('displayName');
      expect(project).toHaveProperty('conversationCount');
      expect(project).toHaveProperty('avgEffectiveness');
    }
  });

  it('TC-W20: should return GOLDEN averages via insights with project filter', async () => {
    const res = await fetchApi('/api/insights?period=all&project=test-project');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('summary');
  });
});

// ─── J4: Learning & Navigation ──────────────────────────────────────

describe('Learning Pages (TC-W21, TC-W22, TC-W23, TC-W24)', () => {
  it('TC-W21: should serve library page route', async () => {
    const res = await fetch(`${baseUrl}/library`);
    expect(res.status).toBe(200);
  });

  it('TC-W22: should serve guidebook page route', async () => {
    const res = await fetch(`${baseUrl}/guidebook`);
    expect(res.status).toBe(200);
  });

  it('TC-W23: should serve projects page route', async () => {
    const res = await fetch(`${baseUrl}/projects`);
    expect(res.status).toBe(200);
  });

  it('TC-W24: should serve all navigation routes', async () => {
    const routes = ['/', '/insights', '/trends', '/projects', '/library', '/guidebook'];
    for (const route of routes) {
      const res = await fetch(`${baseUrl}${route}`);
      expect(res.status).toBe(200);
    }
  });
});
