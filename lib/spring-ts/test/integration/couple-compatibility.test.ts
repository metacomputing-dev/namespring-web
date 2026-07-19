/**
 * 궁합 빌더 단위·통합 테스트.
 *
 * 빌더는 순수 함수(두 사람의 delivery facts → 궁합)여서 엔진 없이
 * 합성 fixture로 검증한다. 관계 테이블은 고전 통설 표와 대조한다.
 */
import assert from 'node:assert/strict';
import {
  buildCoupleCompatibilityV1,
  COUPLE_COMPATIBILITY_SCHEMA_V1,
  isStemChung,
  lookupBranchPair,
  phoneticElementOfHangul,
  stemHapElement,
  tenGodOf,
} from '../../src/report/compatibility/index.js';
import type {
  CoupleCompatibilityV1,
} from '../../src/report/compatibility/index.js';
import type {
  ReportDeliveryV1,
  ReportFactV1,
} from '../../src/report/delivery/types.js';

/* ------------------------------------------------------------------ */
/* 1. 관계 테이블 정합성                                                 */
/* ------------------------------------------------------------------ */

// 천간합 5종 (양방향)
assert.equal(stemHapElement('GAP', 'GI'), 'earth');
assert.equal(stemHapElement('GI', 'GAP'), 'earth');
assert.equal(stemHapElement('EUL', 'GYEONG'), 'metal');
assert.equal(stemHapElement('BYEONG', 'SIN'), 'water');
assert.equal(stemHapElement('JEONG', 'IM'), 'wood');
assert.equal(stemHapElement('MU', 'GYE'), 'fire');
assert.equal(stemHapElement('GAP', 'EUL'), null);

// 천간충 4종
assert.ok(isStemChung('GAP', 'GYEONG'));
assert.ok(isStemChung('EUL', 'SIN'));
assert.ok(isStemChung('BYEONG', 'IM'));
assert.ok(isStemChung('GYE', 'JEONG'));
assert.ok(!isStemChung('MU', 'GI'));
assert.ok(!isStemChung('GAP', 'GI'));

// 지지육합 6종
const YUKHAP: [string, string][] = [
  ['JA', 'CHUK'], ['IN', 'HAE'], ['MYO', 'SUL'], ['JIN', 'YU'], ['SA', 'SIN'], ['O', 'MI'],
];
for (const [left, right] of YUKHAP) {
  assert.ok(lookupBranchPair(left as never, right as never).yukhap, `${left}+${right} 육합`);
  assert.ok(lookupBranchPair(right as never, left as never).yukhap, `${right}+${left} 육합`);
}
assert.equal(lookupBranchPair('JA', 'CHUK').yukhapElement, 'earth');
assert.equal(lookupBranchPair('IN', 'HAE').yukhapElement, 'wood');
// 오미합은 합화 유보(합 성립만 인정)
assert.equal(lookupBranchPair('O', 'MI').yukhapElement, null);

// 지지충 6종
const CHUNG: [string, string][] = [
  ['JA', 'O'], ['CHUK', 'MI'], ['IN', 'SIN'], ['MYO', 'YU'], ['JIN', 'SUL'], ['SA', 'HAE'],
];
for (const [left, right] of CHUNG) {
  assert.ok(lookupBranchPair(left as never, right as never).chung, `${left}+${right} 충`);
}
assert.ok(!lookupBranchPair('JA', 'CHUK').chung);

// 반합: 왕지(자·묘·오·유) 포함 쌍만 성립
assert.equal(lookupBranchPair('SIN', 'JA').samhapElement, 'water');
assert.equal(lookupBranchPair('JA', 'JIN').samhapElement, 'water');
assert.equal(lookupBranchPair('SIN', 'JIN').samhapElement, null); // 생지+고지 불성립
assert.equal(lookupBranchPair('IN', 'O').samhapElement, 'fire');
assert.equal(lookupBranchPair('HAE', 'MYO').samhapElement, 'wood');
assert.equal(lookupBranchPair('SA', 'YU').samhapElement, 'metal');

// 방합: 왕지 포함 쌍만
assert.equal(lookupBranchPair('IN', 'MYO').banghapElement, 'wood');
assert.equal(lookupBranchPair('IN', 'JIN').banghapElement, null);
assert.equal(lookupBranchPair('SA', 'O').banghapElement, 'fire');

