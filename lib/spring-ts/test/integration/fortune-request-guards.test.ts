import {
  SAJU_REQUEST_LIMITS,
  SajuRequestValidationError,
  parseFortuneTargetDate,
  requiredMaxMonthsForRequest,
  requiredMaxYearsForRequest,
  validateSajuConfigFortunePolicy,
  validateSajuRequestOptions,
} from '../../src/saju-request-policy.js';
import { SpringEngine } from '../../src/spring-engine.js';
import {
  findLuckRowCoveringInstant,
  findYearLuckRowForInstant,
  requireLuckRowCoveringInstant,
  strictFiniteNumber,
} from '../../src/report/common/luck-interval.js';
import { targetCalendarParts } from '../../src/target-date.js';
import { buildPeriodFortuneCard } from '../../src/report/cards/period-fortune-card.js';
import { buildCategoryFortuneCards } from '../../src/report/cards/category-fortune-card.js';
import { getDailyFortune } from '../../src/report/common/fortuneCalculator.js';
import { buildPeriodMeta } from '../../src/report/tiered/period-meta-builder.js';
import { buildFeatureVector } from '../../src/report/tiered/feature-selector.js';
import { buildFortuneReport } from '../../src/report/buildFortuneReport.js';
import { FortuneReportBuildError } from '../../src/report/report-input-contract.js';
import { analyzeSajuSafe } from '../../src/saju-adapter.js';

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

function throwsRangeError(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch (error) {
    return error instanceof RangeError;
  }
}

async function captureAsyncError(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
    return null;
  } catch (error) {
    return error;
  }
}

console.log('Fortune request horizon and interval guards\n');

const birthYear = 1986;
validateSajuRequestOptions({
  daeunCount: 10,
  saeunStartYear: birthYear - 1,
  saeunYearCount: 120,
  wolunStartYear: birthYear + 111,
  wolunMonthCount: 120,
}, birthYear);
check('public horizon accepts documented maxima', true);

const invalidOptions: Array<[string, any]> = [
  ['daeunCount=0', { daeunCount: 0 }],
  ['daeunCount=11', { daeunCount: 11 }],
  ['saeunYearCount fractional', { saeunYearCount: 1.5 }],
  ['saeunYearCount boolean', { saeunYearCount: true }],
  ['wolunMonthCount numeric string', { wolunMonthCount: '24' }],
  ['wolunMonthCount too large', { wolunMonthCount: 121 }],
  ['saeunStartYear too early', { saeunStartYear: birthYear - 2 }],
  ['wolunStartYear too late', { wolunStartYear: birthYear + 121 }],
  ['saeun window extends beyond horizon', { saeunStartYear: birthYear + 119, saeunYearCount: 3 }],
  ['wolun window extends beyond horizon', { wolunStartYear: birthYear + 120, wolunMonthCount: 13 }],
];
for (const [label, options] of invalidOptions) {
  check(`public horizon rejects ${label}`, throwsRangeError(() => validateSajuRequestOptions(options, birthYear)));
}

const maxRequiredYears = requiredMaxYearsForRequest({
  saeunStartYear: birthYear + 119,
  saeunYearCount: 2,
}, birthYear);
check('maximum valid saeun window stays within core cap', maxRequiredYears === 122);
const maxRequiredMonths = requiredMaxMonthsForRequest({
  wolunStartYear: birthYear + 111,
  wolunMonthCount: 120,
}, birthYear);
check('maximum public month request stays within core cap',
  maxRequiredMonths === 1_464 && maxRequiredMonths <= SAJU_REQUEST_LIMITS.maxMonths,
  String(maxRequiredMonths));
check('count-only month request expands to its requested count',
  requiredMaxMonthsForRequest({ wolunMonthCount: 120 }, birthYear) === 120);

check('direct sajuConfig horizon rejects coercive string', throwsRangeError(() =>
  validateSajuConfigFortunePolicy({ strategies: { fortune: { maxMonths: '24' } } } as any)));
