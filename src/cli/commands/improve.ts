/**
 * Improve Command
 * Improve a prompt using LLM or rules
 */

import {
  improvePromptWithLLM,
  improvePromptWithRules,
  type ImprovedPrompt,
} from '../../analysis/self-improvement.js';

export interface ImproveCommandOptions {
  text?: string;
  offline?: boolean;
}

export async function improveCommand(
  options: ImproveCommandOptions
): Promise<void> {
  if (!options.text) {
    console.log('사용법:');
    console.log('  prompt-evolution improve "<text>"            # LLM 기반 개선');
    console.log(
      '  prompt-evolution improve "<text>" --offline  # 규칙 기반 개선'
    );
    return;
  }

  console.log('\n✨ 프롬프트 개선\n');
  console.log(`입력: "${options.text}"\n`);

  let result: ImprovedPrompt | null;

  if (options.offline) {
    console.log('📖 규칙 기반 개선 (오프라인)\n');
    result = improvePromptWithRules(options.text);
  } else {
    console.log('🤖 LLM 기반 개선 중...\n');

    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('⚠️  ANTHROPIC_API_KEY가 설정되지 않았습니다.');
      console.log(
        '   환경 변수를 설정하거나 --offline 옵션을 사용하세요.\n'
      );
      console.log('   예: export ANTHROPIC_API_KEY=sk-...');
      console.log(
        '   또는: prompt-evolution improve "<text>" --offline\n'
      );
      return;
    }

    result = await improvePromptWithLLM(options.text);

    if (!result) {
      console.log(
        '❌ LLM 개선 실패. --offline 옵션으로 규칙 기반 개선을 시도해 보세요.'
      );
      return;
    }
  }

  // Display results
  console.log('='.repeat(60));
  console.log('📊 분석 결과');
  console.log('='.repeat(60));
  console.log(
    `분류: ${result.classification.taskCategory} (${result.classification.intent})`
  );
  console.log(`신뢰도: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`변형 유형: ${result.variant}`);

  console.log('\n' + '='.repeat(60));
  console.log('📈 GOLDEN 점수 비교');
  console.log('='.repeat(60));

  const dims = ['goal', 'output', 'limits', 'data', 'evaluation', 'next'] as const;
  const dimLabels: Record<string, string> = {
    goal: 'G (목표)',
    output: 'O (출력)',
    limits: 'L (제약)',
    data: 'D (데이터)',
    evaluation: 'E (평가)',
    next: 'N (다음)',
  };

  console.log('\n차원별 점수:');
  for (const dim of dims) {
    const before = (result.originalScore[dim] * 100).toFixed(0).padStart(3);
    const after = (result.improvedScore[dim] * 100).toFixed(0).padStart(3);
    const diff = result.improvedScore[dim] - result.originalScore[dim];
    const diffStr =
      diff > 0
        ? `+${(diff * 100).toFixed(0)}`
        : `${(diff * 100).toFixed(0)}`;
    const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
    console.log(
      `  ${dimLabels[dim]}: ${before}% → ${after}% (${arrow}${diffStr}%)`
    );
  }

  console.log('\n' + '-'.repeat(40));
  const beforeTotal = (result.originalScore.total * 100).toFixed(0);
  const afterTotal = (result.improvedScore.total * 100).toFixed(0);
  const improvement =
    result.improvementPercent > 0
      ? `+${result.improvementPercent}`
      : `${result.improvementPercent}`;
  console.log(`총점: ${beforeTotal}% → ${afterTotal}% (${improvement}%)`);

  if (result.keyChanges.length > 0) {
    console.log('\n🔧 주요 변경:');
    result.keyChanges.forEach((change) => {
      console.log(`  • ${change}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ 개선된 프롬프트');
  console.log('='.repeat(60));
  console.log(`\n${result.improved}\n`);
}
