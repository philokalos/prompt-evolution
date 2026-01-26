/**
 * ClipboardWatcher - Monitors clipboard for prompt-like text
 *
 * Features:
 * - Polls clipboard at configurable intervals
 * - Detects prompt-like patterns (questions, commands, requests)
 * - Filters out sensitive content (passwords, credit cards)
 * - Emits events when prompts are detected
 * - Manual start/stop control (privacy-respecting)
 */

import { clipboard } from 'electron';
import { EventEmitter } from 'events';

export interface ClipboardWatcherOptions {
  pollIntervalMs?: number;
  minTextLength?: number;
  maxTextLength?: number;
}

export interface DetectedPrompt {
  text: string;
  timestamp: Date;
  confidence: number;
}

// Patterns that suggest text is a prompt
const PROMPT_PATTERNS = [
  // Questions
  /\?[\s]*$/,                    // Ends with question mark
  /^(what|how|why|when|where|who|which|can you|could you|would you)/i,
  /^(무엇|어떻게|왜|언제|어디|누가|할 수 있|해줘|알려줘)/,

  // Commands/requests
  /^(please|help me|create|write|generate|explain|analyze|fix|improve)/i,
  /^(만들어|작성해|생성해|설명해|분석해|수정해|개선해)/,

  // Code-related
  /^(implement|refactor|debug|optimize|add|remove|update|modify)/i,
  /(코드|함수|클래스|메서드|버그|에러|오류)/,

  // AI assistant patterns
  /(summarize|translate|convert|compare|list|describe)/i,
  /(요약|번역|변환|비교|나열|설명)/,
];

// Patterns that indicate sensitive content (should not analyze)
const SENSITIVE_PATTERNS = [
  // Passwords
  /^(password|passwd|pwd|secret|token|api[_-]?key)[:=]/i,
  /^[A-Za-z0-9+/]{40,}={0,2}$/,  // Base64 encoded secrets

  // Credit cards
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,

  // SSN
  /\b\d{3}-\d{2}-\d{4}\b/,

  // Korean resident registration number
  /\b\d{6}[-]?\d{7}\b/,

  // Private keys
  /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/,

  // Environment variables
  /^[A-Z_]+=.{20,}$/,
];

// Apps where we should NOT watch clipboard (to avoid feedback loops)
const _IGNORED_SOURCES = [
  'PromptLint',
  'promptlint',
];

export class ClipboardWatcher extends EventEmitter {
  private isActive = false;
  private lastText = '';
  private lastChangeTime = 0;
  private pollInterval: NodeJS.Timeout | null = null;

  private readonly pollMs: number;
  private readonly minLength: number;
  private readonly maxLength: number;

  constructor(options: ClipboardWatcherOptions = {}) {
    super();
    this.pollMs = options.pollIntervalMs ?? 500;
    this.minLength = options.minTextLength ?? 5; // 짧은 프롬프트도 감지 (예: "버그 고쳐줘")
    this.maxLength = options.maxTextLength ?? 10000;
  }

  /**
   * Start watching clipboard for changes
   */
  start(): void {
    if (this.isActive) {
      console.log('[ClipboardWatcher] Already active');
      return;
    }

    this.isActive = true;
    this.lastText = clipboard.readText();
    this.lastChangeTime = Date.now();

    this.pollInterval = setInterval(() => this.check(), this.pollMs);
    console.log(`[ClipboardWatcher] Started (interval: ${this.pollMs}ms)`);

    this.emit('started');
  }

  /**
   * Stop watching clipboard
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.isActive = false;
    console.log('[ClipboardWatcher] Stopped');

    this.emit('stopped');
  }

  /**
   * Check if watcher is currently active
   */
  isWatching(): boolean {
    return this.isActive;
  }

  /**
   * Toggle watcher state
   */
  toggle(): boolean {
    if (this.isActive) {
      this.stop();
    } else {
      this.start();
    }
    return this.isActive;
  }

