/**
 * 두 사람 궁합(couple compatibility) 공개 계약.
 *
 * 입력은 사람별로 이미 계산된 ReportDeliveryV1 두 벌이다. 이 모듈은 새로운
 * 사주·성명 판단을 돌리지 않고, 두 payload의 결정론적 fact들만 짝지어
 * 관계(합·충·형·해·파·원진 등)와 상보성을 계산한다. 따라서 사람별 계산이
 * 이미 캐시되어 있으면 궁합은 그 캐시를 그대로 재사용한다.
 *
 * delivery 계약과 같은 원칙을 따른다:
 *  - facts   = 결정론적 검출 (쌍 관계, 오행 상보, 용신 교차 …)
 *  - axes    = 축별 점수 + 해석 문장 (interpretive, fact authority 아님)
 *  - 값이 없으면 축을 limited/unavailable로 표시하고 중립값을 지어내지 않는다.
 */
import type {
  FiveElementIdV1,
  ReportDeliveryV1,
  SajuPillarPositionV1,
  TenGodCodeV1,
} from '../delivery/types.js';
import type { ColoredAnimalV1 } from '../zodiac.js';

export const COUPLE_COMPATIBILITY_SCHEMA_V1 = 'spring-ts.couple-compatibility.v1' as const;

export type CompatibilityPersonKeyV1 = 'a' | 'b';

export interface CompatibilityPersonInputV1 {
  readonly delivery: ReportDeliveryV1;
  /** 표시용 이름(보관 호칭 등). 계산에는 쓰지 않는다. */
  readonly displayName?: string;
  /** delivery에 이름 fact가 없을 때를 대비한 표시용 한글 이름. */
  readonly fullHangulName?: string;
  /**
   * 배우자성(재성·관성) 해석에 쓰는 성별. delivery에는 출생 성별이 실리지
   * 않으므로 호출자가 프로필에서 넘겨준다. 없으면 성별 중립으로 해석한다.
   */
  readonly gender?: 'male' | 'female' | 'neutral';
  /**
   * 나이차·동갑·띠동갑 등 짝의 맥락을 읽기 위한 생년월일.
   * delivery에 time_correction fact가 있으면 빌더는 그 fact의
   * 양력(태양력) 기준일(standardLocalDateTime)을 우선 사용한다 —
   * 여기 넘긴 값은 그 fact가 없을 때의 폴백일 뿐이다. 따라서 음력 입력의
   * 변환 전 원본을 그대로 넘겨도, 실제 나이 셈은 엔진의 양력 기준일을 따른다.
   */
  readonly birth?: { readonly year: number; readonly month: number; readonly day: number };
}

/**
 * 두 사람의 관계. 궁합의 계산 축은 같지만, 해석의 프레임(배우자궁 강조,
 * 배우자성 보너스, 카피 톤)이 관계에 따라 달라진다.
 */
export type CompatRelationshipV1 =
  | 'romance'      // 연인·부부
  | 'friendship'   // 친구
  | 'family'       // 가족 (부모-자녀, 형제자매 등)
  | 'partnership'  // 동료·사업 파트너
  | 'unspecified';

/**
 * 관계의 결. 카테고리보다 한 겹 더 섬세한 카피 분기에 쓴다.
 *  - peer      : 대등한 사이 (친구·연인·동료 일반)
 *  - hierarchy : 위계가 있는 사이 (상사-부하, 스승-제자, 선후배)
 *  - care      : 돌봄이 흐르는 사이 (부모-자녀, 조부모-손주)
 */
export type CompatRelationshipToneV1 = 'peer' | 'hierarchy' | 'care';

export interface CoupleCompatibilityRequestV1 {
  readonly a: CompatibilityPersonInputV1;
  readonly b: CompatibilityPersonInputV1;
  /** 생략하면 'unspecified'로 본다. */
  readonly relationship?: CompatRelationshipV1;
  /** 표시용 상세 관계 라벨 (예: '엄마와 딸'). 맥락 문장에 그대로 엮인다. */
  readonly relationshipLabel?: string;
  /** 상세 관계의 결. 프리셋 카탈로그가 정해 준다. */
  readonly relationshipTone?: CompatRelationshipToneV1;
}

