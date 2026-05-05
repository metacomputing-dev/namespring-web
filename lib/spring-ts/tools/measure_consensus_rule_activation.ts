/**
 * tools/measure_consensus_rule_activation.ts
 *
 * Phase 3 Agent A17 measurement deliverable.
 *
 * Runs every available baseline + jonggyeok fixture through the
 * spring engine in `consensus_aware` mode and aggregates how often
 * each yongshin consensus axis (eokbu / johu / gyeokguk / tonggwan /
 * byeongyak / siksangFlow) ends up agreeing with the final
 * recommendation. Also reports the conflict-level distribution and
 * how often each Task-2 condition fires.
 *
 * Outputs: artifacts/phase3-agent-a17/consensus-rule-activation.json
 *
 * Usage: npx tsx tools/measure_consensus_rule_activation.ts
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');

const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const FIXTURE_FILES: ReadonlyArray<{ readonly file: string; readonly source: string }> = [
  { file: 'test/fixtures/spring_ts_baseline_cases.json', source: 'spring_ts_baseline_cases' },
  { file: 'test/fixtures/jonggyeok_cases.json',          source: 'jonggyeok_cases' },
];

const OUTPUT_PATH = path.resolve(SPRING_TS_ROOT, 'artifacts/phase3-agent-a17/consensus-rule-activation.json');

const CONSENSUS_AXIS_NAMES = [
  'eokbu', 'johu', 'gyeokguk', 'tonggwan', 'byeongyak', 'siksangFlow',
] as const;
type AxisName = typeof CONSENSUS_AXIS_NAMES[number];

const CONFLICT_LEVELS = ['none', 'low', 'medium', 'high'] as const;
type ConflictLevel = typeof CONFLICT_LEVELS[number];

interface Fixture {
  readonly id: string;
  readonly label: string;
  readonly axis?: readonly string[];
  readonly birth: {
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly hour: number | null;
    readonly minute: number;
    readonly gender: 'male' | 'female' | 'neutral';
  };
  readonly surname: ReadonlyArray<{ readonly hangul: string; readonly hanja?: string }>;
  readonly givenName: ReadonlyArray<{ readonly hangul: string; readonly hanja?: string }>;
}

interface FixturePerCase {
  readonly id: string;
  readonly source: string;
  readonly conflictLevel: ConflictLevel;
  readonly competingCount: number;
  readonly finalElement: string;
  readonly axisAlignment: Record<AxisName, boolean>;
  readonly safetyPosture: string | null;
  readonly safetyStrategy: string | null;
  readonly thinReinforcementInfoFired: boolean;
  readonly multiCompetingHaircutFired: boolean;
  readonly aggressiveConflictFired: boolean;
  readonly yongshinRatio: number;
  readonly score: number;
}

// ── fetch patch (mirrors tools/baseline_snapshot.ts) ──────────────────────
const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string | URL | Request, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlStr.includes('sql-wasm.wasm') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url as any, options);
};

import { SpringEngine } from '../src/index.js';
import { computeSajuNameScore } from '../src/saju-calculator.js';
import type { ElementKey } from '../src/core/scoring.js';
import type { SajuOutputSummary } from '../src/types.js';

const EMPTY_DIST: Record<ElementKey, number> = {
  Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0,
};

function loadFixtures(): Array<{ source: string; fixture: Fixture }> {
  const all: Array<{ source: string; fixture: Fixture }> = [];
  for (const { file, source } of FIXTURE_FILES) {
    const fullPath = path.resolve(SPRING_TS_ROOT, file);
    if (!fs.existsSync(fullPath)) continue;
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    const fixtures: Fixture[] = data.fixtures ?? [];
    for (const fix of fixtures) all.push({ source, fixture: fix });
  }
  return all;
}

/** Build a tiny synthetic root distribution that reproduces the chart's
 *  yongshin element so we can read the score path consistently across
 *  fixtures. We use a single-element root to make the score-side
 *  guard observability clear; the goal is to measure rule activation,
 *  not to compare absolute scores across charts. */
