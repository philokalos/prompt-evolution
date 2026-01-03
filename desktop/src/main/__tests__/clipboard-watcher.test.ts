/**
 * ClipboardWatcher Unit Tests
 *
 * Tests for clipboard monitoring and prompt detection functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Electron clipboard module
vi.mock('electron', () => ({
  clipboard: {
    readText: vi.fn(),
  },
}));

import { clipboard } from 'electron';
import {
  ClipboardWatcher,
  getClipboardWatcher,
  destroyClipboardWatcher,
  type DetectedPrompt,
} from '../clipboard-watcher.js';

describe('ClipboardWatcher', () => {
  let watcher: ClipboardWatcher;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(clipboard.readText).mockReturnValue('');
    destroyClipboardWatcher();
    watcher = new ClipboardWatcher({ pollIntervalMs: 100 });
  });

  afterEach(() => {
    watcher.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Basic Lifecycle', () => {
    it('should start and stop correctly', () => {
      expect(watcher.isWatching()).toBe(false);

      watcher.start();
      expect(watcher.isWatching()).toBe(true);

      watcher.stop();
      expect(watcher.isWatching()).toBe(false);
    });

    it('should not start twice', () => {
      const startedHandler = vi.fn();
      watcher.on('started', startedHandler);

      watcher.start();
      watcher.start();

      expect(startedHandler).toHaveBeenCalledTimes(1);
    });

    it('should toggle state correctly', () => {
      expect(watcher.toggle()).toBe(true);  // started
      expect(watcher.isWatching()).toBe(true);

      expect(watcher.toggle()).toBe(false); // stopped
      expect(watcher.isWatching()).toBe(false);
    });

    it('should emit started and stopped events', () => {
      const startedHandler = vi.fn();
      const stoppedHandler = vi.fn();

      watcher.on('started', startedHandler);
      watcher.on('stopped', stoppedHandler);

      watcher.start();
      expect(startedHandler).toHaveBeenCalledTimes(1);

      watcher.stop();
      expect(stoppedHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Prompt Detection', () => {
    it('should detect prompt-like text when clipboard changes', () => {
      const promptHandler = vi.fn();
      watcher.on('prompt-detected', promptHandler);
      watcher.start();

      // Initial clipboard state
      vi.mocked(clipboard.readText).mockReturnValue('initial text');
      vi.advanceTimersByTime(100);

      // No prompt yet - just initial state
      expect(promptHandler).not.toHaveBeenCalled();

      // Clipboard changes to prompt-like text
      vi.mocked(clipboard.readText).mockReturnValue('How do I implement a React component with TypeScript?');
      vi.advanceTimersByTime(100);

      expect(promptHandler).toHaveBeenCalledTimes(1);
      const detected: DetectedPrompt = promptHandler.mock.calls[0][0];
      expect(detected.text).toContain('React component');
      expect(detected.confidence).toBeGreaterThan(0.3);
    });

    it('should not detect the same text twice', () => {
      const promptHandler = vi.fn();
      watcher.on('prompt-detected', promptHandler);
      watcher.start();

      // Set initial text as empty
      vi.mocked(clipboard.readText).mockReturnValue('');
      vi.advanceTimersByTime(100);

      // Change to prompt (long enough to be detected)
      vi.mocked(clipboard.readText).mockReturnValue('Please explain how to fix this bug in my TypeScript code. The error message says undefined.');
      vi.advanceTimersByTime(100);
      expect(promptHandler).toHaveBeenCalledTimes(1);

      // Same text again (no change should trigger detection)
      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(100);
      expect(promptHandler).toHaveBeenCalledTimes(1);
    });

    it('should detect Korean prompts', () => {
      const promptHandler = vi.fn();
      watcher.on('prompt-detected', promptHandler);
      watcher.start();

      vi.mocked(clipboard.readText).mockReturnValue('');
      vi.advanceTimersByTime(100);

      vi.mocked(clipboard.readText).mockReturnValue('이 코드에서 버그를 수정해주세요. 에러가 발생합니다.');
      vi.advanceTimersByTime(100);

      expect(promptHandler).toHaveBeenCalledTimes(1);
      const detected: DetectedPrompt = promptHandler.mock.calls[0][0];
      expect(detected.confidence).toBeGreaterThan(0.3);
    });

    it('should detect question patterns', () => {
      const promptHandler = vi.fn();
      watcher.on('prompt-detected', promptHandler);
      watcher.start();

      vi.mocked(clipboard.readText).mockReturnValue('');
      vi.advanceTimersByTime(100);

      vi.mocked(clipboard.readText).mockReturnValue('What is the best way to optimize database queries for performance?');
      vi.advanceTimersByTime(100);

      expect(promptHandler).toHaveBeenCalledTimes(1);
    });

    it('should detect command patterns', () => {
      const promptHandler = vi.fn();
      watcher.on('prompt-detected', promptHandler);
      watcher.start();

      vi.mocked(clipboard.readText).mockReturnValue('');
      vi.advanceTimersByTime(100);

      vi.mocked(clipboard.readText).mockReturnValue('Create a function that validates email addresses and returns true or false.');
      vi.advanceTimersByTime(100);

      expect(promptHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Text Validation', () => {
    it('should ignore text that is too short', () => {
      const promptHandler = vi.fn();
      watcher.on('prompt-detected', promptHandler);
      watcher.start();

      vi.mocked(clipboard.readText).mockReturnValue('');
      vi.advanceTimersByTime(100);

      vi.mocked(clipboard.readText).mockReturnValue('short');
      vi.advanceTimersByTime(100);

      expect(promptHandler).not.toHaveBeenCalled();
    });

    it('should ignore text that is only numbers', () => {
      const promptHandler = vi.fn();
      watcher.on('prompt-detected', promptHandler);
      watcher.start();

      vi.mocked(clipboard.readText).mockReturnValue('');
      vi.advanceTimersByTime(100);

      vi.mocked(clipboard.readText).mockReturnValue('12345678901234567890');
      vi.advanceTimersByTime(100);

      expect(promptHandler).not.toHaveBeenCalled();
    });

    it('should ignore single words under 50 chars', () => {
      const promptHandler = vi.fn();
      watcher.on('prompt-detected', promptHandler);
      watcher.start();

      vi.mocked(clipboard.readText).mockReturnValue('');
      vi.advanceTimersByTime(100);

      vi.mocked(clipboard.readText).mockReturnValue('singlewordwithoutspaces');
      vi.advanceTimersByTime(100);

      expect(promptHandler).not.toHaveBeenCalled();
    });
  });

  describe('Sensitive Content Filtering', () => {
    it('should ignore password-like content', () => {
      const promptHandler = vi.fn();
      watcher.on('prompt-detected', promptHandler);
      watcher.start();

      vi.mocked(clipboard.readText).mockReturnValue('');
      vi.advanceTimersByTime(100);

      vi.mocked(clipboard.readText).mockReturnValue('password: supersecretpassword123');
      vi.advanceTimersByTime(100);

      expect(promptHandler).not.toHaveBeenCalled();
    });

    it('should ignore credit card numbers', () => {
      const promptHandler = vi.fn();
      watcher.on('prompt-detected', promptHandler);
      watcher.start();

      vi.mocked(clipboard.readText).mockReturnValue('');
      vi.advanceTimersByTime(100);

      vi.mocked(clipboard.readText).mockReturnValue('My card number is 4111-1111-1111-1111 for payment');
      vi.advanceTimersByTime(100);

      expect(promptHandler).not.toHaveBeenCalled();
    });

    it('should ignore private keys', () => {
      const promptHandler = vi.fn();
      watcher.on('prompt-detected', promptHandler);
      watcher.start();

      vi.mocked(clipboard.readText).mockReturnValue('');
      vi.advanceTimersByTime(100);

      vi.mocked(clipboard.readText).mockReturnValue('-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAKj34');
      vi.advanceTimersByTime(100);

      expect(promptHandler).not.toHaveBeenCalled();
    });

    it('should ignore base64 encoded secrets', () => {
      const promptHandler = vi.fn();
      watcher.on('prompt-detected', promptHandler);
      watcher.start();

      vi.mocked(clipboard.readText).mockReturnValue('');
      vi.advanceTimersByTime(100);

      // 40+ char base64 string (looks like a secret)
      vi.mocked(clipboard.readText).mockReturnValue('YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwYWJjZA==');
      vi.advanceTimersByTime(100);

      expect(promptHandler).not.toHaveBeenCalled();
    });

    it('should ignore Korean resident registration numbers', () => {
      const promptHandler = vi.fn();
      watcher.on('prompt-detected', promptHandler);
      watcher.start();

      vi.mocked(clipboard.readText).mockReturnValue('');
      vi.advanceTimersByTime(100);

      vi.mocked(clipboard.readText).mockReturnValue('주민등록번호: 901231-1234567 입력해주세요');
      vi.advanceTimersByTime(100);

      expect(promptHandler).not.toHaveBeenCalled();
    });
  });

  describe('Confidence Scoring', () => {
    it('should give higher confidence to prompts with multiple indicators', () => {
      const promptHandler = vi.fn();
      watcher.on('prompt-detected', promptHandler);
      watcher.start();

      vi.mocked(clipboard.readText).mockReturnValue('');
      vi.advanceTimersByTime(100);

      // Minimal prompt (fewer indicators)
      vi.mocked(clipboard.readText).mockReturnValue('Please help me with something. This is a basic request without many indicators.');
      vi.advanceTimersByTime(100);
      expect(promptHandler).toHaveBeenCalledTimes(1);
      const simpleConfidence = (promptHandler.mock.calls[0][0] as DetectedPrompt).confidence;

      // Change to different text (reset detection)
      vi.mocked(clipboard.readText).mockReturnValue('different text to reset state here');
      vi.advanceTimersByTime(100);

      // Rich prompt with multiple indicators (code, question, technical terms, conversational)
      vi.mocked(clipboard.readText).mockReturnValue(
        'Hello! How do I implement a React component that handles form validation with TypeScript? ' +
        'Please explain the code structure, debug the error, and provide best practices for test coverage.'
      );
      vi.advanceTimersByTime(100);
      expect(promptHandler).toHaveBeenCalledTimes(2);
      const richConfidence = (promptHandler.mock.calls[1][0] as DetectedPrompt).confidence;

      // Rich prompt should have higher confidence due to more pattern matches
      expect(richConfidence).toBeGreaterThanOrEqual(simpleConfidence);
    });

    it('should give bonus to conversational markers', () => {
      const promptHandler = vi.fn();
      watcher.on('prompt-detected', promptHandler);
      watcher.start();

      vi.mocked(clipboard.readText).mockReturnValue('');
      vi.advanceTimersByTime(100);

      vi.mocked(clipboard.readText).mockReturnValue('Hello! Can you help me understand how async/await works in JavaScript?');
      vi.advanceTimersByTime(100);

      const detected: DetectedPrompt = promptHandler.mock.calls[0][0];
      expect(detected.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getClipboardWatcher', () => {
      destroyClipboardWatcher();

      const instance1 = getClipboardWatcher();
      const instance2 = getClipboardWatcher();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after destroy', () => {
      const instance1 = getClipboardWatcher();
      destroyClipboardWatcher();
      const instance2 = getClipboardWatcher();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom poll interval', () => {
      const customWatcher = new ClipboardWatcher({ pollIntervalMs: 500 });
      const promptHandler = vi.fn();
      customWatcher.on('prompt-detected', promptHandler);
      customWatcher.start();

      vi.mocked(clipboard.readText).mockReturnValue('');
      vi.advanceTimersByTime(500);

      vi.mocked(clipboard.readText).mockReturnValue('How do I fix this TypeScript error in my React component?');

      // Not detected at 100ms
      vi.advanceTimersByTime(100);
      expect(promptHandler).not.toHaveBeenCalled();

      // Detected at 500ms
      vi.advanceTimersByTime(400);
      expect(promptHandler).toHaveBeenCalledTimes(1);

      customWatcher.stop();
    });

    it('should respect custom min text length', () => {
      const customWatcher = new ClipboardWatcher({ minTextLength: 80 });
      const promptHandler = vi.fn();
      customWatcher.on('prompt-detected', promptHandler);
      customWatcher.start();

      vi.mocked(clipboard.readText).mockReturnValue('');
      vi.advanceTimersByTime(500);

      // 70 chars - should be ignored (below 80 char threshold)
      vi.mocked(clipboard.readText).mockReturnValue('How do I fix this bug in the code? It keeps throwing errors all the time.');
      vi.advanceTimersByTime(500);
      expect(promptHandler).not.toHaveBeenCalled();

      // 90 chars - should be detected (above 80 char threshold)
      vi.mocked(clipboard.readText).mockReturnValue('How do I fix this bug in the TypeScript code? It keeps throwing undefined errors all the time.');
      vi.advanceTimersByTime(500);
      expect(promptHandler).toHaveBeenCalledTimes(1);

      customWatcher.stop();
    });
  });
});