/* ------------------------------------------------------------------ */
/* 짝의 맥락 (나이·관계 프레임)                                           */
/* ------------------------------------------------------------------ */

export type CompatAgeBandV1 = 'child' | 'teen' | 'adult' | 'senior';

/**
 * 해석 프레임. 요청된 관계와 나이 맥락에서 결정론적으로 파생된다.
 *  - couple    : 성인 간 연애·부부 프레임 (배우자궁·배우자성 언어 사용)
 *  - companion : 우정·동료·동반자 프레임 (연애 언어 대신 관계 일반 언어)
 *  - guardian  : 어른-아이 돌봄·성장 프레임
 *  - kids      : 아이들끼리의 기질·우정 프레임
 * 미성년자가 포함되면 요청과 무관하게 연애 프레임을 쓰지 않는다.
 */
export type CompatFramingV1 = 'couple' | 'companion' | 'guardian' | 'kids';

/** 짝의 맥락 fact. 점수 축이 아니라, 모든 카피의 프레임을 정하는 근거다. */
export interface PairContextFactV1 {
  readonly id: string;
  readonly kind: 'pair_context';
  readonly domain: 'cross';
  readonly method: 'spring-ts.couple-pair-context.v1';
  readonly requestedRelationship: CompatRelationshipV1;
  /** 호출자가 넘긴 상세 관계 라벨. 없으면 null. */
  readonly relationshipLabel?: string | null;
  /** 상세 관계의 결. 없으면 null. */
  readonly relationshipTone?: CompatRelationshipToneV1 | null;
  readonly framing: CompatFramingV1;
  /** anchorDate(각 delivery의 기준일) 기준 만 나이. 생일 미제공이면 null. */
  readonly ageA: number | null;
  readonly ageB: number | null;
  readonly ageGapYears: number | null;
  readonly olderPerson: 'a' | 'b' | 'same' | null;
  readonly sameAge: boolean | null;
  /**
   * 12년 차이(띠동갑)면서 실제 년지(띠)까지 같은 짝. 달력 나이차만으로
   * 참이 되지 않는다 — 12의 배수 차이라도 년지가 다르면(입춘 전 출생 등)
   * false, 년지를 모르면 null.
   */
  readonly twelveGapSameZodiac: boolean | null;
  readonly bandA: CompatAgeBandV1 | null;
  readonly bandB: CompatAgeBandV1 | null;
  readonly childInvolved: boolean;
}

export interface CompatContextV1 {
  readonly fact: PairContextFactV1;
  /**
   * 맥락 읽기 문장들 (interpretive). 동갑·띠동갑·네 살 차 삼합·여섯 살 차 충,
   * 큰 나이차의 세대 프레임, 아이 짝의 기질 프레임 안내 등이 여기에 담긴다.
   */
  readonly notes: readonly string[];
}

export type CompatibilityDomainV1 = 'saju' | 'name' | 'cross';

export type CompatibilityStatusV1 = 'ready' | 'limited' | 'unavailable';

export type CompatibilityReasonCodeV1 =
  | 'SAJU_FACTS_MISSING'
  | 'DAY_PILLAR_MISSING'
  | 'HOUR_PILLAR_MISSING'
  | 'YONGSHIN_MISSING'
  | 'GISHIN_MISSING'
  | 'STRENGTH_MISSING'
  | 'ELEMENT_BALANCE_MISSING'
  | 'ELEMENT_DISTRIBUTION_MISSING'
  | 'YIN_YANG_MISSING'
  | 'NAME_FACTS_MISSING'
  | 'NAME_ELEMENTS_MISSING'
  | 'NAME_FRAMES_MISSING'
  | 'NAME_POLARITY_MISSING'
  | 'GENDER_NOT_PROVIDED';

