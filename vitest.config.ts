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
      /**
       * Metro picks `storage.web.ts` for the web bundle; Node's resolver knows
       * nothing about platform extensions and would load the native module,
       * which pulls in MMKV and expo-secure-store and cannot run here. Mapping
       * it explicitly lets client state be tested in the same plain-Node runner
       * as the engine. Must precede the '@' alias — the first match wins.
       */
      '@/lib/storage': fileURLToPath(new URL('./src/lib/storage.web.ts', import.meta.url)),
      'react-native': 'react-native-web',
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
