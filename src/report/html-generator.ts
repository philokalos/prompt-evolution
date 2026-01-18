/**
 * HTML Report Generator
 * 인사이트 데이터를 정적 HTML 파일로 생성
 *
 * 신규 섹션 (Phase 4):
 * - 프롬프트 라이브러리: 효과적인 프롬프트 Top 10, 템플릿
 * - 가이드라인 준수도: GOLDEN 점수 시각화, 안티패턴 경고
 * - 자기 개선 피드백: Before/After 예시, 학습 우선순위
 * - 액션 아이템: 주간 목표, 체크리스트
 */

import { writeFileSync } from 'fs';
import type {
  InsightsReport,
  CategoryInsight,
  Insight,
  PrioritizedRecommendation,
  PromptLibrary,
  GuidelinesSummary,
  GOLDENScore,
  SelfImprovementFeedback,
} from '../analysis/insights.js';

export interface ReportOptions {
  outputPath: string;
  title?: string;
}

/**
 * Generate HTML report from insights data
 */
export function generateHtmlReport(report: InsightsReport, options: ReportOptions): string {
  const title = options.title || 'Prompt Evolution 인사이트 리포트';

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    ${getStyles()}
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📊 ${title}</h1>
      <p class="subtitle">생성: ${report.generatedAt.toLocaleString('ko-KR')}</p>
      <p class="period">기간: ${report.period}</p>
    </header>

    ${generateSummarySection(report)}
    ${generateProblemsSection(report.problems)}
    ${generateImprovementsSection(report.improvements)}
    ${generateStrengthsSection(report.strengths)}
    ${generateCategorySection(report.categoryBreakdown)}
    ${generateGuidelinesSection(report.guidelinesSummary)}
    ${generatePromptLibrarySection(report.promptLibrary)}
    ${generateSelfImprovementSection(report.selfImprovement)}
    ${generateRecommendationsSection(report.recommendations)}

    <footer>
      <p>Prompt Evolution - AI 대화 분석 시스템</p>
    </footer>
  </div>
</body>
</html>`;

  writeFileSync(options.outputPath, html, 'utf-8');
  return options.outputPath;
}

function getStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e4e4e7;
      min-height: 100vh;
      line-height: 1.6;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      text-align: center;
      margin-bottom: 3rem;
      padding: 2rem;
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.1);
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      background: linear-gradient(90deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle, .period {
      color: #a1a1aa;
      font-size: 0.9rem;
    }

    section {
      background: rgba(255,255,255,0.03);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border: 1px solid rgba(255,255,255,0.08);
    }

    h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
    }

    .stat-card {
      background: rgba(255,255,255,0.05);
      padding: 1.25rem;
      border-radius: 10px;
      text-align: center;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      background: linear-gradient(90deg, #34d399, #60a5fa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .stat-label {
      color: #a1a1aa;
      font-size: 0.85rem;
      margin-top: 0.25rem;
    }

    .problem-item, .improvement-item, .strength-item {
      padding: 1rem;
      margin-bottom: 0.75rem;
      border-radius: 8px;
      border-left: 4px solid;
    }

    .problem-item {
      background: rgba(239, 68, 68, 0.1);
      border-color: #ef4444;
    }

    .problem-item.warning {
      background: rgba(245, 158, 11, 0.1);
      border-color: #f59e0b;
    }

    .improvement-item {
      background: rgba(59, 130, 246, 0.1);
      border-color: #3b82f6;
    }

    .strength-item {
      background: rgba(34, 197, 94, 0.1);
      border-color: #22c55e;
    }

    .item-title {
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .item-desc {
      color: #a1a1aa;
      font-size: 0.9rem;
    }

    .recommendation {
      color: #60a5fa;
      font-size: 0.85rem;
      margin-top: 0.5rem;
    }

    .examples {
      background: rgba(0,0,0,0.2);
      padding: 0.75rem;
      border-radius: 6px;
      margin: 0.5rem 0;
      font-family: monospace;
      font-size: 0.8rem;
      color: #a1a1aa;
    }

    .category-item {
      display: flex;
      align-items: center;
      padding: 0.75rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .category-item:last-child {
      border-bottom: none;
    }

    .category-name {
      width: 140px;
      font-weight: 500;
    }

    .category-bar-container {
      flex: 1;
      margin: 0 1rem;
    }

    .category-bar {
      height: 24px;
      background: linear-gradient(90deg, #3b82f6, #60a5fa);
      border-radius: 4px;
      display: flex;
      align-items: center;
      padding-left: 8px;
      font-size: 0.8rem;
      font-weight: 500;
      min-width: 40px;
    }

    .category-stats {
      width: 100px;
      text-align: right;
      color: #a1a1aa;
      font-size: 0.85rem;
    }

    .priority-list {
      counter-reset: priority;
    }

    .priority-item {
      display: flex;
      align-items: flex-start;
      padding: 0.75rem;
      margin-bottom: 0.5rem;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
    }

    .priority-item::before {
      counter-increment: priority;
      content: counter(priority);
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 600;
      margin-right: 1rem;
      flex-shrink: 0;
    }

    footer {
      text-align: center;
      padding: 2rem;
      color: #71717a;
      font-size: 0.85rem;
    }

    /* GOLDEN Score Radar Chart */
    .golden-container {
      display: flex;
      flex-wrap: wrap;
      gap: 2rem;
      align-items: flex-start;
    }

    .golden-chart {
      flex: 1;
      min-width: 280px;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .golden-details {
      flex: 1;
      min-width: 280px;
    }

    .golden-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .golden-item:last-child {
      border-bottom: none;
    }

    .golden-label {
      font-weight: 500;
    }

    .golden-score {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .golden-bar {
      width: 100px;
      height: 8px;
      background: rgba(255,255,255,0.1);
      border-radius: 4px;
      overflow: hidden;
    }

    .golden-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .golden-value {
      font-size: 0.85rem;
      color: #a1a1aa;
      min-width: 40px;
      text-align: right;
    }

    /* Anti-pattern Warning */
    .antipattern-item {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.75rem;
    }

    .antipattern-title {
      color: #ef4444;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .antipattern-desc {
      color: #a1a1aa;
      font-size: 0.9rem;
    }

    /* Prompt Library */
    .library-grid {
      display: grid;
      gap: 1rem;
    }

    .library-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 1rem;
    }

    .library-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }

    .library-category {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .library-score {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      color: #34d399;
      font-size: 0.85rem;
    }

    .library-pattern {
      background: rgba(0,0,0,0.2);
      border-radius: 6px;
      padding: 0.75rem;
      font-family: monospace;
      font-size: 0.85rem;
      line-height: 1.5;
      margin-bottom: 0.75rem;
      color: #e4e4e7;
    }

    .library-keywords {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .library-keyword {
      background: rgba(96, 165, 250, 0.15);
      color: #60a5fa;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }

    /* Self Improvement Section */
    .improvement-area {
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 10px;
      padding: 1.25rem;
      margin-bottom: 1rem;
    }

    .improvement-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .improvement-title {
      font-weight: 600;
      color: #60a5fa;
    }

    .improvement-score-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
    }

    .score-current {
      color: #f59e0b;
    }

    .score-arrow {
      color: #a1a1aa;
    }

    .score-target {
      color: #34d399;
    }

    .before-after {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin: 1rem 0;
    }

    .before-box, .after-box {
      border-radius: 8px;
      padding: 0.75rem;
    }

    .before-box {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
    }

    .after-box {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
    }

    .box-label {
      font-size: 0.75rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .before-box .box-label { color: #ef4444; }
    .after-box .box-label { color: #22c55e; }

    .box-content {
      font-family: monospace;
      font-size: 0.8rem;
      color: #d4d4d8;
      line-height: 1.5;
    }

    /* Learning Priority */
    .learning-list {
      display: grid;
      gap: 0.75rem;
    }

    .learning-item {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      padding: 1rem;
      background: rgba(255,255,255,0.02);
      border-radius: 8px;
    }

    .learning-rank {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      font-weight: 600;
      flex-shrink: 0;
    }

    .learning-content h4 {
      margin-bottom: 0.25rem;
    }

    .learning-reason {
      color: #a1a1aa;
      font-size: 0.85rem;
    }

    /* Weekly Goals */
    .goals-list {
      display: grid;
      gap: 0.5rem;
    }

    .goal-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: rgba(255,255,255,0.02);
      border-radius: 6px;
    }

    .goal-checkbox {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: transparent;
      flex-shrink: 0;
    }

    .goal-item.completed .goal-checkbox {
      background: #22c55e;
      border-color: #22c55e;
      color: white;
    }

    .goal-text {
      flex: 1;
    }

    .goal-difficulty {
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background: rgba(255,255,255,0.1);
      color: #a1a1aa;
    }

    .subsection-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 1.5rem 0 1rem 0;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      color: #d4d4d8;
    }

    .compliance-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .compliance-card {
      background: rgba(255,255,255,0.03);
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
    }

    .compliance-value {
      font-size: 1.5rem;
      font-weight: 700;
    }

    .compliance-label {
      font-size: 0.8rem;
      color: #a1a1aa;
      margin-top: 0.25rem;
    }

    @media (max-width: 640px) {
      .container {
        padding: 1rem;
      }

      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .category-name {
        width: 100px;
        font-size: 0.85rem;
      }

      .before-after {
        grid-template-columns: 1fr;
      }

      .golden-container {
        flex-direction: column;
      }
    }
  `;
}

