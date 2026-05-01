/**
 * test/integration/gyeokguk-candidates-baseline.test.ts
 *
 * Guards the additive gyeokguk candidate surface against the existing
 * selected-gyeokguk baseline.
 *
 * Run: npm run test:gyeokguk-candidates
 * Update focused snapshot:
 *   npx tsx test/integration/gyeokguk-candidates-baseline.test.ts --update
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeSaju } from '../../src/saju-adapter.js';
import type { BirthInfo, GyeokgukCandidateSummary } from '../../src/types.js';

interface BaselineFixture {
  readonly id: string;
  readonly label: string;
  readonly birth: BirthInfo;
}

interface CandidateSnapshotRow {
  readonly type: string;
  readonly category: string;
  readonly baseTenGod: string | null;
  readonly score: number;
  readonly confidence: number;
  readonly sourceTier: string;
  readonly sourceType: string;
  readonly reasonCodes: readonly string[];
}

interface GyeokgukSnapshotRow {
  readonly id: string;
  readonly selected: {
    readonly type: string;
    readonly category: string;
    readonly baseTenGod: string | null;
    readonly confidence: number;
  };
  readonly candidates: readonly CandidateSnapshotRow[];
}

interface GyeokgukSnapshotFile {
  readonly schemaVersion: 'spring-ts.gyeokguk-candidate-snapshot.v1';
  readonly sourceFixture: 'test/fixtures/spring_ts_baseline_cases.json';
  readonly fixtureCount: number;
  readonly results: readonly GyeokgukSnapshotRow[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const FIXTURE_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');
const BASELINE_SNAPSHOT_PATH = path.resolve(SPRING_TS_ROOT, 'test/baseline/spring_ts_snapshot.json');
const GYEOKGUK_SNAPSHOT_PATH = path.resolve(SPRING_TS_ROOT, 'test/baseline/gyeokguk_candidate_snapshot.json');
const UPDATE = process.argv.includes('--update');

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

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function asCandidateRow(candidate: GyeokgukCandidateSummary): CandidateSnapshotRow {
  return {
    type: candidate.type,
    category: candidate.category,
    baseTenGod: candidate.baseTenGod,
    score: round(candidate.score),
    confidence: round(candidate.confidence),
    sourceTier: candidate.sourceTier.tier,
    sourceType: candidate.sourceTier.sourceType,
    reasonCodes: [
      ...candidate.supportingRules,
      ...candidate.blockingRules.map((rule) => `blocking:${rule}`),
    ].slice(0, 8),
  };
}

const fixtures = readJson<{ fixtures: readonly BaselineFixture[] }>(FIXTURE_PATH).fixtures;
const selectedBaseline = readJson<any>(BASELINE_SNAPSHOT_PATH);
const selectedById = new Map<string, any>(
  (selectedBaseline.results ?? []).map((row: any) => [row.id, row.output?.sajuReport ?? {}]),
);

console.log('Phase 4.1 gyeokguk candidate baseline snapshot\n');

const results: GyeokgukSnapshotRow[] = [];

for (const fixture of fixtures) {
  const summary = await analyzeSaju(fixture.birth);
  const selected = summary.gyeokguk;
  const candidates = selected.candidates ?? [];
  const storedSelected = selectedById.get(fixture.id);

  check(`${fixture.id}: selected type unchanged`,
    selected.type === storedSelected?.gyeokgukType,
    `actual=${selected.type}, baseline=${storedSelected?.gyeokgukType}`);
  check(`${fixture.id}: selected category unchanged`,
    selected.category === storedSelected?.gyeokgukCategory,
    `actual=${selected.category}, baseline=${storedSelected?.gyeokgukCategory}`);
  check(`${fixture.id}: selected confidence unchanged`,
    Math.abs(selected.confidence - Number(storedSelected?.gyeokgukConfidence)) <= 1e-9,
    `actual=${selected.confidence}, baseline=${storedSelected?.gyeokgukConfidence}`);

  check(`${fixture.id}: candidates non-empty`, candidates.length > 0, `count=${candidates.length}`);
  const first = candidates[0];
  check(`${fixture.id}: first candidate matches selected`,
    first?.type === selected.type &&
      first?.category === selected.category,
    first ? `${first.type}/${first.category}/${first.baseTenGod}` : 'missing');
  check(`${fixture.id}: candidates carry non-authority source tier`,
    candidates.every((candidate) =>
      candidate.sourceTier.tier === 'T2_REFERENCE_IMPLEMENTATION' &&
      candidate.sourceTier.authorityTruthEligible === false));

  const sortedAlternatives = candidates.slice(1).every((candidate, index, alternatives) => {
    if (index === 0) return true;
    const previous = alternatives[index - 1];
    if (previous.score !== candidate.score) return previous.score >= candidate.score;
    return previous.confidence >= candidate.confidence;
  });
  check(`${fixture.id}: alternative candidates sorted`, sortedAlternatives);

  results.push({
    id: fixture.id,
    selected: {
      type: selected.type,
      category: selected.category,
      baseTenGod: selected.baseTenGod,
      confidence: round(selected.confidence),
    },
    candidates: candidates.slice(0, 5).map(asCandidateRow),
  });
}

const snapshot: GyeokgukSnapshotFile = {
  schemaVersion: 'spring-ts.gyeokguk-candidate-snapshot.v1',
  sourceFixture: 'test/fixtures/spring_ts_baseline_cases.json',
  fixtureCount: fixtures.length,
  results,
};
const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;

check('fixture count matches baseline fixture file',
  snapshot.fixtureCount === fixtures.length,
  `snapshot=${snapshot.fixtureCount}, fixtures=${fixtures.length}`);

if (UPDATE || !fs.existsSync(GYEOKGUK_SNAPSHOT_PATH)) {
  fs.writeFileSync(GYEOKGUK_SNAPSHOT_PATH, serialized);
  console.log(`\nUpdated ${path.relative(SPRING_TS_ROOT, GYEOKGUK_SNAPSHOT_PATH)}`);
} else {
  const expected = fs.readFileSync(GYEOKGUK_SNAPSHOT_PATH, 'utf-8').replace(/\r\n/g, '\n');
  check('focused gyeokguk candidate snapshot matches', serialized === expected);
}

console.log(`\nGyeokguk candidate baseline: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
