/**
 * tools/validate_jonheom_cases.ts
 *
 * Validates saju-ts's classical 정격 추론 (월지 정기 ten-god + '격')
 * against the prose-recorded 격국 in 命理存验 (人鉴) 案例 — extracted
 * by direct visual reading of the 사주고전종합.pdf page images.
 *
 * Each case JSON records:
 *   expected.gyeokguk      — prose-stated 격국 (composite-rule, 투출 강조)
 *   expected.gyeokguk_alt  — 월지 정기 추론 form (saju-ts 의 자연 추론)
 *   expected.gyeokguk_basis — short prose basis for the prose 격국
 *
 * For each case the runner reports:
 *   1. saju-ts 의 월지 정기 추론 격국 (mechanically derived)
 *   2. 그 결과가 expected.gyeokguk_alt 과 일치하는지 (자기일관성 check)
 *   3. 그 결과가 expected.gyeokguk (prose) 과 일치하는지 (ground truth check)
 *
 * Important: saju-ts 의 추론은 단일 '월지 정기' rule 만 사용하지만 命理存验
 * prose는 '천간 투출' / '월령 中氣' / '殺印 composite' 등 multi-rule 분석.
 * 따라서 mechanical rule 와 prose 격국이 항상 일치하지 않는 것은 정상이며,
 * 두 가지 분류의 차이를 정확히 surface 하는 것이 목적.
 *
 * Usage: npx tsx tools/validate_jonheom_cases.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { tenGodOf } from '../../saju-ts/src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const JONHEOM_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority/jonheom');

const STEM_HANJA_ORDER = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const BRANCH_HANJA_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
const MAIN_HIDDEN_STEM_IDX: number[] = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];

const TEN_GOD_KO: Record<string, string> = {
  BI_GYEON: '비견', GEOB_JAE: '겁재', SIK_SHIN: '식신', SANG_GWAN: '상관',
  PYEON_JAE: '편재', JEONG_JAE: '정재', PYEON_GWAN: '편관', JEONG_GWAN: '정관',
  PYEON_IN: '편인', JEONG_IN: '정인',
};

function stemIdx(h: string): number {
  const i = STEM_HANJA_ORDER.indexOf(h as typeof STEM_HANJA_ORDER[number]);
  if (i < 0) throw new Error(`Unknown stem: ${h}`);
  return i;
}
function branchIdx(h: string): number {
  const i = BRANCH_HANJA_ORDER.indexOf(h as typeof BRANCH_HANJA_ORDER[number]);
  if (i < 0) throw new Error(`Unknown branch: ${h}`);
  return i;
}

interface JonheomCase {
  case_id: string;
  source: { text: string; author?: string; page_in_compilation: number };
  subject: { name_hanja: string; name_korean: string };
  pillars: { year_pillar: string; month_pillar: string; day_pillar: string; hour_pillar: string };
  expected: {
    gyeokguk: string;            // prose 격국
    gyeokguk_alt?: string;       // 월지 정기 격국 form
    yongshin?: string;
    gyeokguk_basis?: string;
  };
  prose_quote?: { verbatim: string };
}

function loadCases(): JonheomCase[] {
  const files = fs.readdirSync(JONHEOM_DIR).filter((f) => f.endsWith('.json'));
  return files
    .map((f) => JSON.parse(fs.readFileSync(path.join(JONHEOM_DIR, f), 'utf-8')) as JonheomCase)
    .sort((a, b) => a.case_id.localeCompare(b.case_id));
}

function sajuTsClassical(c: JonheomCase): string {
  const dayStem = c.pillars.day_pillar.charAt(0);
  const monthBranch = c.pillars.month_pillar.charAt(1);
  const dayIdx = stemIdx(dayStem);
  const branchMain = MAIN_HIDDEN_STEM_IDX[branchIdx(monthBranch)];
  const code = tenGodOf(dayIdx, branchMain);
  return `${TEN_GOD_KO[code] ?? code}격`;
}

function main(): void {
  const cases = loadCases();
  console.log(`validate_jonheom_cases — ${cases.length} cases\n`);

  let altMatch = 0;
  let proseMatch = 0;
  for (const c of cases) {
    const computed = sajuTsClassical(c);
    const altOk = c.expected.gyeokguk_alt ? computed === c.expected.gyeokguk_alt : null;
    const proseOk = computed === c.expected.gyeokguk;
    const idShort = c.case_id.replace(/^A2-jonheom_/, '');
    console.log(`  ${idShort} (${c.subject.name_korean}):`);
    console.log(`    pillars: ${c.pillars.year_pillar}/${c.pillars.month_pillar}/${c.pillars.day_pillar}/${c.pillars.hour_pillar}`);
    console.log(`    saju-ts 월지 정기 격국:  ${computed}`);
    console.log(`    prose 격국 (ground truth): ${c.expected.gyeokguk} (basis: ${c.expected.gyeokguk_basis ?? '-'})`);
    if (altOk !== null) {
      const tag = altOk ? 'PASS' : 'FAIL';
      console.log(`    [${tag}]  saju-ts 자기일관성 vs gyeokguk_alt (${c.expected.gyeokguk_alt})`);
      if (altOk) altMatch += 1;
    }
    const tag = proseOk ? 'PASS' : 'DIFF';
    console.log(`    [${tag}]  saju-ts 추론 vs prose 격국`);
    if (proseOk) proseMatch += 1;
    console.log();
  }

  console.log(`──────────────────────────────────`);
  console.log(`saju-ts 월지 정기 자기일관성:    ${altMatch} / ${cases.length}`);
  console.log(`saju-ts 추론 ↔ prose 격국:       ${proseMatch} / ${cases.length}`);
  console.log();
  console.log(`Methodology note: 命理存验 prose 격국 uses composite rules`);
  console.log(`(천간 투출 / 월령 中氣 / 殺印 composite). saju-ts uses single`);
  console.log(`'월지 정기' rule. Differences are EXPECTED methodology gap, not`);
  console.log(`bugs — see PHASE_O_RESULTS.md.`);

  process.exit(0);
}

main();
