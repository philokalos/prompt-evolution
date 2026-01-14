/**
 * Import Service
 * Handles importing Claude Code sessions to database
 */

import { listProjects, listSessions, parseSession } from '../../parser/index.js';
import {
  getDatabasePath,
  databaseExists,
  initializeDatabase,
  closeDatabase,
  conversationExists,
  insertConversation,
  insertTurns,
  insertToolUsages,
} from '../../db/index.js';

export interface ImportOptions {
  project?: string;
  incremental?: boolean;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
}

export function importToDatabase(options: ImportOptions): ImportResult {
  console.log('\n📥 대화 데이터 임포트\n');

  // Initialize database
  const dbPath = getDatabasePath();
  console.log(`DB 경로: ${dbPath}`);

  const isNew = !databaseExists();
  initializeDatabase();

  if (isNew) {
    console.log('✅ 새 데이터베이스 생성됨\n');
  } else {
    console.log('✅ 기존 데이터베이스에 연결됨\n');
  }

  // Get projects to import
  const projects = options.project ? [options.project] : listProjects();

  let totalImported = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  console.log(`프로젝트 ${projects.length}개 처리 중...\n`);

  for (const project of projects) {
    const sessions = listSessions(project);
    const decoded = project.replace(/-/g, '/').replace(/^\//, '');
    console.log(`📁 ${decoded} (${sessions.length}개 세션)`);

    for (const sessionFile of sessions) {
      const sessionId = sessionFile.replace('.jsonl', '');

      // Skip if incremental and already exists
      if (options.incremental && conversationExists(sessionId)) {
        totalSkipped++;
        continue;
      }

      try {
        const conversation = parseSession(project, sessionFile);

        if (!conversation) {
          totalFailed++;
          continue;
        }

        // Insert conversation
        insertConversation(conversation);

        // Insert turns
        insertTurns(conversation.id, conversation.turns);

        // Insert tool usages for each turn
        for (const turn of conversation.turns) {
          if (turn.toolsUsed && turn.toolsUsed.length > 0) {
            insertToolUsages(turn.id, turn.toolsUsed, turn.timestamp);
          }
        }

        totalImported++;
        process.stdout.write('.');
      } catch (err) {
        totalFailed++;
        process.stdout.write('x');
        if (process.env.DEBUG) {
          console.error(
            `\n  Error: ${sessionFile}: ${(err as Error).message}`
          );
        }
      }
    }
    console.log(''); // New line after each project
  }

  closeDatabase();

  console.log('\n' + '='.repeat(40));
  console.log('📊 임포트 결과');
  console.log('='.repeat(40));
  console.log(`✅ 임포트됨: ${totalImported}개`);
  if (totalSkipped > 0) {
    console.log(`⏭️  스킵됨: ${totalSkipped}개 (이미 존재)`);
  }
  if (totalFailed > 0) {
    console.log(`❌ 실패: ${totalFailed}개`);
  }
  console.log(
    `총: ${totalImported + totalSkipped + totalFailed}개 세션 처리됨`
  );

  return {
    imported: totalImported,
    skipped: totalSkipped,
    failed: totalFailed,
  };
}
