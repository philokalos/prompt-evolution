import { useQuery } from '@tanstack/react-query';
import { fetchProjects, type ProjectResponse } from '@/api/client';

export function useProjects() {
  return useQuery<{ projects: ProjectResponse[] }>({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });
}
