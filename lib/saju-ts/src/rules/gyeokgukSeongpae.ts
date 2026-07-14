/**
 * gyeokgukSeongpae.ts — 격국 성패(成敗) 판정: 상신(相神)·순용/역용·성격/파격 (PR-6).
 *
 * 전거: 자평진전(子平真詮) 계열 표준 —
 * - 사길신(四吉神, 순용): 재(정·편)·정관·정인·식신 → 생조·보호해야 격이 선다.
 * - 사흉신(四凶神, 역용): 칠살(편관)·상관·겁재(월겁/양인)·편인(효신) → 제압·화(化)해야 선다.
 * - 격을 성격시키는 글자가 상신(相神), 파격 요인을 구하는 글자가 구응(救應).
 *
 * 스코프(PR-6): additive 판정 표면만 — 격국 ranking/score/quality.multiplier에는
 * 개입하지 않는다(점수 통합은 판정 변경이므로 별도 계측 항목, E-2 로드맵 참조).
 * 성패별 사용자 해석 텍스트 저작은 콘텐츠 축(틀만: verdict/sangshin/reasons).
 *
 * 판정 재료: 월지격 십성(또는 건록/양인/월겁 세분) × 년·월·시 투출 십성 집합 +
 * 월지 손상(quality.broken — 탐합망충 해소 후 값). 지장간 회지 상신·세력 비교 등
 * 정밀 판정은 후속(v0는 투간 기준 — 자평진전의 1차 판정과 동일 축).
 */
import type { StemIdx } from '../core/cycle.js';
import { stemHanja } from '../core/cycle.js';
import type { TenGod } from '../core/tenGod.js';
import { tenGodOf } from '../core/tenGod.js';

export type SeongpaeVerdict =
  | 'SEONGGYEOK'      // 성격(成格)
  | 'PAGYEOK'         // 파격(敗格)
  | 'PAJUNG_YUGU'     // 패중유구(敗中有救) — 파격 요인이 있으나 구응이 있음
  | 'SEONGJUNG_YUPA'  // 성중유패(成中有敗) — 성격이나 파격 요인 공존
  | 'UNDETERMINED';   // 상신·파격 요인 모두 무 — 격은 서되 운용 미확정

export interface SeongpaeResult {
  verdict: SeongpaeVerdict;
  /** 격 운용 방향 — 순용(길신 생조) / 역용(흉신 제화). */
  usage: 'SUNYONG' | 'YEOKYONG';
  /** 상신(격을 성격시키는 십성) — 투간에서 확인된 것. */
  sangshin: TenGod | null;
  sangshinStemHanja: string | null;
  /** 파격 요인 십성 (기신 — 투간에서 확인된 것). */
  pagyeokFactor: TenGod | null;
  /** 구응(救應) — 파격 요인을 구하는 십성. */
  gueung: TenGod | null;
  reasons: string[];
}

/** 격 키: 십성 8정격 + 건록/양인/월겁 (비견/겁재 레거시 키는 각각 건록/월겁에 준함). */
type GyeokKey =
  | 'JEONG_GWAN' | 'PYEON_GWAN' | 'JEONG_JAE' | 'PYEON_JAE'
  | 'SIK_SHIN' | 'SANG_GWAN' | 'JEONG_IN' | 'PYEON_IN'
  | 'GEONROK' | 'YANGIN' | 'WOLGEOB';

interface SeongpaeRule {
  usage: 'SUNYONG' | 'YEOKYONG';
  /** 상신 후보 (우선순위 순). */
  sangshin: TenGod[];
  /** 파격 요인 (투출 시 파격). */
  breakers: TenGod[];
  /** 파격 요인별 구응: breaker → 구응 십성 목록. */
  rescues: Partial<Record<TenGod, TenGod[]>>;
  /** 상신 후보 자체가 없으면 파격으로 보는가 (건록/월겁: 용신 외구 필수). */
  requiresSangshin?: boolean;
}

const JAE: TenGod[] = ['JEONG_JAE', 'PYEON_JAE'];
const SIKSANG: TenGod[] = ['SIK_SHIN', 'SANG_GWAN'];
const GWANSAL: TenGod[] = ['JEONG_GWAN', 'PYEON_GWAN'];
const IN: TenGod[] = ['JEONG_IN', 'PYEON_IN'];
const BIGEOP: TenGod[] = ['BI_GYEON', 'GEOB_JAE'];

/**
 * 성패 룰 테이블 (자평진전 순용/역용 기본형).
 * 각 셀의 세부 이설(예: 재격 투간 상신 우선순위)은 v0 대표값 — config 확장 여지.
 */
