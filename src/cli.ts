#!/usr/bin/env node
/**
 * Prompt Evolution CLI
 */

import { listProjects, listSessions, parseSession } from './parser/index.js';
import {
  initializeDatabase,
  closeDatabase,
  getDatabasePath,
  databaseExists,
  insertConversation,
  insertTurns,
  insertToolUsages,
  conversationExists,
  getConversationCount,
  getTotalTurnCount,
  getTotalToolUsageCount,
  getToolUsageStats,
  getProjectStats,
  getAllConversations,
  getTurnsByConversationId,
  insertQualitySignals,
  getSignalStats,
  getTotalSignalCount,
  hasBeenAnalyzed,
  saveEffectivenessScore,
} from './db/index.js';
import {
  detectConversationSignals,
  analyzeEffectiveness,
  calculateAggregateEffectiveness,
  classifyPrompt,
  classifyPrompts,
  getClassificationStats,
  getIntentLabel,
  getCategoryLabel,
  generateInsights,
  formatReport,
  type TurnForAnalysis,
  type ConversationSignals,
  type ClassificationResult,
  type TimePeriod,
  type TaskCategory,
  type PromptData,
} from './analysis/index.js';
import type { ParsedConversation } from './types/index.js';
import { generateHtmlReport } from './report/index.js';
import {
  improvePromptWithLLM,
  improvePromptWithRules,
  type ImprovedPrompt,
} from './analysis/self-improvement.js';

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
Prompt Evolution - AI 대화 분석 및 프롬프트 진화 시스템

사용법:
  prompt-evolution <command> [options]

명령어:
  projects                     모든 프로젝트 목록
  sessions <project>           프로젝트 내 세션 목록
  parse <project> [session]    대화 파싱 및 출력
  stats                        전체 통계 (파일 기반)

  import [--project <id>]      DB로 대화 임포트
  import --incremental         새 세션만 추가
  db-stats                     DB 통계

  analyze [--incremental]      품질 신호 분석
  analyze --conversation <id>  특정 대화 분석

  insights                     전체 인사이트 리포트
  insights --period 7d         최근 7일 분석 (7d, 30d, 90d, all)
  insights --category <cat>    특정 카테고리만 (code-generation, bug-fix 등)
  insights --problems          문제점만 표시
  insights --strengths         강점만 표시

  classify "<text>"            프롬프트 분류 (텍스트 직접 입력)
  classify --all               모든 유저 턴 분류 분석
  classify --stats             분류 통계

  improve "<text>"             프롬프트 개선 (LLM 기반)
  improve "<text>" --offline   프롬프트 개선 (규칙 기반, API 없이)

  report [--output <path>]     HTML 리포트 생성
  report --period 7d           최근 7일 리포트
  help                         도움말

예시:
  prompt-evolution projects
  prompt-evolution import                    # 모든 세션 임포트
  prompt-evolution import --incremental      # 새 세션만 임포트
  prompt-evolution db-stats                  # DB 통계 확인
  prompt-evolution analyze                   # 모든 대화 품질 분석
  prompt-evolution analyze --incremental     # 분석 안 된 대화만
  prompt-evolution insights                  # 전체 인사이트 리포트
  prompt-evolution insights --period 30d    # 최근 30일 분석
  prompt-evolution insights --problems      # 문제점만 표시
  prompt-evolution classify "버그 수정해줘"  # 프롬프트 분류
  prompt-evolution classify --all            # 전체 유저 턴 분류 분석
  prompt-evolution improve "로그인 만들어줘" # LLM으로 프롬프트 개선
  prompt-evolution improve "API 만들어" --offline  # 규칙 기반 개선
  prompt-evolution report                    # HTML 리포트 생성
  prompt-evolution report --output ./my-report.html  # 경로 지정
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
  console.log('\n📊 전체 통계 (파일 기반)\n');

  const projects = listProjects();
  let totalSessions = 0;

  projects.forEach(project => {
    const sessions = listSessions(project);
    totalSessions += sessions.length;
  });

  console.log(`프로젝트: ${projects.length}개`);
  console.log(`세션: ${totalSessions}개`);
}

/**
 * Import conversations to SQLite database
 */
function importToDb(options: { project?: string; incremental?: boolean }) {
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
  const projects = options.project
    ? [options.project]
    : listProjects();

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
          console.error(`\n  Error: ${sessionFile}: ${(err as Error).message}`);
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
  console.log(`총: ${totalImported + totalSkipped + totalFailed}개 세션 처리됨`);
}

/**
 * Show database statistics
 */