check('direct sajuConfig horizon rejects oversized maxMonths', throwsRangeError(() =>
  validateSajuConfigFortunePolicy({ strategies: { fortune: { maxMonths: 1_601 } } } as any)));
check('direct sajuConfig horizon rejects oversized maxDays', throwsRangeError(() =>
  validateSajuConfigFortunePolicy({ strategies: { fortune: { maxDays: 3_661 } } } as any)));
validateSajuConfigFortunePolicy({ strategies: { fortune: { maxMonths: 1_600, maxDays: 3_660, maxYears: 120, maxDecades: 10 } } } as any);
check('direct sajuConfig horizon accepts documented caps', true);

for (const [label, fortune] of [
  ['direction typo', { directionRule: 'fixedBackwards' }],
  ['coercive decade length', { decadeLengthYears: '5' }],
  ['oversized decade length', { decadeLengthYears: 10_000 }],
  ['fractional minimum age', { minStartAge: 1.5 }],
  ['non-finite first offset', { firstDecadeOffsetSteps: Number.POSITIVE_INFINITY }],
  ['negative first offset', { firstDecadeOffsetSteps: -1 }],
  ['unknown field', { directionRules: 'fixedBackward' }],
  ['malformed ratio', { startAgeMethod: { kind: 'ratioDaysPerYear', daysPerYear: Number.NaN } }],
  [
    'ambiguous start-age alias',
    { startAgeMethod: 'threeDaysOneYear', startAge: 'oneDayFourMonths' },
  ],
] as const) {
  check(`direct sajuConfig fortune policy rejects ${label}`, throwsRangeError(() =>
    validateSajuConfigFortunePolicy({ strategies: { fortune } } as any)));
}
validateSajuConfigFortunePolicy({
  strategies: {
    customStrategy: { enabled: true },
    fortune: {
      directionRule: 'fixedBackward',
      startBoundary: 'jie',
      startAgeMethod: { kind: 'ratioDaysPerYear', daysPerYear: 3 },
      startAgeRounding: 'ceil',
      minStartAge: 0,
      firstDecadeOffsetSteps: 59,
      decadeLengthYears: 122,
      ageDisplay: 'koreanCountingAge',
      axis: 'utcByGregorianYear',
    },
  },
} as any);
check('direct sajuConfig fortune policy accepts every supported non-default shape', true);

const invalidFortunePolicyOptions = {
  sajuConfig: {
    strategies: {
      fortune: { directionRule: 'fixedBackwards' },
    },
  },
} as any;
const policyBoundaryRequest = {
  birth: {
    year: 1986,
    month: 4,
    day: 19,
    hour: 5,
    minute: 45,
    gender: 'male',
  },
  surname: [{ hangul: '\uCD5C', hanja: '\u5D14' }],
  givenName: [
    { hangul: '\uC131', hanja: '\u6210' },
    { hangul: '\uC218', hanja: '\u6D19' },
  ],
  mode: 'evaluate',
  options: invalidFortunePolicyOptions,
} as any;
const publicPolicyRoutes: ReadonlyArray<readonly [
  string,
  (engine: SpringEngine) => Promise<unknown>,
]> = [
  ['getSajuReport', (engine) => engine.getSajuReport(policyBoundaryRequest)],
  ['getSpringReport', (engine) => engine.getSpringReport(policyBoundaryRequest)],
  ['getNameCandidates', (engine) => engine.getNameCandidates(policyBoundaryRequest)],
  [
    'getNameCandidateSummaries',
    (engine) => engine.getNameCandidateSummaries(policyBoundaryRequest),
  ],
  ['analyze', (engine) => engine.analyze(policyBoundaryRequest)],
  [
    'getFortuneReport',
    (engine) => engine.getFortuneReport({
      birth: policyBoundaryRequest.birth,
      surname: policyBoundaryRequest.surname,
      givenName: policyBoundaryRequest.givenName,
      targetDate: '2026-07-18T00:00:00+09:00',
      options: invalidFortunePolicyOptions,
    }),
  ],
];
for (const [label, invoke] of publicPolicyRoutes) {
  const engine = new SpringEngine() as any;
  let initCalls = 0;
  engine.init = async () => {
    initCalls += 1;
  };
  const error = await captureAsyncError(() => invoke(engine));
  check(
    `${label} rejects an invalid fortune policy before initialization`,
    error instanceof SajuRequestValidationError
      && error.code === 'SAJU_REQUEST_INVALID'
      && initCalls === 0,
    `error=${error instanceof Error ? error.constructor.name : String(error)}, initCalls=${initCalls}`,
  );
}

