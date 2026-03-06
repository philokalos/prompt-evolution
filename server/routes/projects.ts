import { Router } from 'express';
import { getProjectStats, getProjectLastActive, getProjectAvgEffectiveness } from '../../src/index.js';

export const projectsRouter = Router();

interface ProjectWithStats {
  id: string;
  path: string;
  displayName: string;
  conversationCount: number;
  lastActive: string | null;
  avgEffectiveness: number;
}

// GET /api/projects - List of projects with stats
projectsRouter.get('/', async (req, res, next) => {
  try {
    const projectStats = getProjectStats();

    const projects: ProjectWithStats[] = projectStats.map((p) => {
      const displayName = extractDisplayName(p.project_path || p.project);

      return {
        id: p.project,
        path: p.project_path || p.project,
        displayName,
        conversationCount: p.count,
        lastActive: getProjectLastActive(p.project),
        avgEffectiveness: getProjectAvgEffectiveness(p.project),
      };
    });

    // Sort by conversation count descending
    projects.sort((a, b) => b.conversationCount - a.conversationCount);

    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

// Helper to extract display name from project path
function extractDisplayName(projectPath: string): string {
  // Handle encoded paths like "-Users-foo-project"
  const decoded = projectPath.replace(/^-/, '/').replace(/-/g, '/');
  const parts = decoded.split('/').filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}
