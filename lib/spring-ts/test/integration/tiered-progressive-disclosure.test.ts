/**
 * test/integration/tiered-progressive-disclosure.test.ts
 *
 * Verifies the runtime UI contract: brief/standard stay plain, while expert
 * detail carries glossary tags and source-tiered numeric evidence.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: any, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlStr.includes('sql-wasm.wasm') || urlStr.startsWith('https://sql.js.org/') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url, options);
};

import { SpringEngine } from '../../src/index.js';

const PERIODS = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'] as const;
const CATEGORIES = [
  'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
] as const;

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

function cellRows(tm: any): Array<{ key: string; cell: any }> {
  const rows: Array<{ key: string; cell: any }> = [];
  for (const period of PERIODS) {
    const p = tm?.periods?.[period];
    rows.push({ key: `${period}.overall`, cell: p?.overall });
    for (const category of CATEGORIES) {
      rows.push({ key: `${period}.${category}`, cell: p?.byCategory?.[category] });
    }
  }
  return rows;
}

function paragraphTokens(paragraphs: any[]): any[] {
  return paragraphs.flatMap((paragraph) => Array.isArray(paragraph?.tokens) ? paragraph.tokens : []);
}

function tagTokens(paragraphs: any[]): any[] {
  return paragraphTokens(paragraphs).filter((token) => token?.kind === 'tag');
}

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) { if (repo) (repo as any).wasmUrl = WASM_PATH; }
await engine.init();

console.log('Tiered progressive disclosure contract\n');

const request = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
  options: { precisionConfig: { surfaceTieredMatrix: true } },
};

const report: any = await engine.getFortuneReport(request);
const tm: any = report?.tieredMatrix;
const rows = cellRows(tm);
const usedTags = new Set<string>(tm?.glossary?.usedInThisReport ?? []);
const glossaryEntries = tm?.glossary?.entries ?? {};

check('tiered matrix is surfaced', tm?.schemaVersion === 'spring-ts.tiered-matrix.v1');
check('all 55 UI cells are present', rows.length === 55 && rows.every((row) => row.cell != null), String(rows.length));

check('brief tier is concise plain text with no mirrored tags',
  rows.every(({ cell }) =>
    typeof cell?.brief?.headline === 'string' &&
      cell.brief.headline.length > 0 &&
      !cell.brief.headline.includes('#') &&
      Array.isArray(cell?.selectedFragments?.brief?.tags) &&
      cell.selectedFragments.brief.tags.length === 0),
  rows.filter(({ cell }) => cell?.selectedFragments?.brief?.tags?.length > 0).map((row) => row.key).join(','));

check('standard tier is plain detail with no inline tag tokens',
  rows.every(({ cell }) =>
    Array.isArray(cell?.standard?.paragraphs) &&
      cell.standard.paragraphs.length > 0 &&
      tagTokens(cell.standard.paragraphs).length === 0 &&
      Array.isArray(cell?.selectedFragments?.standard?.tags) &&
      cell.selectedFragments.standard.tags.length === 0),
  rows.filter(({ cell }) => tagTokens(cell?.standard?.paragraphs ?? []).length > 0).map((row) => row.key).join(','));

check('expert tier carries explicit glossary tags',
  rows.every(({ cell }) =>
    Array.isArray(cell?.expert?.paragraphs) &&
      cell.expert.paragraphs.length > 0 &&
      tagTokens(cell.expert.paragraphs).length > 0 &&
      Array.isArray(cell?.selectedFragments?.expert?.tags) &&
      cell.selectedFragments.expert.tags.length > 0),
  rows.filter(({ cell }) => tagTokens(cell?.expert?.paragraphs ?? []).length === 0).map((row) => row.key).join(','));

const allExpertTags = rows.flatMap(({ cell }) => tagTokens(cell?.expert?.paragraphs ?? []));
check('every expert tag resolves through used glossary entries',
  allExpertTags.length > 0 &&
    allExpertTags.every((token) =>
      typeof token.tagId === 'string' &&
      usedTags.has(token.tagId) &&
      glossaryEntries[token.tagId] != null),
  String(allExpertTags.length));

const leakedGlossaryEntries = Object.values(glossaryEntries as Record<string, any>)
  .filter((entry: any) =>
    Object.prototype.hasOwnProperty.call(entry, 'sourceTier') ||
      JSON.stringify(entry).includes('AI-derived plain-language definition') ||
      JSON.stringify(entry).includes('Display-only'));
check('glossary output omits internal source-tier audit prose',
  leakedGlossaryEntries.length === 0, String(leakedGlossaryEntries.length));

const numericalEvidenceRows = rows.flatMap(({ cell }) => cell?.expert?.numericalEvidence ?? []);
check('expert numeric evidence is source-tiered when present',
  numericalEvidenceRows.length > 0 &&
    numericalEvidenceRows.every((row: any) =>
      typeof row.label === 'string' &&
      typeof row.value === 'number' &&
      row.sourceTier != null &&
      typeof row.sourceTier.tier === 'string' &&
      typeof row.sourceTier.authorityTruthEligible === 'boolean'),
  String(numericalEvidenceRows.length));
check('expert numeric evidence omits English internal audit prose',
  numericalEvidenceRows.every((row: any) => {
    const sourceTier = row.sourceTier ?? {};
    return !String(sourceTier.humanInterpretation ?? '').includes('deterministic spring-ts runtime') &&
      !String(sourceTier.copyrightNote ?? '').includes('No third-party prose copied') &&
      !String(sourceTier.copyrightNote ?? '').includes('No source prose copied');
  }),
  String(numericalEvidenceRows.length));

const paragraphTexts = rows.flatMap(({ cell }) => [
  ...(cell?.standard?.paragraphs ?? []),
  ...(cell?.expert?.paragraphs ?? []),
].map((paragraph: any) => String(paragraph?.plainText ?? '')));
const crampedSentenceRows = paragraphTexts.filter((text) => /[.!?][가-힣]/.test(text));
check('tiered paragraph text keeps sentence spacing',
  crampedSentenceRows.length === 0, crampedSentenceRows.slice(0, 3).join(' | '));
const allTieredText = [
  ...rows.map(({ cell }) => String(cell?.brief?.headline ?? '')),
  ...paragraphTexts,
  ...rows.flatMap(({ cell }) => [
    ...(cell?.standard?.paragraphs ?? []),
    ...(cell?.expert?.paragraphs ?? []),
  ].flatMap((paragraph: any) =>
    paragraphTokens([paragraph]).map((token: any) => String(token?.value ?? token?.label ?? '')))),
  ...rows.flatMap(({ cell }) => [
    ...(cell?.standard?.livingTips ?? []),
    ...(cell?.standard?.cautions ?? []),
  ].map((text: any) => String(text ?? ''))),
  ...Object.values(glossaryEntries as Record<string, any>).flatMap((entry: any) => [
    String(entry?.brief ?? ''),
    String(entry?.detailed ?? ''),
  ]),
];
const awkwardRenderedPhrases = allTieredText.filter((text) =>
    text.includes('타고난 중심 기운') ||
    text.includes('도움이 되는 기운은') ||
    text.includes('도움이 되는 기운 기운') ||
    text.includes('봄에 태어난 흐름') ||
    text.includes('여름에 태어난 흐름') ||
    text.includes('가을에 태어난 흐름') ||
    text.includes('겨울에 태어난 흐름') ||
    text.includes('태어난 사람은은') ||
    text.includes('상태 흐름') ||
    text.includes('흐름의 흐름') ||
    text.includes('돈 흐름의 흐름') ||
    text.includes('깊은 결과') ||
    text.includes('자라는 결과') ||
    text.includes('쇠 결과') ||
    text.includes('친구의 결과를 자기 결과') ||
    text.includes('자기 결과 가족') ||
    text.includes('흐름을 봐 가는 흐름') ||
    text.includes('흐름이 한층 부드러워지는 흐름') ||
    text.includes('흐름이 한층 단단해지는 흐름') ||
    text.includes('흐름이 천천히 또렷해지는 흐름') ||
    text.includes('좋아하는 결과 잘하는') ||
    text.includes('자기 가정의 결과') ||
    text.includes('자기 가정의 작은 결과') ||
    text.includes('궁실의 결과') ||
    text.includes('#도화이') ||
    text.includes('큰 결정은 미루') ||
    text.includes('큰 결정은 한 박자 미루') ||
    text.includes('하루 유예') ||
    text.includes('큰 돈') ||
    text.includes('#편재 성 선택') ||
    text.includes('#정재 식 확인') ||
    text.includes('비흐름') ||
    text.includes('#역마이') ||
    text.includes('큰 흐름은 단단한') ||
    text.includes('큰 흐름은 단단하니') ||
    text.includes('작은 신호를 가볍게 적어 두는 흐름') ||
    text.includes('한 사람에게 흐름이 몰리지') ||
    text.includes('흐름을 따뜻하게 데우는 큰 흐름') ||
    text.includes('자녀의 흐름') ||
    text.includes('아이의 흐름') ||
    text.includes('가까운 흐름') ||
    text.includes('듣는 흐름') ||
    text.includes('한 해의 길이') ||
    text.includes("큰 흐름'을 잡는 흐름") ||
    text.includes('흙을 빛내 줄 흐름') ||
    text.includes('오늘은 기운은') ||
    text.includes('작은 결정을 쌓아 가는 흐름') ||
    text.includes('부드럽게 이어지는 흐름이에요') ||
    text.includes('책임 사이에서 흐름을 잡는') ||
    text.includes('결정 흐름을') ||
    text.includes('활동성 쉼') ||
    text.includes('몸을 움직이는 휴식이 잘 어울리는 흐름') ||
    text.includes('산행·자전거·등산 같은 흐름') ||
    text.includes('결의 흐름') ||
    text.includes('시간 같은 흐름') ||
    text.includes('한 흐름의 결과물') ||
    text.includes('마무리한 한 흐름') ||
    text.includes('다음 흐름의 단서') ||
    text.includes('#용신이 멀리 흐르는 흐름') ||
    text.includes('#용신이 천천히 자기 흐름을 찾아가는 흐름') ||
    text.includes('용신 흐름') ||
    text.includes('용신 결') ||
    text.includes('그 결에 맞는') ||
    text.includes('#정인의 결과') ||
    text.includes('의 결과 잘 맞물려') ||
    text.includes('큰 거래·확장의 흐름') ||
    text.includes('주의할 흐름은 #') ||
    text.includes('자격·서류 흐름') ||
    text.includes('시간이 친구가 되어 주는 흐름') ||
    text.includes('매력의 결인 #') ||
    text.includes('표현의 결인 #') ||
    text.includes('책임의 결인 #') ||
    text.includes('오늘의 인연 흐름은 부드러운 일간 흐름') ||
    text.includes('이번 주의 인연 흐름은 부드러운 일간 흐름') ||
    text.includes('이번 달의 인연 흐름은 부드러운 일간 흐름') ||
    text.includes('올해의 인연 흐름은 부드러운 일간 흐름') ||
    text.includes('곁의 흐름을 받아들이') ||
    text.includes('책·스승의 흐름') ||
    text.includes('흐름을 풀어 주는 흐름') ||
    text.includes('그달의 결과') ||
    text.includes('다툼 흐름을 풀어 주는 약이 되는 흐름') ||
    text.includes('그 결과 가까운 분야') ||
    text.includes('너무 무리해서 끌고 가는 결') ||
    text.includes('곁 사람의 흐름이 평생') ||
    text.includes('직업 흐름은 받은 자리를 단단히 받쳐 가며 흐름') ||
    text.includes('천천히 자기 흐름을 찾아 가는 표현') ||
    text.includes('큰 흐름을 잡기보다는 작은 흐름을 차곡차곡 다듬는 흐름') ||
    text.includes('잘 풀리는 흐름은 꾸준한 관리') ||
    text.includes('주의할 흐름은 큰 한 방') ||
    text.includes('잘 풀리는 흐름은 작은 기록') ||
    text.includes('잘 풀리는 흐름은 작은 모음') ||
    text.includes('주의할 흐름은 즉흥적') ||
    text.includes('작은 흐름이 평생 갈 자산') ||
    text.includes('결정하는 흐름을 익혀') ||
    text.includes('한 해 한 해 흐름을 잡아') ||
    text.includes('깊이를 만드는 흐름도') ||
    text.includes('직업 흐름을 미리') ||
    text.includes('받쳐 받는 사람') ||
    text.includes('좋아하는 흐름을 먼저') ||
    text.includes('재물 흐름은 큰 굴곡 없이 자리 잡는 흐름') ||
    text.includes('재물 흐름은 큰 굴곡 없이 차곡차곡 모이는 흐름') ||
    text.includes('잘 풀리는 흐름은') ||
    text.includes('주의할 흐름은') ||
    text.includes('다양한 친구의 흐름을 경험') ||
    text.includes('친구의 흐름을 충분히 누리는') ||
    text.includes('친구·동료의 흐름을 다듬는') ||
    text.includes('친구·또래의 흐름을 다듬는') ||
    text.includes('흐름을 따라가는 흐름') ||
    text.includes('가족의 결과 같은 호흡') ||
    text.includes('가족 관계은') ||
    text.includes('가족 관계으로') ||
    text.includes('한 흐름을 닫기 좋은 흐름') ||
    text.includes('일간의 흐름이 잔잔한 흐름') ||
    text.includes('흐름이 흐름을 가볍게') ||
    text.includes('#공망의 결과 닿아요') ||
    text.includes('#용신의 결에 맞는') ||
    text.includes('인연 흐름은 친구·동료의 자리') ||
    text.includes('매력의 흐름이 강하게') ||
    text.includes('그 흐름은 무대 위') ||
    text.includes('계약·법률문서·자격 갱신 자리에서 큰 단계가 풀리는 흐름') ||
    text.includes('새 결정과 점검을 함께 두는 흐름') ||
    text.includes('한 번 점검한 자리는 몇 년의 흐름') ||
    text.includes('작은 조항·기한·날짜 같은 디테일을 발견하는 자리') ||
    text.includes('결이 또렷한 날엔') ||
    text.includes('결이 또렷한 시기엔') ||
    text.includes('#정인의 흐름이 들어오는') ||
    text.includes('익숙한 흐름을 다듬는 방식') ||
    text.includes('#정재의 흐름이 자리 잡혀') ||
    text.includes('한 박자 늦추는 흐름이 좋아요') ||
    text.includes('가족 자리 사이에서') ||
    text.includes('함께한 자리가 한 해의') ||
    text.includes('친구·학업·가족 사이에서 마음이 자주 들썩이는 흐름의 시기') ||
    text.includes('마음의 흐름을 봄날의 새싹') ||
    text.includes('#정인의 흐름') ||
    text.includes('#편관의 흐름') ||
    text.includes('#공망의 흐름') ||
    text.includes('#삼형의 흐름') ||
    text.includes('#편관의 결') ||
    text.includes('#공망의 결') ||
    text.includes('#삼형의 결') ||
    text.includes('학업 흐름') ||
    text.includes('차분히 깊어지는 흐름') ||
    text.includes('함께 보이는 흐름') ||
    text.includes('표현 흐름') ||
    text.includes('표현 결') ||
    text.includes('한 단원을 자기 말로 풀어 보기 좋은 흐름') ||
    text.includes('자기에게 맞는 흐름') ||
    text.includes('작은 호기심의 흐름') ||
    text.includes('미래의 자리가 자기에게') ||
    text.includes('다음 단계의 흐름') ||
    text.includes('어린 흐름의 사주') ||
    text.includes('보호자의 흐름이 그대로 아이의 일상 호흡') ||
    text.includes('#정인의 결과') ||
    text.includes('자라나는 흐름의 작은 뿌리') ||
    text.includes('시기이에요') ||
    text.includes('오늘의 이동 흐름') ||
    text.includes('이번 주의 이동 흐름') ||
    text.includes('이번 달의 이동 흐름') ||
    text.includes('올해 이동 흐름') ||
    text.includes('큰 결정 자리가 있다면') ||
    text.includes('마음이 차분해진 자리에서') ||
    text.includes('가까운 친구와의 자리') ||
    text.includes('두 자리를 같이 챙기면') ||
    text.includes('미래 자리의 씨앗') ||
    text.includes('어른이 되었을 때 자리가') ||
    text.includes('작가·아티스트의 흐름') ||
    text.includes('친구·관계의 자산') ||
    text.includes('이번 주 이동 흐름') ||
    text.includes('이번 달 이동 흐름') ||
    text.includes('#용신의 결에 어울리는') ||
    text.includes('가족과 친구의 흐름') ||
    text.includes('의논하는 흐름') ||
    text.includes('함께하는 활동으로 흐름을 잡으면') ||
    text.includes('흐름을 봐 가는 흐름') ||
    text.includes('흐름을 봐 가는 방식') ||
    text.includes('다 잘하고 싶은 마음이 큰 자리이니') ||
    text.includes('고요한 호수 자리') ||
    text.includes('강을 더 또렷하게') ||
    text.includes('무게가 절반으로 줄어드는 흐름') ||
    text.includes('다른 사람의 몫까지 떠안는 자리') ||
    text.includes('적당히 나누는 흐름') ||
    text.includes('따뜻한 자리에서 일찍 쉬는 흐름') ||
    text.includes('#정관 식 책임 언어') ||
    text.includes('#용신의 결과 어울리는') ||
    text.includes('오늘의 인연 흐름') ||
    text.includes('이번 주의 인연 흐름') ||
    text.includes('이번 달의 인연 흐름') ||
    text.includes('올해의 인연 흐름') ||
    text.includes('오늘의 진로 흐름') ||
    text.includes('오늘 재물 흐름') ||
    text.includes('이번 주 재물 흐름') ||
    text.includes('이번 달 재물 흐름') ||
    text.includes('올해 재물 흐름') ||
    text.includes('마음의 흐름을 흐르는 강에 비유한다면') ||
    text.includes('고요한 호수 같은 시간가') ||
    text.includes('무게가 절반으로 줄어드는 흐름이라') ||
    text.includes('모든 책임을 자기에게 두는 자리') ||
    text.includes('진토(辰)와 술토(戌)는 같은 흙 흐름') ||
    text.includes('천간의 두 글자가 합쳐서 다른 오행으로 변하는 흐름') ||
    text.includes('음양의 흐름이 한 박자씩 어긋나') ||
    text.includes('에너지의 흐름이 잔잔한 흐름') ||
    text.includes('재물 흐름') ||
    text.includes('건강 흐름') ||
    text.includes('가족 흐름') ||
    text.includes('직업 흐름') ||
    text.includes('인연 흐름') ||
    text.includes('이동 흐름') ||
    text.includes('스트레스 흐름') ||
    text.includes('연애와 인연 흐름') ||
    text.includes('건강·스트레스 흐름') ||
    text.includes('균형이 돌아오는 자리') ||
    text.includes('잘 흐르는 사주') ||
    text.includes('부모님 자리와 자녀의 자리') ||
    text.includes('흐름을 한 호흡씩 정리하는 자리') ||
    text.includes('어깨·허리 자리에') ||
    text.includes('누적된 자리들이') ||
    text.includes('여러 자리에서 오는 신호') ||
    text.includes('자리 이동이 생기면 생각보다 빨리 흐름을 탈 수 있어요') ||
    text.includes('흐름을 탈 수 있어요') ||
    text.includes('큰 변화은') ||
    text.includes('산책 시간를') ||
    text.includes('한 달이라는 자리는') ||
    text.includes('회복 자리를 사이사이에') ||
    text.includes('한 번 푹 쉬는 자리를') ||
    text.includes('짧은 회복 자리를') ||
    text.includes('다음 해의 결까지') ||
    text.includes('쌓이는 자리가 자주 와요') ||
    text.includes('보편적인 자리도') ||
    text.includes('잠자리를 평소보다 한 시간 일찍 잡는 자리를') ||
    text.includes('첫 자취·첫 직장·첫 해외 자리가') ||
    text.includes('새 자리를 경험해 볼') ||
    text.includes('돌아오는 자리가') ||
    text.includes('활동량을 받아 내는 그릇이 큰 흐름') ||
    text.includes('누적되는 자리가') ||
    text.includes('페이스를 늦추는 자리를') ||
    text.includes('그릇을 더 키워') ||
    text.includes('한 해의 결이 한층 든든해져요') ||
    text.includes('이동 흐름은 익숙한 동선을 지키면 호흡이 편안') ||
    text.includes('이동 흐름은 익숙한 자리에서 한 발짝씩 넓혀 가는 흐름') ||
    text.includes('기운은 충분한데 방향이 살짝 흩어진 흐름') ||
    text.includes('자라는 흐름이 빛나는 흐름') ||
    text.includes('결단의 흐름이 깊은 흐름') ||
    text.includes('깊은 흐름이 자라는 흐름') ||
    text.includes('이 시기 이동의 흐름은') ||
    text.includes('큰 시야로 이어지는 흐름') ||
    text.includes('본격적으로 트이는 흐름') ||
    text.includes('흐름을 따라가 볼 시기') ||
    text.includes('가까운 사람의 자리를 받쳐 주는 흐름') ||
    text.includes('곁의 흐름을 살피는 손') ||
    text.includes('흐름을 잡아 주는 역할') ||
    text.includes('자기 흐름이 가장자리로') ||
    text.includes('따뜻한 거래') ||
    text.includes('어디에 세우느냐가 더 중요한 흐름') ||
    text.includes('결과를 만들어 내는 흐름이 강해요') ||
    text.includes('몇 년의 차이를 만드는 흐름') ||
    text.includes('큰 흐름을 한 번에 만드는 시기') ||
    text.includes('평생 갈 흐름을 다듬는 방식'));
check('tiered rendered text normalizes awkward template joins',
  awkwardRenderedPhrases.length === 0, awkwardRenderedPhrases.slice(0, 3).join(' | '));

check('selected fragment trace stays hidden-capable but complete',
  rows.every(({ cell }) =>
    typeof cell?.selectedFragments?.brief?.fragmentId === 'string' &&
      typeof cell?.selectedFragments?.standard?.fragmentId === 'string' &&
      typeof cell?.selectedFragments?.expert?.fragmentId === 'string'),
  rows.filter(({ cell }) => !cell?.selectedFragments?.expert?.fragmentId).map((row) => row.key).join(','));

engine.close();
console.log(`\nTiered progressive disclosure: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
