import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * The engine and its adapters are plain TypeScript over plain data, so the
 * whole suite runs in Node with no React Native transform, no simulator, and
 * no Supabase project. That is the point of the purity rule.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/engine/**', 'src/lib/adapters/**'],
      reporter: ['text', 'lcov'],
    },
  },
});
