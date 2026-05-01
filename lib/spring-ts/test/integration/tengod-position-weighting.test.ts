/**
 * test/integration/tengod-position-weighting.test.ts
 *
 * Synthetic scorer-only fixtures for PR-5.1/PR-5.2. These keep aggregate
 * `groupCounts` fixed while moving one ten-god signal across source layers
 * and pillar positions, so positional weighting behavior is
 * measurable without DB or engine initialization.
 *
 * Run: npm run test:tengod-position-weighting
 */
import {
  computeSajuNameScore,
  computeTenGodScoreDiagnostics,
  type SajuOutputSummary,
} from '../../src/index.js';
import type { ElementKey } from '../../src/core/scoring.js';

type FixtureId = 'monthStem' | 'hourStem' | 'monthHidden' | 'hourHidden';
type TenGodMode = 'simple_count' | 'positional_weighted' | 'positional_weighted_v2';

const ZERO_DIST: Record<ElementKey, number> = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
const SAJU_DIST: Record<ElementKey, number> = { Wood: 1, Fire: 1, Earth: 1, Metal: 1, Water: 1 };
const ROOT_WOOD: Record<ElementKey, number> = { ...ZERO_DIST, Wood: 1 };
const GROUP_COUNTS = { friend: 1, output: 4, wealth: 4, authority: 0, resource: 4 };

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

function basePosition() {
  return {
    cheonganGroup: 'resource',
    jijiPrincipalGroup: 'output',
    hiddenStems: [{ stem: 'MU', element: 'Earth' as const, ratio: 100, group: 'wealth' }],
  };
}

function makeSajuOutput(id: FixtureId): SajuOutputSummary {
  const byPosition = {
    year: basePosition(),
    month: basePosition(),
    day: basePosition(),
    hour: basePosition(),
  };

  if (id === 'monthStem') byPosition.month.cheonganGroup = 'friend';
  if (id === 'hourStem') byPosition.hour.cheonganGroup = 'friend';
  if (id === 'monthHidden') byPosition.month.hiddenStems = [{ stem: 'GAP', element: 'Wood', ratio: 100, group: 'friend' }];
  if (id === 'hourHidden') byPosition.hour.hiddenStems = [{ stem: 'GAP', element: 'Wood', ratio: 100, group: 'friend' }];

  return {
    dayMaster: { element: 'Wood' },
    tenGod: {
      groupCounts: GROUP_COUNTS,
      byPosition,
    },
  };
}

function score(id: FixtureId, mode: TenGodMode) {
  const sajuOutput = makeSajuOutput(id);
  const result = computeSajuNameScore(
    SAJU_DIST,
    ROOT_WOOD,
    sajuOutput,
    null,
    { tenGodMode: mode },
  );
  const diagnostics = computeTenGodScoreDiagnostics(ROOT_WOOD, sajuOutput, mode);
  return { score: result.breakdown.tenGod, diagnostics };
}

function scoreOmitted(id: FixtureId) {
  const result = computeSajuNameScore(
    SAJU_DIST,
    ROOT_WOOD,
    makeSajuOutput(id),
    null,
  );
  return result.breakdown.tenGod;
}

console.log('PR-5.1/PR-5.2 ten-god positional weighting synthetic fixtures\n');

const ids: FixtureId[] = ['monthStem', 'hourStem', 'monthHidden', 'hourHidden'];
const simpleRows = Object.fromEntries(ids.map((id) => [id, score(id, 'simple_count')])) as Record<FixtureId, ReturnType<typeof score>>;
const positionalRows = Object.fromEntries(ids.map((id) => [id, score(id, 'positional_weighted')])) as Record<FixtureId, ReturnType<typeof score>>;
const positionalV2Rows = Object.fromEntries(ids.map((id) => [id, score(id, 'positional_weighted_v2')])) as Record<FixtureId, ReturnType<typeof score>>;

for (const id of ids) {
  console.log(`${id.padEnd(12)} simple=${simpleRows[id].score.toFixed(6)} positional=${positionalRows[id].score.toFixed(6)} v2=${positionalV2Rows[id].score.toFixed(6)}`);
}

const simpleUnique = new Set(ids.map((id) => simpleRows[id].score.toFixed(12)));
check(
  'simple_count ignores synthetic source/position layout when aggregate groupCounts are fixed',
  simpleUnique.size === 1,
  [...simpleUnique].join(', '),
);

check(
  'omitted lower-level tenGod override still equals simple_count default',
  ids.every((id) => scoreOmitted(id) === simpleRows[id].score),
);

check(
  'positional_weighted records raw position contributions before normalization',
  positionalRows.monthStem.diagnostics.positionContributions.some((row) =>
    row.position === 'month' && row.source === 'cheongan' && row.group === 'friend' && row.weight === 4) &&
    positionalRows.monthHidden.diagnostics.positionContributions.some((row) =>
      row.position === 'month' && row.source === 'hiddenStem' && row.group === 'friend' && row.weight === 1.2),
);

