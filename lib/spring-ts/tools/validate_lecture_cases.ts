/**
 * tools/validate_lecture_cases.ts
 *
 * Runs the 11 lecture casebook fixtures (Reference A sub-track) through
 * saju-ts's `tenGodOf()` and compares the resulting **month-branch** ten
 * god (i.e., 月支의 정기 hidden stem 기준) against `expected.month_ten_god`
 * recorded in each case file. The casebook field name says "month" but
 * follows classical 자평 convention of taking the BRANCH's main hidden
 * stem, not the stem-on-stem reading.
 *
 * Loads cases from test/baseline/authority/lecture/*.json. Reports per-case
 * PASS/FAIL plus a summary; exits 0 if all pass, 1 if any fail.
 *
 * What this validates:
 *   - saju-ts's ten-god calculation between day stem and the month
 *     branch's 정기 (main hidden stem). This is the foundational ten-god
 *     surface that 격국·yongshin downstream rules depend on.
 *
 * What this does NOT validate (yet):
 *   - decision_ten_god (similar pattern but day branch, not month).
 *   - activity_keywords (require composite chart inspection, e.g.,
 *     식신생재 needs to detect both 식신 and 재 with a generates link).
 *   - 격국 / yongshin / strength on these charts (those need pillar-input
 *     mode that spring-ts engine does not currently support).
 *
 * Usage:
 *   npx tsx tools/validate_lecture_cases.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { tenGodOf } from '../../saju-ts/src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const LECTURE_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority/lecture');

const STEM_HANJA_ORDER = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const BRANCH_HANJA_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

// Main hidden stem (정기) for each branch, indexed by BranchIdx 0..11.
// Mirrors `lib/saju-ts/src/core/hiddenStems.ts:rawHiddenStemsTable` first row per branch.
const MAIN_HIDDEN_STEM_IDX: number[] = [
  9, // 子 → 癸
  5, // 丑 → 己
  0, // 寅 → 甲
  1, // 卯 → 乙
  4, // 辰 → 戊
  2, // 巳 → 丙
  3, // 午 → 丁
  5, // 未 → 己
  6, // 申 → 庚
  7, // 酉 → 辛
  4, // 戌 → 戊
  8, // 亥 → 壬
];

const TEN_GOD_KO: Record<string, string> = {
  BI_GYEON: '비견',
  GEOB_JAE: '겁재',
  SIK_SHIN: '식신',
  SANG_GWAN: '상관',
  PYEON_JAE: '편재',
  JEONG_JAE: '정재',
  PYEON_GWAN: '편관',
  JEONG_GWAN: '정관',
  PYEON_IN: '편인',
  JEONG_IN: '정인',
};

function stemIdx(hanja: string): number {
  const idx = STEM_HANJA_ORDER.indexOf(hanja as typeof STEM_HANJA_ORDER[number]);
  if (idx < 0) throw new Error(`Unknown stem hanja: ${hanja}`);
  return idx;
}

function branchIdx(hanja: string): number {
  const idx = BRANCH_HANJA_ORDER.indexOf(hanja as typeof BRANCH_HANJA_ORDER[number]);
  if (idx < 0) throw new Error(`Unknown branch hanja: ${hanja}`);
  return idx;
}

function mainHiddenStem(branchHanja: string): number {
  return MAIN_HIDDEN_STEM_IDX[branchIdx(branchHanja)];
}

interface LectureCase {
  case_id: string;
  source: { tradition: string; text: string; page: number };
  subject: { birth_year: number; sex: string; profession: string };
  pillars: {
    year_pillar: string;
    month_pillar: string;
    day_pillar: string;
    hour_pillar: string;
  };
  expected: {
    month_ten_god: string;
    decision_ten_god: string;
    activity_keywords: string[];
  };
}

function loadLectureCases(): LectureCase[] {
  if (!fs.existsSync(LECTURE_DIR)) {
    throw new Error(`Lecture directory not found: ${LECTURE_DIR}`);
  }
  const files = fs.readdirSync(LECTURE_DIR).filter((f) => f.endsWith('.json'));
  return files
    .map((f) => JSON.parse(fs.readFileSync(path.join(LECTURE_DIR, f), 'utf-8')) as LectureCase)
    .sort((a, b) => a.case_id.localeCompare(b.case_id));
}

interface CaseValidation {
  monthPass: boolean;
  decisionPass: boolean;
  monthComputed: string;
  monthExpected: string;
  decisionComputed: string;
  decisionExpected: string;
}

function validateCase(c: LectureCase): CaseValidation {
  const dayStemIdx = stemIdx(c.pillars.day_pillar.charAt(0));
  const monthBranchMainIdx = mainHiddenStem(c.pillars.month_pillar.charAt(1));
  const dayBranchMainIdx = mainHiddenStem(c.pillars.day_pillar.charAt(1));

  const monthCode = tenGodOf(dayStemIdx, monthBranchMainIdx);
  const decisionCode = tenGodOf(dayStemIdx, dayBranchMainIdx);

  const monthKo = TEN_GOD_KO[monthCode] ?? monthCode;
  const decisionKo = TEN_GOD_KO[decisionCode] ?? decisionCode;

  return {
    monthPass: monthKo === c.expected.month_ten_god,
    decisionPass: decisionKo === c.expected.decision_ten_god,
    monthComputed: monthKo,
    monthExpected: c.expected.month_ten_god,
    decisionComputed: decisionKo,
    decisionExpected: c.expected.decision_ten_god,
  };
}

function main(): void {
  const cases = loadLectureCases();
  console.log(`validate_lecture_cases — ${cases.length} cases\n`);

  let monthPass = 0;
  let monthFail = 0;
  let decisionPass = 0;
  let decisionFail = 0;

  for (const c of cases) {
    const r = validateCase(c);
    const idShort = c.case_id.replace(/^A1-/, '');
    const monthTag = r.monthPass ? 'PASS' : 'FAIL';
    const decisionTag = r.decisionPass ? 'PASS' : 'FAIL';
    const monthDetail = r.monthPass ? `month=${r.monthComputed}` : `month=${r.monthComputed} (expected ${r.monthExpected})`;
    const decisionDetail = r.decisionPass ? `decision=${r.decisionComputed}` : `decision=${r.decisionComputed} (expected ${r.decisionExpected})`;
    console.log(`  ${idShort}:`);
    console.log(`    [${monthTag}] ${monthDetail}`);
    console.log(`    [${decisionTag}] ${decisionDetail}`);
    if (r.monthPass) monthPass += 1; else monthFail += 1;
    if (r.decisionPass) decisionPass += 1; else decisionFail += 1;
  }

  console.log(`\nMonth-branch ten-god:    ${monthPass} PASS / ${monthFail} FAIL`);
  console.log(`Decision (day-branch):   ${decisionPass} PASS / ${decisionFail} FAIL`);
  const totalFail = monthFail + decisionFail;
  process.exit(totalFail === 0 ? 0 : 1);
}

main();
