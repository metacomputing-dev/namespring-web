import { buildSajuNameIntegrationSignals } from '../src/report/common/sajuNameIntegration.ts';

const deterministicInput = {
  saju: {
    yongshinElement: 'WOOD',
    heeshinElement: 'FIRE',
    gishinElement: 'METAL',
    deficientElements: ['WOOD', 'WATER'],
    excessiveElements: ['FIRE'],
  },
  naming: {
    resourceElements: ['WOOD', 'FIRE', 'WATER'],
    strokeElements: ['EARTH', 'WOOD'],
    extraElements: ['METAL'],
  },
  actionSuggestionCount: 4,
} as const;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function runCheck(name: string, check: () => void): boolean {
  try {
    check();
    console.log(`[PASS] ${name}`);
    return true;
  } catch (error) {
    console.error(`[FAIL] ${name}: ${toErrorMessage(error)}`);
    return false;
  }
}

function main(): void {
  let failed = 0;

  const first = buildSajuNameIntegrationSignals(deterministicInput);
  const second = buildSajuNameIntegrationSignals(deterministicInput);

  if (!runCheck('deterministic output for identical input', () => {
    assert(
      JSON.stringify(first) === JSON.stringify(second),
      'results differ across repeated calls',
    );
  })) {
    failed += 1;
  }

  if (!runCheck('summary is non-empty', () => {
    assert(typeof first.elementHarmonySummary === 'string', 'summary is not a string');
    assert(first.elementHarmonySummary.trim().length > 0, 'summary is empty');
  })) {
    failed += 1;
  }

  if (!runCheck('strengths array is non-empty', () => {
    assert(Array.isArray(first.keySynergyStrengths), 'strengths is not an array');
    assert(first.keySynergyStrengths.length > 0, 'strengths array is empty');
  })) {
    failed += 1;
  }

  if (!runCheck('cautions array is non-empty', () => {
    assert(Array.isArray(first.keyCautionPoints), 'cautions is not an array');
    assert(first.keyCautionPoints.length > 0, 'cautions array is empty');
  })) {
    failed += 1;
  }

  if (!runCheck('daily actions length is between 3 and 5', () => {
    assert(
      Array.isArray(first.dailyActionSuggestions),
      'dailyActionSuggestions is not an array',
    );
    assert(
      first.dailyActionSuggestions.length >= 3 && first.dailyActionSuggestions.length <= 5,
      `dailyActionSuggestions length=${first.dailyActionSuggestions.length}`,
    );
  })) {
    failed += 1;
  }

  if (failed > 0) {
    console.error(`[FAIL] verify-saju-name-integration (${failed} check(s) failed)`);
    process.exit(1);
  }

  console.log('[PASS] verify-saju-name-integration');
}

try {
  main();
} catch (error) {
  console.error(`[FAIL] unexpected error: ${toErrorMessage(error)}`);
  process.exit(1);
}
