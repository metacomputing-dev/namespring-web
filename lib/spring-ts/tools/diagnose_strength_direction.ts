/**
 * tools/diagnose_strength_direction.ts
 *
 * Diagnostic for the fix-04 / fix-12 strength-direction disagreement
 * flagged in PR-M-3. Runs the spring-ts SpringEngine end-to-end (same
 * path as `tools/baseline_snapshot.ts` and `npm run test:snapshot`) on
 * fix-04 and fix-12, then dumps the saju internal strength state
 * surfaced through `getSajuReport()`:
 *
 *   sajuReport.strengthLevel  ← what spring-ts users see in the UI
 *   sajuReport.isStrong       ← derived from saju-ts strengthIndex >= 0
 *   sajuReport.strength.*     ← raw support / pressure components
 *
 * Compared against saju_master raw_score (negative = weak):
 *   fix-04: saju_master raw_score = -16.0 (clearly weak)
 *   fix-12: saju_master raw_score =  -8.77 (mild weak)
 *
 * Usage:  npx tsx tools/diagnose_strength_direction.ts
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

// fetch patch — same pattern as test/compare-output.ts
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

interface FixtureBirth {
  id: string;
  label: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  gender: 'male' | 'female';
}

const TARGETS: FixtureBirth[] = [
  {
    id: 'fix-04',
    label: '1965-08-08 19:00 female 丙火 — saju_master raw_score=-16 (신약), spring-ts 중화(신강 경향)',
    year: 1965, month: 8, day: 8, hour: 19, minute: 0, gender: 'female',
  },
  {
    id: 'fix-12',
    label: '1991-03-20 11:30 male 甲木 — saju_master raw_score=-8.77 (신약), spring-ts 중화(신강 경향)',
    year: 1991, month: 3, day: 20, hour: 11, minute: 30, gender: 'male',
  },
];

async function diagnose(engine: any, t: FixtureBirth): Promise<void> {
  const report = await engine.getSajuReport({
    birth: { year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, gender: t.gender },
    surname: [{ hangul: '김', hanja: '金' }],
  });

  const s = report.strength as any;
  console.log(`${t.id} — ${t.label}`);
  console.log(`  spring-ts surfaced:`);
  console.log(`    strengthLevel: ${report.strengthLevel}`);
  console.log(`    isStrong:      ${report.isStrong}`);
  console.log(`  saju.strength.*:`);
  console.log(`    level:    ${s?.level}`);
  console.log(`    isStrong: ${s?.isStrong}`);
  console.log(`    score.totalSupport: ${Number(s?.score?.totalSupport ?? 0).toFixed(3)}`);
  console.log(`    score.totalOppose:  ${Number(s?.score?.totalOppose ?? 0).toFixed(3)}`);
  console.log(`    score.deukryeong:   ${Number(s?.score?.deukryeong ?? 0).toFixed(3)}`);
  console.log(`    score.deukji:       ${Number(s?.score?.deukji ?? 0).toFixed(3)}`);
  console.log(`    score.deukse:       ${Number(s?.score?.deukse ?? 0).toFixed(3)}`);
  if (s?.details) {
    console.log(`  details:`);
    for (const line of s.details) console.log(`    ${line}`);
  }
  // Net ratio reconstruction
  const sup = Number(s?.score?.totalSupport ?? 0);
  const opp = Number(s?.score?.totalOppose ?? 0);
  const sum = sup + opp;
  const net = sum > 0 ? (sup - opp) / sum : 0;
  console.log(`  reconstructed net-ratio (support-oppose)/(support+oppose): ${net.toFixed(4)}`);
  console.log(`  in BALANCED band (|net| < 0.15)? ${Math.abs(net) < 0.15}`);
  console.log();
}

async function main(): Promise<void> {
  const engine = new SpringEngine();
  const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
  for (const repo of repos) {
    if (!repo) continue;
    (repo as any).wasmUrl = WASM_PATH;
  }
  await engine.init();

  console.log('Phase M-7 diagnostic — spring-ts strength state on fix-04 / fix-12\n');
  for (const t of TARGETS) await diagnose(engine, t);

  engine.close();
}

await main();
