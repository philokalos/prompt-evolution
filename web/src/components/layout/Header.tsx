import { RefreshCw, Clock } from 'lucide-react';
import { useSyncStatus, useTriggerSync } from '@/hooks/useSync';

export default function Header() {
  const { data: syncStatus, isLoading } = useSyncStatus();
  const { mutate: triggerSync, isPending: isSyncing } = useTriggerSync();

  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const handleSync = () => {
    triggerSync({ mode: 'incremental' });
  };

  return (
    <header className="bg-app-surface/80 backdrop-blur-xl border-b border-app-border sticky top-0 z-10">
      <div className="px-8 py-4">
        <div className="flex items-center justify-end gap-3">
          {/* Last sync indicator */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-app-elevated border border-app-border">
            <Clock size={14} className="text-app-text-tertiary" />
            <span className="text-xs font-medium text-app-text-secondary">
              {isLoading ? '...' : formatTime(syncStatus?.lastSync || null)}
            </span>
          </div>

          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={isSyncing || syncStatus?.isRunning}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw
              size={16}
              className={isSyncing || syncStatus?.isRunning ? 'animate-spin' : ''}
            />
            <span>{isSyncing || syncStatus?.isRunning ? 'Syncing' : 'Sync'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
