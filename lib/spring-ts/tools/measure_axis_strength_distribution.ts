/**
 * tools/measure_axis_strength_distribution.ts
 *
 * Phase 3 Agent A16 (Task 3) — measurement-only script that aggregates
 * `SajuSummary.axisStrength` tier counts (definite / practical / candidate /
 * deferred) across the 15 baseline fixtures. The output is written as a
 * deterministic JSON artifact under `artifacts/phase3-agent-a16/` so that a
 * future agent (or human reviewer) can decide whether to retune the
 * confidence thresholds in `saju-adapter.deriveAxisStrength`.
 *
 * IMPORTANT: this script never mutates the engine. It only reads
 * `analyzeSaju(...)` output. Default-mode behaviour is unchanged.
 *
 * Usage:
 *   npx tsx tools/measure_axis_strength_distribution.ts
 *
 * Output:
 *   artifacts/phase3-agent-a16/axis-strength-distribution.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeSaju } from '../src/saju-adapter.js';
import type { BirthInfo, SajuJudgmentStrength, SajuAxisStrengthMap } from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(SPRING_TS_ROOT, 'test', 'fixtures', 'spring_ts_baseline_cases.json');
const OUTPUT_PATH = path.join(
  SPRING_TS_ROOT,
  'artifacts',
  'phase3-agent-a16',
  'axis-strength-distribution.json',
);

const TIERS = ['definite', 'practical', 'candidate', 'deferred'] as const;
const AXES = ['yongshin', 'gyeokguk', 'strength', 'chengbai', 'johu', 'fortuneHierarchy', 'rectification'] as const;
type AxisName = typeof AXES[number];

type TierBucket = Record<SajuJudgmentStrength | 'absent', number>;

interface FixtureRow {
  readonly id: string;
  readonly label: string;
  readonly axisStrength: SajuAxisStrengthMap | null;
}

interface Fixture {
  readonly id: string;
  readonly label: string;
  readonly birth: BirthInfo;
  readonly options?: Record<string, unknown>;
}

function makeBucket(): TierBucket {
  return { definite: 0, practical: 0, candidate: 0, deferred: 0, absent: 0 };
}

async function main(): Promise<void> {
  const fixtureFile = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8')) as { readonly fixtures: readonly Fixture[] };
  const fixtures = fixtureFile.fixtures;

  // Per-axis tier buckets aggregated across all fixtures.
  const perAxis: Record<AxisName, TierBucket> = {} as Record<AxisName, TierBucket>;
  for (const ax of AXES) perAxis[ax] = makeBucket();

  const fixtureRows: FixtureRow[] = [];

  for (const fixture of fixtures) {
    const summary = await analyzeSaju(fixture.birth, fixture.options as any);
    const axisStrength = summary.axisStrength ?? null;
    fixtureRows.push({ id: fixture.id, label: fixture.label, axisStrength });

    for (const ax of AXES) {
      const tier = axisStrength?.[ax];
      if (tier === undefined) {
        perAxis[ax].absent += 1;
      } else {
        perAxis[ax][tier] += 1;
      }
    }
  }

  const fixtureCount = fixtures.length;

  // Across-axes flatten — every (fixture, axis) pair contributing one bin.
  const flat = makeBucket();
  for (const ax of AXES) {
    for (const tier of [...TIERS, 'absent'] as const) {
      flat[tier] += perAxis[ax][tier];
    }
  }

  const flatTotal = Object.values(flat).reduce((a, b) => a + b, 0);
  const flatDeferredRatio = flatTotal > 0 ? flat.deferred / flatTotal : 0;

  // Per-axis deferred ratio (deferred / present-only), so axes that the
  // engine never surfaces (absent across the board) do not skew the rate.
  const perAxisStats: Record<AxisName, {
    readonly counts: TierBucket;
    readonly presentCount: number;
    readonly deferredRatioPresent: number;
    readonly deferredRatioAll: number;
  }> = {} as Record<AxisName, {
    counts: TierBucket;
    presentCount: number;
    deferredRatioPresent: number;
    deferredRatioAll: number;
  }>;
  for (const ax of AXES) {
    const counts = perAxis[ax];
    const presentCount = TIERS.reduce((sum, tier) => sum + counts[tier], 0);
    perAxisStats[ax] = {
      counts,
      presentCount,
      deferredRatioPresent: presentCount > 0 ? counts.deferred / presentCount : 0,
      deferredRatioAll: fixtureCount > 0 ? counts.deferred / fixtureCount : 0,
    };
  }

  const report = {
    schemaVersion: 'spring-ts.phase3-agent-a16.axis-strength-distribution.v1',
    purpose:
      'Measurement-only audit of SajuSummary.axisStrength 4-tier distribution across the 15 baseline fixtures. ' +
      'No engine threshold change is proposed in this PR — this artifact is documentation for a possible follow-up.',
    generatedAt: new Date().toISOString(),
    fixtureCount,
    axes: AXES,
    tiers: TIERS,
    perAxis: perAxisStats,
    flatAcrossAxes: {
      counts: flat,
      total: flatTotal,
      deferredRatio: flatDeferredRatio,
    },
    fixtures: fixtureRows,
    notes: [
      'absent = the saju adapter did not surface this axis at all for the fixture. Excluded from the deferred-ratio-present figure.',
      'deferred-ratio-present = deferred / (definite + practical + candidate + deferred).',
      'A high deferred ratio on yongshin/gyeokguk is expected for hour-uncertain or boundary fixtures; the input-uncertainty downgrade is intentional.',
      'No threshold change is proposed in this PR. If a future PR retunes deriveAxisStrength bands, re-run this script to verify the regression direction.',
    ],
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`flat across axes — deferred ratio = ${(flatDeferredRatio * 100).toFixed(1)}%`);
  for (const ax of AXES) {
    const stats = perAxisStats[ax];
    const presentCount = stats.presentCount;
    const ratio = (stats.deferredRatioPresent * 100).toFixed(1);
    console.log(`  ${ax.padEnd(18)} present=${presentCount.toString().padStart(2)}  deferred=${stats.counts.deferred.toString().padStart(2)}  ratio=${ratio}%`);
  }
}

await main();
