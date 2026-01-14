/**
 * Command Registry
 * Central registry for all CLI commands
 */

export { projectsCommand } from './projects.js';
export { sessionsCommand } from './sessions.js';
export { parseCommand } from './parse.js';
export { statsCommand, dbStatsCommand } from './stats.js';
export { importCommand } from './import.js';
export { analyzeCommand } from './analyze.js';
export { insightsCommand } from './insights.js';
export { classifyCommand } from './classify.js';
export { improveCommand } from './improve.js';
export { reportCommand } from './report.js';

// Re-export types
export type { ImportCommandOptions } from './import.js';
export type { AnalyzeCommandOptions } from './analyze.js';
export type { InsightsCommandOptions } from './insights.js';
export type { ClassifyCommandOptions } from './classify.js';
export type { ImproveCommandOptions } from './improve.js';
export type { ReportCommandOptions } from './report.js';