// 원진 6종 / 귀문 6종 (겹침 4쌍 + 각자 고유 2쌍)
for (const [left, right] of [['JA', 'MI'], ['CHUK', 'O'], ['IN', 'YU'], ['MYO', 'SIN'], ['JIN', 'HAE'], ['SA', 'SUL']]) {
  assert.ok(lookupBranchPair(left as never, right as never).wonjin, `${left}+${right} 원진`);
}
for (const [left, right] of [['JA', 'YU'], ['CHUK', 'O'], ['IN', 'MI'], ['MYO', 'SIN'], ['JIN', 'HAE'], ['SA', 'SUL']]) {
  assert.ok(lookupBranchPair(left as never, right as never).gwimun, `${left}+${right} 귀문`);
}
assert.ok(!lookupBranchPair('JA', 'MI').gwimun); // 자미는 원진이지만 귀문 아님
assert.ok(!lookupBranchPair('JA', 'YU').wonjin); // 자유는 귀문이지만 원진 아님

// 형: 인사신·축술미·자묘, 자형 진오유해
assert.ok(lookupBranchPair('IN', 'SA').hyeong);
assert.ok(lookupBranchPair('SA', 'SIN').hyeong);
assert.ok(lookupBranchPair('CHUK', 'SUL').hyeong);
assert.ok(lookupBranchPair('JA', 'MYO').hyeong);
assert.ok(lookupBranchPair('JIN', 'JIN').jahyeong);
assert.ok(lookupBranchPair('O', 'O').jahyeong);
assert.ok(!lookupBranchPair('JA', 'JA').jahyeong);

// 해·파
assert.ok(lookupBranchPair('JA', 'MI').hae);
assert.ok(lookupBranchPair('YU', 'SUL').hae);
assert.ok(lookupBranchPair('IN', 'HAE').pa); // 인해 = 합+파 (선합후파)
assert.ok(lookupBranchPair('SA', 'SIN').pa); // 사신 = 합+형+파
assert.ok(lookupBranchPair('SA', 'SIN').hyeong);

// 십성: 갑 일간 기준 전체
assert.equal(tenGodOf('GAP', 'GAP'), 'BI_GYEON');
assert.equal(tenGodOf('GAP', 'EUL'), 'GYEOB_JAE');
assert.equal(tenGodOf('GAP', 'BYEONG'), 'SIK_SIN');
assert.equal(tenGodOf('GAP', 'JEONG'), 'SANG_GWAN');
assert.equal(tenGodOf('GAP', 'MU'), 'PYEON_JAE');
assert.equal(tenGodOf('GAP', 'GI'), 'JEONG_JAE');
assert.equal(tenGodOf('GAP', 'GYEONG'), 'PYEON_GWAN');
assert.equal(tenGodOf('GAP', 'SIN'), 'JEONG_GWAN');
assert.equal(tenGodOf('GAP', 'IM'), 'PYEON_IN');
assert.equal(tenGodOf('GAP', 'GYE'), 'JEONG_IN');
// 천간합 짝은 언제나 정재·정관 상호
assert.equal(tenGodOf('GI', 'GAP'), 'JEONG_GWAN');

// 발음오행 (주류 배속: ㅇㅎ=토)
assert.equal(phoneticElementOfHangul('김'), 'wood');
assert.equal(phoneticElementOfHangul('나'), 'fire');
assert.equal(phoneticElementOfHangul('도'), 'fire');
assert.equal(phoneticElementOfHangul('오'), 'earth');
assert.equal(phoneticElementOfHangul('하'), 'earth');
assert.equal(phoneticElementOfHangul('서'), 'metal');
assert.equal(phoneticElementOfHangul('참'), 'metal');
assert.equal(phoneticElementOfHangul('박'), 'water');
assert.equal(phoneticElementOfHangul('문'), 'water');
assert.equal(phoneticElementOfHangul('A'), null);

/* ------------------------------------------------------------------ */
/* 2. 합성 delivery fixture                                             */
/* ------------------------------------------------------------------ */

interface FixtureSpec {
  analysisId: string;
  pillars?: Partial<Record<'year' | 'month' | 'day' | 'hour', [string, string]>>;
  strength?: 'STRONG' | 'BALANCED' | 'WEAK';
  yongshin?: 'wood' | 'fire' | 'earth' | 'metal' | 'water';
  gishin?: 'wood' | 'fire' | 'earth' | 'metal' | 'water';
  sajuShare?: Partial<Record<'wood' | 'fire' | 'earth' | 'metal' | 'water', number>>;
  deficient?: ('wood' | 'fire' | 'earth' | 'metal' | 'water')[];
  excessive?: ('wood' | 'fire' | 'earth' | 'metal' | 'water')[];
  yinYangDominant?: 'YANG' | 'YIN' | 'EVEN';
  nameChars?: {
    hangul: string;
    position: 'surname' | 'givenName';
    index: number;
    element?: 'wood' | 'fire' | 'earth' | 'metal' | 'water';
    polarity?: string;
    hanja?: string;
  }[];
  frames?: number[];
}

