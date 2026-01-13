import { MessageSquare, FileText, Target, Star, FolderOpen, MessageCircle } from 'lucide-react';
import { useStats } from '@/hooks/useStats';
import { useTrends } from '@/hooks/useTrends';
import StatsCard from '@/components/dashboard/StatsCard';
import VolumeTrendChart from '@/components/charts/VolumeTrendChart';

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useStats();
  const { data: trends, isLoading: trendsLoading } = useTrends({
    period: '30d',
    metric: 'volume',
    groupBy: 'day',
  });

  if (statsError) {
    return (
      <div className="card">
        <p className="text-red-400">Error loading stats: {statsError.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-app-text-primary mb-2">Dashboard</h1>
        <p className="text-app-text-secondary">Overview of your prompt analytics and performance metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard
          title="Conversations"
          value={stats?.conversations ?? 0}
          icon={MessageSquare}
          loading={statsLoading}
          color="primary"
        />
        <StatsCard
          title="User Prompts"
          value={stats?.userPrompts ?? 0}
          icon={FileText}
          loading={statsLoading}
          color="secondary"
        />
        <StatsCard
          title="Avg Effectiveness"
          value={stats?.avgEffectiveness ?? 0}
          format="percent"
          icon={Target}
          loading={statsLoading}
          color="success"
        />
        <StatsCard
          title="Avg Quality"
          value={stats?.avgQuality ?? 0}
          format="percent"
          icon={Star}
          loading={statsLoading}
          color="warning"
        />
      </div>

      {/* Volume Trend Chart */}
      <div className="card">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-app-text-primary tracking-tight">Conversation Volume</h2>
          <p className="text-sm text-app-text-tertiary mt-1">Last 30 days activity</p>
        </div>
        {trendsLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-app-border border-t-accent-primary"></div>
          </div>
        ) : trends ? (
          <VolumeTrendChart data={trends.data} trend={trends.trend} changePercent={trends.changePercent} />
        ) : (
          <div className="h-64 flex items-center justify-center">
            <p className="text-app-text-tertiary">No trend data available</p>
          </div>
        )}
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-accent-info/10 text-accent-info shadow-app-sm">
              <FolderOpen size={20} strokeWidth={2} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-app-text-secondary mb-1">Active Projects</h3>
              <p className="text-3xl font-semibold tracking-tight text-app-text-primary">
                {stats?.projects ?? 0}
              </p>
              <p className="text-xs text-app-text-tertiary mt-2">Projects with conversations</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-accent-secondary/10 text-accent-secondary shadow-app-sm">
              <MessageCircle size={20} strokeWidth={2} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-app-text-secondary mb-1">Total Turns</h3>
              <p className="text-3xl font-semibold tracking-tight text-app-text-primary">
                {stats?.turns?.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-app-text-tertiary mt-2">User + Assistant messages</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
