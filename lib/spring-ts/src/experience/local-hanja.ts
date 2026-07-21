import {
  HanjaRepository,
  type HanjaEntry,
} from '../../../seed-ts/src/database/hanja-repository.js';
import { HANJA_DATABASE_ASSET } from '../../../seed-ts/src/database/database-asset-registry.js';
import {
  EXPECTED_FULL_HANJA_GLYPH_COUNT,
  EXPECTED_FULL_HANJA_READING_PAIR_COUNT,
} from '../full-hanja-glyph-registry.js';
import { getLegalAnnotation } from '../hanja-annotations.js';
import {
  LOCAL_HANJA_LOOKUP_REQUEST_SCHEMA_V1,
  LOCAL_HANJA_LOOKUP_SCHEMA_V1,
  MAX_LOCAL_HANJA_PAGE_SIZE_V1,
  LocalMenuContractErrorV1,
  type LocalHanjaLookupItemV1,
  type LocalHanjaLookupRequestV1,
  type LocalHanjaLookupV1,
} from './local-menu-types.js';
import { assertLocalHanjaLookupV1 } from './local-hanja-contract.js';
import {
  assertLocalDataObject,
  failLocalMenu,
  freezeLocalOwned,
  isBoundedCanonicalText,
  isOneHangul,
  isOneUnicodeScalar,
} from './local-menu-primitives.js';

const MAX_HANJA_SOURCE_ROWS = 2_048;
const MAX_HANJA_TEXT_LENGTH = 256;
const HANJA_ELEMENTS = new Set(['Wood', 'Fire', 'Earth', 'Metal', 'Water']);

function validateHanjaRequest(value: unknown): {
  readonly reading: string;
  readonly role: LocalHanjaLookupRequestV1['role'];
  readonly offset: number;
  readonly limit: number;
} {
  assertLocalDataObject(value, ['schemaVersion', 'reading', 'role', 'offset', 'limit'], 'INVALID_HANJA_REQUEST');
  const offset = value.offset ?? 0;
  const limit = value.limit ?? 30;
  if (value.schemaVersion !== LOCAL_HANJA_LOOKUP_REQUEST_SCHEMA_V1
    || !isOneHangul(value.reading)
    || (value.role !== 'surname' && value.role !== 'given_name')
    || !Number.isSafeInteger(offset)
    || (offset as number) < 0
    || !Number.isSafeInteger(limit)
    || (limit as number) < 1
    || (limit as number) > MAX_LOCAL_HANJA_PAGE_SIZE_V1) {
    failLocalMenu('INVALID_HANJA_REQUEST');
  }
  return {
    reading: value.reading,
    role: value.role,
    offset: offset as number,
    limit: limit as number,
  };
}

function validateHanjaEntry(
  raw: unknown,
  reading: string,
  role: LocalHanjaLookupRequestV1['role'],
): HanjaEntry {
  try {
    assertLocalDataObject(raw, [
      'id', 'hangul', 'hanja', 'onset', 'nucleus', 'strokes', 'stroke_element',
      'resource_element', 'meaning', 'radical', 'is_surname',
    ], 'HANJA_SOURCE_ROW_INVALID');
  } catch (error) {
    if (error instanceof LocalMenuContractErrorV1 && error.reason === 'UNKNOWN_FIELD') {
      failLocalMenu('HANJA_SOURCE_ROW_INVALID');
    }
    throw error;
  }
  if (!Number.isSafeInteger(raw.id)
    || (raw.id as number) < 1
    || raw.hangul !== reading
    || !isOneHangul(raw.hangul)
    || !isOneUnicodeScalar(raw.hanja)
    || !isBoundedCanonicalText(raw.onset, 8)
    || !isBoundedCanonicalText(raw.nucleus, 8)
    || !Number.isSafeInteger(raw.strokes)
    || (raw.strokes as number) < 1
    || !HANJA_ELEMENTS.has(String(raw.stroke_element))
    || !HANJA_ELEMENTS.has(String(raw.resource_element))
    || !isBoundedCanonicalText(raw.meaning, MAX_HANJA_TEXT_LENGTH)
    || typeof raw.radical !== 'string'
    || raw.radical.length > MAX_HANJA_TEXT_LENGTH
    || raw.radical !== raw.radical.trim()
    || raw.radical !== raw.radical.normalize('NFC')
    || typeof raw.is_surname !== 'boolean'
    || (role === 'surname' && raw.is_surname !== true)) {
    failLocalMenu('HANJA_SOURCE_ROW_INVALID');
  }
  const entry = raw as unknown as HanjaEntry;
  const legal = getLegalAnnotation(entry);
  if (legal.legalRegistrable !== true || legal.legalStatus !== 'allowed') {
    failLocalMenu('HANJA_LEGAL_AUTHORITY_MISMATCH');
  }
  return entry;
}

