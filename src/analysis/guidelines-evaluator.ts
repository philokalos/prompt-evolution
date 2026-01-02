/**
 * Guidelines Evaluator Module
 * 공식 프롬프트 엔지니어링 가이드라인 대비 평가
 *
 * References:
 * - Anthropic Claude 4 Best Practices
 * - GOLDEN Checklist (Goal, Output, Limits, Data, Evaluation, Next)
 * - BIV Loop (Baseline → Improve → Verify)
 */

import { extractFeatures, classifyPrompt } from './classifier.js';

/**
 * 가이드라인 평가 결과
 */
export interface GuidelineEvaluation {
  overallScore: number;           // 전체 준수도 (0-1)
  guidelineScores: GuidelineScore[];  // 개별 가이드라인 점수
  goldenScore: GOLDENScore;       // GOLDEN 체크리스트 점수
  antiPatterns: DetectedAntiPattern[];  // 탐지된 안티패턴
  recommendations: string[];      // 개선 권장사항
  grade: 'A' | 'B' | 'C' | 'D' | 'F';  // 등급
}

/**
 * 개별 가이드라인 점수
 */
export interface GuidelineScore {
  guideline: string;
  name: string;
  description: string;
  score: number;
  weight: number;
  evidence: string[];
  suggestion: string;
}

/**
 * GOLDEN 체크리스트 점수
 */
export interface GOLDENScore {
  goal: number;       // 목표 명확성
  output: number;     // 출력 형식
  limits: number;     // 제약조건
  data: number;       // 데이터/컨텍스트
  evaluation: number; // 평가 기준
  next: number;       // 다음 단계
  total: number;      // 총점
}

/**
 * 탐지된 안티패턴
 */
export interface DetectedAntiPattern {
  pattern: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  example?: string;
  fix: string;
}

/**
 * 공식 가이드라인 정의 (Anthropic Claude 4 Best Practices)
 */
