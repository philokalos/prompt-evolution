/**
 * InstructionAnalysis Component Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import InstructionAnalysis from '../InstructionAnalysis';
import type { InstructionAnalysisResult } from '../../hooks/useInstructionLinter';

// Mock GoldenRadar to avoid SVG rendering complexity
vi.mock('../GoldenRadar.js', () => ({
  default: (props: {
    scores: Record<string, number>;
    size?: number;
    dimensionLabels?: Record<string, string>;
  }) => (
    <div
      data-testid="golden-radar-mock"
      data-scores={JSON.stringify(props.scores)}
      data-size={props.size}
    >
      GoldenRadar Mock
    </div>
  ),
}));

// Initialize i18n with passthrough t function behavior
i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  ns: ['analysis'],
  defaultNS: 'analysis',
  resources: {
    en: {
      analysis: {
        instructionLinter: {
          title: 'Instruction Analysis',
          fileFormats: {
            markdown: 'Markdown',
            yaml: 'YAML',
            text: 'Plain Text',
          },
          dimensions: {
            goal: 'Goal',
            goalDesc: 'Clear objectives',
            output: 'Output',
            outputDesc: 'Expected format',
            limits: 'Limits',
            limitsDesc: 'Constraints',
            data: 'Data',
            dataDesc: 'Context provided',
            evaluation: 'Evaluation',
            evaluationDesc: 'Success criteria',
            next: 'Next',
            nextDesc: 'Follow-up steps',
          },
          issues: 'Issues',
          noIssues: 'No issues found',
          suggestions: 'Suggestions',
          severity: {
            critical: 'Critical',
            high: 'High',
            medium: 'Medium',
            low: 'Low',
          },
          issueTypes: {
            missing_section: 'Missing Section',
            vague_description: 'Vague Description',
            no_examples: 'No Examples',
            missing_constraints: 'Missing Constraints',
          },
        },
      },
    },
  },
});

const renderWithI18n = (component: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);
};

// ---------------------------------------------------------------------------
// Mock data factory
// ---------------------------------------------------------------------------

function createMockAnalysis(
  overrides: Partial<InstructionAnalysisResult> = {}
): InstructionAnalysisResult {
  return {
    filePath: '/project/CLAUDE.md',
    fileFormat: 'markdown',
    overallScore: 72,
    grade: 'B',
    goldenScores: {
      goal: 0.9,
      output: 0.7,
      limits: 0.6,
      data: 0.8,
      evaluation: 0.5,
      next: 0.4,
      total: 3.9,
    },
    issues: [],
    suggestions: [],
    sections: [],
    references: [],
    fileSize: 1024,
    lineCount: 50,
    analyzedAt: '2026-02-24T10:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InstructionAnalysis', () => {
  describe('Score header rendering', () => {
    it('should render the grade with correct text', () => {
      const analysis = createMockAnalysis({ grade: 'A', overallScore: 92 });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('92/100')).toBeInTheDocument();
    });

    it('should render the title', () => {
      const analysis = createMockAnalysis();
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      expect(screen.getByText('Instruction Analysis')).toBeInTheDocument();
    });

    it('should render file format and line count', () => {
      const analysis = createMockAnalysis({
        fileFormat: 'markdown',
        lineCount: 120,
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      // The component renders: {fileFormat translation} · {lineCount} lines
      expect(screen.getByText(/Markdown/)).toBeInTheDocument();
      expect(screen.getByText(/120 lines/)).toBeInTheDocument();
    });

    it('should apply green color class for grade A', () => {
      const analysis = createMockAnalysis({ grade: 'A' });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      const gradeEl = screen.getByText('A');
      expect(gradeEl.className).toContain('text-green-400');
    });

    it('should apply blue color class for grade B', () => {
      const analysis = createMockAnalysis({ grade: 'B' });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      const gradeEl = screen.getByText('B');
      expect(gradeEl.className).toContain('text-blue-400');
    });

    it('should apply yellow color class for grade C', () => {
      const analysis = createMockAnalysis({ grade: 'C' });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      const gradeEl = screen.getByText('C');
      expect(gradeEl.className).toContain('text-yellow-400');
    });

    it('should apply orange color class for grade D', () => {
      const analysis = createMockAnalysis({ grade: 'D' });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      const gradeEl = screen.getByText('D');
      expect(gradeEl.className).toContain('text-orange-400');
    });

    it('should apply red color class for grade F', () => {
      const analysis = createMockAnalysis({ grade: 'F' });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      const gradeEl = screen.getByText('F');
      expect(gradeEl.className).toContain('text-red-400');
    });
  });

  describe('GoldenRadar integration', () => {
    it('should pass converted 0-100 scores to GoldenRadar', () => {
      const analysis = createMockAnalysis({
        goldenScores: {
          goal: 0.85,
          output: 0.72,
          limits: 0.63,
          data: 0.91,
          evaluation: 0.44,
          next: 0.38,
          total: 3.93,
        },
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      const radar = screen.getByTestId('golden-radar-mock');
      expect(radar).toBeInTheDocument();

      const passedScores = JSON.parse(
        radar.getAttribute('data-scores') ?? '{}'
      );
      expect(passedScores).toEqual({
        goal: 85,
        output: 72,
        limits: 63,
        data: 91,
        evaluation: 44,
        next: 38,
      });
    });

    it('should pass size 180 to GoldenRadar', () => {
      const analysis = createMockAnalysis();
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      const radar = screen.getByTestId('golden-radar-mock');
      expect(radar.getAttribute('data-size')).toBe('180');
    });
  });

  describe('Issues list rendering', () => {
    it('should render the "no issues" message when issues array is empty', () => {
      const analysis = createMockAnalysis({ issues: [] });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      expect(screen.getByText('No issues found')).toBeInTheDocument();
    });

    it('should render issues with their descriptions', () => {
      const analysis = createMockAnalysis({
        issues: [
          {
            severity: 'high',
            type: 'missing_section',
            description: 'No testing section found',
            location: { lineStart: 10, lineEnd: 10 },
          },
          {
            severity: 'medium',
            type: 'vague_description',
            description: 'Build commands are unclear',
            location: { lineStart: 25, lineEnd: 30 },
          },
        ],
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      expect(screen.getByText('No testing section found')).toBeInTheDocument();
      expect(
        screen.getByText('Build commands are unclear')
      ).toBeInTheDocument();
    });

    it('should render issue count in the header', () => {
      const analysis = createMockAnalysis({
        issues: [
          {
            severity: 'high',
            type: 'missing_section',
            description: 'Issue one',
            location: { lineStart: 1, lineEnd: 1 },
          },
          {
            severity: 'low',
            type: 'no_examples',
            description: 'Issue two',
            location: { lineStart: 5, lineEnd: 5 },
          },
        ],
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      // The header contains "Issues" text and "(2)" as separate text nodes
      const issueHeader = screen.getByText(
        (_, element) =>
          element?.tagName === 'H3' &&
          element?.textContent?.includes('Issues') === true &&
          element?.textContent?.includes('(2)') === true
      );
      expect(issueHeader).toBeInTheDocument();
    });

    it('should render severity labels from i18n', () => {
      const analysis = createMockAnalysis({
        issues: [
          {
            severity: 'critical',
            type: 'missing_section',
            description: 'Critical issue',
            location: { lineStart: 1, lineEnd: 1 },
          },
          {
            severity: 'high',
            type: 'missing_section',
            description: 'High issue',
            location: { lineStart: 5, lineEnd: 5 },
          },
          {
            severity: 'medium',
            type: 'vague_description',
            description: 'Medium issue',
            location: { lineStart: 10, lineEnd: 10 },
          },
          {
            severity: 'low',
            type: 'no_examples',
            description: 'Low issue',
            location: { lineStart: 15, lineEnd: 15 },
          },
        ],
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('Low')).toBeInTheDocument();
    });

    it('should render issue type labels', () => {
      const analysis = createMockAnalysis({
        issues: [
          {
            severity: 'medium',
            type: 'vague_description',
            description: 'Some description',
            location: { lineStart: 1, lineEnd: 1 },
          },
        ],
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      expect(screen.getByText('Vague Description')).toBeInTheDocument();
    });

    it('should render line numbers for issues with lineStart > 0', () => {
      const analysis = createMockAnalysis({
        issues: [
          {
            severity: 'high',
            type: 'missing_section',
            description: 'Single line issue',
            location: { lineStart: 42, lineEnd: 42 },
          },
        ],
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      expect(screen.getByText('L42')).toBeInTheDocument();
    });

    it('should render line range when lineEnd > lineStart', () => {
      const analysis = createMockAnalysis({
        issues: [
          {
            severity: 'high',
            type: 'missing_section',
            description: 'Multi-line issue',
            location: { lineStart: 10, lineEnd: 25 },
          },
        ],
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      expect(screen.getByText('L10-25')).toBeInTheDocument();
    });

    it('should not render line numbers when lineStart is 0', () => {
      const analysis = createMockAnalysis({
        issues: [
          {
            severity: 'low',
            type: 'no_examples',
            description: 'Global issue',
            location: { lineStart: 0, lineEnd: 0 },
          },
        ],
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      // L0 should NOT appear
      expect(screen.queryByText(/^L\d/)).not.toBeInTheDocument();
    });

    it('should apply correct severity background classes', () => {
      const analysis = createMockAnalysis({
        issues: [
          {
            severity: 'critical',
            type: 'missing_section',
            description: 'Critical bg test',
            location: { lineStart: 1, lineEnd: 1 },
          },
          {
            severity: 'high',
            type: 'missing_section',
            description: 'High bg test',
            location: { lineStart: 2, lineEnd: 2 },
          },
          {
            severity: 'medium',
            type: 'vague_description',
            description: 'Medium bg test',
            location: { lineStart: 3, lineEnd: 3 },
          },
          {
            severity: 'low',
            type: 'no_examples',
            description: 'Low bg test',
            location: { lineStart: 4, lineEnd: 4 },
          },
        ],
      });
      const { container } = renderWithI18n(
        <InstructionAnalysis analysis={analysis} />
      );

      const issueCards = container.querySelectorAll('.border.rounded-lg.p-3');
      expect(issueCards.length).toBe(4);

      expect(issueCards[0].className).toContain('bg-red-500/10');
      expect(issueCards[1].className).toContain('bg-orange-500/10');
      expect(issueCards[2].className).toContain('bg-yellow-500/10');
      expect(issueCards[3].className).toContain('bg-blue-400/10');
    });

    it('should apply correct severity text color classes', () => {
      const analysis = createMockAnalysis({
        issues: [
          {
            severity: 'critical',
            type: 'missing_section',
            description: 'Critical text',
            location: { lineStart: 1, lineEnd: 1 },
          },
        ],
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      const severityLabel = screen.getByText('Critical');
      expect(severityLabel.className).toContain('text-red-500');
    });
  });

  describe('Suggestions rendering', () => {
    it('should not render suggestions section when suggestions array is empty', () => {
      const analysis = createMockAnalysis({ suggestions: [] });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      expect(screen.queryByText(/Suggestions/)).not.toBeInTheDocument();
    });

    it('should render suggestion descriptions', () => {
      const analysis = createMockAnalysis({
        suggestions: [
          {
            issueIndex: 0,
            type: 'add_section',
            description: 'Add a testing section',
            suggestedText: '## Testing\nnpm test',
          },
        ],
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      expect(screen.getByText('Add a testing section')).toBeInTheDocument();
    });

    it('should render suggestion count in the header', () => {
      const analysis = createMockAnalysis({
        suggestions: [
          {
            issueIndex: 0,
            type: 'rewrite',
            description: 'Suggestion 1',
            suggestedText: 'better text',
          },
          {
            issueIndex: 1,
            type: 'add_section',
            description: 'Suggestion 2',
            suggestedText: 'new section',
          },
        ],
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      // The header contains "Suggestions" text and "(2)" as separate text nodes
      const suggestionsHeader = screen.getByText(
        (_, element) =>
          element?.tagName === 'H3' &&
          element?.textContent?.includes('Suggestions') === true &&
          element?.textContent?.includes('(2)') === true
      );
      expect(suggestionsHeader).toBeInTheDocument();
    });

    it('should render suggested text with + prefix', () => {
      const analysis = createMockAnalysis({
        suggestions: [
          {
            issueIndex: 0,
            type: 'add_section',
            description: 'Add testing',
            suggestedText: 'npm run test',
          },
        ],
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      expect(screen.getByText(/\+ npm run test/)).toBeInTheDocument();
    });

    it('should render original text with - prefix when present', () => {
      const analysis = createMockAnalysis({
        suggestions: [
          {
            issueIndex: 0,
            type: 'rewrite',
            description: 'Improve description',
            originalText: 'old vague text',
            suggestedText: 'clear specific text',
          },
        ],
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      expect(screen.getByText(/- old vague text/)).toBeInTheDocument();
      expect(screen.getByText(/\+ clear specific text/)).toBeInTheDocument();
    });

    it('should not render original text block when originalText is undefined', () => {
      const analysis = createMockAnalysis({
        suggestions: [
          {
            issueIndex: 0,
            type: 'add_section',
            description: 'Add new content',
            suggestedText: 'new content here',
          },
        ],
      });
      const { container } = renderWithI18n(
        <InstructionAnalysis analysis={analysis} />
      );

      // Only the green (suggested) block should exist, not the red (original)
      const redBlocks = container.querySelectorAll('.bg-red-500\\/10');
      expect(redBlocks.length).toBe(0);

      const greenBlocks = container.querySelectorAll('.bg-green-500\\/10');
      expect(greenBlocks.length).toBe(1);
    });

    it('should render both original and suggested blocks when originalText is present', () => {
      const analysis = createMockAnalysis({
        suggestions: [
          {
            issueIndex: 0,
            type: 'rewrite',
            description: 'Rewrite section',
            originalText: 'before',
            suggestedText: 'after',
          },
        ],
      });
      const { container } = renderWithI18n(
        <InstructionAnalysis analysis={analysis} />
      );

      const redBlocks = container.querySelectorAll('.bg-red-500\\/10');
      expect(redBlocks.length).toBe(1);

      const greenBlocks = container.querySelectorAll('.bg-green-500\\/10');
      expect(greenBlocks.length).toBe(1);
    });

    it('should render multiple suggestions', () => {
      const analysis = createMockAnalysis({
        suggestions: [
          {
            issueIndex: 0,
            type: 'add_section',
            description: 'First suggestion',
            suggestedText: 'text one',
          },
          {
            issueIndex: 1,
            type: 'rewrite',
            description: 'Second suggestion',
            originalText: 'old text',
            suggestedText: 'text two',
          },
          {
            issueIndex: 2,
            type: 'add_section',
            description: 'Third suggestion',
            suggestedText: 'text three',
          },
        ],
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      expect(screen.getByText('First suggestion')).toBeInTheDocument();
      expect(screen.getByText('Second suggestion')).toBeInTheDocument();
      expect(screen.getByText('Third suggestion')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle zero GOLDEN scores', () => {
      const analysis = createMockAnalysis({
        goldenScores: {
          goal: 0,
          output: 0,
          limits: 0,
          data: 0,
          evaluation: 0,
          next: 0,
          total: 0,
        },
        overallScore: 0,
        grade: 'F',
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      const radar = screen.getByTestId('golden-radar-mock');
      const passedScores = JSON.parse(
        radar.getAttribute('data-scores') ?? '{}'
      );
      expect(passedScores).toEqual({
        goal: 0,
        output: 0,
        limits: 0,
        data: 0,
        evaluation: 0,
        next: 0,
      });
    });

    it('should handle perfect GOLDEN scores', () => {
      const analysis = createMockAnalysis({
        goldenScores: {
          goal: 1,
          output: 1,
          limits: 1,
          data: 1,
          evaluation: 1,
          next: 1,
          total: 6,
        },
        overallScore: 100,
        grade: 'A',
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      expect(screen.getByText('100/100')).toBeInTheDocument();

      const radar = screen.getByTestId('golden-radar-mock');
      const passedScores = JSON.parse(
        radar.getAttribute('data-scores') ?? '{}'
      );
      expect(passedScores).toEqual({
        goal: 100,
        output: 100,
        limits: 100,
        data: 100,
        evaluation: 100,
        next: 100,
      });
    });

    it('should render with both issues and suggestions simultaneously', () => {
      const analysis = createMockAnalysis({
        issues: [
          {
            severity: 'high',
            type: 'missing_section',
            description: 'Missing testing section',
            location: { lineStart: 1, lineEnd: 1 },
          },
        ],
        suggestions: [
          {
            issueIndex: 0,
            type: 'add_section',
            description: 'Add testing section',
            suggestedText: '## Testing\nnpm test',
          },
        ],
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      // Both sections should coexist
      expect(
        screen.getByText('Missing testing section')
      ).toBeInTheDocument();
      expect(screen.getByText('Add testing section')).toBeInTheDocument();
    });

    it('should handle empty issues with populated suggestions', () => {
      const analysis = createMockAnalysis({
        issues: [],
        suggestions: [
          {
            issueIndex: 0,
            type: 'add_section',
            description: 'Enhancement suggestion',
            suggestedText: 'some enhancement',
          },
        ],
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      // No issues message shown alongside suggestions
      expect(screen.getByText('No issues found')).toBeInTheDocument();
      expect(screen.getByText('Enhancement suggestion')).toBeInTheDocument();
    });

    it('should round fractional GOLDEN scores correctly', () => {
      const analysis = createMockAnalysis({
        goldenScores: {
          goal: 0.855,
          output: 0.724,
          limits: 0.635,
          data: 0.915,
          evaluation: 0.445,
          next: 0.385,
          total: 3.959,
        },
      });
      renderWithI18n(<InstructionAnalysis analysis={analysis} />);

      const radar = screen.getByTestId('golden-radar-mock');
      const passedScores = JSON.parse(
        radar.getAttribute('data-scores') ?? '{}'
      );
      // Math.round behavior
      expect(passedScores.goal).toBe(86);
      expect(passedScores.output).toBe(72);
      expect(passedScores.limits).toBe(64);
      expect(passedScores.data).toBe(92);
      expect(passedScores.evaluation).toBe(45);
      expect(passedScores.next).toBe(39);
    });
  });
});
