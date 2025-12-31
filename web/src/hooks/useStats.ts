import { useQuery } from '@tanstack/react-query';
import { fetchStats, type StatsResponse } from '@/api/client';

export function useStats() {
  return useQuery<StatsResponse>({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  });
}
