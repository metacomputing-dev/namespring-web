import { buildIntegratedReport } from '../src/report/buildIntegratedReport.ts';
import { emptySaju } from '../src/saju-adapter.ts';
import type { ReportInput, ReportSectionId } from '../src/report/types.ts';

const FIXED_VARIATION_SEED = 20260220;
const FIXED_TODAY_ISO = '2024-01-01T00:00:00.000Z';

function createDeterministicInput(
  sectionOptions?: Pick<NonNullable<ReportInput['options']>, 'includeSections' | 'excludeSections'>,
): ReportInput {
  return {
    saju: emptySaju(),
    name: 'Section Filter Test',
    gender: 'neutral',
    birthInfo: {
      year: 1990,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
    },
    today: new Date(FIXED_TODAY_ISO),
    options: {
      variationSeed: FIXED_VARIATION_SEED,
      ...sectionOptions,
    },
  };
}

function sectionIds(input: ReportInput): ReportSectionId[] {
  return buildIntegratedReport(input).sections.map((section) => section.id);
}

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    fail(message);
  }
}

function runCheck(name: string, check: () => void): boolean {
  try {
    check();
    console.log(`PASS: ${name}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL: ${name}`);
    console.error(`      ${message}`);
    return false;
  }
}

function formatIds(ids: readonly ReportSectionId[]): string {
  return ids.length > 0 ? ids.join(', ') : '(none)';
}

function main(): void {
  let failed = 0;

  const includeOnlySummaryOk = runCheck(
    "includeSections=['summary'] should only contain summary (if generated)",
    () => {
      const ids = sectionIds(
        createDeterministicInput({
          includeSections: ['summary'],
        }),
      );
      const hasSummary = ids.includes('summary');
      const unexpected = ids.filter((id) => id !== 'summary');

      assert(
        unexpected.length === 0,
        `expected only 'summary' or no sections, got: ${formatIds(ids)}`,
      );
      if (hasSummary) {
        assert(
          ids.length === 1,
          `expected only one section when summary is generated, got: ${formatIds(ids)}`,
        );
      }
    },
  );
  if (!includeOnlySummaryOk) failed++;

  const excludeSummaryOk = runCheck(
    "excludeSections=['summary'] should not include summary",
    () => {
      const ids = sectionIds(
        createDeterministicInput({
          excludeSections: ['summary'],
        }),
      );
      assert(!ids.includes('summary'), `summary should be excluded, got: ${formatIds(ids)}`);
    },
  );
  if (!excludeSummaryOk) failed++;

  if (failed > 0) {
    console.error(`FAIL: ${failed} check(s) failed.`);
    process.exit(1);
  }

  console.log('PASS: verify-report-sections');
}

main();
