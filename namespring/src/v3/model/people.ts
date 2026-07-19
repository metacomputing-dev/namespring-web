/**
 * 사람 보관함: 궁합 등에서 다시 쓸 사람(이름+출생 정보)을 이 기기에 저장한다.
 * 이름만 남기는 favorites와 달리 출생 정보까지 통째로 보관하므로,
 * 공유 URL·서버 어디에도 싣지 않고 localStorage에만 둔다.
 */
import type { V3Profile } from './profile';

export interface StoredPerson {
  id: string;
  /** 보조 호칭(예: 손녀). 이름을 대체하지 않고 배지로 곁들여 보여준다. */
  label?: string;
  profile: V3Profile;
  savedAt: number;
}

const STORAGE_KEY = 'namespring_v3_people';
const MAX_PEOPLE = 50;

function isValidProfile(profile: unknown): profile is V3Profile {
  if (!profile || typeof profile !== 'object') return false;
  const p = profile as V3Profile;
  return (
    Array.isArray(p.surname)
    && Array.isArray(p.givenName)
    && p.surname.length > 0
    && p.givenName.length > 0
    && !!p.birth
    && typeof p.birth.year === 'number'
  );
}

export function listPeople(): StoredPerson[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredPerson[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      entry => entry && typeof entry.id === 'string' && isValidProfile(entry.profile),
    );
  } catch {
    return [];
  }
}

function persist(entries: StoredPerson[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_PEOPLE)));
  } catch {
    /* storage unavailable */
  }
}

/** 표시용 이름 — 항상 본명(한글 전체 이름). 호칭은 personLabel()로 보조 표시한다. */
export function personName(person: Pick<StoredPerson, 'label' | 'profile'>): string {
  return [...person.profile.surname, ...person.profile.givenName].map(c => c.hangul).join('');
}

/** 보조 호칭 배지 — 호칭이 있고 본명과 다를 때만 돌려준다. */
export function personLabel(person: Pick<StoredPerson, 'label' | 'profile'>): string | null {
  const label = person.label?.trim();
  if (!label || label === personName(person)) return null;
  return label;
}

export function personBirthLabel(profile: V3Profile): string {
  const { birth } = profile;
  const calendar = birth.calendarType === 'lunar' ? '음력' : '양력';
  const time =
    birth.hour === null
      ? '시각 모름'
      : `${birth.hour}시 ${(birth.minute ?? 0).toString().padStart(2, '0')}분`;
  return `${calendar} ${birth.year}년 ${birth.month}월 ${birth.day}일 · ${time}`;
}

/** 같은 사람(이름+출생 정보가 동일)을 두 번 저장하지 않기 위한 내용 키. */
export function personContentKey(profile: V3Profile): string {
  const name = [...profile.surname, ...profile.givenName]
    .map(c => `${c.hangul}:${c.hanja ?? ''}`)
    .join('|');
  const { birth } = profile;
  return [
    name,
    birth.year,
    birth.month,
    birth.day,
    birth.hour ?? 'x',
    birth.minute ?? 'x',
    birth.calendarType,
    birth.isLeapMonth ? 'leap' : '',
    birth.gender,
  ].join('/');
}

/** 저장하고 저장된 항목을 돌려준다. 같은 내용이 이미 있으면 그 항목을 돌려준다. */
export function savePerson(profile: V3Profile, label?: string): StoredPerson {
  const entries = listPeople();
  const key = personContentKey(profile);
  const existing = entries.find(entry => personContentKey(entry.profile) === key);
  if (existing) {
    if (label && label.trim() && existing.label !== label.trim()) {
      existing.label = label.trim();
      persist(entries);
    }
    return existing;
  }
  const entry: StoredPerson = {
    id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    label: label?.trim() || undefined,
    profile,
    savedAt: Date.now(),
  };
  persist([entry, ...entries]);
  return entry;
}

export function removePerson(id: string) {
  persist(listPeople().filter(entry => entry.id !== id));
}

export function getPerson(id: string): StoredPerson | null {
  return listPeople().find(entry => entry.id === id) ?? null;
}