export interface CompatibilityReasonV1 {
  readonly code: CompatibilityReasonCodeV1;
  /** 이유가 특정 사람에게서 비롯됐으면 그 사람. 없으면 쌍 전체. */
  readonly person?: CompatibilityPersonKeyV1;
}

export interface CompatibilityAvailabilityV1 {
  readonly status: CompatibilityStatusV1;
  readonly reasons: readonly CompatibilityReasonV1[];
}

/* ------------------------------------------------------------------ */
/* 간지 표기                                                            */
/* ------------------------------------------------------------------ */

export type PolarityV1 = 'YANG' | 'YIN';

export interface GanjiGlyphV1 {
  readonly code: string;
  readonly hangul: string;
  readonly hanja: string;
  readonly element: FiveElementIdV1;
  readonly polarity: PolarityV1;
}

/* ------------------------------------------------------------------ */
/* facts — 결정론적 쌍 검출                                              */
/* ------------------------------------------------------------------ */

interface CompatibilityFactBaseV1 {
  readonly id: string;
  readonly domain: CompatibilityDomainV1;
  readonly method: string;
}

export type StemPairRelationV1 =
  | 'hap'
  | 'chung'
  | 'saeng_a_to_b'
  | 'saeng_b_to_a'
  | 'geuk_a_to_b'
  | 'geuk_b_to_a'
  | 'bihwa';

/**
 * 두 사람 천간 쌍의 관계. 일간↔일간 쌍이 축 점수의 근거가 되고,
 * 나머지 기둥 조합은 교차 신호 목록으로만 쓴다.
 */
export interface StemPairFactV1 extends CompatibilityFactBaseV1 {
  readonly kind: 'stem_pair';
  readonly aPosition: SajuPillarPositionV1;
  readonly bPosition: SajuPillarPositionV1;
  readonly a: GanjiGlyphV1;
  readonly b: GanjiGlyphV1;
  readonly relation: StemPairRelationV1;
  /** 천간합일 때 합화 오행 (갑기→토). */
  readonly hapElement: FiveElementIdV1 | null;
  /** b의 간이 a의 일간에게 갖는 십성. */
  readonly tenGodOfBForA: TenGodCodeV1 | null;
  readonly tenGodOfAForB: TenGodCodeV1 | null;
}

export type BranchPairRelationV1 =
  | 'yukhap'
  | 'samhap'
  | 'banghap'
  | 'chung'
  | 'hyeong'
  | 'jahyeong'
  | 'hae'
  | 'pa'
  | 'wonjin'
  | 'gwimun';

/**
 * 두 사람 지지 쌍의 관계. 복수 관계가 겹칠 수 있다(예: 인해 = 육합+파).
 * 일지↔일지(배우자궁)와 년지↔년지(띠)가 축 점수의 근거가 된다.
 */
export interface BranchPairFactV1 extends CompatibilityFactBaseV1 {
  readonly kind: 'branch_pair';
  readonly aPosition: SajuPillarPositionV1;
  readonly bPosition: SajuPillarPositionV1;
  readonly a: GanjiGlyphV1;
  readonly b: GanjiGlyphV1;
  readonly relations: readonly BranchPairRelationV1[];
  /** 육합일 때 합화 오행 (자축→토). 오미합처럼 합화를 두지 않는 유파는 null. */
  readonly yukhapElement: FiveElementIdV1 | null;
  /** 삼합의 짝일 때 그 국의 오행 (신자진→수). */
  readonly samhapElement: FiveElementIdV1 | null;
  /** 방합의 짝일 때 그 방의 오행 (인묘진→목). */
  readonly banghapElement: FiveElementIdV1 | null;
}

