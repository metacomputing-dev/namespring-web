/**
 * Regression guard for overviewSummary.pillars element serialization.
 *
 * The NameSpring combined report splits `pillar.element` on "/" to render
 * separate heavenly-stem and earthly-branch cells. Even when both parts share
 * the same element, spring-ts must keep both sides in the payload.
 *
 * Run: npm run test:overview-pillar-elements
 */
import { buildOverviewSummaryCard } from '../../src/report/cards/overview-summary-card.js';
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

console.log('Overview pillar element pair serialization\n');

const woodPillar = {
  stem: { code: 'GAP', hangul: '갑', hanja: '甲' },
  branch: { code: 'IN', hangul: '인', hanja: '寅' },
};

const summary = {
  pillars: {
    year: woodPillar,
    month: woodPillar,
    day: woodPillar,
    hour: woodPillar,
  },
  dayMaster: { stem: 'GAP', element: 'WOOD', polarity: 'YANG' },
  strength: {
    level: 'BALANCED',
    isStrong: false,
    totalSupport: 0,
    totalOppose: 0,
    deukryeong: 0,
    deukji: 0,
    deukse: 0,
    details: [],
  },
  yongshin: { element: 'WATER', confidence: 1 },
  gyeokguk: { type: '', candidates: [] },
  elementDistribution: { WOOD: 8 },
  deficientElements: [],
  excessiveElements: [],
} as unknown as SajuSummary;

const card = buildOverviewSummaryCard(summary);
const firstElement = card.pillars[0]?.element ?? '';
const parts = firstElement.split('/');

check('same-element pillar keeps separator',
  firstElement.includes('/'),
  `element=${firstElement}`);
check('same-element pillar keeps two non-empty element labels',
  parts.length === 2 && parts.every((part) => part.trim().length > 0),
  `parts=${parts.join('|')}`);

console.log(`\noverview-pillar-elements: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
