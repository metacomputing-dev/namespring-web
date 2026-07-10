/**
 * tools/narrative_baseline.ts
 *
 * Capture or verify the spring-ts *narrative* golden — the user-visible
 * sentence text of the fortune-report cards, per fixture.
 *
 * The structured baseline (tools/baseline_snapshot.ts →
 * test/baseline/spring_ts_snapshot.json) freezes categorical/numerical
 * fields; this tool freezes the rendered card narratives so the D2
 * (서술 일치) / D4 (hedge 라벨링) quality-gate dimensions have a
 * deterministic, reviewable text corpus to evaluate against.
 *
 * Only sentence-level, user-visible text is captured. Timestamps
 * (meta.generatedAt) and non-text data (star ratings, scores) are
 * excluded so verify-mode comparison is deterministic.
 *
 * Usage:
 *   npx tsx tools/narrative_baseline.ts capture
 *   npx tsx tools/narrative_baseline.ts verify    # exit 0 = PASS, 1 = FAIL
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');

const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');
const NARRATIVES_PATH = path.resolve(SPRING_TS_ROOT, 'test/baseline/spring_ts_narratives.json');
/** Must stay in lockstep with tools/baseline_snapshot.ts so the narrative
 *  golden and the structured snapshot describe the same target date. */
const SNAPSHOT_TARGET_DATE = '2026-04-30T00:00:00.000Z';

// ── fetch patch (same pattern as tools/baseline_snapshot.ts) ──────────────
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

interface Fixture {
  id: string;
  label: string;
  axis: string[];
  birth: {
    year: number;
    month: number;
    day: number;
    hour: number | null;
    minute: number;
    gender: 'male' | 'female' | 'neutral';
    calendarType?: 'solar' | 'lunar';
    isLeapMonth?: boolean;
  };
  surname: Array<{ hangul: string; hanja?: string }>;
  givenName: Array<{ hangul: string; hanja?: string }>;
}

interface NarrativeFixtureResult {
  id: string;
  label: string;
  cards: Record<string, unknown>;
}

interface NarrativeFile {
  version: string;
  capturedAt: string;
  targetDate: string;
  fixtureCount: number;
  results: NarrativeFixtureResult[];
}

// ── narrative extraction (sentence text only; nulls instead of undefined
//    so the JSON shape stays stable across captures) ───────────────────────

function pickAdvice(rows: any): Array<{ text: string; reason: string }> {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    text: String(row?.text ?? ''),
    reason: String(row?.reason ?? ''),
  }));
}

function pickWarning(row: any): { signal: string; response: string; reason: string } | null {
  if (!row || typeof row !== 'object') return null;
  return {
    signal: String(row.signal ?? ''),
    response: String(row.response ?? ''),
    reason: String(row.reason ?? ''),
  };
}

function pickEvidence(rows: any): Array<Record<string, unknown>> {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    axis: String(row?.axis ?? ''),
    claim: String(row?.claim ?? ''),
    supportingFeatures: (Array.isArray(row?.supportingFeatures) ? row.supportingFeatures : []).map(String),
    weakness: row?.weakness != null ? String(row.weakness) : null,
  }));
}

function pickCounterexamples(rows: any): Array<Record<string, unknown>> {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    condition: String(row?.condition ?? ''),
    revisedClaim: String(row?.revisedClaim ?? ''),
  }));
}

function extractCards(report: any): Record<string, unknown> {
  const os = report?.overviewSummary ?? {};
  const overviewSummary = {
    title: String(os.title ?? ''),
    pillars: (Array.isArray(os.pillars) ? os.pillars : []).map((p: any) => ({
      position: String(p?.position ?? ''),
      stem: String(p?.stem ?? ''),
      branch: String(p?.branch ?? ''),
      element: String(p?.element ?? ''),
    })),
    dayMasterDescription: String(os.dayMasterDescription ?? ''),
    strengthDescription: String(os.strengthDescription ?? ''),
    yongshinDescription: String(os.yongshinDescription ?? ''),
    elementBalance: String(os.elementBalance ?? ''),
    overallSummary: String(os.overallSummary ?? ''),
    evidence: pickEvidence(os.evidence),
    expertText: os.expertText != null ? String(os.expertText) : null,
    plainText: os.plainText != null ? String(os.plainText) : null,
    counselorText: os.counselorText != null ? String(os.counselorText) : null,
    counterexamples: pickCounterexamples(os.counterexamples),
  };

  const cautions = (Array.isArray(report?.cautions?.cautions) ? report.cautions.cautions : [])
    .map(pickWarning);

  const personality = {
    summary: String(report?.personality?.summary ?? ''),
    traits: (Array.isArray(report?.personality?.traits) ? report.personality.traits : [])
      .map((t: any) => ({
        trait: String(t?.trait ?? ''),
        description: String(t?.description ?? ''),
        source: String(t?.source ?? ''),
      })),
  };

  const strengthsWeaknesses = {
    strengths: pickAdvice(report?.strengthsWeaknesses?.strengths),
    weaknesses: pickAdvice(report?.strengthsWeaknesses?.weaknesses),
  };

  const categoryFortunes: Record<string, unknown> = {};
  const cf = report?.categoryFortunes ?? {};
  for (const key of Object.keys(cf).sort()) {
    const card = cf[key] ?? {};
    categoryFortunes[key] = {
      title: String(card.title ?? ''),
      summary: String(card.summary ?? ''),
      advice: pickAdvice(card.advice),
      caution: pickWarning(card.caution),
      subDomains: (Array.isArray(card.subDomains) ? card.subDomains : []).map((s: any) => ({
        name: String(s?.name ?? ''),
        title: String(s?.title ?? ''),
        narrative: String(s?.narrative ?? ''),
      })),
    };
  }

  return { overviewSummary, cautions, personality, strengthsWeaknesses, categoryFortunes };
}

