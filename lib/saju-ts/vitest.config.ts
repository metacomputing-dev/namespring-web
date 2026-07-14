import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // src/golden.test.ts depends on docs/_golden/ which is not shipped
    // in this library copy, so it is excluded.
    include: [
      'src/api/**/*.test.ts',
      'src/calendar/**/*.test.ts',
      'src/compat/**/*.test.ts',
      'src/core/**/*.test.ts',
      'src/fortune/**/*.test.ts',
      'src/rules/**/*.test.ts',
      'tests/precision/**/*.test.ts',
    ],
    globals: true,
  },
});
