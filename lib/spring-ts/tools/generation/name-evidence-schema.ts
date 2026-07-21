/**
 * name-evidence-schema.ts -- types + contracts for the name-evidence slot
 * pipeline (docs/refs/name-evidence-prompt-design.md §1-§3).
 *
 * A slot is a reusable 1-2 sentence fragment keyed by JUDGMENT axes (never by
 * a concrete name), written offline in a Claude Code session and assembled
 * deterministically at runtime. Pilot scope: S1~S9 (S10 부가 판정은 코퍼스
 * 단계에서). Slot ids stay ASCII (git/filesystem-safe); key objects keep the
 * Korean judgment values.
 */
import type { StrengthCoarse, GyeokgukFamily, NameEffect } from '../../src/report/tiered/class-axes.js';

export type { StrengthCoarse, GyeokgukFamily, NameEffect };

export type SlotFamily = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8' | 'S9' | 'S10';
export type ElementKo = '목' | '화' | '토' | '금' | '수';
export type Stem = '갑' | '을' | '병' | '정' | '무' | '기' | '경' | '신' | '임' | '계';
export type YongshinRelation = 'match' | 'generates' | 'drains' | 'controls' | 'controlled';
export type FrameType = 'won' | 'hyung' | 'lee' | 'jung';
export type LuckyGrade = '최상운수' | '상운수' | '양운수' | '흉운수' | '최흉운수';
export type Boundary = 'surname_given' | 'given_internal';
export type PhoneticRisk = 'low' | 'medium' | 'high';
/** 조립 위치 문형 (§4.4 조립 규칙 4). */
export type SlotRole = 'principle' | 'finding' | 'bridge' | 'closing';

export interface NameEvidenceKey {
  readonly stem?: Stem;                     // 일간 (S1/S2/S3/S8/S9)
  readonly gangyak?: StrengthCoarse;        // S1/S8/S9
  readonly targetElement?: ElementKo;       // S2 대상오행 / S3 용신오행
  readonly fromElement?: ElementKo;         // S4
  readonly toElement?: ElementKo;           // S4
  readonly boundary?: Boundary;             // S4
  readonly resourceElement?: ElementKo;     // S5
  readonly yongshinRelation?: YongshinRelation; // S5
  readonly frame?: FrameType;               // S6
  readonly grade?: LuckyGrade;              // S6
  readonly phoneticRule?: string;           // S7 (signal code 11종)
  readonly risk?: PhoneticRisk;             // S7
  readonly gyeokgukFamily?: GyeokgukFamily; // S9
  readonly nameEffect?: NameEffect;         // S8/S9
}

export interface NameEvidenceSpec {
  /** 이 슬롯이 서술해야 할 판정 사실 (모델이 바꿀 수 없음). */
  readonly fact: string;
  /** 일간 물상 (물상 의존 슬롯만). 예: '큰 강물과 바다' */
  readonly imagery?: string;
  /** 물상 상태 비유. 예: '물상의 원천이 마른 상태' */
  readonly imageryState?: string;
  /** 십성의 삶의 영역 번역. 예: '재성 = 내가 취하려는 것 → 재물·성과·현실 감각' */
  readonly tenGodMeaning?: string;
  /** 사격의 시기 의미. 예: '인생의 기둥 → 중년의 주된 흐름' */
  readonly framePhase?: string;
  /** 정직성 플래그 — true면 "채워 준다" 계열 금지. */
  readonly isAdverse: boolean;
  /** 런타임 치환 변수 화이트리스트. */
  readonly allowedVars: readonly string[];
}