const OFFICIAL_GUIDELINES = {
  beExplicit: {
    name: '명시적 지시',
    description: 'Be explicit with instructions - 구체적이고 명확한 지시 사용',
    weight: 0.20,
    check: (text: string): { score: number; evidence: string[] } => {
      const evidence: string[] = [];
      let score = 0;

      // 동사가 있는지 확인
      const hasVerb = /만들|생성|작성|수정|추가|삭제|변경|확인|create|make|build|write|update|add|remove|change|check/i.test(text);
      if (hasVerb) {
        score += 0.3;
        evidence.push('명령 동사 사용');
      }

      // 구체적인 대상이 있는지
      const features = extractFeatures(text);
      if (features.hasFilePath) {
        score += 0.3;
        evidence.push('파일 경로 명시');
      }

      // 길이가 적절한지 (20자 이상)
      if (features.length >= 20) {
        score += 0.2;
        evidence.push('충분한 설명 길이');
      }

      // 코드 블록 사용
      if (features.hasCodeBlock) {
        score += 0.2;
        evidence.push('코드 블록 포함');
      }

      return { score: Math.min(score, 1), evidence };
    },
    suggestion: '구체적인 동사와 대상을 명시하세요. 예: "UserService 클래스에 로그인 메서드를 추가해줘"',
  },

  addContext: {
    name: '컨텍스트 제공',
    description: 'Add context to improve performance - 배경 정보 제공',
    weight: 0.20,
    check: (text: string): { score: number; evidence: string[] } => {
      const evidence: string[] = [];
      let score = 0;

      // 상황 설명 패턴
      if (/현재|지금|상황|배경|currently|right now|situation|background/i.test(text)) {
        score += 0.3;
        evidence.push('현재 상황 설명');
      }

      // 목표/목적 명시
      if (/목표|목적|원하는|필요|goal|want|need|purpose/i.test(text)) {
        score += 0.3;
        evidence.push('목표/목적 명시');
      }

      // 환경/버전 정보
      if (/버전|환경|version|environment|react|vue|node|typescript/i.test(text)) {
        score += 0.2;
        evidence.push('환경/버전 정보');
      }

      // 관련 파일/코드 참조
      const features = extractFeatures(text);
      if (features.hasFilePath || features.hasCodeBlock) {
        score += 0.2;
        evidence.push('관련 코드/파일 참조');
      }

      return { score: Math.min(score, 1), evidence };
    },
    suggestion: '현재 상황, 목표, 기술 스택 정보를 포함하세요. 예: "React 18 프로젝트에서 상태 관리 문제가 있어요"',
  },

  useXMLTags: {
    name: 'XML 태그 활용',
    description: 'Use XML tags for structure - 구조화된 입력',
    weight: 0.15,
    check: (text: string): { score: number; evidence: string[] } => {
      const evidence: string[] = [];
      let score = 0;

      // XML 태그 사용
      if (/<[a-z][^>]*>[\s\S]*<\/[a-z][^>]*>/i.test(text)) {
        score += 0.5;
        evidence.push('XML 태그 사용');
      }

      // 마크다운 구조 사용
      if (/^#+\s|^\*\s|^-\s|^\d+\.\s/m.test(text)) {
        score += 0.3;
        evidence.push('마크다운 구조 사용');
      }

      // 코드 펜스 사용
      if (/```[\s\S]*```/.test(text)) {
        score += 0.2;
        evidence.push('코드 펜스 사용');
      }

      return { score: Math.min(score, 1), evidence };
    },
    suggestion: '<context>, <requirement>, <output_format> 같은 XML 태그로 프롬프트를 구조화하세요.',
  },

  chainOfThought: {
    name: '단계별 사고',
    description: 'Chain-of-thought prompting - 단계별 접근 요청',
    weight: 0.15,
    check: (text: string): { score: number; evidence: string[] } => {
      const evidence: string[] = [];
      let score = 0;

      // 단계별 요청
      if (/단계|step|순서|차례|먼저|그다음|step by step|one by one/i.test(text)) {
        score += 0.4;
        evidence.push('단계별 접근 요청');
      }

      // 설명 요청
      if (/설명|이유|왜|explain|reason|why/i.test(text)) {
        score += 0.3;
        evidence.push('이유/설명 요청');
      }

      // 생각 과정 요청
      if (/생각|think|consider|분석|analyze/i.test(text)) {
        score += 0.3;
        evidence.push('분석/사고 과정 요청');
      }

      return { score: Math.min(score, 1), evidence };
    },
    suggestion: '"단계별로 설명해줘" 또는 "왜 이 방법이 좋은지 설명해줘" 같은 요청을 추가하세요.',
  },

  specificOutput: {
    name: '출력 형식 명시',
    description: 'Specify output format - 원하는 결과물 형식 정의',
    weight: 0.15,
    check: (text: string): { score: number; evidence: string[] } => {
      const evidence: string[] = [];
      let score = 0;

      // 출력 형식 명시
      if (/형식|포맷|format|JSON|YAML|markdown|표|table|리스트|list/i.test(text)) {
        score += 0.4;
        evidence.push('출력 형식 명시');
      }

      // 예시 제공
      if (/예시|example|예를 들어|like this|such as/i.test(text)) {
        score += 0.3;
        evidence.push('예시 제공');
      }

      // 길이/분량 명시
      if (/간단히|짧게|자세히|상세히|brief|short|detailed|concise/i.test(text)) {
        score += 0.3;
        evidence.push('분량 명시');
      }

      return { score: Math.min(score, 1), evidence };
    },
    suggestion: '원하는 출력 형식을 명시하세요. 예: "JSON 형식으로 반환해줘" 또는 "3줄 이내로 요약해줘"',
  },

  constraints: {
    name: '제약조건 명시',
    description: 'Define constraints explicitly - 제약조건과 경계 설정',
    weight: 0.15,
    check: (text: string): { score: number; evidence: string[] } => {
      const evidence: string[] = [];
      let score = 0;

      // 제약조건 표현
      if (/하지 마|제외|않고|only|without|except|don't|not|avoid/i.test(text)) {
        score += 0.4;
        evidence.push('제약조건 명시');
      }

      // 범위 한정
      if (/만|만을|only|just|specific|특정/i.test(text)) {
        score += 0.3;
        evidence.push('범위 한정');
      }

      // 조건 명시
      if (/경우|조건|if|when|unless|condition/i.test(text)) {
        score += 0.3;
        evidence.push('조건 명시');
      }

      return { score: Math.min(score, 1), evidence };
    },
    suggestion: '제약조건을 명시하세요. 예: "외부 라이브러리 없이" 또는 "TypeScript만 사용해서"',
  },
};

/**
 * 안티패턴 정의
 */
