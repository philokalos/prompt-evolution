import { AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';
import { useInsights } from '@/hooks/useInsights';

export default function InsightsPage() {
  const { data: insights, isLoading, error } = useInsights({ period: '7d' });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="text-red-400">Error loading insights: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3 mb-2">
        <Lightbulb className="text-accent-primary" size={28} />
        <h2 className="text-3xl font-bold tracking-tight text-app-text-primary">Intelligence Insights</h2>
      </div>

      {/* Summary Stats */}
      <div className="card bg-dark-hover/30 border-dark-border shadow-inner">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">Aggregate Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase">Conversations</p>
            <p className="text-3xl font-extrabold text-app-text-primary">{insights?.summary.totalConversations ?? 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase">Total Prompts</p>
            <p className="text-3xl font-extrabold text-app-text-primary">{insights?.summary.totalPrompts ?? 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase text-accent-success">Effectiveness</p>
            <p className="text-3xl font-extrabold text-accent-success">
              {((insights?.summary.overallEffectiveness ?? 0) * 100).toFixed(1)}%
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase text-accent-secondary">Avg Quality</p>
            <p className="text-3xl font-extrabold text-accent-secondary">
              {((insights?.summary.overallQuality ?? 0) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Problems */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <AlertTriangle className="text-accent-primary" size={20} />
            <h3 className="text-lg font-bold text-app-text-primary">Critical Issues</h3>
          </div>
          <div className="space-y-4">
            {insights?.problems && insights.problems.length > 0 ? (
              insights.problems.map((problem, i) => (
                <div key={i} className="card border-l-4 border-l-accent-primary hover:translate-x-1 transition-transform">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold text-app-text-primary leading-tight">{problem.title}</h4>
                    {problem.goldenDimension && (
                      <span className="shrink-0 px-2 py-0.5 bg-accent-primary/10 text-accent-primary text-[10px] font-bold rounded-full border border-accent-primary/20 uppercase">
                        {problem.goldenDimension}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-app-text-secondary leading-relaxed">{problem.description}</p>
                </div>
              ))
            ) : (
              <div className="card py-8 text-center bg-transparent border-dashed border-dark-border">
                <p className="text-gray-500 text-sm">No critical issues detected</p>
              </div>
            )}
          </div>
        </div>

        {/* Improvements */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Lightbulb className="text-accent-warning" size={20} />
            <h3 className="text-lg font-bold text-app-text-primary">Grow Opportunities</h3>
          </div>
          <div className="space-y-4">
            {insights?.improvements && insights.improvements.length > 0 ? (
              insights.improvements.map((improvement, i) => (
                <div key={i} className="card border-l-4 border-l-accent-warning hover:translate-x-1 transition-transform">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold text-app-text-primary leading-tight">{improvement.title}</h4>
                    {improvement.goldenDimension && (
                      <span className="shrink-0 px-2 py-0.5 bg-accent-warning/10 text-accent-warning text-[10px] font-bold rounded-full border border-accent-warning/20 uppercase">
                        {improvement.goldenDimension}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-app-text-secondary leading-relaxed">{improvement.description}</p>
                </div>
              ))
            ) : (
              <div className="card py-8 text-center bg-transparent border-dashed border-dark-border">
                <p className="text-gray-500 text-sm">No improvements suggested</p>
              </div>
            )}
          </div>
        </div>

        {/* Strengths */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <CheckCircle className="text-accent-success" size={20} />
            <h3 className="text-lg font-bold text-app-text-primary">Mastered Skills</h3>
          </div>
          <div className="space-y-4">
            {insights?.strengths && insights.strengths.length > 0 ? (
              insights.strengths.map((strength, i) => (
                <div key={i} className="card border-l-4 border-l-accent-success hover:translate-x-1 transition-transform">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold text-app-text-primary leading-tight">{strength.title}</h4>
                    {strength.goldenDimension && (
                      <span className="shrink-0 px-2 py-0.5 bg-accent-success/10 text-accent-success text-[10px] font-bold rounded-full border border-accent-success/20 uppercase">
                        {strength.goldenDimension}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-app-text-secondary leading-relaxed">{strength.description}</p>
                </div>
              ))
            ) : (
              <div className="card py-8 text-center bg-transparent border-dashed border-dark-border">
                <p className="text-gray-500 text-sm">Keep up the great work!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