const birthDate = { year: birthYear, month: 4, day: 19 };
check('invalid targetDate fails closed', throwsRangeError(() => parseFortuneTargetDate('not-a-date', birthDate)));
check('calendar rollover targetDate fails closed', throwsRangeError(() => parseFortuneTargetDate('2026-02-30', birthDate)));
check('timezone-less datetime fails closed', throwsRangeError(() =>
  parseFortuneTargetDate('2026-04-19T12:00:00', birthDate)));
check('targetDate before birth fails closed', throwsRangeError(() => parseFortuneTargetDate('1986-04-18', birthDate)));
check('targetDate on birth date is accepted',
  parseFortuneTargetDate('1986-04-19', birthDate).getUTCFullYear() === 1986);
check('targetDate after exact 120-year anniversary fails closed', throwsRangeError(() =>
  parseFortuneTargetDate('2106-04-20', birthDate)));
check('targetDate at exact 120-year anniversary is accepted',
  parseFortuneTargetDate('2106-04-19', birthDate).getUTCFullYear() === 2106);
const offsetTarget = parseFortuneTargetDate('2026-05-04T00:00:00+09:00', birthDate);
const offsetParts = targetCalendarParts(offsetTarget);
check('offset target preserves caller-declared calendar date',
  offsetParts.year === 2026 && offsetParts.month === 5 && offsetParts.day === 4);
check('offset target still preserves its absolute instant',
  offsetTarget.toISOString() === '2026-05-03T15:00:00.000Z');
check('offset target drives the declared daily pillar',
  getDailyFortune(offsetTarget).ganzhiIndex === getDailyFortune(new Date(2026, 4, 4)).ganzhiIndex);
check('offset target drives the declared daily report label',
  buildPeriodFortuneCard({ dayMaster: { element: 'WOOD' }, yongshin: { element: 'WATER' } } as any,
    'daily', offsetTarget).periodLabel === '2026년 5월 4일');
check('offset target drives the declared tiered period label',
  buildPeriodMeta('today', offsetTarget).label === '오늘 (5월 4일)');
const offsetFeature = buildFeatureVector(
  { dayMaster: { element: 'WOOD' }, yongshin: { element: 'WATER' } } as any,
  { year: 1986, month: 4, day: 19 } as any,
  offsetTarget,
);
check('offset target drives the declared tiered feature month', offsetFeature.currentMonth === 5);

const liChun = Date.parse('2026-02-04T08:02:00+09:00');
const rows = [
  { id: 'before', startUtcMs: liChun - 1_000, endUtcMs: liChun },
  { id: 'after', startUtcMs: liChun, endUtcMs: liChun + 1_000 },
] as const;
check('[start,end) selects 1ms before boundary',
  findLuckRowCoveringInstant(rows, liChun - 1)?.id === 'before');
check('[start,end) switches exactly at boundary',
  findLuckRowCoveringInstant(rows, liChun)?.id === 'after');
check('[start,end) keeps row 1ms after boundary',
  findLuckRowCoveringInstant(rows, liChun + 1)?.id === 'after');
check('end boundary is exclusive', findLuckRowCoveringInstant(rows, liChun + 1_000) === null);

