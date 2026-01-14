/**
 * Validation Registry
 * Central exports for validation schemas and middleware
 */

export { insightsQuerySchema, trendsQuerySchema } from './schemas.js';
export type { InsightsQuery, TrendsQuery } from './schemas.js';
export { validateQuery, validateBody } from './middleware.js';
