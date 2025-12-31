import { Router } from 'express';
import {
  generateInsights,
  getDatabase,
  getAllConversations,
  getConversationsInRange,
  type TimePeriod,
  type TaskCategory,
  type PromptData,
} from '../../src/index.js';

export const insightsRouter = Router();

// GET /api/insights - Insights report with filters
insightsRouter.get('/', async (req, res, next) => {
  try {
    const db = getDatabase();
    const {
      period = '7d',
      project,
      category,
      focus,
    } = req.query as {
      period?: TimePeriod;
      project?: string;
      category?: TaskCategory;
      focus?: 'problems' | 'improvements' | 'strengths';
    };

    // Get conversations based on period
    const conversations = getConversationsForPeriod(period);

    // Filter by project if specified
    const filteredConversations = project
      ? conversations.filter((c) => c.project === project)
      : conversations;

    // Get all user turns for these conversations
    const conversationIds = filteredConversations.map((c) => c.id);

    if (conversationIds.length === 0) {
      return res.json(createEmptyResponse(period));
    }

    // Build prompts data from user turns
    const promptData = getPromptDataFromConversations(db, conversationIds);

    if (promptData.length === 0) {
      return res.json(createEmptyResponse(period));
    }

    // Generate insights
    const report = generateInsights(promptData, {
      period,
      category,
      focusArea: focus,
      includeLibrary: true,
      includeGuidelines: true,
      includeSelfImprovement: true,
    });

    // Convert Date to ISO string for JSON response
    res.json({
      ...report,
      generatedAt: report.generatedAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

function getConversationsForPeriod(period: TimePeriod) {
  if (period === 'all') {
    return getAllConversations({ limit: 1000 });
  }

  const now = new Date();
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return getConversationsInRange(startDate, now);
}

function getPromptDataFromConversations(
  db: ReturnType<typeof getDatabase>,
  conversationIds: string[]
): PromptData[] {
  if (conversationIds.length === 0) return [];

  // Create placeholders for IN clause
  const placeholders = conversationIds.map(() => '?').join(',');

  const turns = db
    .prepare(
      `
      SELECT t.content, t.conversation_id, t.timestamp
      FROM turns t
      WHERE t.role = 'user'
        AND t.conversation_id IN (${placeholders})
        AND t.content IS NOT NULL
        AND t.content != ''
      ORDER BY t.timestamp DESC
    `
    )
    .all(...conversationIds) as Array<{
    content: string;
    conversation_id: string;
    timestamp: string;
  }>;

  return turns.map((t) => ({
    content: t.content,
    conversationId: t.conversation_id,
    timestamp: t.timestamp ? new Date(t.timestamp) : undefined,
    effectiveness: undefined, // Could be enhanced with quality_signals data
  }));
}

function createEmptyResponse(period: TimePeriod) {
  return {
    generatedAt: new Date().toISOString(),
    period,
    summary: {
      totalConversations: 0,
      totalPrompts: 0,
      overallEffectiveness: 0,
      overallQuality: 0,
    },
    problems: [],
    improvements: [],
    strengths: [],
    categoryBreakdown: [],
    recommendations: [],
    promptLibrary: null,
    guidelinesSummary: null,
    selfImprovement: null,
  };
}
