/**
 * 궁합 엔진 property/sweep 테스트.
 *
 * couple-compatibility.test.ts가 대표 시나리오를 점검한다면, 이 파일은
 * 전수(sweep) 검증을 맡는다:
 *  1) 지지 144 순서쌍 전체 — 대칭성 + 고전 통설 표와의 완전 일치
 *  2) 천간 100 쌍 전체 — 합·충 대칭성 + 십성 전단사(일간별 10십성 정확히 1회씩)
 *  3) 합성 delivery 격자(차트 쌍 12종 × 프레임 4종) — 점수 범위·가중치 합·결정론
 *  4) kids/guardian 프레임 안전성 — 배우자·연인 언어 금지 전수 확인
 *
 * fixture 헬퍼(makeDelivery)는 couple-compatibility.test.ts에서 복사했다.
 * (그 파일은 다른 작업 흐름이 소유하므로 수정하지 않는다.)
 */
import assert from 'node:assert/strict';
import {
  BRANCH_CODES,
  STEM_CODES,
  buildCoupleCompatibilityV1,
  isStemChung,
  lookupBranchPair,
  stemHapElement,
  tenGodOf,
} from '../../src/report/compatibility/index.js';
import type {
  CompatFramingV1,
  CompatRelationshipV1,
  CoupleCompatibilityV1,
} from '../../src/report/compatibility/index.js';
import type {
  ReportDeliveryV1,
  ReportFactV1,
} from '../../src/report/delivery/types.js';

type Branch = (typeof BRANCH_CODES)[number];
type Stem = (typeof STEM_CODES)[number];
type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('+');
}

function pairMap<T>(rows: [string, string, T][]): Map<string, T> {
  return new Map(rows.map(([a, b, value]) => [pairKey(a, b), value]));
}

function pairSet(rows: [string, string][]): Set<string> {
  return new Set(rows.map(([a, b]) => pairKey(a, b)));
}

/* ------------------------------------------------------------------ */
/* 1. 지지 144 순서쌍 전수 — 고전 통설 표                                  */
/* ------------------------------------------------------------------ */

// 육합 6쌍: 자축합토 인해합목 묘술합화 진유합금 사신합수 오미합(합화 유보)
const YUKHAP_ELEMENT = pairMap<Element | null>([
  ['JA', 'CHUK', 'earth'],
  ['IN', 'HAE', 'wood'],
  ['MYO', 'SUL', 'fire'],
  ['JIN', 'YU', 'metal'],
  ['SA', 'SIN', 'water'],
  ['O', 'MI', null], // 유파 갈림 — 합 성립만 인정
]);

// 충 6쌍: 자오 축미 인신 묘유 진술 사해
const CHUNG_SET = pairSet([
  ['JA', 'O'], ['CHUK', 'MI'], ['IN', 'SIN'], ['MYO', 'YU'], ['JIN', 'SUL'], ['SA', 'HAE'],
]);

// 해(육해) 6쌍: 자미 축오 인사 묘진 신해 유술
const HAE_SET = pairSet([
  ['JA', 'MI'], ['CHUK', 'O'], ['IN', 'SA'], ['MYO', 'JIN'], ['SIN', 'HAE'], ['YU', 'SUL'],
]);

// 파 6쌍: 자유 축진 인해 묘오 사신 술미
const PA_SET = pairSet([
  ['JA', 'YU'], ['CHUK', 'JIN'], ['IN', 'HAE'], ['MYO', 'O'], ['SA', 'SIN'], ['SUL', 'MI'],
]);

// 원진 6쌍: 자미 축오 인유 묘신 진해 사술
const WONJIN_SET = pairSet([
  ['JA', 'MI'], ['CHUK', 'O'], ['IN', 'YU'], ['MYO', 'SIN'], ['JIN', 'HAE'], ['SA', 'SUL'],
]);

// 귀문 6쌍: 자유 축오 인미 묘신 진해 사술
const GWIMUN_SET = pairSet([
  ['JA', 'YU'], ['CHUK', 'O'], ['IN', 'MI'], ['MYO', 'SIN'], ['JIN', 'HAE'], ['SA', 'SUL'],
]);