/** 오행 상보: 한 사람의 부족 오행을 상대의 형세가 채우는지. */
export interface ElementComplementFactV1 extends CompatibilityFactBaseV1 {
  readonly kind: 'element_complement';
  /** 채움을 받는 사람 기준 방향. */
  readonly direction: 'a_fills_b' | 'b_fills_a';
  /** 받는 쪽의 부족 오행 전체. */
  readonly deficient: readonly FiveElementIdV1[];
  /** 그중 채우는 쪽 사주에서 뚜렷하게 왕성한(과다 또는 최다) 오행. */
  readonly filled: readonly FiveElementIdV1[];
  /** 부족한데 상대도 채워 주지 못하는 오행. */
  readonly unmet: readonly FiveElementIdV1[];
}

export type YongshinCrossMatchV1 =
  | 'direct'
  | 'generates'
  | 'neutral'
  | 'controls';

/** 용신 교차: 상대 일간·형세가 내 용신을 살리는가. */
export interface YongshinCrossFactV1 extends CompatibilityFactBaseV1 {
  readonly kind: 'yongshin_cross';
  /** 용신을 받는 사람 기준 방향 (b_supports_a = b가 a의 용신을 돕는다). */
  readonly direction: 'b_supports_a' | 'a_supports_b';
  readonly yongshinElement: FiveElementIdV1;
  /** 돕는 쪽 일간의 오행. */
  readonly partnerDayElement: FiveElementIdV1 | null;
  /** 일간 오행과 용신의 관계. */
  readonly match: YongshinCrossMatchV1;
  /** 돕는 쪽 원국에서 용신 오행이 차지하는 비율(%). 분포 fact가 없으면 null. */
  readonly partnerSharePercent: number | null;
  /** 받는 쪽 기신. 기신 fact가 없으면 null. */
  readonly gishinElement: FiveElementIdV1 | null;
  /** 돕는 쪽 원국에서 기신 오행이 차지하는 비율(%). */
  readonly partnerGishinSharePercent: number | null;
}

/** 음양 짝: 일간 음양과 원국 전체 음양의 상보. */
export interface YinYangPairFactV1 extends CompatibilityFactBaseV1 {
  readonly kind: 'yin_yang_pair';
  readonly aDayPolarity: PolarityV1 | null;
  readonly bDayPolarity: PolarityV1 | null;
  readonly aDominant: 'YANG' | 'YIN' | 'EVEN' | null;
  readonly bDominant: 'YANG' | 'YIN' | 'EVEN' | null;
  /** 일간 음양이 서로 다른가(음+양 짝). */
  readonly dayComplement: boolean | null;
  /** 원국 우세 음양이 서로를 채우는가. */
  readonly chartComplement: boolean | null;
}

export type StrengthPairPatternV1 =
  | 'complementary'
  | 'both_strong'
  | 'both_weak'
  | 'balanced_pair'
  | 'balanced_mix'
  | 'unknown';

/** 신강약 짝. */
export interface StrengthPairFactV1 extends CompatibilityFactBaseV1 {
  readonly kind: 'strength_pair';
  readonly a: 'STRONG' | 'BALANCED' | 'WEAK' | 'UNKNOWN';
  readonly b: 'STRONG' | 'BALANCED' | 'WEAK' | 'UNKNOWN';
  readonly pattern: StrengthPairPatternV1;
}

/**
 * 이름 소리(발음오행)의 흐름: 두 이름의 초성 오행을 짝지어 생·극·비화를 센다.
 * 성명학에서 이름 대 이름 궁합의 정통 축은 발음오행이다 — 자원오행끼리의
 * 상생상극은 무리라는 것이 전문가 통설이라, 자원오행은 교차 보완 축에서만 쓴다.
 */
