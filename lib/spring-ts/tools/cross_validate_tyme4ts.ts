/**
 * tools/cross_validate_tyme4ts.ts
 *
 * Cross-validates spring-ts's 4-pillar calculation against tyme4ts
 * (TS port of 6tail/lunar+tyme MIT, 12+ language ports of the same
 * algorithm). Calc-layer cross-validation only — no 격국/용신.
 *
 * For each of the 12 baseline fixtures:
 *   1. Convert calendar input via tyme4ts SolarTime.fromYmdHms() →
 *      LunarHour → EightChar.
 *   2. Compare to the snapshot's `output.sajuReport.pillars` (saju-ts
 *      derivation through spring-ts adapter).
 *   3. Report per-pillar agreement.
 *
 * tyme4ts and saju-ts share the same classical 立春 + 절기 boundary
 * methodology, so high agreement is expected. Disagreement surfaces
 * boundary edge cases or epoch/calendar-conversion differences.
 *
 * Usage: npx tsx tools/cross_validate_tyme4ts.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SolarTime } from 'tyme4ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

// fetch patch (same pattern as test/compare-output.ts and tools/baseline_snapshot.ts)
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
  birth: { year: number; month: number; day: number; hour: number | null; minute: number; gender: string };
  surname: Array<{ hangul: string; hanja?: string }>;
}

interface Pillar { stem: string; branch: string; ganzhi: string; }

function tymePillars(birth: Fixture['birth']): { year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null } {
  const hour = birth.hour ?? 12;
  const minute = birth.minute ?? 0;
  const solar = SolarTime.fromYmdHms(birth.year, birth.month, birth.day, hour, minute, 0);
  const lunarHour = solar.getLunarHour();
  const eightChar = lunarHour.getEightChar();

  const yearGan = eightChar.getYear().getName();   // e.g. '丙寅'
  const monthGan = eightChar.getMonth().getName();
  const dayGan = eightChar.getDay().getName();
  const hourGan = eightChar.getHour().getName();

  const split = (gz: string): Pillar => ({ stem: gz.charAt(0), branch: gz.charAt(1), ganzhi: gz });

  return {
    year: split(yearGan),
    month: split(monthGan),
    day: split(dayGan),
    hour: birth.hour === null ? null : split(hourGan),
  };
}

async function springTsPillars(engine: any, fix: Fixture): Promise<{ year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null } | null> {
  const report = await engine.getSajuReport({
    birth: fix.birth,
    surname: fix.surname,
  });
  const p = (report as any).pillars;
  if (!p) return null;
  const part = (pillar: any): Pillar => {
    const stem = pillar?.stem?.hanja || pillar?.stem?.hangul || '?';
    const branch = pillar?.branch?.hanja || pillar?.branch?.hangul || '?';
    return { stem, branch, ganzhi: stem + branch };
  };
  return {
    year: part(p.year),
    month: part(p.month),
    day: part(p.day),
    hour: p.hour ? part(p.hour) : null,
  };
}

function cmp(a: Pillar | null, b: Pillar | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.ganzhi === b.ganzhi;
}

async function main(): Promise<void> {
  const fixtures: Fixture[] = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8')).fixtures;

  console.log(`cross_validate_tyme4ts — ${fixtures.length} fixtures\n`);

  const engine = new SpringEngine();
  const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
  for (const repo of repos) {
    if (!repo) continue;
    (repo as any).wasmUrl = WASM_PATH;
  }
  await engine.init();

  let totalPillars = 0;
  let agree = 0;
  const fixtureMatch: number[] = [];

  for (const fix of fixtures) {
    let tymed: ReturnType<typeof tymePillars>;
    try {
      tymed = tymePillars(fix.birth);
    } catch (err) {
      console.log(`  ERR  ${fix.id}: ${String((err as Error).message)}`);
      continue;
    }
    let sp: Awaited<ReturnType<typeof springTsPillars>>;
    try {
      sp = await springTsPillars(engine, fix);
    } catch (err) {
      console.log(`  ERR  ${fix.id} (spring-ts): ${String((err as Error).message)}`);
      continue;
    }

    let fxAgree = 0;
    let fxTotal = 0;

    const labels = ['year', 'month', 'day', 'hour'] as const;
    const lines: string[] = [];
    for (const k of labels) {
      const t = tymed[k];
      const s = sp ? sp[k] : null;
      fxTotal += 1;
      const ok = cmp(t, s);
      if (ok) fxAgree += 1;
      const tStr = t ? t.ganzhi : '(unknown-hour)';
      const sStr = s ? s.ganzhi : '(unknown-hour)';
      const tag = ok ? '=' : '≠';
      lines.push(`    ${k.padEnd(6)} tyme4ts=${tStr}  ${tag}  spring-ts=${sStr}`);
    }
    totalPillars += fxTotal;
    agree += fxAgree;
    fixtureMatch.push(fxAgree);

    const tag = fxAgree === fxTotal ? 'PASS' : `${fxAgree}/${fxTotal}`;
    console.log(`  [${tag.padEnd(4)}] ${fix.id}: ${fix.label.slice(0, 60)}`);
    if (fxAgree !== fxTotal) {
      for (const l of lines) console.log(l);
    }
  }

  engine.close();

  console.log();
  console.log(`──────────────────────────────────`);
  const fullPass = fixtureMatch.filter((m) => m === 4).length;
  console.log(`Per-fixture full agreement (4/4 pillars): ${fullPass} / ${fixtures.length}`);
  console.log(`Per-pillar agreement: ${agree} / ${totalPillars} (${((agree / totalPillars) * 100).toFixed(1)}%)`);
  console.log();
  console.log('Note: tyme4ts and saju-ts/spring-ts share classical 立春 + 절기 boundary methodology.');
  console.log('High agreement is expected; disagreement surfaces boundary edge cases.');
}

await main();
