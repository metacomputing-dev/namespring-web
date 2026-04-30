/**
 * tools/measure_alternative_gyeokguk_rules.ts
 *
 * Measurement-only tool. Simulates alternative 격국 selection rules
 * against the cumulative Reference A authority data and reports
 * per-rule agreement rate. NO production code change.
 *
 * Rules tested:
 *   1. **monthly_main** (default — saju-ts current):
 *      tenGodOf(dayStem, mainHiddenOf(monthBranch)) + '격'
 *
 *   2. **monthly_jungki_transparent**:
 *      If 月支의 中氣 hidden stem is transparent (투출) in 年/月/時 천간,
 *      use that ten-god instead. Otherwise fall back to monthly_main.
 *
 *   3. **monthly_full_transparent**:
 *      Among 月支의 모든 hidden stems (정기/中氣/餘氣), pick the one
 *      that is transparent in 천간. Priority: 정기 > 中氣 > 餘氣.
 *      Used by 자평진전 evaluation in 명리존험.
 *
 *   4. **monthly_priority_transparent**:
 *      Same as monthly_full but 中氣 takes priority over 정기 when both
 *      are transparent (the 잡기 case). This is the 잡기정인격 rule.
 *
 * Reports per-source: PASS / DIFF / N/A counts and rate.
 *
 * Usage: npx tsx tools/measure_alternative_gyeokguk_rules.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { tenGodOf } from '../../saju-ts/src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');

const STEM_HANJA_ORDER = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const BRANCH_HANJA_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

// Hidden stems per branch in [main, middle, residual] order (idx values).
// undefined means that role has no stem in this branch (子/卯/午/酉 single-stem; 寅/巳/申/亥 three-stem).
const HIDDEN_STEMS: Array<[number, number | undefined, number | undefined]> = [
  /* 子 */ [9, undefined, undefined],
  /* 丑 */ [5, 9, 7],         // 己 main, 癸 middle, 辛 residual
  /* 寅 */ [0, 2, 4],         // 甲 main, 丙 middle, 戊 residual
  /* 卯 */ [1, undefined, undefined],
  /* 辰 */ [4, 1, 9],         // 戊 main, 乙 middle, 癸 residual
  /* 巳 */ [2, 6, 4],         // 丙 main, 庚 middle, 戊 residual
  /* 午 */ [3, undefined, 5], // 丁 main, 己 residual
  /* 未 */ [5, 3, 1],         // 己 main, 丁 middle, 乙 residual
  /* 申 */ [6, 8, 4],         // 庚 main, 壬 middle, 戊 residual
  /* 酉 */ [7, undefined, undefined],
  /* 戌 */ [4, 7, 3],         // 戊 main, 辛 middle, 丁 residual
  /* 亥 */ [8, 0, undefined], // 壬 main, 甲 middle
];

const TEN_GOD_KO: Record<string, string> = {
  BI_GYEON: '비견', GEOB_JAE: '겁재', SIK_SHIN: '식신', SANG_GWAN: '상관',
  PYEON_JAE: '편재', JEONG_JAE: '정재', PYEON_GWAN: '편관', JEONG_GWAN: '정관',
  PYEON_IN: '편인', JEONG_IN: '정인',
};

const FAMILY: Record<string, Set<string>> = {
  '종재격': new Set(['정재격', '편재격']),
  '종아격': new Set(['식신격', '상관격']),
  '종관격': new Set(['정관격', '편관격']),
  '종인격': new Set(['정인격', '편인격']),
  '종비격': new Set(['비견격', '겁재격']),
  '종왕격': new Set(['비견격', '겁재격', '정인격', '편인격']),
};

function stemIdx(h: string): number { return STEM_HANJA_ORDER.indexOf(h as typeof STEM_HANJA_ORDER[number]); }
function branchIdx(h: string): number { return BRANCH_HANJA_ORDER.indexOf(h as typeof BRANCH_HANJA_ORDER[number]); }

interface CaseRec {
  case_id: string;
  pillars: { year_pillar: string; month_pillar: string; day_pillar: string; hour_pillar: string };
  expected_gyeokguk: string | null;
  expected_alt_gyeokguk?: string[];
  comparable: boolean | 'partial';
  source_label: string;
  short_name: string;
}

function pillarOf(p: string): { stem: string; branch: string } { return { stem: p.charAt(0), branch: p.charAt(1) }; }
function nonDayTransparentStems(c: CaseRec): number[] {
  const yps = pillarOf(c.pillars.year_pillar).stem;
  const mps = pillarOf(c.pillars.month_pillar).stem;
  const hps = pillarOf(c.pillars.hour_pillar).stem;
  return [yps, mps, hps].filter(Boolean).map(stemIdx).filter((i) => i >= 0);
}

