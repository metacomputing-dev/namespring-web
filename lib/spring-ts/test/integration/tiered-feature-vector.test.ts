/**
 * test/integration/tiered-feature-vector.test.ts
 *
 * Verifies narrative-selection feature axes that future fragment authors can
 * use without changing NameSpring or the existing report surface.
 */
import { buildFeatureVector } from '../../src/report/tiered/feature-selector.js';

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

function makeSaju(overrides: Record<string, unknown> = {}): any {
  return {
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
      confidence: 42,
    },
    gyeokguk: { type: 'JEONG_IN', confidence: 0.78 },
    timeCorrection: { standardYear: 1986, standardMonth: 4 },
    elementDistribution: { WOOD: 4, FIRE: 1, EARTH: 1, METAL: 0, WATER: 2 },
    deficientElements: ['EARTH', 'METAL'],
    excessiveElements: ['WOOD'],
    cheonganRelations: [{}, {}, {}],
    jijiRelations: [{}, {}],
    shinsalHits: [{}, {}, {}, {}, {}],
    ...overrides,
  };
}

console.log('Tiered feature vector axes\n');

const feature40 = buildFeatureVector(
  makeSaju(),
  { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' } as any,
  new Date('2026-05-02T00:00:00+09:00'),
);

check('ageBand remains broad for backward-compatible authored fragments',
  feature40.ageBand === '40-54', feature40.ageBand);
check('ageYears is available for numerical evidence',
  feature40.ageYears === 40, String(feature40.ageYears));
check('agePhase offers a narrower authoring axis',
  feature40.agePhase === 'early_40s', feature40.agePhase);
check('agePhaseOrdinal is available for numerical evidence',
  feature40.agePhaseOrdinal === 8, String(feature40.agePhaseOrdinal));
check('dayMasterElementOrdinal is available for numerical evidence',
  feature40.dayMasterElementOrdinal === 5, String(feature40.dayMasterElementOrdinal));
check('dayMasterStrengthOrdinal is available for numerical evidence',
  feature40.dayMasterStrengthOrdinal === 2, String(feature40.dayMasterStrengthOrdinal));
check('yongshinElementOrdinal is available for numerical evidence',
  feature40.yongshinElementOrdinal === 4, String(feature40.yongshinElementOrdinal));
check('birthSeason uses saju month when available',
  feature40.birthSeason === 'spring', feature40.birthSeason);
check('birthSeasonOrdinal is available for numerical evidence',
  feature40.birthSeasonOrdinal === 1, String(feature40.birthSeasonOrdinal));
check('currentSeason follows targetDate',
  feature40.currentSeason === 'summer', feature40.currentSeason);
check('currentSeasonOrdinal is available for numerical evidence',
  feature40.currentSeasonOrdinal === 2, String(feature40.currentSeasonOrdinal));
check('dayMasterPolarity normalizes Korean yin marker',
  feature40.dayMasterPolarity === 'YIN', feature40.dayMasterPolarity);
check('gyeokguk code canonicalizes for fragment gating',
  feature40.gyeokguk === 'jeongingyeok', String(feature40.gyeokguk));
check('gyeokgukOrdinal is available for numerical evidence',
  feature40.gyeokgukOrdinal === 1, String(feature40.gyeokgukOrdinal));

const featureLate20s = buildFeatureVector(
  makeSaju({ timeCorrection: { standardYear: 1997, standardMonth: 11 } }),
  { year: 1997, month: 11, day: 2, gender: 'female' } as any,
  new Date('2026-01-15T00:00:00+09:00'),
);

check('late-20s phase is distinct from early-20s',
  featureLate20s.agePhase === 'late_20s', featureLate20s.agePhase);
check('late-20s phase ordinal is stable',
  featureLate20s.agePhaseOrdinal === 5, String(featureLate20s.agePhaseOrdinal));
check('winter birth season resolves from month 11',
  featureLate20s.birthSeason === 'winter', featureLate20s.birthSeason);
check('winter birth season ordinal is stable',
  featureLate20s.birthSeasonOrdinal === 4, String(featureLate20s.birthSeasonOrdinal));
check('winter current season resolves from January targetDate',
  featureLate20s.currentSeason === 'winter', featureLate20s.currentSeason);
check('winter current season ordinal is stable',
  featureLate20s.currentSeasonOrdinal === 4, String(featureLate20s.currentSeasonOrdinal));
check('gender axis remains available',
  featureLate20s.gender === 'female', featureLate20s.gender);
check('genderOrdinal is available for numerical evidence',
  featureLate20s.genderOrdinal === 2, String(featureLate20s.genderOrdinal));

// ─── Phase 3 Agent A16 — additive axes ─────────────────────────────────────
check('heeshinElementOrdinal is exposed (parallel to yongshinElementOrdinal)',
  feature40.heeshinElementOrdinal === 5, String(feature40.heeshinElementOrdinal)); // WATER
check('gishinElementOrdinal is exposed',
  feature40.gishinElementOrdinal === 2, String(feature40.gishinElementOrdinal)); // FIRE
check('dayMasterPolarityOrdinal exposes the YIN/YANG axis numerically',
  feature40.dayMasterPolarityOrdinal === 2, String(feature40.dayMasterPolarityOrdinal));
check('strengthTotalSupport carries through from saju.strength',
  feature40.strengthTotalSupport === 35.7, String(feature40.strengthTotalSupport));
check('strengthTotalOppose carries through from saju.strength',
  feature40.strengthTotalOppose === 64.3, String(feature40.strengthTotalOppose));
check('strengthDeukryeong carries through',
  feature40.strengthDeukryeong === 0, String(feature40.strengthDeukryeong));
check('strengthDeukji carries through',
  feature40.strengthDeukji === 0.5, String(feature40.strengthDeukji));
check('strengthDeukse carries through',
  feature40.strengthDeukse === 0.25, String(feature40.strengthDeukse));
check('yongshinConfidence carries through',
  feature40.yongshinConfidence === 0.42, String(feature40.yongshinConfidence));
check('gyeokgukConfidence carries through',
  feature40.gyeokgukConfidence === 0.78, String(feature40.gyeokgukConfidence));

for (const { points, ratio } of [
  { points: 0, ratio: 0 },
  { points: 1, ratio: 0.01 },
  { points: 1.0001, ratio: 0.010001 },
  { points: 100, ratio: 1 },
] as const) {
  const feature = buildFeatureVector(
    makeSaju({
      yongshin: {
        element: 'METAL',
        heeshin: 'WATER',
        gishin: 'FIRE',
        confidence: points,
      },
    }),
    { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' } as any,
    new Date('2026-05-02T00:00:00+09:00'),
  );
  check(`yongshin confidence converts ${points} points to ${ratio} ratio`,
    Math.abs(feature.yongshinConfidence - ratio) <= Number.EPSILON * 4,
    String(feature.yongshinConfidence));
}
check('shinsalCount counts the shinsal hits',
  feature40.shinsalCount === 5, String(feature40.shinsalCount));
check('deficientElementCount counts deficient elements',
  feature40.deficientElementCount === 2, String(feature40.deficientElementCount));
check('excessiveElementCount counts excessive elements',
  feature40.excessiveElementCount === 1, String(feature40.excessiveElementCount));
check('deficientElements surfaces identities (not just count)',
  JSON.stringify(feature40.deficientElements) === JSON.stringify(['EARTH', 'METAL']),
  JSON.stringify(feature40.deficientElements));
check('excessiveElements surfaces identities',
  JSON.stringify(feature40.excessiveElements) === JSON.stringify(['WOOD']),
  JSON.stringify(feature40.excessiveElements));
check('cheonganRelationCount counts heavenly-stem relations',
  feature40.cheonganRelationCount === 3, String(feature40.cheonganRelationCount));
check('jijiRelationCount counts earthly-branch relations',
  feature40.jijiRelationCount === 2, String(feature40.jijiRelationCount));
check('birthMonth resolves from saju.timeCorrection',
  feature40.birthMonth === 4, String(feature40.birthMonth));
check('currentMonth follows targetDate (May)',
  feature40.currentMonth === 5, String(feature40.currentMonth));
check('woodCount carries through from elementDistribution',
  feature40.woodCount === 4, String(feature40.woodCount));
check('metalCount surfaces 0 even when METAL key value is zero',
  feature40.metalCount === 0, String(feature40.metalCount));
check('waterCount carries through',
  feature40.waterCount === 2, String(feature40.waterCount));

// Defaults are 0 when the engine omits the relevant field — important so the
// resolver always returns a finite number for any documented feature path.
const minimalFeature = buildFeatureVector(
  {
    dayMaster: { stem: 'GAP', element: 'WOOD', polarity: '양' },
    strength: { level: '신왕', isStrong: true },
    yongshin: { element: 'METAL', heeshin: null, gishin: null },
    gyeokguk: { type: 'BI_GYEON' },
    timeCorrection: { standardYear: 2000, standardMonth: 6 },
  } as any,
  { year: 2000, month: 6, day: 15, hour: 12, minute: 0, gender: 'female' } as any,
  new Date('2026-01-15T00:00:00+09:00'),
);
check('minimal saju yields finite default 0 on absent strength fields',
  minimalFeature.strengthTotalSupport === 0 &&
  minimalFeature.strengthTotalOppose === 0 &&
  minimalFeature.strengthDeukryeong === 0,
  `${minimalFeature.strengthTotalSupport}/${minimalFeature.strengthTotalOppose}/${minimalFeature.strengthDeukryeong}`);
check('minimal saju yields 0 confidence when omitted',
  minimalFeature.yongshinConfidence === 0 && minimalFeature.gyeokgukConfidence === 0,
  `${minimalFeature.yongshinConfidence}/${minimalFeature.gyeokgukConfidence}`);
check('minimal saju yields 0 element-distribution counts when omitted',
  minimalFeature.woodCount === 0 && minimalFeature.fireCount === 0 &&
  minimalFeature.earthCount === 0 && minimalFeature.metalCount === 0 &&
  minimalFeature.waterCount === 0);
check('minimal saju heeshinElementOrdinal is 0 when null',
  minimalFeature.heeshinElementOrdinal === 0);
check('minimal saju gishinElementOrdinal is 0 when null',
  minimalFeature.gishinElementOrdinal === 0);
check('minimal saju deficient/excessive element identities default to []',
  minimalFeature.deficientElements.length === 0 && minimalFeature.excessiveElements.length === 0);

console.log(`\nTiered feature vector axes: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
