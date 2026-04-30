/**
 * tools/compare_engines_classical.mjs
 *
 * Compares saju-ts's classical 정격 추론 (month_branch_main_hidden +
 * '격') against saju_master's chengbai 'best_geok' classification on
 * the 38 cases auto-extracted from 命理存验 (test/baseline/authority/
 * classical/myeongri_jonheom_pillars.json).
 *
 * Both engines see the same 4 pillars (pillar-input mode) so we compare
 * their classification, not their pillar derivation. saju-ts uses the
 * '월지 정기' rule; saju_master's chengbai uses the '월간/투간 투출'
 * rule — see PR-N-2 for the methodology gap on the 11 lecture cases.
 *
 * This PR runs the same comparison at larger sample size (38 vs 11) and
 * reports the agreement rate. With no published prose to compare
 * against on these classical cases (한자 깨짐 — see myeongri_jonheom_
 * pillars.json), this is purely an inter-engine agreement diagnostic.
 *
 * Usage: node tools/compare_engines_classical.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const COLLECTION_PATH = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority/classical/myeongri_jonheom_pillars.json');

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

const STEM_HANJA_ORDER = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCH_HANJA_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const MAIN_HIDDEN_STEM_IDX = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];

const TEN_GOD_KO = {
  BI_GYEON: '비견', GEOB_JAE: '겁재', SIK_SHIN: '식신', SANG_GWAN: '상관',
  PYEON_JAE: '편재', JEONG_JAE: '정재', PYEON_GWAN: '편관', JEONG_GWAN: '정관',
  PYEON_IN: '편인', JEONG_IN: '정인',
};

function stemIdx(h) { return STEM_HANJA_ORDER.indexOf(h); }
function branchIdx(h) { return BRANCH_HANJA_ORDER.indexOf(h); }

const SAME = (i, j) => Math.floor(i / 2) === Math.floor(j / 2);  // same element index 0..4
function tenGodPure(dayIdx, otherIdx) {
  const dayElem = Math.floor(dayIdx / 2);
  const otherElem = Math.floor(otherIdx / 2);
  const samePolarity = (dayIdx % 2) === (otherIdx % 2);
  const generates = (a, b) => (a + 1) % 5 === b;
  const controls = (a, b) => (a + 2) % 5 === b;

  if (dayElem === otherElem) return samePolarity ? 'BI_GYEON' : 'GEOB_JAE';
  if (generates(dayElem, otherElem)) return samePolarity ? 'SIK_SHIN' : 'SANG_GWAN';
  if (generates(otherElem, dayElem)) return samePolarity ? 'PYEON_IN' : 'JEONG_IN';
  if (controls(dayElem, otherElem)) return samePolarity ? 'PYEON_JAE' : 'JEONG_JAE';
  if (controls(otherElem, dayElem)) return samePolarity ? 'PYEON_GWAN' : 'JEONG_GWAN';
  return 'BI_GYEON';
}

function sajuTsGyeokguk(c) {
  const dayStemHanja = c.pillars.day_pillar.charAt(0);
  const monthBranchHanja = c.pillars.month_pillar.charAt(1);
  const dayIdx = stemIdx(dayStemHanja);
  const branchMainStemIdx = MAIN_HIDDEN_STEM_IDX[branchIdx(monthBranchHanja)];
  const code = tenGodPure(dayIdx, branchMainStemIdx);
  return `${TEN_GOD_KO[code]}격`;
}

function sajuMasterGyeokguk(c, python) {
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
  const raw = JSON.parse(stdout);
  const ko = raw?.chengbai?.overall?.best_geok || null;
  return ko ? `${ko}격` : null;
}

function main() {
  if (!fs.existsSync(COLLECTION_PATH)) {
    console.error(`Collection not found: ${COLLECTION_PATH}`);
    process.exit(2);
  }
  if (!fs.existsSync(SAJU_MASTER_DIR)) {
    console.error(`saju_master not found: ${SAJU_MASTER_DIR}`);
    process.exit(2);
  }
  const python = resolvePython();
  if (!python) { console.error('No Python with pyswisseph + korean-lunar-calendar found.'); process.exit(2); }

  const collection = JSON.parse(fs.readFileSync(COLLECTION_PATH, 'utf-8'));
  const cases = collection.cases || [];
  console.log(`compare_engines_classical — ${cases.length} cases\n  saju_master: ${SAJU_MASTER_DIR}\n  python:      ${python}\n`);

  let agree = 0;
  let disagree = 0;
  const disagreements = [];

  for (const c of cases) {
    const sst = sajuTsGyeokguk(c);
    let smc;
    try {
      smc = sajuMasterGyeokguk(c, python);
    } catch (err) {
      console.log(`  ERR  ${c.case_id}: saju_master failed — ${String(err.message).split('\n')[0]}`);
      disagree += 1;
      disagreements.push({ case_id: c.case_id, sst, smc: '(error)' });
      continue;
    }
    const ok = sst === smc;
    const tag = ok ? 'AGREE' : 'DIFF ';
    const p = c.pillars;
    console.log(`  [${tag}] ${c.case_id}  ${p.year_pillar}/${p.month_pillar}/${p.day_pillar}/${p.hour_pillar}  saju-ts=${sst}  saju_master=${smc}`);
    if (ok) agree += 1; else { disagree += 1; disagreements.push({ case_id: c.case_id, sst, smc }); }
  }

  const total = agree + disagree;
  const pct = total > 0 ? ((agree / total) * 100).toFixed(1) : '-';
  console.log(`\nInter-engine agreement on classical 명리존험 sample (${total} cases): ${agree} AGREE / ${disagree} DIFF (${pct}%)`);
  if (disagreements.length > 0) {
    console.log(`\nDisagreement breakdown by saju-ts vs saju_master classification:`);
    const counts = {};
    for (const d of disagreements) {
      const key = `${d.sst} vs ${d.smc}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${v}× ${k}`);
    }
  }

  process.exit(0);
}

main();
