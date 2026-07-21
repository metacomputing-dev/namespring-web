/**
 * test/integration/saju-calculator-disabled.test.ts
 *
 * Verifies the SajuCalculator's `enabled: false` path. The disabled path
 * is what spring-ts uses when birth context is missing or saju-ts is
 * unavailable; without coverage, future refactors of the calculator
 * could silently break the safe-fallback contract.
 *
 *   visit(ctx)        → puts a SAJU_FRAME insight with score=100,
 *                        isPassed=true, label='DISABLED_NO_SAJU_CONTEXT',
 *                        details.disabled=true.
 *   backward(ctx)     → returns { signals: [] } (no contribution to score).
 *   getAnalysis()     → returns a zero-valued SajuCompatibility shell
 *                        (score=0, yongshinElement='', etc.).
 *   getCombinedDistribution() → all-zero element map.
 *
 * Run: npm run test:saju-disabled
 *      (or: npx tsx test/integration/saju-calculator-disabled.test.ts)
 */
import { SajuCalculator } from '../../src/saju-calculator.js';
import { UnknownSpringSchoolPresetError } from '../../src/preset-loader.js';
import { SAJU_FRAME } from '../../src/spring-evaluator.js';
import type { EvalContext } from '../../src/core/evaluator.js';

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}`);
  }
}

const emptyDistribution = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 } as const;

let invalidInactivePresetError: unknown = null;
try {
  new SajuCalculator(
    [],
    [],
    emptyDistribution,
    null,
    {
      enabled: false,
      useSchoolPreset: false,
      schoolPreset: 'chinesee' as never,
    },
  );
} catch (error) {
  invalidInactivePresetError = error;
}
check(
  'direct constructor rejects an invalid preset even when preset scoring is inactive',
  invalidInactivePresetError instanceof UnknownSpringSchoolPresetError
    && invalidInactivePresetError.code === 'SAJU_UNKNOWN_SCHOOL_PRESET',
);

const calculator = new SajuCalculator(
  [], // surnameEntries
  [], // givenNameEntries
  emptyDistribution,
  null, // sajuOutput
  { enabled: false },
);

const ctx: EvalContext = {
  surnameLength: 1,
  givenLength: 2,
  luckyMap: new Map(),
  insights: {},
};

console.log('SajuCalculator disabled path');

// ── Disabled access remains intentionally available before visit() ───────
check('pre-visit backward returns empty signals',
  calculator.backward(ctx).signals.length === 0);
check('pre-visit analysis remains the disabled zero shell',
  calculator.getAnalysis().score === 0);
check('pre-visit distribution remains all-zero',
  Object.values(calculator.getCombinedDistribution()).every((value) => value === 0));

// ── visit() — populates SAJU_FRAME with the disabled-shell insight ─────────
calculator.visit(ctx);
const insight = ctx.insights[SAJU_FRAME];
check('SAJU_FRAME insight exists', insight != null);
check('insight.score === 100', insight?.score === 100);
check('insight.isPassed === true', insight?.isPassed === true);
check('insight.label === DISABLED_NO_SAJU_CONTEXT', insight?.label === 'DISABLED_NO_SAJU_CONTEXT');
check('insight.details.disabled === true',
  (insight?.details as { disabled?: unknown })?.disabled === true);
check('insight.details.reason === missing-or-partial-birth-context',
  (insight?.details as { reason?: unknown })?.reason === 'missing-or-partial-birth-context');

calculator.visit(ctx);
const repeatedInsight = ctx.insights[SAJU_FRAME];
check('repeated visit preserves the disabled insight contract',
  repeatedInsight?.score === 100
    && repeatedInsight.isPassed === true
    && repeatedInsight.label === 'DISABLED_NO_SAJU_CONTEXT'
    && (repeatedInsight.details as { disabled?: unknown })?.disabled === true);

// ── backward() — empty signal list (disabled path contributes nothing) ────
const packet = calculator.backward(ctx);
check('backward returns empty signals', Array.isArray(packet.signals) && packet.signals.length === 0);

// ── getAnalysis() — zero-valued SajuCompatibility shell ───────────────────
const analysis = calculator.getAnalysis();
check('analysis.type === Saju', analysis.type === 'Saju');
check('analysis.score === 0', analysis.score === 0);
check('analysis.polarityScore === 0', analysis.polarityScore === 0);
check('analysis.elementScore === 0', analysis.elementScore === 0);
check('analysis.data.yongshinElement === ""', analysis.data.yongshinElement === '');
check('analysis.data.heeshinElement === null', analysis.data.heeshinElement === null);
check('analysis.data.gishinElement === null', analysis.data.gishinElement === null);
check('analysis.data.yongshinMatchCount === 0', analysis.data.yongshinMatchCount === 0);
check('analysis.data.gishinMatchCount === 0', analysis.data.gishinMatchCount === 0);
check('analysis.data.dayMasterSupportScore === 0', analysis.data.dayMasterSupportScore === 0);
check('analysis.data.affinityScore === 0', analysis.data.affinityScore === 0);

// ── getCombinedDistribution() — all-zero element map ──────────────────────
const dist = calculator.getCombinedDistribution();
check('distribution.Wood === 0', dist.Wood === 0);
check('distribution.Fire === 0', dist.Fire === 0);
check('distribution.Earth === 0', dist.Earth === 0);
check('distribution.Metal === 0', dist.Metal === 0);
check('distribution.Water === 0', dist.Water === 0);

// ── Result ────────────────────────────────────────────────────────────────
console.log(`\nDisabled-path check: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) {
  console.error('\nSajuCalculator disabled path has regressed.');
  console.error('See spring-info/01_spring_structure/02_calculator_internals.md §5.4');
  process.exit(1);
}
process.exit(0);
