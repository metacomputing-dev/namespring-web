/**
 * test/integration/tiered-numerical-evidence.test.ts
 *
 * Verifies that expert-tier fragment numericalEvidence rows resolve only from
 * deterministic numeric paths and never through arbitrary code evaluation.
 */
import { buildFeatureVector } from '../../src/report/tiered/feature-selector.js';
import { resolveNumericalEvidence, resolveNumericExpression } from '../../src/report/tiered/numerical-evidence.js';

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

const sourceTier = {
  tier: 'T3_INTERNAL_ENGINE',
  sourceType: 'internal_scoring_policy',
  sourceUrl: null,
  accessedAt: '2026-05-02',
  quoteShort: null,
  humanInterpretation: 'Resolved from deterministic spring-ts runtime output.',
  copyrightNote: 'No third-party prose copied.',
  authorityTruthEligible: false,
};

const feature = buildFeatureVector(
  {
    dayMaster: { stem: 'GYE', element: 'WATER', polarity: '\uC74C' },
    strength: {
      level: 'WEAK',
      isStrong: false,
      totalSupport: 35.7,
      totalOppose: 64.3,
      deukryeong: 0,
      deukji: 0.5,
      deukse: 0.25,
    },
    yongshin: {
      element: 'METAL',
      heeshin: 'WATER',
      gishin: 'FIRE',
      confidence: 0.42,
    },
    gyeokguk: { type: 'JEONG_IN', confidence: 0.78 },
    timeCorrection: { standardYear: 1986, standardMonth: 4 },
    elementDistribution: { WOOD: 4, FIRE: 1, EARTH: 1, METAL: 0, WATER: 2 },
    deficientElements: ['EARTH', 'METAL'],
    excessiveElements: ['WOOD'],
    cheonganRelations: [{}, {}, {}],
    jijiRelations: [{}, {}],
    shinsalHits: [{}, {}, {}, {}, {}],
  } as any,
  { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' } as any,
  new Date('2026-05-02T00:00:00+09:00'),
);

console.log('Tiered numerical evidence resolver\n');

const context = { feature, cell: { stars: 4 } };
const fragment: any = {
  numericalEvidence: [
    { label: '현재 나이', valueExpression: 'feature.ageYears', unit: '세', sourceTier },
    { label: '신강도 순번', valueExpression: 'feature.dayMasterStrengthOrdinal', unit: '단계', sourceTier },
    { label: '셀 별점', valueExpression: 'cell.stars', unit: '점', sourceTier },
    { label: '문자열 경로는 제외', valueExpression: 'feature.gender', sourceTier },
    { label: '임의 실행식은 제외', valueExpression: 'process.env.SECRET', sourceTier },
    { label: 'prototype 접근은 제외', valueExpression: 'feature.__proto__.polluted', sourceTier },
    { label: '잘못된 sourceTier는 제외', valueExpression: 'feature.ageYears', sourceTier: { tier: 'T3_INTERNAL_ENGINE' } },
  ],
};

const rows = resolveNumericalEvidence(fragment, context) ?? [];

check('three deterministic numeric evidence rows resolve', rows.length === 3, String(rows.length));
check('feature numeric path resolves', rows[0]?.label === '현재 나이' && rows[0]?.value === 40, String(rows[0]?.value));
check('new ordinal feature numeric path resolves',
  rows[1]?.label === '신강도 순번' && rows[1]?.value === 2,
  String(rows[1]?.value));
check('cell numeric path resolves', rows[2]?.label === '셀 별점' && rows[2]?.value === 4, String(rows[2]?.value));
check('unit is preserved', rows[0]?.unit === '세' && rows[1]?.unit === '단계' && rows[2]?.unit === '점');
check('sourceTier is preserved', rows.every((row) => row.sourceTier.tier === 'T3_INTERNAL_ENGINE'));
check('string-valued feature path is rejected',
  resolveNumericExpression('feature.gender', context) === null);
check('arbitrary expression is rejected',
  resolveNumericExpression('Math.random()', context) === null);
check('prototype path is rejected',
  resolveNumericExpression('feature.__proto__.polluted', context) === null);
check('null cell stars are rejected',
  resolveNumericExpression('cell.stars', { feature, cell: { stars: null } }) === null);

// ─── Phase 3 Agent A16 — additive numeric axes ─────────────────────────────
// Verifies that every newly exposed feature axis resolves to a finite number
// through resolveNumericExpression so a fragment author can attach numerical
// evidence rows referencing them. Combined with the existing 13 axes, this
// brings the resolvable feature axis count to 35 (≥ 25+ Task 2 target).
const additiveAxes: ReadonlyArray<{ readonly path: string; readonly expected: number }> = [
  { path: 'feature.heeshinElementOrdinal',   expected: 5 },   // WATER
  { path: 'feature.gishinElementOrdinal',    expected: 2 },   // FIRE
  { path: 'feature.dayMasterPolarityOrdinal', expected: 2 },  // YIN
  { path: 'feature.strengthTotalSupport',    expected: 35.7 },
  { path: 'feature.strengthTotalOppose',     expected: 64.3 },
  { path: 'feature.strengthDeukryeong',      expected: 0 },
  { path: 'feature.strengthDeukji',          expected: 0.5 },
  { path: 'feature.strengthDeukse',          expected: 0.25 },
  { path: 'feature.yongshinConfidence',      expected: 0.42 },
  { path: 'feature.gyeokgukConfidence',      expected: 0.78 },
  { path: 'feature.shinsalCount',            expected: 5 },
  { path: 'feature.deficientElementCount',   expected: 2 },
  { path: 'feature.excessiveElementCount',   expected: 1 },
  { path: 'feature.cheonganRelationCount',   expected: 3 },
  { path: 'feature.jijiRelationCount',       expected: 2 },
  { path: 'feature.birthMonth',              expected: 4 },
  { path: 'feature.currentMonth',            expected: 5 },
  { path: 'feature.woodCount',               expected: 4 },
  { path: 'feature.fireCount',               expected: 1 },
  { path: 'feature.earthCount',              expected: 1 },
  { path: 'feature.metalCount',              expected: 0 },
  { path: 'feature.waterCount',              expected: 2 },
];
for (const axis of additiveAxes) {
  const value = resolveNumericExpression(axis.path, context);
  check(`additive axis ${axis.path} resolves to ${axis.expected}`,
    value === axis.expected,
    String(value));
}

// Confirm that all new axes also flow through the row resolver and produce
// labelled numerical evidence (the user-facing exit point).
const additiveFragment: any = {
  numericalEvidence: additiveAxes.map((axis) => ({
    label: axis.path.replace(/^feature\./, ''),
    valueExpression: axis.path,
    sourceTier,
  })),
};
const additiveRows = resolveNumericalEvidence(additiveFragment, context) ?? [];
check(`every additive axis surfaces a numericalEvidence row`,
  additiveRows.length === additiveAxes.length,
  `${additiveRows.length}/${additiveAxes.length}`);

// Resolver must reject non-existent / typo'd paths even within the feature namespace.
check('typo path is rejected',
  resolveNumericExpression('feature.strengthTotalSupportXYZ', context) === null);
check('feature.dayMasterStrength (string) remains rejected',
  resolveNumericExpression('feature.dayMasterStrength', context) === null);

console.log(`\nTiered numerical evidence resolver: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
