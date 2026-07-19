/**
 * Reproducible characterization benchmark for the local mobile contracts.
 *
 * Wall-clock and heap figures are observations, never CI pass thresholds.
 * Stable assertions are limited to payload bytes, result determinism, bounded
 * page cardinality, and the absence of repository reads after warm-up or on a
 * candidate continuation.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  FourframeRepository,
} from '../../seed-ts/src/database/fourframe-repository.js';
import {
  HanjaRepository,
} from '../../seed-ts/src/database/hanja-repository.js';
import {
  createRepositoryRuntime,
  type RepositoryFetch,
  type SqlJsLoader,
} from '../../seed-ts/src/database/repository-runtime.js';
import {
  REPORT_DELIVERY_REQUEST_SCHEMA_V1,
  SpringEngine,
} from '../src/index.js';
import { NameStatSummaryRepository } from '../src/name-stat-summary-repository.js';

type ScenarioId =
  | 'delivery:naming'
  | 'delivery:saju'
  | 'delivery:integrated'
  | 'candidate:one:first-page'
  | 'candidate:two:first-page'
  | 'candidate:one:pagination'
  | 'candidate:two:pagination';

type RunMode = 'cold' | 'warm';

interface AssetObservation {
  calls: number;
  bytes: number;
}

interface Sample {
  readonly scenario: ScenarioId;
  readonly mode: RunMode;
  readonly milliseconds: number;
  readonly payloadBytes: number;
  readonly retainedHeapDeltaBytes: number;
  readonly sampledPeakHeapDeltaBytes: number;
  readonly maxTimerDelayMilliseconds: number;
  readonly eventLoopActiveMilliseconds: number;
  readonly semanticDigest: string;
  readonly returnedCandidates: number | null;
  readonly assetReads: Readonly<Record<string, AssetObservation>>;
  readonly repositoryOperations: Readonly<Record<string, AssetObservation>>;
}

interface WorkerResult {
  readonly scenario: ScenarioId;
  readonly mode: RunMode;
  readonly samples: readonly Sample[];
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = fileURLToPath(import.meta.url);
const NAMESPRING_DATA = path.resolve(ROOT, '../../namespring/public/data');
const SCENARIOS: readonly ScenarioId[] = [
  'delivery:naming',
  'delivery:saju',
  'delivery:integrated',
  'candidate:one:first-page',
  'candidate:two:first-page',
  'candidate:one:pagination',
  'candidate:two:pagination',
];
const DELIVERY_PAYLOAD_BUDGET_BYTES = 256 * 1024;
const CANDIDATE_PAYLOAD_BUDGET_BYTES = 192 * 1024;
const CANDIDATE_PAGE_LIMIT = 20;

const subject = {
  birth: {
    year: 1986,
    month: 4,
    day: 19,
    hour: 5,
    minute: 45,
    gender: 'male' as const,
    region: '서울',
  },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
  targetDate: '2026-07-18',
};
const precision = {
  surfaceNameTrend: true,
  surfacePhoneticEvidence: true,
  surfaceNamingScoreVector: true,
};

function recordAsset(
  observations: Map<string, AssetObservation>,
  name: string,
  bytes: number,
): void {
  const prior = observations.get(name) ?? { calls: 0, bytes: 0 };
  observations.set(name, { calls: prior.calls + 1, bytes: prior.bytes + bytes });
}

function assetSnapshot(
  observations: ReadonlyMap<string, AssetObservation>,
): Readonly<Record<string, AssetObservation>> {
  return Object.fromEntries([...observations.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => [name, { ...value }]));
}

function assetDelta(
  before: Readonly<Record<string, AssetObservation>>,
  after: Readonly<Record<string, AssetObservation>>,
): Readonly<Record<string, AssetObservation>> {
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Object.fromEntries([...names].sort().flatMap((name) => {
    const prior = before[name] ?? { calls: 0, bytes: 0 };
    const current = after[name] ?? { calls: 0, bytes: 0 };
    const value = {
      calls: current.calls - prior.calls,
      bytes: current.bytes - prior.bytes,
    };
    return value.calls === 0 && value.bytes === 0 ? [] : [[name, value]];
  }));
}

function instrumentRepository<T extends object>(
  repository: T,
  observations: Map<string, AssetObservation>,
  prefix: string,
): T {
  return new Proxy(repository, {
    get(target, property, _receiver) {
      const value = Reflect.get(target, property, target) as unknown;
      if (typeof value !== 'function') return value;
      return (...args: readonly unknown[]) => {
        recordAsset(observations, `${prefix}.${String(property)}`, 0);
        return Reflect.apply(value, target, args);
      };
    },
  });
}

function createMeasuredEngine(
  observations: Map<string, AssetObservation>,
  operations: Map<string, AssetObservation>,
): SpringEngine {
  const runtime = createRepositoryRuntime({});
  const initializeSqlJs: SqlJsLoader = async (url, expectedSha256, options) => {
    recordAsset(observations, 'sql-js-initialize-call', 0);
    return runtime.initializeSqlJs(url, expectedSha256, options);
  };
  const localDatabaseFetch: RepositoryFetch = async (url, options) => {
    const file = new URL(url);
    if (file.protocol !== 'file:') {
      throw new Error(`Mobile benchmark forbids non-file repository reads: ${url}`);
    }
    const bytes = await fs.promises.readFile(file, options?.signal
      ? { signal: options.signal }
      : undefined);
    recordAsset(observations, path.basename(file.pathname), bytes.byteLength);
    const stable = Uint8Array.from(bytes);
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => stable.slice().buffer,
    };
  };
  const nameStat = new NameStatSummaryRepository({
    runtime: {
      readAsset: async (url, signal) => {
        if (url.protocol !== 'file:') {
          throw new Error(`Mobile benchmark forbids non-file NameStat reads: ${url.href}`);
        }
        const bytes = await fs.promises.readFile(url, { signal });
        recordAsset(observations, 'name-stat-summary.v1.bin', bytes.byteLength);
        return Uint8Array.from(bytes);
      },
    },
  });
  const hanja = instrumentRepository(new HanjaRepository({
    dbUrl: pathToFileURL(path.join(NAMESPRING_DATA, 'hanja.db')).href,
    fetch: localDatabaseFetch,
    initializeSqlJs,
  }), operations, 'hanja');
  const fourFrame = instrumentRepository(new FourframeRepository({
    dbUrl: pathToFileURL(path.join(NAMESPRING_DATA, 'fourframe.db')).href,
    fetch: localDatabaseFetch,
    initializeSqlJs,
  }), operations, 'fourframe');
  return new SpringEngine({
    repositories: {
      hanja,
      fourFrame,
      nameStat: instrumentRepository(nameStat, operations, 'nameStat'),
    },
  });
}

function deliveryRequest(scenario: Extract<ScenarioId, `delivery:${string}`>) {
  if (scenario === 'delivery:naming') {
    return {
      ...subject,
      options: { precisionConfig: precision },
      delivery: {
        schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
        surfaces: [{ id: 'naming' as const, depth: 'standard' as const }],
      },
    };
  }
  if (scenario === 'delivery:saju') {
    return {
      ...subject,
      delivery: {
        schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
        surfaces: [{
          id: 'saju' as const,
          depth: 'brief' as const,
          timeline: { periods: ['today' as const], categories: ['overall' as const] },
        }],
      },
    };
  }
  return {
    ...subject,
    options: { precisionConfig: precision },
    delivery: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{
        id: 'integrated' as const,
        depth: 'standard' as const,
        timeline: {
          periods: ['today' as const],
          categories: ['overall', 'wealth', 'health', 'academic', 'romance', 'family'] as const,
        },
      }],
    },
  };
}

function candidateRequest(length: 1 | 2, offset = 0, limit = CANDIDATE_PAGE_LIMIT) {
  return {
    birth: subject.birth,
    surname: subject.surname,
    givenNameLength: length,
    mode: 'recommend' as const,
    options: {
      offset,
      limit,
      pureHangulNameMode: 'off' as const,
      precisionConfig: {
        // This is the only expensive display projection requested by the V2
        // candidate screen. Benchmark the real mobile path, not a cheaper
        // internal candidate shape that the product never renders.
        surfaceNamingScoreVector: true,
      },
      sajuTimePolicy: {
        trueSolarTime: 'on' as const,
        longitudeCorrection: 'on' as const,
        longitudeReference: 'civilOffsetMeridian' as const,
        yaza: 'on' as const,
        yazaMode: '23:00' as const,
      },
    },
  };
}

function candidateLength(scenario: ScenarioId): 1 | 2 {
  return scenario.includes(':one:') ? 1 : 2;
}

interface ScenarioState {
  queryId?: string;
}

async function executeScenario(
  engine: SpringEngine,
  scenario: ScenarioId,
  state: ScenarioState,
): Promise<unknown> {
  if (scenario.startsWith('delivery:')) {
    return engine.getReportDelivery(deliveryRequest(
      scenario as Extract<ScenarioId, `delivery:${string}`>,
    ));
  }
  const length = candidateLength(scenario);
  if (scenario.endsWith(':pagination')) {
    assert.ok(state.queryId, 'pagination measurement requires a primed queryId');
    return engine.getCandidateSearch(
      candidateRequest(length, 1, 1),
      { queryId: state.queryId },
    );
  }
  return engine.getCandidateSearch(candidateRequest(length));
}

async function primeScenario(
  engine: SpringEngine,
  scenario: ScenarioId,
  state: ScenarioState,
): Promise<void> {
  if (scenario.endsWith(':pagination')) {
    const first = await engine.getCandidateSearch(candidateRequest(candidateLength(scenario), 0, 1));
    assert.ok(first.items.length > 0, `${scenario} requires at least one candidate`);
    state.queryId = first.query.queryId;
    return;
  }
  await executeScenario(engine, scenario, state);
}

function semanticProjection(scenario: ScenarioId, value: unknown): unknown {
  const projected = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  if (scenario.startsWith('delivery:')) {
    delete projected.analysisId;
    delete projected.generatedAt;
  } else if (projected.query && typeof projected.query === 'object') {
    delete (projected.query as Record<string, unknown>).queryId;
  }
  return projected;
}

function semanticDigest(scenario: ScenarioId, value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(semanticProjection(scenario, value)), 'utf8')
    .digest('hex');
}

function returnedCandidates(value: unknown): number | null {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { items?: unknown }).items)) {
    return null;
  }
  return (value as { items: readonly unknown[] }).items.length;
}

function collectGarbage(): void {
  (globalThis as typeof globalThis & { gc?: () => void }).gc?.();
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function measure(
  scenario: ScenarioId,
  mode: RunMode,
  observations: Map<string, AssetObservation>,
  operations: Map<string, AssetObservation>,
  work: () => Promise<unknown>,
): Promise<Sample> {
  collectGarbage();
  await delay(3);
  collectGarbage();
  const heapBefore = process.memoryUsage().heapUsed;
  let sampledPeakHeap = heapBefore;
  let lastTimer = performance.now();
  let maxTimerGap = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    maxTimerGap = Math.max(maxTimerGap, now - lastTimer);
    lastTimer = now;
    sampledPeakHeap = Math.max(sampledPeakHeap, process.memoryUsage().heapUsed);
  }, 1);
  await delay(3);
  maxTimerGap = 0;
  lastTimer = performance.now();
  const assetsBefore = assetSnapshot(observations);
  const operationsBefore = assetSnapshot(operations);
  const eventLoopBefore = performance.eventLoopUtilization();
  const started = performance.now();
  const value = await work();
  const milliseconds = performance.now() - started;
  sampledPeakHeap = Math.max(sampledPeakHeap, process.memoryUsage().heapUsed);
  await delay(3);
  clearInterval(timer);
  const eventLoop = performance.eventLoopUtilization(eventLoopBefore);
  const assetsAfter = assetSnapshot(observations);
  const operationsAfter = assetSnapshot(operations);
  collectGarbage();
  const heapAfter = process.memoryUsage().heapUsed;
  const payloadBytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  const count = returnedCandidates(value);

  if (scenario.startsWith('delivery:')) {
    assert.ok(payloadBytes <= DELIVERY_PAYLOAD_BUDGET_BYTES,
      `${scenario} exceeds the ${DELIVERY_PAYLOAD_BUDGET_BYTES}-byte delivery budget`);
  } else {
    assert.ok(payloadBytes <= CANDIDATE_PAYLOAD_BUDGET_BYTES,
      `${scenario} exceeds the ${CANDIDATE_PAYLOAD_BUDGET_BYTES}-byte candidate-page budget`);
    assert.ok(count !== null && count <= CANDIDATE_PAGE_LIMIT,
      `${scenario} returned an unbounded candidate page`);
  }

  return {
    scenario,
    mode,
    milliseconds,
    payloadBytes,
    retainedHeapDeltaBytes: heapAfter - heapBefore,
    sampledPeakHeapDeltaBytes: Math.max(0, sampledPeakHeap - heapBefore),
    maxTimerDelayMilliseconds: Math.max(0, maxTimerGap - 1),
    eventLoopActiveMilliseconds: eventLoop.active,
    semanticDigest: semanticDigest(scenario, value),
    returnedCandidates: count,
    assetReads: assetDelta(assetsBefore, assetsAfter),
    repositoryOperations: assetDelta(operationsBefore, operationsAfter),
  };
}

function assertNoMeasuredAssetReads(sample: Sample, message: string): void {
  assert.deepEqual(sample.assetReads, {}, message);
}

async function runWorker(
  scenario: ScenarioId,
  mode: RunMode,
  runs: number,
): Promise<WorkerResult> {
  const observations = new Map<string, AssetObservation>();
  const operations = new Map<string, AssetObservation>();
  const engine = createMeasuredEngine(observations, operations);
  const state: ScenarioState = {};
  try {
    if (mode === 'warm' || scenario.endsWith(':pagination')) {
      await primeScenario(engine, scenario, state);
    }
    const samples: Sample[] = [];
    for (let index = 0; index < runs; index += 1) {
      const sample = await measure(scenario, mode, observations, operations, () =>
        executeScenario(engine, scenario, state));
      if (mode === 'warm' || scenario.endsWith(':pagination')) {
        assertNoMeasuredAssetReads(
          sample,
          `${scenario} must reuse warmed repositories and candidate snapshots`,
        );
      }
      if (scenario === 'delivery:saju') {
        assertNoMeasuredAssetReads(sample, 'saju-only delivery must not read naming repositories');
      }
      if (scenario.endsWith(':pagination')) {
        assert.deepEqual(sample.repositoryOperations, {},
          'candidate continuation must not query or recompute repositories');
      }
      if (mode === 'warm' && scenario.endsWith(':first-page')) {
        assert.deepEqual(sample.repositoryOperations, {},
          'a repeated candidate first page must reuse its bounded engine-session snapshot');
      }
      const nameStatLookups = sample.repositoryOperations['nameStat.findByName']?.calls ?? 0;
      assert.ok(nameStatLookups <= 50_000, 'candidate lookup operations exceeded the engine bound');
      samples.push(sample);
    }
    assert.equal(new Set(samples.map((sample) => sample.semanticDigest)).size, 1,
      `${scenario} semantic output changed across repeated ${mode} runs`);
    return { scenario, mode, samples };
  } finally {
    engine.close();
  }
}

function parsePositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 25) {
    throw new Error(`${name} must be an integer within 1..25.`);
  }
  return parsed;
}

function selectedScenarios(): readonly ScenarioId[] {
  const raw = process.env.MOBILE_BENCH_SCENARIOS;
  if (!raw) return SCENARIOS;
  const requested = raw.split(',').map((value) => value.trim()).filter(Boolean);
  for (const scenario of requested) {
    if (!SCENARIOS.includes(scenario as ScenarioId)) {
      throw new Error(`Unknown MOBILE_BENCH_SCENARIOS entry: ${scenario}`);
    }
  }
  return requested as ScenarioId[];
}

function runChild(scenario: ScenarioId, mode: RunMode, runs: number): WorkerResult {
  const inheritedArgs = process.execArgv.filter((argument) => argument !== '--expose-gc');
  const result = spawnSync(process.execPath, [
    '--expose-gc',
    ...inheritedArgs,
    SCRIPT,
    '--worker',
    scenario,
    mode,
    String(runs),
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `Benchmark worker failed (${scenario}, ${mode}):\n${result.stdout}\n${result.stderr}`,
    );
  }
  const prefix = 'MOBILE_LOCAL_BENCH_RESULT=';
  const line = result.stdout.split(/\r?\n/u).find((entry) => entry.startsWith(prefix));
  if (!line) throw new Error(`Benchmark worker produced no result: ${result.stdout}`);
  return JSON.parse(line.slice(prefix.length)) as WorkerResult;
}

function percentile(values: readonly number[], ratio: number): number {
  assert.ok(values.length > 0);
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(ordered.length * ratio) - 1);
  return ordered[index];
}

function median(values: readonly number[]): number {
  assert.ok(values.length > 0);
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function rounded(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function summarize(samples: readonly Sample[]) {
  const metric = (project: (sample: Sample) => number) => {
    const values = samples.map(project);
    return { median: median(values), p95: percentile(values, 0.95) };
  };
  const time = metric((sample) => sample.milliseconds);
  const heap = metric((sample) => sample.retainedHeapDeltaBytes / 1024);
  const peak = metric((sample) => sample.sampledPeakHeapDeltaBytes / 1024);
  const delayMetric = metric((sample) => sample.maxTimerDelayMilliseconds);
  const active = metric((sample) => sample.eventLoopActiveMilliseconds);
  return {
    scenario: samples[0].scenario,
    mode: samples[0].mode,
    runs: samples.length,
    medianMs: rounded(time.median),
    p95Ms: rounded(time.p95),
    medianRetainedHeapKiB: rounded(heap.median),
    p95RetainedHeapKiB: rounded(heap.p95),
    medianSampledPeakKiB: rounded(peak.median),
    p95SampledPeakKiB: rounded(peak.p95),
    medianMaxTimerDelayMs: rounded(delayMetric.median),
    p95MaxTimerDelayMs: rounded(delayMetric.p95),
    medianEventLoopActiveMs: rounded(active.median),
    p95EventLoopActiveMs: rounded(active.p95),
    payloadKiB: rounded(samples[0].payloadBytes / 1024),
    returnedCandidates: samples[0].returnedCandidates,
    firstSampleAssetReads: JSON.stringify(samples[0].assetReads),
    firstSampleRepositoryOps: JSON.stringify(samples[0].repositoryOperations),
  };
}

const workerIndex = process.argv.indexOf('--worker');
if (workerIndex >= 0) {
  const scenario = process.argv[workerIndex + 1] as ScenarioId;
  const mode = process.argv[workerIndex + 2] as RunMode;
  const runs = Number(process.argv[workerIndex + 3]);
  assert.ok(SCENARIOS.includes(scenario));
  assert.ok(mode === 'cold' || mode === 'warm');
  assert.ok(Number.isSafeInteger(runs) && runs >= 1 && runs <= 25);
  const result = await runWorker(scenario, mode, runs);
  console.log(`MOBILE_LOCAL_BENCH_RESULT=${JSON.stringify(result)}`);
} else {
  const coldRuns = parsePositiveInteger('MOBILE_BENCH_COLD_RUNS', 5);
  const warmRuns = parsePositiveInteger('MOBILE_BENCH_WARM_RUNS', 9);
  const allSamples: Sample[] = [];
  for (const scenario of selectedScenarios()) {
    const coldSamples: Sample[] = [];
    for (let index = 0; index < coldRuns; index += 1) {
      coldSamples.push(...runChild(scenario, 'cold', 1).samples);
    }
    assert.equal(new Set(coldSamples.map((sample) => sample.semanticDigest)).size, 1,
      `${scenario} semantic output changed across cold processes`);
    allSamples.push(...coldSamples);
    allSamples.push(...runChild(scenario, 'warm', warmRuns).samples);
  }
  const summaries = [...new Set(allSamples.map((sample) => `${sample.mode}:${sample.scenario}`))]
    .map((key) => summarize(allSamples.filter((sample) => `${sample.mode}:${sample.scenario}` === key)));
  console.table(summaries);
  console.log('Notes: heap deltas are post-GC retained observations; sampled peaks cannot see allocations entirely inside one synchronous block.');
  console.log('Timer delay is an event-loop responsiveness signal, not a device-independent SLA or CI threshold.');
}
