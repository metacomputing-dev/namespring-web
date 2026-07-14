/**
 * tools/baseline_snapshot.ts
 *
 * Capture or verify the spring-ts baseline regression snapshot.
 *
 *   capture mode:  rebuilds tests/baseline/spring_ts_snapshot.json from the
 *                  all fixtures in tests/fixtures/spring_ts_baseline_cases.json.
 *                  Used after intentional baseline changes (e.g., post-PR1).
 *
 *   verify mode (default): re-runs every fixture and diffs against the
 *                          stored snapshot. Default-mode regression must be 0;
 *                          opt-in modes are tested separately.
 *
 * Usage:
 *   npx tsx tools/baseline_snapshot.ts capture
 *   npx tsx tools/baseline_snapshot.ts verify    # exit 0 = PASS, 1 = FAIL
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');

const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');
const SNAPSHOT_PATH = path.resolve(SPRING_TS_ROOT, 'test/baseline/spring_ts_snapshot.json');
const SNAPSHOT_TARGET_DATE = '2026-04-30T00:00:00.000Z';

// ── fetch patch (same pattern as test/compare-output.ts) ──────────────────
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

import { SpringEngine, buildFortuneReport } from '../src/index.js';

interface Fixture {
  id: string;
  label: string;
  axis: string[];
  birth: {
    year: number;
    month: number;
    day: number;
    /** Hour 0-23 when known. Null for 시간미상 (unknown-hour) fixtures —
     *  saju-adapter falls back to noon (12:00) when hour is null per
     *  DEFAULT_UNKNOWN_HOUR. PR-L-2 loosens this from `number` so
     *  follow-up fixture additions can express the unknown case. */
    hour: number | null;
    minute: number;
    gender: 'male' | 'female' | 'neutral';
    /** P0-3: 음력 입력 픽스처(fix-17)용 — SpringEngine birth 입력에 그대로 통과. */
    calendarType?: 'solar' | 'lunar';
    isLeapMonth?: boolean;
  };
  surname: Array<{ hangul: string; hanja?: string }>;
  givenName: Array<{ hangul: string; hanja?: string }>;
}

interface FixtureSnapshot {
  id: string;
  label: string;
  axis: string[];
  output: Record<string, unknown>;
}

interface SnapshotFile {
  version: string;
  capturedAt: string;
  targetDate: string;
  fixtureCount: number;
  results: FixtureSnapshot[];
}

async function runFixtures(): Promise<SnapshotFile> {
  const fixtures: Fixture[] = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8')).fixtures;
  const engine = new SpringEngine();
  const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
  for (const repo of repos) {
    if (!repo) continue;
    (repo as any).wasmUrl = WASM_PATH;
  }
  await engine.init();

  const targetDate = new Date(SNAPSHOT_TARGET_DATE);
  const results: FixtureSnapshot[] = [];

  for (const fix of fixtures) {
    const namingReport = await engine.getNamingReport({
      birth: fix.birth,
      surname: fix.surname,
      givenName: fix.givenName,
    });
    const sajuReport = await engine.getSajuReport({
      birth: fix.birth,
      surname: fix.surname,
    });
    const candidates = await engine.getNameCandidates({
      birth: fix.birth,
      surname: fix.surname,
      givenNameLength: fix.givenName.length,
      mode: 'recommend',
      options: { limit: 5 },
    });
    // buildFortuneReport는 2026-07-04(7d4ee70a0)부터 async — await 누락 시
    // Promise가 캡처되어 fortuneReport 필드 전체가 undefined로 고정된다.
    const fortuneReport = await buildFortuneReport(sajuReport, targetDate, candidates[0] ?? null);

    results.push({
      id: fix.id,
      label: fix.label,
      axis: fix.axis,
      output: {
        namingReport: {
          totalScore: namingReport.totalScore,
          scores: namingReport.scores,
          fullHangul: namingReport.name.fullHangul,
          fullHanja: namingReport.name.fullHanja,
        },
        sajuReport: {
          sajuEnabled: sajuReport.sajuEnabled,
          dayMaster: sajuReport.dayMaster,
          strengthLevel: sajuReport.strength?.level,
          isStrong: sajuReport.strength?.isStrong,
          yongshinElement: sajuReport.yongshin?.element,
          yongshinHeeshin: sajuReport.yongshin?.heeshin,
          gyeokgukType: sajuReport.gyeokguk?.type,
          gyeokgukCategory: sajuReport.gyeokguk?.category,
          gyeokgukConfidence: sajuReport.gyeokguk?.confidence,
          deficientElements: sajuReport.deficientElements,
          excessiveElements: sajuReport.excessiveElements,
        },
        candidatesTop5: candidates.slice(0, 5).map((c) => ({
          finalScore: c.finalScore,
          fullHangul: c.namingReport.name.fullHangul,
          fullHanja: c.namingReport.name.fullHanja,
          rank: c.rank,
        })),
        fortuneReport: {
          overviewTitle: fortuneReport.overviewSummary?.title,
          dailyStars: fortuneReport.dailyFortune?.stars,
          yearlyStars: fortuneReport.yearlyFortune?.stars,
          lifeStars: fortuneReport.lifeFortuneOverview?.stars,
          personalityTraitCount: fortuneReport.personality?.traits?.length ?? 0,
        },
      },
    });
  }

  engine.close();

  return {
    version: '1.0.0',
    capturedAt: new Date().toISOString(),
    targetDate: SNAPSHOT_TARGET_DATE,
    fixtureCount: results.length,
    results,
  };
}

