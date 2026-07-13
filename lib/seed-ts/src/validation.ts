import type { HanjaEntry } from './database/hanja-repository.js';
import { SeedValidationError } from './errors.js';
import type { UserInfo } from './types.js';
import { countCodePointsUpTo } from './utils/bounded-code-point-count.js';
import { decomposeHangulSyllable } from './utils/hangul-name-entry.js';

const VALID_ELEMENTS = new Set(['Wood', 'Fire', 'Earth', 'Metal', 'Water']);
const VALID_GENDERS = new Set(['male', 'female', 'neutral']);
const VALID_CALENDAR_TYPES = new Set(['solar', 'lunar']);
const VALID_PURE_HANGUL_MODES = new Set(['auto', 'on', 'off']);
const BIRTH_DATE_TIME_FIELDS = new Set([
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'calendarType',
  'isLeapMonth',
]);
const ANALYSIS_OPTION_FIELDS = new Set([
  'pureHangulNameMode',
  'useSurnameHanjaInPureHangul',
]);
const VALID_ONSETS = new Set([
  '\u3131', '\u3132', '\u3134', '\u3137', '\u3138', '\u3139', '\u3141', '\u3142', '\u3143',
  '\u3145', '\u3146', '\u3147', '\u3148', '\u3149', '\u314a', '\u314b', '\u314c', '\u314d', '\u314e',
]);
const VALID_NUCLEI = new Set([
  '\u314f', '\u3150', '\u3151', '\u3152', '\u3153', '\u3154', '\u3155', '\u3156', '\u3157', '\u3158', '\u3159',
  '\u315a', '\u315b', '\u315c', '\u315d', '\u315e', '\u315f', '\u3160', '\u3161', '\u3162', '\u3163',
]);
const MAX_MEANING_LENGTH = 512;
const MAX_RADICAL_LENGTH = 32;

