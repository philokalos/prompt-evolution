#!/usr/bin/env node
/**
 * Prompt Evolution CLI
 */

import { listProjects, listSessions, parseSession } from './parser/index.js';

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
Prompt Evolution - AI 대화 분석 및 프롬프트 진화 시스템

사용법:
  prompt-evolution <command> [options]

명령어:
  projects              모든 프로젝트 목록
  sessions <project>    프로젝트 내 세션 목록
  parse <project> [session]  대화 파싱 및 출력
  stats                 전체 통계
  help                  도움말

예시:
  prompt-evolution projects
  prompt-evolution sessions -Users-philokalos-Development-active-claude-projects-Ledger
  prompt-evolution parse -Users-philokalos-Development-active-claude-projects-Ledger
`);
}

function showProjects() {
  console.log('\n📁 Claude Code 프로젝트 목록\n');
  const projects = listProjects();
  
  if (projects.length === 0) {
    console.log('프로젝트가 없습니다.');
    return;
  }
  
  projects.forEach((project, i) => {
    const sessions = listSessions(project);
    const decoded = project.replace(/-/g, '/').replace(/^\//, '');
    console.log(`${i + 1}. ${decoded}`);
    console.log(`   세션: ${sessions.length}개`);
    console.log(`   ID: ${project}\n`);
  });
  
  console.log(`총 ${projects.length}개 프로젝트`);
}

function showSessions(projectName: string) {
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

function parseAndShow(projectName: string, sessionFile?: string) {
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
  console.log(`토큰: 입력 ${conversation.totalInputTokens.toLocaleString()} / 출력 ${conversation.totalOutputTokens.toLocaleString()}`);
  console.log(`턴 수: ${conversation.turns.length}`);
  console.log('='.repeat(60));
  
  if (conversation.summaries.length > 0) {
    console.log('\n📋 세션 요약:');
    conversation.summaries.forEach(s => console.log(`  - ${s}`));
  }
  
  console.log('\n💬 대화 내용:\n');
  
  conversation.turns.slice(0, 10).forEach((turn, i) => {
    const role = turn.role === 'user' ? '👤 User' : '🤖 Assistant';
    const content = turn.content.slice(0, 200) + (turn.content.length > 200 ? '...' : '');
    console.log(`[${i + 1}] ${role} (${turn.timestamp.toLocaleTimeString()})`);
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

function showStats() {
  console.log('\n📊 전체 통계\n');
  
  const projects = listProjects();
  let totalSessions = 0;
  
  projects.forEach(project => {
    const sessions = listSessions(project);
    totalSessions += sessions.length;
  });
  
  console.log(`프로젝트: ${projects.length}개`);
  console.log(`세션: ${totalSessions}개`);
}

// 메인 실행
switch (command) {
  case 'projects':
    showProjects();
    break;
  case 'sessions':
    if (!args[1]) {
      console.error('프로젝트 이름을 지정하세요.');
      process.exit(1);
    }
    showSessions(args[1]);
    break;
  case 'parse':
    if (!args[1]) {
      console.error('프로젝트 이름을 지정하세요.');
      process.exit(1);
    }
    parseAndShow(args[1], args[2]);
    break;
  case 'stats':
    showStats();
    break;
  case 'help':
  case undefined:
    printHelp();
    break;
  default:
    console.error(`알 수 없는 명령: ${command}`);
    printHelp();
    process.exit(1);
}
