/**
 * 보관함: 작명 후보 중 마음에 든 이름을 이 기기에 저장한다.
 * 출생 정보는 함께 저장하지 않는다 — 이름 글자만 남긴다.
 */
import type { ProfileNameChar } from './profile';

export interface FavoriteName {
  id: string;
  fullHangul: string;
  fullHanja: string;
  surname: ProfileNameChar[];
  givenName: ProfileNameChar[];
  savedAt: number;
}

const STORAGE_KEY = 'namespring_v3_favorites';

export function listFavorites(): FavoriteName[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FavoriteName[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(entry => entry && typeof entry.id === 'string');
  } catch {
    return [];
  }
}

function persist(entries: FavoriteName[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable */
  }
}

export function favoriteId(fullHangul: string, fullHanja: string): string {
  return `${fullHangul}:${fullHanja}`;
}

export function isFavorite(id: string): boolean {
  return listFavorites().some(entry => entry.id === id);
}

/** 저장돼 있으면 지우고, 없으면 저장한다. 저장 여부를 돌려준다. */
export function toggleFavorite(entry: Omit<FavoriteName, 'savedAt'>): boolean {
  const entries = listFavorites();
  const existing = entries.findIndex(item => item.id === entry.id);
  if (existing >= 0) {
    entries.splice(existing, 1);
    persist(entries);
    return false;
  }
  persist([{ ...entry, savedAt: Date.now() }, ...entries].slice(0, 100));
  return true;
}

export function removeFavorite(id: string) {
  persist(listFavorites().filter(entry => entry.id !== id));
}
