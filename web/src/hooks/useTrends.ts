import { useQuery } from '@tanstack/react-query';
import { fetchTrends, type TrendsResponse } from '@/api/client';

interface UseTrendsParams {
  period?: string;
  metric?: 'effectiveness' | 'quality' | 'volume';
  groupBy?: 'day' | 'week' | 'month';
}

export function useTrends(params: UseTrendsParams = {}) {
  return useQuery<TrendsResponse>({
    queryKey: ['trends', params],
    queryFn: () => fetchTrends(params),
  });
}