const SEONGPAE_RULES: Record<GyeokKey, SeongpaeRule> = {
  // 정관격 (순용): 재생관·관인상생이 상신. 상관견관이 대표 파격 — 인성이 제상(구응).
  JEONG_GWAN: {
    usage: 'SUNYONG',
    sangshin: [...JAE, 'JEONG_IN'],
    breakers: ['SANG_GWAN'],
    rescues: { SANG_GWAN: ['JEONG_IN', 'PYEON_IN'] },
  },
  // 칠살격 (역용): 식신제살이 정법, 인화살(印化殺)도 성격. 재당살(財黨殺) 무제면 파격.
  PYEON_GWAN: {
    usage: 'YEOKYONG',
    sangshin: ['SIK_SHIN', 'JEONG_IN', 'PYEON_IN'],
    breakers: [...JAE],
    rescues: { JEONG_JAE: ['SIK_SHIN'], PYEON_JAE: ['SIK_SHIN'] },
  },
  // 재격 (순용): 식상생재 또는 재생관(관성 보호). 비겁 투출 = 군겁쟁재 — 식상 통관·관성 제겁이 구응.
  JEONG_JAE: {
    usage: 'SUNYONG',
    sangshin: [...SIKSANG, 'JEONG_GWAN'],
    breakers: [...BIGEOP],
    rescues: {
      BI_GYEON: [...SIKSANG, ...GWANSAL],
      GEOB_JAE: [...SIKSANG, ...GWANSAL],
    },
  },
  PYEON_JAE: {
    usage: 'SUNYONG',
    sangshin: [...SIKSANG, 'JEONG_GWAN'],
    breakers: [...BIGEOP],
    rescues: {
      BI_GYEON: [...SIKSANG, ...GWANSAL],
      GEOB_JAE: [...SIKSANG, ...GWANSAL],
    },
  },
  // 식신격 (순용): 식신생재가 정법. 효신탈식(편인 투출)이 대표 파격 — 재성 제효가 구응.
  SIK_SHIN: {
    usage: 'SUNYONG',
    sangshin: [...JAE],
    breakers: ['PYEON_IN'],
    rescues: { PYEON_IN: [...JAE] },
  },
  // 상관격 (역용): 상관패인(佩印)·상관생재가 성격. 정관 투출 = 상관견관 파격.
  SANG_GWAN: {
    usage: 'YEOKYONG',
    sangshin: ['JEONG_IN', 'PYEON_IN', ...JAE],
    breakers: ['JEONG_GWAN'],
    rescues: {},
  },
  // 정인격 (순용): 관인상생이 정법. 재극인(탐재괴인)이 파격 — 비겁 제재가 구응.
  JEONG_IN: {
    usage: 'SUNYONG',
    sangshin: [...GWANSAL],
    breakers: [...JAE],
    rescues: { JEONG_JAE: [...BIGEOP], PYEON_JAE: [...BIGEOP] },
  },
  // 편인격/효신 (역용): 재성 제효가 상신. 식신 동주 = 탈식 우려 — 재성이 구응.
  PYEON_IN: {
    usage: 'YEOKYONG',
    sangshin: [...JAE],
    breakers: ['SIK_SHIN'],
    rescues: { SIK_SHIN: [...JAE] },
  },
  // 건록격 (월지 불용): 재·관·식 외구가 필수 — 상신 부재 자체가 파격 사유.
  GEONROK: {
    usage: 'SUNYONG',
    sangshin: [...GWANSAL, ...JAE, 'SIK_SHIN'],
    breakers: [],
    rescues: {},
    requiresSangshin: true,
  },
  // 양인격 (역용): 양인가살(駕殺) — 관살 투출이 상신이자 필수.
  YANGIN: {
    usage: 'YEOKYONG',
    sangshin: [...GWANSAL],
    breakers: [],
    rescues: {},
    requiresSangshin: true,
  },
  // 월겁격 (월지 불용): 건록격과 동일 운용 — 관성 제겁 우선.
  WOLGEOB: {
    usage: 'SUNYONG',
    sangshin: [...GWANSAL, ...SIKSANG, ...JAE],
    breakers: [],
    rescues: {},
    requiresSangshin: true,
  },
};