// 형: 인사신 삼형 + 축술미 삼형 + 자묘 상형 (서로 다른 두 글자 쌍만)
const HYEONG_SET = pairSet([
  ['IN', 'SA'], ['SA', 'SIN'], ['IN', 'SIN'],
  ['CHUK', 'SUL'], ['SUL', 'MI'], ['CHUK', 'MI'],
  ['JA', 'MYO'],
]);

// 자형: 진진 오오 유유 해해 (같은 글자 쌍만)
const JAHYEONG_BRANCHES: ReadonlySet<Branch> = new Set(['JIN', 'O', 'YU', 'HAE']);

// 왕지(사왕지): 자 묘 오 유
const WANGJI: ReadonlySet<Branch> = new Set(['JA', 'MYO', 'O', 'YU']);

// 삼합 반합(왕지 포함 쌍만): 신자진(수) 해묘미(목) 인오술(화) 사유축(금)
const SAMHAP_HALF = pairMap<Element>([
  ['JA', 'SIN', 'water'], ['JA', 'JIN', 'water'],
  ['MYO', 'HAE', 'wood'], ['MYO', 'MI', 'wood'],
  ['O', 'IN', 'fire'], ['O', 'SUL', 'fire'],
  ['YU', 'SA', 'metal'], ['YU', 'CHUK', 'metal'],
]);

// 방합 반합(왕지 포함 쌍만): 인묘진(목) 사오미(화) 신유술(금) 해자축(수)
const BANGHAP_HALF = pairMap<Element>([
  ['MYO', 'IN', 'wood'], ['MYO', 'JIN', 'wood'],
  ['O', 'SA', 'fire'], ['O', 'MI', 'fire'],
  ['YU', 'SIN', 'metal'], ['YU', 'SUL', 'metal'],
  ['JA', 'HAE', 'water'], ['JA', 'CHUK', 'water'],
]);

let branchPairCount = 0;
for (const a of BRANCH_CODES) {
  for (const b of BRANCH_CODES) {
    branchPairCount += 1;
    const ab = lookupBranchPair(a, b);
    const ba = lookupBranchPair(b, a);
    // 대칭성: 필드 단위 완전 일치
    assert.deepEqual(ab, ba, `${a}/${b} 순서 대칭성`);

    const key = pairKey(a, b);
    const same = a === b;

    assert.equal(ab.yukhap, YUKHAP_ELEMENT.has(key), `${a}+${b} 육합 성립 여부`);
    assert.equal(
      ab.yukhapElement,
      ab.yukhap ? YUKHAP_ELEMENT.get(key)! : null,
      `${a}+${b} 육합 합화 오행`,
    );
    assert.equal(ab.chung, CHUNG_SET.has(key), `${a}+${b} 충`);
    assert.equal(ab.hae, HAE_SET.has(key), `${a}+${b} 해`);
    assert.equal(ab.pa, PA_SET.has(key), `${a}+${b} 파`);
    assert.equal(ab.wonjin, WONJIN_SET.has(key), `${a}+${b} 원진`);
    assert.equal(ab.gwimun, GWIMUN_SET.has(key), `${a}+${b} 귀문`);
    assert.equal(ab.hyeong, !same && HYEONG_SET.has(key), `${a}+${b} 형`);
    assert.equal(ab.jahyeong, same && JAHYEONG_BRANCHES.has(a), `${a}+${b} 자형`);

    // 반합(삼합·방합)은 왕지 포함 쌍에서만, 표의 국 오행 그대로
    assert.equal(
      ab.samhapElement,
      same ? null : (SAMHAP_HALF.get(key) ?? null),
      `${a}+${b} 삼합 반합`,
    );
    assert.equal(
      ab.banghapElement,
      same ? null : (BANGHAP_HALF.get(key) ?? null),
      `${a}+${b} 방합 반합`,
    );
    if (ab.samhapElement !== null) {
      assert.ok(WANGJI.has(a) || WANGJI.has(b), `${a}+${b} 삼합 반합에 왕지 필수`);
    }
    if (ab.banghapElement !== null) {
      assert.ok(WANGJI.has(a) || WANGJI.has(b), `${a}+${b} 방합 반합에 왕지 필수`);
    }
  }
}
assert.equal(branchPairCount, 144);

