import { buildIntegratedReport } from '../src/report/buildIntegratedReport.ts';
import { emptySaju } from '../src/saju-adapter.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  const deterministicToday = new Date('2024-01-15T00:00:00.000Z');
  const mockSaju = emptySaju();

  let report: ReturnType<typeof buildIntegratedReport>;
  try {
    report = buildIntegratedReport({
      saju: mockSaju,
      name: 'Smoke User',
      gender: 'neutral',
      today: deterministicToday,
      options: {
        variationSeed: 20240115,
      },
    });
    console.log('[PASS] buildIntegratedReport did not throw');
  } catch (error) {
    console.error(`[FAIL] buildIntegratedReport threw: ${toErrorMessage(error)}`);
    process.exitCode = 1;
    return;
  }

  try {
    assert(Boolean(report), 'report object is missing');
    console.log('[PASS] report object exists');

    assert(Array.isArray(report.sections), 'report.sections is not an array');
    console.log('[PASS] report.sections is an array');

    console.log(`[PASS] smoke test complete (sections=${report.sections.length})`);
  } catch (error) {
    console.error(`[FAIL] assertion failed: ${toErrorMessage(error)}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[FAIL] unhandled error: ${toErrorMessage(error)}`);
  process.exitCode = 1;
});
