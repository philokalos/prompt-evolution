/**
 * Classify Command
 * Classify prompts by intent and task category
 */

import {
  databaseExists,
  initializeDatabase,
  closeDatabase,
  getAllConversations,
  getTurnsByConversationId,
} from '../../db/index.js';
import {
  classifyPrompt,
  classifyPrompts,
  getClassificationStats,
  getIntentLabel,
  getCategoryLabel,
} from '../../analysis/index.js';

export interface ClassifyCommandOptions {
  text?: string;
  all?: boolean;
  stats?: boolean;
}

export function classifyCommand(options: ClassifyCommandOptions): void {
  // Single text classification
  if (options.text) {
    console.log('\n🏷️ 프롬프트 분류\n');
    console.log(`입력: "${options.text}"\n`);

    const result = classifyPrompt(options.text);

    console.log('='.repeat(50));
    console.log('📊 분류 결과');
    console.log('='.repeat(50));
    console.log(`의도 (Intent): ${getIntentLabel(result.intent)}`);
    console.log(`  신뢰도: ${(result.intentConfidence * 100).toFixed(1)}%`);
    console.log(`\n카테고리: ${getCategoryLabel(result.taskCategory)}`);
    console.log(
      `  신뢰도: ${(result.categoryConfidence * 100).toFixed(1)}%`
    );

    if (result.matchedKeywords.length > 0) {
      console.log(`\n매칭된 키워드: ${result.matchedKeywords.join(', ')}`);
    }

    console.log('\n📋 특성');
    console.log(
      `  길이: ${result.features.length}자 (${result.features.wordCount}단어)`
    );
    console.log(`  복잡도: ${result.features.complexity}`);
    console.log(`  언어: ${result.features.languageHint}`);
    console.log(
      `  코드 블록: ${result.features.hasCodeBlock ? '있음' : '없음'}`
    );
    console.log(`  URL: ${result.features.hasUrl ? '있음' : '없음'}`);
    console.log(
      `  파일 경로: ${result.features.hasFilePath ? '있음' : '없음'}`
    );

    return;
  }

  // Analyze all user turns from database
  if (options.all || options.stats) {
    if (!databaseExists()) {
      console.log('⚠️  데이터베이스가 없습니다. 먼저 import 명령을 실행하세요.');
      return;
    }

    initializeDatabase();

    console.log('\n🏷️ 전체 유저 턴 분류 분석\n');

    // Get all user turns
    const conversations = getAllConversations();
    const allUserTurns: Array<{ content: string; conversationId: string }> =
      [];

    for (const conv of conversations) {
      const turns = getTurnsByConversationId(conv.id);
      for (const turn of turns) {
        if (turn.role === 'user' && turn.content) {
          allUserTurns.push({
            content: turn.content,
            conversationId: conv.id,
          });
        }
      }
    }

    console.log(`분석 대상: ${allUserTurns.length}개 유저 턴\n`);

    // Classify all
    const results = classifyPrompts(allUserTurns.map((t) => t.content));
    const stats = getClassificationStats(results);

    console.log('='.repeat(50));
    console.log('📊 분류 통계');
    console.log('='.repeat(50));
    console.log(`총 프롬프트: ${stats.totalPrompts}개`);
    console.log(
      `평균 의도 신뢰도: ${(stats.avgIntentConfidence * 100).toFixed(1)}%`
    );
    console.log(
      `평균 카테고리 신뢰도: ${(stats.avgCategoryConfidence * 100).toFixed(1)}%`
    );

    console.log('\n' + '='.repeat(50));
    console.log('💬 의도 분포');
    console.log('='.repeat(50));

    const intentEntries = Object.entries(stats.intentDistribution)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    for (const [intent, count] of intentEntries) {
      const percent = ((count / stats.totalPrompts) * 100).toFixed(1);
      const label = getIntentLabel(intent as any);
      const bar = '█'.repeat(
        Math.round((count / stats.totalPrompts) * 30)
      );
      console.log(`${label}: ${count}개 (${percent}%) ${bar}`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('📂 카테고리 분포');
    console.log('='.repeat(50));

    const categoryEntries = Object.entries(stats.categoryDistribution)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    for (const [category, count] of categoryEntries) {
      const percent = ((count / stats.totalPrompts) * 100).toFixed(1);
      const label = getCategoryLabel(category as any);
      const bar = '█'.repeat(
        Math.round((count / stats.totalPrompts) * 30)
      );
      console.log(`${label}: ${count}개 (${percent}%) ${bar}`);
    }

    // Show some examples if not just stats
    if (options.all && !options.stats) {
      console.log('\n' + '='.repeat(50));
      console.log('📝 분류 예시 (처음 5개)');
      console.log('='.repeat(50));

      results.slice(0, 5).forEach((result, i) => {
        const turn = allUserTurns[i];
        const preview =
          turn.content.slice(0, 80) +
          (turn.content.length > 80 ? '...' : '');
        console.log(`\n${i + 1}. "${preview}"`);
        console.log(
          `   → ${getIntentLabel(result.intent)} | ${getCategoryLabel(result.taskCategory)}`
        );
      });
    }

    closeDatabase();
    return;
  }

  // No option specified
  console.log('사용법:');
  console.log('  prompt-evolution classify "<text>"  # 텍스트 직접 분류');
  console.log('  prompt-evolution classify --all     # 모든 유저 턴 분류');
  console.log(
    '  prompt-evolution classify --stats   # 분류 통계만 표시'
  );
}