const liChunSaju = {
  dayMaster: { element: 'WOOD' },
  yongshin: { element: 'WATER' },
  saeunPillars: [
    {
      year: 2025,
      stem: 'EUL',
      branch: 'SA',
      startUtcMs: liChun - 1_000,
      endUtcMs: liChun,
      tenGod: 'BI_GYEON',
    },
    {
      year: 2026,
      stem: 'BYEONG',
      branch: 'O',
      startUtcMs: liChun,
      endUtcMs: liChun + 1_000,
      tenGod: 'SIK_SIN',
    },
  ],
} as any;
for (const [label, instant, expectedStem, expectedElement, expectedGanzhi] of [
  ['1ms before LiChun', liChun - 1, '을', '나무', '을사'],
  ['exactly at LiChun', liChun, '병', '불', '병오'],
  ['1ms after LiChun', liChun + 1, '병', '불', '병오'],
] as const) {
  const target = new Date(instant);
  const period = buildPeriodFortuneCard(liChunSaju, 'yearly', target) as any;
  const periodFeatures = period.evidence?.flatMap((row: any) => row.supportingFeatures ?? []) ?? [];
  const tiered = buildPeriodMeta('thisYear', target, liChunSaju);
  const category = buildCategoryFortuneCards(liChunSaju, target).wealth as any;
  const categoryFeatures = category.evidence?.flatMap((row: any) => row.supportingFeatures ?? []) ?? [];
  check(`period card selects the interval row ${label}`,
    periodFeatures.some((feature: string) => feature.includes(`간지: ${expectedGanzhi}`)));
  check(`tiered meta selects the same interval row ${label}`,
    tiered.meta.stems?.[0]?.stem === expectedStem);
  check(`category card selects the same interval row ${label}`,
    categoryFeatures.includes(`올해 천간 오행: ${expectedElement}`));
}

for (const value of [null, '', '1000', false, [], Number.NaN, Number.POSITIVE_INFINITY]) {
  check(`strict finite number rejects ${JSON.stringify(value) ?? String(value)}`, strictFiniteNumber(value) === null);
}
check('strict finite number preserves numeric zero', strictFiniteNumber(0) === 0);
check('row with null start never matches',
  findLuckRowCoveringInstant([{ id: 'bad', startUtcMs: null, endUtcMs: liChun + 1_000 }], liChun) === null);
check('row with reversed interval never matches',
  findLuckRowCoveringInstant([{ id: 'bad', startUtcMs: liChun + 1, endUtcMs: liChun }], liChun) === null);
check('overlapping matching rows fail closed',
  findLuckRowCoveringInstant([
    { id: 'a', startUtcMs: liChun - 10, endUtcMs: liChun + 10 },
    { id: 'b', startUtcMs: liChun - 5, endUtcMs: liChun + 5 },
  ], liChun) === null);
check('legacy year-only row fails closed without an explicit boundary policy',
  throwsRangeError(() => findYearLuckRowForInstant([{ id: 'legacy', year: 2026 }], liChun, 2026)));
check('malformed interval metadata is not revived by year fallback',
  throwsRangeError(() => findYearLuckRowForInstant([
    { id: 'bad', year: 2026, startUtcMs: null, endUtcMs: liChun + 10 },
  ], liChun, 2026)));
check('overlapping interval rows are not revived by year fallback',
  throwsRangeError(() => findYearLuckRowForInstant([
    { id: 'a', year: 2026, startUtcMs: liChun - 10, endUtcMs: liChun + 10 },
    { id: 'b', year: 2026, startUtcMs: liChun - 5, endUtcMs: liChun + 5 },
  ], liChun, 2026)));
check('overlapping month interval rows fail closed',
  throwsRangeError(() => requireLuckRowCoveringInstant([
    { id: 'a', startUtcMs: liChun - 10, endUtcMs: liChun + 10 },
    { id: 'b', startUtcMs: liChun - 5, endUtcMs: liChun + 5 },
  ], liChun)));
check('valid non-covering intervals permit caller-owned formula fallback',
  requireLuckRowCoveringInstant([
    { id: 'past', startUtcMs: liChun - 20, endUtcMs: liChun - 10 },
  ], liChun) === null);
