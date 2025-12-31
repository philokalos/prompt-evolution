// API Client for Prompt Evolution Dashboard

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Types
export interface StatsResponse {
  conversations: number;
  turns: number;
  userPrompts: number;
  avgEffectiveness: number;
  avgQuality: number;
  projects: number;
  lastSync: string | null;
  lastAnalysis: string | null;
}

export interface ProjectResponse {
  id: string;
  path: string;
  displayName: string;
  conversationCount: number;
  lastActive: string | null;
  avgEffectiveness: number;
}

export interface TrendDataPoint {
  date: string;
  value: number;
  count: number;
}

export interface TrendsResponse {
  metric: 'effectiveness' | 'quality' | 'volume';
  period: string;
  groupBy: 'day' | 'week' | 'month';
  data: TrendDataPoint[];
  trend: 'improving' | 'declining' | 'stable';
  changePercent: number;
}

export interface SyncStatusResponse {
  isRunning: boolean;
  lastSync: string | null;
  lastResult: {
    imported: number;
    analyzed: number;
    skipped: number;
    errors: string[];
  } | null;
  nextScheduledSync: string | null;
  scheduler: {
    isEnabled: boolean;
    schedules: Array<{
      name: string;
      nextInvocation: string | null;
      lastRun: string | null;
      isActive: boolean;
    }>;
  };
}

export interface SyncTriggerResponse {
  success: boolean;
  mode: string;
  project: string | null;
  imported: number;
  analyzed: number;
  skipped: number;
  errors: string[];
  duration: number;
}

export interface InsightItem {
  title: string;
  description: string;
  evidence: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface InsightsResponse {
  generatedAt: string;
  period: string;
  summary: {
    totalConversations: number;
    totalPrompts: number;
    overallEffectiveness: number;
    overallQuality: number;
  };
  problems: InsightItem[];
  improvements: InsightItem[];
  strengths: InsightItem[];
  categoryBreakdown: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  recommendations: Array<{
    priority: number;
    recommendation: string;
    impact: string;
    effort: string;
  }>;
  promptLibrary: unknown;
  guidelinesSummary: unknown;
  selfImprovement: unknown;
}

// API functions
export async function fetchStats(): Promise<StatsResponse> {
  return fetchJson<StatsResponse>('/stats');
}

export async function fetchProjects(): Promise<{ projects: ProjectResponse[] }> {
  return fetchJson<{ projects: ProjectResponse[] }>('/projects');
}

export async function fetchTrends(params?: {
  period?: string;
  metric?: string;
  groupBy?: string;
}): Promise<TrendsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.period) searchParams.set('period', params.period);
  if (params?.metric) searchParams.set('metric', params.metric);
  if (params?.groupBy) searchParams.set('groupBy', params.groupBy);

  const query = searchParams.toString();
  return fetchJson<TrendsResponse>(`/trends${query ? `?${query}` : ''}`);
}

export async function fetchInsights(params?: {
  period?: string;
  project?: string;
  category?: string;
  focus?: string;
}): Promise<InsightsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.period) searchParams.set('period', params.period);
  if (params?.project) searchParams.set('project', params.project);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.focus) searchParams.set('focus', params.focus);

  const query = searchParams.toString();
  return fetchJson<InsightsResponse>(`/insights${query ? `?${query}` : ''}`);
}

export async function fetchSyncStatus(): Promise<SyncStatusResponse> {
  return fetchJson<SyncStatusResponse>('/sync/status');
}

export async function triggerSync(params?: {
  mode?: 'incremental' | 'analyze' | 'full';
  project?: string;
  hoursBack?: number;
}): Promise<SyncTriggerResponse> {
  return fetchJson<SyncTriggerResponse>('/sync', {
    method: 'POST',
    body: JSON.stringify(params || {}),
  });
}
