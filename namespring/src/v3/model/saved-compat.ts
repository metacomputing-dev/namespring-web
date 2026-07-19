/**
 * 저장해 둔 궁합: 두 사람의 짝을 이 기기에 남겨 두었다가 다시 연다.
 * 출생 정보가 포함되므로 localStorage에만 두고 어디에도 싣지 않는다.
 */
import {
  normalizeRelationshipSelection,
  type CompatRelationshipSelection,
  type CompatSlot,
} from './compat';
import { personContentKey } from './people';
import { fullHangulName } from './profile';

export interface SavedCompat {
  id: string;
  a: CompatSlot;
  b: CompatSlot;
  savedAt: number;
  /** 저장 시점의 통합 점수·등급 (목록 표시용 스냅샷). */
  score: number | null;
  gradeLabel: string | null;
  /** 저장 시점에 고른 두 사람의 관계. 다시 열 때 그대로 복원한다. */
  relationship?: CompatRelationshipSelection;
}

const STORAGE_KEY = 'namespring_v3_saved_compat';
const MAX_ENTRIES = 50;

export function compatPairKey(a: CompatSlot, b: CompatSlot): string {
  // A↔B 순서를 바꿔도 같은 짝으로 본다.
  return [personContentKey(a.profile), personContentKey(b.profile)].sort().join('||');
}

/** 표시용 짝 이름 — 항상 본명끼리 잇는다(예: '김민준 · 김하윤'). 호칭은 배지로 곁들인다. */
export function compatPairName(entry: Pick<SavedCompat, 'a' | 'b'>): string {
  return `${fullHangulName(entry.a.profile)} · ${fullHangulName(entry.b.profile)}`;
}

/** 슬롯의 보조 호칭 — 호칭이 있고 본명과 다를 때만 돌려준다. */
export function compatSlotLabel(slot: CompatSlot): string | null {
  const label = slot.label?.trim();
  if (!label || label === fullHangulName(slot.profile)) return null;
  return label;
}

/** 짝의 보조 호칭 묶음 — 둘 다 없으면 null (예: '손녀'만 있으면 그쪽만 채워진다). */
export function compatPairLabel(entry: Pick<SavedCompat, 'a' | 'b'>): string | null {
  const labels = [compatSlotLabel(entry.a), compatSlotLabel(entry.b)].filter(
    (label): label is string => label !== null,
  );
  return labels.length > 0 ? labels.join(' · ') : null;
}

export function listSavedCompats(): SavedCompat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as (Omit<SavedCompat, 'relationship'> & {
      /** 구버전은 카테고리 문자열만 저장했다 — 읽을 때 정규화한다. */
      relationship?: unknown;
    })[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        entry =>
          entry
          && typeof entry.id === 'string'
          && entry.a?.profile?.birth
          && entry.b?.profile?.birth,
      )
      .map(entry => ({
        ...entry,
        relationship:
          entry.relationship == null
            ? undefined
            : normalizeRelationshipSelection(entry.relationship),
      }));
  } catch {
    return [];
  }
}

function persist(entries: SavedCompat[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* storage unavailable */
  }
}

export function isCompatSaved(a: CompatSlot, b: CompatSlot): boolean {
  const key = compatPairKey(a, b);
  return listSavedCompats().some(entry => compatPairKey(entry.a, entry.b) === key);
}

/** 같은 짝이 이미 있으면 점수 스냅샷만 갱신한다. */
export function saveCompat(
  a: CompatSlot,
  b: CompatSlot,
  score: number | null,
  gradeLabel: string | null,
  relationship?: CompatRelationshipSelection,
): SavedCompat {
  const entries = listSavedCompats();
  const key = compatPairKey(a, b);
  const existing = entries.find(entry => compatPairKey(entry.a, entry.b) === key);
  if (existing) {
    existing.score = score;
    existing.gradeLabel = gradeLabel;
    existing.relationship = relationship;
    persist(entries);
    return existing;
  }
  const entry: SavedCompat = {
    id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    a,
    b,
    savedAt: Date.now(),
    score,
    gradeLabel,
    relationship,
  };
  persist([entry, ...entries]);
  return entry;
}

export function removeSavedCompat(id: string) {
  persist(listSavedCompats().filter(entry => entry.id !== id));
}