/* ------------------------------------------------------------------ */
/* 2. 천간 100쌍 전수 — 합·충·십성                                        */
/* ------------------------------------------------------------------ */

// 천간합 5쌍: 갑기합토 을경합금 병신합수 정임합목 무계합화
const STEM_HAP_ELEMENT = pairMap<Element>([
  ['GAP', 'GI', 'earth'],
  ['EUL', 'GYEONG', 'metal'],
  ['BYEONG', 'SIN', 'water'],
  ['JEONG', 'IM', 'wood'],
  ['MU', 'GYE', 'fire'],
]);

// 천간충 4쌍: 갑경 을신 병임 정계
const STEM_CHUNG_SET = pairSet([
  ['GAP', 'GYEONG'], ['EUL', 'SIN'], ['BYEONG', 'IM'], ['JEONG', 'GYE'],
]);

const TEN_GOD_CODES = [
  'BI_GYEON', 'GYEOB_JAE', 'SIK_SIN', 'SANG_GWAN', 'PYEON_JAE',
  'JEONG_JAE', 'PYEON_GWAN', 'JEONG_GWAN', 'PYEON_IN', 'JEONG_IN',
] as const;

let stemPairCount = 0;
for (const day of STEM_CODES) {
  const tenGodTally = new Map<string, number>();
  for (const other of STEM_CODES) {
    stemPairCount += 1;
    const key = pairKey(day, other);

    // 합: 대칭 + 정확히 5쌍만 성립, 합화 오행 일치
    assert.equal(
      stemHapElement(day, other),
      stemHapElement(other, day),
      `${day}+${other} 천간합 대칭성`,
    );
    assert.equal(
      stemHapElement(day, other),
      STEM_HAP_ELEMENT.get(key) ?? null,
      `${day}+${other} 천간합 표 일치`,
    );

    // 충: 대칭 + 정확히 4쌍만 성립
    assert.equal(
      isStemChung(day, other),
      isStemChung(other, day),
      `${day}+${other} 천간충 대칭성`,
    );
    assert.equal(
      isStemChung(day, other),
      STEM_CHUNG_SET.has(key),
      `${day}+${other} 천간충 표 일치`,
    );

    const tenGod = tenGodOf(day as Stem, other as Stem);
    tenGodTally.set(tenGod, (tenGodTally.get(tenGod) ?? 0) + 1);
  }
  // 십성 전단사: 일간마다 10개 십성이 정확히 1회씩 나온다
  assert.equal(tenGodTally.size, 10, `${day} 일간 십성 종류 수`);
  for (const code of TEN_GOD_CODES) {
    assert.equal(tenGodTally.get(code), 1, `${day} 일간의 ${code} 등장 횟수`);
  }
}
assert.equal(stemPairCount, 100);

/* ------------------------------------------------------------------ */
/* 3. 합성 delivery fixture (couple-compatibility.test.ts에서 복사)        */
/* ------------------------------------------------------------------ */

