/**
 * test/integration/yongshin-consensus-baseline.test.ts
 *
 * Guards the additive yongshin consensus scoreboard against the existing
 * selected-yongshin baseline. The scoreboard is diagnostic: it must expose
 * method disagreement without changing the selected yongshin/heeshin fields.
 *
 * Run: npm run test:yongshin-consensus
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeSaju, buildSajuContext } from '../../src/saju-adapter.js';
import { computeSajuNameScore } from '../../src/saju-calculator.js';
import type {
  BirthInfo,
  YongshinConsensusAxisName,
  YongshinConsensusAxisScore,
  YongshinConsensusConflictLevel,
  YongshinConsensusScoreboard,
} from '../../src/types.js';
import type { ElementKey } from '../../src/core/scoring.js';

interface BaselineFixture {
  readonly id: string;
  readonly label: string;
  readonly birth: BirthInfo;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const FIXTURE_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');
const BASELINE_SNAPSHOT_PATH = path.resolve(SPRING_TS_ROOT, 'test/baseline/spring_ts_snapshot.json');

const AXES: readonly YongshinConsensusAxisName[] = [
  'eokbu',
  'johu',
  'gyeokguk',
  'tonggwan',
  'byeongyak',
  'siksangFlow',
];
const CONFLICT_LEVELS: readonly YongshinConsensusConflictLevel[] = ['none', 'low', 'medium', 'high'];
const ROOT_DIST: Record<ElementKey, number> = { Wood: 0, Fire: 0, Earth: 0, Metal: 1, Water: 1 };

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

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function isUnit(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function axisIsNormalized(axis: YongshinConsensusAxisScore): boolean {
  return (
    (axis.element === null || typeof axis.element === 'string') &&
    isUnit(axis.score) &&
    AXES.length > 0 &&
    Object.values(axis.scores).every(isUnit) &&
    Array.isArray(axis.evidence)
  );
}

function finalIsNormalized(consensus: YongshinConsensusScoreboard): boolean {
  return (
    typeof consensus.final.element === 'string' &&
    isUnit(consensus.final.confidence) &&
    Number.isFinite(consensus.final.topMargin) &&
    CONFLICT_LEVELS.includes(consensus.final.conflictLevel) &&
    Array.isArray(consensus.final.competingElements) &&
    Array.isArray(consensus.final.evidence)
  );
}

const fixtures = readJson<{ fixtures: readonly BaselineFixture[] }>(FIXTURE_PATH).fixtures;
const selectedBaseline = readJson<any>(BASELINE_SNAPSHOT_PATH);
const selectedById = new Map<string, any>(
  (selectedBaseline.results ?? []).map((row: any) => [row.id, row.output?.sajuReport ?? {}]),
);

console.log('Phase 4.5 yongshin consensus baseline\n');

let disagreementFixtureCount = 0;

for (const fixture of fixtures) {
  const summary = await analyzeSaju(fixture.birth);
  const storedSelected = selectedById.get(fixture.id);
  const consensus = summary.yongshinConsensus;

  check(`${fixture.id}: selected yongshin unchanged`,
    summary.yongshin.element === storedSelected?.yongshinElement,
    `actual=${summary.yongshin.element}, baseline=${storedSelected?.yongshinElement}`);
  check(`${fixture.id}: selected heeshin unchanged`,
    summary.yongshin.heeshin === storedSelected?.yongshinHeeshin,
    `actual=${summary.yongshin.heeshin}, baseline=${storedSelected?.yongshinHeeshin}`);

  check(`${fixture.id}: consensus exists on SajuSummary`,
    consensus != null && typeof consensus === 'object');
  check(`${fixture.id}: consensus also exists on yongshin summary`,
    summary.yongshin.consensus?.final.element === consensus?.final.element &&
      summary.yongshin.consensus?.final.conflictLevel === consensus?.final.conflictLevel);

  if (!consensus) continue;

  for (const axisName of AXES) {
    check(`${fixture.id}: ${axisName} axis normalized`,
      axisIsNormalized(consensus[axisName]));
  }
  check(`${fixture.id}: final consensus normalized`,
    finalIsNormalized(consensus),
    `level=${consensus.final.conflictLevel}, selected=${consensus.final.element}`);

  if (consensus.final.conflictLevel !== 'none' || consensus.final.competingElements.length > 0) {
    disagreementFixtureCount += 1;
  }

  const context = buildSajuContext(summary);
  check(`${fixture.id}: buildSajuContext returns output`,
    context.output != null);
  if (context.output) {
    check(`${fixture.id}: SajuOutputSummary surfaces top-level consensus`,
      context.output.yongshinConsensus === consensus);
    check(`${fixture.id}: SajuOutputSummary.yongshin surfaces consensus`,
      context.output.yongshin?.consensus === consensus);

    const score = computeSajuNameScore(context.dist, ROOT_DIST, context.output);
    check(`${fixture.id}: scoring breakdown carries consensus conflict metadata`,
      score.breakdown.yongshinConsensus?.conflictLevel === consensus.final.conflictLevel &&
        score.breakdown.yongshinConsensus?.competingElements === consensus.final.competingElements,
      `level=${score.breakdown.yongshinConsensus?.conflictLevel}`);

    const guardedScore = computeSajuNameScore(context.dist, ROOT_DIST, context.output, null, {
      yongshinMode: 'consensus_aware',
    });
    check(`${fixture.id}: consensus_aware scoring applies conflict guard`,
      guardedScore.breakdown.yongshinConsensus?.scoreGuardApplied === (consensus.final.conflictLevel !== 'none'),
      `guard=${guardedScore.breakdown.yongshinConsensus?.scoreGuardApplied}`);
  }
}

check('at least one baseline fixture exposes yongshin method disagreement',
  disagreementFixtureCount > 0,
  `count=${disagreementFixtureCount}`);

console.log(`\nYongshin consensus baseline: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
