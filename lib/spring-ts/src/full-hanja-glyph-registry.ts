import inmyeongyongGlyphRegistry from '../data/inmyeongyong_9389_glyphs.generated.json';

interface FullGlyphRegistryDocument {
  readonly schemaVersion: '1.0.0-glyph-registry';
  readonly sourceSchemaVersion: '1.0.0-full';
  readonly sourceDocumentSha256: string;
  readonly glyphsSha256: string;
  readonly count: number;
  readonly glyphs: string;
  readonly readingPairCount: number;
  readonly readingsSha256: string;
  readonly readingCountsSha256: string;
  readonly readingCountsEncoding: 'uint8-base64';
  readonly readingCountsBase64: string;
  readonly readings: string;
}

export const EXPECTED_FULL_HANJA_GLYPH_COUNT = 9_495;
export const EXPECTED_FULL_HANJA_READING_PAIR_COUNT = 10_381;

export function isSingleUnicodeScalar(value: unknown): value is string {
  if (typeof value !== 'string' || Array.from(value).length !== 1) return false;
  const codePoint = value.codePointAt(0);
  return codePoint !== undefined && (codePoint < 0xD800 || codePoint > 0xDFFF);
}

function parseFullGlyphRegistry(value: unknown): {
  readonly glyphs: readonly string[];
  readonly readingOffsets: Uint16Array;
  readonly readings: string;
} {
  const registry = value as Partial<FullGlyphRegistryDocument> | null;
  if (registry?.schemaVersion !== '1.0.0-glyph-registry'
    || registry.sourceSchemaVersion !== '1.0.0-full'
    || !/^[0-9a-f]{64}$/.test(registry.sourceDocumentSha256 ?? '')
    || !/^[0-9a-f]{64}$/.test(registry.glyphsSha256 ?? '')
    || registry.count !== EXPECTED_FULL_HANJA_GLYPH_COUNT
    || typeof registry.glyphs !== 'string'
    || registry.readingPairCount !== EXPECTED_FULL_HANJA_READING_PAIR_COUNT
    || !/^[0-9a-f]{64}$/.test(registry.readingsSha256 ?? '')
    || !/^[0-9a-f]{64}$/.test(registry.readingCountsSha256 ?? '')
    || registry.readingCountsEncoding !== 'uint8-base64'
    || typeof registry.readingCountsBase64 !== 'string'
    || typeof registry.readings !== 'string') {
    throw new Error('Local full-pool Hanja glyph registry failed its integrity check.');
  }

  // String iteration is intentionally code-point aware. split('') would split
  // supplementary court-mirror and PUA glyphs into UTF-16 surrogate halves.
  const glyphs = Array.from(registry.glyphs);
  if (glyphs.length !== EXPECTED_FULL_HANJA_GLYPH_COUNT
    || glyphs.some((glyph) => !isSingleUnicodeScalar(glyph))
    || glyphs.some((glyph, index) => index > 0
      && glyph.codePointAt(0)! <= glyphs[index - 1].codePointAt(0)!)) {
    throw new Error('Local full-pool Hanja glyph registry failed its integrity check.');
  }

  const readingCounts = decodeBase64(registry.readingCountsBase64);
  if (readingCounts.length !== EXPECTED_FULL_HANJA_GLYPH_COUNT) {
    throw new Error('Local full-pool Hanja reading registry failed its integrity check.');
  }
  const readingOffsets = new Uint16Array(EXPECTED_FULL_HANJA_GLYPH_COUNT + 1);
  for (let index = 0; index < readingCounts.length; index += 1) {
    if (readingCounts[index] > 4) {
      throw new Error('Local full-pool Hanja reading registry failed its integrity check.');
    }
    readingOffsets[index + 1] = readingOffsets[index] + readingCounts[index];
  }
  if (readingOffsets[0] !== 0
    || readingOffsets.at(-1) !== EXPECTED_FULL_HANJA_READING_PAIR_COUNT
    || registry.readings.length !== EXPECTED_FULL_HANJA_READING_PAIR_COUNT
    || !/^[\uAC00-\uD7A3]*$/.test(registry.readings)) {
    throw new Error('Local full-pool Hanja reading registry failed its integrity check.');
  }
  return Object.freeze({
    glyphs: Object.freeze(glyphs),
    readingOffsets,
    readings: registry.readings,
  });
}