check(
  'heavenly-stem signal diverges from hidden-stem signal under current positional_weighted',
  positionalRows.monthStem.score !== positionalRows.monthHidden.score,
  `monthStem=${positionalRows.monthStem.score.toFixed(6)}, monthHidden=${positionalRows.monthHidden.score.toFixed(6)}`,
);

check(
  'month stem and hour stem currently collapse because pillar position is not weighted',
  positionalRows.monthStem.score === positionalRows.hourStem.score,
  `monthStem=${positionalRows.monthStem.score.toFixed(6)}, hourStem=${positionalRows.hourStem.score.toFixed(6)}`,
);

check(
  'month hidden and hour hidden currently collapse because pillar position is not weighted',
  positionalRows.monthHidden.score === positionalRows.hourHidden.score,
  `monthHidden=${positionalRows.monthHidden.score.toFixed(6)}, hourHidden=${positionalRows.hourHidden.score.toFixed(6)}`,
);

check(
  'diagnostics expose deviation-from-average normalization point',
  ids.every((id) =>
    positionalRows[id].diagnostics.normalization === 'deviation_from_average_count' &&
    Number.isFinite(positionalRows[id].diagnostics.averageCount) &&
    Number.isFinite(positionalRows[id].diagnostics.deviations.friend)),
  `avg=${positionalRows.monthStem.diagnostics.averageCount.toFixed(6)}, friendDev=${positionalRows.monthStem.diagnostics.deviations.friend.toFixed(6)}`,
);

check(
  'v2 preserves source-layer sensitivity on month pillar',
  positionalV2Rows.monthStem.score !== positionalV2Rows.monthHidden.score,
  `monthStem=${positionalV2Rows.monthStem.score.toFixed(6)}, monthHidden=${positionalV2Rows.monthHidden.score.toFixed(6)}`,
);

check(
  'v2 preserves source-layer sensitivity on hour pillar',
  positionalV2Rows.hourStem.score !== positionalV2Rows.hourHidden.score,
  `hourStem=${positionalV2Rows.hourStem.score.toFixed(6)}, hourHidden=${positionalV2Rows.hourHidden.score.toFixed(6)}`,
);

check(
  'v2 adds pillar-position sensitivity for stem signal',
  positionalV2Rows.monthStem.score !== positionalV2Rows.hourStem.score,
  `monthStem=${positionalV2Rows.monthStem.score.toFixed(6)}, hourStem=${positionalV2Rows.hourStem.score.toFixed(6)}`,
);

check(
  'v2 adds pillar-position sensitivity for hidden-stem signal',
  positionalV2Rows.monthHidden.score !== positionalV2Rows.hourHidden.score,
  `monthHidden=${positionalV2Rows.monthHidden.score.toFixed(6)}, hourHidden=${positionalV2Rows.hourHidden.score.toFixed(6)}`,
);

check(
  'v2 is measurably distinct from PR-5.1 positional_weighted',
  ids.some((id) => positionalV2Rows[id].score !== positionalRows[id].score),
);

check(
  'v2 diagnostics expose presence/visibility chart-shape anchor',
  ids.every((id) =>
    positionalV2Rows[id].diagnostics.effectiveMode === 'positional_weighted_v2' &&
    positionalV2Rows[id].diagnostics.normalization === 'presence_visibility_expected_by_chart_shape' &&
    Number.isFinite(positionalV2Rows[id].diagnostics.expectedPresenceByChartShape) &&
    Number.isFinite(positionalV2Rows[id].diagnostics.meanVisibilityPerPresence) &&
    Number.isFinite(positionalV2Rows[id].diagnostics.visibilityDeviations?.friend)),
  `expectedPresence=${positionalV2Rows.monthStem.diagnostics.expectedPresenceByChartShape?.toFixed(6)}, visibilityDev=${positionalV2Rows.monthStem.diagnostics.visibilityDeviations?.friend.toFixed(6)}`,
);

check(
  'v2 does not collapse month/hour at ten-god diagnostic layer',
  positionalV2Rows.monthStem.diagnostics.deviations.friend !== positionalV2Rows.hourStem.diagnostics.deviations.friend ||
    positionalV2Rows.monthStem.diagnostics.elementWeights.Wood !== positionalV2Rows.hourStem.diagnostics.elementWeights.Wood,
  `monthDev=${positionalV2Rows.monthStem.diagnostics.deviations.friend.toFixed(6)}, hourDev=${positionalV2Rows.hourStem.diagnostics.deviations.friend.toFixed(6)}`,
);

console.log(`\nTen-god position weighting synthetic fixtures: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
