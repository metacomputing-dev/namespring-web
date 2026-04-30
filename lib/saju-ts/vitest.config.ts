import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only run the maintained suite. Legacy tests/ files use an older
    // class-based API (SajuCalculator/BirthInput/...) that no longer
    // matches src/, so they are excluded until they are reworked.
    // src/golden.test.ts depends on docs/_golden/ which is not shipped
    // in this library copy, so it is also excluded.
    include: [
      'src/api/**/*.test.ts',
      'src/calendar/**/*.test.ts',
      'src/core/**/*.test.ts',
      'tests/precision/**/*.test.ts',
    ],
    globals: true,
  },
});
