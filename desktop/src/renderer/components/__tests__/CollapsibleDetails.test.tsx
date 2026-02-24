/**
 * CollapsibleDetails Component Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import CollapsibleDetails from '../CollapsibleDetails';

// Initialize i18n for tests
i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  ns: ['analysis'],
  defaultNS: 'analysis',
  resources: {
    en: {
      analysis: {
        details: {
          expand: 'Show details',
          collapse: 'Hide details',
        },
      },
    },
  },
});

const renderWithI18n = (component: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CollapsibleDetails', () => {
  describe('Default collapsed state', () => {
    it('should render in collapsed state by default', () => {
      renderWithI18n(
        <CollapsibleDetails>
          <p>Hidden content</p>
        </CollapsibleDetails>
      );

      expect(screen.getByText('Show details')).toBeInTheDocument();
      expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
    });

    it('should show expand text when collapsed', () => {
      renderWithI18n(
        <CollapsibleDetails>
          <p>Content</p>
        </CollapsibleDetails>
      );

      expect(screen.getByText('Show details')).toBeInTheDocument();
      expect(screen.queryByText('Hide details')).not.toBeInTheDocument();
    });
  });

  describe('Initial open state', () => {
    it('should render in open state when defaultOpen is true', () => {
      renderWithI18n(
        <CollapsibleDetails defaultOpen>
          <p>Visible content</p>
        </CollapsibleDetails>
      );

      expect(screen.getByText('Hide details')).toBeInTheDocument();
      expect(screen.getByText('Visible content')).toBeInTheDocument();
    });

    it('should show collapse text when open', () => {
      renderWithI18n(
        <CollapsibleDetails defaultOpen>
          <p>Content</p>
        </CollapsibleDetails>
      );

      expect(screen.getByText('Hide details')).toBeInTheDocument();
      expect(screen.queryByText('Show details')).not.toBeInTheDocument();
    });
  });

  describe('Toggle interaction', () => {
    it('should expand on click to show children', () => {
      renderWithI18n(
        <CollapsibleDetails>
          <p>Expandable content</p>
        </CollapsibleDetails>
      );

      // Initially hidden
      expect(screen.queryByText('Expandable content')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByText('Show details'));

      // Now visible
      expect(screen.getByText('Expandable content')).toBeInTheDocument();
      expect(screen.getByText('Hide details')).toBeInTheDocument();
    });

    it('should collapse on second click to hide children', () => {
      renderWithI18n(
        <CollapsibleDetails>
          <p>Toggle content</p>
        </CollapsibleDetails>
      );

      // Expand
      fireEvent.click(screen.getByText('Show details'));
      expect(screen.getByText('Toggle content')).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByText('Hide details'));
      expect(screen.queryByText('Toggle content')).not.toBeInTheDocument();
      expect(screen.getByText('Show details')).toBeInTheDocument();
    });

    it('should collapse from initially open state', () => {
      renderWithI18n(
        <CollapsibleDetails defaultOpen>
          <p>Initially visible</p>
        </CollapsibleDetails>
      );

      expect(screen.getByText('Initially visible')).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(screen.getByText('Hide details'));

      expect(screen.queryByText('Initially visible')).not.toBeInTheDocument();
      expect(screen.getByText('Show details')).toBeInTheDocument();
    });

    it('should toggle multiple times correctly', () => {
      renderWithI18n(
        <CollapsibleDetails>
          <p>Multi-toggle content</p>
        </CollapsibleDetails>
      );

      // Expand
      fireEvent.click(screen.getByText('Show details'));
      expect(screen.getByText('Multi-toggle content')).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByText('Hide details'));
      expect(screen.queryByText('Multi-toggle content')).not.toBeInTheDocument();

      // Expand again
      fireEvent.click(screen.getByText('Show details'));
      expect(screen.getByText('Multi-toggle content')).toBeInTheDocument();

      // Collapse again
      fireEvent.click(screen.getByText('Hide details'));
      expect(screen.queryByText('Multi-toggle content')).not.toBeInTheDocument();
    });
  });

  describe('Children rendering', () => {
    it('should render multiple children when expanded', () => {
      renderWithI18n(
        <CollapsibleDetails defaultOpen>
          <p>Child 1</p>
          <p>Child 2</p>
          <p>Child 3</p>
        </CollapsibleDetails>
      );

      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
      expect(screen.getByText('Child 3')).toBeInTheDocument();
    });

    it('should render complex children when expanded', () => {
      renderWithI18n(
        <CollapsibleDetails defaultOpen>
          <div data-testid="complex-child">
            <h3>Section Title</h3>
            <ul>
              <li>Item A</li>
              <li>Item B</li>
            </ul>
          </div>
        </CollapsibleDetails>
      );

      expect(screen.getByTestId('complex-child')).toBeInTheDocument();
      expect(screen.getByText('Section Title')).toBeInTheDocument();
      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.getByText('Item B')).toBeInTheDocument();
    });
  });

  describe('Toggle button', () => {
    it('should have a clickable button element', () => {
      renderWithI18n(
        <CollapsibleDetails>
          <p>Content</p>
        </CollapsibleDetails>
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should be keyboard accessible via button role', () => {
      renderWithI18n(
        <CollapsibleDetails>
          <p>Content</p>
        </CollapsibleDetails>
      );

      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
    });
  });

  describe('Edge cases', () => {
    it('should handle defaultOpen=false explicitly', () => {
      renderWithI18n(
        <CollapsibleDetails defaultOpen={false}>
          <p>Hidden by default</p>
        </CollapsibleDetails>
      );

      expect(screen.queryByText('Hidden by default')).not.toBeInTheDocument();
      expect(screen.getByText('Show details')).toBeInTheDocument();
    });

    it('should handle empty children without crashing', () => {
      renderWithI18n(
        <CollapsibleDetails defaultOpen>
          {null}
        </CollapsibleDetails>
      );

      expect(screen.getByText('Hide details')).toBeInTheDocument();
    });

    it('should handle string children when expanded', () => {
      renderWithI18n(
        <CollapsibleDetails defaultOpen>
          Plain text content
        </CollapsibleDetails>
      );

      expect(screen.getByText('Plain text content')).toBeInTheDocument();
    });
  });
});
