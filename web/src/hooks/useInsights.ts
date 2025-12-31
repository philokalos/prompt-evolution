import { useQuery } from '@tanstack/react-query';
import { fetchInsights, type InsightsResponse } from '@/api/client';

interface UseInsightsParams {
  period?: string;
  project?: string;
  category?: string;
  focus?: 'problems' | 'improvements' | 'strengths';
}

export function useInsights(params: UseInsightsParams = {}) {
  return useQuery<InsightsResponse>({
    queryKey: ['insights', params],
    queryFn: () => fetchInsights(params),
  });
}