const STEM_KO_TO_CODE: Record<string, string> = {
  갑: 'GAP', 을: 'EUL', 병: 'BYEONG', 정: 'JEONG', 무: 'MU',
  기: 'GI', 경: 'GYEONG', 신: 'SIN', 임: 'IM', 계: 'GYE',
};
const BRANCH_KO_TO_CODE: Record<string, string> = {
  자: 'JA', 축: 'CHUK', 인: 'IN', 묘: 'MYO', 진: 'JIN', 사: 'SA',
  오: 'O', 미: 'MI', 신: 'SIN', 유: 'YU', 술: 'SUL', 해: 'HAE',
};

function makeDelivery(spec: FixtureSpec): ReportDeliveryV1 {
  const facts: ReportFactV1[] = [];
  if (spec.pillars) {
    facts.push({
      id: 'saju.pillars',
      domain: 'saju',
      method: 'test',
      kind: 'pillars',
      values: Object.entries(spec.pillars).map(([position, [stemKo, branchKo]]) => ({
        position: position as 'year' | 'month' | 'day' | 'hour',
        stem: { code: STEM_KO_TO_CODE[stemKo], hangul: stemKo, hanja: '' },
        branch: { code: BRANCH_KO_TO_CODE[branchKo], hangul: branchKo, hanja: '' },
      })),
    } as ReportFactV1);
  }
  if (spec.strength) {
    facts.push({
      id: 'saju.strength',
      domain: 'saju',
      method: 'test',
      kind: 'strength',
      level: spec.strength,
      levelCode: spec.strength,
      isStrong: spec.strength === 'STRONG',
    } as ReportFactV1);
  }
  if (spec.yongshin) {
    facts.push({
      id: 'saju.yongshin',
      domain: 'saju',
      method: 'test',
      kind: 'yongshin',
      element: spec.yongshin,
      confidence: 80,
      warnings: [],
    } as ReportFactV1);
  }
  if (spec.sajuShare) {
    facts.push({
      id: 'saju.element-distribution',
      domain: 'saju',
      method: 'test',
      kind: 'element_distribution',
      source: 'saju',
      subjectScope: 'natal_chart',
      normalization: 'within_source_percent',
      values: Object.entries(spec.sajuShare).map(([element, sharePercent]) => ({
        element,
        sharePercent,
      })),
    } as ReportFactV1);
  }
  if (spec.deficient || spec.excessive) {
    facts.push({
      id: 'saju.element-balance',
      domain: 'saju',
      method: 'saju-ts.element-balance-projection.v1',
      kind: 'element_balance',
      source: 'spring-ts.SajuSummary',
      projection: 'normalized_without_recalculation',
      sourceFields: ['deficientElements', 'excessiveElements'],
      deficient: spec.deficient ?? [],
      excessive: spec.excessive ?? [],
    } as ReportFactV1);
  }
  if (spec.yinYangDominant) {
    facts.push({
      id: 'saju.yin-yang',
      domain: 'saju',
      method: 'saju-ts.yin-yang-balance-projection.v1',
      kind: 'yin_yang_balance',
      source: 'spring-ts.SajuSummary',
      projection: 'normalized_without_recalculation',
      sourceFields: ['yinYangBalance'],
      yang: spec.yinYangDominant === 'YANG' ? 5 : 3,
      yin: spec.yinYangDominant === 'YIN' ? 5 : 3,
      stems: { yang: 2, yin: 2 },
      branches: { yang: 2, yin: 2 },
      dominant: spec.yinYangDominant,
    } as ReportFactV1);
  }
  for (const char of spec.nameChars ?? []) {
    facts.push({
      id: `naming.character.${char.position}.${char.index}`,
      domain: 'naming',
      method: 'test',
      kind: 'name_character',
      position: char.position,
      index: char.index,
      hangul: char.hangul,
      ...(char.hanja ? { hanja: char.hanja } : {}),
      ...(char.element ? { element: char.element } : {}),
      ...(char.polarity ? { polarity: char.polarity } : {}),
      legal: 'unknown',
    } as ReportFactV1);
  }
  (spec.frames ?? []).forEach((luckyLevel, index) => {
    const stages = ['earlyLife', 'youthLife', 'middleLife', 'lateAndTotal'] as const;
    const frameTypes = ['won', 'hyung', 'lee', 'jung'] as const;
    facts.push({
      id: `naming.frame.${stages[index]}`,
      domain: 'naming',
      method: 'test',
      kind: 'naming_frame',
      stage: stages[index],
      frameType: frameTypes[index],
      strokeSum: 10 + index,
      element: 'wood',
      polarity: '양',
      luckyLevel,
    } as ReportFactV1);
  });
  if (spec.gishin || spec.yongshin) {
    facts.push({
      id: 'interaction.name-saju',
      domain: 'interaction',
      method: 'yongshin-gishin-element-match.v1',
      kind: 'name_saju_interaction',
      classification: 'supportive_signal',
      yongshinElement: spec.yongshin ?? null,
      gishinElement: spec.gishin ?? null,
      nameElements: (spec.nameChars ?? [])
        .map(char => char.element)
        .filter((element): element is NonNullable<typeof element> => element != null),
      nameElementScope: 'surname_and_given_name',
      yongshinMatchCount: 0,
      gishinMatchCount: 0,
      limitations: [],
    } as unknown as ReportFactV1);
  }
  return {
    schemaVersion: 'spring-ts.report-delivery.v1',
    analysisId: spec.analysisId,
    generatedAt: '2026-07-19T00:00:00.000Z',
    anchorDate: '2026-07-19',
    subject: {},
    coverage: { surfaces: [{ id: 'integrated', depth: 'standard' }] },
    provenance: {} as ReportDeliveryV1['provenance'],
    availability: { status: 'ready', reasonCodes: [] },
    facts,
    interpretations: [],
    surfaces: [],
    offers: [],
  } as unknown as ReportDeliveryV1;
}

