import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Vitest owns the TypeScript suites. The *.test.mjs file uses Node's built-in
    // test runner (node:test) against a live server and must not be collected by
    // Vitest, otherwise it registers no tests and fails with "No test suite found".
    include: ['src/tests/**/*.{test,spec}.?(c|m)ts'],
    exclude: ['node_modules', 'dist', '.git', '.nyc_output', 'src/tests/**/*.test.mjs'],
  },
});