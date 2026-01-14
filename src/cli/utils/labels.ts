/**
 * Label Utilities for CLI Output
 */

/**
 * Get human-readable label for signal type
 */
export function getSignalLabel(signalType: string): string {
  const labels: Record<string, string> = {
    positive_feedback: '😊 긍정적 피드백',
    negative_feedback: '😞 부정적 피드백',
    retry_attempt: '🔄 재시도',
    task_completion: '✅ 작업 완료',
    question: '❓ 질문',
    command: '⚡ 명령',
    context_providing: '📋 컨텍스트 제공',
  };
  return labels[signalType] || signalType;
}
