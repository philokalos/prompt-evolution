/**
 * Context Extractor Module
 *
 * 프롬프트 개선을 위한 컨텍스트 추출
 * - 기술 스택 감지
 * - 프로젝트 유형 추론
 * - 대화 히스토리 분석
 */

import type { ImprovementContext } from './llm-improver.js';

/**
 * 프롬프트 텍스트에서 컨텍스트 추출
 */
export function extractContextFromPrompt(text: string): ImprovementContext {
  return {
    techStack: detectTechStack(text),
    projectType: inferProjectType(text),
    language: detectLanguage(text),
  };
}

/**
 * 대화 히스토리에서 컨텍스트 추출
 */
export function extractContextFromHistory(
  messages: Array<{ role: string; content: string }>
): ImprovementContext {
  const allText = messages.map(m => m.content).join('\n');

  return {
    techStack: detectTechStack(allText),
    projectType: inferProjectType(allText),
    recentTask: extractRecentTask(messages),
    language: detectLanguage(allText),
  };
}

/**
 * 기술 스택 감지
 */
function detectTechStack(text: string): string[] {
  const techPatterns: Record<string, RegExp> = {
    // Frontend
    'React': /\breact\b|\bReact\b|\bjsx\b|\btsx\b|\buseState\b|\buseEffect\b/,
    'Vue': /\bvue\b|\bVue\b|\.vue\b|\bvuex\b|\bpinia\b/,
    'Angular': /\bangular\b|\bAngular\b|\bng\s/,
    'Next.js': /\bnext\.?js\b|\bNext\b|\bgetServerSideProps\b|\bgetStaticProps\b/,
    'Svelte': /\bsvelte\b|\bSvelte\b|\.svelte\b/,

    // Backend
    'Node.js': /\bnode\.?js\b|\bNode\b|\bexpress\b|\bnpm\b|\bpackage\.json\b/,
    'Python': /\bpython\b|\bPython\b|\.py\b|\bpip\b|\bdjango\b|\bflask\b|\bfastapi\b/,
    'Java': /\bjava\b|\bJava\b|\.java\b|\bspring\b|\bSpring\b|\bmaven\b|\bgradle\b/,
    'Go': /\bgo\b|\bgolang\b|\bGo\b|\.go\b/,
    'Rust': /\brust\b|\bRust\b|\.rs\b|\bcargo\b/,

    // Database
    'PostgreSQL': /\bpostgres\b|\bPostgreSQL\b|\bpsql\b/,
    'MySQL': /\bmysql\b|\bMySQL\b/,
    'MongoDB': /\bmongodb\b|\bMongoDB\b|\bmongo\b/,
    'Redis': /\bredis\b|\bRedis\b/,
    'SQLite': /\bsqlite\b|\bSQLite\b/,
    'Firestore': /\bfirestore\b|\bFirestore\b/,
    'Firebase': /\bfirebase\b|\bFirebase\b/,

    // Tools & Platforms
    'TypeScript': /\btypescript\b|\bTypeScript\b|\.ts\b|\.tsx\b|\btsconfig\b/,
    'Docker': /\bdocker\b|\bDocker\b|\bDockerfile\b|\bdocker-compose\b/,
    'Kubernetes': /\bkubernetes\b|\bk8s\b|\bkubectl\b/,
    'AWS': /\baws\b|\bAWS\b|\bs3\b|\blambda\b|\bec2\b/,
    'GCP': /\bgcp\b|\bGCP\b|\bgoogle cloud\b/,
    'Vercel': /\bvercel\b|\bVercel\b/,
    'Supabase': /\bsupabase\b|\bSupabase\b/,

    // Testing
    'Jest': /\bjest\b|\bJest\b|\.test\.\b|\.spec\.\b/,
    'Vitest': /\bvitest\b|\bVitest\b/,
    'Playwright': /\bplaywright\b|\bPlaywright\b/,
    'Cypress': /\bcypress\b|\bCypress\b/,

    // Build Tools
    'Vite': /\bvite\b|\bVite\b|vite\.config\b/,
    'Webpack': /\bwebpack\b|\bWebpack\b/,
    'ESBuild': /\besbuild\b|\bESBuild\b/,

    // CSS
    'Tailwind': /\btailwind\b|\bTailwind\b|\btailwindcss\b/,
    'SCSS': /\bscss\b|\bSCSS\b|\bsass\b/,
    'CSS Modules': /\.module\.css\b|\.module\.scss\b/,

    // State Management
    'Redux': /\bredux\b|\bRedux\b|\buseDispatch\b|\buseSelector\b/,
    'Zustand': /\bzustand\b|\bZustand\b/,
    'React Query': /\breact-query\b|\btanstack\/query\b|\buseQuery\b/,

    // API
    'GraphQL': /\bgraphql\b|\bGraphQL\b|\bgql\b/,
    'REST': /\bREST\b|\brest api\b|\bRESTful\b/,
    'tRPC': /\btrpc\b|\btRPC\b/,
  };

  const detected: string[] = [];

  for (const [tech, pattern] of Object.entries(techPatterns)) {
    if (pattern.test(text)) {
      detected.push(tech);
    }
  }

  return detected.slice(0, 10); // 최대 10개
}