export interface NameFlowFactV1 extends CompatibilityFactBaseV1 {
  readonly kind: 'name_flow';
  /** 초성→오행 배속 기준. 주류 작명 배속(ㅇ·ㅎ=토)을 쓴다. */
  readonly basis: 'phonetic_initial_mainstream';
  readonly aElements: readonly FiveElementIdV1[];
  readonly bElements: readonly FiveElementIdV1[];
  /** a글자→b글자 모든 쌍 중 상생(어느 방향이든) 쌍 수. */
  readonly generatingPairs: number;
  /** 그중 a가 b를 생하는 쌍 수 (주는 인연). */
  readonly aGeneratesB: number;
  /** 그중 b가 a를 생하는 쌍 수 (받는 인연). */
  readonly bGeneratesA: number;
  /** 상극 쌍 수. */
  readonly controllingPairs: number;
  /** 같은 오행(비화) 쌍 수. */
  readonly comparablePairs: number;
  readonly totalPairs: number;
}

/** 두 이름을 합쳤을 때 오행이 고루 갖춰지는지. */
export interface NameElementComplementFactV1 extends CompatibilityFactBaseV1 {
  readonly kind: 'name_element_complement';
  readonly aElements: readonly FiveElementIdV1[];
  readonly bElements: readonly FiveElementIdV1[];
  /** 합쳤을 때 존재하는 오행 수(0~5). */
  readonly combinedCoverage: number;
  /** 한쪽에만 있어 서로 채워 주는 오행. */
  readonly mutualFill: readonly FiveElementIdV1[];
  /** 둘 다 없는 오행. */
  readonly missingTogether: readonly FiveElementIdV1[];
}

/** 수리(원형이정) 짝: 각 이름의 네 틀 길수 수준을 나란히 놓는다. */
export interface FramePairFactV1 extends CompatibilityFactBaseV1 {
  readonly kind: 'frame_pair';
  readonly a: readonly { readonly frameType: string; readonly luckyLevel: number }[];
  readonly b: readonly { readonly frameType: string; readonly luckyLevel: number }[];
  /** 설정된 길수 만점(현재 25). */
  readonly luckyLevelMax: number;
}

/** 이름 음양 배열 짝. */
export interface NamePolarityPairFactV1 extends CompatibilityFactBaseV1 {
  readonly kind: 'name_polarity_pair';
  readonly aYang: number;
  readonly aYin: number;
  readonly bYang: number;
  readonly bYin: number;
}

/** 교차: 한 사람의 이름 오행이 상대 사주의 용신·기신에 닿는지. */
export interface NameToSajuCrossFactV1 extends CompatibilityFactBaseV1 {
  readonly kind: 'name_to_saju_cross';
  readonly direction: 'a_name_to_b_saju' | 'b_name_to_a_saju';
  readonly nameElements: readonly FiveElementIdV1[];
  readonly partnerYongshin: FiveElementIdV1 | null;
  readonly partnerGishin: FiveElementIdV1 | null;
  readonly yongshinMatchCount: number;
  readonly gishinMatchCount: number;
}

export type CompatibilityFactV1 =
  | StemPairFactV1
  | BranchPairFactV1
  | ElementComplementFactV1
  | YongshinCrossFactV1
  | YinYangPairFactV1
  | StrengthPairFactV1
  | NameFlowFactV1
  | NameElementComplementFactV1
  | FramePairFactV1
  | NamePolarityPairFactV1
  | NameToSajuCrossFactV1;

/* ------------------------------------------------------------------ */
/* axes — 축별 점수와 해석                                               */
/* ------------------------------------------------------------------ */

export type CompatibilityAxisIdV1 =
  | 'saju_day_stem'
  | 'saju_day_branch'
  | 'saju_year_branch'
  | 'saju_ten_god'
  | 'saju_yongshin_cross'
  | 'saju_element_complement'
  | 'saju_yin_yang'
  | 'saju_strength'
  | 'name_flow'
  | 'name_element_complement'
  | 'name_frames'
  | 'name_polarity'
  | 'cross_name_saju';

export type CompatibilityGradeV1 =
  | 'excellent'
  | 'good'
  | 'balanced'
  | 'watch'
  | 'challenging';

