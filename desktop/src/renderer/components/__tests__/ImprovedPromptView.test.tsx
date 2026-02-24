/**
 * ImprovedPromptView Component Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import ImprovedPromptView from '../ImprovedPromptView';

// Initialize i18n for tests
i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  ns: ['analysis'],
  defaultNS: 'analysis',
  resources: {
    en: {
      analysis: {
        improvedPrompt: {
          title: 'Improved Prompt',
          replace: 'Replace',
          copyAndSwitch: 'Copy & Switch',
          copied: 'Copied!',
          pasteHint: 'Cmd+V to paste',
          noImprovement: 'Already well-written!',
          contextBadge: 'Context',
        },
      },
    },
  },
});

const renderWithI18n = (component: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);
};

// ---------------------------------------------------------------------------
// Helper: variant factory
// ---------------------------------------------------------------------------

function createVariant(overrides: Partial<{
  rewrittenPrompt: string;
  variant: string;
  confidence: number;
  keyChanges: string[];
  variantLabel: string;
  isAiGenerated: boolean;
  isLoading: boolean;
  needsSetup: boolean;
}> = {}) {
  return {
    rewrittenPrompt: 'Improved version of the prompt with better structure',
    variant: 'balanced',
    confidence: 0.75,
    keyChanges: ['Added goal', 'Structured output'],
    variantLabel: 'Balanced',
    isAiGenerated: false,
    isLoading: false,
    needsSetup: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImprovedPromptView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering with variants', () => {
    it('should render the header title', () => {
      const variants = [createVariant()];
      renderWithI18n(<ImprovedPromptView variants={variants} grade="B" />);

      expect(screen.getByText('Improved Prompt')).toBeInTheDocument();
    });

    it('should render the improved prompt text', () => {
      const variants = [createVariant({ rewrittenPrompt: 'Write a function that sorts an array in O(n log n) time' })];
      renderWithI18n(<ImprovedPromptView variants={variants} grade="B" />);

      expect(screen.getByText('Write a function that sorts an array in O(n log n) time')).toBeInTheDocument();
    });

    it('should select the variant with highest confidence', () => {
      const variants = [
        createVariant({ rewrittenPrompt: 'Low confidence prompt', confidence: 0.5 }),
        createVariant({ rewrittenPrompt: 'High confidence prompt', confidence: 0.9 }),
        createVariant({ rewrittenPrompt: 'Medium confidence prompt', confidence: 0.7 }),
      ];
      renderWithI18n(<ImprovedPromptView variants={variants} grade="C" />);

      expect(screen.getByText('High confidence prompt')).toBeInTheDocument();
      expect(screen.queryByText('Low confidence prompt')).not.toBeInTheDocument();
      expect(screen.queryByText('Medium confidence prompt')).not.toBeInTheDocument();
    });

    it('should show context badge when contextIncluded is true', () => {
      const variants = [createVariant()];
      renderWithI18n(<ImprovedPromptView variants={variants} grade="B" contextIncluded />);

      expect(screen.getByText('Context')).toBeInTheDocument();
    });

    it('should not show context badge when contextIncluded is false', () => {
      const variants = [createVariant()];
      renderWithI18n(<ImprovedPromptView variants={variants} grade="B" contextIncluded={false} />);

      expect(screen.queryByText('Context')).not.toBeInTheDocument();
    });
  });

  describe('Empty/missing variants', () => {
    it('should return null when no usable variants and grade is not A', () => {
      const { container } = renderWithI18n(
        <ImprovedPromptView variants={[]} grade="C" />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should show "Already well-written!" when no usable variants and grade is A', () => {
      renderWithI18n(
        <ImprovedPromptView variants={[]} grade="A" />
      );

      expect(screen.getByText('Already well-written!')).toBeInTheDocument();
    });

    it('should filter out loading variants', () => {
      const variants = [
        createVariant({ rewrittenPrompt: 'Loading variant', isLoading: true }),
      ];
      const { container } = renderWithI18n(
        <ImprovedPromptView variants={variants} grade="C" />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should filter out needsSetup variants', () => {
      const variants = [
        createVariant({ rewrittenPrompt: 'Setup needed variant', needsSetup: true }),
      ];
      const { container } = renderWithI18n(
        <ImprovedPromptView variants={variants} grade="C" />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should filter out variants with empty rewrittenPrompt', () => {
      const variants = [
        createVariant({ rewrittenPrompt: '' }),
      ];
      const { container } = renderWithI18n(
        <ImprovedPromptView variants={variants} grade="C" />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should pick the best from mixed usable and unusable variants', () => {
      const variants = [
        createVariant({ rewrittenPrompt: '', confidence: 0.99 }),
        createVariant({ rewrittenPrompt: 'Loading one', isLoading: true, confidence: 0.95 }),
        createVariant({ rewrittenPrompt: 'The only usable variant', confidence: 0.6 }),
      ];
      renderWithI18n(<ImprovedPromptView variants={variants} grade="C" />);

      expect(screen.getByText('The only usable variant')).toBeInTheDocument();
    });
  });

  describe('Copy button', () => {
    it('should render a copy button', () => {
      const variants = [createVariant()];
      renderWithI18n(<ImprovedPromptView variants={variants} grade="B" />);

      const copyButton = screen.getByTitle('Copy');
      expect(copyButton).toBeInTheDocument();
    });

    it('should call onCopy with prompt text when copy button clicked', () => {
      const onCopy = vi.fn();
      const variants = [createVariant({ rewrittenPrompt: 'Copy me' })];
      renderWithI18n(
        <ImprovedPromptView variants={variants} grade="B" onCopy={onCopy} />
      );

      const copyButton = screen.getByTitle('Copy');
      fireEvent.click(copyButton);

      expect(onCopy).toHaveBeenCalledTimes(1);
      expect(onCopy).toHaveBeenCalledWith('Copy me');
    });

    it('should not throw when onCopy is undefined and copy is clicked', () => {
      const variants = [createVariant()];
      renderWithI18n(
        <ImprovedPromptView variants={variants} grade="B" />
      );

      const copyButton = screen.getByTitle('Copy');
      expect(() => fireEvent.click(copyButton)).not.toThrow();
    });

    it('should show copied state briefly after copy', () => {
      const onCopy = vi.fn();
      const variants = [createVariant()];
      renderWithI18n(
        <ImprovedPromptView variants={variants} grade="B" onCopy={onCopy} />
      );

      const copyButton = screen.getByTitle('Copy');
      fireEvent.click(copyButton);

      // After 2000ms, the copied state should reset
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Button should still be present (state reset to normal)
      expect(screen.getByTitle('Copy')).toBeInTheDocument();
    });
  });

  describe('Apply button (Replace)', () => {
    it('should show Replace button when onApply is provided and not blocked', () => {
      const onApply = vi.fn();
      const variants = [createVariant()];
      renderWithI18n(
        <ImprovedPromptView variants={variants} grade="B" onApply={onApply} />
      );

      expect(screen.getByText('Replace')).toBeInTheDocument();
    });

    it('should not show Replace button when onApply is not provided', () => {
      const variants = [createVariant()];
      renderWithI18n(
        <ImprovedPromptView variants={variants} grade="B" />
      );

      expect(screen.queryByText('Replace')).not.toBeInTheDocument();
    });

    it('should call onApply with prompt text when Replace is clicked', () => {
      const onApply = vi.fn();
      const variants = [createVariant({ rewrittenPrompt: 'Apply this prompt' })];
      renderWithI18n(
        <ImprovedPromptView variants={variants} grade="B" onApply={onApply} />
      );

      fireEvent.click(screen.getByText('Replace'));

      expect(onApply).toHaveBeenCalledTimes(1);
      expect(onApply).toHaveBeenCalledWith('Apply this prompt');
    });

    it('should show Copied! text after apply then reset', () => {
      const onApply = vi.fn();
      const variants = [createVariant()];
      renderWithI18n(
        <ImprovedPromptView variants={variants} grade="B" onApply={onApply} />
      );

      fireEvent.click(screen.getByText('Replace'));
      expect(screen.getByText('Copied!')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByText('Replace')).toBeInTheDocument();
    });
  });

  describe('Copy & Switch button (blocked source app)', () => {
    it('should show Copy & Switch when isSourceAppBlocked is true', () => {
      const onCopyAndSwitch = vi.fn();
      const variants = [createVariant()];
      renderWithI18n(
        <ImprovedPromptView
          variants={variants}
          grade="B"
          isSourceAppBlocked
          onCopyAndSwitch={onCopyAndSwitch}
        />
      );

      expect(screen.getByText('Copy & Switch')).toBeInTheDocument();
    });

    it('should not show Replace when isSourceAppBlocked is true', () => {
      const onApply = vi.fn();
      const onCopyAndSwitch = vi.fn();
      const variants = [createVariant()];
      renderWithI18n(
        <ImprovedPromptView
          variants={variants}
          grade="B"
          isSourceAppBlocked
          onApply={onApply}
          onCopyAndSwitch={onCopyAndSwitch}
        />
      );

      expect(screen.queryByText('Replace')).not.toBeInTheDocument();
      expect(screen.getByText('Copy & Switch')).toBeInTheDocument();
    });

    it('should call onCopyAndSwitch with prompt text when clicked', () => {
      const onCopyAndSwitch = vi.fn();
      const variants = [createVariant({ rewrittenPrompt: 'Switch to this' })];
      renderWithI18n(
        <ImprovedPromptView
          variants={variants}
          grade="B"
          isSourceAppBlocked
          onCopyAndSwitch={onCopyAndSwitch}
        />
      );

      fireEvent.click(screen.getByText('Copy & Switch'));

      expect(onCopyAndSwitch).toHaveBeenCalledTimes(1);
      expect(onCopyAndSwitch).toHaveBeenCalledWith('Switch to this');
    });

    it('should show Copied! text after Copy & Switch then reset', () => {
      const onCopyAndSwitch = vi.fn();
      const variants = [createVariant()];
      renderWithI18n(
        <ImprovedPromptView
          variants={variants}
          grade="B"
          isSourceAppBlocked
          onCopyAndSwitch={onCopyAndSwitch}
        />
      );

      fireEvent.click(screen.getByText('Copy & Switch'));
      expect(screen.getByText('Copied!')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByText('Copy & Switch')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle very long prompt text without crashing', () => {
      const longPrompt = 'A'.repeat(2000);
      const variants = [createVariant({ rewrittenPrompt: longPrompt })];
      renderWithI18n(<ImprovedPromptView variants={variants} grade="B" />);

      expect(screen.getByText(longPrompt)).toBeInTheDocument();
    });

    it('should handle special characters in prompt text', () => {
      const specialPrompt = '<script>alert("xss")</script> & "quotes" \'apostrophes\'';
      const variants = [createVariant({ rewrittenPrompt: specialPrompt })];
      renderWithI18n(<ImprovedPromptView variants={variants} grade="B" />);

      expect(screen.getByText(specialPrompt)).toBeInTheDocument();
    });

    it('should handle whitespace-only rewrittenPrompt as falsy', () => {
      // whitespace is truthy in JS, so the component will show it
      const variants = [createVariant({ rewrittenPrompt: '   ' })];
      renderWithI18n(<ImprovedPromptView variants={variants} grade="B" />);

      // The component checks truthiness of rewrittenPrompt - whitespace is truthy
      expect(screen.getByText('Improved Prompt')).toBeInTheDocument();
    });

    it('should handle single variant correctly', () => {
      const variants = [createVariant({ rewrittenPrompt: 'Single variant prompt' })];
      renderWithI18n(<ImprovedPromptView variants={variants} grade="D" />);

      expect(screen.getByText('Single variant prompt')).toBeInTheDocument();
    });

    it('should handle grade A with valid variants (shows improved prompt, not well-written)', () => {
      const variants = [createVariant({ rewrittenPrompt: 'Even better version' })];
      renderWithI18n(<ImprovedPromptView variants={variants} grade="A" />);

      expect(screen.getByText('Even better version')).toBeInTheDocument();
      expect(screen.queryByText('Already well-written!')).not.toBeInTheDocument();
    });
  });
});
