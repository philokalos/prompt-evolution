import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'desktop/**', 'web/**'],
    passWithNoTests: true,
  },
});
