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
check('birthSeason uses saju month when available',
  feature40.birthSeason === 'spring', feature40.birthSeason);
check('currentSeason follows targetDate',
  feature40.currentSeason === 'summer', feature40.currentSeason);
check('dayMasterPolarity normalizes Korean yin marker',
  feature40.dayMasterPolarity === 'YIN', feature40.dayMasterPolarity);
check('gyeokguk code canonicalizes for fragment gating',
  feature40.gyeokguk === 'jeongingyeok', String(feature40.gyeokguk));

const featureLate20s = buildFeatureVector(
  makeSaju({ timeCorrection: { standardYear: 1997, standardMonth: 11 } }),
  { year: 1997, month: 11, day: 2, gender: 'female' } as any,
  new Date('2026-01-15T00:00:00+09:00'),
);

check('late-20s phase is distinct from early-20s',
  featureLate20s.agePhase === 'late_20s', featureLate20s.agePhase);
check('winter birth season resolves from month 11',
  featureLate20s.birthSeason === 'winter', featureLate20s.birthSeason);
check('winter current season resolves from January targetDate',
  featureLate20s.currentSeason === 'winter', featureLate20s.currentSeason);
check('gender axis remains available',
  featureLate20s.gender === 'female', featureLate20s.gender);

console.log(`\nTiered feature vector axes: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
