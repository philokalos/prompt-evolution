/**
 * Shared Types Index
 * Barrel export for all desktop-specific shared types.
 */
export { IPC_INVOKE_CHANNELS, IPC_SEND_CHANNELS, type IPCInvokeChannel, type IPCSendChannel, type IPCChannel, type IPCSuccessResponse, type IPCErrorResponse, type IPCResponse, type ApplyPromptResult, type ValidateKeyResult, type UpdateCheckResult, type UpdateDownloadResult, } from './ipc.js';
export { type ProjectConfidence, type DetectedProject, type WindowInfo, type CapturedContext, type ProjectPatternAnalysis, type HistoryRecommendation, type PromptContextRecommendations, type VariantType, type ProjectSettings, type CustomTemplate, type PromptTemplate, type TemplateFilterOptions, type TemplateContext, } from './project.js';
export { type ClipboardPayload, type EmptyStateReason, type EmptyStatePayload, type PromptDetectedPayload, type AIVariantResult, type IssuePattern, type GoldenDimensionTrend, type ConsecutiveImprovement, type CategoryPerformance, type PredictedScore, type Grade, type GhostBarState, type GhostBarSettings, type GhostBarShowPayload, type GhostBarUpdatePayload, type ApplyResult, } from './analysis.js';
export { type UserSettings, type LanguageCode, type LanguageResult, type SetLanguageResult, type LanguageChangedEvent, type ProviderType, type ProviderConfig, type ShortcutFailedEvent, type UpdateStatusEvent, } from './settings.js';
export { type ElectronAPI } from './electron-api.js';
export type { PromptIntent, TaskCategory, PromptClassification, Issue, AnalysisResult, GoldenScores, SessionContext, ActiveSessionContext, RewriteResult, HistoryRecommendation as ParentHistoryRecommendation, PromptHistory, PersonalStats, ProgressPoint, AnalysisResultWithContext, } from '../../../../src/shared/types/index.js';