/* ------------------------------------------------------------------ */
/* 3. 궁합 통합 시나리오: 갑자 × 기축 (천간합 + 육합)                        */
/* ------------------------------------------------------------------ */

const personA = makeDelivery({
  analysisId: 'analysis-a',
  pillars: { year: ['병', '진'], month: ['임', '인'], day: ['갑', '자'], hour: ['경', '오'] },
  strength: 'STRONG',
  yongshin: 'fire',
  gishin: 'water',
  sajuShare: { wood: 30, water: 30, fire: 10, earth: 20, metal: 10 },
  deficient: ['metal'],
  excessive: ['wood'],
  yinYangDominant: 'YANG',
  nameChars: [
    { hangul: '김', position: 'surname', index: 0, element: 'wood', polarity: '양', hanja: '金' },
    { hangul: '단', position: 'givenName', index: 0, element: 'fire', polarity: '양', hanja: '丹' },
    { hangul: '우', position: 'givenName', index: 1, element: 'earth', polarity: '음', hanja: '宇' },
  ],
  frames: [20, 25, 15, 20],
});

const personB = makeDelivery({
  analysisId: 'analysis-b',
  pillars: { year: ['신', '유'], month: ['기', '해'], day: ['기', '축'], hour: ['을', '축'] },
  strength: 'WEAK',
  yongshin: 'wood',
  gishin: 'water',
  sajuShare: { wood: 5, water: 15, fire: 25, earth: 30, metal: 25 },
  deficient: ['wood'],
  excessive: ['earth'],
  yinYangDominant: 'YIN',
  nameChars: [
    { hangul: '문', position: 'surname', index: 0, element: 'water', polarity: '음', hanja: '文' },
    { hangul: '가', position: 'givenName', index: 0, element: 'wood', polarity: '양', hanja: '嘉' },
    { hangul: '람', position: 'givenName', index: 1, element: 'fire', polarity: '음', hanja: '藍' },
  ],
  frames: [15, 20, 25, 25],
});

const result = buildCoupleCompatibilityV1({
  a: {
    delivery: personA,
    displayName: '김단우',
    gender: 'male',
    birth: { year: 1994, month: 3, day: 14 },
  },
  b: {
    delivery: personB,
    displayName: '문가람',
    gender: 'female',
    birth: { year: 1996, month: 7, day: 2 },
  },
  relationship: 'romance',
});

assert.equal(result.schemaVersion, COUPLE_COMPATIBILITY_SCHEMA_V1);
assert.equal(result.persons.a.displayName, '김단우');
assert.equal(result.persons.b.displayName, '문가람');
assert.equal(result.persons.a.fullHangul, '김단우');
assert.equal(result.persons.a.fullHanja, '金丹宇');
assert.equal(result.provenance.inputs.aAnalysisId, 'analysis-a');
assert.equal(result.provenance.inputs.bAnalysisId, 'analysis-b');

