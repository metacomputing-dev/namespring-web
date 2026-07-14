/**
 * Regression guard for life-stage daewoon display normalization.
 *
 * Run: npm run test:life-stage-display
 */
import { BRANCH_BY_CODE } from '../../src/report/common/elementMaps.js';
import { buildLifeStageFortuneCard } from '../../src/report/cards/life-stage-fortune-card.js';
import { containsDaeunAge, resolveDaeunDisplayInterval } from '../../src/report/common/daeun-display.js';
import { buildInsightFactsCard } from '../../src/report/cards/insight-facts-card.js';
import { buildLifeCurveCard } from '../../src/report/cards/life-curve-card.js';
import type { SajuSummary } from '../../src/types.js';

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

console.log('Life-stage ganji display normalization\n');

check('BRANCH_BY_CODE.SIN aliases SIN_BRANCH',
  BRANCH_BY_CODE.SIN === BRANCH_BY_CODE.SIN_BRANCH);

const summary = {
  dayMaster: { element: 'WATER' },
  yongshin: { element: 'METAL', heeshin: 'WATER', gishin: 'FIRE' },
  daeunInfo: {
    isForward: true,
    firstDaeunStartAge: 5,
    firstDaeunStartMonths: 0,
    pillars: [
      { stem: 'BYEONG', branch: 'SIN', startAge: 35, endAge: 45, order: 4 },
    ],
  },
} as unknown as SajuSummary;

const card = buildLifeStageFortuneCard(summary, 40);
const stage = card.stages[0];
const serializedCard = JSON.stringify(card);

check('BYEONG/SIN renders as Korean ganji',
  stage?.pillarDisplay === '병신',
  `pillarDisplay=${stage?.pillarDisplay}`);
check('current-stage evidence uses normalized pillar display',
  card.evidence?.[0]?.supportingFeatures?.includes('대운 기둥: 병신') === true);
check('mixed-script pillar display is absent',
  !serializedCard.includes('병SIN'));
const intervalSummary = {
  dayMaster: { element: 'WATER' },
  yongshin: { element: 'METAL', heeshin: 'WATER', gishin: 'FIRE' },
  daeunInfo: {
    isForward: true,
    firstDaeunStartAge: 2.756,
    firstDaeunStartAgeDisplay: 3,
    firstDaeunStartMonths: 9,
    pillars: [
      { stem: 'BYEONG', branch: 'SIN', startAge: 2.756, endAge: 12.756, order: 1 },
      { stem: 'JEONG', branch: 'YU', startAge: 12.756, endAge: 22.756, order: 2 },
    ],
  },
} as unknown as SajuSummary;

const displayInterval = resolveDaeunDisplayInterval(
  { startAge: 2.756, endAge: 12.756 },
  1,
);
check('shared interval keeps an exclusive numeric end',
  displayInterval?.startInclusive === 3
  && displayInterval.endExclusive === 13
  && displayInterval.endInclusive === 12);
const explicitDisplayInterval = resolveDaeunDisplayInterval({
  startAge: 2.756,
  endAge: 12.756,
  displayStartAge: 4,
  displayEndAge: 14,
}, 1);
check('explicit display interval takes precedence over the fallback offset',
  explicitDisplayInterval?.startInclusive === 4
  && explicitDisplayInterval.endExclusive === 14
  && explicitDisplayInterval.endInclusive === 13);
check('null display metadata pair uses the raw interval fallback',
  resolveDaeunDisplayInterval({
    startAge: 2.756, endAge: 12.756, displayStartAge: null, displayEndAge: null,
  }, 1)?.startInclusive === 3);
check('shared interval rejects string coercion',
  resolveDaeunDisplayInterval({ startAge: '2.756', endAge: '12.756' }, 1) === null);
check('shared interval rejects negative raw ages',
  resolveDaeunDisplayInterval({ startAge: -1, endAge: 9 }, 0) === null);
