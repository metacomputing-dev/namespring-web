export const SHARE_QUERY_KEY = 's';

const SHARE_PAYLOAD_VERSION = 1;
const DEFAULT_BIRTH_HOUR = 12;
const DEFAULT_BIRTH_MINUTE = 0;

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toFlag(value) {
  return value ? 1 : 0;
}

function toCompactEntry(entry, isSurnameFallback) {
  if (!entry || typeof entry !== 'object') return null;
  const hangul = String(entry.hangul ?? '').trim();
  if (!hangul) return null;

  return [
    toSafeNumber(entry.id, 0),
    hangul,
    String(entry.hanja ?? ''),
    String(entry.onset ?? ''),
    String(entry.nucleus ?? ''),
    toSafeNumber(entry.strokes, 0),
    String(entry.stroke_element ?? ''),
    String(entry.resource_element ?? ''),
    String(entry.meaning ?? ''),
    String(entry.radical ?? ''),
    toFlag(entry.is_surname === undefined ? isSurnameFallback : Boolean(entry.is_surname)),
  ];
}

function fromCompactEntry(value, isSurnameFallback) {
  if (!Array.isArray(value)) return null;

  const hangul = String(value[1] ?? '').trim();
  if (!hangul) return null;

  return {
    id: toSafeNumber(value[0], 0),
    hangul,
    hanja: String(value[2] ?? ''),
    onset: String(value[3] ?? ''),
    nucleus: String(value[4] ?? ''),
    strokes: toSafeNumber(value[5], 0),
    stroke_element: String(value[6] ?? ''),
    resource_element: String(value[7] ?? ''),
    meaning: String(value[8] ?? ''),
    radical: String(value[9] ?? ''),
    is_surname: Number(value[10]) === 1 || Boolean(isSurnameFallback),
  };
}

function toCompactPayload(entryUserInfo) {
  if (!entryUserInfo || typeof entryUserInfo !== 'object') return null;

  const lastName = Array.isArray(entryUserInfo.lastName)
    ? entryUserInfo.lastName.map((entry) => toCompactEntry(entry, true)).filter(Boolean)
    : [];
  const firstName = Array.isArray(entryUserInfo.firstName)
    ? entryUserInfo.firstName.map((entry) => toCompactEntry(entry, false)).filter(Boolean)
    : [];

  if (!lastName.length || !firstName.length) return null;

  const birthDateTime = entryUserInfo.birthDateTime || {};
  return {
    v: SHARE_PAYLOAD_VERSION,
    l: lastName,
    f: firstName,
    lt: String(entryUserInfo.lastNameText ?? ''),
    ft: String(entryUserInfo.firstNameText ?? ''),
    b: [
      toSafeNumber(birthDateTime.year, 0),
      toSafeNumber(birthDateTime.month, 0),
      toSafeNumber(birthDateTime.day, 0),
      toSafeNumber(birthDateTime.hour, DEFAULT_BIRTH_HOUR),
      toSafeNumber(birthDateTime.minute, DEFAULT_BIRTH_MINUTE),
    ],
    g: entryUserInfo.gender === 'female' ? 'f' : 'm',
    n: toFlag(Boolean(entryUserInfo.isNativeKoreanName)),
    s: toFlag(entryUserInfo.isSolarCalendar !== false),
    t: toFlag(Boolean(entryUserInfo.isBirthTimeUnknown)),
  };
}

function fromCompactPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (Number(payload.v) !== SHARE_PAYLOAD_VERSION) return null;

  const lastName = Array.isArray(payload.l)
    ? payload.l.map((entry) => fromCompactEntry(entry, true)).filter(Boolean)
    : [];
  const firstName = Array.isArray(payload.f)
    ? payload.f.map((entry) => fromCompactEntry(entry, false)).filter(Boolean)
    : [];

  if (!lastName.length || !firstName.length) return null;

  const birth = Array.isArray(payload.b) ? payload.b : [];
  const lastNameText = String(payload.lt ?? lastName.map((entry) => entry.hangul).join(''));
  const firstNameText = String(payload.ft ?? firstName.map((entry) => entry.hangul).join(''));

  return {
    lastName,
    firstName,
    lastNameText,
    firstNameText,
    birthDateTime: {
      year: toSafeNumber(birth[0], 0),
      month: toSafeNumber(birth[1], 0),
      day: toSafeNumber(birth[2], 0),
      hour: toSafeNumber(birth[3], DEFAULT_BIRTH_HOUR),
      minute: toSafeNumber(birth[4], DEFAULT_BIRTH_MINUTE),
    },
    gender: payload.g === 'f' ? 'female' : 'male',
    isNativeKoreanName: Number(payload.n) === 1,
    isSolarCalendar: Number(payload.s) !== 0,
    isBirthTimeUnknown: Number(payload.t) === 1,
  };
}

function encodeUtf8ToBase64Url(text) {
  try {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  } catch {
    return '';
  }
}

function decodeBase64UrlToUtf8(value) {
  const normalized = String(value ?? '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!normalized) return '';

  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

export function createShareEntryUserInfoToken(entryUserInfo) {
  const compactPayload = toCompactPayload(entryUserInfo);
  if (!compactPayload) return '';
  const serialized = JSON.stringify(compactPayload);
  return encodeUtf8ToBase64Url(serialized);
}

export function parseShareEntryUserInfoToken(token) {
  if (!token) return null;
  try {
    const decoded = decodeBase64UrlToUtf8(token);
    if (!decoded) return null;
    const parsed = JSON.parse(decoded);
    return fromCompactPayload(parsed);
  } catch {
    return null;
  }
}

export function buildShareLinkFromEntryUserInfo(entryUserInfo, baseUrl) {
  const resolvedBaseUrl = (typeof baseUrl === 'string' && baseUrl)
    ? baseUrl
    : (typeof window !== 'undefined' ? window.location.href : '');
  if (!resolvedBaseUrl) return '';

  const url = new URL(resolvedBaseUrl);
  url.searchParams.delete('tool');
  url.searchParams.delete(SHARE_QUERY_KEY);

  const token = createShareEntryUserInfoToken(entryUserInfo);
  if (token) {
    url.searchParams.set(SHARE_QUERY_KEY, token);
  }
  return url.toString();
}
