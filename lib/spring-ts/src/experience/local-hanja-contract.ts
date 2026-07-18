import type { HanjaEntry } from '../../../seed-ts/src/database/hanja-repository.js';
import { HANJA_DATABASE_ASSET } from '../../../seed-ts/src/database/database-asset-registry.js';
import {
  EXPECTED_FULL_HANJA_GLYPH_COUNT,
  EXPECTED_FULL_HANJA_READING_PAIR_COUNT,
} from '../full-hanja-glyph-registry.js';
import { getLegalAnnotation } from '../hanja-annotations.js';
import {
  LOCAL_HANJA_LOOKUP_SCHEMA_V1,
  MAX_LOCAL_HANJA_PAGE_SIZE_V1,
  type LocalHanjaLookupItemV1,
  type LocalHanjaLookupRequestV1,
  type LocalHanjaLookupV1,
} from './local-menu-types.js';
import {
  assertLocalDataObject,
  failLocalMenu,
  isBoundedCanonicalText,
  isOneHangul,
  isOneUnicodeScalar,
} from './local-menu-primitives.js';

const MAX_HANJA_TEXT_LENGTH = 256;
const HANJA_ELEMENTS = new Set(['Wood', 'Fire', 'Earth', 'Metal', 'Water']);

function assertHanjaItem(
  value: unknown,
  reading: string,
  role: LocalHanjaLookupRequestV1['role'],
): asserts value is LocalHanjaLookupItemV1 {
  assertLocalDataObject(value, [
    'hangul', 'hanja', 'meaning', 'strokes', 'strokeElement', 'resourceElement',
    'radical', 'isSurname', 'legal',
  ], 'CONTRACT_INVALID');
  if (value.hangul !== reading
    || !isOneUnicodeScalar(value.hanja)
    || !isBoundedCanonicalText(value.meaning, MAX_HANJA_TEXT_LENGTH)
    || !Number.isSafeInteger(value.strokes)
    || (value.strokes as number) < 1
    || !HANJA_ELEMENTS.has(String(value.strokeElement))
    || !HANJA_ELEMENTS.has(String(value.resourceElement))
    || typeof value.radical !== 'string'
    || value.radical.length > MAX_HANJA_TEXT_LENGTH
    || value.radical !== value.radical.trim()
    || value.radical !== value.radical.normalize('NFC')
    || typeof value.isSurname !== 'boolean'
    || (role === 'surname' && value.isSurname !== true)) {
    failLocalMenu('CONTRACT_INVALID');
  }
  assertLocalDataObject(value.legal, ['status', 'exactGlyphReadingPair'], 'CONTRACT_INVALID');
  if (value.legal.status !== 'registrable' || value.legal.exactGlyphReadingPair !== true) {
    failLocalMenu('CONTRACT_INVALID');
  }
  const legal = getLegalAnnotation({
    hangul: value.hangul,
    hanja: value.hanja,
  } as HanjaEntry);
  if (legal.legalRegistrable !== true || legal.legalStatus !== 'allowed') {
    failLocalMenu('CONTRACT_INVALID');
  }
}

function compareHanjaItems(left: LocalHanjaLookupItemV1, right: LocalHanjaLookupItemV1): number {
  return left.strokes - right.strokes
    || left.hanja.codePointAt(0)! - right.hanja.codePointAt(0)!;
}

export function assertLocalHanjaLookupV1(
  value: unknown,
): asserts value is LocalHanjaLookupV1 {
  assertLocalDataObject(value, [
    'schemaVersion', 'computation', 'request', 'ordering', 'pagination', 'provenance', 'items',
  ]);
  if (value.schemaVersion !== LOCAL_HANJA_LOOKUP_SCHEMA_V1
    || value.computation !== 'local_only') {
    failLocalMenu('CONTRACT_INVALID');
  }
  assertLocalDataObject(value.request, ['reading', 'role'], 'CONTRACT_INVALID');
  if (!isOneHangul(value.request.reading)
    || (value.request.role !== 'surname' && value.request.role !== 'given_name')) {
    failLocalMenu('CONTRACT_INVALID');
  }
  assertLocalDataObject(value.ordering, [
    'policy', 'authority', 'clientInstruction',
  ], 'CONTRACT_INVALID');
  if (value.ordering.policy !== 'strokes_codepoint_id.v1'
    || value.ordering.authority !== 'spring-ts'
    || value.ordering.clientInstruction !== 'preserve_order') {
    failLocalMenu('CONTRACT_INVALID');
  }
  assertLocalDataObject(value.pagination, [
    'offset', 'requestedLimit', 'returnedCount', 'totalAvailable', 'hasMore',
  ], 'CONTRACT_INVALID');
  if (!Number.isSafeInteger(value.pagination.offset)
    || (value.pagination.offset as number) < 0
    || !Number.isSafeInteger(value.pagination.requestedLimit)
    || (value.pagination.requestedLimit as number) < 1
    || (value.pagination.requestedLimit as number) > MAX_LOCAL_HANJA_PAGE_SIZE_V1
    || !Number.isSafeInteger(value.pagination.returnedCount)
    || !Number.isSafeInteger(value.pagination.totalAvailable)
    || (value.pagination.totalAvailable as number) < 0
    || typeof value.pagination.hasMore !== 'boolean'
    || !Array.isArray(value.items)
    || value.pagination.returnedCount !== value.items.length
    || value.items.length > (value.pagination.requestedLimit as number)
    || (value.pagination.offset as number) + value.items.length
      > (value.pagination.totalAvailable as number)
    || value.pagination.hasMore
      !== ((value.pagination.offset as number) + value.items.length
        < (value.pagination.totalAvailable as number))) {
    failLocalMenu('CONTRACT_INVALID');
  }
  assertLocalDataObject(value.provenance, [
    'metadataSource', 'databaseSha256', 'schemaContractSha256', 'legalAuthority',
    'legalValidation', 'expectedLegalGlyphCount', 'expectedLegalReadingPairCount',
    'remoteLookup',
  ], 'CONTRACT_INVALID');
  if (value.provenance.metadataSource !== 'seed-ts.HanjaRepository'
    || value.provenance.databaseSha256 !== HANJA_DATABASE_ASSET.sha256
    || value.provenance.schemaContractSha256 !== HANJA_DATABASE_ASSET.schemaContractSha256
    || value.provenance.legalAuthority !== 'pinned_korean_court_lookup_snapshot'
    || value.provenance.legalValidation !== 'exact_glyph_reading_pair'
    || value.provenance.expectedLegalGlyphCount !== EXPECTED_FULL_HANJA_GLYPH_COUNT
    || value.provenance.expectedLegalReadingPairCount !== EXPECTED_FULL_HANJA_READING_PAIR_COUNT
    || value.provenance.remoteLookup !== 'forbidden') {
    failLocalMenu('CONTRACT_INVALID');
  }
  const seen = new Set<string>();
  for (let index = 0; index < value.items.length; index += 1) {
    const item = value.items[index];
    assertHanjaItem(item, value.request.reading, value.request.role);
    if (seen.has(item.hanja)) failLocalMenu('CONTRACT_INVALID');
    seen.add(item.hanja);
    if (index > 0 && compareHanjaItems(value.items[index - 1], item) >= 0) {
      failLocalMenu('CONTRACT_INVALID');
    }
  }
}
