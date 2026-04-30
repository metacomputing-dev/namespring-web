/**
 * tools/capture_saju_master_runs.mjs
 *
 * Wrapper that invokes the saju_master_project_v9_2 CLI per fixture and
 * writes each output to test/baseline/oracles/<fixture-id>.json. Per
 * F-A12 (`spring-info/09_finalization/12_korean_top_baseline.md` §B).
 *
 * Status: PLACEHOLDER. The saju_master CLI lives in the parent
 * `saju_master_project_v9_2.zip` archive and isn't materialised in the
 * spring-ts working tree. This script is shipped as a stub so:
 *   1. The capture-runs pipeline has a known entry point
 *      (`npm run capture:oracles`).
 *   2. Future sessions that have the CLI extracted can implement the
 *      `runSajuMaster()` body without changing the consumer-facing
 *      interface (output format already specified by oracle README).
 *
 * Usage (after CLI is wired):
 *   node tools/capture_saju_master_runs.mjs                   # all fixtures
 *   node tools/capture_saju_master_runs.mjs --fixtures fix-01 # specific
 *   node tools/capture_saju_master_runs.mjs --dry-run         # preview only
 *
 * Exit codes:
 *   0 — all requested fixtures captured
 *   1 — at least one fixture failed
 *   2 — CLI unavailable (placeholder — current behavior)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');
const ORACLES_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/oracles');

// ── arg parsing ───────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { fixtures: null, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--fixtures' && argv[i + 1]) {
      args.fixtures = argv[i + 1].split(',').map((s) => s.trim());
    } else if (argv[i] === '--dry-run') {
      args.dryRun = true;
    }
  }
  return args;
}

// ── CLI invocation (placeholder) ──────────────────────────────────────────
//
// To activate, replace the body with a `child_process.execFileSync` call
// that runs the saju_master CLI with the fixture's birth + saju_master's
// `--json` flag, then return its parsed JSON. Output should follow the
// schema in test/baseline/oracles/README.md.
function runSajuMaster(fixture) {
  void fixture;
  throw new Error(
    `[capture_saju_master_runs] saju_master CLI is not wired in this checkout.\n` +
      `  fixture: ${fixture.id} (${fixture.label})\n` +
      `  next steps: extract saju_master_project_v9_2.zip into a sibling directory,\n` +
      `              install its python dependencies, and replace runSajuMaster() body\n` +
      `              with an execFileSync call. See test/baseline/oracles/README.md for\n` +
      `              the expected output schema.`
  );
}

// ── main ──────────────────────────────────────────────────────────────────
const args = parseArgs(process.argv);

if (!fs.existsSync(FIXTURES_PATH)) {
  console.error(`Fixtures not found: ${FIXTURES_PATH}`);
  process.exit(2);
}

const fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8')).fixtures;
const filtered = args.fixtures
  ? fixtures.filter((f) => {
      const ids = args.fixtures.map((s) => (s.startsWith('fix-') ? s : `fix-${s}`));
      return ids.includes(f.id);
    })
  : fixtures;

if (!fs.existsSync(ORACLES_DIR)) fs.mkdirSync(ORACLES_DIR, { recursive: true });

let captured = 0;
let failed = 0;

console.log(`capture_saju_master_runs — ${filtered.length} fixture(s)${args.dryRun ? ' [DRY RUN]' : ''}`);

for (const fixture of filtered) {
  const outPath = path.join(ORACLES_DIR, `${fixture.id}.json`);
  console.log(`  ${fixture.id}: ${fixture.label}`);
  if (args.dryRun) {
    console.log(`    → would write ${outPath}`);
    continue;
  }
  try {
    const result = runSajuMaster(fixture);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
    captured += 1;
  } catch (err) {
    console.error(`    FAIL: ${err.message.split('\n')[0]}`);
    failed += 1;
    // First failure is enough to surface the placeholder state; bail out.
    if (failed === 1 && /saju_master CLI is not wired/.test(err.message)) {
      console.error('');
      console.error(err.message.split('\n').slice(1).join('\n'));
      process.exit(2);
    }
  }
}

console.log(`\nCaptured: ${captured}, Failed: ${failed}, Skipped: ${filtered.length - captured - failed}`);
process.exit(failed > 0 ? 1 : 0);
