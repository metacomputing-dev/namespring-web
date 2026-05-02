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
    strength: { level: 'WEAK', isStrong: false },
    yongshin: { element: 'METAL', heeshin: 'WATER', gishin: 'FIRE' },
    gyeokguk: { type: 'JEONG_IN' },
    timeCorrection: { standardYear: 1986, standardMonth: 4 },
  } as any,
  { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' } as any,
  new Date('2026-05-02T00:00:00+09:00'),
);

console.log('Tiered numerical evidence resolver\n');

const context = { feature, cell: { stars: 4 } };
const fragment: any = {
  numericalEvidence: [
    { label: '현재 나이', valueExpression: 'feature.ageYears', unit: '세', sourceTier },
    { label: '셀 별점', valueExpression: 'cell.stars', unit: '점', sourceTier },
    { label: '문자열 경로는 제외', valueExpression: 'feature.gender', sourceTier },
    { label: '임의 실행식은 제외', valueExpression: 'process.env.SECRET', sourceTier },
    { label: 'prototype 접근은 제외', valueExpression: 'feature.__proto__.polluted', sourceTier },
    { label: '잘못된 sourceTier는 제외', valueExpression: 'feature.ageYears', sourceTier: { tier: 'T3_INTERNAL_ENGINE' } },
  ],
};

const rows = resolveNumericalEvidence(fragment, context) ?? [];

check('two deterministic numeric evidence rows resolve', rows.length === 2, String(rows.length));
check('feature numeric path resolves', rows[0]?.label === '현재 나이' && rows[0]?.value === 40, String(rows[0]?.value));
check('cell numeric path resolves', rows[1]?.label === '셀 별점' && rows[1]?.value === 4, String(rows[1]?.value));
check('unit is preserved', rows[0]?.unit === '세' && rows[1]?.unit === '점');
check('sourceTier is preserved', rows.every((row) => row.sourceTier.tier === 'T3_INTERNAL_ENGINE'));
check('string-valued feature path is rejected',
  resolveNumericExpression('feature.gender', context) === null);
check('arbitrary expression is rejected',
  resolveNumericExpression('Math.random()', context) === null);
check('prototype path is rejected',
  resolveNumericExpression('feature.__proto__.polluted', context) === null);
check('null cell stars are rejected',
  resolveNumericExpression('cell.stars', { feature, cell: { stars: null } }) === null);

console.log(`\nTiered numerical evidence resolver: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
