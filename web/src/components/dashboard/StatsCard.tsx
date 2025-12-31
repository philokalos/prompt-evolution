import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number;
  format?: 'number' | 'percent';
  icon: LucideIcon;
  loading?: boolean;
  color?: 'primary' | 'secondary' | 'success' | 'warning';
}

const colorClasses = {
  primary: 'bg-accent-primary/10 text-accent-primary',
  secondary: 'bg-accent-secondary/10 text-accent-secondary',
  success: 'bg-accent-success/10 text-accent-success',
  warning: 'bg-accent-warning/10 text-accent-warning',
};

export default function StatsCard({
  title,
  value,
  format = 'number',
  icon: Icon,
  loading = false,
  color = 'primary',
}: StatsCardProps) {
  const formattedValue =
    format === 'percent'
      ? `${(value * 100).toFixed(1)}%`
      : value.toLocaleString();

  return (
    <div className="card-hover">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          {loading ? (
            <div className="h-8 w-24 bg-dark-border rounded animate-pulse mt-1"></div>
          ) : (
            <p className="text-2xl font-bold mt-1">{formattedValue}</p>
          )}
        </div>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}