function ruleMonthlyMain(c: CaseRec): string {
  const dIdx = stemIdx(c.pillars.day_pillar.charAt(0));
  const bIdx = branchIdx(c.pillars.month_pillar.charAt(1));
  const main = HIDDEN_STEMS[bIdx][0];
  return `${TEN_GOD_KO[tenGodOf(dIdx, main)] ?? '?'}격`;
}

function ruleMonthlyJungkiTransparent(c: CaseRec): string {
  const dIdx = stemIdx(c.pillars.day_pillar.charAt(0));
  const bIdx = branchIdx(c.pillars.month_pillar.charAt(1));
  const [main, middle] = HIDDEN_STEMS[bIdx];
  const transparent = nonDayTransparentStems(c);
  if (middle !== undefined && transparent.includes(middle)) {
    return `${TEN_GOD_KO[tenGodOf(dIdx, middle)] ?? '?'}격`;
  }
  return `${TEN_GOD_KO[tenGodOf(dIdx, main)] ?? '?'}격`;
}

function ruleMonthlyFullTransparent(c: CaseRec): string {
  const dIdx = stemIdx(c.pillars.day_pillar.charAt(0));
  const bIdx = branchIdx(c.pillars.month_pillar.charAt(1));
  const [main, middle, residual] = HIDDEN_STEMS[bIdx];
  const transparent = new Set(nonDayTransparentStems(c));
  // priority: main > middle > residual when transparent
  if (transparent.has(main)) return `${TEN_GOD_KO[tenGodOf(dIdx, main)] ?? '?'}격`;
  if (middle !== undefined && transparent.has(middle)) return `${TEN_GOD_KO[tenGodOf(dIdx, middle)] ?? '?'}격`;
  if (residual !== undefined && transparent.has(residual)) return `${TEN_GOD_KO[tenGodOf(dIdx, residual)] ?? '?'}격`;
  return `${TEN_GOD_KO[tenGodOf(dIdx, main)] ?? '?'}격`;
}

function ruleMonthlyPriorityTransparent(c: CaseRec): string {
  // 잡기 case: 中氣 priority over 정기 when both transparent
  const dIdx = stemIdx(c.pillars.day_pillar.charAt(0));
  const bIdx = branchIdx(c.pillars.month_pillar.charAt(1));
  const [main, middle, residual] = HIDDEN_STEMS[bIdx];
  const transparent = new Set(nonDayTransparentStems(c));
  if (middle !== undefined && transparent.has(middle)) return `${TEN_GOD_KO[tenGodOf(dIdx, middle)] ?? '?'}격`;
  if (transparent.has(main)) return `${TEN_GOD_KO[tenGodOf(dIdx, main)] ?? '?'}격`;
  if (residual !== undefined && transparent.has(residual)) return `${TEN_GOD_KO[tenGodOf(dIdx, residual)] ?? '?'}격`;
  return `${TEN_GOD_KO[tenGodOf(dIdx, main)] ?? '?'}격`;
}

const RULES = {
  monthly_main: ruleMonthlyMain,
  monthly_jungki_transparent: ruleMonthlyJungkiTransparent,
  monthly_full_transparent: ruleMonthlyFullTransparent,
  monthly_priority_transparent: ruleMonthlyPriorityTransparent,
};

interface SourceTally {
  source: string;
  cases: CaseRec[];
}

function loadAllCases(): SourceTally[] {
  const out: SourceTally[] = [];

  // Lecture cases (14)
  const lectureDir = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority/lecture');
  const lectureCases: CaseRec[] = fs.readdirSync(lectureDir)
    .filter((f) => f.endsWith('.json') && !f.includes('README'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(lectureDir, f), 'utf-8')))
    .map((d): CaseRec => ({
      case_id: d.case_id,
      pillars: d.pillars,
      expected_gyeokguk: d.expected?.gyeokguk_initial ?? d.expected?.gyeokguk ?? null,
      comparable: !!d.expected?.gyeokguk,
      source_label: 'lecture (한국 modern strict 월지 정기)',
      short_name: d.case_id.replace('A1-', ''),
    }));
  out.push({ source: '명리심리상담사 lecture', cases: lectureCases });

  // Jonheom cases (6 from PR-O-1)
  const jonheomDir = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority/jonheom');
  const jonheomCases: CaseRec[] = fs.readdirSync(jonheomDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(jonheomDir, f), 'utf-8')))
    .map((d): CaseRec => ({
      case_id: d.case_id,
      pillars: d.pillars,
      expected_gyeokguk: d.expected?.gyeokguk_initial ?? d.expected?.gyeokguk ?? null,
      comparable: !!d.expected?.gyeokguk,
      source_label: '명리존험 (Chinese classical)',
      short_name: d.case_id.replace('A2-jonheom_', ''),
    }));
  out.push({ source: '명리존험', cases: jonheomCases });

  // Figures (9) + chumyeongga (2) — comparable subset
  const figDir = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority/figures');
  const chuDir = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority/chumyeongga');
  const figCases: CaseRec[] = [...fs.readdirSync(figDir), ...fs.readdirSync(chuDir).map((f) => `chu/${f}`)]
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const dir = f.startsWith('chu/') ? chuDir : figDir;
      const fn = f.startsWith('chu/') ? f.replace('chu/', '') : f;
      return JSON.parse(fs.readFileSync(path.join(dir, fn), 'utf-8'));
    })
    .map((d): CaseRec => ({
      case_id: d.case_id,
      pillars: d.birth,
      expected_gyeokguk: d.expected?.gyeokguk ?? null,
      expected_alt_gyeokguk: d.expected?.gyeokguk_alt,
      comparable: d.expected?.comparable ?? false,
      source_label: '한국 modern figures + 추명가',
      short_name: d.subject?.korean ?? d.page_label ?? d.case_id,
    }));
  out.push({ source: '한국 modern figures + 추명가', cases: figCases });

  return out;
}

