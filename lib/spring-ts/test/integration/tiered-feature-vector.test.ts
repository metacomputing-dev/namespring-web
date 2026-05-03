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
    strength: { level: 'WEAK', isStrong: false },
    yongshin: { element: 'METAL', heeshin: 'WATER', gishin: 'FIRE' },
    gyeokguk: { type: 'JEONG_IN' },
    timeCorrection: { standardYear: 1986, standardMonth: 4 },
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

console.log(`\nTiered feature vector axes: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
