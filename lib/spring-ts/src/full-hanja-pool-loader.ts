import type { HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import engineConfig from '../config/engine.json';
import { decomposeHangul } from './core/name-utils.js';
import {
  FULL_HANJA_GLYPHS,
  isSingleUnicodeScalar,
  matchesOfficialFullPoolHanjaReadings,
} from './full-hanja-glyph-registry.js';
import { getEnrichedStrokeCount, getUnihanMetadata } from './hanja-unihan.js';

export const FULL_HANJA_POOL_LOAD_FAILED = 'FULL_HANJA_POOL_LOAD_FAILED' as const;
export const FULL_HANJA_POOL_INTEGRITY_FAILED = 'FULL_HANJA_POOL_INTEGRITY_FAILED' as const;

const FULL_POOL_ID_BASE = 900_000;
const STROKE_MIN = engineConfig.strokeRange.min;
const STROKE_MAX = engineConfig.strokeRange.max;

interface FullPoolDataEntry {
  readonly hanja: string;
  readonly codepoint: string;
  readonly readings: readonly string[];
  readonly meaning: string | null;
  readonly radicalId: number | null;
  readonly strokeCount: number | null;
}

interface FullPoolDataDocument {
  readonly schemaVersion: '1.0.0-full';
  readonly totalCount: number;
  readonly entries: readonly FullPoolDataEntry[];
}

export class FullHanjaPoolIntegrityError extends Error {
  readonly code = FULL_HANJA_POOL_INTEGRITY_FAILED;
  readonly retryable = false;

  constructor() {
    super('The local full-pool Hanja asset failed its integrity check.');
    this.name = 'FullHanjaPoolIntegrityError';
  }
}

export class FullHanjaPoolLoadError extends Error {
  readonly code = FULL_HANJA_POOL_LOAD_FAILED;
  readonly retryable = true;

  constructor(cause: unknown) {
    super('The local full-pool Hanja asset could not be loaded.', { cause });
    this.name = 'FullHanjaPoolLoadError';
  }
}

export type FullHanjaPoolDataImporter = () => Promise<unknown>;

export interface FullHanjaPoolLoaderOptions {
  readonly importer?: FullHanjaPoolDataImporter;
  readonly expectedGlyphs?: readonly string[];
}

function failIntegrity(): never {
  throw new FullHanjaPoolIntegrityError();
}

function isSingleHangulSyllable(value: string): boolean {
  return /^[\uAC00-\uD7A3]$/.test(value);
}

function elementFromStrokeCount(strokes: number): string {
  const digit = ((strokes % 10) + 10) % 10;
  if (digit === 1 || digit === 2) return 'Wood';
  if (digit === 3 || digit === 4) return 'Fire';
  if (digit === 5 || digit === 6) return 'Earth';
  if (digit === 7 || digit === 8) return 'Metal';
  return 'Water';
}

function parseDocument(value: unknown, expectedGlyphs: readonly string[]): FullPoolDataDocument {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) failIntegrity();
  const document = value as Partial<FullPoolDataDocument>;
  if (document.schemaVersion !== '1.0.0-full'
    || document.totalCount !== expectedGlyphs.length
    || !Array.isArray(document.entries)
    || document.entries.length !== expectedGlyphs.length) {
    failIntegrity();
  }

  for (const [index, entry] of document.entries.entries()) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) failIntegrity();
    const candidate = entry as Partial<FullPoolDataEntry>;
    if (typeof candidate.hanja !== 'string'
      || candidate.hanja !== expectedGlyphs[index]
      || typeof candidate.codepoint !== 'string'
      || !/^U\+[0-9A-F]{4,6}$/.test(candidate.codepoint)
      || Number.parseInt(candidate.codepoint.slice(2), 16) !== candidate.hanja.codePointAt(0)
      || !Array.isArray(candidate.readings)
      || !matchesOfficialFullPoolHanjaReadings(candidate.hanja, candidate.readings)
      || (candidate.meaning !== null && typeof candidate.meaning !== 'string')
      || (candidate.radicalId !== null && !Number.isInteger(candidate.radicalId))
      || (candidate.strokeCount !== null && !Number.isInteger(candidate.strokeCount))) {
      failIntegrity();
    }
  }
  return document as FullPoolDataDocument;
}

