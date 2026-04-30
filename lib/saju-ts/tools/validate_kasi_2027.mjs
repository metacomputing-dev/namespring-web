#!/usr/bin/env node
/**
 * Validate the engine's solar-term timing against the KASI 2027
 * minute-level fixture across all three solarPrecision modes.
 *
 * Usage (after building):
 *   npm run validate:kasi
 *
 * Exits 0 when every term is within the strict ±2-minute envelope on
 * the 'iau1980_full' mode (matches saju_master's own pass criterion).
 * Exits 1 otherwise. Always prints a per-mode summary table and the
 * worst term per mode, regardless of pass/fail.
 *
 * Reads:
 *   - tests/precision/fixtures/kasi_2027_24terms.json   (KASI fixture)
 *   - dist/calendar/solarTerms.js                       (built engine)
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const FIXTURE_PATH = resolve(
  ROOT,
  'tests/precision/fixtures/kasi_2027_24terms.json',
);
const ENGINE_MODULE = resolve(ROOT, 'dist/calendar/solarTerms.js');

const STRICT_TOL_MIN = 2;
const MS_PER_MIN = 60_000;

const MODES = ['classical', 'iau1980_top10', 'iau1980_full'];

async function main() {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
  const { solarTermUtcMsForLongitude } = await import(
    pathToFileURL(ENGINE_MODULE).href
  );

  const results = {};
  for (const precision of MODES) {
    const rows = [];
    for (const term of fixture.terms) {
      const expectedMs = new Date(term.kstIso).getTime();
      const computedMs = solarTermUtcMsForLongitude(
        2027,
        term.degree,
        'meeus',
        'bisection',
        'constant',
        precision,
      );
      const deltaMin = (computedMs - expectedMs) / MS_PER_MIN;
      rows.push({
        name: term.name,
        hanja: term.hanja,
        kind: term.kind,
        deltaMin,
      });
    }
    const absDeltas = rows.map((r) => Math.abs(r.deltaMin));
    const maxAbs = Math.max(...absDeltas);
    const meanAbs = absDeltas.reduce((s, x) => s + x, 0) / absDeltas.length;
    const worst = rows.reduce((w, r) =>
      Math.abs(r.deltaMin) > Math.abs(w.deltaMin) ? r : w,
    );
    const failures = rows.filter((r) => Math.abs(r.deltaMin) > STRICT_TOL_MIN);
    results[precision] = { rows, maxAbs, meanAbs, worst, failures };
  }

  console.log('KASI 2027 24-term validation (KST, ±2 min target)');
  console.log('=================================================');
  console.log('Fixture: KASI 달력자료 2027 (saju_master kasi_terms.py)\n');

  console.log('Per-mode summary');
  console.log('----------------');
  for (const m of MODES) {
    const r = results[m];
    console.log(
      `  ${m.padEnd(15)} max |Δ|=${r.maxAbs.toFixed(3)}min  mean |Δ|=${r.meanAbs.toFixed(3)}min  worst=${r.worst.name}(${r.worst.hanja}) ${r.worst.deltaMin.toFixed(3)}min  fails(±2min)=${r.failures.length}/24`,
    );
  }

  // Print full per-term deltas for the strictest mode so the user can
  // inspect which terms drift the most.
  const fullMode = 'iau1980_full';
  console.log(`\nPer-term delta (${fullMode}, sorted by |Δ| desc)`);
  console.log('---------------------------------------------------');
  const fullRows = [...results[fullMode].rows].sort(
    (a, b) => Math.abs(b.deltaMin) - Math.abs(a.deltaMin),
  );
  for (const r of fullRows) {
    const flag = Math.abs(r.deltaMin) > STRICT_TOL_MIN ? '  [FAIL]' : '';
    console.log(
      `  ${r.kind.padEnd(5)} ${r.name.padEnd(4)}(${r.hanja.padEnd(2)})  Δ=${r.deltaMin.toFixed(3)}min${flag}`,
    );
  }

  const finalFailures = results[fullMode].failures.length;
  if (finalFailures === 0) {
    console.log(
      `\n✅ PASS (${fullMode}): all 24 terms within ±${STRICT_TOL_MIN} min.`,
    );
    process.exit(0);
  } else {
    console.log(
      `\n❌ FAIL (${fullMode}): ${finalFailures}/24 terms exceeded ±${STRICT_TOL_MIN} min.`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
