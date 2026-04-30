/**
 * tools/validate_jonheom_saju_master.mjs
 *
 * Compares saju_master's chengbai 격국 (천간 투출 rule) against the
 * 命理存验 prose-stated 격국 (extracted in PR-O-1) to test whether
 * saju_master's classical Chinese chengbai methodology aligns better
 * with classical Chinese authority text than saju-ts's 월지 정기 rule.
 *
 * For each case in test/baseline/authority/jonheom/:
 *   1. Invoke `python -m saju_master.cli --year-pillar ... --month-pillar ...
 *      --day-pillar ... --hour-pillar ... --json` (pillar-input mode).
 *   2. Extract chengbai.overall.best_geok + '격'.
 *   3. Compare against expected.gyeokguk (prose ground truth).
 *
 * Usage: node tools/validate_jonheom_saju_master.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const JONHEOM_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority/jonheom');

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
      execFileSync(candidate, ['-c', 'import swisseph; import korean_lunar_calendar'], { stdio: 'ignore' });
      return candidate;
    } catch { /* try next */ }
  }
  return null;
}

function loadCases() {
  const files = fs.readdirSync(JONHEOM_DIR).filter((f) => f.endsWith('.json'));
  return files
    .map((f) => JSON.parse(fs.readFileSync(path.join(JONHEOM_DIR, f), 'utf-8')))
    .sort((a, b) => a.case_id.localeCompare(b.case_id));
}

function runSajuMaster(c, python) {
  const args = [
    '-m', 'saju_master.cli',
    '--year-pillar', c.pillars.year_pillar,
    '--month-pillar', c.pillars.month_pillar,
    '--day-pillar', c.pillars.day_pillar,
    '--hour-pillar', c.pillars.hour_pillar,
    '--json',
  ];
  const stdout = execFileSync(python, args, {
    cwd: SAJU_MASTER_DIR,
    env: { ...process.env, PYTHONPATH: SAJU_MASTER_DIR, PYTHONIOENCODING: 'utf-8' },
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

function deriveSmcGyeokguk(smc) {
  const overall = smc?.chengbai?.overall || {};
  const bestKo = overall.best_geok || null;
  return bestKo ? `${bestKo}격` : null;
}

function main() {
  if (!fs.existsSync(SAJU_MASTER_DIR)) {
    console.error(`saju_master not found: ${SAJU_MASTER_DIR}`);
    process.exit(2);
  }
  const python = resolvePython();
  if (!python) { console.error('No Python with deps found.'); process.exit(2); }

  const cases = loadCases();
  console.log(`validate_jonheom_saju_master — ${cases.length} cases`);
  console.log(`  saju_master: ${SAJU_MASTER_DIR}`);
  console.log(`  python:      ${python}\n`);

  let smcMatch = 0;
  for (const c of cases) {
    const idShort = c.case_id.replace(/^A2-jonheom_/, '');
    let smcGeok;
    try {
      const smc = runSajuMaster(c, python);
      smcGeok = deriveSmcGyeokguk(smc);
    } catch (err) {
      console.log(`  ERR  ${idShort}: ${String(err.message).split('\n')[0]}`);
      continue;
    }
    const proseGeok = c.expected.gyeokguk;
    const ok = smcGeok === proseGeok;
    const tag = ok ? 'PASS' : 'DIFF';
    console.log(`  [${tag}]  ${idShort} (${c.subject.name_korean}):`);
    console.log(`       pillars: ${c.pillars.year_pillar}/${c.pillars.month_pillar}/${c.pillars.day_pillar}/${c.pillars.hour_pillar}`);
    console.log(`       saju_master chengbai: ${smcGeok}`);
    console.log(`       prose ground truth:   ${proseGeok}  (${c.expected.gyeokguk_basis ?? '-'})`);
    if (ok) smcMatch += 1;
  }

  console.log(`\n──────────────────────────────────`);
  console.log(`saju_master 격국 ↔ 命理存验 prose: ${smcMatch} / ${cases.length}`);
  console.log();
  console.log(`Reference: saju-ts 월지 정기 ↔ 命理存验 prose: 1 / 6 (PR-O-1)`);
  console.log(`           saju-ts 월지 정기 ↔ 명리심리상담사 prose: 11 / 11 (PR-N-1)`);
}

main();