/**
 * 프로젝트 유형 추론
 */
function inferProjectType(text: string): string {
  const patterns: Array<{ type: string; keywords: RegExp }> = [
    { type: 'web-app', keywords: /웹\s*앱|web\s*app|SPA|SSR|웹\s*애플리케이션/i },
    { type: 'mobile-app', keywords: /모바일\s*앱|mobile\s*app|iOS|android|react\s*native|flutter/i },
    { type: 'api-server', keywords: /API\s*서버|백엔드|backend|REST\s*API|GraphQL\s*API/i },
    { type: 'cli-tool', keywords: /CLI|커맨드\s*라인|command\s*line|터미널|terminal/i },
    { type: 'library', keywords: /라이브러리|library|패키지|package|npm|pypi/i },
    { type: 'microservice', keywords: /마이크로서비스|microservice|MSA|컨테이너|container/i },
    { type: 'data-pipeline', keywords: /데이터\s*파이프라인|ETL|데이터\s*처리|batch/i },
    { type: 'ml-project', keywords: /머신러닝|machine\s*learning|ML|AI|모델|model|학습|training/i },
    { type: 'e-commerce', keywords: /이커머스|e-commerce|쇼핑몰|장바구니|결제|payment/i },
    { type: 'dashboard', keywords: /대시보드|dashboard|관리자|admin|analytics/i },
    { type: 'blog', keywords: /블로그|blog|CMS|콘텐츠/i },
    { type: 'portfolio', keywords: /포트폴리오|portfolio|개인\s*사이트/i },
  ];

  for (const { type, keywords } of patterns) {
    if (keywords.test(text)) {
      return type;
    }
  }

  return 'general';
}

/**
 * 최근 작업 추출
 */