function fail(
  code: ConstructorParameters<typeof SeedValidationError>[0],
  message: string,
  path: string,
  received?: unknown,
): never {
  throw new SeedValidationError(code, message, path, received);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertNameEntryScalar(
  condition: boolean,
  message: string,
  path: string,
  received: unknown,
): void {
  if (!condition) fail('INVALID_INPUT', message, path, received);
}

function assertEntry(
  entry: HanjaEntry,
  path: string,
  policy: {
    readonly allowDerivedPlaceholders: boolean;
    readonly requireSurnameEligible: boolean;
  },
): void {
  if (!isPlainRecord(entry)) {
    fail('INVALID_INPUT', 'Name entry must be an object.', path, entry);
  }

  assertNameEntryScalar(
    Number.isSafeInteger(entry.id) && entry.id >= 0,
    'Name entry id must be a non-negative safe integer.',
    `${path}.id`,
    entry.id,
  );
  assertNameEntryScalar(
    typeof entry.hangul === 'string',
    'Name entry Hangul must be a string.',
    `${path}.hangul`,
    entry.hangul,
  );
  assertNameEntryScalar(
    typeof entry.hanja === 'string',
    'Name entry Hanja must be a string.',
    `${path}.hanja`,
    entry.hanja,
  );
  assertNameEntryScalar(
    typeof entry.meaning === 'string',
    'Name entry meaning must be a string.',
    `${path}.meaning`,
    entry.meaning,
  );
  assertNameEntryScalar(
    typeof entry.radical === 'string',
    'Name entry radical must be a string.',
    `${path}.radical`,
    entry.radical,
  );
  const meaningLength = countCodePointsUpTo(entry.meaning, MAX_MEANING_LENGTH);
  assertNameEntryScalar(
    meaningLength <= MAX_MEANING_LENGTH,
    `Name entry meaning must not exceed ${MAX_MEANING_LENGTH} Unicode characters.`,
    `${path}.meaning`,
    meaningLength,
  );
  const radicalLength = countCodePointsUpTo(entry.radical, MAX_RADICAL_LENGTH);
  assertNameEntryScalar(
    radicalLength <= MAX_RADICAL_LENGTH,
    `Name entry radical must not exceed ${MAX_RADICAL_LENGTH} Unicode characters.`,
    `${path}.radical`,
    radicalLength,
  );
  assertNameEntryScalar(
    typeof entry.is_surname === 'boolean',
    'Name entry surname flag must be boolean.',
    `${path}.is_surname`,
    entry.is_surname,
  );
  if (policy.requireSurnameEligible && entry.is_surname !== true) {
    fail(
      'INVALID_SURNAME_FLAG',
      'Surname entries must be marked as surname-eligible.',
      `${path}.is_surname`,
      entry.is_surname,
    );
  }

  const isHangulOnlyPlaceholder = policy.allowDerivedPlaceholders
    && (entry.hanja === '' || entry.hanja === entry.hangul);
  const hanjaLength = countCodePointsUpTo(entry.hanja, 1);
  if (
    !isHangulOnlyPlaceholder
    && (hanjaLength !== 1 || !/^\p{Script=Han}$/u.test(entry.hanja))
  ) {
    fail(
      'INVALID_HANJA_CHARACTER',
      'Non-Hangul name entries must contain exactly one Unicode Han character.',
      `${path}.hanja`,
      hanjaLength,
    );
  }

  const hangulLength = countCodePointsUpTo(entry.hangul, 1);
  const parts = hangulLength === 1
    ? decomposeHangulSyllable(entry.hangul)
    : null;
  const codePoint = hangulLength === 1 ? entry.hangul.codePointAt(0) ?? -1 : -1;
  if (
    hangulLength !== 1
    || codePoint < 0xac00
    || codePoint > 0xd7a3
    || parts === null
  ) {
    fail(
      'INVALID_HANGUL_SYLLABLE',
      'Name entry must contain exactly one precomposed Hangul syllable.',
      `${path}.hangul`,
      hangulLength,
    );
  }

  const validStrokeCount = policy.allowDerivedPlaceholders
    ? Number.isFinite(entry.strokes) && Number.isInteger(entry.strokes) && entry.strokes >= 0
    : Number.isFinite(entry.strokes) && Number.isInteger(entry.strokes) && entry.strokes > 0;
  if (!validStrokeCount) {
    fail(
      'INVALID_STROKE_COUNT',
      policy.allowDerivedPlaceholders
        ? 'Hangul-only placeholder stroke count must be a non-negative finite integer.'
        : 'Stroke count must be a positive finite integer.',
      `${path}.strokes`,
      entry.strokes,
    );
  }

  const validStrokeElement = VALID_ELEMENTS.has(entry.stroke_element)
    || (policy.allowDerivedPlaceholders && entry.stroke_element === '');
  if (!validStrokeElement) {
    fail(
      'INVALID_ELEMENT',
      policy.allowDerivedPlaceholders
        ? 'Hangul-only stroke element must be empty or a supported element.'
        : 'Stroke element must be one of Wood, Fire, Earth, Metal, or Water.',
      `${path}.stroke_element`,
      entry.stroke_element,
    );
  }

  const validResourceElement = VALID_ELEMENTS.has(entry.resource_element)
    || (policy.allowDerivedPlaceholders && entry.resource_element === '');
  if (!validResourceElement) {
    fail(
      'INVALID_ELEMENT',
      policy.allowDerivedPlaceholders
        ? 'Hangul-only resource element must be empty or a supported element.'
        : 'Resource element must be one of Wood, Fire, Earth, Metal, or Water.',
      `${path}.resource_element`,
      entry.resource_element,
    );
  }

  if (!VALID_ONSETS.has(entry.onset) || entry.onset !== parts.onset) {
    fail(
      'INVALID_ONSET',
      'Onset must match the Hangul syllable decomposition.',
      `${path}.onset`,
      entry.onset,
    );
  }

  if (!VALID_NUCLEI.has(entry.nucleus) || entry.nucleus !== parts.nucleus) {
    fail(
      'INVALID_NUCLEUS',
      'Nucleus must match the Hangul syllable decomposition.',
      `${path}.nucleus`,
      entry.nucleus,
    );
  }
}

function assertBirthDateTime(value: unknown): void {
  if (!isPlainRecord(value)) {
    fail(
      'INVALID_BIRTH_DATE_TIME',
      'Birth date and time must be a plain object.',
      'birthDateTime',
      value,
    );
  }
  for (const field of Object.keys(value)) {
    if (!BIRTH_DATE_TIME_FIELDS.has(field)) {
      fail(
        'INVALID_BIRTH_DATE_TIME',
        'Birth date and time contains an unsupported field.',
        'birthDateTime',
        value[field],
      );
    }
  }

  const readInteger = (
    key: 'year' | 'month' | 'day' | 'hour' | 'minute',
    minimum: number,
    maximum: number,
  ): number | null => {
    const field = value[key];
    if (field === undefined || field === null) return null;
    if (
      typeof field !== 'number'
      || !Number.isSafeInteger(field)
      || field < minimum
      || field > maximum
    ) {
      fail(
        'INVALID_BIRTH_DATE_TIME',
        `birthDateTime.${key} must be an integer from ${minimum} to ${maximum}, or null.`,
        `birthDateTime.${key}`,
        field,
      );
    }
    return field as number;
  };

  const year = readInteger('year', 1, 9999);
  const month = readInteger('month', 1, 12);
  const day = readInteger('day', 1, 31);
  readInteger('hour', 0, 23);
  readInteger('minute', 0, 59);

  const calendarType = value.calendarType;
  if (
    calendarType !== undefined
    && !VALID_CALENDAR_TYPES.has(calendarType as string)
  ) {
    fail(
      'INVALID_BIRTH_DATE_TIME',
      'Calendar type must be solar or lunar when provided.',
      'birthDateTime.calendarType',
      calendarType,
    );
  }

  const isLeapMonth = value.isLeapMonth;
  if (isLeapMonth !== undefined && typeof isLeapMonth !== 'boolean') {
    fail(
      'INVALID_BIRTH_DATE_TIME',
      'Leap-month flag must be boolean when provided.',
      'birthDateTime.isLeapMonth',
      isLeapMonth,
    );
  }
  if (isLeapMonth === true && calendarType !== 'lunar') {
    fail(
      'INVALID_BIRTH_DATE_TIME',
      'Leap-month flag is valid only for lunar calendar input.',
      'birthDateTime.isLeapMonth',
      isLeapMonth,
    );
  }

  if (month !== null && day !== null) {
    let maximumDay: number;
    if (calendarType === 'lunar') {
      maximumDay = 30;
    } else if (month === 2) {
      const leapYear = year === null
        || (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
      maximumDay = leapYear ? 29 : 28;
    } else {
      maximumDay = [4, 6, 9, 11].includes(month) ? 30 : 31;
    }

    if (day > maximumDay) {
      fail(
        'INVALID_BIRTH_DATE_TIME',
        'Day is outside the valid range for the supplied month and calendar.',
        'birthDateTime.day',
        day,
      );
    }
  }
}

function assertAnalysisOptions(value: unknown): void {
  if (value === undefined) return;
  if (!isPlainRecord(value)) {
    fail(
      'INVALID_ANALYSIS_OPTIONS',
      'Analysis options must be a plain object when provided.',
      'options',
      value,
    );
  }
  for (const field of Object.keys(value)) {
    if (!ANALYSIS_OPTION_FIELDS.has(field)) {
      fail(
        'INVALID_ANALYSIS_OPTIONS',
        'Analysis options contain an unsupported field.',
        'options',
        value[field],
      );
    }
  }

  if (
    value.pureHangulNameMode !== undefined
    && !VALID_PURE_HANGUL_MODES.has(value.pureHangulNameMode as string)
  ) {
    fail(
      'INVALID_ANALYSIS_OPTIONS',
      'Pure Hangul mode must be auto, on, or off.',
      'options.pureHangulNameMode',
      value.pureHangulNameMode,
    );
  }
  if (
    value.useSurnameHanjaInPureHangul !== undefined
    && typeof value.useSurnameHanjaInPureHangul !== 'boolean'
  ) {
    fail(
      'INVALID_ANALYSIS_OPTIONS',
      'Pure Hangul surname-Hanja option must be boolean.',
      'options.useSurnameHanjaInPureHangul',
      value.useSurnameHanjaInPureHangul,
    );
  }
}

export function assertValidUserInfoEnvelope(userInfo: UserInfo): void {
  if (!isPlainRecord(userInfo)) {
    fail('INVALID_INPUT', 'User information must be an object.', 'userInfo', userInfo);
  }
  if (!Array.isArray(userInfo.lastName) || userInfo.lastName.length === 0) {
    fail('EMPTY_SURNAME', 'At least one surname syllable is required.', 'lastName', userInfo.lastName);
  }
  if (userInfo.lastName.length > 2) {
    fail(
      'INVALID_SURNAME_LENGTH',
      'Surname must contain one or two syllables.',
      'lastName',
      userInfo.lastName.length,
    );
  }
  if (!Array.isArray(userInfo.firstName) || userInfo.firstName.length === 0) {
    fail('EMPTY_GIVEN_NAME', 'At least one given-name syllable is required.', 'firstName', userInfo.firstName);
  }
  if (userInfo.firstName.length > 4) {
    fail(
      'INVALID_GIVEN_NAME_LENGTH',
      'Given name must contain one to four syllables.',
      'firstName',
      userInfo.firstName.length,
    );
  }

  if (!VALID_GENDERS.has(userInfo.gender)) {
    fail(
      'INVALID_GENDER',
      'Gender must be male, female, or neutral.',
      'gender',
      userInfo.gender,
    );
  }
  assertBirthDateTime(userInfo.birthDateTime);
  assertAnalysisOptions(userInfo.options);
}

export function areEntriesHangulOnly(entries: readonly HanjaEntry[]): boolean {
  return entries.length > 0 && entries.every((entry) => {
    if (!isPlainRecord(entry)) return false;
    if (typeof entry.hangul !== 'string' || typeof entry.hanja !== 'string') return false;
    // A placeholder is empty or one Hangul code point (at most two UTF-16
    // code units). Bound work before trim() so whitespace padding cannot
    // bypass the strict per-entry validation that follows mode resolution.
    if (entry.hanja.length > 2) return false;
    const hanja = entry.hanja.trim();
    return hanja.length === 0 || hanja === entry.hangul;
  });
}

export function assertNameEntriesForAnalysis(
  userInfo: UserInfo,
  policy: {
    readonly convertLastNameToHangul: boolean;
    readonly convertFirstNameToHangul: boolean;
  },
): void {
  userInfo.lastName.forEach((entry, index) =>
    assertEntry(entry, `lastName[${index}]`, {
      allowDerivedPlaceholders: policy.convertLastNameToHangul,
      requireSurnameEligible: true,
    }));
  userInfo.firstName.forEach((entry, index) =>
    assertEntry(entry, `firstName[${index}]`, {
      allowDerivedPlaceholders: policy.convertFirstNameToHangul,
      requireSurnameEligible: false,
    }));
}

/** Strict compatibility validator for callers that do not perform mode-aware normalization. */
export function assertValidUserInfo(userInfo: UserInfo): void {
  assertValidUserInfoEnvelope(userInfo);
  assertNameEntriesForAnalysis(userInfo, {
    convertLastNameToHangul: false,
    convertFirstNameToHangul: false,
  });
}

export function cloneNameEntries(entries: readonly HanjaEntry[]): HanjaEntry[] {
  return entries.map((entry) => ({
    id: entry.id,
    hangul: entry.hangul,
    hanja: entry.hanja,
    onset: entry.onset,
    nucleus: entry.nucleus,
    strokes: entry.strokes,
    stroke_element: entry.stroke_element,
    resource_element: entry.resource_element,
    meaning: entry.meaning,
    radical: entry.radical,
    is_surname: entry.is_surname,
  }));
}
