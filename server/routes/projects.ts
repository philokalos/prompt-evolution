import { Router } from 'express';
import { getProjectStats, getDatabase } from '../../src/index.js';

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
    const db = getDatabase();
    const projectStats = getProjectStats();

    const projects: ProjectWithStats[] = projectStats.map((p) => {
      // Get last active time for this project
      const lastActiveResult = db
        .prepare(
          `
          SELECT MAX(started_at) as lastActive
          FROM conversations
          WHERE project = ?
        `
        )
        .get(p.project) as { lastActive: string | null };

      // Get average effectiveness for this project
      const effectivenessResult = db
        .prepare(
          `
          SELECT AVG(CAST(qs.value AS REAL)) as avgEffectiveness
          FROM quality_signals qs
          JOIN turns t ON qs.turn_id = t.id
          JOIN conversations c ON t.conversation_id = c.id
          WHERE c.project = ? AND qs.signal_type = 'effectiveness'
        `
        )
        .get(p.project) as { avgEffectiveness: number | null };

      // Extract display name from path
      const displayName = extractDisplayName(p.project_path || p.project);

      return {
        id: p.project,
        path: p.project_path || p.project,
        displayName,
        conversationCount: p.count,
        lastActive: lastActiveResult.lastActive,
        avgEffectiveness:
          Math.round((effectivenessResult.avgEffectiveness ?? 0) * 100) / 100,
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