function extractRecentTask(
  messages: Array<{ role: string; content: string }>
): string | undefined {
  // 최근 5개 메시지에서 작업 힌트 추출
  const recentUserMessages = messages
    .filter(m => m.role === 'user')
    .slice(-5)
    .map(m => m.content);

  if (recentUserMessages.length === 0) return undefined;

  // 가장 최근 메시지에서 핵심 작업 추출
  const lastMessage = recentUserMessages[recentUserMessages.length - 1];

  // 작업 패턴 감지
  const taskPatterns: Array<{ pattern: RegExp; extract: (match: RegExpMatchArray) => string }> = [
    {
      pattern: /(?:만들|생성|구현|추가|작성)(?:어|해|하[고자]?)?\s*(?:줘|주세요|달라)?.*?([가-힣a-zA-Z0-9_\s]+)(?:을|를)?/,
      extract: (match) => match[1]?.trim() || '',
    },
    {
      pattern: /(?:create|build|implement|add|write)\s+(?:a\s+)?([a-zA-Z0-9_\s]+)/i,
      extract: (match) => match[1]?.trim() || '',
    },
    {
      pattern: /(?:수정|변경|고쳐|fix|update|modify)\s*([가-힣a-zA-Z0-9_\s]+)?/i,
      extract: () => 'bug fix or modification',
    },
    {
      pattern: /(?:설명|explain|what|how|why)/i,
      extract: () => 'explanation request',
    },
  ];

  for (const { pattern, extract } of taskPatterns) {
    const match = lastMessage.match(pattern);
    if (match) {
      const task = extract(match);
      if (task.length > 2) {
        return task.slice(0, 50); // 최대 50자
      }
    }
  }

  // 폴백: 첫 30자
  return lastMessage.slice(0, 30).trim() + (lastMessage.length > 30 ? '...' : '');
}

/**
 * 언어 감지
 */
function detectLanguage(text: string): 'ko' | 'en' {
  const koreanPattern = /[\uac00-\ud7af]/;
  const koreanCount = (text.match(/[\uac00-\ud7af]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;

  // 한글이 10% 이상이면 한국어로 판단
  if (koreanPattern.test(text) && koreanCount / totalChars > 0.1) {
    return 'ko';
  }
  return 'en';
}

/**
 * Claude Code 세션 파일에서 컨텍스트 추출
 */
export function extractContextFromSessionFile(
  records: Array<{ type: string; message?: { role?: string; content?: unknown } }>
): ImprovementContext {
  const userMessages: Array<{ role: string; content: string }> = [];

  for (const record of records) {
    if (record.type === 'user' && record.message) {
      const content = record.message.content;
      let textContent = '';

      if (typeof content === 'string') {
        textContent = content;
      } else if (Array.isArray(content)) {
        textContent = content
          .filter((b: { type: string }) => b.type === 'text')
          .map((b: { text: string }) => b.text)
          .join('\n');
      }

      if (textContent) {
        userMessages.push({ role: 'user', content: textContent });
      }
    }
  }

  return extractContextFromHistory(userMessages);
}

/**
 * package.json에서 기술 스택 추출
 */
export function extractTechStackFromPackageJson(
  packageJson: Record<string, unknown>
): string[] {
  const techStack: string[] = [];

  const deps = {
    ...(packageJson.dependencies as Record<string, string> || {}),
    ...(packageJson.devDependencies as Record<string, string> || {}),
  };

  const packageMapping: Record<string, string> = {
    'react': 'React',
    'react-dom': 'React',
    'next': 'Next.js',
    'vue': 'Vue',
    'nuxt': 'Nuxt.js',
    '@angular/core': 'Angular',
    'svelte': 'Svelte',
    'typescript': 'TypeScript',
    'express': 'Express',
    'fastify': 'Fastify',
    'koa': 'Koa',
    'tailwindcss': 'Tailwind',
    '@tanstack/react-query': 'React Query',
    'react-query': 'React Query',
    'redux': 'Redux',
    '@reduxjs/toolkit': 'Redux Toolkit',
    'zustand': 'Zustand',
    'vite': 'Vite',
    'jest': 'Jest',
    'vitest': 'Vitest',
    'playwright': 'Playwright',
    '@playwright/test': 'Playwright',
    'firebase': 'Firebase',
    'firebase-admin': 'Firebase Admin',
    '@prisma/client': 'Prisma',
    'mongoose': 'MongoDB',
    'pg': 'PostgreSQL',
    'mysql2': 'MySQL',
    'better-sqlite3': 'SQLite',
  };

  for (const pkg of Object.keys(deps)) {
    if (packageMapping[pkg]) {
      techStack.push(packageMapping[pkg]);
    }
  }

  // 중복 제거
  return [...new Set(techStack)];
}
