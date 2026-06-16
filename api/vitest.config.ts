import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    testTimeout: 20000,
    // Tests share one local SQL Server instance and mutate real rows —
    // run files sequentially to avoid cross-file race conditions.
    fileParallelism: false,
  },
});