// 짝 맥락: 성인 연인 → couple 프레임, anchorDate(2026-07-19) 기준 만 나이
assert.equal(result.context.fact.requestedRelationship, 'romance');
assert.equal(result.context.fact.framing, 'couple');
assert.equal(result.context.fact.ageA, 32);
assert.equal(result.context.fact.ageB, 30);
assert.equal(result.context.fact.ageGapYears, 2);
assert.equal(result.context.fact.olderPerson, 'a');
assert.equal(result.context.fact.sameAge, false);
assert.equal(result.context.fact.twelveGapSameZodiac, false);
// couple 프레임에서는 일지를 배우자궁으로 부른다
assert.equal(
  result.axes.find(axis => axis.id === 'saju_day_branch')!.label,
  '배우자궁(일지)의 만남',
);

// 축 13개 전부 존재
assert.equal(result.axes.length, 13);
for (const axis of result.axes) {
  assert.ok(axis.score >= 0 && axis.score <= 100, `${axis.id} 점수 범위`);
  assert.ok(Number.isFinite(axis.weight), `${axis.id} 가중치 유한`);
}

// 도메인별 실효 가중치 합 = 1 (가용 축 기준)
for (const domain of ['saju', 'name', 'cross'] as const) {
  const usable = result.axes.filter(
    axis => axis.domain === domain && axis.availability.status !== 'unavailable',
  );
  const total = usable.reduce((sum, axis) => sum + axis.weight, 0);
  assert.ok(Math.abs(total - 1) < 0.01, `${domain} 가중치 합 ${total}`);
}

// 갑기합: 일간 축 고득점 + hap fact
const dayStemAxis = result.axes.find(axis => axis.id === 'saju_day_stem')!;
assert.ok(dayStemAxis.score >= 85, `일간 합 점수 ${dayStemAxis.score}`);
const stemFact = result.facts.find(
  (fact): fact is Extract<typeof fact, { kind: 'stem_pair' }> =>
    fact.kind === 'stem_pair' && fact.aPosition === 'day' && fact.bPosition === 'day',
)!;
assert.equal(stemFact.relation, 'hap');
assert.equal(stemFact.hapElement, 'earth');
assert.equal(stemFact.tenGodOfBForA, 'JEONG_JAE');
assert.equal(stemFact.tenGodOfAForB, 'JEONG_GWAN');

// 자축 육합: 일지 축 고득점
const dayBranchAxis = result.axes.find(axis => axis.id === 'saju_day_branch')!;
assert.ok(dayBranchAxis.score >= 80, `일지 육합 점수 ${dayBranchAxis.score}`);

// 배우자성: 남성 A에게 B는 정재, 여성 B에게 A는 정관 → 십성 축 만점권
const tenGodAxis = result.axes.find(axis => axis.id === 'saju_ten_god')!;
assert.ok(tenGodAxis.score >= 80, `십성 축 ${tenGodAxis.score}`);

// 용신 교차: B(용신 목)를 A(일간 갑목)가 직접 채움 → 고득점 방향 존재
const yongshinAxis = result.axes.find(axis => axis.id === 'saju_yongshin_cross')!;
assert.equal(yongshinAxis.availability.status, 'ready');
assert.ok(yongshinAxis.score >= 60, `용신 축 ${yongshinAxis.score}`);

// 오행 보완: A 부족 금을 B가 채움(25%), B 부족 목을 A가 채움(30%) → 고득점
const complementAxis = result.axes.find(axis => axis.id === 'saju_element_complement')!;
assert.ok(complementAxis.score >= 85, `오행 보완 ${complementAxis.score}`);

// 발음오행 흐름: 김(목)단(화)우(토) × 문(수)가(목)람(화)
const flowFact = result.facts.find(fact => fact.kind === 'name_flow')!;
assert.equal(flowFact.kind, 'name_flow');
if (flowFact.kind === 'name_flow') {
  assert.deepEqual(flowFact.aElements, ['wood', 'fire', 'earth']);
  assert.deepEqual(flowFact.bElements, ['water', 'wood', 'fire']);
  assert.equal(flowFact.totalPairs, 9);
  assert.equal(
    flowFact.generatingPairs + flowFact.controllingPairs + flowFact.comparablePairs,
    9,
  );
}

// 통합 점수는 도메인 가중 평균 안에 있고 등급이 일관적
const integrated = result.sections.integrated.summary;
assert.ok(integrated.score >= 65, `통합 점수 ${integrated.score}`);
assert.ok(['excellent', 'good'].includes(integrated.grade), integrated.grade);
assert.equal(result.availability.status, 'ready');

// 결정론: 같은 입력 → 같은 출력
const again = buildCoupleCompatibilityV1({
  a: {
    delivery: personA,
    displayName: '김단우',
    gender: 'male',
    birth: { year: 1994, month: 3, day: 14 },
  },
  b: {
    delivery: personB,
    displayName: '문가람',
    gender: 'female',
    birth: { year: 1996, month: 7, day: 2 },
  },
  relationship: 'romance',
});
assert.deepEqual(JSON.parse(JSON.stringify(again)), JSON.parse(JSON.stringify(result)));

