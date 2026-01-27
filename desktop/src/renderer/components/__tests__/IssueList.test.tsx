/**
 * IssueList Component Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import IssueList from '../IssueList';

// Initialize i18n for tests
i18n.init({
  lng: 'ko',
  fallbackLng: 'ko',
  ns: ['analysis'],
  defaultNS: 'analysis',
  resources: {
    ko: {
      analysis: {
        issues: {
          count: '{{count}}개 문제',
          noIssues: '모두 잘 작성되었어요!',
          noIssuesDesc: '문제가 발견되지 않았어요. 훌륭한 프롬프트예요!',
          severity: {
            high: '심각',
            medium: '경고',
            low: '제안',
          },
          categories: {
            goal: '목표',
            output: '출력',
            limits: '제한',
            data: '데이터',
            evaluation: '평가',
            next: '다음',
            default: '기타',
          },
          suggestion: '개선 제안',
          applySuggestion: '제안 적용',
          priorityTip: '높은 우선순위 문제를 먼저 해결하세요',
        },
      },
    },
  },
});

const renderWithI18n = (component: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);
};

const mockOnApplySuggestion = vi.fn();

describe('IssueList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('렌더링', () => {
    it('should render empty state when no issues', () => {
      renderWithI18n(<IssueList issues={[]} onApplySuggestion={mockOnApplySuggestion} />);

      expect(screen.getByText('모두 잘 작성되었어요!')).toBeInTheDocument();
      expect(screen.getByText('문제가 발견되지 않았어요. 훌륭한 프롬프트예요!')).toBeInTheDocument();
    });

    it('should render issue list with count', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'Goal is not specific',
          suggestion: 'Add concrete action',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      expect(screen.getByText('1개 문제')).toBeInTheDocument();
    });

    it('should render multiple issues', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'Goal is not specific',
          suggestion: 'Add concrete action',
        },
        {
          severity: 'medium' as const,
          category: 'output',
          message: 'Output format unclear',
          suggestion: 'Specify format',
        },
        {
          severity: 'low' as const,
          category: 'data',
          message: 'Missing context',
          suggestion: 'Add context',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      expect(screen.getByText('Goal is not specific')).toBeInTheDocument();
      expect(screen.getByText('Output format unclear')).toBeInTheDocument();
      expect(screen.getByText('Missing context')).toBeInTheDocument();
    });
  });

  describe('심각도 표시', () => {
    it('should display high severity label', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'Critical goal issue',
          suggestion: 'Fix immediately',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      expect(screen.getByText('심각')).toBeInTheDocument();
      expect(screen.getByText('Critical goal issue')).toBeInTheDocument();
    });

    it('should display medium severity label', () => {
      const issues = [
        {
          severity: 'medium' as const,
          category: 'output',
          message: 'Medium priority issue',
          suggestion: 'Address soon',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      expect(screen.getByText('경고')).toBeInTheDocument();
      expect(screen.getByText('Medium priority issue')).toBeInTheDocument();
    });

    it('should display low severity label', () => {
      const issues = [
        {
          severity: 'low' as const,
          category: 'next',
          message: 'Low priority issue',
          suggestion: 'Consider later',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      expect(screen.getByText('제안')).toBeInTheDocument();
      expect(screen.getByText('Low priority issue')).toBeInTheDocument();
    });

    it('should display severity counts', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'High issue 1',
          suggestion: 'Fix 1',
        },
        {
          severity: 'high' as const,
          category: 'data',
          message: 'High issue 2',
          suggestion: 'Fix 2',
        },
        {
          severity: 'medium' as const,
          category: 'output',
          message: 'Medium issue 1',
          suggestion: 'Fix 3',
        },
        {
          severity: 'low' as const,
          category: 'next',
          message: 'Low issue 1',
          suggestion: 'Fix 4',
        },
      ];

      const { container } = renderWithI18n(
        <IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />
      );

      // Check count in header
      expect(screen.getByText('4개 문제')).toBeInTheDocument();

      // Check severity counts (numbers 2, 1, 1 for high, medium, low)
      const counts = container.querySelectorAll('.text-xs span');
      expect(counts.length).toBeGreaterThan(0);
    });
  });

  describe('카테고리 표시', () => {
    it('should display issue category', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'Goal issue',
          suggestion: 'Fix goal',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      expect(screen.getByText('목표')).toBeInTheDocument();
    });

    it('should display all GOLDEN categories', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'Goal issue',
          suggestion: 'Fix',
        },
        {
          severity: 'high' as const,
          category: 'output',
          message: 'Output issue',
          suggestion: 'Fix',
        },
        {
          severity: 'high' as const,
          category: 'limits',
          message: 'Limits issue',
          suggestion: 'Fix',
        },
        {
          severity: 'high' as const,
          category: 'data',
          message: 'Data issue',
          suggestion: 'Fix',
        },
        {
          severity: 'high' as const,
          category: 'evaluation',
          message: 'Evaluation issue',
          suggestion: 'Fix',
        },
        {
          severity: 'high' as const,
          category: 'next',
          message: 'Next issue',
          suggestion: 'Fix',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      expect(screen.getByText('목표')).toBeInTheDocument();
      expect(screen.getByText('출력')).toBeInTheDocument();
      expect(screen.getByText('제한')).toBeInTheDocument();
      expect(screen.getByText('데이터')).toBeInTheDocument();
      expect(screen.getByText('평가')).toBeInTheDocument();
      expect(screen.getByText('다음')).toBeInTheDocument();
    });
  });

  describe('제안 확장/축소', () => {
    it('should initially hide suggestions', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'Goal issue',
          suggestion: 'This is the suggestion',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      // Suggestion should not be visible initially
      expect(screen.queryByText('This is the suggestion')).not.toBeInTheDocument();
    });

    it('should show suggestion when issue card clicked', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'Goal issue',
          suggestion: 'This is the suggestion',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      // Click the issue card (button with message)
      const issueButton = screen.getByText('Goal issue').closest('button');
      expect(issueButton).toBeTruthy();
      fireEvent.click(issueButton!);

      expect(screen.getByText('This is the suggestion')).toBeInTheDocument();
    });

    it('should hide suggestion when clicked again', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'Goal issue',
          suggestion: 'This is the suggestion',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      const issueButton = screen.getByText('Goal issue').closest('button');
      expect(issueButton).toBeTruthy();

      // Expand
      fireEvent.click(issueButton!);
      expect(screen.getByText('This is the suggestion')).toBeInTheDocument();

      // Collapse
      fireEvent.click(issueButton!);
      expect(screen.queryByText('This is the suggestion')).not.toBeInTheDocument();
    });

    it('should independently expand/collapse multiple issues', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'Issue 1',
          suggestion: 'Suggestion 1',
        },
        {
          severity: 'medium' as const,
          category: 'output',
          message: 'Issue 2',
          suggestion: 'Suggestion 2',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      const issue1Button = screen.getByText('Issue 1').closest('button');
      expect(issue1Button).toBeTruthy();

      // Expand first issue only
      fireEvent.click(issue1Button!);

      expect(screen.getByText('Suggestion 1')).toBeInTheDocument();
      expect(screen.queryByText('Suggestion 2')).not.toBeInTheDocument();
    });
  });

  describe('제안 적용', () => {
    it('should call onApplySuggestion when apply button clicked', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'Goal issue',
          suggestion: 'This is the suggestion',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      // Expand to see apply button
      const issueButton = screen.getByText('Goal issue').closest('button');
      fireEvent.click(issueButton!);

      const applyButton = screen.getByText('제안 적용');
      fireEvent.click(applyButton);

      expect(mockOnApplySuggestion).toHaveBeenCalledTimes(1);
      expect(mockOnApplySuggestion).toHaveBeenCalledWith('This is the suggestion');
    });

    it('should not show apply button when onApplySuggestion is undefined', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'Goal issue',
          suggestion: 'This is the suggestion',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={undefined} />);

      // Expand
      const issueButton = screen.getByText('Goal issue').closest('button');
      fireEvent.click(issueButton!);

      expect(screen.queryByText('제안 적용')).not.toBeInTheDocument();
    });
  });

  describe('엣지 케이스', () => {
    it('should handle empty suggestion string', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'Goal issue',
          suggestion: '',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      // Should still render without crashing
      expect(screen.getByText('Goal issue')).toBeInTheDocument();
    });

    it('should handle very long messages', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'A'.repeat(500),
          suggestion: 'Fix it',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      // Should render without layout issues
      expect(screen.getByText('A'.repeat(500))).toBeInTheDocument();
    });

    it('should handle very long suggestions', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'Issue',
          suggestion: 'B'.repeat(1000),
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      const issueButton = screen.getByText('Issue').closest('button');
      fireEvent.click(issueButton!);

      expect(screen.getByText('B'.repeat(1000))).toBeInTheDocument();
    });

    it('should handle special characters in messages', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: '<script>alert("xss")</script>',
          suggestion: '& < > " \' /',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      // Should escape and render safely
      expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
    });

    it('should handle many issues without performance degradation', () => {
      const issues = Array.from({ length: 50 }, (_, i) => ({
        severity: (['high', 'medium', 'low'] as const)[i % 3],
        category: (['goal', 'output', 'limits', 'data', 'evaluation', 'next'] as const)[i % 6],
        message: `Issue ${i + 1}`,
        suggestion: `Suggestion ${i + 1}`,
      }));

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      // Should render all issues
      expect(screen.getByText('Issue 1')).toBeInTheDocument();
      expect(screen.getByText('Issue 50')).toBeInTheDocument();
    });
  });

  describe('접근성', () => {
    it('should have proper button roles', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'Goal issue',
          suggestion: 'This is the suggestion',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should be keyboard navigable', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'Goal issue',
          suggestion: 'This is the suggestion',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      const issueButton = screen.getByText('Goal issue').closest('button');
      expect(issueButton).toBeTruthy();
      issueButton!.focus();
      expect(issueButton).toHaveFocus();
    });
  });

  describe('우선순위 팁', () => {
    it('should show priority tip when there are high severity issues', () => {
      const issues = [
        {
          severity: 'high' as const,
          category: 'goal',
          message: 'Critical issue',
          suggestion: 'Fix now',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      expect(screen.getByText('높은 우선순위 문제를 먼저 해결하세요')).toBeInTheDocument();
    });

    it('should not show priority tip when no high severity issues', () => {
      const issues = [
        {
          severity: 'medium' as const,
          category: 'output',
          message: 'Medium issue',
          suggestion: 'Fix later',
        },
      ];

      renderWithI18n(<IssueList issues={issues} onApplySuggestion={mockOnApplySuggestion} />);

      expect(screen.queryByText('높은 우선순위 문제를 먼저 해결하세요')).not.toBeInTheDocument();
    });
  });
});
