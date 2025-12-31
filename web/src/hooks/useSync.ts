import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSyncStatus, triggerSync, type SyncStatusResponse, type SyncTriggerResponse } from '@/api/client';

export function useSyncStatus() {
  return useQuery<SyncStatusResponse>({
    queryKey: ['syncStatus'],
    queryFn: fetchSyncStatus,
    refetchInterval: 1000 * 30, // Refetch every 30 seconds
  });
}

export function useTriggerSync() {
  const queryClient = useQueryClient();

  return useMutation<SyncTriggerResponse, Error, Parameters<typeof triggerSync>[0]>({
    mutationFn: triggerSync,
    onSuccess: () => {
      // Invalidate all queries after sync
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['trends'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      queryClient.invalidateQueries({ queryKey: ['syncStatus'] });
    },
  });
}
