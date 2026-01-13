import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number;
  format?: 'number' | 'percent';
  icon: LucideIcon;
  loading?: boolean;
  color?: 'primary' | 'secondary' | 'success' | 'warning';
}

const colorConfig = {
  primary: {
    bg: 'bg-accent-primary/10',
    text: 'text-accent-primary',
    gradient: 'from-accent-primary/20 to-transparent',
  },
  secondary: {
    bg: 'bg-accent-secondary/10',
    text: 'text-accent-secondary',
    gradient: 'from-accent-secondary/20 to-transparent',
  },
  success: {
    bg: 'bg-accent-success/10',
    text: 'text-accent-success',
    gradient: 'from-accent-success/20 to-transparent',
  },
  warning: {
    bg: 'bg-accent-warning/10',
    text: 'text-accent-warning',
    gradient: 'from-accent-warning/20 to-transparent',
  },
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

  const colors = colorConfig[color];

  return (
    <div className="card group">
      <div className="flex flex-col gap-4">
        {/* Icon and Title */}
        <div className="flex items-start justify-between">
          <div className={`p-3 rounded-xl ${colors.bg} ${colors.text} shadow-app-sm`}>
            <Icon size={20} strokeWidth={2} />
          </div>
        </div>

        {/* Value and Label */}
        <div>
          {loading ? (
            <div className="h-9 w-32 bg-app-border rounded-lg animate-pulse"></div>
          ) : (
            <p className="text-3xl font-semibold tracking-tight text-app-text-primary">
              {formattedValue}
            </p>
          )}
          <p className="text-sm text-app-text-secondary mt-1.5 font-medium">{title}</p>
        </div>
      </div>

      {/* Bottom accent line */}
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${colors.gradient} opacity-60`}></div>
    </div>
  );
}