function compareResult(computed: string, c: CaseRec): 'PASS' | 'PARTIAL' | 'DIFF' | 'N/A' {
  if (c.comparable === false || !c.expected_gyeokguk) return 'N/A';
  if (computed === c.expected_gyeokguk) return 'PASS';
  if (c.expected_alt_gyeokguk?.includes(computed.replace('격', '격'))) return 'PASS';
  if (c.comparable === 'partial') {
    const fam = FAMILY[c.expected_gyeokguk];
    if (fam && fam.has(computed)) return 'PARTIAL';
  }
  return 'DIFF';
}

function main(): void {
  const sources = loadAllCases();
  console.log(`measure_alternative_gyeokguk_rules — ${sources.reduce((n, s) => n + s.cases.length, 0)} cases across ${sources.length} sources\n`);

  const headers = ['SOURCE', 'monthly_main', 'jungki_t', 'full_t', 'priority_t'];
  const widths = [40, 14, 12, 10, 13];
  console.log(headers.map((h, i) => h.padEnd(widths[i])).join(''));
  console.log(widths.map((w) => '-'.repeat(w - 1)).join(' '));

  const grandTotals: Record<string, { pass: number; partial: number; diff: number; na: number }> = {};
  for (const ruleName of Object.keys(RULES)) {
    grandTotals[ruleName] = { pass: 0, partial: 0, diff: 0, na: 0 };
  }

  for (const src of sources) {
    const row: string[] = [src.source.length > 39 ? src.source.slice(0, 38) + '…' : src.source];
    for (const ruleName of Object.keys(RULES) as Array<keyof typeof RULES>) {
      let pass = 0, partial = 0, diff = 0, na = 0;
      for (const c of src.cases) {
        const computed = RULES[ruleName](c);
        const r = compareResult(computed, c);
        if (r === 'PASS') pass += 1;
        else if (r === 'PARTIAL') partial += 1;
        else if (r === 'DIFF') diff += 1;
        else na += 1;
      }
      const comparable = pass + partial + diff;
      const rate = comparable > 0 ? (((pass + partial) / comparable) * 100).toFixed(0) : '-';
      row.push(`${pass}/${comparable} ${rate}%`);
      grandTotals[ruleName].pass += pass;
      grandTotals[ruleName].partial += partial;
      grandTotals[ruleName].diff += diff;
      grandTotals[ruleName].na += na;
    }
    console.log(row.map((v, i) => v.padEnd(widths[i])).join(''));
  }

  console.log(widths.map((w) => '-'.repeat(w - 1)).join(' '));
  const totalRow: string[] = ['TOTAL'];
  for (const ruleName of Object.keys(RULES)) {
    const t = grandTotals[ruleName];
    const comparable = t.pass + t.partial + t.diff;
    const rate = comparable > 0 ? (((t.pass + t.partial) / comparable) * 100).toFixed(1) : '-';
    totalRow.push(`${t.pass}/${comparable} ${rate}%`);
  }
  console.log(totalRow.map((v, i) => v.padEnd(widths[i])).join(''));
  console.log();
  console.log('Note: rates count PASS only (not PARTIAL family-match). N/A excluded from denominator.');
  console.log();
  console.log('Rule descriptions:');
  console.log('  monthly_main         — current saju-ts default. month branch main hidden ten-god.');
  console.log('  jungki_transparent   — if 中氣 transparent in 천간, use 中氣; else fall back to main.');
  console.log('  full_transparent     — among 정기/中氣/餘氣, prefer transparent. priority main>middle>residual.');
  console.log('  priority_transparent — same as full but 中氣 priority > 정기 (the 잡기 rule).');
}

main();