export interface NameEvidenceCase {
  readonly slotId: string;      // 예: 'S2.im.hwa'
  readonly family: SlotFamily;
  readonly role: SlotRole;
  readonly key: NameEvidenceKey;
  readonly spec: NameEvidenceSpec;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ASCII tokens for slot ids
// ─────────────────────────────────────────────────────────────────────────────

export const STEM_TOKEN: Record<Stem, string> = {
  갑: 'gap', 을: 'eul', 병: 'byeong', 정: 'jeong', 무: 'mu',
  기: 'gi', 경: 'gyeong', 신: 'sin', 임: 'im', 계: 'gye',
};
export const ELEMENT_TOKEN: Record<ElementKo, string> = {
  목: 'mok', 화: 'hwa', 토: 'to', 금: 'geum', 수: 'su',
};
export const GRADE_TOKEN: Record<LuckyGrade, string> = {
  최상운수: 'choesang', 상운수: 'sang', 양운수: 'yang', 흉운수: 'hyung', 최흉운수: 'choehyung',
};

const invert = <K extends string, V extends string>(m: Record<K, V>): Record<string, K> =>
  Object.fromEntries((Object.entries(m) as Array<[K, V]>).map(([k, v]) => [v, k]));
export const STEM_BY_TOKEN: Record<string, Stem> = invert(STEM_TOKEN);
export const ELEMENT_BY_TOKEN: Record<string, ElementKo> = invert(ELEMENT_TOKEN);
export const GRADE_BY_TOKEN: Record<string, LuckyGrade> = invert(GRADE_TOKEN);

/** 조립 위치 문형 — 패밀리마다 고정 (§4.4). */
export const FAMILY_ROLE: Record<SlotFamily, SlotRole> = {
  S1: 'finding', S2: 'principle', S3: 'bridge', S4: 'finding', S5: 'finding',
  S6: 'finding', S7: 'finding', S8: 'finding', S9: 'closing', S10: 'finding',
};

/** principle 문장(≤50자)을 별도로 가질 수 있는 패밀리 (§3). */
export const PRINCIPLE_FAMILIES: ReadonlySet<SlotFamily> = new Set(['S2', 'S3', 'S4']);

/** 런타임 치환 변수 화이트리스트 — 패밀리별 (§4.4 규칙 6).
 *  S4/S7은 빈 목록: 쌍/규칙 사실이 키에 내장되어 있고, 글자명을 넣으면
 *  다른 이름에서 재사용이 깨진다. */
export const ALLOWED_VARS: Record<SlotFamily, readonly string[]> = {
  S1: ['dayMasterName', 'yongshinName', 'nameFull'],
  S2: ['charHangul', 'charHanja'],
  S3: ['yongshinName'],
  S4: [],
  S5: ['charHangul', 'charHanja'],
  S6: ['frameLabel'],
  S7: [],
  S8: ['dayMasterName', 'yongshinName', 'nameFull'],
  S9: ['dayMasterName', 'yongshinName', 'nameFull'],
  S10: [],
};

export function slotIdOf(family: SlotFamily, key: NameEvidenceKey): string {
  const need = <T>(v: T | undefined, what: string): T => {
    if (v === undefined) throw new Error(`slotIdOf(${family}): missing key.${what}`);
    return v;
  };
  switch (family) {
    case 'S1': return `S1.${STEM_TOKEN[need(key.stem, 'stem')]}.${need(key.gangyak, 'gangyak')}`;
    case 'S2': return `S2.${STEM_TOKEN[need(key.stem, 'stem')]}.${ELEMENT_TOKEN[need(key.targetElement, 'targetElement')]}`;
    case 'S3': return `S3.${STEM_TOKEN[need(key.stem, 'stem')]}.${ELEMENT_TOKEN[need(key.targetElement, 'targetElement')]}`;
    case 'S4': return `S4.${ELEMENT_TOKEN[need(key.fromElement, 'fromElement')]}.${ELEMENT_TOKEN[need(key.toElement, 'toElement')]}.${need(key.boundary, 'boundary')}`;
    case 'S5': return `S5.${ELEMENT_TOKEN[need(key.resourceElement, 'resourceElement')]}.${need(key.yongshinRelation, 'yongshinRelation')}`;
    case 'S6': return `S6.${need(key.frame, 'frame')}.${GRADE_TOKEN[need(key.grade, 'grade')]}`;
    case 'S7': return `S7.${need(key.phoneticRule, 'phoneticRule')}.${need(key.risk, 'risk')}`;
    case 'S8': return `S8.${STEM_TOKEN[need(key.stem, 'stem')]}.${need(key.gangyak, 'gangyak')}.${need(key.nameEffect, 'nameEffect')}`;
    case 'S9': return `S9.${STEM_TOKEN[need(key.stem, 'stem')]}.${need(key.gangyak, 'gangyak')}.${need(key.gyeokgukFamily, 'gyeokgukFamily')}.${need(key.nameEffect, 'nameEffect')}`;
    case 'S10': throw new Error('S10 is out of pilot scope');
  }
}

export function familyOfSlotId(slotId: string): SlotFamily {
  const family = slotId.split('.')[0] as SlotFamily;
  if (!/^S(?:[1-9]|10)$/u.test(family)) throw new Error(`invalid slotId: ${slotId}`);
  return family;
}

// ─────────────────────────────────────────────────────────────────────────────
//  물상 사전 (§4.2) + 물상 혼입 검사 어휘 (§6.1)
// ─────────────────────────────────────────────────────────────────────────────

export const IMAGERY: Record<Stem, string> = {
  갑: '큰 나무', 을: '꽃과 덩굴', 병: '태양', 정: '촛불과 화로', 무: '큰 산',
  기: '밭의 흙', 경: '바위와 무쇠', 신: '보석과 칼', 임: '큰 강물과 바다', 계: '이슬비와 시냇물',
};

export const IMAGERY_STATE: Record<StrengthCoarse, string> = {
  weak: '물상의 원천이 마른 상태',
  balanced: '물상이 제 자리를 지키는 상태',
  strong: '물상이 넘치는 상태',
};

export type ImageryGroup = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export const IMAGERY_GROUP: Record<Stem, ImageryGroup> = {
  갑: 'wood', 을: 'wood', 병: 'fire', 정: 'fire', 무: 'earth',
  기: 'earth', 경: 'metal', 신: 'metal', 임: 'water', 계: 'water',
};

/**
 * 물상 혼입 검사용 금지어 패턴 (그룹별). 다른 그룹의 번들에서 이 패턴이
 * 나오면 ERROR. 두 가지를 지킨다:
 *  - 오행의 우리말 이름(나무·불·흙·쇠·물)은 평문 tier의 필수 표현이라
 *    어느 번들에서도 금지하지 않는다 — 물상 "세계"의 어휘만 잡는다.
 *  - 정밀도 우선: 한 글자 어휘는 일상어와 겹치므로 조사 결합형/복합어로만
 *    잡는다 (오탐이 ingest를 막으면 안 됨).
 */
export const IMAGERY_FORBIDDEN_RE: Record<ImageryGroup, string> = {
  wood: '뿌리|덩굴|숲|새싹|(?<!물)줄기|가지를 뻗|가지가 뻗|잎(?=[이을은의처럼])',
  fire: '촛불|화로|불꽃|불길|불빛|햇살|햇빛|태양|온기',
  earth: '밭(?=[이을은의처럼에])|산비탈|바위턱|(?<![가-힣])산(?=[이을은처럼])',
  metal: '무쇠|보석|쇳|칼날|(?<![가-힣])칼(?=[이을은의처럼])|바위(?!턱)',
  water: '강물|바다|시냇물|이슬|수원|물길|물줄기|파도|샘물|샘이',
};

// ─────────────────────────────────────────────────────────────────────────────
//  서술 번역 사전 (§4.2 — 십성 삶의 영역 / 사격 시기)
// ─────────────────────────────────────────────────────────────────────────────

export type ElementRelation = 'same' | 'generates' | 'generated_by' | 'controls' | 'controlled_by';

/** 일간→대상 방향 관계 → 십성 5분류 + 평문 번역 (평문 tier에서는 용어 금지, 번역만). */
export const TEN_GOD_BY_RELATION: Record<ElementRelation, { readonly name: string; readonly life: string }> = {
  same: { name: '비겁', life: '나와 같은 편 → 동료, 자립, 경쟁' },
  generates: { name: '식상', life: '내가 내보내는 것 → 표현, 재능, 만들어 내는 힘' },
  generated_by: { name: '인성', life: '나를 채워 주는 것 → 배움, 문서, 도와주는 사람, 마음의 안정' },
  controls: { name: '재성', life: '내가 취하려는 것 → 재물, 성과, 현실 감각 (과하면 소모)' },
  controlled_by: { name: '관성', life: '나를 누르는 것 → 직장, 규율, 명예 (과하면 압박)' },
};

export const FRAME_LABEL_KO: Record<FrameType, string> = {
  won: '원격', hyung: '형격', lee: '이격', jung: '정격',
};

export const FRAME_PHASE: Record<FrameType, string> = {
  won: '초년의 터 → 성장기의 기반, 출발',
  hyung: '인생의 기둥 → 중년의 주된 흐름, 사회 활동의 중심',
  lee: '바깥의 문 → 대외 관계, 평판과 도움',
  jung: '전체를 담는 그릇 → 총운, 말년의 마무리',
};

/** phonetic-rules.ts transitionSignals()의 11개 signal code (S7 키 축). */
export const PHONETIC_RULE_CODES: readonly string[] = [
  'complex_batchim_boundary', 'nasal_assimilation_boundary', 'batchim_consonant_cluster',
  'tensing_boundary', 'rieul_nasalization_boundary', 'nieun_rieul_liquid_boundary',
  'same_coda_onset_repeat', 'same_initial_repeat', 'same_onset_vowel_repeat',
  'same_vowel_repeat', 'sonorant_cluster',
];

// ─────────────────────────────────────────────────────────────────────────────
//  출력 스키마 (§3) — 세션 모델이 반환해야 하는 JSON
// ─────────────────────────────────────────────────────────────────────────────

export const NAME_EVIDENCE_OUTPUT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['slots'],
  properties: {
    slots: {
      type: 'array', minItems: 1, maxItems: 25,
      items: {
        type: 'object', additionalProperties: false,
        required: ['slotId', 'plain', 'expert'],
        properties: {
          slotId: { type: 'string', description: '요청된 slotId 그대로' },
          plain: { type: 'string', description: '평문 tier. 40~110자, 1~2문장, 해요체, 사주 용어 금지. 단 S9(종합)만 80~200자, 2~4문장' },
          expert: { type: 'string', description: '전문가 tier. 50~160자, 1~2문장, 해요체, 용어 허용, #{태그} 0~2개. 단 S9(종합)만 100~260자, 2~4문장' },
          principle: { type: 'string', description: '선택. 원리 문장(≤50자) — S2/S3/S4만' },
        },
      },
    },
  },
} as const;

