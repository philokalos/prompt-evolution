import { useState, useMemo } from 'react';
import { useInsights } from '@/hooks/useInsights';
import WeaknessCard from '@/components/guidebook/WeaknessCard';
import PromptComparison from '@/components/guidebook/PromptComparison';
import WeeklyGoalCard from '@/components/guidebook/WeeklyGoalCard';
import ProgressChart from '@/components/guidebook/ProgressChart';
import { AlertTriangle, FileEdit, Target, TrendingUp, Filter } from 'lucide-react';
import type { TaskCategory } from '@/api/client';

const categoryLabels: Record<TaskCategory, string> = {
  'code-generation': 'Code Generation',
  'code-review': 'Code Review',
  'bug-fix': 'Bug Fix',
  'refactoring': 'Refactoring',
  'explanation': 'Explanation',
  'documentation': 'Documentation',
  'testing': 'Testing',
  'architecture': 'Architecture',
  'deployment': 'Deployment',
  'data-analysis': 'Data Analysis',
  'general': 'General',
  'unknown': 'Unknown',
};

export default function GuidebookPage() {
  const { data: insights, isLoading, error } = useInsights({ period: '30d' });
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | 'all'>('all');

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
        <p className="text-red-400">Error loading guidebook data: {error.message}</p>
      </div>
    );
  }

  const selfImprovement = insights?.selfImprovement;

  if (!selfImprovement) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">My Guidebook</h2>
        <div className="card">
          <p className="text-gray-400">
            No self-improvement data available yet. Import and analyze more conversations to get personalized feedback.
          </p>
        </div>
      </div>
    );
  }

  const topWeaknesses = selfImprovement.areasForImprovement.slice(0, 3);
  const allExamples = selfImprovement.rewriteExamples;
  const weeklyGoals = selfImprovement.weeklyGoals;
  const progressTrend = selfImprovement.progressTrend;
  const summary = selfImprovement.summary;

  // Get unique categories from examples
  const availableCategories = useMemo(() => {
    const categories = new Set(allExamples.map(e => e.category));
    return Array.from(categories).sort();
  }, [allExamples]);

  // Filter examples by selected category
  const filteredExamples = useMemo(() => {
    if (selectedCategory === 'all') return allExamples;
    return allExamples.filter(e => e.category === selectedCategory);
  }, [allExamples, selectedCategory]);

  // Category distribution stats
  const categoryStats = useMemo(() => {
    const stats = new Map<TaskCategory, number>();
    for (const example of allExamples) {
      stats.set(example.category, (stats.get(example.category) || 0) + 1);
    }
    return stats;
  }, [allExamples]);

  return (
    <div className="space-y-8">
      {/* Header with Grade */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Guidebook</h2>
          <p className="text-gray-400 mt-1">{summary.mainMessage}</p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`text-4xl font-bold ${
              summary.overallGrade === 'A'
                ? 'text-accent-success'
                : summary.overallGrade === 'B'
                ? 'text-blue-400'
                : summary.overallGrade === 'C'
                ? 'text-accent-warning'
                : 'text-accent-primary'
            }`}
          >
            {summary.overallGrade}
          </div>
          <div className="text-sm text-gray-400">Overall Grade</div>
        </div>
      </div>

      {/* Section 1: Top Weaknesses */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="text-accent-primary" size={24} />
          <h3 className="text-xl font-semibold">Top 3 Weaknesses</h3>
        </div>
        {topWeaknesses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topWeaknesses.map((weakness, index) => (
              <WeaknessCard key={index} weakness={weakness} rank={index + 1} />
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="text-gray-400">No significant weaknesses detected. Keep up the good work!</p>
          </div>
        )}
      </section>

      {/* Section 2: Prompt Corrections */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileEdit className="text-accent-secondary" size={24} />
            <h3 className="text-xl font-semibold">Prompt Corrections</h3>
            <span className="text-sm text-gray-500">
              ({filteredExamples.length} of {allExamples.length} examples)
            </span>
          </div>
        </div>

        {/* Category Filter */}
        {allExamples.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="text-gray-400" size={16} />
              <span className="text-sm text-gray-400">Filter by category:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-accent-secondary text-white'
                    : 'bg-dark-hover text-gray-400 hover:text-gray-200'
                }`}
              >
                All ({allExamples.length})
              </button>
              {availableCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-accent-secondary text-white'
                      : 'bg-dark-hover text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {categoryLabels[cat]} ({categoryStats.get(cat) || 0})
                </button>
              ))}
            </div>
          </div>
        )}

        {filteredExamples.length > 0 ? (
          <div className="space-y-6">
            {filteredExamples.map((example, index) => (
              <PromptComparison key={`${example.category}-${index}`} example={example} />
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="text-gray-400">
              {allExamples.length === 0
                ? 'No rewrite examples available yet.'
                : 'No examples in this category.'}
            </p>
          </div>
        )}
      </section>

      {/* Section 3: Weekly Goals */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Target className="text-accent-warning" size={24} />
          <h3 className="text-xl font-semibold">Weekly Goals</h3>
        </div>
        {weeklyGoals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {weeklyGoals.map((goal, index) => (
              <WeeklyGoalCard key={index} goal={goal} index={index} />
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="text-gray-400">No weekly goals set.</p>
          </div>
        )}
      </section>

      {/* Section 4: Progress Trend */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="text-accent-success" size={24} />
          <h3 className="text-xl font-semibold">Progress Trend</h3>
        </div>
        {progressTrend.length > 0 ? (
          <div className="card">
            <ProgressChart data={progressTrend} />
          </div>
        ) : (
          <div className="card">
            <p className="text-gray-400">Not enough data to show progress trend.</p>
          </div>
        )}
      </section>

      {/* Key Insights */}
      {summary.keyInsights.length > 0 && (
        <section className="card">
          <h3 className="text-lg font-semibold mb-3">Key Insights</h3>
          <ul className="space-y-2">
            {summary.keyInsights.map((insight, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-accent-secondary mt-1">•</span>
                <span className="text-gray-300">{insight}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
