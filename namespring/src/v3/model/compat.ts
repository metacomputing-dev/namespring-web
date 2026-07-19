/**
 * 궁합 화면의 두 사람 선택 상태. 프로필과 같은 원칙으로 sessionStorage에만
 * 두고, 공유 URL에는 절대 싣지 않는다.
 */
import type {
  CompatRelationshipToneV1,
  CompatRelationshipV1,
} from '@spring/report/compatibility/index';
import type { V3Profile } from './profile';

export type CompatSlotKey = 'a' | 'b';

export interface CompatSlot {
  profile: V3Profile;
  /** 표시용 호칭(보관 라벨). 비우면 이름으로 보여준다. */
  label?: string;
}

const KEYS: Record<CompatSlotKey, string> = {
  a: 'namespring_v3_compat_a',
  b: 'namespring_v3_compat_b',
};

function parseSlot(raw: string | null): CompatSlot | null {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CompatSlot;
    if (!parsed?.profile?.birth || typeof parsed.profile.birth.year !== 'number') return null;
    if (!Array.isArray(parsed.profile.surname) || !Array.isArray(parsed.profile.givenName)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function loadCompatSlot(key: CompatSlotKey): CompatSlot | null {
  try {
    return parseSlot(sessionStorage.getItem(KEYS[key]));
  } catch {
    return null;
  }
}

export function saveCompatSlot(key: CompatSlotKey, slot: CompatSlot) {
  try {
    sessionStorage.setItem(KEYS[key], JSON.stringify(slot));
  } catch {
    /* storage unavailable */
  }
}

export function clearCompatSlot(key: CompatSlotKey) {
  try {
    sessionStorage.removeItem(KEYS[key]);
  } catch {
    /* storage unavailable */
  }
}

/* ------------------------------------------------------------------ */
/* 두 사람의 관계 (해석 프레임 선택)                                       */
/* ------------------------------------------------------------------ */

const RELATIONSHIP_KEY = 'namespring_v3_compat_rel';

const RELATIONSHIP_VALUES: readonly CompatRelationshipV1[] = [
  'romance',
  'friendship',
  'family',
  'partnership',
  'unspecified',
];

const RELATIONSHIP_TONES: readonly CompatRelationshipToneV1[] = [
  'peer',
  'hierarchy',
  'care',
];

/**
 * 두 사람의 관계 선택: 엔진 카테고리 + 상세 라벨(예: '엄마와 딸') + 결.
 * 라벨·결은 프리셋 카탈로그나 직접 입력에서 온다. 없으면 카테고리만 쓴다.
 */
export interface CompatRelationshipSelection {
  category: CompatRelationshipV1;
  /** 표시용 상세 라벨. 없으면 RELATIONSHIP_KO[category]로 보여준다. */
  label?: string;
  /** 관계의 결 (peer·hierarchy·care). 프리셋이 정해 준다. */
  tone?: CompatRelationshipToneV1;
}

/** 관계별 표시 라벨. 목록 카드 등에서는 unspecified를 생략해 쓴다. */
export const RELATIONSHIP_KO: Record<CompatRelationshipV1, string> = {
  romance: '연인·부부',
  friendship: '친구',
  family: '가족',
  partnership: '동료·파트너',
  unspecified: '아직 몰라요',
};

/**
 * 저장돼 있던 관계 값을 현재 모양으로 정규화한다.
 * 구버전은 카테고리 문자열만 저장했다 — 그대로 {category}로 승격한다.
 */
export function normalizeRelationshipSelection(raw: unknown): CompatRelationshipSelection {
  if (typeof raw === 'string' && (RELATIONSHIP_VALUES as readonly string[]).includes(raw)) {
    return { category: raw as CompatRelationshipV1 };
  }
  if (raw && typeof raw === 'object') {
    const candidate = raw as { category?: unknown; label?: unknown; tone?: unknown };
    if (
      typeof candidate.category === 'string'
      && (RELATIONSHIP_VALUES as readonly string[]).includes(candidate.category)
    ) {
      const selection: CompatRelationshipSelection = {
        category: candidate.category as CompatRelationshipV1,
      };
      if (typeof candidate.label === 'string' && candidate.label.trim()) {
        selection.label = candidate.label.trim();
      }
      if (
        typeof candidate.tone === 'string'
        && (RELATIONSHIP_TONES as readonly string[]).includes(candidate.tone)
      ) {
        selection.tone = candidate.tone as CompatRelationshipToneV1;
      }
      return selection;
    }
  }
  return { category: 'unspecified' };
}

export function loadCompatRelationship(): CompatRelationshipSelection {
  try {
    const raw = sessionStorage.getItem(RELATIONSHIP_KEY);
    if (!raw) return { category: 'unspecified' };
    let parsed: unknown = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* 구버전 평문 문자열 — 그대로 정규화한다. */
    }
    return normalizeRelationshipSelection(parsed);
  } catch {
    return { category: 'unspecified' };
  }
}

export function saveCompatRelationship(selection: CompatRelationshipSelection) {
  try {
    sessionStorage.setItem(RELATIONSHIP_KEY, JSON.stringify(selection));
  } catch {
    /* storage unavailable */
  }
}
