/**
 * Project Detection Types
 * Types for active window detection, project context, and IDE integration.
 */
/**
 * Confidence level for project detection
 */
export type ProjectConfidence = 'high' | 'medium' | 'low';
/**
 * Detected project from active window parsing
 */
export interface DetectedProject {
    projectPath: string;
    projectName: string;
    ideName: string;
    currentFile?: string;
    confidence: ProjectConfidence;
    isManual?: boolean;
}
/**
 * Window information from active window detection
 */
export interface WindowInfo {
    appName: string;
    windowTitle: string;
    isIDE: boolean;
    ideName?: string;
}
/**
 * Captured context at hotkey time.
 * Used to ensure correct project detection even if user switches windows.
 */
export interface CapturedContext {
    windowInfo: WindowInfo | null;
    project: DetectedProject | null;
    timestamp: Date | string;
}
/**
 * Project pattern analysis from history
 */
export interface ProjectPatternAnalysis {
    projectPath: string;
    totalAnalyses: number;
    averageScore: number;
    goldenAverages: Record<string, number> | null;
    weaknesses: Array<{
        dimension: string;
        averageScore: number;
        belowThresholdCount: number;
    }>;
    recommendations: HistoryRecommendation[];
    highScoringExamples: unknown[];
}
/**
 * History-based recommendation
 */
export interface HistoryRecommendation {
    type: 'weakness' | 'improvement' | 'reference' | 'pattern';
    priority: 'high' | 'medium' | 'low';
    title: string;
    message: string;
    dimension?: string;
    examplePrompt?: string;
    improvement?: number;
}
/**
 * Prompt context recommendations based on history
 */
export interface PromptContextRecommendations {
    basedOnProject: HistoryRecommendation[];
    basedOnCategory: HistoryRecommendation[];
    referencePrompts: unknown[];
}
/**
 * Variant type for prompt rewriting
 */
export type VariantType = 'conservative' | 'balanced' | 'comprehensive' | 'ai';
/**
 * Project-specific settings
 */
export interface ProjectSettings {
    id?: number;
    projectPath: string;
    projectName?: string;
    ideType?: string;
    preferredVariant?: VariantType;
    customConstraints?: string;
    customTemplates?: CustomTemplate[];
    autoInjectContext?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
/**
 * Custom template for project
 */
export interface CustomTemplate {
    name: string;
    trigger: string;
    template: string;
}
/**
 * Prompt template
 */
export interface PromptTemplate {
    id?: number;
    name: string;
    ideType?: string;
    category?: string;
    templateText: string;
    description?: string;
    isActive?: boolean;
    usageCount?: number;
    createdAt?: Date;
}
/**
 * Template filter options for queries
 */
export interface TemplateFilterOptions {
    ideType?: string;
    category?: string;
    activeOnly?: boolean;
}
/**
 * Template context for recommendations
 */
export interface TemplateContext {
    ideType?: string;
    category?: string;
    projectPath?: string;
}
