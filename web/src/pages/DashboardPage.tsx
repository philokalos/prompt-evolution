import { MessageSquare, FileText, Target, Star } from 'lucide-react';
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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <h3 className="text-lg font-semibold mb-4">Conversation Volume (30 days)</h3>
        {trendsLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
          </div>
        ) : trends ? (
          <VolumeTrendChart data={trends.data} trend={trends.trend} changePercent={trends.changePercent} />
        ) : (
          <p className="text-gray-400">No trend data available</p>
        )}
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">Active Projects</h3>
          <p className="text-3xl font-bold text-accent-secondary">{stats?.projects ?? 0}</p>
          <p className="text-sm text-gray-400 mt-1">Projects with conversations</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">Total Turns</h3>
          <p className="text-3xl font-bold text-accent-primary">{stats?.turns?.toLocaleString() ?? 0}</p>
          <p className="text-sm text-gray-400 mt-1">User + Assistant messages</p>
        </div>
      </div>
    </div>
  );
}