function syntheticRoot(yongshinElementCode: string | null): Record<ElementKey, number> {
  const map: Record<string, ElementKey> = {
    WOOD: 'Wood', FIRE: 'Fire', EARTH: 'Earth', METAL: 'Metal', WATER: 'Water',
  };
  if (!yongshinElementCode) return { ...EMPTY_DIST };
  const elem = map[yongshinElementCode.toUpperCase()] ?? null;
  if (!elem) return { ...EMPTY_DIST };
  return { ...EMPTY_DIST, [elem]: 2 };
}

function computeYongshinRatio(
  root: Record<ElementKey, number>,
  yongshinElementCode: string | null,
): number {
  const total = Object.values(root).reduce((sum, v) => sum + v, 0);
  if (total === 0 || !yongshinElementCode) return 0;
  const map: Record<string, ElementKey> = {
    WOOD: 'Wood', FIRE: 'Fire', EARTH: 'Earth', METAL: 'Metal', WATER: 'Water',
  };
  const elem = map[yongshinElementCode.toUpperCase()] ?? null;
  if (!elem) return 0;
  return root[elem] / total;
}

async function run(): Promise<void> {
  const fixtures = loadFixtures();

  const engine = new SpringEngine();
  const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
  for (const repo of repos) {
    if (!repo) continue;
    (repo as any).wasmUrl = WASM_PATH;
  }
  await engine.init();

  const cases: FixturePerCase[] = [];

  // Aggregate counters
  const axisAgreesWithFinal: Record<AxisName, number> = {
    eokbu: 0, johu: 0, gyeokguk: 0, tonggwan: 0, byeongyak: 0, siksangFlow: 0,
  };
  const axisProducedRecommendation: Record<AxisName, number> = {
    eokbu: 0, johu: 0, gyeokguk: 0, tonggwan: 0, byeongyak: 0, siksangFlow: 0,
  };
  const conflictDistribution: Record<ConflictLevel, number> = {
    none: 0, low: 0, medium: 0, high: 0,
  };
  const postureDistribution: Record<string, number> = {
    safe: 0, balanced: 0, aggressive: 0,
  };
  const guardActivation = {
    multiCompetingHaircut: 0,
    thinReinforcementInfo: 0,
    aggressiveConflict: 0,
  };
  let scoreGuardAppliedCount = 0;
  let competingCountSum = 0;
  let consensusAvailableCount = 0;

  for (const { source, fixture } of fixtures) {
    const sajuReport = await engine.getSajuReport({
      birth: fixture.birth,
      surname: fixture.surname.map((s) => ({ hangul: s.hangul, hanja: s.hanja ?? '' })),
    });
    const yongshin = sajuReport.yongshin;
    const consensus = sajuReport.yongshinConsensus ?? yongshin?.consensus;
    if (!consensus || !yongshin) continue;
    consensusAvailableCount += 1;

    const finalElement = consensus.final.element ?? '';
    const conflictLevel = consensus.final.conflictLevel ?? 'none';
    const competingCount = consensus.final.competingElements.length;
    competingCountSum += competingCount;
    conflictDistribution[conflictLevel] = (conflictDistribution[conflictLevel] ?? 0) + 1;

    // axisAlignment: did this axis emit the same element as final?
    const axisAlignment: Record<AxisName, boolean> = {
      eokbu: false, johu: false, gyeokguk: false,
      tonggwan: false, byeongyak: false, siksangFlow: false,
    };
    for (const axis of CONSENSUS_AXIS_NAMES) {
      const detail = consensus[axis];
      if (detail && detail.element) {
        axisProducedRecommendation[axis] += 1;
        if (detail.element === finalElement) {
          axisAlignment[axis] = true;
          axisAgreesWithFinal[axis] += 1;
        }
      }
    }

    // Build a saju output summary for the score path. We thread the
    // already-computed yongshin/consensus through computeSajuNameScore
    // with a synthetic single-element root so the score-side guards
    // (multi-competing haircut, etc.) become observable.
    const root = syntheticRoot(yongshin.element ?? null);
    const yongshinRatio = computeYongshinRatio(root, yongshin.element ?? null);
    const output: SajuOutputSummary = {
      yongshin: {
        finalYongshin: (yongshin.element as any) ?? '',
        finalHeesin: (yongshin.heeshin as any) ?? '',
        gisin: (yongshin.gishin as any) ?? null,
        gusin: (yongshin.gushin as any) ?? null,
        finalConfidence: yongshin.confidence ?? 0.65,
        recommendations: [],
        consensus,
      },
      yongshinConsensus: consensus,
    };
    const result = computeSajuNameScore(EMPTY_DIST, root, output, null, {
      yongshinMode: 'consensus_aware',
    });
    const safety = result.breakdown.safetyProfile;
    const safetyPosture = safety?.posture ?? null;
    const safetyStrategy = safety?.strategy ?? null;
    if (safetyPosture) postureDistribution[safetyPosture] = (postureDistribution[safetyPosture] ?? 0) + 1;

    // Detect each Task-2 condition firing by re-evaluating its predicate.
    // We can derive aggressiveReinforcement directly from yongshinRatio
    // (which the helper above already computed via the case-translated
    // element key); reaching back into `root` with the upstream uppercase
    // element string skips the casing translation and silently yields
    // undefined, which is the bug the previous version had.
    const aggressiveReinforcement = yongshinRatio > 0
      ? Math.min(1, Math.max(0, (yongshinRatio - 0.5) / 0.5))
      : 0;
    const aggressiveConflictFired =
      (conflictLevel === 'medium' || conflictLevel === 'high')
      && aggressiveReinforcement >= 0.5;
    const multiCompetingHaircutFired =
      conflictLevel === 'high'
      && competingCount >= 3;
    const thinReinforcementInfoFired =
      (conflictLevel === 'medium' || conflictLevel === 'high')
      && competingCount >= 3
      && yongshinRatio < 0.10;

    if (aggressiveConflictFired) guardActivation.aggressiveConflict += 1;
    if (multiCompetingHaircutFired) guardActivation.multiCompetingHaircut += 1;
    if (thinReinforcementInfoFired) guardActivation.thinReinforcementInfo += 1;
    if (result.breakdown.yongshinConsensus?.scoreGuardApplied) scoreGuardAppliedCount += 1;

    cases.push({
      id: fixture.id,
      source,
      conflictLevel,
      competingCount,
      finalElement,
      axisAlignment,
      safetyPosture,
      safetyStrategy,
      thinReinforcementInfoFired,
      multiCompetingHaircutFired,
      aggressiveConflictFired,
      yongshinRatio,
      score: result.breakdown.yongshin,
    });
  }

  engine.close();

  const fixtureCount = cases.length;
  const axisActivationRatio: Record<AxisName, number> = {
    eokbu: 0, johu: 0, gyeokguk: 0, tonggwan: 0, byeongyak: 0, siksangFlow: 0,
  };
  for (const axis of CONSENSUS_AXIS_NAMES) {
    axisActivationRatio[axis] = fixtureCount > 0
      ? axisAgreesWithFinal[axis] / fixtureCount
      : 0;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    fixtureSources: FIXTURE_FILES.map((f) => f.source),
    fixtureCount,
    consensusAvailableCount,
    targetMode: 'consensus_aware' as const,
    methodology: [
      'For each fixture: run getSajuReport(), capture YongshinConsensusScoreboard.',
      'Per axis (eokbu/johu/gyeokguk/tonggwan/byeongyak/siksangFlow): count whether the axis emitted the same element as final.element. Ratio = match-count / fixtureCount.',
      'Synthetic single-element root used to thread computeSajuNameScore in consensus_aware mode so score-side guards become observable.',
      'Each guard predicate re-evaluated independently of the score function so we report what fired regardless of the order in which the score visited it.',
    ],
    averageCompetingCount: fixtureCount > 0 ? competingCountSum / fixtureCount : 0,
    axisAgreesWithFinal,
    axisProducedRecommendation,
    axisActivationRatio,
    conflictDistribution,
    postureDistribution,
    guardActivation: {
      ...guardActivation,
      scoreGuardAppliedCount,
    },
    cases: cases.map((c) => ({
      ...c,
      score: Number(c.score.toFixed(3)),
      yongshinRatio: Number(c.yongshinRatio.toFixed(3)),
    })),
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2) + '\n');
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`  fixtures measured: ${fixtureCount}`);
  console.log(`  conflictDistribution: ${JSON.stringify(conflictDistribution)}`);
  console.log(`  postureDistribution: ${JSON.stringify(postureDistribution)}`);
  console.log(`  guardActivation: ${JSON.stringify(report.guardActivation)}`);
  console.log(`  axisActivationRatio: ${JSON.stringify(axisActivationRatio)}`);
}

await run();
