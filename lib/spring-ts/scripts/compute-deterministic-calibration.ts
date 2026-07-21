/**
 * scripts/compute-deterministic-calibration.ts
 *
 * Phase 8.2 deterministic calibration harness.
 *
 * This is intentionally not ML. It evaluates a fixed request-option grid
 * through SpringEngine, scores only high-tier complete-D1 truth in the
 * objective, and blocks promotion when that denominator is insufficient.
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
import {
  BY_SOURCE_TIER_INPUT_SCHEMA_VERSION,
  validateCompleteD1CalibrationInput,
} from '../tools/metrics/complete-d1-calibration-input.mjs';
import {
  COMPLETE_D1_OBJECTIVE_TIER_WEIGHTS,
  MIN_COMPLETE_D1_OBJECTIVE_FIXTURES,
  completeD1ObjectiveStatusForCount,
  completeD1ObjectiveWeightForTier,
  isIncludedInCompleteD1Objective,
} from '../tools/metrics/complete-d1-objective.mjs';
import { sha256FileDigest } from '../tools/metrics/artifact-digest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');
const FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');

const SCHEMA_VERSION = 'spring-ts.deterministic-calibration.v2';
const GENERATED_AT = '2026-05-02T00:00:00.000Z';

type D1CoverageStatus = 'COMPLETE' | 'PARTIAL' | 'NONE';
type ReferenceKind = 'authority' | 'oracle' | 'mixed' | 'none';

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
  readonly referenceKind: ReferenceKind;
  readonly sourceType: string;
  readonly coverageStatus: D1CoverageStatus;
  readonly coveredFieldCount: number;
  readonly missingRequiredFields: readonly string[];
  readonly doctrineComplete: boolean;
  readonly namingCalibrationComplete: boolean;
}

interface D1TruthCoverageFixture extends SourceProfile {
  readonly fixtureId: string;
}

interface D1TruthCoverageInput {
  readonly schemaVersion: string;
  readonly contract: string;
  readonly requiredFields: readonly string[];
  readonly requiredFieldCount: number;
  readonly fixtureCount: number;
  readonly completeFixtureCount: number;
  readonly partialFixtureCount: number;
  readonly noneFixtureCount: number;
  readonly doctrineCompleteFixtureCount: number;
  readonly namingCalibrationCompleteFixtureCount: number;
  readonly fixtures: readonly D1TruthCoverageFixture[];
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

function objectiveWeightForTier(tier: string): number {
  return completeD1ObjectiveWeightForTier(tier);
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

function sourceProfiles(coverage: D1TruthCoverageInput): Record<string, SourceProfile> {
  return Object.fromEntries(coverage.fixtures.map(({ fixtureId, ...profile }) => [
    fixtureId,
    profile,
  ]));
}

function profileForFixture(
  profiles: Readonly<Record<string, SourceProfile>>,
  fixtureId: string,
): SourceProfile {
  const profile = profiles[fixtureId];
  if (!profile) inputContractError(`missing validated complete-D1 profile for ${fixtureId}`);
  return profile;
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
  hasEnoughCompleteD1Truth: boolean,
): any {
  const deltas = fixtureRows.map((row) => row.deltaVsDefault);
  const byReferenceTier: Record<string, any> = {};
  const bySourceGroup: Record<string, any> = {};
  for (const row of fixtureRows) {
    const tierBucket = byReferenceTier[row.referenceTier] ?? {
      fixtureCount: 0,
      completeD1ObjectiveFixtureCount: 0,
      changedFromDefault: 0,
      unchangedFromDefault: 0,
      objectiveWeight: objectiveWeightForTier(row.referenceTier),
      includedInCompleteD1Objective: false,
    };
    tierBucket.fixtureCount += 1;
    if (row.includedInCompleteD1Objective) {
      tierBucket.completeD1ObjectiveFixtureCount += 1;
      tierBucket.includedInCompleteD1Objective = true;
    }
    if (row.changedFromDefault) tierBucket.changedFromDefault += 1;
    else tierBucket.unchangedFromDefault += 1;
    byReferenceTier[row.referenceTier] = tierBucket;

    const sourceBucket = bySourceGroup[row.sourceType] ?? {
      fixtureCount: 0,
      completeD1ObjectiveFixtureCount: 0,
      changedFromDefault: 0,
      unchangedFromDefault: 0,
    };
    sourceBucket.fixtureCount += 1;
    if (row.includedInCompleteD1Objective) {
      sourceBucket.completeD1ObjectiveFixtureCount += 1;
    }
    if (row.changedFromDefault) sourceBucket.changedFromDefault += 1;
    else sourceBucket.unchangedFromDefault += 1;
    bySourceGroup[row.sourceType] = sourceBucket;
  }

  const completeD1ObjectiveFixtureCount = fixtureRows
    .filter((row) => row.includedInCompleteD1Objective).length;
  const lowTierExcludedFixtureCount = fixtureRows
    .filter((row) => objectiveWeightForTier(row.referenceTier) === 0)
    .length;
  const excludedFromCompleteD1ObjectiveFixtureCount = fixtureRows
    .filter((row) => !row.includedInCompleteD1Objective)
    .length;
  const weightedChangePenalty = fixtureRows.reduce((sum, row) => {
    if (!row.includedInCompleteD1Objective) return sum;
    return sum + objectiveWeightForTier(row.referenceTier) * Math.abs(row.deltaVsDefault.saju);
  }, 0);
  const objectiveScore = hasEnoughCompleteD1Truth
    ? Number((-weightedChangePenalty).toFixed(4))
    : null;

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
      completeD1ObjectiveFixtureCount,
      lowTierExcludedFixtureCount,
      excludedFromCompleteD1ObjectiveFixtureCount,
      weightedChangePenalty: Number(weightedChangePenalty.toFixed(4)),
      objectiveScore,
      promotionEligible: hasEnoughCompleteD1Truth && objectiveScore !== null,
      rejectionReason: hasEnoughCompleteD1Truth
        ? null
        : 'insufficient T3+ complete-D1 objective; partial, none, and low-tier fixtures cannot promote weights',
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
      reason: 'No non-default candidate is promotion-eligible without enough T3+ complete-D1 objective fixtures.',
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

async function buildReport(metric: unknown, inputMetricDigest: string): Promise<any> {
  const fixtures = readJson<{ fixtures: BaselineFixture[] }>(FIXTURES_PATH).fixtures;
  const coverage = validateCompleteD1CalibrationInput(metric, {
    expectedFixtureIds: fixtures.map((fixture) => fixture.id),
  }) as D1TruthCoverageInput;
  const profiles = sourceProfiles(coverage);
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

    const completeD1ObjectiveFixtureCount = fixtures.filter((fixture) => {
      const profile = profileForFixture(profiles, fixture.id);
      return isIncludedInCompleteD1Objective(profile);
    }).length;
    const hasEnoughCompleteD1Truth =
      completeD1ObjectiveFixtureCount >= MIN_COMPLETE_D1_OBJECTIVE_FIXTURES;

    for (const gridPoint of grid) {
      const fixtureRows = [];
      for (const fixture of fixtures) {
        const profile = profileForFixture(profiles, fixture.id);
        const baseline = baselineScores.get(fixture.id);
        if (!baseline) throw new Error(`Missing baseline score for ${fixture.id}`);
        const score = gridPoint.candidateKind === 'current_default'
          ? baseline
          : roundScorePair(await scoreFixture(engine, fixture, gridPoint.options));
        const deltaVsDefault = scoreDelta(score, baseline);
        const includedInCompleteD1Objective =
          isIncludedInCompleteD1Objective(profile);
        fixtureRows.push({
          fixtureId: fixture.id,
          label: fixture.label,
          referenceTier: profile.referenceTier,
          referenceKind: profile.referenceKind,
          sourceType: profile.sourceType,
          coverageStatus: profile.coverageStatus,
          coveredFieldCount: profile.coveredFieldCount,
          missingRequiredFields: profile.missingRequiredFields,
          doctrineComplete: profile.doctrineComplete,
          namingCalibrationComplete: profile.namingCalibrationComplete,
          includedInCompleteD1Objective,
          baseline,
          score,
          deltaVsDefault,
          changedFromDefault: Math.abs(deltaVsDefault.total) > 1e-9 ||
            Math.abs(deltaVsDefault.saju) > 1e-9,
        });
      }
      candidateRows.push(summarizeCandidate(
        gridPoint,
        fixtureRows,
        hasEnoughCompleteD1Truth,
      ));
    }
  } finally {
    engine.close();
  }

  const completeD1ObjectiveFixtureCount = Math.max(
    ...candidateRows.map((row) => row.objective.completeD1ObjectiveFixtureCount),
    0,
  );
  const completeD1ObjectiveStatus =
    completeD1ObjectiveStatusForCount(completeD1ObjectiveFixtureCount);

  return {
    schemaVersion: SCHEMA_VERSION,
    artifactKind: 'deterministic_rule_weight_calibration',
    generatedAt: GENERATED_AT,
    inputMetric: 'metrics/bySourceTier.json#d1TruthCoverage.fixtures',
    inputSchemaVersion: BY_SOURCE_TIER_INPUT_SCHEMA_VERSION,
    inputMetricDigest,
    gridSearchPolicy: {
      gridKind: 'fixed_parameter_grid',
      executionSurface: 'SpringEngine.analyze(mode=evaluate)',
      mlAllowed: false,
      randomSearchAllowed: false,
      fullCartesianSearchAllowed: false,
      runtimeDefaultMutationAllowed: false,
      minimumCompleteD1ObjectiveFixtures: MIN_COMPLETE_D1_OBJECTIVE_FIXTURES,
    },
    sourceTierObjective: {
      completeD1ObjectiveStatus,
      metric: 'tier-weighted complete-D1 non-regression over deterministic request-option grid',
      tierWeights: COMPLETE_D1_OBJECTIVE_TIER_WEIGHTS,
      completeD1TruthPolicy: 'include only COMPLETE seven-field D1 fixtures with effective source tier rank >= 3',
      lowTierPolicy: 'T2, T1, T0, and NO_REFERENCE have zero objective weight and cannot promote rule weights',
      completeD1ObjectiveFixtureCount,
    },
    selected: selectCandidate(candidateRows),
    grid: candidateRows,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const metric = readJson<unknown>(args.metricsPath);
  const report = await buildReport(metric, sha256FileDigest(args.metricsPath));
  const outPath = path.join(args.outDir, 'deterministic-calibration.json');
  writeJson(outPath, report);
  const summary = {
    outPath,
    schemaVersion: report.schemaVersion,
    selected: report.selected,
    completeD1ObjectiveStatus: report.sourceTierObjective.completeD1ObjectiveStatus,
    gridSize: report.grid.length,
  };
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`Deterministic calibration written to ${outPath}`);
    console.log(`  objective=${summary.completeD1ObjectiveStatus}`);
    console.log(`  selected=${summary.selected.candidateId}`);
    console.log(`  gridSize=${summary.gridSize}`);
  }
}

await main();