function generateSummarySection(report: InsightsReport): string {
  return `
    <section>
      <h2>📈 요약</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${report.summary.totalConversations}</div>
          <div class="stat-label">총 대화</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${report.summary.totalPrompts}</div>
          <div class="stat-label">총 프롬프트</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${report.summary.overallEffectiveness.toFixed(1)}%</div>
          <div class="stat-label">평균 효과성</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${report.summary.overallQuality.toFixed(1)}%</div>
          <div class="stat-label">평균 품질</div>
        </div>
      </div>
    </section>
  `;
}

function generateProblemsSection(problems: Insight[]): string {
  if (problems.length === 0) return '';

  const items = problems.map(p => `
    <div class="problem-item ${p.severity === 'warning' ? 'warning' : ''}">
      <div class="item-title">${getSeverityIcon(p.severity)} ${p.title}</div>
      <div class="item-desc">${p.description}</div>
      ${p.evidence.length > 0 ? `<div class="examples">${p.evidence.slice(0, 3).map((e: string) => `• ${truncate(e, 60)}`).join('<br>')}</div>` : ''}
      ${p.recommendations.length > 0 ? `<div class="recommendation">💡 ${p.recommendations[0]}</div>` : ''}
    </div>
  `).join('');

  return `
    <section>
      <h2>🔴 문제점</h2>
      ${items}
    </section>
  `;
}

