/**
 * Validation Schemas
 * Zod schemas for request validation
 */

import { z } from 'zod';

/**
 * Insights query parameters schema
 */
export const insightsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', 'all']).optional().default('7d'),
  project: z.string().optional(),
  category: z
    .enum([
      'code-generation',
      'code-review',
      'bug-fix',
      'refactoring',
      'explanation',
      'documentation',
      'testing',
      'architecture',
      'deployment',
      'data-analysis',
      'general',
      'unknown',
    ])
    .optional(),
  focus: z.enum(['problems', 'improvements', 'strengths']).optional(),
});

export type InsightsQuery = z.infer<typeof insightsQuerySchema>;

/**
 * Trends query parameters schema
 */
export const trendsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '365d']).optional().default('30d'),
  metric: z.enum(['effectiveness', 'quality', 'volume']).optional().default('volume'),
  groupBy: z.enum(['day', 'week', 'month']).optional().default('day'),
});

export type TrendsQuery = z.infer<typeof trendsQuerySchema>;