/* ------------------------------------------------------------------ */
/* 3-1. 관계 프레임: companion·kids·guardian·띠동갑                        */
/* ------------------------------------------------------------------ */

// (a) 같은 짝에서 relationship 생략 → companion: 배우자성 보너스가 빠지고
//     일지도 배우자궁이 아니라 속마음 자리로 읽는다.
const companionResult = buildCoupleCompatibilityV1({
  a: { delivery: personA, displayName: '김단우', gender: 'male' },
  b: { delivery: personB, displayName: '문가람', gender: 'female' },
});
assert.equal(companionResult.context.fact.requestedRelationship, 'unspecified');
assert.equal(companionResult.context.fact.framing, 'companion');
const companionTenGod = companionResult.axes.find(axis => axis.id === 'saju_ten_god')!;
assert.ok(
  companionTenGod.score < tenGodAxis.score,
  `companion 십성 ${companionTenGod.score} < couple ${tenGodAxis.score}`,
);
assert.equal(
  companionResult.axes.find(axis => axis.id === 'saju_day_branch')!.label,
  '일지(속마음 자리)의 만남',
);

// (b) 아이 짝: romance를 요청해도 kids로 강등되고, 축 어디에도 배우자 언어가 없다.
const kidsResult = buildCoupleCompatibilityV1({
  a: { delivery: personA, displayName: '김단우', birth: { year: 2015, month: 5, day: 5 } },
  b: { delivery: personB, displayName: '문가람', birth: { year: 2015, month: 9, day: 9 } },
  relationship: 'romance',
});
assert.equal(kidsResult.context.fact.framing, 'kids');
assert.equal(kidsResult.context.fact.bandA, 'child');
assert.equal(kidsResult.context.fact.bandB, 'child');
assert.equal(kidsResult.context.fact.childInvolved, true);
assert.ok(kidsResult.context.notes.length > 0, 'kids 맥락 노트 존재');
assert.ok(
  !JSON.stringify(kidsResult.axes).includes('배우자'),
  'kids 프레임 축 카피에 배우자 언어 금지',
);
// 동갑 노트도 함께 실린다
assert.ok(kidsResult.context.notes.some(note => note.includes('동갑')));

// (d) 띠동갑: 12년 차 성인 → twelveGapSameZodiac + 띠동갑 노트
const zodiacResult = buildCoupleCompatibilityV1({
  a: { delivery: personA, displayName: '김단우', gender: 'male', birth: { year: 1990, month: 2, day: 2 } },
  b: { delivery: personB, displayName: '문가람', gender: 'female', birth: { year: 2002, month: 8, day: 8 } },
  relationship: 'romance',
});
assert.equal(zodiacResult.context.fact.framing, 'couple');
assert.equal(zodiacResult.context.fact.ageGapYears, 12);
assert.equal(zodiacResult.context.fact.twelveGapSameZodiac, true);
assert.ok(zodiacResult.context.notes.some(note => note.includes('띠동갑')));

// (e) 프레임 분기 포함 결정론: kids 시나리오 재실행도 동일해야 한다
const kidsAgain = buildCoupleCompatibilityV1({
  a: { delivery: personA, displayName: '김단우', birth: { year: 2015, month: 5, day: 5 } },
  b: { delivery: personB, displayName: '문가람', birth: { year: 2015, month: 9, day: 9 } },
  relationship: 'romance',
});
assert.deepEqual(JSON.parse(JSON.stringify(kidsAgain)), JSON.parse(JSON.stringify(kidsResult)));

/* ------------------------------------------------------------------ */
/* 4. 원진 시나리오: 자미 (원진+해) — 이중 감점 금지 확인                    */
/* ------------------------------------------------------------------ */

const personC = makeDelivery({
  analysisId: 'analysis-c',
  pillars: { day: ['병', '자'] },
});
const personD = makeDelivery({
  analysisId: 'analysis-d',
  pillars: { day: ['임', '미'] },
});
const wonjinResult = buildCoupleCompatibilityV1({
  a: { delivery: personC },
  b: { delivery: personD },
});
const wonjinBranch = wonjinResult.facts.find(
  (fact): fact is Extract<typeof fact, { kind: 'branch_pair' }> =>
    fact.kind === 'branch_pair' && fact.aPosition === 'day' && fact.bPosition === 'day',
)!;
assert.ok(wonjinBranch.relations.includes('wonjin'));
assert.ok(wonjinBranch.relations.includes('hae'));
const wonjinAxis = wonjinResult.axes.find(axis => axis.id === 'saju_day_branch')!;
// 이중 감점 없이 60 − (18 + 9×0.4) = 38.4 → 38
assert.equal(wonjinAxis.score, 38);
// 병임충: 일간 축 저득점
const chungAxis = wonjinResult.axes.find(axis => axis.id === 'saju_day_stem')!;
assert.ok(chungAxis.score <= 40, `일간 충 ${chungAxis.score}`);

