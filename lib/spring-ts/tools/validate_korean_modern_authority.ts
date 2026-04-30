/**
 * tools/validate_korean_modern_authority.ts
 *
 * Validates saju-ts's classical 정격 추론 (월지 정기 ten-god + '격')
 * against Korean modern authority cases — 9 HIGH-confidence Korean
 * leaders + 2 추명가 명확 cases. Phase P-1.
 *
 * Each case JSON declares `expected.comparable`:
 *   - true     : prose 정·편 격국 attribution → direct compare
 *   - 'partial': special-class label (종재/종아) → family compare
 *   - false    : special pattern (양팔통 / 사금 / 오행구족) → N/A
 *
 * Family compare (partial):
 *   종재격     ⊃ {정재격, 편재격}
 *   종아격     ⊃ {식신격, 상관격}
 *   종관격     ⊃ {정관격, 편관격}
 *   종인격     ⊃ {정인격, 편인격}
 *   종비/종왕  ⊃ {비견격, 겁재격}
 *
 * Reports per-case PASS/PARTIAL/DIFF/N/A and aggregate pass-rate.
 *
 * Usage: npx tsx tools/validate_korean_modern_authority.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { tenGodOf } from '../../saju-ts/src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const FIGURES_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority/figures');
const CHUMYEONGGA_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority/chumyeongga');

const STEM_HANJA_ORDER = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const BRANCH_HANJA_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
const MAIN_HIDDEN_STEM_IDX: number[] = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];

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

function stemIdx(h: string): number {
  return STEM_HANJA_ORDER.indexOf(h as typeof STEM_HANJA_ORDER[number]);
}
function branchIdx(h: string): number {
  return BRANCH_HANJA_ORDER.indexOf(h as typeof BRANCH_HANJA_ORDER[number]);
}

interface AuthorityCase {
  case_id: string;
  subject?: { korean: string; hanja: string; role: string };
  page_label?: string;
  birth: {
    year_pillar: string; month_pillar: string; day_pillar: string; hour_pillar: string;
    gender?: string;
  };
  expected: {
    gyeokguk: string | null;
    gyeokguk_alt?: string[];
    gyeokguk_classical_form?: string;
    gyeokguk_basis?: string;
    comparable: boolean | 'partial';
    special_pattern?: string;
  };
  prose_quote?: string;
}

function loadCases(dir: string): AuthorityCase[] {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as AuthorityCase)
    .sort((a, b) => a.case_id.localeCompare(b.case_id));
}

function sajuTsClassical(c: AuthorityCase): string {
  const dayStem = c.birth.day_pillar.charAt(0);
  const monthBranch = c.birth.month_pillar.charAt(1);
  const dayIdx = stemIdx(dayStem);
  const branchMain = MAIN_HIDDEN_STEM_IDX[branchIdx(monthBranch)];
  const code = tenGodOf(dayIdx, branchMain);
  return `${TEN_GOD_KO[code] ?? code}격`;
}

function compareGyeokguk(computed: string, expected: string | null, comparable: boolean | 'partial'): 'PASS' | 'PARTIAL' | 'DIFF' | 'N/A' {
  if (comparable === false || !expected) return 'N/A';
  if (computed === expected) return 'PASS';
  if (comparable === 'partial') {
    const family = FAMILY[expected];
    if (family && family.has(computed)) return 'PARTIAL';
  }
  return 'DIFF';
}

function shortName(c: AuthorityCase): string {
  if (c.subject) return c.subject.korean;
  if (c.page_label) return c.page_label;
  return c.case_id;
}

function main(): void {
  const figures = loadCases(FIGURES_DIR);
  const chu = loadCases(CHUMYEONGGA_DIR);
  const all = [...figures, ...chu];

  console.log(`validate_korean_modern_authority — ${all.length} cases (${figures.length} figures + ${chu.length} 추명가)\n`);

  let pass = 0, partial = 0, diff = 0, na = 0;
  for (const c of all) {
    const computed = sajuTsClassical(c);
    const expected = c.expected.gyeokguk;
    const comparable = c.expected.comparable;
    const result = compareGyeokguk(computed, expected, comparable);

    const tag = result;
    const expDisplay = expected ?? '(special pattern)';
    const altText = c.expected.gyeokguk_alt && c.expected.gyeokguk_alt.length
      ? ` [alt: ${c.expected.gyeokguk_alt.join(', ')}]`
      : '';
    const pat = c.expected.special_pattern ? ` { ${c.expected.special_pattern} }` : '';

    console.log(`  [${tag.padEnd(7)}] ${shortName(c).padEnd(30)} pillars=${c.birth.year_pillar}/${c.birth.month_pillar}/${c.birth.day_pillar}/${c.birth.hour_pillar}`);
    console.log(`               saju-ts: ${computed}  prose: ${expDisplay}${altText}${pat}`);
    if (c.expected.gyeokguk_basis) {
      console.log(`               basis: ${c.expected.gyeokguk_basis}`);
    }

    if (result === 'PASS') pass += 1;
    else if (result === 'PARTIAL') partial += 1;
    else if (result === 'DIFF') diff += 1;
    else na += 1;
  }

  console.log();
  console.log(`──────────────────────────────────`);
  console.log(`saju-ts 월지 정기 ↔ 한국 modern authority prose:`);
  console.log(`  PASS:    ${pass}`);
  console.log(`  PARTIAL: ${partial}  (family-level match for 종X격)`);
  console.log(`  DIFF:    ${diff}`);
  console.log(`  N/A:     ${na}  (special pattern, not 정·편 격)`);
  console.log();
  const comparable = pass + partial + diff;
  if (comparable > 0) {
    const passRate = ((pass + partial) / comparable * 100).toFixed(1);
    console.log(`Comparable cases: ${comparable}, PASS+PARTIAL rate: ${passRate}%`);
  }
  console.log();
  console.log(`Reference (cumulative):`);
  console.log(`  PR-N-1 명리심리상담사 lecture (한국 modern):  14 / 14  (100%)`);
  console.log(`  PR-O-1 명리존험 (중국 classical):              1 / 18   (5.6%)`);
  console.log();
  console.log(`Methodology note: 한국 modern authority is heterogeneous.`);
  console.log(`Lecture text uses 월지 정기 strictly. 인물 평론은 잡기/中氣 투간으로`);
  console.log(`格을 결정하는 경우 흔함. 이는 saju-ts 월지 정기 default 와 systematic`);
  console.log(`diff 발생. 미래 precisionConfig.gyeokgukSelectionRule = 'composite' opt-in 필요.`);
}

main();
