import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/main/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
    },
    // Mock Electron modules
    deps: {
      inline: ['electron'],
    },
    mockReset: true,
  },
});
