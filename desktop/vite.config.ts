import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  root: 'src/renderer',
  publicDir: '../../assets',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    sourcemap: mode !== 'production',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/renderer/index.html'),
      },
    },
    // Remove console.log in production builds
    minify: 'esbuild',
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
}));
