/**
 * Stats Commands
 * Display statistics for projects and database
 */

import { listProjects, listSessions } from '../../parser/index.js';
import {
  getDatabasePath,
  databaseExists,
  initializeDatabase,
  closeDatabase,
  getConversationCount,
  getTotalTurnCount,
  getTotalToolUsageCount,
  getProjectStats,
  getToolUsageStats,
} from '../../db/index.js';

/**
 * Show file-based statistics
 */
export function statsCommand(): void {
  console.log('\n📊 전체 통계 (파일 기반)\n');

  const projects = listProjects();
  let totalSessions = 0;

  projects.forEach((project) => {
    const sessions = listSessions(project);
    totalSessions += sessions.length;
  });

  console.log(`프로젝트: ${projects.length}개`);
  console.log(`세션: ${totalSessions}개`);
}

/**
 * Show database statistics
 */
export function dbStatsCommand(): void {
  console.log('\n📊 데이터베이스 통계\n');

  const dbPath = getDatabasePath();

  if (!databaseExists()) {
    console.log('⚠️  데이터베이스가 없습니다. 먼저 import 명령을 실행하세요.');
    console.log(`   예상 경로: ${dbPath}`);
    return;
  }

  initializeDatabase();

  console.log(`DB 경로: ${dbPath}\n`);
  console.log('='.repeat(50));

  // Basic counts
  const conversationCount = getConversationCount();
  const turnCount = getTotalTurnCount();
  const toolUsageCount = getTotalToolUsageCount();

  console.log('📈 기본 통계');
  console.log('='.repeat(50));
  console.log(`대화 (conversations): ${conversationCount.toLocaleString()}개`);
  console.log(`턴 (turns): ${turnCount.toLocaleString()}개`);
  console.log(
    `도구 사용 (tool_usages): ${toolUsageCount.toLocaleString()}개`
  );

  if (conversationCount > 0) {
    console.log(
      `평균 턴/대화: ${(turnCount / conversationCount).toFixed(1)}개`
    );
  }

  // Project stats
  console.log('\n' + '='.repeat(50));
  console.log('📁 프로젝트별 통계');
  console.log('='.repeat(50));

  const projectStats = getProjectStats();
  projectStats.slice(0, 10).forEach((stat, i) => {
    const displayPath = stat.project_path || stat.project;
    console.log(`${i + 1}. ${displayPath}`);
    console.log(`   대화: ${stat.count}개`);
  });

  if (projectStats.length > 10) {
    console.log(`   ... 외 ${projectStats.length - 10}개 프로젝트`);
  }

  // Tool usage stats
  console.log('\n' + '='.repeat(50));
  console.log('🔧 도구 사용 통계 (Top 10)');
  console.log('='.repeat(50));

  const toolStats = getToolUsageStats();
  toolStats.slice(0, 10).forEach((stat, i) => {
    console.log(
      `${i + 1}. ${stat.tool_name}: ${stat.count.toLocaleString()}회`
    );
  });

  closeDatabase();
}
