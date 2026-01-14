/**
 * Parse Command
 * Parse and display a Claude Code session
 */

import { listSessions, parseSession } from '../../parser/index.js';

export function parseCommand(projectName: string, sessionFile?: string): void {
  const sessions = sessionFile ? [sessionFile] : listSessions(projectName);

  if (sessions.length === 0) {
    console.log('세션이 없습니다.');
    return;
  }

  // 최근 세션 1개만 파싱 (전체는 너무 많음)
  const targetSession = sessions[sessions.length - 1];
  console.log(`\n🔍 파싱 중: ${targetSession}\n`);

  const conversation = parseSession(projectName, targetSession);

  if (!conversation) {
    console.log('파싱 실패');
    return;
  }

  console.log('='.repeat(60));
  console.log(`세션 ID: ${conversation.id}`);
  console.log(`프로젝트: ${conversation.projectPath}`);
  console.log(`모델: ${conversation.model}`);
  console.log(`시작: ${conversation.startedAt.toLocaleString()}`);
  console.log(`종료: ${conversation.endedAt.toLocaleString()}`);
  console.log(
    `토큰: 입력 ${conversation.totalInputTokens.toLocaleString()} / 출력 ${conversation.totalOutputTokens.toLocaleString()}`
  );
  console.log(`턴 수: ${conversation.turns.length}`);
  console.log('='.repeat(60));

  if (conversation.summaries.length > 0) {
    console.log('\n📋 세션 요약:');
    conversation.summaries.forEach((s) => console.log(`  - ${s}`));
  }

  console.log('\n💬 대화 내용:\n');

  conversation.turns.slice(0, 10).forEach((turn, i) => {
    const role = turn.role === 'user' ? '👤 User' : '🤖 Assistant';
    const content =
      turn.content.slice(0, 200) +
      (turn.content.length > 200 ? '...' : '');
    console.log(
      `[${i + 1}] ${role} (${turn.timestamp.toLocaleTimeString()})`
    );
    console.log(`    ${content}`);
    if (turn.toolsUsed && turn.toolsUsed.length > 0) {
      console.log(`    🔧 Tools: ${turn.toolsUsed.join(', ')}`);
    }
    console.log('');
  });

  if (conversation.turns.length > 10) {
    console.log(`... 외 ${conversation.turns.length - 10}개 턴`);
  }
}
