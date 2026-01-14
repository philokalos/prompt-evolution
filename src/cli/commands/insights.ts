/**
 * Insights Command
 * Show insights report based on conversation analysis
 */

import {
  databaseExists,
  initializeDatabase,
  closeDatabase,
  getTotalSignalCount,
  getAllConversations,
  getTurnsByConversationId,
} from '../../db/index.js';
import {
  detectConversationSignals,
  analyzeEffectiveness,
  generateInsights,
  formatReport,
  type TurnForAnalysis,
  type TimePeriod,
  type TaskCategory,
} from '../../analysis/index.js';

export interface InsightsCommandOptions {
  period?: string;
  category?: string;
  problemsOnly?: boolean;
  strengthsOnly?: boolean;
}

export function insightsCommand(options: InsightsCommandOptions): void {
  if (!databaseExists()) {
    console.log(
      '⚠️  데이터베이스가 없습니다. 먼저 import와 analyze 명령을 실행하세요.'
    );
    return;
  }

  initializeDatabase();

  const totalSignals = getTotalSignalCount();

  if (totalSignals === 0) {
    console.log('⚠️  분석 데이터가 없습니다. analyze 명령을 먼저 실행하세요.');
    closeDatabase();
    return;
  }

  // Get all conversations with their analysis data
  const conversations = getAllConversations();
  const analysisData: Array<{
    content: string;
    conversationId: string;
    effectiveness: number;
    timestamp: Date;
  }> = [];

  for (const conv of conversations) {
    const turns = getTurnsByConversationId(conv.id);
    const userTurns = turns.filter((t) => t.role === 'user' && t.content);

    if (userTurns.length === 0) continue;

    const firstUserContent = userTurns[0].content;
    if (!firstUserContent) continue;

    // Get effectiveness (from signals)
    const turnData: TurnForAnalysis[] = turns.map((t, i) => ({
      id: t.id,
      role: t.role as 'user' | 'assistant',
      content: t.content || '',
      turnIndex: i,
    }));

    const signals = detectConversationSignals(conv.id, turnData);
    const effectiveness = analyzeEffectiveness(signals);

    // Collect all user prompts for this conversation
    for (const userTurn of userTurns) {
      if (userTurn.content) {
        analysisData.push({
          content: userTurn.content,
          conversationId: conv.id,
          effectiveness: effectiveness.score.overall,
          timestamp: new Date(conv.started_at || Date.now()),
        });
      }
    }
  }

  // Parse period
  let period: TimePeriod = 'all';
  if (options.period) {
    if (['7d', '30d', '90d', 'all'].includes(options.period)) {
      period = options.period as TimePeriod;
    } else {
      console.log(
        `⚠️  알 수 없는 기간: ${options.period} (사용 가능: 7d, 30d, 90d, all)`
      );
    }
  }

  // Parse category filter
  let categoryFilter: TaskCategory | undefined;
  if (options.category) {
    const validCategories: TaskCategory[] = [
      'code-generation',
      'code-review',
      'bug-fix',
      'refactoring',
      'explanation',
      'documentation',
      'testing',
      'architecture',
      'deployment',
      'data-analysis',
      'general',
    ];
    if (validCategories.includes(options.category as TaskCategory)) {
      categoryFilter = options.category as TaskCategory;
    } else {
      console.log(`⚠️  알 수 없는 카테고리: ${options.category}`);
      console.log(`   사용 가능: ${validCategories.join(', ')}`);
    }
  }

  // Generate insights
  const report = generateInsights(analysisData, {
    period,
    category: categoryFilter,
  });

  // Filter based on options
  let filteredReport = report;
  if (options.problemsOnly) {
    filteredReport = {
      ...report,
      improvements: [],
      strengths: [],
    };
  } else if (options.strengthsOnly) {
    filteredReport = {
      ...report,
      problems: [],
      improvements: [],
    };
  }

  // Format and display
  const output = formatReport(filteredReport);
  console.log(output);

  closeDatabase();
}
