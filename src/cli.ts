#!/usr/bin/env node
/**
 * Prompt Evolution CLI
 */

// Import commands
import {
  projectsCommand,
  sessionsCommand,
  parseCommand,
  statsCommand,
  dbStatsCommand,
  importCommand,
  analyzeCommand,
  insightsCommand,
  classifyCommand,
  improveCommand,
  reportCommand,
} from './cli/commands/index.js';
import { parseFlags } from './cli/utils/index.js';


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

const flags = parseFlags(args.slice(1));

// 메인 실행 (async wrapper for improve command)
(async () => {
  switch (command) {
    case 'projects':
      projectsCommand();
      break;
    case 'sessions':
      if (!args[1]) {
        console.error('프로젝트 이름을 지정하세요.');
        process.exit(1);
      }
      sessionsCommand(args[1]);
      break;
    case 'parse':
      if (!args[1]) {
        console.error('프로젝트 이름을 지정하세요.');
        process.exit(1);
      }
      parseCommand(args[1], args[2]);
      break;
    case 'stats':
      statsCommand();
      break;
    case 'import':
      importCommand({
        project: flags.project as string | undefined,
        incremental: flags.incremental === true,
      });
      break;
    case 'db-stats':
      dbStatsCommand();
      break;
    case 'analyze':
      analyzeCommand({
        incremental: flags.incremental === true,
        conversationId: flags.conversation as string | undefined,
      });
      break;
    case 'insights':
      insightsCommand({
        period: flags.period as string | undefined,
        category: flags.category as string | undefined,
        problemsOnly: flags.problems === true,
        strengthsOnly: flags.strengths === true,
      });
      break;
    case 'classify': {
      // Check if first arg is text to classify (not a flag)
      const classifyText =
        args[1] && !args[1].startsWith('--') ? args[1] : undefined;
      classifyCommand({
        text: classifyText,
        all: flags.all === true,
        stats: flags.stats === true,
      });
      break;
    }
    case 'report':
      reportCommand({
        output: flags.output as string | undefined,
        period: flags.period as string | undefined,
      });
      break;
    case 'improve': {
      const improveText =
        args[1] && !args[1].startsWith('--') ? args[1] : undefined;
      await improveCommand({
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