// (c) 어른-아이 가족 짝 → guardian 프레임
const guardianResult = buildCoupleCompatibilityV1({
  a: { delivery: personC, fullHangulName: '홍길동', birth: { year: 1980, month: 1, day: 1 } },
  b: { delivery: personD, fullHangulName: '성춘향', birth: { year: 2016, month: 6, day: 6 } },
  relationship: 'family',
});
assert.equal(guardianResult.context.fact.framing, 'guardian');
assert.equal(guardianResult.context.fact.olderPerson, 'a');
assert.ok(guardianResult.context.notes.length > 0, 'guardian 프레임 안내 존재');

/* ------------------------------------------------------------------ */
/* 5. 열화(degradation): 이름 정보가 없는 사주-단독 궁합                    */
/* ------------------------------------------------------------------ */

const sajuOnlyResult = buildCoupleCompatibilityV1({
  a: { delivery: personC, fullHangulName: '홍길동' },
  b: { delivery: personD, fullHangulName: '성춘향' },
});
assert.equal(sajuOnlyResult.persons.a.displayName, '홍길동');
// 이름 fact가 없어도 발음오행은 표시용 이름으로 계산된다.
const sajuOnlyFlow = sajuOnlyResult.axes.find(axis => axis.id === 'name_flow')!;
assert.equal(sajuOnlyFlow.availability.status, 'ready');
// 수리·이름오행·교차 축은 정직하게 unavailable
assert.equal(
  sajuOnlyResult.axes.find(axis => axis.id === 'name_frames')!.availability.status,
  'unavailable',
);
assert.equal(
  sajuOnlyResult.axes.find(axis => axis.id === 'cross_name_saju')!.availability.status,
  'unavailable',
);
// 용신 없음 → 용신 축 unavailable, 사주 도메인은 남은 축으로 재정규화
assert.equal(
  sajuOnlyResult.axes.find(axis => axis.id === 'saju_yongshin_cross')!.availability.status,
  'unavailable',
);
assert.ok(Number.isFinite(sajuOnlyResult.sections.integrated.summary.score));
assert.equal(sajuOnlyResult.availability.status, 'limited');

/* ------------------------------------------------------------------ */
/* 6. 완전 무자료: unavailable로 정직하게 응답                             */
/* ------------------------------------------------------------------ */

const emptyResult = buildCoupleCompatibilityV1({
  a: { delivery: makeDelivery({ analysisId: 'empty-a' }) },
  b: { delivery: makeDelivery({ analysisId: 'empty-b' }) },
});
assert.equal(emptyResult.availability.status, 'unavailable');
assert.equal(emptyResult.sections.saju.summary.availability.status, 'unavailable');

/* ------------------------------------------------------------------ */
/* 7. persons echo: 원국 오행 분포(sajuElements)                          */
/* ------------------------------------------------------------------ */

// 분포 fact의 값 배열이 저장 순서 그대로 echo된다 (두 사람 견주기 막대용).
assert.deepEqual(result.persons.a.sajuElements, [
  { element: 'wood', sharePercent: 30 },
  { element: 'water', sharePercent: 30 },
  { element: 'fire', sharePercent: 10 },
  { element: 'earth', sharePercent: 20 },
  { element: 'metal', sharePercent: 10 },
]);
assert.deepEqual(result.persons.b.sajuElements, [
  { element: 'wood', sharePercent: 5 },
  { element: 'water', sharePercent: 15 },
  { element: 'fire', sharePercent: 25 },
  { element: 'earth', sharePercent: 30 },
  { element: 'metal', sharePercent: 25 },
]);
// 분포 fact가 없으면 지어내지 않고 null
assert.equal(emptyResult.persons.a.sajuElements, null);

/* ------------------------------------------------------------------ */
/* 8. 카피 번들: 프레임 변형이 단어 치환이 아니라 딴 글임을 증명              */
/* ------------------------------------------------------------------ */

