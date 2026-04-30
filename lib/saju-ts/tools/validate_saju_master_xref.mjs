#!/usr/bin/env node
/**
 * Cross-validate the engine against the saju_master v9.2 education
 * casebook (`tests/precision/fixtures/saju_master_education_cases.json`).
 *
 * For every fixture case that carries a known birth.instant we ask the
 * engine for the four-pillar text and compare year/month/day/hour
 * against the recorded expectation. Direct-ganji-only cases (1972,
 * 1966, 1964) are skipped — they have no clock instant to feed.
 *
 * Two boundary samples are also exercised:
 *   - day-pillar-2000-01-01 (whole-day day-pillar check)
 *   - ipchun-2024 (year ganji 直前/直後 at safe whole-day margins)
 *
 * Usage (after building):
 *   npm run validate:xref
 *
 * Exits 0 when every case matches, 1 otherwise.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const FIXTURE_PATH = resolve(
  ROOT,
  'tests/precision/fixtures/saju_master_education_cases.json',
);
const ENGINE_MODULE = resolve(ROOT, 'dist/api/engine.js');

const SEOUL = { lat: 37.5665, lon: 126.978, name: 'Seoul' };

function pillarText(view) {
  return `${view.stem.text}${view.branch.text}`;
}

async function main() {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
  const { createEngine } = await import(pathToFileURL(ENGINE_MODULE).href);
  const engine = createEngine();

  const rows = [];

  // Education casebook cases with explicit birth.instant
  for (const c of fixture.cases) {
    if (!c.birth?.instant) continue;
    const r = engine.analyze({
      birth: { instant: c.birth.instant },
      sex: c.birth.sex ?? 'U',
      location: SEOUL,
    });
    const got = {
      year: pillarText(r.summary.pillars.year),
      month: pillarText(r.summary.pillars.month),
      day: pillarText(r.summary.pillars.day),
      hour: pillarText(r.summary.pillars.hour),
    };
    const exp = c.expected;
    const ok =
      got.year === exp.yearGanji &&
      got.month === exp.monthGanji &&
      got.day === exp.dayGanji &&
      got.hour === exp.hourGanji;
    rows.push({ id: c.id, ok, expected: exp, got });
  }

  // Additional samples we can exercise
  for (const s of fixture.additionalSamples ?? []) {
    if (s.id === 'day-pillar-2000-01-01') {
      const r = engine.analyze({
        birth: { instant: `${s.solarDate}T12:00:00+09:00` },
        sex: 'U',
        location: SEOUL,
      });
      const got = pillarText(r.summary.pillars.day);
      rows.push({
        id: s.id,
        ok: got === s.expected.dayGanji,
        expected: { dayGanji: s.expected.dayGanji },
        got: { day: got },
      });
    }

    if (s.id === 'ipchun-2024') {
      const before = engine.analyze({
        birth: { instant: '2024-02-04T00:00:00+09:00' },
        sex: 'U',
        location: SEOUL,
      });
      const after = engine.analyze({
        birth: { instant: '2024-02-05T00:00:00+09:00' },
        sex: 'U',
        location: SEOUL,
      });
      const beforeY = pillarText(before.summary.pillars.year);
      const afterY = pillarText(after.summary.pillars.year);
      rows.push({
        id: `${s.id} (before / after at safe whole-day margins)`,
        ok:
          beforeY === s.expected.before.yearGanji &&
          afterY === s.expected.after.yearGanji,
        expected: {
          before: s.expected.before.yearGanji,
          after: s.expected.after.yearGanji,
        },
        got: { before: beforeY, after: afterY },
      });
    }
  }

  console.log('saju_master education cross-validation');
  console.log('======================================');
  console.log('Fixture: tests/precision/fixtures/saju_master_education_cases.json\n');

  let pass = 0;
  let fail = 0;
  for (const r of rows) {
    if (r.ok) {
      console.log(`  ✓ ${r.id}`);
      pass++;
    } else {
      console.log(`  ✗ ${r.id}`);
      console.log(`      expected: ${JSON.stringify(r.expected)}`);
      console.log(`      got:      ${JSON.stringify(r.got)}`);
      fail++;
    }
  }

  console.log('');
  if (fail === 0) {
    console.log(`✅ PASS: ${pass}/${pass + fail} cases match saju_master.`);
    process.exit(0);
  } else {
    console.log(`❌ FAIL: ${fail}/${pass + fail} cases drifted from saju_master.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
