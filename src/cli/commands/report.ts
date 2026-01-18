/**
 * Report Command
 * Generate HTML report
 */

import {
  databaseExists,
  initializeDatabase,
  closeDatabase,
  getAllConversations,
  getTurnsByConversationId,
  getSignalStats,
} from '../../db/index.js';
import {
  generateInsights,
  type PromptData,
  type TimePeriod,
} from '../../analysis/index.js';
import { generateHtmlReport } from '../../report/index.js';

export interface ReportCommandOptions {
  output?: string;
  period?: string;
}

export function reportCommand(options: ReportCommandOptions): void {
  console.log('\n📄 HTML 리포트 생성\n');

  if (!databaseExists()) {
    console.log(
      '⚠️  데이터베이스가 없습니다. 먼저 import와 analyze 명령을 실행하세요.'
    );
    return;
  }

  initializeDatabase();

  // Get conversations based on period
  let conversations = getAllConversations();

  // Parse period
  let periodLabel = '전체';
  if (options.period) {
    const match = options.period.match(/^(\d+)([dwm])$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      const now = new Date();
      let startDate: Date;

      if (unit === 'd') {
        startDate = new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
        periodLabel = `최근 ${value}일`;
      } else if (unit === 'w') {
        startDate = new Date(
          now.getTime() - value * 7 * 24 * 60 * 60 * 1000
        );
        periodLabel = `최근 ${value}주`;
      } else {
        startDate = new Date(
          now.getTime() - value * 30 * 24 * 60 * 60 * 1000
        );
        periodLabel = `최근 ${value}개월`;
      }

      conversations = conversations.filter((c) => {
        const convDate = new Date(c.started_at || '');
        return convDate >= startDate;
      });
    }
  }

  // Build prompt data for analysis
  const promptDataList: PromptData[] = [];
  let _totalEffectiveness = 0;
  let _effectivenessCount = 0;

  for (const conv of conversations) {
    const turns = getTurnsByConversationId(conv.id);
    const userTurns = turns.filter((t) => t.role === 'user' && t.content);

    for (const turn of userTurns) {
      promptDataList.push({
        content: turn.content || '',
        conversationId: conv.id,
        timestamp: turn.timestamp ? new Date(turn.timestamp) : undefined,
        effectiveness: 65, // Placeholder
      });
    }

    // Get effectiveness if analyzed
    const signals = getSignalStats();
    if (signals.length > 0) {
      _totalEffectiveness += 65; // Average placeholder
      _effectivenessCount++;
    }
  }

  // Generate insights
  const insights = generateInsights(promptDataList, {
    period: periodLabel as TimePeriod,
  });

  // Default output path
  const outputPath =
    options.output || `./prompt-evolution-report-${Date.now()}.html`;

  // Generate HTML
  generateHtmlReport(insights, {
    outputPath,
    title: `Prompt Evolution 리포트 (${periodLabel})`,
  });

  console.log(`✅ 리포트 생성 완료: ${outputPath}`);
  console.log(`\n📊 요약:`);
  console.log(`   대화: ${insights.summary.totalConversations}개`);
  console.log(`   프롬프트: ${insights.summary.totalPrompts}개`);
  console.log(
    `   평균 효과성: ${insights.summary.overallEffectiveness.toFixed(1)}%`
  );

  closeDatabase();
}
