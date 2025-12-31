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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Insights</h2>

      {/* Summary */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-400">Conversations</p>
            <p className="text-2xl font-bold">{insights?.summary.totalConversations ?? 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Prompts</p>
            <p className="text-2xl font-bold">{insights?.summary.totalPrompts ?? 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Effectiveness</p>
            <p className="text-2xl font-bold text-accent-success">
              {((insights?.summary.overallEffectiveness ?? 0) * 100).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Quality</p>
            <p className="text-2xl font-bold text-accent-secondary">
              {((insights?.summary.overallQuality ?? 0) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Problems */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="text-accent-primary" size={20} />
            <h3 className="text-lg font-semibold">Problems</h3>
          </div>
          {insights?.problems && insights.problems.length > 0 ? (
            <ul className="space-y-3">
              {insights.problems.map((problem, i) => (
                <li key={i} className="border-l-2 border-accent-primary pl-3">
                  <p className="font-medium">{problem.title}</p>
                  <p className="text-sm text-gray-400">{problem.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">No problems detected</p>
          )}
        </div>

        {/* Improvements */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="text-accent-warning" size={20} />
            <h3 className="text-lg font-semibold">Improvements</h3>
          </div>
          {insights?.improvements && insights.improvements.length > 0 ? (
            <ul className="space-y-3">
              {insights.improvements.map((improvement, i) => (
                <li key={i} className="border-l-2 border-accent-warning pl-3">
                  <p className="font-medium">{improvement.title}</p>
                  <p className="text-sm text-gray-400">{improvement.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">No improvements suggested</p>
          )}
        </div>

        {/* Strengths */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="text-accent-success" size={20} />
            <h3 className="text-lg font-semibold">Strengths</h3>
          </div>
          {insights?.strengths && insights.strengths.length > 0 ? (
            <ul className="space-y-3">
              {insights.strengths.map((strength, i) => (
                <li key={i} className="border-l-2 border-accent-success pl-3">
                  <p className="font-medium">{strength.title}</p>
                  <p className="text-sm text-gray-400">{strength.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">No strengths identified</p>
          )}
        </div>
      </div>
    </div>
  );
}