function decodeBase64(value: string): Uint8Array {
  if (value.length === 0 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error('Local full-pool Hanja reading registry failed its integrity check.');
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((value.length / 4) * 3 - padding);
  let outputIndex = 0;
  for (let index = 0; index < value.length; index += 4) {
    const a = alphabet.indexOf(value[index]);
    const b = alphabet.indexOf(value[index + 1]);
    const c = value[index + 2] === '=' ? 0 : alphabet.indexOf(value[index + 2]);
    const d = value[index + 3] === '=' ? 0 : alphabet.indexOf(value[index + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) {
      throw new Error('Local full-pool Hanja reading registry failed its integrity check.');
    }
    const packed = (a << 18) | (b << 12) | (c << 6) | d;
    if (outputIndex < bytes.length) bytes[outputIndex++] = packed >> 16;
    if (outputIndex < bytes.length) bytes[outputIndex++] = (packed >> 8) & 0xFF;
    if (outputIndex < bytes.length) bytes[outputIndex++] = packed & 0xFF;
  }
  return bytes;
}

function findFullHanjaGlyphIndex(glyph: string): number {
  if (!isSingleUnicodeScalar(glyph)) return -1;
  const target = glyph.codePointAt(0)!;
  let low = 0;
  let high = FULL_HANJA_GLYPH_REGISTRY.glyphs.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const current = FULL_HANJA_GLYPH_REGISTRY.glyphs[middle].codePointAt(0)!;
    if (current === target) return middle;
    if (current < target) low = middle + 1;
    else high = middle - 1;
  }
  return -1;
}

const FULL_HANJA_GLYPH_REGISTRY = parseFullGlyphRegistry(inmyeongyongGlyphRegistry);
export const FULL_HANJA_GLYPHS = FULL_HANJA_GLYPH_REGISTRY.glyphs;

export function isLocalFullPoolHanjaGlyph(glyph: string): boolean {
  return findFullHanjaGlyphIndex(glyph) >= 0;
}

/** True only when the official court lookup returns this exact glyph-reading pair. */
export function isOfficialFullPoolHanjaReading(glyph: string, hangul: string): boolean {
  if (!/^[\uAC00-\uD7A3]$/.test(hangul)) return false;
  const glyphIndex = findFullHanjaGlyphIndex(glyph);
  if (glyphIndex < 0) return false;
  const start = FULL_HANJA_GLYPH_REGISTRY.readingOffsets[glyphIndex];
  const end = FULL_HANJA_GLYPH_REGISTRY.readingOffsets[glyphIndex + 1];
  for (let index = start; index < end; index += 1) {
    if (FULL_HANJA_GLYPH_REGISTRY.readings[index] === hangul) return true;
  }
  return false;
}

/** True only when the supplied readings are the complete official set.
 *
 * The official lookup currently exposes at most four readings per glyph, so
 * this avoids per-entry Set/array allocation while keeping lazy-load
 * validation bounded and order-independent. */
export function matchesOfficialFullPoolHanjaReadings(
  glyph: string,
  readings: readonly unknown[],
): boolean {
  if (!Array.isArray(readings)) return false;
  const glyphIndex = findFullHanjaGlyphIndex(glyph);
  if (glyphIndex < 0) return false;
  const start = FULL_HANJA_GLYPH_REGISTRY.readingOffsets[glyphIndex];
  const end = FULL_HANJA_GLYPH_REGISTRY.readingOffsets[glyphIndex + 1];
  if (readings.length !== end - start) return false;
  for (let index = 0; index < readings.length; index += 1) {
    const reading = readings[index];
    if (typeof reading !== 'string'
      || !/^[\uAC00-\uD7A3]$/.test(reading)
      || readings.indexOf(reading) !== index) {
      return false;
    }
  }
  for (let index = start; index < end; index += 1) {
    if (!readings.includes(FULL_HANJA_GLYPH_REGISTRY.readings[index])) return false;
  }
  return true;
}

/** True when the official lookup publishes at least one designated reading. */
export function hasOfficialFullPoolHanjaReadings(glyph: string): boolean {
  const glyphIndex = findFullHanjaGlyphIndex(glyph);
  return glyphIndex >= 0
    && FULL_HANJA_GLYPH_REGISTRY.readingOffsets[glyphIndex + 1]
      > FULL_HANJA_GLYPH_REGISTRY.readingOffsets[glyphIndex];
}
