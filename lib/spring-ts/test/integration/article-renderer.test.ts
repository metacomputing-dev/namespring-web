/**
 * test/integration/article-renderer.test.ts
 *
 * Unit contract for the article renderer: josa-aware slot injection and
 * glossary tag tokenisation. The renderer must do exactly these two
 * things and nothing else (WYSIWYG principle).
 *
 * Run: npm run test:article-renderer
 */
import {
  appendJosa,
  buildSlotValues,
  extractTagIds,
  fillSlots,
  renderArticleParagraph,
} from '../../src/report/tiered/article-renderer.js';
import type { GlossaryEntry } from '../../src/report/types.js';

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

// --- josa resolution --------------------------------------------------------
console.log('josa resolution');
check('물+이가 → 물이', appendJosa('물', '이가') === '물이');
check('나무+이가 → 나무가', appendJosa('나무', '이가') === '나무가');
check('흙+은는 → 흙은', appendJosa('흙', '은는') === '흙은');
check('쇠+을를 → 쇠를', appendJosa('쇠', '을를') === '쇠를');
check('물+과와 → 물과', appendJosa('물', '과와') === '물과');
check('불+과와 → 불과', appendJosa('불', '과와') === '불과');
check('물+으로로 → 물로 (ㄹ 예외)', appendJosa('물', '으로로') === '물로');
check('흙+으로로 → 흙으로', appendJosa('흙', '으로로') === '흙으로');
check('나무+으로로 → 나무로', appendJosa('나무', '으로로') === '나무로');
check('봄+이라라 → 봄이라', appendJosa('봄', '이라라') === '봄이라');

// --- slot fill ---------------------------------------------------------------
console.log('slot fill');
const slots = {
  periodLabel: '이번 주',
  dayMasterName: '나무',
  yongshinName: '물',
  currentSeasonName: '봄',
};
check(
  '기본 슬롯 치환',
  fillSlots('{{periodLabel}}의 중심은 {{dayMasterName}} 일간이에요.', slots)
    === '이번 주의 중심은 나무 일간이에요.',
);
check(
  '조사 슬롯 치환',
  fillSlots('{{yongshinName:이가}} 받쳐 줘요.', slots) === '물이 받쳐 줘요.',
);
check(
  '알 수 없는 슬롯은 원문 유지',
  fillSlots('{{unknownSlot}} 그대로', slots) === '{{unknownSlot}} 그대로',
);

// --- feature-derived slot values ---------------------------------------------
console.log('slot values from feature vector');
const featureLike = {
  dayMasterElement: 'WOOD',
  yongshinElement: 'WATER',
  currentSeason: 'spring',
} as never;
const derived = buildSlotValues('올해 (2026년)', featureLike);
check('dayMasterName=나무', derived.dayMasterName === '나무');
check('yongshinName=물', derived.yongshinName === '물');
check('currentSeasonName=봄', derived.currentSeasonName === '봄');
const fallback = buildSlotValues('오늘', { dayMasterElement: null, yongshinElement: null, currentSeason: 'winter' } as never);
check('일간 미해석 폴백', fallback.dayMasterName === '중심 기운');
check('용신 미해석 폴백', fallback.yongshinName === '보완 기운');

// --- tag tokenisation ---------------------------------------------------------
console.log('tag tokenisation');
const glossary: Record<string, GlossaryEntry> = {
  jeongjae: {
    id: 'jeongjae', label: '정재', hashLabel: '#정재', category: 'tenGod',
    brief: '', detailed: '', related: [],
  } as GlossaryEntry,
};
const para = renderArticleParagraph(
  '오늘은 #{jeongjae}의 확인 습관과 {{yongshinName:이가}} 함께 가는 날이에요.',
  slots,
  glossary,
);
check('태그 토큰 생성', para.tokens.some((t) => t.kind === 'tag' && t.tagId === 'jeongjae' && t.label === '정재'));
check('plainText는 #라벨 표기', para.plainText === '오늘은 #정재의 확인 습관과 물이 함께 가는 날이에요.');
check('텍스트 토큰 순서 보존', para.tokens[0].kind === 'text' && (para.tokens[0] as { value: string }).value === '오늘은 ');
const unknownTag = renderArticleParagraph('#{noSuchTag} 검증', slots, glossary);
check('미등록 태그는 평문 강등', unknownTag.plainText === '#noSuchTag 검증'
  && unknownTag.tokens.every((t) => t.kind === 'text'));
check('extractTagIds 중복 제거', JSON.stringify(extractTagIds(['#{a} #{b} #{a}'])) === JSON.stringify(['a', 'b']));

console.log('---');
console.log(`pass=${pass} fail=${fail}`);
process.exit(fail > 0 ? 1 : 0);
