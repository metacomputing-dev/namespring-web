/**
 * tools/diagnose_fix10_pillars.ts
 *
 * Diagnostic for fix-10 (2018-11-22 15:00 female) — spring-ts picks
 * 편재격 / METAL but saju_master picks 비견격 (compound [BiJian, ZhengCai])
 * — spring-ts's choice (편재) is NOT in saju_master's compound list.
 * Possible causes:
 *   (A) Different month-branch resolution due to 소설 boundary policy.
 *   (B) Different day-master polarity yielding 정재→편재 polarity flip.
 *   (C) Different gyeokguk selection rule on the same chart.
 *
 * Logs both engines' pillar interpretation so the source of divergence
 * can be classified.
 *
 * Usage:  npx tsx tools/diagnose_fix10_pillars.ts
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

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

async function main(): Promise<void> {
  const engine = new SpringEngine();
  const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
  for (const repo of repos) {
    if (!repo) continue;
    (repo as any).wasmUrl = WASM_PATH;
  }
  await engine.init();

  const report = await engine.getSajuReport({
    birth: { year: 2018, month: 11, day: 22, hour: 15, minute: 0, gender: 'female' },
    surname: [{ hangul: '한', hanja: '韓' }],
  });

  console.log('Phase M-8 diagnostic — fix-10 (2018-11-22 15:00 female) pillar comparison\n');
  console.log('spring-ts engine:');
  const pillars: any = (report as any).pillars || {};
  for (const k of ['year', 'month', 'day', 'hour']) {
    const p = pillars[k];
    if (p) console.log(`  ${k}: stem=${p.stem?.hangul ?? '?'}(${p.stem?.code ?? '?'}) / branch=${p.branch?.hangul ?? '?'}(${p.branch?.code ?? '?'})`);
  }
  console.log(`  dayMaster: ${report.dayMaster?.hangul ?? '?'} (${report.dayMaster?.code ?? '?'}) / element: ${(report.dayMaster as any)?.element ?? '?'} polarity: ${(report.dayMaster as any)?.polarity ?? '?'}`);
  console.log();
  console.log(`  gyeokguk.type:     ${report.gyeokguk?.type}`);
  console.log(`  gyeokguk.category: ${report.gyeokguk?.category}`);
  console.log(`  yongshin.element:  ${report.yongshin?.element}`);
  console.log(`  strengthLevel:     ${(report as any).strengthLevel}`);
  console.log();

  console.log('saju_master output (per .tmp/fix10_smc.json):');
  const smcPath = path.resolve(SPRING_TS_ROOT, '.tmp/fix10_smc.json');
  if (fs.existsSync(smcPath)) {
    const txt = fs.readFileSync(smcPath, 'utf-8').replace(/^﻿/, '');
    const smc = JSON.parse(txt);
    const smcPillars = smc.pillars || {};
    for (const k of ['year', 'month', 'day', 'hour']) {
      const p = smcPillars[k];
      if (p) console.log(`  ${k}: ganzhi=${p.ganzhi} stem=${p.cheongan} branch=${p.jiji}`);
    }
    console.log();
    console.log(`  geok.month_branch: ${smc.geok?.month_branch}`);
    console.log(`  geok.geok_codes:   ${JSON.stringify(smc.geok?.geok_codes)}`);
    console.log(`  geok.geok_names:   ${JSON.stringify(smc.geok?.geok_names)}`);
    console.log(`  geok.geok_type:    ${smc.geok?.geok_type}`);
    console.log(`  chengbai.overall.best_geok: ${smc.chengbai?.overall?.best_geok}`);
    console.log(`  chengbai.overall.status:    ${smc.chengbai?.overall?.status}`);
    console.log(`  chengbai.overall.score:     ${smc.chengbai?.overall?.score}`);
    console.log(`  strength.level:    ${smc.strength?.level}`);
    console.log(`  strength.day_element: ${smc.strength?.day_element}`);
  } else {
    console.log(`  (no cached saju_master JSON at ${smcPath})`);
  }

  engine.close();
}

await main();