const TENGOD_KO: Record<string, string> = {
  BI_GYEON: '비견', GEOB_JAE: '겁재', SIK_SHIN: '식신', SANG_GWAN: '상관',
  PYEON_JAE: '편재', JEONG_JAE: '정재', PYEON_GWAN: '편관(칠살)', JEONG_GWAN: '정관',
  PYEON_IN: '편인', JEONG_IN: '정인',
};

export function computeGyeokgukSeongpae(args: {
  /** 월지격 십성 (springLegacy 격 키가 아니라 facts의 gyeokTenGod). */
  gyeokTenGod: TenGod;
  /** 건록/양인/월겁 세분 (감사 B4 bigyeopSubtype) — 있으면 비견/겁재 대신 이 키의 룰 사용. */
  bigyeopSubtype?: 'GEONROK' | 'YANGIN' | 'WOLGEOB' | null;
  dayStem: StemIdx;
  /** 년·월·시 천간 (일간 제외 투출 후보). */
  otherStems: StemIdx[];
  /** 월지 손상 (quality.broken — 탐합망충 해소 후 값). */
  monthBroken: boolean;
}): SeongpaeResult | null {
  const key: GyeokKey | null =
    args.bigyeopSubtype ??
    (args.gyeokTenGod === 'BI_GYEON' ? 'GEONROK'
      : args.gyeokTenGod === 'GEOB_JAE' ? 'WOLGEOB'
        : (args.gyeokTenGod as GyeokKey));
  const rule = SEONGPAE_RULES[key as GyeokKey];
  if (!rule) return null;

  // 투출 십성 (년·월·시 천간 → 일간 기준)
  const transparent = args.otherStems.map((s) => ({ stem: s, tenGod: tenGodOf(args.dayStem, s) }));
  const findFirst = (cands: TenGod[]): { stem: StemIdx; tenGod: TenGod } | null => {
    for (const c of cands) {
      const hit = transparent.find((t) => t.tenGod === c);
      if (hit) return hit;
    }
    return null;
  };

  const reasons: string[] = [];
  const sangshinHit = findFirst(rule.sangshin);
  const breakerHit = findFirst(rule.breakers);

  let gueung: TenGod | null = null;
  if (breakerHit) {
    const rescueCands = rule.rescues[breakerHit.tenGod] ?? [];
    const rescueHit = findFirst(rescueCands);
    if (rescueHit) gueung = rescueHit.tenGod;
  }

  let verdict: SeongpaeVerdict;
  if (breakerHit && gueung) {
    verdict = 'PAJUNG_YUGU';
    reasons.push(`파격요인:${TENGOD_KO[breakerHit.tenGod]} 투출`, `구응:${TENGOD_KO[gueung]}`);
  } else if (breakerHit && sangshinHit) {
    verdict = 'SEONGJUNG_YUPA';
    reasons.push(`상신:${TENGOD_KO[sangshinHit.tenGod]}`, `파격요인:${TENGOD_KO[breakerHit.tenGod]} 공존`);
  } else if (breakerHit) {
    verdict = 'PAGYEOK';
    reasons.push(`파격요인:${TENGOD_KO[breakerHit.tenGod]} 투출·구응 무`);
  } else if (sangshinHit) {
    verdict = 'SEONGGYEOK';
    reasons.push(`상신:${TENGOD_KO[sangshinHit.tenGod]}(${stemHanja(sangshinHit.stem)}) 투출`);
  } else if (rule.requiresSangshin) {
    verdict = 'PAGYEOK';
    reasons.push(`${key === 'YANGIN' ? '양인가살(관살)' : '재·관·식 외구'} 부재`);
  } else {
    verdict = 'UNDETERMINED';
    reasons.push('상신·파격 요인 투출 무 — 지장간·운 대비 판정은 후속');
  }

  // 월지 손상(형충 파격)은 성격을 성중유패로, 미확정을 파격 방향으로 끌어내린다.
  if (args.monthBroken) {
    reasons.push('월지 손상(형충 — 탐합망충 해소 후에도 잔존)');
    if (verdict === 'SEONGGYEOK') verdict = 'SEONGJUNG_YUPA';
    else if (verdict === 'UNDETERMINED') verdict = 'PAGYEOK';
  }

  reasons.unshift(`${rule.usage === 'SUNYONG' ? '순용(길신 생조)' : '역용(흉신 제화)'}:${key}`);

  return {
    verdict,
    usage: rule.usage,
    sangshin: sangshinHit?.tenGod ?? null,
    sangshinStemHanja: sangshinHit ? stemHanja(sangshinHit.stem) : null,
    pagyeokFactor: breakerHit?.tenGod ?? null,
    gueung,
    reasons,
  };
}
