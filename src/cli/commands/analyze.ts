/**
 * Analyze Command
 * Analyze conversations for quality signals
 */

import { analyzeConversations } from '../services/analysis-service.js';

export interface AnalyzeCommandOptions {
  incremental?: boolean;
  conversationId?: string;
}

export function analyzeCommand(options: AnalyzeCommandOptions): void {
  analyzeConversations(options);
}