function compareHanjaEntries(left: HanjaEntry, right: HanjaEntry): number {
  return left.strokes - right.strokes
    || left.hanja.codePointAt(0)! - right.hanja.codePointAt(0)!
    || left.id - right.id;
}

function toHanjaItem(entry: HanjaEntry): LocalHanjaLookupItemV1 {
  return {
    hangul: entry.hangul,
    hanja: entry.hanja,
    meaning: entry.meaning,
    strokes: entry.strokes,
    strokeElement: entry.stroke_element,
    resourceElement: entry.resource_element,
    radical: entry.radical,
    isSurname: entry.is_surname,
    legal: { status: 'registrable', exactGlyphReadingPair: true },
  };
}

export async function buildLocalHanjaLookupV1(
  repository: HanjaRepository,
  request: LocalHanjaLookupRequestV1,
): Promise<LocalHanjaLookupV1> {
  const validated = validateHanjaRequest(request);
  if (!(repository instanceof HanjaRepository)) failLocalMenu('HANJA_REPOSITORY_REQUIRED');
  let rawRows: unknown;
  try {
    rawRows = validated.role === 'surname'
      ? await repository.findSurnamesByHangul(validated.reading)
      : await repository.findByHangul(validated.reading);
  } catch (cause) {
    throw new LocalMenuContractErrorV1('HANJA_REPOSITORY_UNAVAILABLE', { cause });
  }
  if (!Array.isArray(rawRows)) failLocalMenu('HANJA_SOURCE_ROW_INVALID');
  if (rawRows.length > MAX_HANJA_SOURCE_ROWS) failLocalMenu('HANJA_SOURCE_LIMIT_EXCEEDED');
  const rows = rawRows.map((row) => validateHanjaEntry(row, validated.reading, validated.role));
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.hangul}\u0000${row.hanja}`;
    if (seen.has(key)) failLocalMenu('DUPLICATE_HANJA_ENTRY');
    seen.add(key);
  }
  rows.sort(compareHanjaEntries);
  if (validated.offset > rows.length) failLocalMenu('PAGINATION_OUT_OF_RANGE');
  const items = rows
    .slice(validated.offset, validated.offset + validated.limit)
    .map(toHanjaItem);
  const lookup: LocalHanjaLookupV1 = {
    schemaVersion: LOCAL_HANJA_LOOKUP_SCHEMA_V1,
    computation: 'local_only',
    request: { reading: validated.reading, role: validated.role },
    ordering: {
      policy: 'strokes_codepoint_id.v1',
      authority: 'spring-ts',
      clientInstruction: 'preserve_order',
    },
    pagination: {
      offset: validated.offset,
      requestedLimit: validated.limit,
      returnedCount: items.length,
      totalAvailable: rows.length,
      hasMore: validated.offset + items.length < rows.length,
    },
    provenance: {
      metadataSource: 'seed-ts.HanjaRepository',
      databaseSha256: HANJA_DATABASE_ASSET.sha256,
      schemaContractSha256: HANJA_DATABASE_ASSET.schemaContractSha256,
      legalAuthority: 'pinned_korean_court_lookup_snapshot',
      legalValidation: 'exact_glyph_reading_pair',
      expectedLegalGlyphCount: EXPECTED_FULL_HANJA_GLYPH_COUNT,
      expectedLegalReadingPairCount: EXPECTED_FULL_HANJA_READING_PAIR_COUNT,
      remoteLookup: 'forbidden',
    },
    items,
  };
  assertLocalHanjaLookupV1(lookup);
  return freezeLocalOwned(lookup);
}