export interface CompatibilityAxisV1 {
  readonly id: CompatibilityAxisIdV1;
  readonly domain: CompatibilityDomainV1;
  readonly label: string;
  /** 0~100. 60이 무난한 중립선이다. */
  readonly score: number;
  /** 소속 도메인 합산에서 이 축이 차지한 실효 가중치(가용 축 재정규화 후). */
  readonly weight: number;
  readonly grade: CompatibilityGradeV1;
  readonly availability: CompatibilityAvailabilityV1;
  readonly factRefs: readonly string[];
  /** 한 줄 요약. */
  readonly headline: string;
  /** 2~4문장 해석 (interpretive). */
  readonly paragraphs: readonly string[];
  readonly tips: readonly string[];
  readonly cautions: readonly string[];
}

/* ------------------------------------------------------------------ */
/* 요약과 전체 응답                                                     */
/* ------------------------------------------------------------------ */

export interface CompatibilitySummaryV1 {
  readonly score: number;
  readonly grade: CompatibilityGradeV1;
  readonly headline: string;
  readonly paragraphs: readonly string[];
  readonly cautions: readonly string[];
  /** 점수가 어떻게 만들어졌는지에 대한 투명성 문장. */
  readonly weightsNote: string;
  readonly availability: CompatibilityAvailabilityV1;
}

export interface CompatibilityPersonEchoV1 {
  readonly displayName: string;
  readonly fullHangul: string | null;
  readonly fullHanja: string | null;
  readonly dayStem: GanjiGlyphV1 | null;
  readonly dayBranch: GanjiGlyphV1 | null;
  /** 태어난 해의 띠(십이지 동물)와 색(60갑자 색). 년주가 없으면 null. */
  readonly zodiac: ColoredAnimalV1 | null;
  readonly strengthLevelCode: 'STRONG' | 'BALANCED' | 'WEAK' | 'UNKNOWN' | null;
  readonly yongshinElement: FiveElementIdV1 | null;
  readonly gender: 'male' | 'female' | 'unknown';
  readonly analysisId: string;
  /**
   * 원국 오행 분포(%) echo — 두 사람 오행 견주기 막대 렌더용.
   * delivery에 분포 fact가 없으면 null.
   */
  readonly sajuElements?: readonly {
    readonly element: FiveElementIdV1;
    readonly sharePercent: number;
  }[] | null;
}

export interface CoupleCompatibilitySectionV1 {
  readonly summary: CompatibilitySummaryV1;
  readonly axisIds: readonly CompatibilityAxisIdV1[];
}

export interface CoupleCompatibilityV1 {
  readonly schemaVersion: typeof COUPLE_COMPATIBILITY_SCHEMA_V1;
  readonly persons: {
    readonly a: CompatibilityPersonEchoV1;
    readonly b: CompatibilityPersonEchoV1;
  };
  /** 관계·나이 맥락과 그 읽기. 모든 카피의 프레임이 여기서 결정된다. */
  readonly context: CompatContextV1;
  readonly availability: CompatibilityAvailabilityV1;
  readonly facts: readonly CompatibilityFactV1[];
  readonly axes: readonly CompatibilityAxisV1[];
  readonly sections: {
    /** 통합 궁합: 전체 점수 + 사주·이름·교차를 아우르는 요약. */
    readonly integrated: CoupleCompatibilitySectionV1;
    /** 사주간 궁합. */
    readonly saju: CoupleCompatibilitySectionV1;
    /** 이름간 궁합. */
    readonly name: CoupleCompatibilitySectionV1;
  };
  readonly provenance: {
    readonly engine: 'spring-ts';
    readonly method: typeof COUPLE_COMPATIBILITY_SCHEMA_V1;
    readonly computation: 'derived-from-two-person-deliveries';
    readonly inputs: {
      readonly aAnalysisId: string;
      readonly bAnalysisId: string;
    };
    /** 축별 기본 가중치(재정규화 전). 투명성 표기용. */
    readonly axisBaseWeights: Readonly<Record<CompatibilityAxisIdV1, number>>;
    readonly domainWeights: Readonly<Record<CompatibilityDomainV1, number>>;
  };
}
