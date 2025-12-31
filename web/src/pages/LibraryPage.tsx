import { BookOpen } from 'lucide-react';
import { useInsights } from '@/hooks/useInsights';

export default function LibraryPage() {
  const { data: insights, isLoading, error } = useInsights({ period: 'all' });

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
        <p className="text-red-400">Error loading library: {error.message}</p>
      </div>
    );
  }

  const library = insights?.promptLibrary as {
    patterns?: Array<{
      pattern: string;
      category: string;
      effectiveness: number;
      count: number;
      keywords: string[];
    }>;
  } | null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Prompt Library</h2>
      <p className="text-gray-400">
        Effective prompt patterns extracted from your conversations
      </p>

      {library?.patterns && library.patterns.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {library.patterns.map((item, i) => (
            <div key={i} className="card-hover">
              <div className="flex items-start justify-between mb-3">
                <span className="px-2 py-1 bg-accent-secondary/10 text-accent-secondary text-xs rounded">
                  {item.category}
                </span>
                <span className="text-accent-success font-medium">
                  {(item.effectiveness * 100).toFixed(0)}% effective
                </span>
              </div>
              <p className="font-mono text-sm text-gray-300 mb-3">{item.pattern}</p>
              <div className="flex flex-wrap gap-2">
                {item.keywords.map((keyword, j) => (
                  <span
                    key={j}
                    className="px-2 py-1 bg-dark-border text-gray-400 text-xs rounded"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">Used {item.count} times</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <BookOpen className="mx-auto text-gray-500 mb-4" size={48} />
          <p className="text-gray-400">No prompt patterns extracted yet</p>
          <p className="text-sm text-gray-500 mt-2">
            Import and analyze more conversations to build your library
          </p>
        </div>
      )}
    </div>
  );
}