function generateImprovementsSection(improvements: Insight[]): string {
  if (improvements.length === 0) return '';

  const items = improvements.map(i => `
    <div class="improvement-item">
      <div class="item-title">ℹ️ ${i.title}</div>
      <div class="item-desc">${i.description}</div>
      ${i.recommendations.length > 0 ? `<div class="recommendation">💡 ${i.recommendations[0]}</div>` : ''}
    </div>
  `).join('');

  return `
    <section>
      <h2>🟡 개선 기회</h2>
      ${items}
    </section>
  `;
}

function generateStrengthsSection(strengths: Insight[]): string {
  if (strengths.length === 0) return '';

  const items = strengths.map(s => `
    <div class="strength-item">
      <div class="item-title">🟢 ${s.title}</div>
      <div class="item-desc">${s.description}</div>
    </div>
  `).join('');

  return `
    <section>
      <h2>🟢 강점</h2>
      ${items}
    </section>
  `;
}

function generateCategorySection(categories: CategoryInsight[]): string {
  if (categories.length === 0) return '';

  const maxCount = Math.max(...categories.map(c => c.count));

  const items = categories.map(c => {
    const barWidth = Math.max(5, (c.count / maxCount) * 100);
    return `
      <div class="category-item">
        <div class="category-name">${getCategoryIcon(c.category)} ${c.category}</div>
        <div class="category-bar-container">
          <div class="category-bar" style="width: ${barWidth}%">${c.count}개</div>
        </div>
        <div class="category-stats">${c.percentage.toFixed(1)}%</div>
      </div>
    `;
  }).join('');

  return `
    <section>
      <h2>📂 카테고리별 분석</h2>
      ${items}
    </section>
  `;
}

function generateRecommendationsSection(recommendations: PrioritizedRecommendation[]): string {
  if (recommendations.length === 0) return '';

  // Sort by priority
  const sorted = [...recommendations].sort((a, b) => a.priority - b.priority);

  const items = sorted.map(r => `
    <div class="priority-item">
      <div>
        <strong>${r.title}</strong>
        <div class="item-desc">${r.description}</div>
        <div class="recommendation">예상 효과: ${getImpactLabel(r.expectedImpact)} | 난이도: ${getEffortLabel(r.effort)}</div>
      </div>
    </div>
  `).join('');

  return `
    <section>
      <h2>💡 우선순위 권장사항</h2>
      <div class="priority-list">
        ${items}
      </div>
    </section>
  `;
}

