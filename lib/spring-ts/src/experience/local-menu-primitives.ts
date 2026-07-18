import {
  LocalMenuContractErrorV1,
  type LocalMenuContractReasonV1,
} from './local-menu-types.js';

export const MAX_LOCATION_TEXT_LENGTH = 256;
export const MAX_TIMEZONE_LENGTH = 64;

export function failLocalMenu(reason: LocalMenuContractReasonV1): never {
  throw new LocalMenuContractErrorV1(reason);
}

export function assertLocalDataObject(
  value: unknown,
  allowedKeys: readonly string[],
  reason: LocalMenuContractReasonV1 = 'INVALID_SHAPE',
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    failLocalMenu(reason);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) failLocalMenu(reason);
  const allowed = new Set(allowedKeys);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.has(key)) failLocalMenu('UNKNOWN_FIELD');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      failLocalMenu(reason);
    }
  }
}

export function isBoundedCanonicalText(value: unknown, max: number): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= max
    && value === value.trim()
    && value === value.normalize('NFC')
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

export function isOneHangul(value: unknown): value is string {
  return typeof value === 'string'
    && value === value.normalize('NFC')
    && /^[\uAC00-\uD7A3]$/u.test(value);
}

export function isOneUnicodeScalar(value: unknown): value is string {
  if (typeof value !== 'string' || Array.from(value).length !== 1) return false;
  const codePoint = value.codePointAt(0);
  return codePoint !== undefined && (codePoint < 0xD800 || codePoint > 0xDFFF);
}

export function isValidSolarDate(year: number, month: number, day: number): boolean {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function randomLocalOpaqueId(
  prefix: 'local_context_v1_' | 'local_export_v1_',
): string {
  const provider = globalThis.crypto;
  if (!provider || typeof provider.getRandomValues !== 'function') {
    failLocalMenu('SECURE_RANDOM_UNAVAILABLE');
  }
  const bytes = provider.getRandomValues(new Uint8Array(16));
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return `${prefix}${hex}`;
}

export function freezeLocalOwned<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value as object)) return value;
  seen.add(value as object);
  for (const child of Object.values(value as Record<string, unknown>)) {
    freezeLocalOwned(child, seen);
  }
  return Object.freeze(value);
}

export function formatLocalDate(
  value: { readonly year: number; readonly month: number; readonly day: number },
): string {
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}

export function parseCanonicalLocalDateText(
  value: unknown,
): { readonly year: number; readonly month: number; readonly day: number } | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isSafeInteger(year)
    || year < 1
    || year > 9_999
    || !Number.isSafeInteger(month)
    || !Number.isSafeInteger(day)) {
    return null;
  }
  return { year, month, day };
}

export function isCanonicalLocalTimestamp(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}