check('valid interval mixed with malformed interval fails closed',
  throwsRangeError(() => findYearLuckRowForInstant([
    { id: 'valid', year: 2026, startUtcMs: liChun - 10, endUtcMs: liChun + 10 },
    { id: 'bad', year: 2026, startUtcMs: null, endUtcMs: liChun + 10 },
  ], liChun, 2026)));
check('primitive interval row is normalized to a range error',
  throwsRangeError(() => requireLuckRowCoveringInstant([
    { id: 'valid', startUtcMs: liChun - 10, endUtcMs: liChun + 10 },
    null,
  ] as any, liChun)));

const validAnalysis = await analyzeSajuSafe({
  year: 1986,
  month: 4,
  day: 19,
  hour: 5,
  minute: 45,
  gender: 'male',
});
const ambiguousSaju = {
  ...validAnalysis.summary,
  saeunPillars: [
    { year: 2026, stem: 'GAP', branch: 'JA', startUtcMs: liChun - 10, endUtcMs: liChun + 10 },
    { year: 2026, stem: 'EUL', branch: 'CHUK', startUtcMs: liChun - 5, endUtcMs: liChun + 5 },
  ],
  wolunPillars: [
    { stem: 'GAP', branch: 'JA', startUtcMs: liChun - 10, endUtcMs: liChun + 10 },
    { stem: 'EUL', branch: 'CHUK', startUtcMs: liChun - 5, endUtcMs: liChun + 5 },
  ],
} as any;
const boundaryTarget = new Date(liChun);
check('period yearly card does not swallow overlapping intervals',
  throwsRangeError(() => buildPeriodFortuneCard(ambiguousSaju, 'yearly', boundaryTarget)));
check('period monthly card does not swallow overlapping intervals',
  throwsRangeError(() => buildPeriodFortuneCard(ambiguousSaju, 'monthly', boundaryTarget)));
check('category cards do not swallow overlapping year intervals',
  throwsRangeError(() => buildCategoryFortuneCards(ambiguousSaju, boundaryTarget)));
const malformedPillarSaju = {
  ...ambiguousSaju,
  saeunPillars: [
    { year: 2026, stem: 'UNKNOWN', branch: 'JA', startUtcMs: liChun - 10, endUtcMs: liChun + 10 },
  ],
  wolunPillars: [
    { stem: 'UNKNOWN', branch: 'JA', startUtcMs: liChun - 10, endUtcMs: liChun + 10 },
  ],
} as any;
check('period yearly card rejects a malformed selected pillar',
  throwsRangeError(() => buildPeriodFortuneCard(malformedPillarSaju, 'yearly', boundaryTarget)));
check('period monthly card rejects a malformed selected pillar',
  throwsRangeError(() => buildPeriodFortuneCard(malformedPillarSaju, 'monthly', boundaryTarget)));
check('category cards reject a malformed selected year pillar',
  throwsRangeError(() => buildCategoryFortuneCards(malformedPillarSaju, boundaryTarget)));
let topLevelRejected = false;
let topLevelError: unknown = null;
const originalConsoleError = console.error;
try {
  // The deliberately minimal fixture triggers unrelated card fallbacks; keep
  // this assertion focused on whether the interval error reaches the caller.
  console.error = () => {};
  await buildFortuneReport(ambiguousSaju, boundaryTarget, null);
} catch (error) {
  topLevelError = error;
  topLevelRejected = error instanceof FortuneReportBuildError
    && error.cause instanceof RangeError;
} finally {
  console.error = originalConsoleError;
}
check(
  'top-level fortune report does not swallow ambiguous intervals',
  topLevelRejected,
  topLevelError instanceof FortuneReportBuildError
    ? `component=${topLevelError.component}, cause=${topLevelError.cause instanceof Error
      ? topLevelError.cause.constructor.name : typeof topLevelError.cause}`
    : `error=${topLevelError instanceof Error ? topLevelError.constructor.name : typeof topLevelError}`,
);

console.log(`\nFortune request guards: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