// ── run all fixtures through getFortuneReport ─────────────────────────────

async function runFixtures(): Promise<NarrativeFile> {
  const fixtures: Fixture[] = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8')).fixtures;
  const engine = new SpringEngine();
  const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
  for (const repo of repos) {
    if (!repo) continue;
    (repo as any).wasmUrl = WASM_PATH;
  }
  await engine.init();

  const results: NarrativeFixtureResult[] = [];
  for (const fix of fixtures) {
    const report = await engine.getFortuneReport({
      targetDate: SNAPSHOT_TARGET_DATE,
      birth: fix.birth as any,
      surname: fix.surname,
      givenName: fix.givenName,
    });
    results.push({ id: fix.id, label: fix.label, cards: extractCards(report) });
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

// ── first-diff locator for verify-mode failure summaries ──────────────────

function firstDiffPath(base: unknown, curr: unknown, trail = '$'): string | null {
  if (typeof base === 'string' || typeof base === 'number' ||
      typeof base === 'boolean' || base === null || base === undefined) {
    return Object.is(base, curr) ? null : `${trail}: ${JSON.stringify(base)} → ${JSON.stringify(curr)}`;
  }
  if (Array.isArray(base)) {
    if (!Array.isArray(curr)) return `${trail}: array → ${typeof curr}`;
    if (base.length !== curr.length) return `${trail}.length: ${base.length} → ${curr.length}`;
    for (let i = 0; i < base.length; i += 1) {
      const found = firstDiffPath(base[i], curr[i], `${trail}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  if (typeof base === 'object') {
    if (!curr || typeof curr !== 'object' || Array.isArray(curr)) {
      return `${trail}: object → ${Array.isArray(curr) ? 'array' : typeof curr}`;
    }
    const keys = new Set([...Object.keys(base as object), ...Object.keys(curr as object)]);
    for (const key of [...keys].sort()) {
      const found = firstDiffPath((base as any)[key], (curr as any)[key], `${trail}.${key}`);
      if (found) return found;
    }
    return null;
  }
  return Object.is(base, curr) ? null : `${trail}: type mismatch`;
}

// ── main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const mode = (process.argv[2] || 'verify').toLowerCase();
  const narratives = await runFixtures();

  if (mode === 'capture') {
    fs.mkdirSync(path.dirname(NARRATIVES_PATH), { recursive: true });
    fs.writeFileSync(NARRATIVES_PATH, JSON.stringify(narratives, null, 2) + '\n');
    console.log(`Narrative golden captured: ${NARRATIVES_PATH}`);
    console.log(`  ${narratives.results.length} fixtures captured at ${SNAPSHOT_TARGET_DATE}`);
    process.exit(0);
  }

  if (mode !== 'verify') {
    console.error(`Unknown mode "${mode}". Use "capture" or "verify".`);
    process.exit(2);
  }

  if (!fs.existsSync(NARRATIVES_PATH)) {
    console.error(`No narrative golden at ${NARRATIVES_PATH}.`);
    console.error('Run: npm run narrative:capture');
    process.exit(1);
  }

  const baseline: NarrativeFile = JSON.parse(fs.readFileSync(NARRATIVES_PATH, 'utf-8'));
  let pass = 0;
  let fail = 0;
  const failures: string[] = [];

  if (baseline.targetDate !== SNAPSHOT_TARGET_DATE) {
    console.error(
      `Narrative golden targetDate ${baseline.targetDate} != tool targetDate ${SNAPSHOT_TARGET_DATE}. ` +
      'Re-capture with: npm run narrative:capture',
    );
    process.exit(1);
  }

  for (const baseFix of baseline.results) {
    const currentFix = narratives.results.find((r) => r.id === baseFix.id);
    if (!currentFix) {
      fail += 1;
      failures.push(baseFix.id);
      console.log(`  FAIL ${baseFix.id} — fixture missing in current run`);
      continue;
    }
    const baseStr = JSON.stringify(baseFix.cards);
    const currStr = JSON.stringify(currentFix.cards);
    if (baseStr === currStr) {
      pass += 1;
      console.log(`  PASS ${baseFix.id} — ${baseFix.label}`);
    } else {
      fail += 1;
      failures.push(baseFix.id);
      const diff = firstDiffPath(baseFix.cards, currentFix.cards) ?? '(unlocated diff)';
      console.log(`  FAIL ${baseFix.id} — ${baseFix.label}`);
      console.log(`    first diff at ${diff}`);
    }
  }

  const missingInBaseline = narratives.results
    .filter((r) => !baseline.results.some((b) => b.id === r.id))
    .map((r) => r.id);
  if (missingInBaseline.length > 0) {
    fail += missingInBaseline.length;
    failures.push(...missingInBaseline);
    console.log(`  FAIL new fixtures not in golden: ${missingInBaseline.join(', ')}`);
  }

  console.log(`\nNarrative golden regression: ${pass} PASS / ${fail} FAIL`);
  if (fail > 0) {
    console.error(
      '\nNarrative regression detected. Failing fixtures: ' + failures.join(', ') + '\n' +
      'After confirming the wording change is intentional: npm run narrative:capture',
    );
    process.exit(1);
  }
  process.exit(0);
}

await main();
