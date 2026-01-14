/**
 * Analysis Service
 * Handles quality signal analysis for conversations
 */

import {
  databaseExists,
  initializeDatabase,
  closeDatabase,
  getAllConversations,
  getTurnsByConversationId,
  hasBeenAnalyzed,
  insertQualitySignals,
  saveEffectivenessScore,
} from '../../db/index.js';
import {
  detectConversationSignals,
  analyzeEffectiveness,
  calculateAggregateEffectiveness,
  type TurnForAnalysis,
  type ConversationSignals,
} from '../../analysis/index.js';

export interface AnalyzeOptions {
  incremental?: boolean;
  conversationId?: string;
}

export interface AnalyzeResult {
  analyzed: number;
  skipped: number;
}

export function analyzeConversations(
  options: AnalyzeOptions
): AnalyzeResult | null {
  console.log('\n🔍 품질 신호 분석\n');

  if (!databaseExists()) {
    console.log('⚠️  데이터베이스가 없습니다. 먼저 import 명령을 실행하세요.');
    return null;
  }

  initializeDatabase();

  let conversations;
  if (options.conversationId) {
    // Analyze specific conversation
    const turns = getTurnsByConversationId(options.conversationId);
    if (turns.length === 0) {
      console.log(`⚠️  대화를 찾을 수 없습니다: ${options.conversationId}`);
      closeDatabase();
      return null;
    }
    conversations = [{ id: options.conversationId }];
  } else {
    // Analyze all conversations
    conversations = getAllConversations();
  }

  let analyzed = 0;
  let skipped = 0;
  const allSignals: ConversationSignals[] = [];

  console.log(`대화 ${conversations.length}개 분석 중...\n`);

  for (const conv of conversations) {
    // Skip if incremental and already analyzed
    if (options.incremental && hasBeenAnalyzed(conv.id)) {
      skipped++;
      continue;
    }

    try {
      // Get turns for this conversation
      const turnRows = getTurnsByConversationId(conv.id);

      if (turnRows.length === 0) {
        continue;
      }

      // Convert to analysis format
      const turns: TurnForAnalysis[] = turnRows.map((t, i) => ({
        id: t.id,
        role: t.role as 'user' | 'assistant',
        content: t.content || '',
        turnIndex: i,
      }));

      // Detect signals
      const signals = detectConversationSignals(conv.id, turns);
      allSignals.push(signals);

      // Calculate effectiveness
      const effectiveness = analyzeEffectiveness(signals);

      // Save signals to database
      const signalsToSave = signals.signals.map((s) => ({
        signalType: s.type,
        turnId: s.turnId,
        value: s.confidence,
        metadata: { keywords: s.keywords },
      }));

      if (signalsToSave.length > 0) {
        insertQualitySignals(conv.id, signalsToSave);
      }

      // Save effectiveness score
      saveEffectivenessScore(conv.id, effectiveness.score.overall, {
        sentiment: effectiveness.score.sentimentScore,
        completion: effectiveness.score.completionScore,
        efficiency: effectiveness.score.efficiencyScore,
        engagement: effectiveness.score.engagementScore,
      });

      analyzed++;
      process.stdout.write('.');
    } catch {
      process.stdout.write('x');
    }
  }

  console.log('\n');

  // Show summary
  console.log('='.repeat(40));
  console.log('📊 분석 결과');
  console.log('='.repeat(40));
  console.log(`✅ 분석됨: ${analyzed}개`);
  if (skipped > 0) {
    console.log(`⏭️  스킵됨: ${skipped}개 (이미 분석됨)`);
  }

  // Show aggregate stats if we analyzed anything
  if (allSignals.length > 0) {
    const aggregate = calculateAggregateEffectiveness(allSignals);

    console.log('\n' + '='.repeat(40));
    console.log('📈 종합 통계');
    console.log('='.repeat(40));
    console.log(
      `평균 효과성 점수: ${(aggregate.averageScore * 100).toFixed(1)}%`
    );
    console.log(`평균 등급: ${aggregate.averageGrade}`);
    console.log('\n등급 분포:');
    console.log(`  A (90%+): ${aggregate.scoreDistribution.A}개`);
    console.log(`  B (75%+): ${aggregate.scoreDistribution.B}개`);
    console.log(`  C (60%+): ${aggregate.scoreDistribution.C}개`);
    console.log(`  D (40%+): ${aggregate.scoreDistribution.D}개`);
    console.log(`  F (<40%): ${aggregate.scoreDistribution.F}개`);

    if (aggregate.trends.strongestArea) {
      console.log(`\n💪 강점: ${aggregate.trends.strongestArea}`);
    }
    if (aggregate.trends.mostCommonIssue) {
      console.log(`⚠️  개선 필요: ${aggregate.trends.mostCommonIssue}`);
    }
  }

  closeDatabase();

  return {
    analyzed,
    skipped,
  };
}
