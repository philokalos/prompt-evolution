import { RefreshCw, Clock } from 'lucide-react';
import { useSyncStatus, useTriggerSync } from '@/hooks/useSync';

export default function Header() {
  const { data: syncStatus, isLoading } = useSyncStatus();
  const { mutate: triggerSync, isPending: isSyncing } = useTriggerSync();

  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const handleSync = () => {
    triggerSync({ mode: 'incremental' });
  };

  return (
    <header className="bg-dark-surface border-b border-dark-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Prompt Evolution</h1>
          <p className="text-sm text-gray-400">Analyze and improve your prompting patterns</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Last sync time */}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock size={16} />
            <span>
              Last sync: {isLoading ? '...' : formatTime(syncStatus?.lastSync || null)}
            </span>
          </div>

          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={isSyncing || syncStatus?.isRunning}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw
              size={16}
              className={isSyncing || syncStatus?.isRunning ? 'animate-spin' : ''}
            />
            {isSyncing || syncStatus?.isRunning ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>
    </header>
  );
}
