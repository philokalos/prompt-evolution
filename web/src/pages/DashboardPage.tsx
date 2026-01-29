import { MessageSquare, FileText, Target, Star, FolderOpen, MessageCircle, TrendingUp, Sparkles } from 'lucide-react';
import { useStats } from '@/hooks/useStats';
import { useTrends } from '@/hooks/useTrends';
import { useInsights } from '@/hooks/useInsights';
import StatsCard from '@/components/dashboard/StatsCard';
import VolumeTrendChart from '@/components/charts/VolumeTrendChart';
import GoldenRadar from '@/components/charts/GoldenRadar';
import EvolutionCard from '@/components/dashboard/EvolutionCard';

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useStats();
  const { data: insights, isLoading: insightsLoading } = useInsights({ period: '30d' });
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

  const rewriteExamples = insights?.selfImprovement?.rewriteExamples || [];

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="text-accent-primary" size={24} />
            <h1 className="text-3xl font-bold tracking-tight text-app-text-primary">Dashboard</h1>
          </div>
          <p className="text-app-text-secondary">Track your prompter growth and evolution analytics</p>
        </div>
        <div className="px-4 py-2 bg-dark-hover border border-dark-border rounded-xl flex items-center gap-3 shadow-inner">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Prompter Level</p>
            <p className="text-sm font-bold text-app-text-primary">Master Strategist</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-accent-primary/20 border border-accent-primary flex items-center justify-center text-accent-primary font-bold shadow-[0_0_10px_-2px_var(--accent-primary)]">
            Lvl 8
          </div>
        </div>
      </div>

      {/* Main Grid: Stats & Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Stats & Trends */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <StatsCard
              title="Avg Effectiveness"
              value={stats?.avgEffectiveness ?? 0}
              format="percent"
              icon={Target}
              loading={statsLoading}
              color="primary"
            />
            <StatsCard
              title="Avg Quality"
              value={stats?.avgQuality ?? 0}
              format="percent"
              icon={Star}
              loading={statsLoading}
              color="secondary"
            />
            <StatsCard
              title="Evolution Rate"
              value={12.5}
              format="percent"
              icon={TrendingUp}
              loading={statsLoading}
              color="success"
            />
          </div>

          <div className="card">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-app-text-primary tracking-tight">Conversation Volume</h2>
              <p className="text-sm text-app-text-tertiary mt-1">Activity trend for the last 30 days</p>
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
        </div>

        {/* Right: GOLDEN Radar */}
        <div className="card flex flex-col">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="text-accent-primary" size={18} />
              <h2 className="text-xl font-semibold text-app-text-primary tracking-tight">Prompter DNA</h2>
            </div>
            <p className="text-sm text-app-text-tertiary">Your aggregate GOLDEN score profile</p>
          </div>
          <div className="flex-1 flex items-center justify-center py-4">
            {statsLoading ? (
              <div className="animate-pulse w-full h-48 bg-dark-hover rounded-full"></div>
            ) : stats?.goldenScores ? (
              <GoldenRadar scores={stats.goldenScores} />
            ) : (
              <p className="text-app-text-tertiary text-sm italic">Analyze more prompts to see your profile</p>
            )}
          </div>
          <div className="mt-6 p-4 bg-accent-primary/5 rounded-2xl border border-accent-primary/10">
            <h4 className="text-xs font-bold text-app-text-secondary mb-1 uppercase tracking-widest">Mastery Tip</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Your <b>Limits</b> score is slightly low. Try explicitly stating what you <i>don't</i> want in your prompts.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom: Evolution Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-accent-secondary" size={20} />
            <h2 className="text-2xl font-bold text-app-text-primary">Recent Evolutions</h2>
          </div>
          <p className="text-sm text-app-text-tertiary">Success stories from your prompt history</p>
        </div>

        {insightsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => <div key={i} className="h-48 card animate-pulse bg-dark-hover"></div>)}
          </div>
        ) : rewriteExamples.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rewriteExamples.slice(0, 2).map((example, i) => (
              <EvolutionCard key={i} example={example} />
            ))}
          </div>
        ) : (
          <div className="card py-12 text-center">
            <Sparkles className="mx-auto text-gray-700 mb-4" size={48} />
            <p className="text-gray-400">Start evolving your prompts to see success stories here</p>
          </div>
        )}
      </div>

      {/* Quick Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-accent-info/10 text-accent-info shadow-app-sm">
              <FolderOpen size={20} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-app-text-secondary mb-1">Active Projects</h3>
              <p className="text-2xl font-bold tracking-tight text-app-text-primary">{stats?.projects ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-accent-secondary/10 text-accent-secondary shadow-app-sm">
              <MessageCircle size={20} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-app-text-secondary mb-1">Total Turns</h3>
              <p className="text-2xl font-bold tracking-tight text-app-text-primary">{stats?.turns?.toLocaleString() ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-accent-primary/10 text-accent-primary shadow-app-sm">
              <MessageSquare size={20} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-app-text-secondary mb-1">Conversations</h3>
              <p className="text-2xl font-bold tracking-tight text-app-text-primary">{stats?.conversations ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-accent-warning/10 text-accent-warning shadow-app-sm">
              <FileText size={20} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-app-text-secondary mb-1">User Prompts</h3>
              <p className="text-2xl font-bold tracking-tight text-app-text-primary">{stats?.userPrompts ?? 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
