import { useState, useEffect } from 'react';
import type { WeeklyGoal } from '@/api/client';
import { CheckCircle, Circle, Zap, Clock, Shield } from 'lucide-react';

interface WeeklyGoalCardProps {
  goal: WeeklyGoal;
  index: number;
}

export default function WeeklyGoalCard({ goal, index }: WeeklyGoalCardProps) {
  const storageKey = `guidebook-goal-${index}-${goal.goal}`;
  const [isCompleted, setIsCompleted] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(isCompleted));
  }, [isCompleted, storageKey]);

  const difficultyConfig = {
    easy: {
      icon: Zap,
      color: 'text-green-400',
      bg: 'bg-green-500/20',
      label: 'Easy',
    },
    medium: {
      icon: Clock,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/20',
      label: 'Medium',
    },
    hard: {
      icon: Shield,
      color: 'text-red-400',
      bg: 'bg-red-500/20',
      label: 'Hard',
    },
  };

  const config = difficultyConfig[goal.difficulty];
  const DifficultyIcon = config.icon;
  const progressPercent = Math.min((goal.currentValue / goal.targetValue) * 100, 100);

  return (
    <div
      className={`card transition-all duration-200 ${
        isCompleted ? 'bg-accent-success/10 border-accent-success/30 border' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <button
          onClick={() => setIsCompleted(!isCompleted)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          {isCompleted ? (
            <CheckCircle className="text-accent-success" size={20} />
          ) : (
            <Circle className="text-gray-500" size={20} />
          )}
          <span
            className={`font-semibold ${
              isCompleted ? 'text-gray-400 line-through' : 'text-gray-100'
            }`}
          >
            {goal.goal}
          </span>
        </button>
        <div className={`flex items-center gap-1 ${config.bg} ${config.color} px-2 py-1 rounded-full text-xs`}>
          <DifficultyIcon size={12} />
          <span>{config.label}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{goal.metric}</span>
          <span>
            {(goal.currentValue * 100).toFixed(0)}% / {(goal.targetValue * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isCompleted ? 'bg-accent-success' : 'bg-accent-secondary'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Action Items */}
      {goal.actionItems.length > 0 && (
        <div className="border-t border-dark-border pt-3">
          <p className="text-xs text-gray-500 mb-2">Action Items:</p>
          <ul className="space-y-1">
            {goal.actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-accent-secondary mt-0.5">•</span>
                <span className="text-gray-400">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