function showDbStats() {
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
  console.log(`도구 사용 (tool_usages): ${toolUsageCount.toLocaleString()}개`);

  if (conversationCount > 0) {
    console.log(`평균 턴/대화: ${(turnCount / conversationCount).toFixed(1)}개`);
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
    console.log(`${i + 1}. ${stat.tool_name}: ${stat.count.toLocaleString()}회`);
  });

  closeDatabase();
}

/**
 * Analyze conversations for quality signals
 */
function analyzeConversations(options: {
  incremental?: boolean;
  conversationId?: string;
}) {
  console.log('\n🔍 품질 신호 분석\n');

  if (!databaseExists()) {
    console.log('⚠️  데이터베이스가 없습니다. 먼저 import 명령을 실행하세요.');
    return;
  }

  initializeDatabase();

  let conversations;
  if (options.conversationId) {
    // Analyze specific conversation
    const turns = getTurnsByConversationId(options.conversationId);
    if (turns.length === 0) {
      console.log(`⚠️  대화를 찾을 수 없습니다: ${options.conversationId}`);
      closeDatabase();
      return;
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
    console.log(`평균 효과성 점수: ${(aggregate.averageScore * 100).toFixed(1)}%`);
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
}

/**
 * Show insights report (enhanced version)
 */
function showInsights(options: {
  period?: string;
  category?: string;
  problemsOnly?: boolean;
  strengthsOnly?: boolean;
}) {
  if (!databaseExists()) {
    console.log('⚠️  데이터베이스가 없습니다. 먼저 import와 analyze 명령을 실행하세요.');
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
      console.log(`⚠️  알 수 없는 기간: ${options.period} (사용 가능: 7d, 30d, 90d, all)`);
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

/**
 * Generate HTML report
 */
function generateReport(options: {
  output?: string;
  period?: string;
}) {
  console.log('\n📄 HTML 리포트 생성\n');

  if (!databaseExists()) {
    console.log('⚠️  데이터베이스가 없습니다. 먼저 import와 analyze 명령을 실행하세요.');
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
        startDate = new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
        periodLabel = `최근 ${value}주`;
      } else {
        startDate = new Date(now.getTime() - value * 30 * 24 * 60 * 60 * 1000);
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
  let totalEffectiveness = 0;
  let effectivenessCount = 0;

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
      totalEffectiveness += 65; // Average placeholder
      effectivenessCount++;
    }
  }

  // Generate insights
  const insights = generateInsights(promptDataList, {
    period: periodLabel as TimePeriod,
  });

  // Default output path
  const outputPath = options.output || `./prompt-evolution-report-${Date.now()}.html`;

  // Generate HTML
  generateHtmlReport(insights, {
    outputPath,
    title: `Prompt Evolution 리포트 (${periodLabel})`,
  });

  console.log(`✅ 리포트 생성 완료: ${outputPath}`);
  console.log(`\n📊 요약:`);
  console.log(`   대화: ${insights.summary.totalConversations}개`);
  console.log(`   프롬프트: ${insights.summary.totalPrompts}개`);
  console.log(`   평균 효과성: ${insights.summary.overallEffectiveness.toFixed(1)}%`);

  closeDatabase();
}

/**
 * Classify prompts
 */
function classifyUserPrompts(options: {
  text?: string;
  all?: boolean;
  stats?: boolean;
}) {
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
    console.log(`  신뢰도: ${(result.categoryConfidence * 100).toFixed(1)}%`);

    if (result.matchedKeywords.length > 0) {
      console.log(`\n매칭된 키워드: ${result.matchedKeywords.join(', ')}`);
    }

    console.log('\n📋 특성');
    console.log(`  길이: ${result.features.length}자 (${result.features.wordCount}단어)`);
    console.log(`  복잡도: ${result.features.complexity}`);
    console.log(`  언어: ${result.features.languageHint}`);
    console.log(`  코드 블록: ${result.features.hasCodeBlock ? '있음' : '없음'}`);
    console.log(`  URL: ${result.features.hasUrl ? '있음' : '없음'}`);
    console.log(`  파일 경로: ${result.features.hasFilePath ? '있음' : '없음'}`);

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
    const allUserTurns: Array<{ content: string; conversationId: string }> = [];

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
    console.log(`평균 의도 신뢰도: ${(stats.avgIntentConfidence * 100).toFixed(1)}%`);
    console.log(`평균 카테고리 신뢰도: ${(stats.avgCategoryConfidence * 100).toFixed(1)}%`);

    console.log('\n' + '='.repeat(50));
    console.log('💬 의도 분포');
    console.log('='.repeat(50));

    const intentEntries = Object.entries(stats.intentDistribution)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    for (const [intent, count] of intentEntries) {
      const percent = ((count / stats.totalPrompts) * 100).toFixed(1);
      const label = getIntentLabel(intent as any);
      const bar = '█'.repeat(Math.round(count / stats.totalPrompts * 30));
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
      const bar = '█'.repeat(Math.round(count / stats.totalPrompts * 30));
      console.log(`${label}: ${count}개 (${percent}%) ${bar}`);
    }

    // Show some examples if not just stats
    if (options.all && !options.stats) {
      console.log('\n' + '='.repeat(50));
      console.log('📝 분류 예시 (처음 5개)');
      console.log('='.repeat(50));

      results.slice(0, 5).forEach((result, i) => {
        const turn = allUserTurns[i];
        const preview = turn.content.slice(0, 80) + (turn.content.length > 80 ? '...' : '');
        console.log(`\n${i + 1}. "${preview}"`);
        console.log(`   → ${getIntentLabel(result.intent)} | ${getCategoryLabel(result.taskCategory)}`);
      });
    }

    closeDatabase();
    return;
  }

  // No option specified
  console.log('사용법:');
  console.log('  prompt-evolution classify "<text>"  # 텍스트 직접 분류');
  console.log('  prompt-evolution classify --all     # 모든 유저 턴 분류');
  console.log('  prompt-evolution classify --stats   # 분류 통계만 표시');
}

/**
 * Improve a prompt using LLM or rules
 */
async function improveUserPrompt(options: {
  text?: string;
  offline?: boolean;
}) {
  if (!options.text) {
    console.log('사용법:');
    console.log('  prompt-evolution improve "<text>"            # LLM 기반 개선');
    console.log('  prompt-evolution improve "<text>" --offline  # 규칙 기반 개선');
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
      console.log('   환경 변수를 설정하거나 --offline 옵션을 사용하세요.\n');
      console.log('   예: export ANTHROPIC_API_KEY=sk-...');
      console.log('   또는: prompt-evolution improve "<text>" --offline\n');
      return;
    }

    result = await improvePromptWithLLM(options.text);

    if (!result) {
      console.log('❌ LLM 개선 실패. --offline 옵션으로 규칙 기반 개선을 시도해 보세요.');
      return;
    }
  }

  // Display results
  console.log('='.repeat(60));
  console.log('📊 분석 결과');
  console.log('='.repeat(60));
  console.log(`분류: ${result.classification.taskCategory} (${result.classification.intent})`);
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
    const diffStr = diff > 0 ? `+${(diff * 100).toFixed(0)}` : `${(diff * 100).toFixed(0)}`;
    const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
    console.log(`  ${dimLabels[dim]}: ${before}% → ${after}% (${arrow}${diffStr}%)`);
  }

  console.log('\n' + '-'.repeat(40));
  const beforeTotal = (result.originalScore.total * 100).toFixed(0);
  const afterTotal = (result.improvedScore.total * 100).toFixed(0);
  const improvement = result.improvementPercent > 0 ? `+${result.improvementPercent}` : `${result.improvementPercent}`;
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

/**
 * Get human-readable signal label
 */
function getSignalLabel(signalType: string): string {
  const labels: Record<string, string> = {
    positive_feedback: '😊 긍정적 피드백',
    negative_feedback: '😞 부정적 피드백',
    retry_attempt: '🔄 재시도',
    task_completion: '✅ 작업 완료',
    question: '❓ 질문',
    command: '⚡ 명령',
    context_providing: '📋 컨텍스트 제공',
  };
  return labels[signalType] || signalType;
}

// Parse flags
function parseFlags(args: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

const flags = parseFlags(args.slice(1));

// 메인 실행 (async wrapper for improve command)
(async () => {
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
    case 'import':
      importToDb({
        project: flags.project as string | undefined,
        incremental: flags.incremental === true,
      });
      break;
    case 'db-stats':
      showDbStats();
      break;
    case 'analyze':
      analyzeConversations({
        incremental: flags.incremental === true,
        conversationId: flags.conversation as string | undefined,
      });
      break;
    case 'insights':
      showInsights({
        period: flags.period as string | undefined,
        category: flags.category as string | undefined,
        problemsOnly: flags.problems === true,
        strengthsOnly: flags.strengths === true,
      });
      break;
    case 'classify': {
      // Check if first arg is text to classify (not a flag)
      const classifyText = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
      classifyUserPrompts({
        text: classifyText,
        all: flags.all === true,
        stats: flags.stats === true,
      });
      break;
    }
    case 'report':
      generateReport({
        output: flags.output as string | undefined,
        period: flags.period as string | undefined,
      });
      break;
    case 'improve': {
      const improveText = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
      await improveUserPrompt({
        text: improveText,
        offline: flags.offline === true,
      });
      break;
    }
    case 'help':
    case undefined:
      printHelp();
      break;
    default:
      console.error(`알 수 없는 명령: ${command}`);
      printHelp();
      process.exit(1);
  }
})();