const ANTI_PATTERNS = [
  {
    id: 'vague-objective',
    name: '모호한 목표',
    pattern: /^.{1,15}$/,
    severity: 'high' as const,
    description: '너무 짧고 모호한 프롬프트',
    fix: '구체적인 목표와 기대 결과를 명시하세요.',
  },
  {
    id: 'unstructured-context',
    name: '정리되지 않은 컨텍스트',
    pattern: /(?:[^\n]{200,})/,
    severity: 'medium' as const,
    description: '구조화되지 않은 긴 텍스트',
    fix: '마크다운이나 XML 태그로 내용을 구조화하세요.',
  },
  {
    id: 'implicit-constraints',
    name: '암묵적 제약조건',
    pattern: /^(?!.*(?:만|without|제외|don't|not)).*(?:해줘|create|make)/i,
    severity: 'low' as const,
    description: '제약조건 없이 열린 요청',
    fix: '제약조건이나 선호사항을 명시하세요.',
  },
  {
    id: 'missing-output-format',
    name: '출력 형식 미지정',
    pattern: /^(?!.*(?:형식|format|JSON|table|list|markdown)).*(?:알려줘|tell|show|explain)/i,
    severity: 'low' as const,
    description: '원하는 출력 형식을 지정하지 않음',
    fix: '원하는 출력 형식(JSON, 표, 리스트 등)을 명시하세요.',
  },
  {
    id: 'vague-reference',
    name: '모호한 참조',
    pattern: /이거|저거|그거|this|that|it(?!\s+is)/i,
    severity: 'medium' as const,
    description: '모호한 대명사 사용',
    fix: '구체적인 대상을 명시하세요. "이거" 대신 "UserService 클래스"처럼.',
  },
  {
    id: 'retry-without-context',
    name: '맥락 없는 재시도',
    pattern: /^(?:다시|again|retry|한번 더).{0,20}$/i,
    severity: 'high' as const,
    description: '왜 재시도하는지 설명 없음',
    fix: '무엇이 잘못되었는지, 어떻게 달라져야 하는지 설명하세요.',
  },
];

/**
 * 단일 프롬프트 가이드라인 평가
 */
export function evaluatePromptAgainstGuidelines(text: string): GuidelineEvaluation {
  const guidelineScores: GuidelineScore[] = [];
  let totalWeightedScore = 0;

  // 각 가이드라인 평가
  for (const [key, guideline] of Object.entries(OFFICIAL_GUIDELINES)) {
    const result = guideline.check(text);

    guidelineScores.push({
      guideline: key,
      name: guideline.name,
      description: guideline.description,
      score: result.score,
      weight: guideline.weight,
      evidence: result.evidence,
      suggestion: guideline.suggestion,
    });

    totalWeightedScore += result.score * guideline.weight;
  }

  // GOLDEN 점수 계산
  const goldenScore = calculateGOLDENScore(text);

  // 안티패턴 탐지
  const antiPatterns = detectAntiPatterns(text);

  // 권장사항 생성
  const recommendations = generateRecommendations(guidelineScores, antiPatterns);

  // 등급 계산
  const grade = calculateGrade(totalWeightedScore);

  return {
    overallScore: totalWeightedScore,
    guidelineScores,
    goldenScore,
    antiPatterns,
    recommendations,
    grade,
  };
}

/**
 * GOLDEN 점수 계산
 * - 더 포괄적인 한글 패턴 매칭 (존칭, 비존칭 모두 지원)
 * - 개선된 프롬프트가 더 높은 점수를 받도록 설계
 */
export function calculateGOLDENScore(text: string): GOLDENScore {
  const features = extractFeatures(text);
  const textLower = text.toLowerCase();

  // G - Goal (목표 명확성)
  // - 목표/의도 표현
  // - 동사 명령형 (해줘/해주세요/해 주세요 등)
  let goal = 0;
  if (/목표|목적|원하는|goal|want|need|purpose|요청|기능/i.test(text)) goal += 0.3;
  // 한글 동사 패턴 - 더 포괄적 (해줘, 해주세요, 해 주세요, 구현해, 작성해 등)
  if (/해\s?줘|해\s?주세요|해주시|하세요|합니다|해야|create|make|build|implement|generate|develop/i.test(text)) goal += 0.3;
  // 구체적 동작 동사
  if (/구현|작성|개발|생성|추가|수정|변경|설계|분석|리팩토링|구축|적용|설정|연동/i.test(text)) goal += 0.2;
  // 명확한 대상 언급
  if (/기능|컴포넌트|모듈|시스템|API|페이지|화면|폼|버튼|로그인|회원가입|인증/i.test(text)) goal += 0.2;

  // O - Output (출력 형식)
  let output = 0;
  if (/형식|포맷|format|JSON|table|list|구조|타입|인터페이스/i.test(text)) output += 0.4;
  if (/예시|example|샘플|sample|템플릿|template/i.test(text)) output += 0.3;
  // 코드 관련 출력 형식
  if (/\.tsx?|\.jsx?|\.py|\.java|\.go|코드|component|function|class/i.test(text)) output += 0.3;

  // L - Limits (제약조건)
  let limits = 0;
  if (/하지\s?마|제외|without|except|don't|not|금지|불가/i.test(text)) limits += 0.3;
  if (/만|only|just|specific|특정|한정/i.test(text)) limits += 0.2;
  // 기술적 제약
  if (/React|TypeScript|Firebase|Node|Python|Java|버전|version/i.test(text)) limits += 0.2;
  // 범위 제약
  if (/최대|최소|이상|이하|범위|사이|까지|부터/i.test(text)) limits += 0.3;

  // D - Data (데이터/컨텍스트)
  let data = 0;
  if (features.hasCodeBlock) data += 0.25;
  if (features.hasFilePath) data += 0.25;
  if (/현재|상황|background|context|환경|프로젝트|시스템|아키텍처/i.test(text)) data += 0.25;
  // 기술 스택 언급
  if (/사용|using|스택|stack|라이브러리|library|프레임워크|framework/i.test(text)) data += 0.25;

  // E - Evaluation (평가 기준)
  let evaluation = 0;
  if (/확인|검증|verify|validate|check|보장|ensure/i.test(text)) evaluation += 0.3;
  if (/테스트|test|성공|success|품질|quality|요구사항|requirement/i.test(text)) evaluation += 0.35;
  // 성능/보안 기준
  if (/성능|performance|보안|security|안전|안정|에러|error|예외/i.test(text)) evaluation += 0.35;

  // N - Next (다음 단계)
  let next = 0;
  if (/그다음|다음|then|after|next|이후|완료\s?후/i.test(text)) next += 0.35;
  if (/단계|step|순서|절차|프로세스|워크플로우|workflow/i.test(text)) next += 0.35;
  // 추가 작업 힌트
  if (/추가로|또한|그리고|추후|향후|확장/i.test(text)) next += 0.3;

  // 길이 보너스 (충분히 상세한 프롬프트)
  const wordCount = text.split(/\s+/).length;
  const lengthBonus = Math.min(wordCount / 50, 0.15); // 50단어 이상이면 최대 0.15 보너스

  const rawTotal = (goal + output + limits + data + evaluation + next) / 6;
  const total = Math.min(rawTotal + lengthBonus, 1);

  return {
    goal: Math.min(goal, 1),
    output: Math.min(output, 1),
    limits: Math.min(limits, 1),
    data: Math.min(data, 1),
    evaluation: Math.min(evaluation, 1),
    next: Math.min(next, 1),
    total: Math.min(total, 1),
  };
}

/**
 * 안티패턴 탐지
 */
export function detectAntiPatterns(text: string): DetectedAntiPattern[] {
  const detected: DetectedAntiPattern[] = [];

  for (const antiPattern of ANTI_PATTERNS) {
    if (antiPattern.pattern.test(text)) {
      detected.push({
        pattern: antiPattern.name,
        severity: antiPattern.severity,
        description: antiPattern.description,
        example: text.length <= 50 ? text : text.slice(0, 50) + '...',
        fix: antiPattern.fix,
      });
    }
  }

  return detected;
}

/**
 * 권장사항 생성
 */
function generateRecommendations(
  guidelineScores: GuidelineScore[],
  antiPatterns: DetectedAntiPattern[]
): string[] {
  const recommendations: string[] = [];

  // 낮은 점수 가이드라인에 대한 권장사항
  for (const score of guidelineScores) {
    if (score.score < 0.5) {
      recommendations.push(`[${score.name}] ${score.suggestion}`);
    }
  }

  // 안티패턴에 대한 권장사항
  for (const pattern of antiPatterns) {
    if (pattern.severity === 'high') {
      recommendations.unshift(`[긴급] ${pattern.pattern}: ${pattern.fix}`);
    } else {
      recommendations.push(`[${pattern.pattern}] ${pattern.fix}`);
    }
  }

  return recommendations.slice(0, 5);  // 최대 5개
}

/**
 * 등급 계산
 */
function calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 0.9) return 'A';
  if (score >= 0.75) return 'B';
  if (score >= 0.6) return 'C';
  if (score >= 0.4) return 'D';
  return 'F';
}

/**
 * 여러 프롬프트 일괄 평가
 */
export function evaluatePromptsAgainstGuidelines(texts: string[]): {
  evaluations: GuidelineEvaluation[];
  summary: GuidelinesSummary;
} {
  const evaluations = texts.map(evaluatePromptAgainstGuidelines);

  // 요약 통계
  const summary = calculateGuidelinesSummary(evaluations);

  return { evaluations, summary };
}

/**
 * 가이드라인 준수도 요약
 */
export interface GuidelinesSummary {
  averageScore: number;
  gradeDistribution: Record<'A' | 'B' | 'C' | 'D' | 'F', number>;
  weakestGuidelines: { name: string; averageScore: number }[];
  strongestGuidelines: { name: string; averageScore: number }[];
  commonAntiPatterns: { pattern: string; count: number }[];
  averageGOLDEN: GOLDENScore;
}

/**
 * 가이드라인 요약 계산
 */
function calculateGuidelinesSummary(evaluations: GuidelineEvaluation[]): GuidelinesSummary {
  if (evaluations.length === 0) {
    return {
      averageScore: 0,
      gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
      weakestGuidelines: [],
      strongestGuidelines: [],
      commonAntiPatterns: [],
      averageGOLDEN: { goal: 0, output: 0, limits: 0, data: 0, evaluation: 0, next: 0, total: 0 },
    };
  }

  // 평균 점수
  const averageScore = evaluations.reduce((sum, e) => sum + e.overallScore, 0) / evaluations.length;

  // 등급 분포
  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const e of evaluations) {
    gradeDistribution[e.grade]++;
  }

  // 가이드라인별 평균 점수
  const guidelineAverages = new Map<string, { total: number; count: number; name: string }>();
  for (const e of evaluations) {
    for (const gs of e.guidelineScores) {
      if (!guidelineAverages.has(gs.guideline)) {
        guidelineAverages.set(gs.guideline, { total: 0, count: 0, name: gs.name });
      }
      const data = guidelineAverages.get(gs.guideline)!;
      data.total += gs.score;
      data.count++;
    }
  }

  const guidelineRanking = Array.from(guidelineAverages.entries())
    .map(([_, data]) => ({ name: data.name, averageScore: data.total / data.count }))
    .sort((a, b) => a.averageScore - b.averageScore);

  // 안티패턴 빈도
  const antiPatternCounts = new Map<string, number>();
  for (const e of evaluations) {
    for (const ap of e.antiPatterns) {
      antiPatternCounts.set(ap.pattern, (antiPatternCounts.get(ap.pattern) || 0) + 1);
    }
  }

  const commonAntiPatterns = Array.from(antiPatternCounts.entries())
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // GOLDEN 평균
  const goldenSum = { goal: 0, output: 0, limits: 0, data: 0, evaluation: 0, next: 0, total: 0 };
  for (const e of evaluations) {
    goldenSum.goal += e.goldenScore.goal;
    goldenSum.output += e.goldenScore.output;
    goldenSum.limits += e.goldenScore.limits;
    goldenSum.data += e.goldenScore.data;
    goldenSum.evaluation += e.goldenScore.evaluation;
    goldenSum.next += e.goldenScore.next;
    goldenSum.total += e.goldenScore.total;
  }

  const n = evaluations.length;
  const averageGOLDEN: GOLDENScore = {
    goal: goldenSum.goal / n,
    output: goldenSum.output / n,
    limits: goldenSum.limits / n,
    data: goldenSum.data / n,
    evaluation: goldenSum.evaluation / n,
    next: goldenSum.next / n,
    total: goldenSum.total / n,
  };

  return {
    averageScore,
    gradeDistribution,
    weakestGuidelines: guidelineRanking.slice(0, 3),
    strongestGuidelines: guidelineRanking.slice(-3).reverse(),
    commonAntiPatterns,
    averageGOLDEN,
  };
}
