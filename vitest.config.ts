import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.next'],
    setupFiles: ['__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**', 'hooks/**', 'components/**', 'app/**'],
      exclude: ['node_modules', 'dist', '.next', '__tests__', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
