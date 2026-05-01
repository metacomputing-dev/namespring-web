/**
 * scripts/compute-deterministic-calibration.ts
 *
 * Phase 8.2 deterministic calibration harness.
 *
 * This is intentionally not ML. It evaluates a fixed request-option grid
 * through SpringEngine, scores only high-tier authority truth in the objective,
 * and blocks promotion when the objective denominator is insufficient.
 *
 * Usage:
 *   npx tsx scripts/compute-deterministic-calibration.ts
 *   npx tsx scripts/compute-deterministic-calibration.ts --out-dir /tmp/calibration
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SCHOOL_PRESET_ORDER,
  SpringEngine,
  loadPreset,
  type SchoolPresetName,
} from '../src/index.js';
import type { BirthInfo, NameCharInput, SpringOptions } from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');
const FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');

const SCHEMA_VERSION = 'spring-ts.deterministic-calibration.v1';
const GENERATED_AT = '2026-05-02T00:00:00.000Z';
const MIN_ELIGIBLE_OBJECTIVE_FIXTURES = 3;

const OBJECTIVE_TIER_WEIGHTS = {
  T5_OFFICIAL: 5,
  T4_PRIMARY_TEXT: 4,
  T3_AUTHORED_INTERPRETATION: 2,
  T2_REFERENCE_IMPLEMENTATION: 0,
  T1_HYPOTHESIS: 0,
  T0_UNSOURCED: 0,
  NO_REFERENCE: 0,
} as const;

interface Args {
  readonly outDir: string;
  readonly metricsPath: string;
  readonly json: boolean;
}

interface BaselineFixture {
  readonly id: string;
  readonly label: string;
  readonly birth: BirthInfo;
  readonly surname: readonly NameCharInput[];
  readonly givenName: readonly NameCharInput[];
}

interface SourceProfile {
  readonly referenceTier: string;
  readonly referenceKind: string;
  readonly sourceType: string;
  readonly truthBucket: string;
  readonly authorityTruthEligible: boolean;
}

interface BySourceTierMetric {
  readonly schemaVersion?: string;
  readonly baseline?: {
    readonly fixtureCount?: number;
  };
  readonly qualityGateByReferenceTier?: Record<string, {
    readonly fixtureCount?: number;
    readonly truthBuckets?: {
      readonly authority_match?: number;
      readonly engine_rule_failure?: number;
      readonly insufficient_source_truth?: number;
    };
  }>;
  readonly schoolPresetBreakdown?: {
    readonly rows?: Array<{
      readonly fixtureId: string;
      readonly referenceTier: string;
      readonly referenceKind: string;
      readonly sourceType: string;
      readonly truthBucket: string;
      readonly authorityTruthEligible: boolean;
    }>;
  };
}

interface ScorePair {
  readonly total: number;
  readonly saju: number;
}

interface CalibrationCandidate {
  readonly candidateId: string;
  readonly candidateKind:
    | 'current_default'
    | 'anchor'
    | 'school_preset'
    | 'scorer_mode'
    | 'evaluator_mode';
  readonly schoolPreset: SchoolPresetName | null;
  readonly options?: SpringOptions;
  readonly sweptParameters: Record<string, unknown>;
  readonly sweptWeights: {
    readonly yongshinTypeWeights?: Record<string, number>;
    readonly adaptiveWeights?: Record<string, number>;
  };
}

function parseArgs(argv: string[]): Args {
  const mutable: { -readonly [K in keyof Args]: Args[K] } = {
    outDir: path.resolve(SPRING_TS_ROOT, 'metrics'),
    metricsPath: path.resolve(SPRING_TS_ROOT, 'metrics/bySourceTier.json'),
    json: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--out-dir' && argv[i + 1]) {
      mutable.outDir = path.resolve(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--metrics' && argv[i + 1]) {
      mutable.metricsPath = path.resolve(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--json') {
      mutable.json = true;
    }
  }
  return mutable;
}

function readJson<T = any>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function patchFetchForEngine(): void {
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
}

function pickWeights(source: Readonly<Record<string, number>>, keys: readonly string[]): Record<string, number> {
  return Object.fromEntries(keys.map((key) => [key, source[key]]));
}

function presetWeights(schoolPreset: SchoolPresetName): CalibrationCandidate['sweptWeights'] {
  const preset = loadPreset(schoolPreset);
  return {
    yongshinTypeWeights: pickWeights(preset.yongshinTypeWeights, [
      'EOKBU',
      'JOHU',
      'TONGGWAN',
      'GYEOKGUK',
      'BYEONGYAK',
      'JEONWANG',
    ]),
    adaptiveWeights: pickWeights(preset.adaptiveWeights, [
      'balanceBase',
      'yongshinBase',
      'strengthFixed',
      'tenGodFixed',
      'baseShiftRatio',
      'confidenceBoost',
    ]),
  };
}

function candidate(
  candidateId: string,
  candidateKind: CalibrationCandidate['candidateKind'],
  options: SpringOptions | undefined,
  sweptParameters: Record<string, unknown>,
  schoolPreset: SchoolPresetName | null = null,
): CalibrationCandidate {
  return {
    candidateId,
    candidateKind,
    schoolPreset,
    ...(options ? { options } : {}),
    sweptParameters,
    sweptWeights: schoolPreset ? presetWeights(schoolPreset) : {},
  };
}

function buildGrid(): CalibrationCandidate[] {
  const rows: CalibrationCandidate[] = [
    candidate('current_default', 'current_default', undefined, {}),
    candidate('anchor:empty_precision_config', 'anchor', { precisionConfig: {} }, {
      precisionConfig: {},
    }),
    candidate('anchor:korean_preset', 'anchor', {
      schoolPreset: 'korean',
      precisionConfig: { useSchoolPreset: true },
    }, {
      schoolPreset: 'korean',
      useSchoolPreset: true,
    }, 'korean'),
  ];

  for (const preset of SCHOOL_PRESET_ORDER) {
    rows.push(candidate(`schoolPreset:${preset}`, 'school_preset', {
      schoolPreset: preset,
      precisionConfig: {
        useSchoolPreset: true,
        surfaceNamingScoreVector: true,
      },
    }, {
      schoolPreset: preset,
      useSchoolPreset: true,
      surfaceNamingScoreVector: true,
    }, preset));
  }

  for (const balanceMode of ['mathematical', 'yongshin_first', 'classical_jonggyeok_aware'] as const) {
    rows.push(candidate(`scorer:balanceMode:${balanceMode}`, 'scorer_mode', {
      precisionConfig: { balanceMode, surfaceNamingScoreVector: true },
    }, { balanceMode }));
  }
  for (const yongshinMode of ['classical_blend', 'chengbai_strict', 'consensus_aware'] as const) {
    rows.push(candidate(`scorer:yongshinMode:${yongshinMode}`, 'scorer_mode', {
      precisionConfig: { yongshinMode, surfaceNamingScoreVector: true },
    }, { yongshinMode }));
  }
  for (const strengthMode of ['binary', 'continuous'] as const) {
    rows.push(candidate(`scorer:strengthMode:${strengthMode}`, 'scorer_mode', {
      precisionConfig: { strengthMode, surfaceNamingScoreVector: true },
    }, { strengthMode }));
  }
  for (const tenGodMode of ['simple_count', 'positional_weighted', 'positional_weighted_v2'] as const) {
    rows.push(candidate(`scorer:tenGodMode:${tenGodMode}`, 'scorer_mode', {
      precisionConfig: { tenGodMode, surfaceNamingScoreVector: true },
    }, { tenGodMode }));
  }
  for (const gyeokgukMode of ['jonggyeok_only', 'chengbai_strict', 'multi_special'] as const) {
    rows.push(candidate(`scorer:gyeokgukMode:${gyeokgukMode}`, 'scorer_mode', {
      precisionConfig: { gyeokgukMode, surfaceNamingScoreVector: true },
    }, { gyeokgukMode }));
  }
  for (const sajuPriorityCurve of ['linear', 'tanh'] as const) {
    rows.push(candidate(`evaluator:sajuPriorityCurve:${sajuPriorityCurve}`, 'evaluator_mode', {
      precisionConfig: { sajuPriorityCurve, surfaceNamingScoreVector: true },
    }, { sajuPriorityCurve }));
  }
  for (const evaluatorMode of ['single', 'multi_axis'] as const) {
    rows.push(candidate(`evaluator:evaluatorMode:${evaluatorMode}`, 'evaluator_mode', {
      precisionConfig: { evaluatorMode, surfaceNamingScoreVector: true },
    }, { evaluatorMode }));
  }
  rows.push(candidate('evaluator:unknownHourGuard:false', 'evaluator_mode', {
    precisionConfig: { unknownHourGuard: false, surfaceNamingScoreVector: true },
  }, { unknownHourGuard: false }));
  for (const unknownTimeSajuDamp of [0.35, 0.5, 0.65] as const) {
    rows.push(candidate(`evaluator:unknownHourGuard:true:damp:${unknownTimeSajuDamp}`, 'evaluator_mode', {
      precisionConfig: {
        unknownHourGuard: true,
        unknownTimeSajuDamp,
        surfaceNamingScoreVector: true,
      },
    }, { unknownHourGuard: true, unknownTimeSajuDamp }));
  }

  return rows;
}

function tierRank(tier: string): number | null {
  const match = tier.match(/^T([0-5])_/);
  return match ? Number(match[1]) : null;
}

function objectiveWeightForTier(tier: string): number {
  if (tier in OBJECTIVE_TIER_WEIGHTS) {
    return OBJECTIVE_TIER_WEIGHTS[tier as keyof typeof OBJECTIVE_TIER_WEIGHTS];
  }
  if (/^T5_/.test(tier)) return OBJECTIVE_TIER_WEIGHTS.T5_OFFICIAL;
  if (/^T4_/.test(tier)) return OBJECTIVE_TIER_WEIGHTS.T4_PRIMARY_TEXT;
  if (/^T3_/.test(tier)) return OBJECTIVE_TIER_WEIGHTS.T3_AUTHORED_INTERPRETATION;
  return 0;
}

function roundScorePair(score: ScorePair): ScorePair {
  return {
    total: Number(score.total.toFixed(4)),
    saju: Number(score.saju.toFixed(4)),
  };
}

function scoreDelta(after: ScorePair, before: ScorePair): ScorePair {
  return {
    total: Number((after.total - before.total).toFixed(4)),
    saju: Number((after.saju - before.saju).toFixed(4)),
  };
}

function average(rows: readonly number[]): number | null {
  if (rows.length === 0) return null;
  return Number((rows.reduce((sum, value) => sum + value, 0) / rows.length).toFixed(4));
}

function sourceProfiles(metric: BySourceTierMetric): Record<string, SourceProfile> {
  return Object.fromEntries((metric.schoolPresetBreakdown?.rows ?? []).map((row) => [
    row.fixtureId,
    {
      referenceTier: row.referenceTier,
      referenceKind: row.referenceKind,
      sourceType: row.sourceType,
      truthBucket: row.truthBucket,
      authorityTruthEligible: row.authorityTruthEligible,
    },
  ]));
}

function fallbackSourceProfile(metric: BySourceTierMetric): SourceProfile {
  const tiers = Object.entries(metric.qualityGateByReferenceTier ?? {});
  const [tier] = tiers.find(([, bucket]) => (bucket.fixtureCount ?? 0) > 0) ?? ['NO_REFERENCE'];
  return {
    referenceTier: tier,
    referenceKind: tier === 'NO_REFERENCE' ? 'none' : 'unknown',
    sourceType: 'unknown',
    truthBucket: 'insufficient_source_truth',
    authorityTruthEligible: false,
  };
}

async function scoreFixture(
  engine: SpringEngine,
  fixture: BaselineFixture,
  options: SpringOptions | undefined,
): Promise<ScorePair> {
  const result = await engine.analyze({
    birth: fixture.birth,
    surname: [...fixture.surname],
    givenName: [...fixture.givenName],
    mode: 'evaluate',
    options,
  });
  const candidateResult = result.candidates[0];
  return {
    total: candidateResult.scores.total,
    saju: candidateResult.scores.saju,
  };
}

function summarizeCandidate(
  gridPoint: CalibrationCandidate,
  fixtureRows: any[],
  hasEnoughAuthorityTruth: boolean,
): any {
  const deltas = fixtureRows.map((row) => row.deltaVsDefault);
  const byReferenceTier: Record<string, any> = {};
  const bySourceGroup: Record<string, any> = {};
  for (const row of fixtureRows) {
    const tierBucket = byReferenceTier[row.referenceTier] ?? {
      fixtureCount: 0,
      objectiveFixtureCount: 0,
      changedFromDefault: 0,
      unchangedFromDefault: 0,
      objectiveWeight: objectiveWeightForTier(row.referenceTier),
      includedInObjective: false,
    };
    tierBucket.fixtureCount += 1;
    if (row.includedInObjective) {
      tierBucket.objectiveFixtureCount += 1;
      tierBucket.includedInObjective = true;
    }
    if (row.changedFromDefault) tierBucket.changedFromDefault += 1;
    else tierBucket.unchangedFromDefault += 1;
    byReferenceTier[row.referenceTier] = tierBucket;

    const sourceBucket = bySourceGroup[row.sourceType] ?? {
      fixtureCount: 0,
      objectiveFixtureCount: 0,
      changedFromDefault: 0,
      unchangedFromDefault: 0,
    };
    sourceBucket.fixtureCount += 1;
    if (row.includedInObjective) sourceBucket.objectiveFixtureCount += 1;
    if (row.changedFromDefault) sourceBucket.changedFromDefault += 1;
    else sourceBucket.unchangedFromDefault += 1;
    bySourceGroup[row.sourceType] = sourceBucket;
  }

  const eligibleObjectiveFixtureCount = fixtureRows.filter((row) => row.includedInObjective).length;
  const lowTierExcludedFixtureCount = fixtureRows
    .filter((row) => objectiveWeightForTier(row.referenceTier) === 0)
    .length;
  const excludedNonAuthorityFixtureCount = fixtureRows
    .filter((row) => !row.includedInObjective)
    .length;
  const weightedChangePenalty = fixtureRows.reduce((sum, row) => {
    if (!row.includedInObjective) return sum;
    return sum + objectiveWeightForTier(row.referenceTier) * Math.abs(row.deltaVsDefault.saju);
  }, 0);
  const objectiveScore = hasEnoughAuthorityTruth ? Number((-weightedChangePenalty).toFixed(4)) : null;

  return {
    ...gridPoint,
    metrics: {
      fixtureCount: fixtureRows.length,
      changedFromDefault: fixtureRows.filter((row) => row.changedFromDefault).length,
      unchangedFromDefault: fixtureRows.filter((row) => !row.changedFromDefault).length,
      averageTotalDelta: average(deltas.map((delta) => delta.total)),
      averageSajuDelta: average(deltas.map((delta) => delta.saju)),
      minTotalDelta: Math.min(...deltas.map((delta) => delta.total)),
      maxTotalDelta: Math.max(...deltas.map((delta) => delta.total)),
      minSajuDelta: Math.min(...deltas.map((delta) => delta.saju)),
      maxSajuDelta: Math.max(...deltas.map((delta) => delta.saju)),
    },
    objective: {
      eligibleObjectiveFixtureCount,
      lowTierExcludedFixtureCount,
      excludedNonAuthorityFixtureCount,
      weightedChangePenalty: Number(weightedChangePenalty.toFixed(4)),
      objectiveScore,
      promotionEligible: hasEnoughAuthorityTruth && objectiveScore !== null,
      rejectionReason: hasEnoughAuthorityTruth
        ? null
        : 'insufficient T5/T4/reviewed-T3 scorable objective; low-tier fixtures cannot promote weights',
    },
    byReferenceTier,
    bySourceGroup,
    rows: fixtureRows,
  };
}

function selectCandidate(rows: any[]): any {
  const eligibleRows = rows.filter((row) => row.objective.promotionEligible);
  if (eligibleRows.length === 0) {
    return {
      candidateId: 'current_default',
      decision: 'keep_current_default',
      reason: 'No non-default candidate is promotion-eligible without high-tier scorable objective coverage.',
    };
  }
  const [best] = eligibleRows.sort((a, b) =>
    (b.objective.objectiveScore ?? Number.NEGATIVE_INFINITY) -
    (a.objective.objectiveScore ?? Number.NEGATIVE_INFINITY));
  return {
    candidateId: best.candidateId,
    decision: best.candidateKind === 'current_default'
      ? 'keep_current_default'
      : 'candidate_selected_for_human_review',
    reason: 'Highest deterministic source-tier objective score among promotion-eligible grid points.',
  };
}

async function buildReport(metric: BySourceTierMetric): Promise<any> {
  const fixtures = readJson<{ fixtures: BaselineFixture[] }>(FIXTURES_PATH).fixtures;
  const profiles = sourceProfiles(metric);
  const fallbackProfile = fallbackSourceProfile(metric);
  const grid = buildGrid();

  patchFetchForEngine();
  const engine = new SpringEngine();
  const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
  for (const repo of repos) {
    if (!repo) continue;
    (repo as any).wasmUrl = WASM_PATH;
  }
  await engine.init();

  const baselineScores = new Map<string, ScorePair>();
  const candidateRows: any[] = [];
  try {
    for (const fixture of fixtures) {
      baselineScores.set(fixture.id, roundScorePair(await scoreFixture(engine, fixture, undefined)));
    }

    const eligibleObjectiveFixtureCount = fixtures.filter((fixture) => {
      const profile = profiles[fixture.id] ?? fallbackProfile;
      const rank = tierRank(profile.referenceTier);
      return profile.authorityTruthEligible === true &&
        rank !== null &&
        rank >= 3 &&
        objectiveWeightForTier(profile.referenceTier) > 0;
    }).length;
    const hasEnoughAuthorityTruth =
      eligibleObjectiveFixtureCount >= MIN_ELIGIBLE_OBJECTIVE_FIXTURES;

    for (const gridPoint of grid) {
      const fixtureRows = [];
      for (const fixture of fixtures) {
        const profile = profiles[fixture.id] ?? fallbackProfile;
        const baseline = baselineScores.get(fixture.id);
        if (!baseline) throw new Error(`Missing baseline score for ${fixture.id}`);
        const score = gridPoint.candidateKind === 'current_default'
          ? baseline
          : roundScorePair(await scoreFixture(engine, fixture, gridPoint.options));
        const deltaVsDefault = scoreDelta(score, baseline);
        const rank = tierRank(profile.referenceTier);
        const includedInObjective = profile.authorityTruthEligible === true &&
          rank !== null &&
          rank >= 3 &&
          objectiveWeightForTier(profile.referenceTier) > 0;
        fixtureRows.push({
          fixtureId: fixture.id,
          label: fixture.label,
          referenceTier: profile.referenceTier,
          referenceKind: profile.referenceKind,
          sourceType: profile.sourceType,
          truthBucket: profile.truthBucket,
          authorityTruthEligible: profile.authorityTruthEligible,
          includedInObjective,
          baseline,
          score,
          deltaVsDefault,
          changedFromDefault: Math.abs(deltaVsDefault.total) > 1e-9 ||
            Math.abs(deltaVsDefault.saju) > 1e-9,
        });
      }
      candidateRows.push(summarizeCandidate(gridPoint, fixtureRows, hasEnoughAuthorityTruth));
    }
  } finally {
    engine.close();
  }

  const eligibleObjectiveFixtureCount = Math.max(
    ...candidateRows.map((row) => row.objective.eligibleObjectiveFixtureCount),
    0,
  );
  const objectiveStatus = eligibleObjectiveFixtureCount >= MIN_ELIGIBLE_OBJECTIVE_FIXTURES
    ? 'READY'
    : 'INSUFFICIENT_AUTHORITY_TRUTH';

  return {
    schemaVersion: SCHEMA_VERSION,
    artifactKind: 'deterministic_rule_weight_calibration',
    generatedAt: GENERATED_AT,
    inputMetric: 'metrics/bySourceTier.json',
    gridSearchPolicy: {
      gridKind: 'fixed_parameter_grid',
      executionSurface: 'SpringEngine.analyze(mode=evaluate)',
      mlAllowed: false,
      randomSearchAllowed: false,
      fullCartesianSearchAllowed: false,
      runtimeDefaultMutationAllowed: false,
      minimumEligibleObjectiveFixtures: MIN_ELIGIBLE_OBJECTIVE_FIXTURES,
    },
    sourceTierObjective: {
      status: objectiveStatus,
      metric: 'tier-weighted high-authority non-regression over deterministic request-option grid',
      tierWeights: OBJECTIVE_TIER_WEIGHTS,
      authorityTruthPolicy: 'include only sourceTier.authorityTruthEligible=true records with tier rank >= 3',
      lowTierPolicy: 'T2, T1, T0, and NO_REFERENCE have zero objective weight and cannot promote rule weights',
      eligibleObjectiveFixtureCount,
    },
    selected: selectCandidate(candidateRows),
    grid: candidateRows,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const metric = readJson<BySourceTierMetric>(args.metricsPath);
  const report = await buildReport(metric);
  const outPath = path.join(args.outDir, 'deterministic-calibration.json');
  writeJson(outPath, report);
  const summary = {
    outPath,
    schemaVersion: report.schemaVersion,
    selected: report.selected,
    objectiveStatus: report.sourceTierObjective.status,
    gridSize: report.grid.length,
  };
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`Deterministic calibration written to ${outPath}`);
    console.log(`  objective=${summary.objectiveStatus}`);
    console.log(`  selected=${summary.selected.candidateId}`);
    console.log(`  gridSize=${summary.gridSize}`);
  }
}

await main();