check('explicit display interval rejects partial metadata',
  resolveDaeunDisplayInterval({ startAge: 2, endAge: 12, displayStartAge: 3 }, 1) === null
  && resolveDaeunDisplayInterval({ startAge: 2, endAge: 12, displayEndAge: 13 }, 1) === null);
check('explicit display interval rejects non-numeric metadata',
  resolveDaeunDisplayInterval({
    startAge: 2,
    endAge: 12,
    displayStartAge: '3',
    displayEndAge: 13,
  }, 1) === null);
check('explicit display interval rejects reversed or negative ranges',
  resolveDaeunDisplayInterval({ startAge: 2, endAge: 12, displayStartAge: 13, displayEndAge: 3 }, 1) === null
  && resolveDaeunDisplayInterval({ startAge: 2, endAge: 12, displayStartAge: -1, displayEndAge: 9 }, 1) === null);
check('exclusive boundary belongs to the next interval',
  containsDaeunAge(12, 3, 13) && !containsDaeunAge(13, 3, 13));

const intervalCard = buildLifeStageFortuneCard(intervalSummary, 12.756);
check('life-stage range uses the inclusive display end',
  intervalCard.stages[0]?.ageRange === '3세 ~ 12세',
  String(intervalCard.stages[0]?.ageRange));
check('life-stage summary uses the same inclusive display end',
  intervalCard.stages[0]?.summary.includes('3세~12세') === true);
check('life-stage numeric end remains exclusive',
  intervalCard.stages[0]?.endAge === 13);
check('life-stage exact boundary selects the next pillar',
  intervalCard.currentStageIndex === 1,
  String(intervalCard.currentStageIndex));

const insight = buildInsightFactsCard(intervalSummary);
const daeunDetail = insight?.facts.find((fact) => fact.kind === 'daeunPillar')?.detail;
check('insight uses the same inclusive display end',
  daeunDetail === '3세~12세',
  String(daeunDetail));

const curve = buildLifeCurveCard(intervalSummary, 2000, 13);
check('life-curve uses the same inclusive display end',
  curve?.daeunSegments[0]?.label === '3세~12세',
  String(curve?.daeunSegments[0]?.label));
check('life-curve boundary selects the next pillar',
  curve?.points.find((point) => point.age === 13)?.daeunIndex === 1);

const partiallyMalformedSummary = {
  dayMaster: { element: 'WATER' },
  yongshin: { element: 'METAL', heeshin: 'WATER', gishin: 'FIRE' },
  daeunInfo: {
    isForward: true,
    firstDaeunStartAge: 0,
    firstDaeunStartMonths: 0,
    pillars: [
      {
        stem: 'BYEONG', branch: 'SIN', startAge: 0, endAge: 10, order: 1,
        displayStartAge: 1,
      },
      {
        stem: 'JEONG', branch: 'YU', startAge: 10, endAge: 20, order: 2,
        displayStartAge: 10, displayEndAge: 20,
      },
    ],
  },
} as unknown as SajuSummary;
const filteredCard = buildLifeStageFortuneCard(partiallyMalformedSummary, 15);
check('life-stage current index follows emitted stages after malformed interval filtering',
  filteredCard.stages.length === 1 && filteredCard.currentStageIndex === 0,
  `stages=${filteredCard.stages.length}, current=${filteredCard.currentStageIndex}`);

const fullyMalformedSummary = {
  dayMaster: { element: 'WATER' },
  yongshin: { element: 'METAL' },
  daeunInfo: {
    isForward: true,
    firstDaeunStartAge: 0,
    firstDaeunStartMonths: 0,
    pillars: [{
      stem: 'BYEONG', branch: 'SIN', startAge: 0, endAge: 10, order: 1,
      displayStartAge: 1,
    }],
  },
} as unknown as SajuSummary;
const missingCard = buildLifeStageFortuneCard(fullyMalformedSummary, 5);
check('life-stage returns the no-data contract when every display interval is malformed',
  missingCard.stages.length === 1
  && missingCard.stages[0]?.ageRange === '대운 정보 없음'
  && missingCard.currentStageIndex === null);

console.log(`\nlife-stage-ganji-display: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