export interface GeneratedSlot {
  readonly slotId: string;
  readonly plain: string;
  readonly expert: string;
  readonly principle?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  저장 형식 — data/generation/name-evidence/slots/<slotId>.json (커밋 대상)
// ─────────────────────────────────────────────────────────────────────────────

export const SLOT_SCHEMA_VERSION = 'spring-ts.name-evidence-slot.v1';

/**
 * check_no_ai_policy.mjs 준수 블록: AI 저작 텍스트는 비권위 tier로 명시.
 * 필드 집합은 main의 source-tier 정책(SOURCE_TIER_REQUIRED_FIELDS: tier·
 * sourceType·sourceUrl·accessedAt·quoteShort·humanInterpretation + copyrightNote)
 * 을 따른다 — 선례: data/articles/insights/*.insights.json의 AI 레코드.
 * accessedAt은 저장 시점에 채운다(name-evidence-store.buildStoredSlot).
 */
export const SLOT_SOURCE_TIER = {
  tier: 'T2_AI_AUTHORED_INSIGHT',
  sourceType: 'ai_authored_insight_text',
  sourceUrl: null,
  quoteShort: null,
  humanInterpretation: 'AI-authored Korean slot fragment for display-only name-evidence narrative; judgments come from the engine, never from this text.',
  copyrightNote: 'No third-party prose copied.',
  authorityTruthEligible: false,
} as const;

export interface SlotSourceTier {
  readonly tier: typeof SLOT_SOURCE_TIER.tier;
  readonly sourceType: typeof SLOT_SOURCE_TIER.sourceType;
  readonly sourceUrl: null;
  readonly accessedAt: string; // ISO date (YYYY-MM-DD)
  readonly quoteShort: null;
  readonly humanInterpretation: string;
  readonly copyrightNote: string;
  readonly authorityTruthEligible: false;
}

export interface StoredNameEvidenceSlot {
  readonly schemaVersion: typeof SLOT_SCHEMA_VERSION;
  readonly slotId: string;
  readonly family: SlotFamily;
  readonly role: SlotRole;
  readonly key: NameEvidenceKey;
  readonly plain: string;
  readonly expert: string;
  readonly principle?: string;
  readonly isAdverse: boolean;
  readonly allowedVars: readonly string[];
  readonly aiGenerated: true;
  readonly sourceTier: SlotSourceTier;
  /** 'regen-ne-…' 태그 (ingest --source). */
  readonly sourceNote: string;
  /** D-1(사격 공식) 미결 격리 표시 — S6은 현행 엔진(visitor B) 기준 생성. */
  readonly keyProvenance?: 'engine-current-formula-b';
}
