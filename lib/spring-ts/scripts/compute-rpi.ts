/**
 * scripts/compute-rpi.ts
 *
 * Generates the Phase 0 baseline dashboard artifacts without changing the
 * quality gate contract:
 *
 *   metrics/bySourceTier.json
 *   metrics/source-tier-summary.json
 *   metrics/rpi-summary.json
 *
 * Usage:
 *   npx tsx scripts/compute-rpi.ts
 *   npx tsx scripts/compute-rpi.ts --out-dir /tmp/spring-ts-metrics
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  SpringEngine,
  computeTenGodScoreDiagnostics,
  type ElementKey,
  type SajuOutputSummary,
} from '../src/index.js';
import { SCHOOL_PRESET_ORDER, type SchoolPresetName } from '../src/preset-loader.js';
import {
  scoreAccuracyAxisFromDimension,
  scoreAxisFromDimension,
} from './rpi-scoring.js';
import {
  isAuthorityTruthEligible as isAuthorityTruthEligibleByPolicy,
} from '../tools/source_tier_policy.mjs';
import {
  classifyD1TruthCoverage,
} from '../tools/quality-gate/d1.mjs';
import {
  createD1TruthCoverageContract,
} from '../tools/metrics/d1-truth-coverage-contract.mjs';
import { buildRuleModeBreakdown } from './rpi/rule-mode-metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');
const JONGGYEOK_FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/jonggyeok_cases.json');
const JONGGYEOK_AUTHORITY_CASES_PATH = path.resolve(
  SPRING_TS_ROOT,
  'test/fixtures/jonggyeok_authority_cases.json',
);
const SNAPSHOT_PATH = path.resolve(SPRING_TS_ROOT, 'test/baseline/spring_ts_snapshot.json');
const PHASE_P_RESULTS_PATH = path.resolve(SPRING_TS_ROOT, 'test/baseline/PHASE_P_RESULTS.md');
const AUTHORITY_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority');
const ORACLES_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/oracles');
const DATA_SOURCES_DIR = path.resolve(SPRING_TS_ROOT, 'data/sources');
const LEGAL_HANJA_RECONCILIATION_PATH = path.resolve(SPRING_TS_ROOT, 'data/legal-hanja-reconciliation.json');
const LEGAL_HANJA_AUTHORITY_CHECK_PATH = path.resolve(
  SPRING_TS_ROOT,
  'tools/fetch_official_hanja_authority.mjs',
);
const QUALITY_GATE = path.resolve(SPRING_TS_ROOT, 'tools/quality_gate.mjs');

const TIER_NO_REFERENCE = 'NO_REFERENCE';
type Status = 'PASS' | 'FAIL' | 'N/A' | 'NOT_APPLICABLE';
type GateStatus = Status | 'PARTIAL';

interface SourceTier {
  tier?: string;
  sourceType?: string | null;
  sourceUrl?: string | null;
  accessedAt?: string | null;
  quoteShort?: string | null;
  humanInterpretation?: string | null;
  copyrightNote?: string | null;
  authorityTruthEligible?: boolean;
  authorityReview?: {
    status?: string;
    reviewedBy?: string;
    reviewedAt?: string;
  };
}

interface BaselineFixture {
  id: string;
  label: string;
  axis?: string[];
  birth: {
    year: number;
    month: number;
    day: number;
    hour: number | null;
    minute: number;
    gender: 'male' | 'female' | 'neutral';
  };
  surname: Array<{ hangul: string; hanja?: string }>;
  givenName: Array<{ hangul: string; hanja?: string }>;
}

type ScorableFixture = Pick<BaselineFixture, 'id' | 'birth' | 'surname' | 'givenName'> & {
  label?: string;
  expectedJonggyeokType?: string;
};

interface QualityGateFixture {
  fixtureId: string;
  label: string;
  status: GateStatus;
  dimensions: Record<string, { status: Status; reason?: string; failedCount?: number; totalChecks?: number }>;
  measuredCount?: number;
  failedCount?: number;
}

interface QualityGateReport {
  overall: GateStatus;
  sourceTierAudit: {
    status: 'PASS' | 'FAIL';
    scanned: number;
    violations: unknown[];
  };
  totals: { pass: number; fail: number; na: number; total: number };
  dimensions: Record<string, {
    pass: number;
    fail: number;
    na: number;
    notApplicable: number;
    status: GateStatus;
  }>;
  fixtures: QualityGateFixture[];
  generatedAt?: string;
  qualityGateExitCode?: number;
}

type TenGodSyntheticFixtureId = 'monthStem' | 'hourStem' | 'monthHidden' | 'hourHidden';

interface SourceTierRecord {
  file: string;
  sourceTierPath: string;
  sourceId: string | null;
  tier: string;
  tierRank: number | null;
  sourceType: string;
  declaredScopeEligible: boolean;
}

type D1TruthCoverageStatus = 'COMPLETE' | 'PARTIAL' | 'NONE';

interface ReferenceProfile {
  tier: string;
  tierRank: number | null;
  sourceType: string;
  completeD1TruthEligible: boolean;
  doctrineTruthEligible: boolean;
  namingScoreTruthEligible: boolean;
  referenceKind: 'authority' | 'oracle' | 'mixed' | 'none';
  coverageStatus: D1TruthCoverageStatus;
  coveredFieldCount: number;
  missingRequiredFields: readonly string[];
  reason: string;
}


function parseArgs(argv: string[]): { outDir: string; json: boolean } {
  const args = {
    outDir: path.resolve(SPRING_TS_ROOT, 'metrics'),
    json: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--out-dir' && argv[i + 1]) {
      args.outDir = path.resolve(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--json') {
      args.json = true;
    }
  }
  return args;
}

function readJson<T = any>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function toRel(filePath: string): string {
  return path.relative(SPRING_TS_ROOT, filePath).replaceAll(path.sep, '/');
}

function walkJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('_')) {
      out.push(...walkJsonFiles(fullPath));
    }
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(fullPath);
  }
  return out.sort();
}

function parseTierRank(sourceTier: SourceTier | null | undefined): number | null {
  const tier = sourceTier?.tier;
  if (typeof tier !== 'string') return null;
  const match = tier.match(/^T([0-5])_/);
  return match ? Number(match[1]) : null;
}

function sourceTierRecord(
  filePath: string,
  record: any,
  sourceTier: SourceTier | null | undefined,
  sourceTierPath = 'sourceTier',
  sourceId: string | null = null,
): SourceTierRecord {
  return {
    file: toRel(filePath),
    sourceTierPath,
    sourceId,
    tier: sourceTier?.tier ?? 'MISSING_SOURCE_TIER',
    tierRank: parseTierRank(sourceTier),
    sourceType: sourceTier?.sourceType ?? 'unknown',
    declaredScopeEligible: isAuthorityTruthEligibleByPolicy(
      { ...record, sourceTier },
      { root: SPRING_TS_ROOT },
    ),
  };
}

function sourceTierRecordsForFile(filePath: string, data: any): SourceTierRecord[] {
  const topLevelSourceTier = data?.sourceTier ?? data?._meta?.sourceTier;
  const records = [sourceTierRecord(
    filePath,
    data,
    topLevelSourceTier,
    data?.sourceTier ? 'sourceTier' : '_meta.sourceTier',
  )];
  if (Array.isArray(data?.sources)) {
    data.sources.forEach((source: any, index: number) => {
      records.push(sourceTierRecord(
        filePath,
        source,
        source?.sourceTier,
        `sources[${index}].sourceTier`,
        typeof source?.id === 'string' ? source.id : null,
      ));
    });
  }
  if (Array.isArray(data?.snippets)) {
    data.snippets.forEach((snippet: any, index: number) => {
      records.push(sourceTierRecord(
        filePath,
        snippet,
        snippet?.sourceTier,
        `snippets[${index}].sourceTier`,
        typeof snippet?.id === 'string' ? snippet.id : null,
      ));
    });
  }
  if (Array.isArray(data?.cases)) {
    data.cases.forEach((record: any, index: number) => {
      if (!record || typeof record !== 'object' || !('sourceTier' in record)) return;
      records.push(sourceTierRecord(
        filePath,
        record,
        record?.sourceTier,
        `cases[${index}].sourceTier`,
        typeof record?.id === 'string' ? record.id : null,
      ));
    });
  }
  return records;
}

function sourceTierRecordLabel(record: SourceTierRecord): string {
  if (record.sourceTierPath === 'sourceTier') return record.file;
  const idSuffix = record.sourceId ? `:${record.sourceId}` : '';
  return `${record.file}#${record.sourceTierPath}${idSuffix}`;
}

function increment(bucket: Record<string, number>, key: string, n = 1): void {
  bucket[key] = (bucket[key] ?? 0) + n;
}

function emptyStatusCounts(): Record<Status, number> {
  return { PASS: 0, FAIL: 0, 'N/A': 0, NOT_APPLICABLE: 0 };
}

function scanSourceTiers(): { records: SourceTierRecord[]; byTier: Record<string, any>; bySourceType: Record<string, any> } {
  const files = [
    ...walkJsonFiles(AUTHORITY_DIR),
    ...walkJsonFiles(ORACLES_DIR),
    ...walkJsonFiles(DATA_SOURCES_DIR),
  ];
  if (fs.existsSync(JONGGYEOK_FIXTURES_PATH)) files.push(JONGGYEOK_FIXTURES_PATH);
  if (fs.existsSync(JONGGYEOK_AUTHORITY_CASES_PATH)) {
    files.push(JONGGYEOK_AUTHORITY_CASES_PATH);
  }

  const records = files.flatMap((filePath) => {
    const data = readJson(filePath);
    return sourceTierRecordsForFile(filePath, data);
  });

  const byTier: Record<string, any> = {};
  const bySourceType: Record<string, any> = {};
  for (const record of records) {
    const tierBucket = byTier[record.tier] ?? {
      recordCount: 0,
      declaredScopeEligibleSourceRecordCount: 0,
      declaredScopeIneligibleSourceRecordCount: 0,
      files: [],
    };
    tierBucket.recordCount += 1;
    if (record.declaredScopeEligible) tierBucket.declaredScopeEligibleSourceRecordCount += 1;
    else tierBucket.declaredScopeIneligibleSourceRecordCount += 1;
    tierBucket.files.push(sourceTierRecordLabel(record));
    byTier[record.tier] = tierBucket;

    const typeBucket = bySourceType[record.sourceType] ?? {
      recordCount: 0,
      declaredScopeEligibleSourceRecordCount: 0,
      declaredScopeIneligibleSourceRecordCount: 0,
    };
    typeBucket.recordCount += 1;
    if (record.declaredScopeEligible) typeBucket.declaredScopeEligibleSourceRecordCount += 1;
    else typeBucket.declaredScopeIneligibleSourceRecordCount += 1;
    bySourceType[record.sourceType] = typeBucket;
  }

  return { records, byTier, bySourceType };
}

function runQualityGate(): QualityGateReport {
  const result = spawnSync(process.execPath, [QUALITY_GATE, '--json'], {
    cwd: SPRING_TS_ROOT,
    encoding: 'utf-8',
  });
  if (!result.stdout) {
    throw new Error(`quality_gate.mjs produced no JSON. stderr=${result.stderr}`);
  }
  const report = JSON.parse(result.stdout) as QualityGateReport;
  report.qualityGateExitCode = result.status ?? 0;
  return report;
}

function loadBaselineFixtures(): BaselineFixture[] {
  return readJson<{ fixtures: BaselineFixture[] }>(FIXTURES_PATH).fixtures;
}

function loadDirectAuthority(fixtureId: string): any | null {
  const filePath = path.join(AUTHORITY_DIR, `${fixtureId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath);
}

function loadOracle(fixtureId: string): any | null {
  const filePath = path.join(ORACLES_DIR, `${fixtureId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath);
}

function referenceProfileForFixture(fixtureId: string): ReferenceProfile {
  const authority = loadDirectAuthority(fixtureId);
  const oracle = loadOracle(fixtureId);
  const coverage = classifyD1TruthCoverage(authority, oracle);
  const covered = [...coverage.doctrineFields, ...coverage.namingFields];
  const usedKinds = new Set(covered.map((field: any) => field.source));
  const doctrineEligible = !coverage.missingRequiredFields
    .some((field: string) => field.startsWith('sajuReport.'));
  const namingEligible = !coverage.missingRequiredFields
    .some((field: string) => field.startsWith('namingReport.'));
  const eligible = coverage.complete === true;
  const coverageStatus: D1TruthCoverageStatus = eligible
    ? 'COMPLETE'
    : covered.length > 0 ? 'PARTIAL' : 'NONE';
  const referenceKind = usedKinds.size > 1
    ? 'mixed'
    : usedKinds.has('authority')
      ? 'authority'
      : usedKinds.has('oracle')
        ? 'oracle'
        : authority?.sourceTier
          ? 'authority'
          : oracle?.sourceTier ? 'oracle' : 'none';
  const usedRecords = [
    ...(usedKinds.has('authority') && authority?.sourceTier ? [authority] : []),
    ...(usedKinds.has('oracle') && oracle?.sourceTier ? [oracle] : []),
  ];
  const fallbackRecord = authority?.sourceTier ? authority : oracle?.sourceTier ? oracle : null;
  const weakestRecord = [...usedRecords].sort((left, right) =>
    (parseTierRank(left.sourceTier) ?? Number.POSITIVE_INFINITY) -
    (parseTierRank(right.sourceTier) ?? Number.POSITIVE_INFINITY))[0] ?? fallbackRecord;
  const tier = weakestRecord?.sourceTier?.tier ?? TIER_NO_REFERENCE;
  const tierRank = weakestRecord?.sourceTier ? parseTierRank(weakestRecord.sourceTier) : null;
  const sourceType = referenceKind === 'mixed'
    ? [authority?.sourceTier?.sourceType, oracle?.sourceTier?.sourceType]
      .filter(Boolean).join('+')
    : weakestRecord?.sourceTier?.sourceType ?? 'none';

  return {
    tier,
    tierRank,
    sourceType,
    completeD1TruthEligible: eligible,
    doctrineTruthEligible: doctrineEligible,
    namingScoreTruthEligible: namingEligible,
    referenceKind,
    coverageStatus,
    coveredFieldCount: covered.length,
    missingRequiredFields: [...coverage.missingRequiredFields],
    reason: eligible
      ? 'all seven D1 fields are resolved through scope-eligible references'
      : covered.length > 0
        ? 'scope-eligible references cover only part of the seven-field D1 contract'
        : 'no scope-eligible D1 truth fields are linked to this fixture',
  };
}

function buildQualityByReferenceTier(
  gate: QualityGateReport,
  profiles: ReadonlyMap<string, ReferenceProfile>,
): Record<string, any> {
  const byTier: Record<string, any> = {};
  for (const fixture of gate.fixtures) {
    const profile = profiles.get(fixture.fixtureId);
    if (!profile) throw new Error(`Missing D1 truth profile for fixture ${fixture.fixtureId}`);
    const bucket = byTier[profile.tier] ?? {
      fixtureCount: 0,
      fixtureStatus: emptyStatusCounts(),
      dimensionStatus: {},
      truthBuckets: {
        insufficient_source_truth: 0,
        authority_match: 0,
        engine_rule_failure: 0,
      },
      references: {},
    };

    bucket.fixtureCount += 1;
    bucket.fixtureStatus[fixture.status] += 1;
    increment(bucket.references, profile.referenceKind);

    const d1 = fixture.dimensions?.D1;
    if (d1?.status === 'FAIL' && profile.completeD1TruthEligible) {
      bucket.truthBuckets.engine_rule_failure += 1;
    } else if (d1?.status === 'PASS' && profile.completeD1TruthEligible) {
      bucket.truthBuckets.authority_match += 1;
    } else {
      bucket.truthBuckets.insufficient_source_truth += 1;
    }

    for (const [dimension, result] of Object.entries(fixture.dimensions ?? {})) {
      const dimBucket = bucket.dimensionStatus[dimension] ?? emptyStatusCounts();
      dimBucket[result.status] += 1;
      bucket.dimensionStatus[dimension] = dimBucket;
    }

    byTier[profile.tier] = bucket;
  }
  return byTier;
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

async function scoreFixture(engine: SpringEngine, fixture: ScorableFixture, options: any): Promise<{ total: number; saju: number }> {
  const result = await engine.analyze({
    birth: fixture.birth,
    surname: fixture.surname,
    givenName: fixture.givenName,
    mode: 'evaluate',
    options,
  });
  const candidate = result.candidates[0];
  return {
    total: candidate.scores.total,
    saju: candidate.scores.saju,
  };
}

function roundScorePair(score: { total: number; saju: number }): { total: number; saju: number } {
  return {
    total: Number(score.total.toFixed(4)),
    saju: Number(score.saju.toFixed(4)),
  };
}

function scoreDelta(
  after: { total: number; saju: number },
  before: { total: number; saju: number },
): { total: number; saju: number } {
  return {
    total: Number((after.total - before.total).toFixed(4)),
    saju: Number((after.saju - before.saju).toFixed(4)),
  };
}

function summarizeTenGodRows(rows: any[]): any {
  const v1V2Diverged = rows.filter((row) =>
    Math.abs(row.delta.saju) > 1e-9 || Math.abs(row.delta.total) > 1e-9);
  const simpleVsV1Diverged = rows.filter((row) =>
    Math.abs(row.simpleVsV1Delta.saju) > 1e-9 || Math.abs(row.simpleVsV1Delta.total) > 1e-9);
  return {
    total: rows.length,
    v1V2Diverged: v1V2Diverged.length,
    simpleVsV1Diverged: simpleVsV1Diverged.length,
    totalAbsDelta: {
      saju: Number(rows.reduce((sum, row) => sum + Math.abs(row.delta.saju), 0).toFixed(4)),
      total: Number(rows.reduce((sum, row) => sum + Math.abs(row.delta.total), 0).toFixed(4)),
    },
    rows,
  };
}

async function buildTenGodModeComparison(fixtures: BaselineFixture[]): Promise<any> {
  patchFetchForEngine();
  const engine = new SpringEngine();
  const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
  for (const repo of repos) {
    if (!repo) continue;
    (repo as any).wasmUrl = WASM_PATH;
  }
  await engine.init();

  const compareFixture = async (fixture: ScorableFixture): Promise<any> => {
    const simple = await scoreFixture(engine, fixture, { precisionConfig: { tenGodMode: 'simple_count' } });
    const v1 = await scoreFixture(engine, fixture, { precisionConfig: { tenGodMode: 'positional_weighted' } });
    const v2 = await scoreFixture(engine, fixture, { precisionConfig: { tenGodMode: 'positional_weighted_v2' } });
    return {
      id: fixture.id,
      ...(fixture.label ? { label: fixture.label } : {}),
      ...(fixture.expectedJonggyeokType ? { expectedJonggyeokType: fixture.expectedJonggyeokType } : {}),
      simple: roundScorePair(simple),
      v1: roundScorePair(v1),
      v2: roundScorePair(v2),
      simpleVsV1Delta: scoreDelta(v1, simple),
      delta: scoreDelta(v2, v1),
    };
  };

  try {
    const jonggyeokFixtures = readJson<{ fixtures: ScorableFixture[] }>(JONGGYEOK_FIXTURES_PATH).fixtures;
    const defaultRows: any[] = [];
    for (const fixture of fixtures) defaultRows.push(await compareFixture(fixture));
    const jonggyeokRows: any[] = [];
    for (const fixture of jonggyeokFixtures) jonggyeokRows.push(await compareFixture(fixture));
    return {
      modeA: 'positional_weighted',
      modeB: 'positional_weighted_v2',
      note: 'v2 is opt-in; this artifact compares PR-5.1 default behavior with the PR-5.2 candidate mode.',
      defaultFixtures: summarizeTenGodRows(defaultRows),
      jonggyeokFixtures: summarizeTenGodRows(jonggyeokRows),
    };
  } finally {
    engine.close();
  }
}

function updateSchoolSubBucket(parent: Record<string, any>, key: string, changed: boolean): void {
  const bucket = parent[key] ?? {
    fixtureCount: 0,
    changedFromDefault: 0,
    unchangedFromDefault: 0,
  };
  bucket.fixtureCount += 1;
  if (changed) bucket.changedFromDefault += 1;
  else bucket.unchangedFromDefault += 1;
  parent[key] = bucket;
}

function addSchoolDelta(bucket: any, totalDelta: number, sajuDelta: number, profile: ReferenceProfile): void {
  bucket.fixtureCount += 1;
  bucket.totalDeltaSum += totalDelta;
  bucket.sajuDeltaSum += sajuDelta;
  bucket.minTotalDelta = Math.min(bucket.minTotalDelta, totalDelta);
  bucket.maxTotalDelta = Math.max(bucket.maxTotalDelta, totalDelta);
  bucket.minSajuDelta = Math.min(bucket.minSajuDelta, sajuDelta);
  bucket.maxSajuDelta = Math.max(bucket.maxSajuDelta, sajuDelta);
  const changed = Math.abs(totalDelta) > 1e-9 || Math.abs(sajuDelta) > 1e-9;
  if (changed) bucket.changedFromDefault += 1;
  else bucket.unchangedFromDefault += 1;
  updateSchoolSubBucket(bucket.byReferenceTier, profile.tier, changed);
  updateSchoolSubBucket(bucket.bySourceType, profile.sourceType, changed);
  updateSchoolSubBucket(bucket.byD1TruthCoverageStatus, profile.coverageStatus, changed);
}

function finalizeSchoolBucket(bucket: any): any {
  const fixtureCount = bucket.fixtureCount;
  return {
    fixtureCount,
    changedFromDefault: bucket.changedFromDefault,
    unchangedFromDefault: bucket.unchangedFromDefault,
    averageTotalDelta: fixtureCount > 0 ? Number((bucket.totalDeltaSum / fixtureCount).toFixed(4)) : null,
    averageSajuDelta: fixtureCount > 0 ? Number((bucket.sajuDeltaSum / fixtureCount).toFixed(4)) : null,
    minTotalDelta: Number(bucket.minTotalDelta.toFixed(4)),
    maxTotalDelta: Number(bucket.maxTotalDelta.toFixed(4)),
    minSajuDelta: Number(bucket.minSajuDelta.toFixed(4)),
    maxSajuDelta: Number(bucket.maxSajuDelta.toFixed(4)),
    byReferenceTier: bucket.byReferenceTier,
    bySourceType: bucket.bySourceType,
    byD1TruthCoverageStatus: bucket.byD1TruthCoverageStatus,
  };
}

function hasScorableNameFixtureShape(record: any): boolean {
  return record?.birth &&
    Array.isArray(record?.surname) &&
    Array.isArray(record?.givenName);
}

function buildNameInputShapeCoverage(): any {
  let fullNameInputFixtureCount = 0;
  let incompleteNameInputFixtureCount = 0;
  let pillarOnlyRecordCount = 0;
  let ruleSnippetCollectionCount = 0;

  for (const filePath of walkJsonFiles(AUTHORITY_DIR)) {
    const data = readJson(filePath);
    const records = Array.isArray(data?.cases)
      ? data.cases
      : Array.isArray(data?.fixtures)
        ? data.fixtures
        : [data];

    for (const record of records) {
      if (hasScorableNameFixtureShape(record)) {
        fullNameInputFixtureCount += 1;
      } else {
        incompleteNameInputFixtureCount += 1;
      }
      if (record?.pillars || record?.birth?.year_pillar || record?.birth?.day_pillar) {
        pillarOnlyRecordCount += 1;
      }
    }

    if (Array.isArray(data?.snippets)) {
      ruleSnippetCollectionCount += 1;
    }
  }

  return {
    fullNameInputFixtureCount,
    incompleteNameInputFixtureCount,
    pillarOnlyRecordCount,
    ruleSnippetCollectionCount,
    authorityClaim: false,
    note: 'This is input-shape inventory only; source eligibility and complete D1 truth are reported separately.',
  };
}

async function buildSchoolPresetBreakdown(
  fixtures: BaselineFixture[],
  profiles: ReadonlyMap<string, ReferenceProfile>,
): Promise<any> {
  patchFetchForEngine();
  const engine = new SpringEngine();
  const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
  for (const repo of repos) {
    if (!repo) continue;
    (repo as any).wasmUrl = WASM_PATH;
  }
  await engine.init();

  const presetOptions = Object.fromEntries(
    SCHOOL_PRESET_ORDER.map((preset) => [
      preset,
      { precisionConfig: { useSchoolPreset: true }, schoolPreset: preset },
    ]),
  ) as Record<SchoolPresetName, any>;
  const buckets: Record<string, any> = {};
  for (const preset of Object.keys(presetOptions)) {
    buckets[preset] = {
      fixtureCount: 0,
      changedFromDefault: 0,
      unchangedFromDefault: 0,
      totalDeltaSum: 0,
      sajuDeltaSum: 0,
      minTotalDelta: Number.POSITIVE_INFINITY,
      maxTotalDelta: Number.NEGATIVE_INFINITY,
      minSajuDelta: Number.POSITIVE_INFINITY,
      maxSajuDelta: Number.NEGATIVE_INFINITY,
      byReferenceTier: {},
      bySourceType: {},
      byD1TruthCoverageStatus: {},
    };
  }

  const rows: any[] = [];
  try {
    for (const fixture of fixtures) {
      const baseline = await scoreFixture(engine, fixture, undefined);
      const profile = profiles.get(fixture.id);
      if (!profile) throw new Error(`Missing D1 truth profile for fixture ${fixture.id}`);
      const scores: Record<string, { total: number; saju: number }> = {
        default: roundScorePair(baseline),
      };
      const deltaVsDefault: Record<string, { total: number; saju: number }> = {};
      for (const [preset, options] of Object.entries(presetOptions)) {
        const scored = await scoreFixture(engine, fixture, options);
        scores[preset] = roundScorePair(scored);
        deltaVsDefault[preset] = scoreDelta(scored, baseline);
        addSchoolDelta(
          buckets[preset],
          scored.total - baseline.total,
          scored.saju - baseline.saju,
          profile,
        );
      }
      rows.push({
        fixtureId: fixture.id,
        label: fixture.label,
        referenceTier: profile.tier,
        referenceKind: profile.referenceKind,
        sourceType: profile.sourceType,
        scores,
        deltaVsDefault,
      });
    }
  } finally {
    engine.close();
  }

  const presets: Record<string, any> = {};
  for (const [preset, bucket] of Object.entries(buckets)) {
    presets[preset] = finalizeSchoolBucket(bucket);
  }
  return {
    metric: 'runtime score delta against default mode; this is not authority accuracy',
    comparisonBasis: 'scorable baseline fixtures only',
    presetOrder: SCHOOL_PRESET_ORDER,
    presets,
    rows,
    nameInputShapeCoverage: buildNameInputShapeCoverage(),
  };
}

function buildD1TruthCoverage(
  fixtures: readonly BaselineFixture[],
  profiles: ReadonlyMap<string, ReferenceProfile>,
): any {
  const rows = fixtures.map((fixture) => {
    const profile = profiles.get(fixture.id);
    if (!profile) throw new Error(`Missing D1 truth profile for fixture ${fixture.id}`);
    return {
      fixtureId: fixture.id,
      referenceTier: profile.tier,
      referenceKind: profile.referenceKind,
      sourceType: profile.sourceType,
      coverageStatus: profile.coverageStatus,
      coveredFieldCount: profile.coveredFieldCount,
      missingRequiredFields: [...profile.missingRequiredFields],
      doctrineComplete: profile.doctrineTruthEligible,
      namingCalibrationComplete: profile.namingScoreTruthEligible,
    };
  });
  return createD1TruthCoverageContract(rows, {
    expectedFixtureCount: fixtures.length,
    expectedFixtureIds: fixtures.map((fixture) => fixture.id),
  });
}

function scoreLegalHanjaAxis(): any {
  if (!fs.existsSync(LEGAL_HANJA_RECONCILIATION_PATH)) {
    return {
      maxPoints: 15,
      score: 0,
      status: 'NOT_MEASURED',
      reason: 'Legal hanja reconciliation is scheduled for Phase 2.',
    };
  }
  const reconciliation = readJson(LEGAL_HANJA_RECONCILIATION_PATH);
  const policy = reconciliation.legalStatusPolicy ?? {};
  const hasRequiredStatuses = ['allowed', 'variantAllowed', 'hangulOnly', 'unknown']
    .every((status) => typeof policy[status] === 'string');
  const announcedCharacterCount = reconciliation.officialBasis?.announcedCharacterCount;
  const officialLookupGlyphCount = reconciliation.officialBasis?.lookupGlyphRepresentationCount;
  const officialLookupPairCount = reconciliation.officialBasis?.lookupNonEmptyDesignatedReadingPairCount;
  const candidateCount = reconciliation.candidateMirror?.totalCount;
  const localGlyphDifferenceCount = reconciliation.reconciliation?.localGlyphDifferenceCount;
  const localPairDifferenceCount = reconciliation.reconciliation?.localPairDifferenceCount;
  const authorityReceipt = reconciliation.officialBasis?.authorityReceipt;
  const canonicalAppendix2MappingStatus =
    reconciliation.reconciliation?.canonicalAppendix2MappingStatus;
  const receiptCheck = spawnSync(
    process.execPath,
    [LEGAL_HANJA_AUTHORITY_CHECK_PATH, '--check'],
    { cwd: SPRING_TS_ROOT, encoding: 'utf8', windowsHide: true },
  );
  const receiptVerified = receiptCheck.status === 0;
  const parityConfirmed = hasRequiredStatuses
    && announcedCharacterCount === 9389
    && officialLookupGlyphCount === 9495
    && officialLookupPairCount === 10381
    && candidateCount === 9495
    && localGlyphDifferenceCount === 0
    && localPairDifferenceCount === 0
    && authorityReceipt === 'data/official-hanja-lookup-authority.generated.json'
    && receiptVerified
    && reconciliation.reconciliation?.status === 'OFFICIAL_LOOKUP_PARITY_CONFIRMED';
  return {
    maxPoints: 15,
    // Raw lookup eligibility is authority-pinned, but the current Appendix 2
    // canonical variant map remains independently unextracted. Keep this axis
    // partial until that separate authority contract is also machine-checked.
    score: parityConfirmed ? 10 : 0,
    status: parityConfirmed ? 'OFFICIAL_LOOKUP_PARITY_CONFIRMED' : 'FAIL',
    announcedCharacterCount,
    officialLookupGlyphCount,
    officialLookupPairCount,
    candidateMirrorCount: candidateCount,
    localGlyphDifferenceCount,
    localPairDifferenceCount,
    authorityReceipt,
    receiptVerified,
    canonicalAppendix2MappingStatus,
    requiredStatusesPresent: hasRequiredStatuses,
  };
}

function buildSyntheticTenGodOutput(id: TenGodSyntheticFixtureId): SajuOutputSummary {
  const groupCounts = { friend: 1, output: 4, wealth: 4, authority: 0, resource: 4 };
  const basePosition = () => ({
    cheonganGroup: 'resource',
    jijiPrincipalGroup: 'output',
    hiddenStems: [{ stem: 'MU', element: 'Earth' as ElementKey, ratio: 100, group: 'wealth' }],
  });
  const byPosition = {
    year: basePosition(),
    month: basePosition(),
    day: basePosition(),
    hour: basePosition(),
  };

  if (id === 'monthStem') byPosition.month.cheonganGroup = 'friend';
  if (id === 'hourStem') byPosition.hour.cheonganGroup = 'friend';
  if (id === 'monthHidden') {
    byPosition.month.hiddenStems = [{ stem: 'GAP', element: 'Wood', ratio: 100, group: 'friend' }];
  }
  if (id === 'hourHidden') {
    byPosition.hour.hiddenStems = [{ stem: 'GAP', element: 'Wood', ratio: 100, group: 'friend' }];
  }

  return {
    dayMaster: { element: 'Wood' },
    tenGod: {
      groupCounts,
      byPosition,
    },
  };
}

function buildTenGodPositionWeightingDiagnosis(baselineComparison: any): any {
  const rootWood: Record<ElementKey, number> = { Wood: 1, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  const ids: TenGodSyntheticFixtureId[] = ['monthStem', 'hourStem', 'monthHidden', 'hourHidden'];
  const synthetic = ids.map((id) => {
    const simple = computeTenGodScoreDiagnostics(rootWood, buildSyntheticTenGodOutput(id), 'simple_count');
    const positional = computeTenGodScoreDiagnostics(rootWood, buildSyntheticTenGodOutput(id), 'positional_weighted');
    const positionalV2 = computeTenGodScoreDiagnostics(rootWood, buildSyntheticTenGodOutput(id), 'positional_weighted_v2');
    return {
      id,
      simpleScore: Number(simple.score.toFixed(6)),
      positionalScore: Number(positional.score.toFixed(6)),
      positionalV2Score: Number(positionalV2.score.toFixed(6)),
      weightedGroupCounts: Object.fromEntries(
        Object.entries(positional.groupCounts).map(([group, value]) => [group, Number(value.toFixed(6))]),
      ),
      v2VisibilityCounts: Object.fromEntries(
        Object.entries(positionalV2.visibilityCounts ?? {}).map(([group, value]) => [group, Number(value.toFixed(6))]),
      ),
      v2PresenceCounts: Object.fromEntries(
        Object.entries(positionalV2.presenceCounts ?? {}).map(([group, value]) => [group, Number(value.toFixed(6))]),
      ),
      expectedPresenceByChartShape: positionalV2.expectedPresenceByChartShape == null
        ? null
        : Number(positionalV2.expectedPresenceByChartShape.toFixed(6)),
      meanVisibilityPerPresence: positionalV2.meanVisibilityPerPresence == null
        ? null
        : Number(positionalV2.meanVisibilityPerPresence.toFixed(6)),
      averageCount: Number(positional.averageCount.toFixed(6)),
      deviations: Object.fromEntries(
        Object.entries(positional.deviations).map(([group, value]) => [group, Number(value.toFixed(6))]),
      ),
      contributionCount: positional.positionContributions.length,
    };
  });
  const byId = Object.fromEntries(synthetic.map((row) => [row.id, row])) as Record<TenGodSyntheticFixtureId, typeof synthetic[number]>;

  return {
    metric: 'ten-god positional weighting null-effect diagnosis',
    status: 'MEASURED_OPT_IN_V2',
    score: 0,
    maxPoints: 10,
    observedEngineDivergence: {
      defaultFixtures: {
        diverged: baselineComparison.defaultFixtures.simpleVsV1Diverged,
        total: baselineComparison.defaultFixtures.total,
      },
      jonggyeokFixtures: {
        diverged: baselineComparison.jonggyeokFixtures.simpleVsV1Diverged,
        total: baselineComparison.jonggyeokFixtures.total,
      },
      combined: {
        diverged: baselineComparison.defaultFixtures.simpleVsV1Diverged + baselineComparison.jonggyeokFixtures.simpleVsV1Diverged,
        total: baselineComparison.defaultFixtures.total + baselineComparison.jonggyeokFixtures.total,
      },
      source: 'test/integration/md8-tengod-divergence.test.ts',
    },
    currentMechanism: {
      sourceLayerWeights: {
        cheongan: 4.0,
        jijiPrincipal: 1.8,
        hiddenStemByRank: [1.2, 0.7, 0.45],
      },
      pillarPositionWeights: 'not implemented: year/month/day/hour are currently iterated with equal pillar weight',
      hiddenStemRatioUse: 'ratio only sorts hidden stems before fixed rank weights; it is not multiplied into weight',
      normalization: 'deviation_from_average_count',
      normalizationPoint: 'src/saju-calculator.ts computeTenGodScore: averageCount and per-group deviation',
      downstreamBlendWeight: 0.05,
    },
    syntheticFixtures: {
      note: 'Aggregate groupCounts are held constant while one friend signal moves across source layer and pillar position.',
      simpleCountUniqueScores: new Set(synthetic.map((row) => row.simpleScore)).size,
      sourceLayerDivergence: {
        monthStem: byId.monthStem.positionalScore,
        monthHidden: byId.monthHidden.positionalScore,
        diverges: byId.monthStem.positionalScore !== byId.monthHidden.positionalScore,
      },
      pillarPositionCollapse: {
        monthStemEqualsHourStem: byId.monthStem.positionalScore === byId.hourStem.positionalScore,
        monthHiddenEqualsHourHidden: byId.monthHidden.positionalScore === byId.hourHidden.positionalScore,
      },
      optInV2Divergence: {
        monthStem: byId.monthStem.positionalV2Score,
        hourStem: byId.hourStem.positionalV2Score,
        monthHidden: byId.monthHidden.positionalV2Score,
        hourHidden: byId.hourHidden.positionalV2Score,
        stemPillarDiverges: byId.monthStem.positionalV2Score !== byId.hourStem.positionalV2Score,
        hiddenPillarDiverges: byId.monthHidden.positionalV2Score !== byId.hourHidden.positionalV2Score,
      },
      rows: synthetic,
    },
    baselineComparison,
    nextPrTarget: 'PR-5.3 should surface the ten-god position evidence so users can see which positions drive the score.',
  };
}

function buildRpiSummary(gate: QualityGateReport, sourceSummary: any, bySourceTier: any, tenGodBaselineComparison: any): any {
  const tenGodDiagnosis = buildTenGodPositionWeightingDiagnosis(tenGodBaselineComparison);
  const axisScores = {
    A_calculationAccuracy: scoreAccuracyAxisFromDimension(
      gate,
      'D5',
      15,
      'Edge stability is measured, but no eligible truth exists for calculation accuracy.',
    ),
    B_legalHanjaData: scoreLegalHanjaAxis(),
    C_gyeokgukYongshinRuleQuality: {
      maxPoints: 25,
      score: 0,
      status: 'INSUFFICIENT_TRUTH',
      reason: 'Current baseline fixtures lack the complete scoped doctrine and naming-calibration truth required by D1.',
      insufficientTruthCount: bySourceTier.truthSeparation.insufficientSourceTruthCount,
      engineRuleFailureCount: bySourceTier.truthSeparation.engineRuleFailureCount,
    },
    D_tenGodPositionWeighting: {
      maxPoints: 10,
      score: tenGodDiagnosis.score,
      status: tenGodDiagnosis.status,
      reason: 'positional_weighted_v2 is opt-in and now records presence/visibility deltas against the PR-5.1 default; no authority denominator is promoted yet.',
      observedEngineDivergence: tenGodDiagnosis.observedEngineDivergence,
      syntheticFixtures: tenGodDiagnosis.syntheticFixtures,
      baselineComparison: tenGodDiagnosis.baselineComparison,
      normalizationPoint: tenGodDiagnosis.currentMechanism.normalizationPoint,
      nextPrTarget: tenGodDiagnosis.nextPrTarget,
    },
    E_namingIntegratedScore: {
      maxPoints: 15,
      score: 0,
      status: 'NOT_MEASURED',
      reason: 'Naming score vector and Pareto metrics are scheduled for Phase 6.',
    },
    F_explainabilityUxSurface: scoreAxisFromDimension(gate, 'D3', 10, 'No card-surface fixture denominator available.'),
    G_validationGovernance: {
      maxPoints: 10,
      score: sourceSummary.status === 'PASS' ? 10 : 0,
      status: sourceSummary.status,
      sourceTierScanned: sourceSummary.scanned,
      sourceTierViolations: sourceSummary.violationCount,
    },
  };

  const axes = Object.values(axisScores);
  const rawScore = axes.reduce((sum: number, axis: any) => sum + axis.score, 0);
  const measuredAxes = axes.filter((axis: any) => axis.status !== 'NOT_MEASURED' && axis.status !== 'INSUFFICIENT_TRUTH');
  const measuredMaxPoints = measuredAxes.reduce((sum: number, axis: any) => sum + axis.maxPoints, 0);
  const measuredScore = measuredAxes.reduce((sum: number, axis: any) => sum + axis.score, 0);

  return {
    schemaVersion: 'spring-ts.rpi-summary.v2',
    note: 'Unmeasured or truth-insufficient axes score 0 in rawRpi and are also reported separately to avoid mixing missing truth with engine failure.',
    rawRpi: {
      score: Number(rawScore.toFixed(2)),
      maxPoints: 100,
    },
    measuredOnlyRpi: {
      score: Number(measuredScore.toFixed(2)),
      maxPoints: measuredMaxPoints,
      percent: measuredMaxPoints > 0 ? Number(((measuredScore / measuredMaxPoints) * 100).toFixed(1)) : null,
    },
    axisScores,
    qualityGate: {
      overall: gate.overall,
      totals: gate.totals,
      dimensions: gate.dimensions,
      exitCode: gate.qualityGateExitCode,
    },
    truthSeparation: bySourceTier.truthSeparation,
    tenGodPositionWeighting: tenGodDiagnosis,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const fixtures = loadBaselineFixtures();
  const snapshot = readJson(SNAPSHOT_PATH);
  const gate = runQualityGate();
  const sourceScan = scanSourceTiers();
  const referenceProfiles = new Map(fixtures.map((fixture) => [
    fixture.id,
    referenceProfileForFixture(fixture.id),
  ]));
  if (referenceProfiles.size !== fixtures.length) {
    throw new Error('Baseline fixture IDs must be unique before D1 truth profiling');
  }

  const sourceSummary = {
    schemaVersion: 'spring-ts.source-tier-summary.v2',
    status: gate.sourceTierAudit.status,
    scanned: gate.sourceTierAudit.scanned,
    violationCount: gate.sourceTierAudit.violations.length,
    eligibilityDefinition:
      'source record is eligible for at least one policy-declared authority scope; this is not complete D1 fixture truth',
    declaredScopeEligibleSourceRecordCount: sourceScan.records
      .filter((record) => record.declaredScopeEligible).length,
    declaredScopeIneligibleSourceRecordCount: sourceScan.records
      .filter((record) => !record.declaredScopeEligible).length,
    byTier: sourceScan.byTier,
    bySourceType: sourceScan.bySourceType,
  };

  const qualityGateByReferenceTier = buildQualityByReferenceTier(gate, referenceProfiles);
  const truthSeparation = {
    insufficientSourceTruthCount: Object.values(qualityGateByReferenceTier)
      .reduce((sum: number, bucket: any) => sum + bucket.truthBuckets.insufficient_source_truth, 0),
    authorityMatchCount: Object.values(qualityGateByReferenceTier)
      .reduce((sum: number, bucket: any) => sum + bucket.truthBuckets.authority_match, 0),
    engineRuleFailureCount: Object.values(qualityGateByReferenceTier)
      .reduce((sum: number, bucket: any) => sum + bucket.truthBuckets.engine_rule_failure, 0),
  };

  const bySourceTier = {
    schemaVersion: 'spring-ts.by-source-tier.v2',
    baseline: {
      fixtureCount: fixtures.length,
      snapshotVersion: snapshot.version,
      snapshotTargetDate: snapshot.targetDate,
      snapshotFixtureCount: snapshot.fixtureCount,
    },
    d1TruthCoverage: buildD1TruthCoverage(fixtures, referenceProfiles),
    qualityGateByReferenceTier,
    truthSeparation,
    ruleModeBreakdown: buildRuleModeBreakdown(PHASE_P_RESULTS_PATH),
    schoolPresetBreakdown: await buildSchoolPresetBreakdown(fixtures, referenceProfiles),
  };

  const tenGodBaselineComparison = await buildTenGodModeComparison(fixtures);
  const rpiSummary = buildRpiSummary(gate, sourceSummary, bySourceTier, tenGodBaselineComparison);

  writeJson(path.join(args.outDir, 'bySourceTier.json'), bySourceTier);
  writeJson(path.join(args.outDir, 'source-tier-summary.json'), sourceSummary);
  writeJson(path.join(args.outDir, 'rpi-summary.json'), rpiSummary);

  const result = {
    outDir: args.outDir,
    files: ['bySourceTier.json', 'source-tier-summary.json', 'rpi-summary.json'],
    rawRpi: rpiSummary.rawRpi,
    truthSeparation,
  };
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Baseline metrics written to ${args.outDir}`);
    console.log(`  rawRpi=${result.rawRpi.score}/${result.rawRpi.maxPoints}`);
    console.log(`  insufficientTruth=${truthSeparation.insufficientSourceTruthCount}, engineRuleFailure=${truthSeparation.engineRuleFailureCount}`);
  }
}

await main();