// couple과 kids 모두 같은 자축 육합(일지)을 읽지만, 문단 자체가 다른 글이다.
const coupleDayBranchAxis = result.axes.find(axis => axis.id === 'saju_day_branch')!;
const kidsDayBranchAxis = kidsResult.axes.find(axis => axis.id === 'saju_day_branch')!;
assert.notDeepEqual(
  [...kidsDayBranchAxis.paragraphs],
  [...coupleDayBranchAxis.paragraphs],
  'kids 일지 카피는 couple과 문단 단위로 달라야 한다',
);
// kids 전용 서사는 couple 카피 어디에도 없다 (치환이 아니라 재집필의 증거)
assert.ok(kidsDayBranchAxis.paragraphs.join(' ').includes('옆자리에 앉는 힘'));
assert.ok(!JSON.stringify(coupleDayBranchAxis).includes('옆자리에 앉는 힘'));
// guardian(자미 = 해+원진)도 성인 기본 카피와 다른, 돌봄 언어의 재집필이다
const guardianDayBranchAxis = guardianResult.axes.find(axis => axis.id === 'saju_day_branch')!;
const plainDayBranchAxis = wonjinResult.axes.find(axis => axis.id === 'saju_day_branch')!;
assert.notDeepEqual(
  [...guardianDayBranchAxis.paragraphs],
  [...plainDayBranchAxis.paragraphs],
  'guardian 일지 카피는 companion과 문단 단위로 달라야 한다',
);
assert.ok(guardianDayBranchAxis.paragraphs.join(' ').includes('말 못 할 서운함'));

/* ------------------------------------------------------------------ */
/* 9. 관계 라벨·결(tone) 엮기                                            */
/* ------------------------------------------------------------------ */

// 라벨·결 미제공이면 정직하게 null
assert.equal(result.context.fact.relationshipLabel, null);
assert.equal(result.context.fact.relationshipTone, null);

// (a) family + '엄마와 딸' + care → guardian 프레임 첫 노트에 라벨이 엮인다
const labeledResult = buildCoupleCompatibilityV1({
  a: { delivery: personC, fullHangulName: '홍길동', birth: { year: 1980, month: 1, day: 1 } },
  b: { delivery: personD, fullHangulName: '성춘향', birth: { year: 2016, month: 6, day: 6 } },
  relationship: 'family',
  relationshipLabel: '엄마와 딸',
  relationshipTone: 'care',
});
assert.equal(labeledResult.context.fact.relationshipLabel, '엄마와 딸');
assert.equal(labeledResult.context.fact.relationshipTone, 'care');
// 첫 노트가 짝의 언어로 시작하고, 프레임 안내와 한 문단으로 엮인다
assert.ok(labeledResult.context.notes[0].startsWith(`두 분의 자리를 '엄마와 딸'로 읽었어요.`));
assert.ok(labeledResult.context.notes[0].includes('돌봄과 성장'));
// care 결 문장이 얹힌다
assert.ok(labeledResult.context.notes.some(note => note.includes('돌봄이 흐르는 자리')));

// (b) partnership + hierarchy → 위계의 지혜 문장, 라벨은 standalone 첫 노트
const hierarchyResult = buildCoupleCompatibilityV1({
  a: { delivery: personA, displayName: '김단우', birth: { year: 1994, month: 3, day: 14 } },
  b: { delivery: personB, displayName: '문가람', birth: { year: 1996, month: 7, day: 2 } },
  relationship: 'partnership',
  relationshipLabel: '선배와 후배',
  relationshipTone: 'hierarchy',
});
assert.equal(hierarchyResult.context.fact.relationshipTone, 'hierarchy');
assert.ok(hierarchyResult.context.notes[0].includes('선배와 후배'));
assert.ok(hierarchyResult.context.notes.some(note => note.includes('위계가 있는 자리')));
// peer 결은 별도 문장을 얹지 않는다
const peerResult = buildCoupleCompatibilityV1({
  a: { delivery: personA, displayName: '김단우' },
  b: { delivery: personB, displayName: '문가람' },
  relationship: 'friendship',
  relationshipTone: 'peer',
});
assert.ok(!peerResult.context.notes.some(note => note.includes('위계가 있는 자리')));
assert.ok(!peerResult.context.notes.some(note => note.includes('돌봄이 흐르는 자리')));

// (c) 라벨·결 시나리오 결정론
const labeledAgain = buildCoupleCompatibilityV1({
  a: { delivery: personC, fullHangulName: '홍길동', birth: { year: 1980, month: 1, day: 1 } },
  b: { delivery: personD, fullHangulName: '성춘향', birth: { year: 2016, month: 6, day: 6 } },
  relationship: 'family',
  relationshipLabel: '엄마와 딸',
  relationshipTone: 'care',
});
assert.deepEqual(
  JSON.parse(JSON.stringify(labeledAgain)),
  JSON.parse(JSON.stringify(labeledResult)),
);

console.log('couple-compatibility: all assertions passed');
