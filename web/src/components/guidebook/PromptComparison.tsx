import type { RewriteExample } from '@/api/client';
import GradeIndicator from './GradeIndicator';
import { XCircle, CheckCircle, Tag } from 'lucide-react';

interface PromptComparisonProps {
  example: RewriteExample;
}

export default function PromptComparison({ example }: PromptComparisonProps) {
  const categoryLabels: Record<string, string> = {
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

  return (
    <div className="card">
      {/* Category Tag */}
      <div className="flex items-center gap-2 mb-4">
        <Tag className="text-accent-secondary" size={16} />
        <span className="text-sm text-accent-secondary font-medium">
          {categoryLabels[example.category] || example.category}
        </span>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Before */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="text-red-400" size={18} />
            <span className="font-semibold text-red-400">Before</span>
          </div>

          {/* Prompt Text */}
          <div className="bg-dark-bg rounded-lg p-3 mb-3 font-mono text-sm text-gray-300 max-h-32 overflow-y-auto">
            {example.before.prompt}
          </div>

          {/* Issues */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Issues:</p>
            <ul className="space-y-1">
              {example.before.issues.map((issue, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span className="text-gray-400">{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* After */}
        <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="text-accent-success" size={18} />
            <span className="font-semibold text-accent-success">After</span>
          </div>

          {/* Prompt Text */}
          <div className="bg-dark-bg rounded-lg p-3 mb-3 font-mono text-sm text-gray-300 max-h-32 overflow-y-auto">
            {example.after.prompt}
          </div>

          {/* Improvements */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Improvements:</p>
            <ul className="space-y-1">
              {example.after.improvements.map((improvement, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-accent-success mt-0.5">•</span>
                  <span className="text-gray-400">{improvement}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Key Changes */}
      {example.keyChanges.length > 0 && (
        <div className="bg-dark-hover rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-500 mb-2">Key Changes:</p>
          <div className="flex flex-wrap gap-2">
            {example.keyChanges.map((change, index) => (
              <span
                key={index}
                className="bg-accent-secondary/20 text-accent-secondary text-xs px-2 py-1 rounded-full"
              >
                {change}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Score Indicator */}
      <GradeIndicator
        scoreBefore={example.before.score}
        scoreAfter={example.after.score}
      />
    </div>
  );
}