function getImpactLabel(impact: string): string {
  const labels: Record<string, string> = {
    'high': '높음 🔥',
    'medium': '중간',
    'low': '낮음'
  };
  return labels[impact] || impact;
}

function getEffortLabel(effort: string): string {
  const labels: Record<string, string> = {
    'easy': '쉬움 ✅',
    'moderate': '보통',
    'hard': '어려움'
  };
  return labels[effort] || effort;
}

// Helper functions
function getSeverityIcon(severity: string): string {
  return severity === 'critical' ? '🔴' : '🟡';
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    '미분류': '❔',
    '코드 생성': '🔨',
    '버그 수정': '🐛',
    '리팩토링': '♻️',
    '테스트': '🧪',
    '문서화': '📖',
    '코드 리뷰': '👀',
    '설명': '💡',
    '아키텍처': '🏗️',
    '배포': '🚀',
    '데이터 분석': '📊',
  };
  return icons[category] || '📁';
}

function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

/**
 * Generate Guidelines Compliance Section
 */
function generateGuidelinesSection(summary?: GuidelinesSummary): string {
  if (!summary) return '';

  const { averageGOLDEN, averageScore, weakestGuidelines, strongestGuidelines, commonAntiPatterns } = summary;

  // GOLDEN score items
  const goldenItems = [
    { key: 'goal', label: 'G - 목표 명확성', score: averageGOLDEN.goal },
    { key: 'output', label: 'O - 출력 형식', score: averageGOLDEN.output },
    { key: 'limits', label: 'L - 제약조건', score: averageGOLDEN.limits },
    { key: 'data', label: 'D - 데이터/컨텍스트', score: averageGOLDEN.data },
    { key: 'evaluation', label: 'E - 평가 기준', score: averageGOLDEN.evaluation },
    { key: 'next', label: 'N - 다음 단계', score: averageGOLDEN.next },
  ];

  const goldenDetailsHtml = goldenItems.map(item => {
    const percent = Math.round(item.score * 100);
    const color = percent >= 70 ? '#22c55e' : percent >= 40 ? '#f59e0b' : '#ef4444';
    return `
      <div class="golden-item">
        <span class="golden-label">${item.label}</span>
        <div class="golden-score">
          <div class="golden-bar">
            <div class="golden-fill" style="width: ${percent}%; background: ${color};"></div>
          </div>
          <span class="golden-value">${percent}%</span>
        </div>
      </div>
    `;
  }).join('');

  // Overall score and strongest/weakest guidelines
  const overallScorePercent = Math.round(averageScore * 100);
  const complianceSummaryHtml = `
    <div class="compliance-summary">
      <div class="compliance-card">
        <div class="compliance-value" style="color: ${averageScore >= 0.7 ? '#22c55e' : averageScore >= 0.4 ? '#f59e0b' : '#ef4444'};">
          ${overallScorePercent}%
        </div>
        <div class="compliance-label">전체 준수도</div>
      </div>
      ${strongestGuidelines.slice(0, 2).map(g => `
        <div class="compliance-card">
          <div class="compliance-value" style="color: #22c55e;">
            ${Math.round(g.averageScore * 100)}%
          </div>
          <div class="compliance-label">${g.name}</div>
        </div>
      `).join('')}
      ${weakestGuidelines.slice(0, 1).map(g => `
        <div class="compliance-card">
          <div class="compliance-value" style="color: #ef4444;">
            ${Math.round(g.averageScore * 100)}%
          </div>
          <div class="compliance-label">${g.name} (개선 필요)</div>
        </div>
      `).join('')}
    </div>
  `;

  // Anti-patterns from commonAntiPatterns array
  const antiPatternsHtml = commonAntiPatterns.length > 0 ? `
    <h3 class="subsection-title">⚠️ 발견된 안티패턴</h3>
    ${commonAntiPatterns.slice(0, 3).map(ap => `
      <div class="antipattern-item">
        <div class="antipattern-title">${getAntiPatternLabel(ap.pattern)} (${ap.count}회)</div>
        <div class="antipattern-desc">${getAntiPatternAdvice(ap.pattern)}</div>
      </div>
    `).join('')}
  ` : '';

  // SVG Radar Chart for GOLDEN scores
  const radarChartHtml = generateGoldenRadarChart(averageGOLDEN);

  return `
    <section>
      <h2>📋 공식 가이드라인 준수도</h2>
      ${complianceSummaryHtml}

      <div class="golden-container">
        <div class="golden-chart">
          ${radarChartHtml}
        </div>
        <div class="golden-details">
          <h3 class="subsection-title">GOLDEN 체크리스트 점수</h3>
          ${goldenDetailsHtml}
        </div>
      </div>

      ${antiPatternsHtml}
    </section>
  `;
}

