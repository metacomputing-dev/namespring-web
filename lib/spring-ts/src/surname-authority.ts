import rawAuthority from '../data/korean-surname-authority.json';
import type { NameCharInput } from './types.js';

const SCHEMA_VERSION = 'spring-ts.korean-surname-authority.v1';
const SINGLE_SOURCE_SHA256 =
  'sha256:0f78eefc23e727937714b30215464783bf93882e5636d131c7113cfc1049e449';
const COMPOUND_EVIDENCE_SHA256 =
  'sha256:22cb2c2ab65762a2074355830a5b05756d2f9c966aa4521bfc05c8a1f6ea1f97';
const COMPOUND_ZIP_SHA256 =
  'sha256:f2feb50a8febc09b4d193eeacfec5e7773392b0adc357e318a64095fc5a3dd7b';
const COMPOUND_CSV_SHA256 =
  'sha256:c61eb0d030e632184431027ba84d5f8800f9f8ad225c8d45202505073023dcaa';
const COMPOUND_SOURCE_URL =
  'https://kosis.kr/statisticsList/mass/mass_list.jsp?list_id=&org_id=101&process=statHtml&tbl_id=DT_1IN15SC&vw_cd=';
const HANGUL_SYLLABLE = /^[\uAC00-\uD7A3]$/u;
const HAN_CHARACTER = /^\p{Script=Han}$/u;

interface RawSingleSurname {
  readonly hangul?: unknown;
  readonly hanja?: unknown;
}

interface RawCompoundSurname {
  readonly id?: unknown;
  readonly hangul?: unknown;
  readonly hanja?: unknown;
  readonly population?: unknown;
}

export interface SingleSurnameAuthority {
  readonly kind: 'single';
  readonly hangul: string;
  readonly registeredHanja: readonly string[];
}

export interface CompoundSurnameAuthority {
  readonly kind: 'compound';
  readonly id: string;
  readonly hangul: readonly [string, string];
  readonly hanja: readonly [string, string];
  readonly population: number;
}

export type VerifiedSurnameAuthority =
  | SingleSurnameAuthority
  | CompoundSurnameAuthority;

export type SurnameAuthorityFailureReason =
  | 'unverified_single_surname'
  | 'partial_compound_surname_hanja'
  | 'unverified_compound_surname';

export type SurnameAuthorityResult =
  | { readonly ok: true; readonly authority: VerifiedSurnameAuthority }
  | { readonly ok: false; readonly reason: SurnameAuthorityFailureReason };

