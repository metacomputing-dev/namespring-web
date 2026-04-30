/**
 * tools/validate_lecture_saju_master.mjs
 *
 * Validates saju_master's own gyeokguk classification against the
 * 명리심리상담사_전정훈_교안모음.pdf prose recorded in each lecture case.
 *
 * For each of the 11 lecture cases (test/baseline/authority/lecture/*.json):
 *   1. Invoke `python -m saju_master.cli --lecture-case <id> --json`
 *      (saju_master ships these 11 cases as bundled fixtures, so this
 *       routes through `calculate_chart_from_pillars` rather than calendar
 *       conversion — matching the prose's pillar-input form exactly).
 *   2. Extract `chengbai.overall.best_geok` + classify as 정격 form.
 *   3. Compare against prose-extracted `expected.gyeokguk_initial`
 *      (PR-N-1) or `expected.gyeokguk` when no 변격 transformation.
 *
 * What this tells us:
 *   - PASS: saju_master's chengbai logic agrees with the published prose
 *     classification on this case (saju_master's reference quality
 *     confirmed for 격국 axis).
 *   - FAIL: saju_master's chengbai disagrees with the prose. saju_master
 *     could be using a different rule than the lecture text it claims to
 *     mirror, OR the prose-to-mechanical extraction in PR-N-1 missed a
 *     nuance. Either way it surfaces a real diagnostic.
 *
 * Usage:
 *   npm run validate:lecture-smc      (after package.json wires it)
 *   node tools/validate_lecture_saju_master.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const LECTURE_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority/lecture');

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
    } catch {
      /* try next */
    }
  }
  return null;
}

function loadLectureCases() {
  const files = fs.readdirSync(LECTURE_DIR).filter((f) => f.endsWith('.json') && !f.includes('README'));
  return files
    .map((f) => JSON.parse(fs.readFileSync(path.join(LECTURE_DIR, f), 'utf-8')))
    .sort((a, b) => a.case_id.localeCompare(b.case_id));
}

function caseShortId(caseId) {
  return caseId.replace(/^A1-/, '');
}

function runSajuMaster(caseId, python) {
  const args = ['-m', 'saju_master.cli', '--lecture-case', caseShortId(caseId), '--json'];
  const stdout = execFileSync(python, args, {
    cwd: SAJU_MASTER_DIR,
    env: {
      ...process.env,
      PYTHONPATH: SAJU_MASTER_DIR,
      PYTHONIOENCODING: 'utf-8',
    },
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
    console.error('Set SAJU_MASTER_DIR or extract saju_master_project_v9_2.zip');
    process.exit(2);
  }
  const python = resolvePython();
  if (!python) {
    console.error('No Python interpreter with pyswisseph + korean-lunar-calendar found.');
    process.exit(2);
  }

  const cases = loadLectureCases();
  console.log(`validate_lecture_saju_master — ${cases.length} cases`);
  console.log(`  saju_master: ${SAJU_MASTER_DIR}`);
  console.log(`  python:      ${python}\n`);

  let pass = 0;
  let fail = 0;

  for (const c of cases) {
    const idShort = caseShortId(c.case_id);
    const proseInitial = c.expected?.gyeokguk_initial ?? c.expected?.gyeokguk ?? null;
    if (!proseInitial) {
      console.log(`  SKIP  ${idShort}: no prose gyeokguk recorded`);
      continue;
    }
    let smcGeok;
    try {
      const smc = runSajuMaster(c.case_id, python);
      smcGeok = deriveSmcGyeokguk(smc);
    } catch (err) {
      console.log(`  FAIL  ${idShort}: saju_master CLI error — ${String(err.message).split('\n')[0]}`);
      fail += 1;
      continue;
    }
    const ok = smcGeok === proseInitial;
    if (ok) {
      console.log(`  PASS  ${idShort}: saju_master=${smcGeok} = prose=${proseInitial}`);
      pass += 1;
    } else {
      console.log(`  FAIL  ${idShort}: saju_master=${smcGeok} ≠ prose=${proseInitial}`);
      fail += 1;
    }
  }

  console.log(`\nsaju_master 격국 vs PDF prose 격국: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