async function main(): Promise<void> {
  const mode = (process.argv[2] || 'verify').toLowerCase();
  const snapshot = await runFixtures();

  if (mode === 'capture') {
    fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n');
    console.log(`Snapshot captured: ${SNAPSHOT_PATH}`);
    console.log(`  ${snapshot.results.length} fixtures captured at ${SNAPSHOT_TARGET_DATE}`);
    process.exit(0);
  }

  if (mode !== 'verify') {
    console.error(`Unknown mode "${mode}". Use "capture" or "verify".`);
    process.exit(2);
  }

  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.error(`No baseline snapshot at ${SNAPSHOT_PATH}.`);
    console.error('Run: npx tsx tools/baseline_snapshot.ts capture');
    process.exit(1);
  }

  const baseline: SnapshotFile = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
  let pass = 0;
  let fail = 0;
  const failures: string[] = [];
  const baselineIds = baseline.results.map((result) => result.id);
  const currentIds = snapshot.results.map((result) => result.id);
  const shapeFailures: string[] = [];

  if (baseline.fixtureCount !== baseline.results.length) {
    shapeFailures.push(
      `stored fixtureCount=${baseline.fixtureCount}, stored results=${baseline.results.length}`,
    );
  }
  if (snapshot.fixtureCount !== snapshot.results.length) {
    shapeFailures.push(
      `current fixtureCount=${snapshot.fixtureCount}, current results=${snapshot.results.length}`,
    );
  }
  if (new Set(baselineIds).size !== baselineIds.length) {
    shapeFailures.push('stored snapshot contains duplicate fixture ids');
  }
  if (new Set(currentIds).size !== currentIds.length) {
    shapeFailures.push('current fixture run contains duplicate fixture ids');
  }
  if (baseline.fixtureCount !== snapshot.fixtureCount) {
    shapeFailures.push(
      `fixture count changed: stored=${baseline.fixtureCount}, current=${snapshot.fixtureCount}`,
    );
  }
  if (JSON.stringify(baselineIds) !== JSON.stringify(currentIds)) {
    shapeFailures.push(
      `fixture id/order changed: stored=[${baselineIds.join(', ')}], current=[${currentIds.join(', ')}]`,
    );
  }

  if (shapeFailures.length > 0) {
    console.error('Snapshot structure mismatch:');
    for (const failure of shapeFailures) console.error(`  - ${failure}`);
    console.error('Re-capture only after confirming the fixture-set change is intentional.');
    process.exit(1);
  }

  for (const baseFix of baseline.results) {
    const currentFix = snapshot.results.find((r) => r.id === baseFix.id);
    if (!currentFix) {
      fail += 1;
      failures.push(baseFix.id);
      console.log(`  FAIL ${baseFix.id} — fixture missing in current run`);
      continue;
    }
    const baseStr = JSON.stringify(baseFix.output);
    const currStr = JSON.stringify(currentFix.output);
    if (baseStr === currStr) {
      pass += 1;
      console.log(`  PASS ${baseFix.id} — ${baseFix.label}`);
    } else {
      fail += 1;
      failures.push(baseFix.id);
      console.log(`  FAIL ${baseFix.id} — ${baseFix.label}`);
    }
  }

  console.log(`\nSnapshot regression: ${pass} PASS / ${fail} FAIL`);
  if (fail > 0) {
    console.error(
      '\nDefault-mode regression detected. Failing fixtures: ' + failures.join(', ') + '\n' +
      'For per-field diff: node tools/measure_regression.mjs --baseline main --branch HEAD\n' +
      'After confirming the change is intentional: npx tsx tools/baseline_snapshot.ts capture',
    );
    process.exit(1);
  }
  process.exit(0);
}

await main();