function failAsset(): never {
  throw new Error('The Korean surname authority asset is invalid.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function splitExactPair(value: unknown, pattern: RegExp): readonly [string, string] | null {
  if (typeof value !== 'string') return null;
  const characters = Array.from(value);
  if (characters.length !== 2 || characters.some((character) => !pattern.test(character))) {
    return null;
  }
  return [characters[0], characters[1]];
}

function explicitHanja(input: NameCharInput): string | null {
  if (typeof input?.hangul !== 'string' || typeof input.hanja !== 'string') return null;
  if (input.hanja.length > 8) return null;
  const normalized = input.hanja.trim();
  return normalized.length > 0 && normalized !== input.hangul ? normalized : null;
}

function compileAuthority(): {
  readonly singles: ReadonlyMap<string, SingleSurnameAuthority>;
  readonly compounds: ReadonlyMap<string, CompoundSurnameAuthority>;
} {
  if (!isRecord(rawAuthority)
    || rawAuthority.schemaVersion !== SCHEMA_VERSION
    || rawAuthority.generatedAt !== '2026-07-16'
    || !isRecord(rawAuthority.scope)
    || rawAuthority.scope.singleCharacter !== 'canonical_seed_database_rows'
    || rawAuthority.scope.compound
      !== 'officially_observed_minimum_not_complete_legal_registry') {
    failAsset();
  }
  const sources = rawAuthority.sources;
  if (!isRecord(sources)
    || !isRecord(sources.singleCharacter)
    || sources.singleCharacter.id !== 'namespring_hanja_db_surname_rows_2026_07_16'
    || sources.singleCharacter.sha256 !== SINGLE_SOURCE_SHA256
    || sources.singleCharacter.rowCount !== 314
    || sources.singleCharacter.readingCount !== 181
    || !isRecord(sources.compound)
    || sources.compound.id !== 'kosis_2015_dt_1in15sc_compound_surnames'
    || sources.compound.tableId !== 'DT_1IN15SC'
    || sources.compound.year !== 2015
    || sources.compound.sourceFileId !== '101_DT_1IN15SC_F_2015'
    || sources.compound.sourceFileNo !== '5838'
    || sources.compound.sourceUrl !== COMPOUND_SOURCE_URL
    || sources.compound.zipSha256 !== COMPOUND_ZIP_SHA256
    || sources.compound.csvEntrySha256 !== COMPOUND_CSV_SHA256
    || sources.compound.evidenceArtifactPath
      !== 'data/evidence/kosis-2015-compound-surnames.json'
    || sources.compound.evidenceArtifactSha256 !== COMPOUND_EVIDENCE_SHA256) {
    failAsset();
  }

  if (!Array.isArray(rawAuthority.singleCharacterSurnames)
    || rawAuthority.singleCharacterSurnames.length !== 181) {
    failAsset();
  }
  const singles = new Map<string, SingleSurnameAuthority>();
  let singleRowCount = 0;
  for (const raw of rawAuthority.singleCharacterSurnames as RawSingleSurname[]) {
    if (typeof raw.hangul !== 'string' || !HANGUL_SYLLABLE.test(raw.hangul)
      || !Array.isArray(raw.hanja) || raw.hanja.length === 0) {
      failAsset();
    }
    const registeredHanja = raw.hanja.map((value) => {
      if (typeof value !== 'string' || !HAN_CHARACTER.test(value)) failAsset();
      return value;
    });
    if (new Set(registeredHanja).size !== registeredHanja.length || singles.has(raw.hangul)) {
      failAsset();
    }
    singleRowCount += registeredHanja.length;
    singles.set(raw.hangul, Object.freeze({
      kind: 'single',
      hangul: raw.hangul,
      registeredHanja: Object.freeze([...registeredHanja]),
    }));
  }
  if (singleRowCount !== 314) failAsset();

  if (!Array.isArray(rawAuthority.compoundSurnames)
    || rawAuthority.compoundSurnames.length !== 6) {
    failAsset();
  }
  const compounds = new Map<string, CompoundSurnameAuthority>();
  const compoundIds = new Set<string>();
  const compoundHanja = new Set<string>();
  for (const raw of rawAuthority.compoundSurnames as RawCompoundSurname[]) {
    const hangul = splitExactPair(raw.hangul, HANGUL_SYLLABLE);
    const hanja = splitExactPair(raw.hanja, HAN_CHARACTER);
    if (typeof raw.id !== 'string' || raw.id.length === 0 || !hangul || !hanja
      || !Number.isSafeInteger(raw.population) || Number(raw.population) <= 0
      || compoundIds.has(raw.id) || compounds.has(hangul.join(''))
      || compoundHanja.has(hanja.join(''))) {
      failAsset();
    }
    compoundIds.add(raw.id);
    compoundHanja.add(hanja.join(''));
    compounds.set(hangul.join(''), Object.freeze({
      kind: 'compound',
      id: raw.id,
      hangul: Object.freeze([...hangul]) as readonly [string, string],
      hanja: Object.freeze([...hanja]) as readonly [string, string],
      population: Number(raw.population),
    }));
  }
  return { singles, compounds };
}

const AUTHORITY = compileAuthority();

export function verifySurnameAuthority(
  surname: readonly NameCharInput[],
): SurnameAuthorityResult {
  if (surname.length === 1) {
    const input = surname[0];
    const authority = AUTHORITY.singles.get(input?.hangul);
    const suppliedHanja = explicitHanja(input);
    if (!authority
      || (suppliedHanja !== null && !authority.registeredHanja.includes(suppliedHanja))) {
      return { ok: false, reason: 'unverified_single_surname' };
    }
    return { ok: true, authority };
  }

  if (surname.length === 2) {
    const hangul = surname.map((input) => input?.hangul).join('');
    const authority = AUTHORITY.compounds.get(hangul);
    const suppliedHanja = surname.map(explicitHanja);
    const explicitCount = suppliedHanja.filter((value) => value !== null).length;
    if (explicitCount === 1) {
      return { ok: false, reason: 'partial_compound_surname_hanja' };
    }
    if (!authority
      || (explicitCount === 2 && suppliedHanja.join('') !== authority.hanja.join(''))) {
      return { ok: false, reason: 'unverified_compound_surname' };
    }
    return { ok: true, authority };
  }

  return { ok: false, reason: 'unverified_single_surname' };
}

export function surnameAuthorityCounts(): {
  readonly singleRows: number;
  readonly singleReadings: number;
  readonly compoundRows: number;
} {
  return {
    singleRows: [...AUTHORITY.singles.values()]
      .reduce((total, entry) => total + entry.registeredHanja.length, 0),
    singleReadings: AUTHORITY.singles.size,
    compoundRows: AUTHORITY.compounds.size,
  };
}