interface FixtureSpec {
  analysisId: string;
  pillars?: Partial<Record<'year' | 'month' | 'day' | 'hour', [string, string]>>;
  strength?: 'STRONG' | 'BALANCED' | 'WEAK';
  yongshin?: Element;
  gishin?: Element;
  sajuShare?: Partial<Record<Element, number>>;
  deficient?: Element[];
  excessive?: Element[];
  yinYangDominant?: 'YANG' | 'YIN' | 'EVEN';
  nameChars?: {
    hangul: string;
    position: 'surname' | 'givenName';
    index: number;
    element?: Element;
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
/* 4. 점수 범위 sweep — 차트 쌍 12종 × 프레임 4종                          */
/* ------------------------------------------------------------------ */

interface PairSeed {
  id: string;
  a: Omit<FixtureSpec, 'analysisId'>;
  b: Omit<FixtureSpec, 'analysisId'>;
  /** 이름 없는 짝은 displayName도 주지 않는다. */
  nameless?: boolean;
}

const NAME_A: FixtureSpec['nameChars'] = [
  { hangul: '김', position: 'surname', index: 0, element: 'wood', polarity: '양', hanja: '金' },
  { hangul: '단', position: 'givenName', index: 0, element: 'fire', polarity: '양', hanja: '丹' },
  { hangul: '우', position: 'givenName', index: 1, element: 'earth', polarity: '음', hanja: '宇' },
];
const NAME_B: FixtureSpec['nameChars'] = [
  { hangul: '문', position: 'surname', index: 0, element: 'water', polarity: '음', hanja: '文' },
  { hangul: '가', position: 'givenName', index: 0, element: 'wood', polarity: '양', hanja: '嘉' },
  { hangul: '람', position: 'givenName', index: 1, element: 'fire', polarity: '음', hanja: '藍' },
];

const PAIR_SEEDS: PairSeed[] = [
  {
    // 풍부한 짝: 갑자 × 기축 (천간합 + 육합) — 모든 fact 종류 포함
    id: 'rich-hap',
    a: {
      pillars: { year: ['병', '진'], month: ['임', '인'], day: ['갑', '자'], hour: ['경', '오'] },
      strength: 'STRONG', yongshin: 'fire', gishin: 'water',
      sajuShare: { wood: 30, water: 30, fire: 10, earth: 20, metal: 10 },
      deficient: ['metal'], excessive: ['wood'], yinYangDominant: 'YANG',
      nameChars: NAME_A, frames: [20, 25, 15, 20],
    },
    b: {
      pillars: { year: ['신', '유'], month: ['기', '해'], day: ['기', '축'], hour: ['을', '축'] },
      strength: 'WEAK', yongshin: 'wood', gishin: 'water',
      sajuShare: { wood: 5, water: 15, fire: 25, earth: 30, metal: 25 },
      deficient: ['wood'], excessive: ['earth'], yinYangDominant: 'YIN',
      nameChars: NAME_B, frames: [15, 20, 25, 25],
    },
  },
  {
    // 자형: 두 사람 다 일지 진(辰) — 같은 글자 자형 쌍
    id: 'jahyeong-jinjin',
    a: { pillars: { day: ['무', '진'] }, strength: 'BALANCED' },
    b: { pillars: { day: ['임', '진'] }, strength: 'BALANCED' },
  },
  {
    // 인해: 육합 + 파 (선합후파) 겹침 쌍
    id: 'hap-pa-inhae',
    a: { pillars: { day: ['갑', '인'] }, nameChars: NAME_A },
    b: { pillars: { day: ['임', '해'] }, nameChars: NAME_B },
  },
  {
    // 사신: 육합 + 형 + 파 삼중 겹침 쌍
    id: 'sa-sin-triple',
    a: { pillars: { day: ['정', '사'] }, strength: 'STRONG' },
    b: { pillars: { day: ['경', '신'] }, strength: 'WEAK' },
  },
  {
    // 무관계: 자·인 — 합충형해파원진귀문 어느 표에도 없는 쌍
    id: 'no-relation',
    a: { pillars: { day: ['갑', '자'] } },
    b: { pillars: { day: ['병', '인'] } },
  },
  {
    // 시주 결측: 년월일만 있는 차트
    id: 'hour-missing',
    a: {
      pillars: { year: ['병', '진'], month: ['임', '인'], day: ['갑', '자'] },
      strength: 'STRONG', yongshin: 'fire',
      sajuShare: { wood: 30, water: 30, fire: 10, earth: 20, metal: 10 },
      nameChars: NAME_A,
    },
    b: {
      pillars: { year: ['신', '유'], month: ['기', '해'], day: ['기', '축'] },
      strength: 'WEAK', yongshin: 'wood',
      sajuShare: { wood: 5, water: 15, fire: 25, earth: 30, metal: 25 },
      nameChars: NAME_B,
    },
  },
  {
    // 이름 없음: 이름 fact도 표시용 이름도 없는 사주 단독 짝
    id: 'nameless',
    nameless: true,
    a: {
      pillars: { year: ['병', '진'], month: ['임', '인'], day: ['갑', '자'], hour: ['경', '오'] },
      strength: 'STRONG',
    },
    b: {
      pillars: { year: ['신', '유'], month: ['기', '해'], day: ['기', '축'], hour: ['을', '축'] },
      strength: 'WEAK',
    },
  },
  {
    // 자오충 쌍
    id: 'chung-jao',
    a: { pillars: { day: ['임', '자'] }, yinYangDominant: 'YANG' },
    b: { pillars: { day: ['병', '오'] }, yinYangDominant: 'YIN' },
  },
  {
    // 자미: 원진 + 해 겹침 쌍
    id: 'wonjin-hae-jami',
    a: { pillars: { day: ['병', '자'] } },
    b: { pillars: { day: ['임', '미'] } },
  },
  {
    // 인유: 원진 단독 쌍 (귀문 아님)
    id: 'wonjin-only-inyu',
    a: { pillars: { day: ['갑', '인'] }, strength: 'BALANCED', nameChars: NAME_A },
    b: { pillars: { day: ['신', '유'] }, strength: 'BALANCED', nameChars: NAME_B },
  },
  {
    // 신자: 삼합 반합(수국) 쌍
    id: 'samhap-half-sinja',
    a: { pillars: { day: ['경', '신'] }, yongshin: 'water' },
    b: { pillars: { day: ['임', '자'] }, yongshin: 'metal' },
  },
  {
    // 인묘: 방합 반합(목방) 쌍
    id: 'banghap-inmyo',
    a: { pillars: { day: ['갑', '인'] }, yinYangDominant: 'EVEN' },
    b: { pillars: { day: ['을', '묘'] }, yinYangDominant: 'EVEN' },
  },
];

interface FramingVariant {
  id: string;
  relationship?: CompatRelationshipV1;
  aBirth?: { year: number; month: number; day: number };
  bBirth?: { year: number; month: number; day: number };
  aGender?: 'male' | 'female';
  bGender?: 'male' | 'female';
  /** anchorDate 2026-07-19 기준으로 기대되는 결정론적 프레임. */
  expectFraming: CompatFramingV1;
}

const FRAMING_VARIANTS: FramingVariant[] = [
  {
    id: 'romance-adults',
    relationship: 'romance',
    aBirth: { year: 1994, month: 3, day: 14 },
    bBirth: { year: 1996, month: 7, day: 2 },
    aGender: 'male',
    bGender: 'female',
    expectFraming: 'couple',
  },
  {
    // 아이 둘: romance를 요청해도 kids로 강등되어야 한다
    id: 'kids',
    relationship: 'romance',
    aBirth: { year: 2015, month: 5, day: 5 },
    bBirth: { year: 2015, month: 9, day: 9 },
    expectFraming: 'kids',
  },
  {
    id: 'guardian',
    relationship: 'family',
    aBirth: { year: 1980, month: 1, day: 1 },
    bBirth: { year: 2016, month: 6, day: 6 },
    expectFraming: 'guardian',
  },
  {
    id: 'unspecified',
    expectFraming: 'companion',
  },
];

const DOMAINS = ['saju', 'name', 'cross'] as const;

const gridResults: { pairId: string; framingId: string; result: CoupleCompatibilityV1 }[] = [];

for (const seed of PAIR_SEEDS) {
  const deliveryA = makeDelivery({ analysisId: `sweep-${seed.id}-a`, ...seed.a });
  const deliveryB = makeDelivery({ analysisId: `sweep-${seed.id}-b`, ...seed.b });

  for (const framing of FRAMING_VARIANTS) {
    const build = () =>
      buildCoupleCompatibilityV1({
        a: {
          delivery: deliveryA,
          ...(seed.nameless ? {} : { displayName: '김단우' }),
          ...(framing.aGender ? { gender: framing.aGender } : {}),
          ...(framing.aBirth ? { birth: framing.aBirth } : {}),
        },
        b: {
          delivery: deliveryB,
          ...(seed.nameless ? {} : { displayName: '문가람' }),
          ...(framing.bGender ? { gender: framing.bGender } : {}),
          ...(framing.bBirth ? { birth: framing.bBirth } : {}),
        },
        ...(framing.relationship ? { relationship: framing.relationship } : {}),
      });

    const label = `${seed.id}×${framing.id}`;
    const result = build();
    gridResults.push({ pairId: seed.id, framingId: framing.id, result });

    // 프레임 파생이 결정론적으로 기대와 일치 (안전성 sweep의 전제)
    assert.equal(result.context.fact.framing, framing.expectFraming, `${label} 프레임`);

    // 축 13개 전부 항상 존재
    assert.equal(result.axes.length, 13, `${label} 축 개수`);

    // 모든 축: 점수 0~100, 가중치 유한·비음수
    for (const axis of result.axes) {
      assert.ok(Number.isFinite(axis.score), `${label} ${axis.id} 점수 유한`);
      assert.ok(
        axis.score >= 0 && axis.score <= 100,
        `${label} ${axis.id} 점수 범위: ${axis.score}`,
      );
      assert.ok(
        Number.isFinite(axis.weight) && axis.weight >= 0,
        `${label} ${axis.id} 가중치: ${axis.weight}`,
      );
    }

    // 도메인별 실효 가중치 합 = 1 (가용 축이 하나라도 있으면)
    for (const domain of DOMAINS) {
      const usable = result.axes.filter(
        axis => axis.domain === domain && axis.availability.status !== 'unavailable',
      );
      if (usable.length > 0) {
        const total = usable.reduce((sum, axis) => sum + axis.weight, 0);
        assert.ok(
          Math.abs(total - 1) < 0.01,
          `${label} ${domain} 가중치 합 ${total}`,
        );
      }
    }

    // 통합 점수: 유한하거나, 아니면 전체 availability가 unavailable
    assert.ok(
      Number.isFinite(result.sections.integrated.summary.score)
        || result.availability.status === 'unavailable',
      `${label} 통합 점수/가용성 정합`,
    );

    // 결정론: 같은 입력 두 번 → JSON 수준 완전 동일
    const again = build();
    assert.deepEqual(
      JSON.parse(JSON.stringify(again)),
      JSON.parse(JSON.stringify(result)),
      `${label} 결정론`,
    );
  }
}

assert.equal(gridResults.length, PAIR_SEEDS.length * FRAMING_VARIANTS.length);

/* ------------------------------------------------------------------ */
/* 5. 안전성 sweep — kids/guardian 프레임 언어 금지                        */
/* ------------------------------------------------------------------ */

const kidsResults = gridResults.filter(
  entry => entry.result.context.fact.framing === 'kids',
);
const guardianResults = gridResults.filter(
  entry => entry.result.context.fact.framing === 'guardian',
);
// 격자가 실제로 두 프레임을 전 쌍에 걸쳐 만들어 냈는지 (공허한 통과 방지)
assert.equal(kidsResults.length, PAIR_SEEDS.length, 'kids 프레임 결과 수');
assert.equal(guardianResults.length, PAIR_SEEDS.length, 'guardian 프레임 결과 수');

for (const { pairId, result } of kidsResults) {
  const axesJson = JSON.stringify(result.axes);
  assert.ok(
    !axesJson.includes('배우자'),
    `kids ${pairId}: 축 카피에 '배우자' 언어 금지`,
  );
  assert.ok(
    !axesJson.includes('연인'),
    `kids ${pairId}: 축 카피에 '연인' 언어 금지`,
  );
}

for (const { pairId, result } of guardianResults) {
  const axesJson = JSON.stringify(result.axes);
  assert.ok(
    !axesJson.includes('배우자의 별'),
    `guardian ${pairId}: 축 카피에 '배우자의 별' 언어 금지`,
  );
}

console.log(
  `couple-compatibility-sweep: 144 branch pairs, 100 stem pairs, `
  + `${gridResults.length} grid results (${kidsResults.length} kids / `
  + `${guardianResults.length} guardian) — all assertions passed`,
);
