/**
 * Sessions Command
 * List all sessions for a project
 */

import { listSessions } from '../../parser/index.js';

export function sessionsCommand(projectName: string): void {
  console.log(`\n📄 세션 목록: ${projectName}\n`);
  const sessions = listSessions(projectName);

  if (sessions.length === 0) {
    console.log('세션이 없습니다.');
    return;
  }

  sessions.forEach((session, i) => {
    console.log(`${i + 1}. ${session}`);
  });

  console.log(`\n총 ${sessions.length}개 세션`);
}