/**
 * Generate SVG Radar Chart for GOLDEN scores
 */
function generateGoldenRadarChart(golden: GOLDENScore): string {
  const scores = [
    golden.goal,
    golden.output,
    golden.limits,
    golden.data,
    golden.evaluation,
    golden.next,
  ];
  const labels = ['G', 'O', 'L', 'D', 'E', 'N'];
  const centerX = 120;
  const centerY = 120;
  const maxRadius = 80;

  // Generate polygon points
  const points = scores.map((score, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const radius = score * maxRadius;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    return `${x},${y}`;
  }).join(' ');

  // Generate grid circles
  const gridCircles = [0.25, 0.5, 0.75, 1].map(ratio => {
    const r = ratio * maxRadius;
    return `<circle cx="${centerX}" cy="${centerY}" r="${r}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;
  }).join('');

  // Generate axis lines and labels
  const axisLines = labels.map((label, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const x = centerX + maxRadius * Math.cos(angle);
    const y = centerY + maxRadius * Math.sin(angle);
    const labelX = centerX + (maxRadius + 15) * Math.cos(angle);
    const labelY = centerY + (maxRadius + 15) * Math.sin(angle);
    return `
      <line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <text x="${labelX}" y="${labelY}" fill="#a1a1aa" font-size="12" text-anchor="middle" dominant-baseline="middle">${label}</text>
    `;
  }).join('');

  return `
    <svg width="240" height="240" viewBox="0 0 240 240">
      ${gridCircles}
      ${axisLines}
      <polygon points="${points}" fill="rgba(59, 130, 246, 0.3)" stroke="#3b82f6" stroke-width="2"/>
    </svg>
  `;
}

/**
 * Generate Prompt Library Section
 */
function generatePromptLibrarySection(library?: PromptLibrary): string {
  if (!library || library.entries.length === 0) return '';

  const topEntries = library.entries
    .sort((a, b) => b.effectiveness - a.effectiveness)
    .slice(0, 6);

  const entriesHtml = topEntries.map((entry, _idx) => `
    <div class="library-card">
      <div class="library-header">
        <span class="library-category">${entry.category}</span>
        <div class="library-score">
          <span>⭐</span>
          <span>${Math.round(entry.effectiveness * 100)}%</span>
        </div>
      </div>
      <div class="library-pattern">${escapeHtml(entry.pattern)}</div>
      ${entry.keywords.length > 0 ? `
        <div class="library-keywords">
          ${entry.keywords.slice(0, 5).map(kw => `<span class="library-keyword">${escapeHtml(kw)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  // Stats summary
  const categoryStats = library.entries.reduce((acc, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topCategories = Object.entries(categoryStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Calculate average effectiveness from entries
  const avgEffectiveness = library.entries.length > 0
    ? library.entries.reduce((sum, e) => sum + e.effectiveness, 0) / library.entries.length
    : 0;

  return `
    <section>
      <h2>📚 프롬프트 라이브러리</h2>
      <p style="color: #a1a1aa; margin-bottom: 1rem;">
        총 ${library.totalPrompts}개 프롬프트에서 ${library.entries.length}개 패턴 추출 |
        평균 효과성: ${Math.round(avgEffectiveness * 100)}% |
        주요 카테고리: ${topCategories.map(([cat]) => cat).join(', ')}
      </p>

      <h3 class="subsection-title">🏆 효과적인 프롬프트 Top ${topEntries.length}</h3>
      <div class="library-grid">
        ${entriesHtml}
      </div>
    </section>
  `;
}

/**
 * Generate Self Improvement Section
 */
function generateSelfImprovementSection(feedback?: SelfImprovementFeedback): string {
  if (!feedback) return '';

  // Improvement Areas with Before/After
  const areasHtml = feedback.areasForImprovement.slice(0, 3).map(area => {
    const hasExample = area.examples && area.examples.length > 0;
    const example = hasExample ? area.examples[0] : null;

    return `
      <div class="improvement-area">
        <div class="improvement-header">
          <span class="improvement-title">📈 ${area.area}</span>
          <div class="improvement-score-badge">
            <span class="score-current">${Math.round(area.currentScore * 100)}%</span>
            <span class="score-arrow">→</span>
            <span class="score-target">${Math.round(area.targetScore * 100)}%</span>
          </div>
        </div>
        <div class="item-desc">${area.specificAdvice}</div>
        ${example ? `
          <div class="before-after">
            <div class="before-box">
              <div class="box-label">❌ Before</div>
              <div class="box-content">${escapeHtml(truncate(example.before, 120))}</div>
            </div>
            <div class="after-box">
              <div class="box-label">✅ After</div>
              <div class="box-content">${escapeHtml(truncate(example.after, 120))}</div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Learning Priorities
  const learningHtml = feedback.learningPriorities.slice(0, 3).map((priority, _idx) => `
    <div class="learning-item">
      <div class="learning-rank">${priority.rank}</div>
      <div class="learning-content">
        <h4>${priority.topic}</h4>
        <p class="learning-reason">${priority.reason}</p>
      </div>
    </div>
  `).join('');

  // Weekly Goals
  const goalsHtml = feedback.weeklyGoals?.slice(0, 5).map(goal => `
    <div class="goal-item">
      <div class="goal-checkbox">✓</div>
      <span class="goal-text">${goal.goal}</span>
      <span class="goal-difficulty">${getDifficultyLabel(goal.difficulty)}</span>
    </div>
  `).join('') || '';

  // Strengths
  const strengthsHtml = feedback.strengths.slice(0, 3).map(strength => `
    <div class="strength-item">
      <div class="item-title">✨ ${strength.area} (${Math.round(strength.score * 100)}%)</div>
      <div class="item-desc">${strength.evidence.slice(0, 2).join(' | ')}</div>
    </div>
  `).join('');

  return `
    <section>
      <h2>🎯 자기 개선 피드백</h2>

      <h3 class="subsection-title">📊 개선이 필요한 영역</h3>
      ${areasHtml || '<p style="color: #a1a1aa;">현재 특별한 개선 영역이 감지되지 않았습니다.</p>'}

      ${strengthsHtml ? `
        <h3 class="subsection-title">💪 현재 강점</h3>
        ${strengthsHtml}
      ` : ''}

      <h3 class="subsection-title">📚 학습 우선순위</h3>
      <div class="learning-list">
        ${learningHtml || '<p style="color: #a1a1aa;">학습 우선순위가 없습니다.</p>'}
      </div>

      ${goalsHtml ? `
        <h3 class="subsection-title">🎯 이번 주 목표</h3>
        <div class="goals-list">
          ${goalsHtml}
        </div>
      ` : ''}
    </section>
  `;
}

// Helper functions for new sections
function getAntiPatternLabel(pattern: string): string {
  const labels: Record<string, string> = {
    'vague-objective': '모호한 목표',
    'unstructured-context': '구조화되지 않은 컨텍스트',
    'implicit-constraints': '암묵적 제약조건',
    'missing-output-format': '출력 형식 미지정',
    'no-examples': '예시 없음',
    'too-long': '프롬프트 과도하게 김',
    'too-short': '프롬프트 너무 짧음',
  };
  return labels[pattern] || pattern;
}

function getAntiPatternAdvice(pattern: string): string {
  const advice: Record<string, string> = {
    'vague-objective': '명확한 목표와 기대 결과를 구체적으로 명시하세요.',
    'unstructured-context': 'XML 태그나 마크다운을 사용해 컨텍스트를 구조화하세요.',
    'implicit-constraints': '제약조건과 요구사항을 명시적으로 나열하세요.',
    'missing-output-format': '원하는 출력 형식(JSON, 마크다운 등)을 지정하세요.',
    'no-examples': '기대하는 결과물의 예시를 포함하세요.',
    'too-long': '핵심 요점만 간결하게 전달하세요.',
    'too-short': '충분한 컨텍스트와 세부사항을 추가하세요.',
  };
  return advice[pattern] || '개선이 필요합니다.';
}

function getDifficultyLabel(difficulty: string): string {
  const labels: Record<string, string> = {
    'easy': '쉬움',
    'medium': '보통',
    'hard': '어려움',
  };
  return labels[difficulty] || difficulty;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
