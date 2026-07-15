import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // src/golden.test.ts is quarantined until an authority-reviewed
    // docs/_golden/golden_cases.json is restored. Do not count it as coverage.
    include: [
      'src/api/**/*.test.ts',
      'src/artifacts/**/*.test.ts',
      'src/calendar/**/*.test.ts',
      'src/compat/**/*.test.ts',
      'src/core/**/*.test.ts',
      'src/fortune/**/*.test.ts',
      'src/graph/**/*.test.ts',
      'src/narration/**/*.test.ts',
      'src/rules/**/*.test.ts',
      'src/schools/**/*.test.ts',
      'src/utils/**/*.test.ts',
      'tests/precision/**/*.test.ts',
    ],
    globals: true,
    // Global civil-time and solar-term suites intentionally exercise multiple
    // engine/cache instances. Keep a deterministic per-test budget that also
    // holds on contended CI runners instead of relying on Vitest's 5s default.
    testTimeout: 15_000,
  },
});
