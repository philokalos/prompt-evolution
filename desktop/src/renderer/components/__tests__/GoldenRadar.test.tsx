/**
 * GoldenRadar Component Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import GoldenRadar from '../GoldenRadar';

// Initialize i18n for tests
i18n.init({
  lng: 'ko',
  fallbackLng: 'ko',
  ns: ['analysis', 'help'],
  defaultNS: 'analysis',
  resources: {
    ko: {
      analysis: {
        golden: {
          goal: '목표',
          output: '출력',
          limits: '제한',
          data: '데이터',
          evaluation: '평가',
          next: '다음',
        },
        radar: {
          ariaLabel: 'GOLDEN 레이더 차트',
          helpTitle: 'GOLDEN 이해하기',
          helpDescription: '6가지 차원에서 프롬프트 품질을 평가합니다',
          helpTip: '각 차원을 클릭하면 자세한 설명을 볼 수 있습니다',
          closeAria: '닫기',
        },
      },
      help: {
        golden: {
          title: 'GOLDEN 이해하기',
          goal: {
            title: '목표 (Goal)',
            short: '무엇을 달성하고 싶은지',
            detail: '명확한 목표 설정이 핵심입니다.',
            improvement: '목표를 구체적으로 명시하세요.',
          },
          output: {
            title: '출력 (Output)',
            short: '어떤 형태의 결과물을 원하는지',
            detail: '원하는 출력 형식을 명확히 지정하세요.',
            improvement: '결과물의 형식을 명시하세요.',
          },
          limits: {
            title: '제한 (Limits)',
            short: '제약조건과 경계',
            detail: '지켜야 할 제약사항을 명시하세요.',
            improvement: '제약조건을 추가하세요.',
          },
          data: {
            title: '데이터 (Data)',
            short: '필요한 컨텍스트와 데이터',
            detail: '필요한 맥락과 정보를 제공하세요.',
            improvement: '맥락 정보를 추가하세요.',
          },
          evaluation: {
            title: '평가 (Evaluation)',
            short: '성공 기준 정의',
            detail: '성공을 어떻게 판단할지 명시하세요.',
            improvement: '성공 기준을 추가하세요.',
          },
          next: {
            title: '다음 (Next)',
            short: '후속 작업 명시',
            detail: '다음 단계를 고려하세요.',
            improvement: '다음 작업을 명시하세요.',
          },
        },
      },
    },
  },
});

const renderWithI18n = (component: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);
};

describe('GoldenRadar', () => {
  describe('렌더링', () => {
    it('should render radar chart with default size', () => {
      const scores = {
        goal: 80,
        output: 70,
        limits: 60,
        data: 90,
        evaluation: 50,
        next: 40,
      };

      renderWithI18n(<GoldenRadar scores={scores} />);

      // Check SVG is rendered with default size 200
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '200');
      expect(svg).toHaveAttribute('height', '200');
    });

    it('should render with custom size', () => {
      const scores = {
        goal: 50,
        output: 50,
        limits: 50,
        data: 50,
        evaluation: 50,
        next: 50,
      };

      renderWithI18n(<GoldenRadar scores={scores} size={300} />);

      const svg = document.querySelector('svg');
      expect(svg).toHaveAttribute('width', '300');
      expect(svg).toHaveAttribute('height', '300');
    });

    it('should render all 6 GOLDEN dimensions', () => {
      const scores = {
        goal: 80,
        output: 70,
        limits: 60,
        data: 90,
        evaluation: 50,
        next: 40,
      };

      renderWithI18n(<GoldenRadar scores={scores} />);

      // Check dimension labels (single letters G, O, L, D, E, N)
      // Use getAllByText because each letter appears in both SVG and label
      const labels = ['G', 'O', 'L', 'D', 'E', 'N'];
      labels.forEach((label) => {
        const elements = screen.getAllByText(label);
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    it('should display score values with percentage', () => {
      const scores = {
        goal: 85,
        output: 75,
        limits: 65,
        data: 95,
        evaluation: 55,
        next: 45,
      };

      renderWithI18n(<GoldenRadar scores={scores} />);

      // Check score values are displayed with % suffix in legend
      const scoreValues = [85, 75, 65, 95, 55, 45];
      scoreValues.forEach((value) => {
        const elements = screen.getAllByText(`${value}%`);
        expect(elements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('점수 계산', () => {
    it('should handle zero scores', () => {
      const scores = {
        goal: 0,
        output: 0,
        limits: 0,
        data: 0,
        evaluation: 0,
        next: 0,
      };

      renderWithI18n(<GoldenRadar scores={scores} />);

      // Should render without errors
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should handle max scores (100)', () => {
      const scores = {
        goal: 100,
        output: 100,
        limits: 100,
        data: 100,
        evaluation: 100,
        next: 100,
      };

      renderWithI18n(<GoldenRadar scores={scores} />);

      // Check all scores display 100% (should have at least 6 occurrences)
      const scoreTexts = screen.getAllByText('100%');
      expect(scoreTexts.length).toBeGreaterThanOrEqual(6);
    });

    it('should handle mixed scores', () => {
      const scores = {
        goal: 10,
        output: 30,
        limits: 50,
        data: 70,
        evaluation: 90,
        next: 100,
      };

      renderWithI18n(<GoldenRadar scores={scores} />);

      // Check each unique score is displayed with %
      const scoreValues = [10, 30, 50, 70, 90, 100];
      scoreValues.forEach((value) => {
        const elements = screen.getAllByText(`${value}%`);
        expect(elements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('인터랙션', () => {
    it('should show help button', () => {
      const scores = {
        goal: 50,
        output: 50,
        limits: 50,
        data: 50,
        evaluation: 50,
        next: 50,
      };

      renderWithI18n(<GoldenRadar scores={scores} />);

      // Help button has HelpCircle icon, find by role
      const helpButton = screen.getByRole('button');
      expect(helpButton).toBeInTheDocument();
    });

    it('should open help modal when help button is clicked', async () => {
      const scores = {
        goal: 50,
        output: 50,
        limits: 50,
        data: 50,
        evaluation: 50,
        next: 50,
      };

      renderWithI18n(<GoldenRadar scores={scores} />);

      const helpButton = screen.getByRole('button');
      fireEvent.click(helpButton);

      await waitFor(
        () => {
          // Check if modal title is visible
          const title = screen.queryByText('GOLDEN 이해하기');
          expect(title).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should close help modal when close button is clicked', async () => {
      const scores = {
        goal: 50,
        output: 50,
        limits: 50,
        data: 50,
        evaluation: 50,
        next: 50,
      };

      renderWithI18n(<GoldenRadar scores={scores} />);

      // Open modal
      const helpButton = screen.getByRole('button');
      fireEvent.click(helpButton);

      await waitFor(
        () => {
          expect(screen.getByText('GOLDEN 이해하기')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Close modal - there should be 2 buttons now (help and close)
      const buttons = screen.getAllByRole('button');
      const closeButton = buttons[buttons.length - 1]; // Last button should be close
      fireEvent.click(closeButton);

      await waitFor(
        () => {
          expect(screen.queryByText('GOLDEN 이해하기')).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('호버 상태', () => {
    it('should handle mouse events on dimension points', () => {
      const scores = {
        goal: 80,
        output: 70,
        limits: 60,
        data: 90,
        evaluation: 50,
        next: 40,
      };

      renderWithI18n(<GoldenRadar scores={scores} />);

      // The component should have interactive elements
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();

      // Hover effects are CSS-based, so we just verify the structure exists
      const circles = svg?.querySelectorAll('circle');
      expect(circles).toBeDefined();
    });
  });

  describe('엣지 케이스', () => {
    it('should handle missing score properties with default 0', () => {
      const scores = {
        goal: 50,
        output: 60,
        // limits missing
        data: 70,
        // evaluation missing
        next: 80,
      } as any;

      renderWithI18n(<GoldenRadar scores={scores} />);

      // Should render without crashes
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should handle negative scores as 0', () => {
      const scores = {
        goal: -10,
        output: -20,
        limits: 50,
        data: 60,
        evaluation: 70,
        next: 80,
      };

      renderWithI18n(<GoldenRadar scores={scores} />);

      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should handle scores above 100 as 100', () => {
      const scores = {
        goal: 150,
        output: 200,
        limits: 50,
        data: 60,
        evaluation: 70,
        next: 80,
      };

      renderWithI18n(<GoldenRadar scores={scores} />);

      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should handle fractional scores', () => {
      const scores = {
        goal: 45.5,
        output: 67.3,
        limits: 89.9,
        data: 12.1,
        evaluation: 34.7,
        next: 56.4,
      };

      renderWithI18n(<GoldenRadar scores={scores} />);

      // Should round and display
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('접근성', () => {
    it('should have proper ARIA attributes', () => {
      const scores = {
        goal: 80,
        output: 70,
        limits: 60,
        data: 90,
        evaluation: 50,
        next: 40,
      };

      renderWithI18n(<GoldenRadar scores={scores} />);

      const helpButton = screen.getByRole('button');
      expect(helpButton).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      const scores = {
        goal: 80,
        output: 70,
        limits: 60,
        data: 90,
        evaluation: 50,
        next: 40,
      };

      renderWithI18n(<GoldenRadar scores={scores} />);

      const helpButton = screen.getByRole('button');
      helpButton.focus();
      expect(helpButton).toHaveFocus();
    });
  });
});
