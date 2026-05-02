/**
 * Regression guard for life-stage daewoon display normalization.
 *
 * Run: npm run test:life-stage-display
 */
import { BRANCH_BY_CODE } from '../../src/report/common/elementMaps.js';
import { buildLifeStageFortuneCard } from '../../src/report/cards/life-stage-fortune-card.js';
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

console.log(`\nlife-stage-ganji-display: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
