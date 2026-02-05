/**
 * Tests for Signal Detector
 * Verifies signal detection from conversation turns
 */
import { describe, it, expect } from 'vitest';
import {
  detectTurnSignals,
  detectConversationSignals,
  getDominantSignalType,
  classifyBasicPromptIntent,
  type TurnForAnalysis,
} from './signal-detector.js';

describe('detectTurnSignals', () => {
  describe('positive feedback detection', () => {
    it('detects positive feedback signals', () => {
      const turn: TurnForAnalysis = {
        id: 'turn-1',
        role: 'user',
        content: '좋아요! 이게 완벽해요. Thanks!',
        turnIndex: 0,
      };

      const signals = detectTurnSignals(turn);

      expect(signals.length).toBeGreaterThan(0);
      expect(signals.some((s) => s.type === 'positive_feedback')).toBe(true);
    });

    it('returns higher confidence for more keywords', () => {
      const singleKeyword: TurnForAnalysis = {
        id: 'turn-1',
        role: 'user',
        content: 'Thanks',
        turnIndex: 0,
      };

      const multipleKeywords: TurnForAnalysis = {
        id: 'turn-2',
        role: 'user',
        content: 'Thanks! Great job! Perfect!',
        turnIndex: 0,
      };

      const singleSignals = detectTurnSignals(singleKeyword);
      const multiSignals = detectTurnSignals(multipleKeywords);

      const singleConf = singleSignals.find((s) => s.type === 'positive_feedback')?.confidence ?? 0;
      const multiConf = multiSignals.find((s) => s.type === 'positive_feedback')?.confidence ?? 0;

      expect(multiConf).toBeGreaterThan(singleConf);
    });
  });

  describe('negative feedback detection', () => {
    it('detects negative feedback signals', () => {
      const turn: TurnForAnalysis = {
        id: 'turn-1',
        role: 'user',
        content: '이건 잘못됐어요. This is wrong.',
        turnIndex: 0,
      };

      const signals = detectTurnSignals(turn);

      expect(signals.some((s) => s.type === 'negative_feedback')).toBe(true);
    });
  });

  describe('retry attempt detection', () => {
    it('detects retry signals', () => {
      const turn: TurnForAnalysis = {
        id: 'turn-1',
        role: 'user',
        content: '다시 해봐. Try again please.',
        turnIndex: 0,
      };

      const signals = detectTurnSignals(turn);

      expect(signals.some((s) => s.type === 'retry_attempt')).toBe(true);
    });
  });

  describe('task completion detection', () => {
    it('detects completion signals', () => {
      const turn: TurnForAnalysis = {
        id: 'turn-1',
        role: 'user',
        content: '완료됐어요. Task is done.',
        turnIndex: 0,
      };

      const signals = detectTurnSignals(turn);

      expect(signals.some((s) => s.type === 'task_completion')).toBe(true);
    });
  });

  describe('question detection', () => {
    it('detects question signals', () => {
      const turn: TurnForAnalysis = {
        id: 'turn-1',
        role: 'user',
        content: '이게 뭐야? What is this?',
        turnIndex: 0,
      };

      const signals = detectTurnSignals(turn);

      expect(signals.some((s) => s.type === 'question')).toBe(true);
    });
  });

  describe('command detection', () => {
    it('detects command signals', () => {
      const turn: TurnForAnalysis = {
        id: 'turn-1',
        role: 'user',
        content: '이거 수정해줘. Fix this bug.',
        turnIndex: 0,
      };

      const signals = detectTurnSignals(turn);

      expect(signals.some((s) => s.type === 'command')).toBe(true);
    });
  });

  describe('context providing detection', () => {
    it('detects context signals', () => {
      const turn: TurnForAnalysis = {
        id: 'turn-1',
        role: 'user',
        content: '배경 설명하자면... For context, here is the situation...',
        turnIndex: 0,
      };

      const signals = detectTurnSignals(turn);

      expect(signals.some((s) => s.type === 'context_providing')).toBe(true);
    });
  });

  describe('role filtering', () => {
    it('only analyzes user turns', () => {
      const assistantTurn: TurnForAnalysis = {
        id: 'turn-1',
        role: 'assistant',
        content: '좋아요! Thanks! This is great!',
        turnIndex: 0,
      };

      const signals = detectTurnSignals(assistantTurn);

      expect(signals).toHaveLength(0);
    });
  });

  describe('multiple signal detection', () => {
    it('can detect multiple signal types in one turn', () => {
      const turn: TurnForAnalysis = {
        id: 'turn-1',
        role: 'user',
        content: '좋아요! 하지만 이 부분은 수정해줘.',
        turnIndex: 0,
      };

      const signals = detectTurnSignals(turn);

      // Could have both positive feedback and command
      expect(signals.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('detectConversationSignals', () => {
  it('aggregates signals from multiple turns', () => {
    const turns: TurnForAnalysis[] = [
      { id: 'turn-1', role: 'user', content: '이거 수정해줘', turnIndex: 0 },
      { id: 'turn-2', role: 'assistant', content: '수정했습니다', turnIndex: 1 },
      { id: 'turn-3', role: 'user', content: '좋아요! 감사합니다', turnIndex: 2 },
      { id: 'turn-4', role: 'assistant', content: '도움이 되어 기쁩니다', turnIndex: 3 },
    ];

    const result = detectConversationSignals('conv-1', turns);

    expect(result.conversationId).toBe('conv-1');
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.summary.positiveCount).toBeGreaterThan(0);
    expect(result.summary.commandCount).toBeGreaterThan(0);
  });

  it('calculates sentiment score correctly', () => {
    const positiveTurns: TurnForAnalysis[] = [
      { id: 'turn-1', role: 'user', content: '좋아요! Perfect!', turnIndex: 0 },
      { id: 'turn-2', role: 'user', content: 'Great job!', turnIndex: 1 },
    ];

    const result = detectConversationSignals('conv-1', positiveTurns);

    // Sentiment should be positive (closer to 1)
    expect(result.summary.sentimentScore).toBeGreaterThan(0);
  });

  it('handles empty turn list', () => {
    const result = detectConversationSignals('conv-1', []);

    expect(result.signals).toHaveLength(0);
    expect(result.summary.positiveCount).toBe(0);
    expect(result.summary.sentimentScore).toBe(0);
  });
});

describe('getDominantSignalType', () => {
  it('returns the highest confidence signal type', () => {
    const turn: TurnForAnalysis = {
      id: 'turn-1',
      role: 'user',
      content: '좋아요! 완벽해요!',
      turnIndex: 0,
    };

    const dominant = getDominantSignalType(turn);

    expect(dominant).not.toBeNull();
  });

  it('returns null for turns with no signals', () => {
    const turn: TurnForAnalysis = {
      id: 'turn-1',
      role: 'user',
      content: 'abc123',
      turnIndex: 0,
    };

    const dominant = getDominantSignalType(turn);

    expect(dominant).toBeNull();
  });

  it('returns null for assistant turns', () => {
    const turn: TurnForAnalysis = {
      id: 'turn-1',
      role: 'assistant',
      content: '좋아요!',
      turnIndex: 0,
    };

    const dominant = getDominantSignalType(turn);

    expect(dominant).toBeNull();
  });
});

describe('classifyBasicPromptIntent', () => {
  it('classifies command intent', () => {
    const intent = classifyBasicPromptIntent('이거 수정해줘. Fix this.');

    expect(intent).toBe('command');
  });

  it('classifies question intent', () => {
    const intent = classifyBasicPromptIntent('이게 뭐야? What is this?');

    expect(intent).toBe('question');
  });

  it('classifies feedback intent', () => {
    const intent = classifyBasicPromptIntent('좋아요! 완벽해요!');

    expect(intent).toBe('feedback');
  });

  it('classifies context intent', () => {
    const intent = classifyBasicPromptIntent('배경을 설명하자면 이러합니다...');

    expect(intent).toBe('context');
  });

  it('returns unknown for unrecognized content', () => {
    const intent = classifyBasicPromptIntent('xyz abc 123');

    expect(intent).toBe('unknown');
  });
});
