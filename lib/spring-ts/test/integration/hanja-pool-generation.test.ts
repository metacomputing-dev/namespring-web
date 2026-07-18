/**
 * test/integration/hanja-pool-generation.test.ts
 *
 * Verifies Phase 2 PR-2.2 candidate generation switches from the curated DB
 * pool to the opt-in full legal-Hanja pool without initializing sql.js.
 *
 * Run: npm run test:hanja-pool
 */
import { SpringEngine, decomposeHangul, getLegalAnnotation } from '../../src/index.js';
import type { NameCharInput } from '../../src/types.js';

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

function fakeEntry(overrides: Record<string, unknown>): any {
  return {
    id: 1,
    hangul: '가',
    hanja: '佳',
    onset: 'ㄱ',
    nucleus: 'ㅏ',
    strokes: 4,
    stroke_element: 'Fire',
    resource_element: 'Fire',
    meaning: '\uC544\uB984\uB2E4\uC6B8 \uAC00',
    radical: '',
    is_surname: false,
    ...overrides,
  };
}

console.log('Phase 2 hanja pool generation\n');

const engine: any = new SpringEngine();
engine.optimizer = { getValidCombinations: () => ['4'] };

const surnameEntry = fakeEntry({
  id: 100,
  hangul: '최',
  hanja: '崔',
  onset: 'ㅊ',
  nucleus: 'ㅚ',
  strokes: 11,
  stroke_element: 'Wood',
  resource_element: 'Earth',
  is_surname: true,
});
const curatedStrokeEntry = fakeEntry({ id: 200, hangul: '가', hanja: '佳', strokes: 4 });
const curatedJamoEntry = fakeEntry({
  id: 201,
  hangul: '유',
  hanja: '侑',
  onset: 'ㅇ',
  nucleus: 'ㅠ',
  strokes: 8,
  stroke_element: 'Metal',
  resource_element: 'Metal',
});

engine.hanjaRepo = {
  findSurnamesByHangul: async () => [surnameEntry],
  findByHanja: async (hanja: string) => hanja === '崔' ? surnameEntry : null,
  findByStrokeRange: async (min: number, max: number) =>
    curatedStrokeEntry.strokes >= min && curatedStrokeEntry.strokes <= max
      ? [curatedStrokeEntry]
      : [],
  findByHangul: async (hangul: string) => hangul === '유' ? [curatedJamoEntry] : [],
};

const sajuSummary: any = {
  yongshin: { element: 'Wood', heeshin: null, gishin: null, gushin: null },
  deficientElements: [],
  excessiveElements: [],
};

const baseRequest = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenNameLength: 1,
  mode: 'recommend' as const,
};

const curated = await engine.generateCandidates({
  ...baseRequest,
  options: { precisionConfig: { hanjaPool: 'curated' } },
}, sajuSummary);

const full = await engine.generateCandidates({
  ...baseRequest,
  options: { precisionConfig: { hanjaPool: 'inmyeongyong_full' } },
}, sajuSummary);
const implicitCurated = await engine.generateCandidates(baseRequest, sajuSummary);
const avoidSyntheticSummary = {
  ...sajuSummary,
  yongshin: { ...sajuSummary.yongshin, gishin: 'FIRE' },
};
const fullWithSyntheticAvoid = await engine.generateCandidates({
  ...baseRequest,
  options: { precisionConfig: { hanjaPool: 'inmyeongyong_full' } },
}, avoidSyntheticSummary);

const curatedHanja = new Set(curated.flat().map((char: NameCharInput) => char.hanja));
const fullHanja = new Set(full.flat().map((char: NameCharInput) => char.hanja));
const implicitCuratedHanja = new Set(implicitCurated.flat().map((char: NameCharInput) => char.hanja));

check('curated generator keeps DB pool output',
  curated.length === 1 && curatedHanja.has('佳'),
  `count=${curated.length}, hanja=${Array.from(curatedHanja).join(',')}`);
check('omitted hanjaPool defaults to curated generation',
  implicitCurated.length === curated.length
    && Array.from(curatedHanja).every((hanja) => implicitCuratedHanja.has(hanja)),
  `implicit=${implicitCurated.length}, explicit=${curated.length}`);