  /**
   * Check clipboard for changes
   */
  private check(): void {
    try {
      const currentText = clipboard.readText();

      // No change
      if (currentText === this.lastText) {
        return;
      }

      console.log(`[ClipboardWatcher] Clipboard changed: "${currentText.substring(0, 30)}..." (${currentText.length} chars)`);

      // Update state
      this.lastText = currentText;
      this.lastChangeTime = Date.now();

      // Validate text
      if (!this.isValidText(currentText)) {
        console.log(`[ClipboardWatcher] Text invalid (min: ${this.minLength}, got: ${currentText.trim().length})`);
        return;
      }

      // Check for sensitive content
      if (this.isSensitive(currentText)) {
        console.log('[ClipboardWatcher] Sensitive content detected, ignoring');
        return;
      }

      // Check if it looks like a prompt
      const confidence = this.calculatePromptConfidence(currentText);
      console.log(`[ClipboardWatcher] Confidence: ${confidence.toFixed(2)}`);

      if (confidence > 0.05) { // 매우 낮은 임계값 - 대부분의 텍스트 감지
        const detected: DetectedPrompt = {
          text: currentText,
          timestamp: new Date(),
          confidence,
        };

        console.log(`[ClipboardWatcher] Prompt detected (confidence: ${confidence.toFixed(2)})`);
        this.emit('prompt-detected', detected);
      }
    } catch (error) {
      // Log error but don't stop the interval
      console.warn('[ClipboardWatcher] Error checking clipboard:', error);
    }
  }

  /**
   * Validate text meets basic criteria
   */
  private isValidText(text: string): boolean {
    const trimmed = text.trim();

    // Too short
    if (trimmed.length < this.minLength) {
      return false;
    }

    // Too long
    if (trimmed.length > this.maxLength) {
      return false;
    }

    // Only whitespace
    if (!trimmed) {
      return false;
    }

    // Only numbers
    if (/^\d+$/.test(trimmed)) {
      return false;
    }

    // Single word (likely not a prompt)
    if (!/\s/.test(trimmed) && trimmed.length < 50) {
      return false;
    }

    return true;
  }

  /**
   * Check if text contains sensitive information
   */
  private isSensitive(text: string): boolean {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(text));
  }

  /**
   * Calculate confidence score that text is a prompt (0-1)
   */
  private calculatePromptConfidence(text: string): number {
    let score = 0;
    const normalizedText = text.toLowerCase().trim();

    // Pattern matching
    let matchCount = 0;
    for (const pattern of PROMPT_PATTERNS) {
      if (pattern.test(text)) {
        matchCount++;
      }
    }

    // Base score from pattern matches (0-0.5)
    score += Math.min(matchCount * 0.15, 0.5);

    // Length bonus (prompts tend to be 50-500 chars)
    const len = normalizedText.length;
    if (len >= 50 && len <= 500) {
      score += 0.2;
    } else if (len > 500 && len <= 2000) {
      score += 0.1;
    }

    // Sentence structure (has punctuation suggesting complete thoughts)
    if (/[.!?]\s+[A-Z가-힣]/.test(text) || /[.!?]$/.test(text)) {
      score += 0.1;
    }

    // Contains technical terms (likely dev prompt)
    if (/\b(function|class|method|api|error|bug|code|test|component)\b/i.test(text)) {
      score += 0.1;
    }

    // Korean technical terms
    if (/(함수|클래스|메서드|에러|버그|코드|테스트|컴포넌트)/.test(text)) {
      score += 0.1;
    }

    // Conversational markers
    if (/^(hi|hello|hey|안녕|저기|혹시)/i.test(normalizedText)) {
      score += 0.15;
    }

    // Cap at 1.0
    return Math.min(score, 1.0);
  }
}

// Singleton instance
let watcherInstance: ClipboardWatcher | null = null;

/**
 * Get or create the clipboard watcher instance
 */
export function getClipboardWatcher(options?: ClipboardWatcherOptions): ClipboardWatcher {
  if (!watcherInstance) {
    watcherInstance = new ClipboardWatcher(options);
  }
  return watcherInstance;
}

/**
 * Destroy the clipboard watcher instance
 */
export function destroyClipboardWatcher(): void {
  if (watcherInstance) {
    watcherInstance.stop();
    watcherInstance.removeAllListeners();
    watcherInstance = null;
  }
}
