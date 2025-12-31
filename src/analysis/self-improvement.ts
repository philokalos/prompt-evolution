/**
 * Self-Improvement Module
 * 자기 학습 및 프롬프트 개선을 위한 피드백 생성
 */

import { TaskCategory, PromptIntent, classifyPrompt, extractFeatures } from './classifier.js';
import {
  evaluatePromptAgainstGuidelines,
  GuidelineEvaluation,
  GOLDENScore,
} from './guidelines-evaluator.js';

/**
 * 자기 개선 피드백
 */
export interface SelfImprovementFeedback {
  // 개선이 필요한 영역
  areasForImprovement: ImprovementArea[];

  // 잘하고 있는 영역
  strengths: StrengthArea[];

  // 학습 우선순위
  learningPriorities: LearningPriority[];

  // Before/After 예시
  rewriteExamples: RewriteExample[];

  // 개선 추이 (시간순)
  progressTrend: ProgressPoint[];

  // 주간 목표
  weeklyGoals: WeeklyGoal[];

  // 전체 요약
  summary: ImprovementSummary;
}

/**
 * 개선 영역
 */
export interface ImprovementArea {
  area: string;
  currentScore: number;
  targetScore: number;
  gap: number;
  specificAdvice: string;
  examples: {
    before: string;
    after: string;
    explanation: string;
  }[];
  priority: 'high' | 'medium' | 'low';
  estimatedImpact: string;
}

/**
 * 강점 영역
 */
export interface StrengthArea {
  area: string;
  score: number;
  evidence: string[];
  tip: string;
}

/**
 * 학습 우선순위
 */
export interface LearningPriority {
  rank: number;
  topic: string;
  reason: string;
  resources: ResourceLink[];
  exercises: string[];
}

/**
 * 학습 자료 링크
 */
export interface ResourceLink {
  title: string;
  url: string;
  type: 'article' | 'video' | 'documentation' | 'tutorial';
}

/**
 * Before/After 리라이트 예시
 */
export interface RewriteExample {
  category: TaskCategory;
  before: {
    prompt: string;
    issues: string[];
    score: number;
  };
  after: {
    prompt: string;
    improvements: string[];
    score: number;
  };
  keyChanges: string[];
}

/**
 * 진행 추이 포인트
 */
export interface ProgressPoint {
  date: Date;
  averageScore: number;
  promptCount: number;
  topCategory: TaskCategory;
}

/**
 * 주간 목표
 */