check('full generator uses more than the curated DB pool',
  full.length > curated.length,
  `curated=${curated.length}, full=${full.length}`);
check('full generator candidate count is deterministic',
  full.length === 8,
  `full=${full.length}`);
check('full generator does not exclude by synthetic resource element',
  fullWithSyntheticAvoid.length === full.length,
  `full=${full.length}, avoidSynthetic=${fullWithSyntheticAvoid.length}`);
check('full generator adds legal Hanja outside the fake curated repo',
  Array.from(fullHanja).some((hanja) => hanja !== '佳'),
  `full=${Array.from(fullHanja).slice(0, 8).join(',')}`);
check('full generated chars carry legal status',
  full.flat().every((char: NameCharInput) => char.legalStatus === 'allowed'));

const fullOnlyGenerated = full.flat().find((char: NameCharInput) => char.hanja !== '佳') as NameCharInput;
const resolvedFullOnly = await engine.resolveEntries([fullOnlyGenerated], {
  hanjaPool: 'inmyeongyong_full',
});
check('scoring resolver keeps full-pool generated Hanja',
  resolvedFullOnly[0]?.hanja === fullOnlyGenerated.hanja,
  `generated=${fullOnlyGenerated.hanja}, resolved=${resolvedFullOnly[0]?.hanja}`);

const nonStandardGlyph = String.fromCodePoint(0xA0109);
const nonStandardPool = await engine.resolveFixedCharPool({
  hangul: '비',
  hanja: nonStandardGlyph,
}, 'inmyeongyong_full');
check('full pool keeps legal non-standard glyph rows',
  nonStandardPool[0]?.hanja === nonStandardGlyph && Number(nonStandardPool[0]?.id) >= 900000,
  `hanja=${nonStandardPool[0]?.hanja}, id=${nonStandardPool[0]?.id}`);
const nonStandardLegal = getLegalAnnotation(nonStandardPool[0], { pool: 'inmyeongyong_full' });
check('full annotations accept legal non-standard glyph rows',
  nonStandardLegal.legalStatus === 'allowed',
  JSON.stringify(nonStandardLegal));

const fullJamo = await engine.generateCandidates({
  ...baseRequest,
  givenName: [{ hangul: '유' }],
  givenNameLength: 1,
  options: { precisionConfig: { hanjaPool: 'inmyeongyong_full' } },
}, sajuSummary, [{ onset: 'ㅇ', nucleus: 'ㅠ' }]);
const fullJamoHangul = fullJamo.map((candidate: NameCharInput[]) => candidate[0]?.hangul);
check('full jamo-filtered pool respects reading-derived onset/nucleus',
  fullJamo.length > 0 && fullJamoHangul.every((hangul) => {
    const decomposed = decomposeHangul(String(hangul ?? ''));
    return decomposed?.onset === 'ㅇ' && decomposed?.nucleus === 'ㅠ';
  }),
  `count=${fullJamo.length}, hangul=${fullJamoHangul.join(',')}`);

const candidateRejections = new Map();
const filtered = engine.filterGeneratedCandidatesByLegalStatus([
  [{ hangul: '답', hanja: '龘', legalStatus: 'notAllowed' }],
], candidateRejections);
const pureHangulFiltered = engine.filterGeneratedCandidatesByLegalStatus([
  [{ hangul: '민', hanja: '', legalStatus: 'hangulOnly' }],
], new Map());
const rejections = engine.candidateRejectionSummary(candidateRejections);
const response = engine.buildResponse(
  baseRequest,
  'recommend',
  sajuSummary,
  [],
  candidateRejections,
);
check('illegal generated Hanja is removed before scoring in every candidate pool',
  filtered.length === 0);
check('pure-Hangul recommendations bypass the Hanja-only legal filter',
  pureHangulFiltered.length === 1);
check('rejection reason is exposed for filtered Hanja',
  rejections.some((row: any) => row.reason === 'outside_legal_hanja_pool' && row.count === 1),
  JSON.stringify(rejections));
check('response meta exposes rejection reasons',
  response.meta.candidateRejections?.some((row: any) =>
    row.reason === 'outside_legal_hanja_pool' && row.count === 1) ?? false,
  JSON.stringify(response.meta.candidateRejections));

console.log(`\nHanja pool generation: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