function materializeEntries(document: FullPoolDataDocument): readonly HanjaEntry[] {
  const out: HanjaEntry[] = [];
  const seenPairs = new Set<string>();

  for (const item of document.entries) {
    const localStrokes = Number(item.strokeCount);
    const strokes = getEnrichedStrokeCount(item.hanja, localStrokes);
    if (!Number.isInteger(strokes) || strokes < STROKE_MIN || strokes > STROKE_MAX) continue;
    const unihan = getUnihanMetadata(item.hanja);

    for (const rawReading of item.readings) {
      const hangul = rawReading.trim();
      if (!isSingleHangulSyllable(hangul)) continue;
      const decomposed = decomposeHangul(hangul);
      if (!decomposed) continue;
      const key = `${hangul}\u0000${item.hanja}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);

      // The local full pool does not carry authoritative resource 오행.
      // Preserve the established stroke-derived fallback for scoreability.
      const element = elementFromStrokeCount(strokes);
      out.push(Object.freeze({
        id: FULL_POOL_ID_BASE + out.length,
        hangul,
        hanja: item.hanja,
        onset: decomposed.onset,
        nucleus: decomposed.nucleus,
        strokes,
        stroke_element: element,
        resource_element: element,
        meaning: item.meaning ?? '',
        radical: String(unihan?.radicalNumber ?? item.radicalId ?? ''),
        is_surname: false,
      }));
    }
  }

  return Object.freeze(out);
}

async function importFullHanjaPoolData(): Promise<unknown> {
  // Keep this path literal: Vite/esbuild must be able to isolate the full JSON
  // and its wrapper in an opt-in browser chunk.
  const module = await import('./full-hanja-pool-data.js');
  return module.fullHanjaPoolData;
}

export function createFullHanjaPoolLoader(
  options: FullHanjaPoolLoaderOptions = {},
): () => Promise<readonly HanjaEntry[]> {
  const importer = options.importer ?? importFullHanjaPoolData;
  const inputExpectedGlyphs = options.expectedGlyphs ?? FULL_HANJA_GLYPHS;
  if (!Array.isArray(inputExpectedGlyphs)
    || inputExpectedGlyphs.some((glyph) => !isSingleUnicodeScalar(glyph))
    || inputExpectedGlyphs.some((glyph, index) => index > 0
      && glyph.codePointAt(0)! <= inputExpectedGlyphs[index - 1].codePointAt(0)!)) {
    throw new TypeError('expectedGlyphs must be strictly code-point-sorted single scalars.');
  }
  const expectedGlyphs = inputExpectedGlyphs === FULL_HANJA_GLYPHS
    ? FULL_HANJA_GLYPHS
    : Object.freeze([...inputExpectedGlyphs]);

  let cachedAttempt: Promise<readonly HanjaEntry[]> | null = null;
  return function load(): Promise<readonly HanjaEntry[]> {
    if (cachedAttempt) return cachedAttempt;

    const attempt = Promise.resolve()
      .then(() => importer())
      .then((value) => materializeEntries(parseDocument(value, expectedGlyphs)))
      .catch((error: unknown) => {
        if (error instanceof FullHanjaPoolIntegrityError) throw error;
        if (cachedAttempt === attempt) cachedAttempt = null;
        if (error instanceof FullHanjaPoolLoadError) throw error;
        throw new FullHanjaPoolLoadError(error);
      });
    cachedAttempt = attempt;
    return attempt;
  };
}

export const loadFullHanjaPoolEntries = createFullHanjaPoolLoader();