export interface WeeklyGoal {
  goal: string;
  metric: string;
  currentValue: number;
  targetValue: number;
  actionItems: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * 개선 요약
 */
export interface ImprovementSummary {
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  mainMessage: string;
  keyInsights: string[];
  quickWins: string[];
  longTermGoals: string[];
}

/**
 * 분석용 프롬프트 데이터
 */
export interface PromptDataForImprovement {
  content: string;
  conversationId: string;
  timestamp: Date;
  effectiveness: number;
}

/**
 * 자기 개선 피드백 생성
 */
export function generateSelfImprovementFeedback(
  prompts: PromptDataForImprovement[]
): SelfImprovementFeedback {
  if (prompts.length === 0) {
    return createEmptyFeedback();
  }

  // 모든 프롬프트 평가
  const evaluations = prompts.map(p => ({
    ...p,
    evaluation: evaluatePromptAgainstGuidelines(p.content),
    classification: classifyPrompt(p.content),
  }));

  // 개선 영역 분석
  const areasForImprovement = analyzeImprovementAreas(evaluations);

  // 강점 분석
  const strengths = analyzeStrengths(evaluations);

  // 학습 우선순위 결정
  const learningPriorities = prioritizeLearning(areasForImprovement);

  // Before/After 예시 생성
  const rewriteExamples = generateRewriteExamples(evaluations);

  // 진행 추이
  const progressTrend = calculateProgressTrend(evaluations);

  // 주간 목표
  const weeklyGoals = generateWeeklyGoals(areasForImprovement, evaluations);

  // 전체 요약
  const summary = generateSummary(evaluations, areasForImprovement, strengths);

  return {
    areasForImprovement,
    strengths,
    learningPriorities,
    rewriteExamples,
    progressTrend,
    weeklyGoals,
    summary,
  };
}

/**
 * 개선 영역 분석
 */
function analyzeImprovementAreas(
  evaluations: Array<{
    content: string;
    effectiveness: number;
    evaluation: GuidelineEvaluation;
  }>
): ImprovementArea[] {
  const areas: ImprovementArea[] = [];

  // 가이드라인별 평균 점수 계산
  const guidelineScores = new Map<string, { total: number; count: number; name: string }>();

  for (const e of evaluations) {
    for (const gs of e.evaluation.guidelineScores) {
      if (!guidelineScores.has(gs.guideline)) {
        guidelineScores.set(gs.guideline, { total: 0, count: 0, name: gs.name });
      }
      const data = guidelineScores.get(gs.guideline)!;
      data.total += gs.score;
      data.count++;
    }
  }

  // 낮은 점수 영역 식별
  for (const [guideline, data] of guidelineScores) {
    const avgScore = data.total / data.count;

    if (avgScore < 0.6) {
      const lowScoreExamples = evaluations
        .filter(e => {
          const gs = e.evaluation.guidelineScores.find(g => g.guideline === guideline);
          return gs && gs.score < 0.5;
        })
        .slice(0, 2);

      areas.push({
        area: data.name,
        currentScore: avgScore,
        targetScore: 0.8,
        gap: 0.8 - avgScore,
        specificAdvice: getAdviceForGuideline(guideline),
        examples: lowScoreExamples.map(e => ({
          before: truncate(e.content, 100),
          after: generateImprovedPrompt(e.content, guideline),
          explanation: getExplanationForImprovement(guideline),
        })),
        priority: avgScore < 0.3 ? 'high' : avgScore < 0.5 ? 'medium' : 'low',
        estimatedImpact: getEstimatedImpact(guideline),
      });
    }
  }

  // 우선순위 정렬
  return areas.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * 강점 분석
 */
function analyzeStrengths(
  evaluations: Array<{
    content: string;
    effectiveness: number;
    evaluation: GuidelineEvaluation;
  }>
): StrengthArea[] {
  const strengths: StrengthArea[] = [];

  // 가이드라인별 평균 점수 계산
  const guidelineScores = new Map<string, { total: number; count: number; name: string; evidence: string[] }>();

  for (const e of evaluations) {
    for (const gs of e.evaluation.guidelineScores) {
      if (!guidelineScores.has(gs.guideline)) {
        guidelineScores.set(gs.guideline, { total: 0, count: 0, name: gs.name, evidence: [] });
      }
      const data = guidelineScores.get(gs.guideline)!;
      data.total += gs.score;
      data.count++;
      if (gs.score >= 0.7) {
        data.evidence.push(...gs.evidence);
      }
    }
  }

  // 높은 점수 영역 식별
  for (const [_, data] of guidelineScores) {
    const avgScore = data.total / data.count;

    if (avgScore >= 0.7) {
      strengths.push({
        area: data.name,
        score: avgScore,
        evidence: [...new Set(data.evidence)].slice(0, 5),
        tip: `${data.name} 활용을 계속 유지하세요. 이 강점을 다른 영역에도 적용해보세요.`,
      });
    }
  }

  return strengths.sort((a, b) => b.score - a.score);
}

/**
 * 학습 우선순위 결정
 */
function prioritizeLearning(areas: ImprovementArea[]): LearningPriority[] {
  const priorities: LearningPriority[] = [];

  const resources: Record<string, ResourceLink[]> = {
    '명시적 지시': [
      { title: 'Anthropic Prompt Engineering Guide', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering', type: 'documentation' },
      { title: 'Be Clear and Direct', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct', type: 'article' },
    ],
    '컨텍스트 제공': [
      { title: 'Provide Context', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct#provide-context', type: 'documentation' },
    ],
    'XML 태그 활용': [
      { title: 'Use XML Tags', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags', type: 'documentation' },
    ],
    '단계별 사고': [
      { title: 'Chain of Thought', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/chain-of-thought', type: 'article' },
    ],
    '출력 형식 명시': [
      { title: 'Specify Output Format', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct#specify-the-output-format', type: 'documentation' },
    ],
    '제약조건 명시': [
      { title: 'Define Boundaries', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct', type: 'documentation' },
    ],
  };

  const exercises: Record<string, string[]> = {
    '명시적 지시': [
      '오늘 3개의 프롬프트에 구체적인 동사 사용하기',
      '모호한 표현 대신 정확한 대상 명시하기',
    ],
    '컨텍스트 제공': [
      '프롬프트 시작 시 현재 상황 한 문장으로 설명하기',
      '기술 스택/버전 정보 항상 포함하기',
    ],
    'XML 태그 활용': [
      '<context>, <requirement>, <output> 태그로 프롬프트 구조화하기',
      '복잡한 요청 시 마크다운 리스트 활용하기',
    ],
    '단계별 사고': [
      '"단계별로 설명해줘" 추가하기',
      '복잡한 문제에 "왜" 질문 포함하기',
    ],
    '출력 형식 명시': [
      '원하는 출력 형식(JSON, 표, 리스트) 명시하기',
      '응답 길이 가이드 제공하기',
    ],
    '제약조건 명시': [
      '사용하면 안 되는 것 명시하기',
      '범위 한정 조건 추가하기',
    ],
  };

  for (let i = 0; i < Math.min(areas.length, 3); i++) {
    const area = areas[i];
    priorities.push({
      rank: i + 1,
      topic: area.area,
      reason: `현재 점수 ${(area.currentScore * 100).toFixed(0)}%로, ${area.gap > 0.3 ? '즉각적인' : '점진적인'} 개선이 필요합니다.`,
      resources: resources[area.area] || [],
      exercises: exercises[area.area] || ['해당 영역 연습 문제 준비 중'],
    });
  }

  return priorities;
}

/**
 * Before/After 예시 생성
 */
function generateRewriteExamples(
  evaluations: Array<{
    content: string;
    effectiveness: number;
    evaluation: GuidelineEvaluation;
    classification: { taskCategory: TaskCategory };
  }>
): RewriteExample[] {
  const examples: RewriteExample[] = [];

  // 낮은 효과성 프롬프트 선택 (최대 5개)
  const lowScorePrompts = evaluations
    .filter(e => e.evaluation.overallScore < 0.5)
    .sort((a, b) => a.evaluation.overallScore - b.evaluation.overallScore)
    .slice(0, 5);

  for (const prompt of lowScorePrompts) {
    const issues = prompt.evaluation.guidelineScores
      .filter(gs => gs.score < 0.5)
      .map(gs => gs.name);

    const improvedPrompt = generateComprehensiveImprovement(prompt.content);

    examples.push({
      category: prompt.classification.taskCategory,
      before: {
        prompt: prompt.content,
        issues,
        score: prompt.evaluation.overallScore,
      },
      after: {
        prompt: improvedPrompt.text,
        improvements: improvedPrompt.improvements,
        score: improvedPrompt.estimatedScore,
      },
      keyChanges: improvedPrompt.keyChanges,
    });
  }

  // 큐레이트된 템플릿 예시 추가 (최소 10개 보장)
  const curatedExamples = getCuratedRewriteExamples();

  // 실제 데이터에서 부족한 카테고리의 예시 우선 추가
  const existingCategories = new Set(examples.map(e => e.category));
  const neededExamples = curatedExamples.filter(
    e => !existingCategories.has(e.category)
  );

  // 부족한 카테고리 예시 먼저 추가
  examples.push(...neededExamples);

  // 아직 10개 미만이면 남은 큐레이트 예시 추가
  if (examples.length < 10) {
    const remainingExamples = curatedExamples.filter(
      e => !neededExamples.includes(e)
    );
    const needed = 10 - examples.length;
    examples.push(...remainingExamples.slice(0, needed));
  }

  return examples;
}

/**
 * 큐레이트된 Before/After 예시 (교육용 템플릿)
 */
function getCuratedRewriteExamples(): RewriteExample[] {
  return [
    // 1. Code Generation - 기본
    {
      category: 'code-generation',
      before: {
        prompt: '로그인 기능 만들어줘',
        issues: ['명시적 지시 부족', '컨텍스트 부재', '출력 형식 미지정', '제약조건 없음'],
        score: 0.15,
      },
      after: {
        prompt: `[코드 생성 요청]

현재 상황:
- React 18 + TypeScript 프로젝트
- Firebase Auth 사용 중
- 기존 AuthContext가 있음

요청:
이메일/비밀번호 로그인 폼 컴포넌트를 만들어줘.

요구사항:
1. React Hook Form + Zod 검증 사용
2. 에러 메시지 한글로 표시
3. 로딩 상태 처리
4. AuthContext의 signIn 함수 연동

출력 형식:
- LoginForm.tsx 파일 전체 코드
- 사용된 타입 정의 포함`,
        improvements: ['작업 유형 태그 추가', '기술 스택 명시', '구체적 요구사항 나열', '출력 형식 지정'],
        score: 0.92,
      },
      keyChanges: ['컨텍스트 섹션 추가', '기술 스택 명시', '구조화된 요구사항', '명확한 출력 형식'],
    },

    // 2. Bug Fix - 에러 디버깅
    {
      category: 'bug-fix',
      before: {
        prompt: '에러 고쳐줘',
        issues: ['에러 내용 없음', '컨텍스트 부재', '재현 방법 없음'],
        score: 0.08,
      },
      after: {
        prompt: `[버그 수정 요청]

에러 메시지:
\`\`\`
TypeError: Cannot read properties of undefined (reading 'map')
at UserList.tsx:24
\`\`\`

재현 방법:
1. /users 페이지 접속
2. 로그인하지 않은 상태에서 새로고침

현재 코드 (UserList.tsx:20-30):
\`\`\`tsx
const UserList = () => {
  const { users } = useUsers();
  return users.map(u => <UserCard key={u.id} user={u} />);
};
\`\`\`

예상 원인: useUsers가 초기에 undefined 반환

원하는 결과:
- 에러 원인 분석
- 수정된 코드
- 동일 패턴 방지 방법`,
        improvements: ['에러 메시지 전문 포함', '재현 단계 명시', '관련 코드 첨부', '원하는 출력 구조화'],
        score: 0.95,
      },
      keyChanges: ['에러 스택 트레이스 포함', '재현 절차 문서화', '코드 컨텍스트 제공', '해결 방향 제시'],
    },

    // 3. Code Review
    {
      category: 'code-review',
      before: {
        prompt: '이 코드 봐줘',
        issues: ['리뷰 관점 불명확', '코드 없음', '기대하는 피드백 수준 없음'],
        score: 0.10,
      },
      after: {
        prompt: `[코드 리뷰 요청]

리뷰 대상: 결제 처리 서비스 클래스

\`\`\`typescript
class PaymentService {
  async processPayment(userId: string, amount: number) {
    const user = await db.users.findById(userId);
    if (user.balance >= amount) {
      user.balance -= amount;
      await db.users.save(user);
      await db.transactions.create({ userId, amount, type: 'payment' });
      return { success: true };
    }
    return { success: false, error: 'Insufficient balance' };
  }
}
\`\`\`

리뷰 관점:
1. 동시성 문제 (race condition)
2. 트랜잭션 처리
3. 에러 핸들링
4. 보안 취약점

기대하는 피드백:
- 문제점과 심각도 (상/중/하)
- 개선된 코드 예시
- 테스트 시나리오 제안`,
        improvements: ['리뷰 범위 명시', '코드 전문 첨부', '검토 관점 지정', '피드백 형식 요청'],
        score: 0.93,
      },
      keyChanges: ['목적 명확화', '코드 컨텍스트 제공', '리뷰 기준 제시', '출력 구조 지정'],
    },

    // 4. Refactoring
    {
      category: 'refactoring',
      before: {
        prompt: '이 함수 리팩토링해줘',
        issues: ['대상 코드 없음', '리팩토링 목표 불명확', '제약조건 없음'],
        score: 0.12,
      },
      after: {
        prompt: `[리팩토링 요청]

대상 코드:
\`\`\`javascript
function handleData(data) {
  let result = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i].status === 'active') {
      if (data[i].type === 'premium') {
        result.push({ ...data[i], discount: 0.2 });
      } else if (data[i].type === 'standard') {
        result.push({ ...data[i], discount: 0.1 });
      } else {
        result.push({ ...data[i], discount: 0 });
      }
    }
  }
  return result.sort((a, b) => b.discount - a.discount);
}
\`\`\`

리팩토링 목표:
1. 가독성 향상 (중첩 조건문 제거)
2. 함수형 스타일로 변환
3. 타입 안전성 추가 (TypeScript)

제약조건:
- 기존 동작 100% 유지
- 외부 라이브러리 사용 금지

원하는 결과:
- 리팩토링된 코드
- 각 변경의 이유 설명
- 단위 테스트 예시`,
        improvements: ['원본 코드 제공', '구체적 목표 나열', '제약조건 명시', '결과물 형식 지정'],
        score: 0.91,
      },
      keyChanges: ['명확한 리팩토링 목표', '기존 코드 포함', '제약조건 설정', '검증 방법 요청'],
    },

    // 5. Explanation - 개념 설명
    {
      category: 'explanation',
      before: {
        prompt: 'useEffect 설명해줘',
        issues: ['깊이 수준 미지정', '청중 수준 미지정', '원하는 형식 없음'],
        score: 0.20,
      },
      after: {
        prompt: `[개념 설명 요청]

주제: React useEffect 훅

내 수준:
- React 기초는 알지만 훅에 익숙하지 않음
- JavaScript 비동기는 이해함

설명해줄 내용:
1. useEffect가 필요한 이유 (클래스 컴포넌트 대비)
2. dependency array의 동작 원리
3. cleanup 함수의 역할과 실행 시점
4. 흔한 실수와 해결법

형식:
- 각 개념마다 간단한 코드 예시 포함
- 비유를 통한 설명 추가
- 실무에서 자주 쓰는 패턴 3가지`,
        improvements: ['학습자 수준 명시', '구체적 토픽 나열', '설명 형식 지정', '실용적 예시 요청'],
        score: 0.90,
      },
      keyChanges: ['배경 지식 수준 제공', '구체적 질문 목록', '원하는 설명 형식', '실용 사례 요청'],
    },

    // 6. Documentation
    {
      category: 'documentation',
      before: {
        prompt: 'README 써줘',
        issues: ['프로젝트 정보 없음', '대상 독자 불명', '포함할 섹션 미지정'],
        score: 0.15,
      },
      after: {
        prompt: `[문서 작성 요청]

프로젝트: prompt-evolution (프롬프트 분석 CLI 도구)

대상 독자:
- Claude Code 사용자
- 프롬프트 품질 개선에 관심있는 개발자

README에 포함할 섹션:
1. 프로젝트 소개 (한 문단)
2. 주요 기능 (불릿 리스트)
3. 설치 방법 (npm)
4. 빠른 시작 가이드 (3단계)
5. CLI 명령어 레퍼런스 (테이블)
6. 설정 옵션
7. 예시 출력 스크린샷 위치 표시

톤앤매너:
- 친근하지만 전문적
- 이모지 적절히 사용
- 한글로 작성`,
        improvements: ['프로젝트 컨텍스트 제공', '대상 독자 명시', '섹션 구조 지정', '톤앤매너 가이드'],
        score: 0.92,
      },
      keyChanges: ['프로젝트 정보 포함', '독자 페르소나 정의', '문서 구조 설계', '스타일 가이드 제공'],
    },

    // 7. Testing
    {
      category: 'testing',
      before: {
        prompt: '테스트 코드 작성해줘',
        issues: ['대상 코드 없음', '테스트 유형 미지정', '커버리지 목표 없음'],
        score: 0.18,
      },
      after: {
        prompt: `[테스트 코드 작성 요청]

대상 함수:
\`\`\`typescript
async function validateEmail(email: string): Promise<{
  valid: boolean;
  reason?: string;
}> {
  if (!email) return { valid: false, reason: 'Email required' };
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    return { valid: false, reason: 'Invalid format' };
  }
  const domain = email.split('@')[1];
  const isDisposable = await checkDisposableDomain(domain);
  if (isDisposable) return { valid: false, reason: 'Disposable email' };
  return { valid: true };
}
\`\`\`

테스트 요구사항:
1. 테스트 프레임워크: Vitest
2. 테스트 유형: 단위 테스트
3. 커버리지 목표: 100%

테스트 케이스:
- 정상 이메일 (성공)
- 빈 문자열 (실패)
- 잘못된 형식들 (여러 케이스)
- 일회용 이메일 도메인 (실패)

추가 요청:
- checkDisposableDomain은 모킹
- describe/it 구조 사용
- 각 테스트에 한글 설명`,
        improvements: ['대상 코드 제공', '테스트 환경 명시', '구체적 케이스 나열', '모킹 전략 지정'],
        score: 0.94,
      },
      keyChanges: ['테스트 대상 명확화', '프레임워크 지정', '테스트 케이스 설계', '모킹 요구사항'],
    },

    // 8. Architecture
    {
      category: 'architecture',
      before: {
        prompt: '구조 설계해줘',
        issues: ['요구사항 없음', '규모 불명', '기술 제약 없음'],
        score: 0.12,
      },
      after: {
        prompt: `[아키텍처 설계 요청]

프로젝트: 실시간 협업 문서 편집기

요구사항:
- 동시 편집자: 최대 50명
- 실시간 동기화: <100ms 지연
- 오프라인 지원 필요
- 버전 히스토리 (최근 30일)

기술 스택 제약:
- 프론트엔드: React (확정)
- 백엔드: Node.js or Go 중 선택
- DB: 자유 (추천 요청)

결정이 필요한 사항:
1. 실시간 동기화 방식 (WebSocket vs SSE vs WebRTC)
2. 충돌 해결 알고리즘 (OT vs CRDT)
3. 데이터베이스 선택
4. 마이크로서비스 vs 모놀리식

원하는 출력:
- 각 선택지의 장단점 비교표
- 추천 아키텍처 다이어그램 (ASCII)
- 예상 기술 스택 전체 목록
- MVP 단계 제안`,
        improvements: ['구체적 요구사항 나열', '기술 제약 명시', '결정 포인트 정리', '출력 형식 상세화'],
        score: 0.93,
      },
      keyChanges: ['비기능 요구사항 포함', '기술 스택 제약', '의사결정 포인트 명시', '출력 구조화'],
    },

    // 9. Data Analysis
    {
      category: 'data-analysis',
      before: {
        prompt: '데이터 분석해줘',
        issues: ['데이터 없음', '분석 목적 불명', '기대 결과 없음'],
        score: 0.10,
      },
      after: {
        prompt: `[데이터 분석 요청]

데이터: 월별 사용자 이탈률

\`\`\`csv
month,users,churned,churn_rate
2024-01,10000,500,5.0
2024-02,10500,630,6.0
2024-03,11000,880,8.0
2024-04,10200,1122,11.0
2024-05,9500,1235,13.0
\`\`\`

분석 목적:
- 이탈률 급증 원인 파악
- 향후 3개월 예측

분석 요청사항:
1. 이탈률 트렌드 분석 (증가율 계산)
2. 이상치 탐지 (급격한 변화 시점)
3. 가능한 원인 가설 3가지
4. 추가로 필요한 데이터 제안

출력 형식:
- 분석 결과 요약 (bullet points)
- 시각화 추천 (어떤 차트가 적절한지)
- 액션 아이템 제안`,
        improvements: ['실제 데이터 제공', '분석 목적 명시', '구체적 분석 항목', '출력 형식 지정'],
        score: 0.91,
      },
      keyChanges: ['데이터 샘플 포함', '분석 목표 정의', '기대 인사이트 명시', '출력 구조 요청'],
    },

    // 10. Deployment
    {
      category: 'deployment',
      before: {
        prompt: '배포해줘',
        issues: ['환경 정보 없음', '현재 상태 불명', '배포 대상 미지정'],
        score: 0.08,
      },
      after: {
        prompt: `[배포 가이드 요청]

프로젝트: React + Express 풀스택 앱

현재 상태:
- 로컬 개발 환경에서 정상 동작
- Docker 설정 없음
- CI/CD 없음

배포 환경:
- 타겟: AWS (EC2 or ECS)
- 도메인: example.com (Route53에 있음)
- SSL: 필요 (Let's Encrypt or ACM)

요구사항:
1. Docker 컨테이너화
2. GitHub Actions CI/CD
3. 환경변수 관리 (secrets)
4. 무중단 배포

원하는 결과:
- Dockerfile (프론트/백엔드)
- docker-compose.yml (로컬 테스트용)
- GitHub Actions workflow 파일
- 단계별 배포 가이드
- 예상 월 비용`,
        improvements: ['프로젝트 스택 명시', '현재 상태 설명', '타겟 환경 지정', '상세 요구사항 나열'],
        score: 0.94,
      },
      keyChanges: ['현재/목표 상태 명시', '인프라 요구사항', '단계별 가이드 요청', '비용 고려'],
    },

    // 11. General - API 사용
    {
      category: 'general',
      before: {
        prompt: 'API 어떻게 써?',
        issues: ['어떤 API인지 불명', '사용 목적 없음', '환경 정보 없음'],
        score: 0.05,
      },
      after: {
        prompt: `[API 사용 가이드 요청]

API: OpenAI Chat Completions API

사용 환경:
- Node.js 18 + TypeScript
- 이미 openai 패키지 설치됨
- API 키는 환경변수에 있음

구현하고 싶은 것:
1. 스트리밍 응답 처리
2. 에러 핸들링 (rate limit, timeout)
3. 재시도 로직
4. 토큰 사용량 추적

코드 스타일:
- async/await 사용
- 타입 정의 포함
- JSDoc 주석 추가

원하는 결과:
- 유틸리티 함수 (chatCompletion.ts)
- 사용 예시 코드
- 에러 타입 정의`,
        improvements: ['구체적 API 명시', '환경 정보 제공', '구현 목표 나열', '코드 스타일 지정'],
        score: 0.90,
      },
      keyChanges: ['대상 API 특정', '기술 환경 명시', '구체적 기능 요청', '코드 스타일 가이드'],
    },

    // 12. Performance - 최적화
    {
      category: 'code-generation',
      before: {
        prompt: '느려 빠르게 해줘',
        issues: ['현재 성능 수치 없음', '병목 지점 불명', '목표 성능 없음'],
        score: 0.10,
      },
      after: {
        prompt: `[성능 최적화 요청]

문제 상황:
- 페이지: 상품 목록 (/products)
- 현재 로딩 시간: 4.2초
- 목표 로딩 시간: <1초

프로파일링 결과:
1. API 응답: 2.1초 (500개 상품 전체 조회)
2. 렌더링: 1.5초 (500개 카드 컴포넌트)
3. 이미지 로딩: 0.6초

현재 코드:
\`\`\`tsx
const ProductList = () => {
  const [products, setProducts] = useState([]);
  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setProducts);
  }, []);
  return products.map(p => <ProductCard key={p.id} product={p} />);
};
\`\`\`

최적화 요청:
1. API: 페이지네이션 or 무한 스크롤
2. 렌더링: 가상화 (virtualization)
3. 이미지: lazy loading

제약조건:
- 기존 API 수정 가능
- 외부 라이브러리 사용 가능 (추천해줘)`,
        improvements: ['성능 측정값 제공', '병목 지점 분석 포함', '목표 수치 명시', '최적화 방향 제시'],
        score: 0.93,
      },
      keyChanges: ['현재 성능 데이터', '병목 분석 결과', '구체적 목표 설정', '해결 방향 제안'],
    },
  ];
}

/**
 * 종합 개선 프롬프트 생성
 */
function generateComprehensiveImprovement(original: string): {
  text: string;
  improvements: string[];
  estimatedScore: number;
  keyChanges: string[];
} {
  const features = extractFeatures(original);
  const classification = classifyPrompt(original);
  const improvements: string[] = [];
  const keyChanges: string[] = [];

  let improved = original;

  // 1. 너무 짧으면 확장
  if (features.length < 30) {
    improved = `[${getCategoryLabel(classification.taskCategory)}] ${improved}`;
    improvements.push('작업 유형 명시 추가');
    keyChanges.push('카테고리 태그 추가');
  }

  // 2. 컨텍스트 추가
  if (!/현재|상황|context/i.test(improved)) {
    improved = `현재 상황: [프로젝트/환경 설명]\n\n${improved}`;
    improvements.push('컨텍스트 섹션 추가');
    keyChanges.push('배경 정보 제공');
  }

  // 3. 출력 형식 추가
  if (!/형식|format|JSON|table/i.test(improved)) {
    improved += '\n\n원하는 출력 형식: [코드/설명/단계별 가이드]';
    improvements.push('출력 형식 명시');
    keyChanges.push('기대 결과 정의');
  }

  // 4. 구체적 지시 확인
  if (features.wordCount < 10) {
    improved = improved.replace(/해줘$|해$/, '해줘. 구체적인 예시와 함께 설명해줘.');
    improvements.push('구체적 요청 추가');
    keyChanges.push('상세 지시 보강');
  }

  // 예상 점수 (개선 수에 따라)
  const estimatedScore = Math.min(0.5 + improvements.length * 0.15, 0.95);

  return {
    text: improved,
    improvements,
    estimatedScore,
    keyChanges,
  };
}

/**
 * 진행 추이 계산
 */
function calculateProgressTrend(
  evaluations: Array<{
    timestamp: Date;
    evaluation: GuidelineEvaluation;
    classification: { taskCategory: TaskCategory };
  }>
): ProgressPoint[] {
  // 날짜별 그룹화
  const dateGroups = new Map<string, typeof evaluations>();

  for (const e of evaluations) {
    const dateKey = e.timestamp.toISOString().split('T')[0];
    if (!dateGroups.has(dateKey)) {
      dateGroups.set(dateKey, []);
    }
    dateGroups.get(dateKey)!.push(e);
  }

  // 날짜별 평균 계산
  const trend: ProgressPoint[] = [];

  for (const [dateStr, evals] of dateGroups) {
    const avgScore = evals.reduce((sum, e) => sum + e.evaluation.overallScore, 0) / evals.length;

    // 가장 많이 사용된 카테고리
    const categoryCounts = new Map<TaskCategory, number>();
    for (const e of evals) {
      const cat = e.classification.taskCategory;
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }

    let topCategory: TaskCategory = 'unknown';
    let maxCount = 0;
    for (const [cat, count] of categoryCounts) {
      if (count > maxCount) {
        maxCount = count;
        topCategory = cat;
      }
    }

    trend.push({
      date: new Date(dateStr),
      averageScore: avgScore,
      promptCount: evals.length,
      topCategory,
    });
  }

  return trend.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * 주간 목표 생성
 */
function generateWeeklyGoals(
  areas: ImprovementArea[],
  evaluations: Array<{ evaluation: GuidelineEvaluation }>
): WeeklyGoal[] {
  const goals: WeeklyGoal[] = [];

  // 현재 평균 점수
  const currentAvg = evaluations.reduce((sum, e) => sum + e.evaluation.overallScore, 0) / evaluations.length;

  // 목표 1: 전체 점수 향상
  goals.push({
    goal: '전체 가이드라인 준수도 향상',
    metric: '평균 점수',
    currentValue: currentAvg,
    targetValue: Math.min(currentAvg + 0.1, 0.9),
    actionItems: [
      '모든 프롬프트에 컨텍스트 추가하기',
      '출력 형식 항상 명시하기',
    ],
    difficulty: currentAvg < 0.5 ? 'easy' : 'medium',
  });

  // 목표 2: 가장 낮은 영역 집중 개선
  if (areas.length > 0) {
    const weakest = areas[0];
    goals.push({
      goal: `${weakest.area} 개선`,
      metric: `${weakest.area} 점수`,
      currentValue: weakest.currentScore,
      targetValue: Math.min(weakest.currentScore + 0.2, 0.8),
      actionItems: [weakest.specificAdvice],
      difficulty: weakest.priority === 'high' ? 'hard' : 'medium',
    });
  }

  // 목표 3: 일일 연습
  goals.push({
    goal: '일일 프롬프트 품질 연습',
    metric: '고품질 프롬프트 비율',
    currentValue: evaluations.filter(e => e.evaluation.overallScore >= 0.7).length / evaluations.length,
    targetValue: 0.5,
    actionItems: [
      '프롬프트 작성 전 체크리스트 확인',
      '하루 최소 3개 프롬프트에 GOLDEN 적용',
    ],
    difficulty: 'easy',
  });

  return goals;
}

/**
 * 전체 요약 생성
 */
function generateSummary(
  evaluations: Array<{ evaluation: GuidelineEvaluation }>,
  areas: ImprovementArea[],
  strengths: StrengthArea[]
): ImprovementSummary {
  const avgScore = evaluations.reduce((sum, e) => sum + e.evaluation.overallScore, 0) / evaluations.length;

  // 등급 결정
  const grade = avgScore >= 0.8 ? 'A' : avgScore >= 0.65 ? 'B' : avgScore >= 0.5 ? 'C' : avgScore >= 0.35 ? 'D' : 'F';

  // 메인 메시지
  let mainMessage: string;
  switch (grade) {
    case 'A':
      mainMessage = '훌륭합니다! 프롬프트 작성 실력이 매우 뛰어납니다. 세부 최적화에 집중하세요.';
      break;
    case 'B':
      mainMessage = '좋은 프롬프트 습관을 가지고 있습니다. 몇 가지 영역만 개선하면 됩니다.';
      break;
    case 'C':
      mainMessage = '기본기는 있지만 개선 여지가 있습니다. 학습 우선순위에 따라 연습하세요.';
      break;
    case 'D':
      mainMessage = '프롬프트 작성에 어려움이 있습니다. 기본 가이드라인부터 학습하세요.';
      break;
    default:
      mainMessage = '프롬프트 엔지니어링 기초부터 시작해야 합니다. 학습 자료를 참고하세요.';
  }

  // 핵심 인사이트
  const keyInsights: string[] = [];
  if (strengths.length > 0) {
    keyInsights.push(`강점: ${strengths[0].area} (${(strengths[0].score * 100).toFixed(0)}%)`);
  }
  if (areas.length > 0) {
    keyInsights.push(`개선 필요: ${areas[0].area} (${(areas[0].currentScore * 100).toFixed(0)}%)`);
  }
  keyInsights.push(`분석된 프롬프트: ${evaluations.length}개`);

  // 빠른 개선 (Quick Wins)
  const quickWins = areas
    .filter(a => a.priority === 'low' || a.gap < 0.3)
    .slice(0, 3)
    .map(a => a.specificAdvice);

  // 장기 목표
  const longTermGoals = areas
    .filter(a => a.priority === 'high')
    .slice(0, 2)
    .map(a => `${a.area}: ${a.specificAdvice}`);

  return {
    overallGrade: grade,
    mainMessage,
    keyInsights,
    quickWins: quickWins.length > 0 ? quickWins : ['현재 개선이 필요한 빠른 승리 항목이 없습니다.'],
    longTermGoals: longTermGoals.length > 0 ? longTermGoals : ['꾸준한 연습으로 전체 점수 향상'],
  };
}

// 헬퍼 함수들

function getAdviceForGuideline(guideline: string): string {
  const advice: Record<string, string> = {
    beExplicit: '구체적인 동사와 명확한 대상을 사용하세요. "이거 해줘" 대신 "UserService에 로그인 메서드 추가해줘"',
    addContext: '현재 상황, 목표, 기술 스택을 프롬프트 시작 부분에 포함하세요.',
    useXMLTags: '<context>, <requirement>, <output> 같은 태그로 프롬프트를 구조화하세요.',
    chainOfThought: '"단계별로 설명해줘" 또는 "왜 이 방법인지도 알려줘"를 추가하세요.',
    specificOutput: '원하는 출력 형식(JSON, 표, 코드 등)을 명시하세요.',
    constraints: '제약조건("외부 라이브러리 없이", "TypeScript만")을 명시하세요.',
  };
  return advice[guideline] || '해당 영역의 개선 방법을 연습하세요.';
}

function generateImprovedPrompt(original: string, guideline: string): string {
  const templates: Record<string, (text: string) => string> = {
    beExplicit: (t) => `[구체적 작업] ${t.replace(/이거|저거/, '해당 기능을')}`,
    addContext: (t) => `현재 상황: [프로젝트 설명]\n\n${t}`,
    useXMLTags: (t) => `<request>\n${t}\n</request>`,
    chainOfThought: (t) => `${t}\n\n단계별로 설명해줘.`,
    specificOutput: (t) => `${t}\n\n출력 형식: [코드/설명]`,
    constraints: (t) => `${t} (제약조건: [명시])`,
  };

  const transformer = templates[guideline];
  return transformer ? transformer(original) : original;
}

function getExplanationForImprovement(guideline: string): string {
  const explanations: Record<string, string> = {
    beExplicit: '모호한 표현을 구체적인 지시로 변경',
    addContext: '배경 정보 섹션 추가',
    useXMLTags: 'XML 태그로 구조화',
    chainOfThought: '단계별 사고 요청 추가',
    specificOutput: '출력 형식 명시',
    constraints: '제약조건 추가',
  };
  return explanations[guideline] || '가이드라인에 맞게 개선';
}

function getEstimatedImpact(guideline: string): string {
  const impacts: Record<string, string> = {
    beExplicit: 'AI 응답의 정확도가 크게 향상됩니다.',
    addContext: 'AI가 더 적절한 맥락에서 답변합니다.',
    useXMLTags: '복잡한 요청의 이해도가 향상됩니다.',
    chainOfThought: '더 깊이 있는 분석과 설명을 받습니다.',
    specificOutput: '원하는 형식의 결과를 바로 받습니다.',
    constraints: '불필요한 반복 수정이 줄어듭니다.',
  };
  return impacts[guideline] || '전반적인 응답 품질이 향상됩니다.';
}

function getCategoryLabel(category: TaskCategory): string {
  const labels: Record<TaskCategory, string> = {
    'code-generation': '코드 생성',
    'code-review': '코드 리뷰',
    'bug-fix': '버그 수정',
    'refactoring': '리팩토링',
    'explanation': '설명',
    'documentation': '문서화',
    'testing': '테스트',
    'architecture': '아키텍처',
    'deployment': '배포',
    'data-analysis': '데이터 분석',
    'general': '일반',
    'unknown': '미분류',
  };
  return labels[category];
}

function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

function createEmptyFeedback(): SelfImprovementFeedback {
  return {
    areasForImprovement: [],
    strengths: [],
    learningPriorities: [],
    rewriteExamples: [],
    progressTrend: [],
    weeklyGoals: [],
    summary: {
      overallGrade: 'F',
      mainMessage: '분석할 프롬프트가 없습니다.',
      keyInsights: [],
      quickWins: [],
      longTermGoals: [],
    },
  };
}
