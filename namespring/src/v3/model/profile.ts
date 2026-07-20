/**
 * v3 사용자 프로필: 입력 화면이 만들고 보고서 화면들이 읽는 단일 소스.
 * sessionStorage에 보관하며, 공유 URL에는 절대 싣지 않는다.
 */

export interface ProfileNameChar {
  hangul: string;
  hanja?: string;
  /** 한자 선택 모달에서 고른 뜻(표시용). 엔진 계산에는 쓰지 않는다. */
  meaning?: string;
}

export interface ProfileBirth {
  year: number;
  month: number;
  day: number;
  hour: number | null;
  minute: number | null;
  calendarType: 'solar' | 'lunar';
  isLeapMonth: boolean;
  gender: 'male' | 'female' | 'neutral';
  /** 진태양시 보정 */
  trueSolarTime: boolean;
  /** 출생 지역(경도 보정용). 미선택이면 보정 없음 */
  region: string | null;
  /** 야자시 보정 */
  yaza: boolean;
}

export interface V3Profile {
  surname: ProfileNameChar[];
  givenName: ProfileNameChar[];
  birth: ProfileBirth;
  /** 순우리말 이름 여부(한자 없이 평가) */
  pureHangul: boolean;
}

const STORAGE_KEY = 'namespring_v3_profile';
const OVERRIDE_KEY = 'namespring_v3_candidate_override';

function parseProfile(raw: string | null): V3Profile | null {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw) as V3Profile;
    if (!parsed || !Array.isArray(parsed.surname) || !Array.isArray(parsed.givenName)) return null;
    if (!parsed.birth || typeof parsed.birth.year !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 처음 화면에서 입력한 원본 프로필. 후보를 구경해도 바뀌지 않는다. */
export function loadOriginalProfile(): V3Profile | null {
  try {
    return parseProfile(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** 지금 보고서가 읽어야 할 프로필: 후보를 열어 둔 상태면 그 이름을 우선한다. */
export function loadProfile(): V3Profile | null {
  try {
    return (
      parseProfile(sessionStorage.getItem(OVERRIDE_KEY))
      ?? parseProfile(sessionStorage.getItem(STORAGE_KEY))
    );
  } catch {
    return null;
  }
}

export function saveProfile(profile: V3Profile) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    sessionStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** 작명 후보를 "잠깐 그 이름으로 읽어 보기" 상태로 얹는다. */
export function setCandidateOverride(profile: V3Profile) {
  try {
    sessionStorage.setItem(OVERRIDE_KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable */
  }
}

export function clearCandidateOverride() {
  try {
    sessionStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function hasCandidateOverride(): boolean {
  try {
    return parseProfile(sessionStorage.getItem(OVERRIDE_KEY)) !== null;
  } catch {
    return false;
  }
}

export function clearProfile() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function fullHangulName(profile: V3Profile): string {
  return [...profile.surname, ...profile.givenName].map(c => c.hangul).join('');
}

export function fullHanjaName(profile: V3Profile): string | null {
  const chars = [...profile.surname, ...profile.givenName];
  if (chars.some(c => !c.hanja)) return null;
  return chars.map(c => c.hanja).join('');
}
