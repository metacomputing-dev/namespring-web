/**
 * tools/capture_saju_master_runs.mjs
 *
 * Wrapper that invokes the saju_master_project_v9_2 CLI per fixture and
 * writes each output to test/baseline/oracles/<fixture-id>.json. Reference B
 * per `test/baseline/oracles/README.md`.
 *
 * Wired in PR-M-1 against an extracted saju_master_project_v9_2 working tree.
 *
 * Required environment:
 *   SAJU_MASTER_DIR    — path to the extracted saju_master_project_v9_2 tree
 *                        (defaults to `<repo-root>/../saju_master_project_v9_2`).
 *   SAJU_MASTER_PYTHON — python.exe with pyswisseph + korean-lunar-calendar
 *                        installed (defaults to first match of common paths).
 *
 * Usage:
 *   node tools/capture_saju_master_runs.mjs                   # all fixtures
 *   node tools/capture_saju_master_runs.mjs --fixtures fix-01 # specific
 *   node tools/capture_saju_master_runs.mjs --dry-run         # preview only
 *
 * Exit codes:
 *   0 — all requested fixtures captured
 *   1 — at least one fixture failed
 *   2 — CLI directory or Python interpreter not resolvable
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');
const ORACLES_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/oracles');

// ── saju_master location ──────────────────────────────────────────────────
const DEFAULT_SAJU_MASTER_DIR = path.resolve(SPRING_TS_ROOT, '../../../saju_master_project_v9_2');
const SAJU_MASTER_DIR = process.env.SAJU_MASTER_DIR || DEFAULT_SAJU_MASTER_DIR;

const PYTHON_CANDIDATES = [
  process.env.SAJU_MASTER_PYTHON,
  'C:\\miniconda3\\envs\\py311\\python.exe',
  'C:\\miniconda3\\envs\\py310\\python.exe',
  'python3',
  'python',
].filter(Boolean);

function resolvePython() {
  for (const candidate of PYTHON_CANDIDATES) {
    try {
      execFileSync(candidate, ['-c', 'import swisseph; import korean_lunar_calendar'], {
        stdio: 'ignore',
      });
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

// ── ten-god / element / category mapping (saju_master → spring-ts) ────────
const TEN_GOD_KO_TO_GEOKGUK = {
  비견: '비견격', 겁재: '겁재격', 식신: '식신격', 상관: '상관격',
  편재: '편재격', 정재: '정재격', 편관: '편관격', 정관: '정관격',
  편인: '편인격', 정인: '정인격',
};

const NORMAL_GEOK_CODES = new Set([
  'BiJian', 'JieCai', 'ShiShen', 'ShangGuan', 'PianCai',
  'ZhengCai', 'QiSha', 'ZhengGuan', 'PianYin', 'ZhengYin',
]);

const ELEMENT_TO_UPPERCASE = {
  Wood: 'WOOD', Fire: 'FIRE', Earth: 'EARTH', Metal: 'METAL', Water: 'WATER',
};

function categorizeGeokCode(code) {
  if (!code) return null;
  if (NORMAL_GEOK_CODES.has(code)) return '일반';
  return '별격';
}

function mapToOracleSchema(fixture, raw) {
  const overall = raw?.chengbai?.overall || {};
  const bestKo = overall.best_geok || null;
  const bestCode = overall.best_geok_code || null;
  const balancing = raw?.yongsin?.balancing_candidates || [];
  const yongshinPrimary = balancing[0]?.element || null;
  const yongshinSecondary = balancing[1]?.element || null;

  const surfacedCardTypes = [];
  if (raw?.chengbai?.assessments?.length) surfacedCardTypes.push('gyeokguk');
  if (balancing.length) surfacedCardTypes.push('yongshin');
  if (raw?.day_master?.ten_god_distribution || raw?.ten_gods) surfacedCardTypes.push('sipsin');
  if (raw?.shinsal?.positions) surfacedCardTypes.push('shinsal');
  if (raw?.johu?.useful_stems?.length) surfacedCardTypes.push('johu');
  if (raw?.daewoon?.entries?.length) surfacedCardTypes.push('daewoon');
  if (raw?.fortune?.annual_fortune || raw?.fortune?.entries) surfacedCardTypes.push('saeun');

  return {
    case_id: `B-${fixture.id}`,
    source: {
      tool: 'saju_master_project_v9_2',
      version: '9.2',
      command: `python -m saju_master.cli --year ${fixture.birth.year} --month ${fixture.birth.month} --day ${fixture.birth.day} --hour ${fixture.birth.hour ?? 12} --minute ${fixture.birth.minute} --sex ${fixture.birth.gender} --json`,
      capturedAt: new Date().toISOString(),
    },
    expected: {
      gyeokgukType: bestKo ? TEN_GOD_KO_TO_GEOKGUK[bestKo] || `${bestKo}격` : null,
      gyeokgukCategory: categorizeGeokCode(bestCode),
      yongshinElement: ELEMENT_TO_UPPERCASE[yongshinPrimary] || null,
      yongshinHeeshin: ELEMENT_TO_UPPERCASE[yongshinSecondary] || null,
      strengthLevel: raw?.strength?.level || null,
      tenGodEnumeration: [],
      shinsalEnumeration: [],
      scores: {
        totalScore: null,
        hangul: null,
        hanja: null,
        fourFrame: null,
      },
    },
    cards: { surfacedCardTypes },
    axisStrength: {
      yongshin: balancing.length ? 'practical' : 'deferred',
      gyeokguk: bestCode && overall.status === '성격 후보' ? 'definite' : 'practical',
      strength: raw?.strength?.level ? 'definite' : 'deferred',
    },
    hedge: { shouldHedge: !overall.status?.startsWith('성격') },
  };
}

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

// ── CLI invocation ────────────────────────────────────────────────────────
//
// Runs saju_master CLI with the fixture's birth params and parses its JSON
// output. Maps to the oracle schema documented in
// test/baseline/oracles/README.md.
function runSajuMaster(fixture, python) {
  const hour = fixture.birth.hour ?? 12; // unknown-hour fallback (matches saju-adapter DEFAULT_UNKNOWN_HOUR)
  const args = [
    '-m', 'saju_master.cli',
    '--year', String(fixture.birth.year),
    '--month', String(fixture.birth.month),
    '--day', String(fixture.birth.day),
    '--hour', String(hour),
    '--minute', String(fixture.birth.minute),
    '--sex', fixture.birth.gender,
    '--json',
  ];
  const stdout = execFileSync(python, args, {
    cwd: SAJU_MASTER_DIR,
    env: {
      ...process.env,
      PYTHONPATH: SAJU_MASTER_DIR,
      PYTHONIOENCODING: 'utf-8',
    },
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024, // 64 MB — saju_master output is ~1.3 MB per fixture
  });
  const raw = JSON.parse(stdout);
  return mapToOracleSchema(fixture, raw);
}

// ── main ──────────────────────────────────────────────────────────────────
const args = parseArgs(process.argv);

if (!fs.existsSync(FIXTURES_PATH)) {
  console.error(`Fixtures not found: ${FIXTURES_PATH}`);
  process.exit(2);
}

if (!fs.existsSync(SAJU_MASTER_DIR)) {
  console.error(`saju_master not found: ${SAJU_MASTER_DIR}`);
  console.error('Set SAJU_MASTER_DIR to the path of the extracted saju_master_project_v9_2 tree.');
  process.exit(2);
}

const python = args.dryRun ? null : resolvePython();
if (!args.dryRun && !python) {
  console.error('No Python interpreter with pyswisseph + korean-lunar-calendar found.');
  console.error('Set SAJU_MASTER_PYTHON to the python.exe with these dependencies installed.');
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
if (!args.dryRun) {
  console.log(`  saju_master: ${SAJU_MASTER_DIR}`);
  console.log(`  python:      ${python}`);
}

for (const fixture of filtered) {
  const outPath = path.join(ORACLES_DIR, `${fixture.id}.json`);
  console.log(`  ${fixture.id}: ${fixture.label}`);
  if (args.dryRun) {
    console.log(`    → would write ${outPath}`);
    continue;
  }
  try {
    const result = runSajuMaster(fixture, python);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
    console.log(`    → ${result.expected.gyeokgukType ?? '?'} / ${result.expected.yongshinElement ?? '?'} / ${result.expected.strengthLevel ?? '?'}`);
    captured += 1;
  } catch (err) {
    console.error(`    FAIL: ${err.message.split('\n')[0]}`);
    failed += 1;
  }
}

console.log(`\nCaptured: ${captured}, Failed: ${failed}, Skipped: ${filtered.length - captured - failed}`);
process.exit(failed > 0 ? 1 : 0);
