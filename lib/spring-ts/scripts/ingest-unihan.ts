/**
 * scripts/ingest-unihan.ts
 *
 * Parses Unicode Unihan text files and emits a compact metadata overlay for
 * the local full Korean legal-Hanja mirror.
 *
 * Usage:
 *   npx tsx scripts/ingest-unihan.ts
 *   UNIHAN_DIR=<path-to-unzipped-Unihan> npx tsx scripts/ingest-unihan.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fullHanjaData from '../data/inmyeongyong_9389_full.json';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const DEFAULT_UNIHAN_DIR = path.resolve(
  SPRING_TS_ROOT,
  '../../../spring-master/sources/unihan-17.0.0/unzipped',
);
const UNIHAN_DIR = process.env.UNIHAN_DIR
  ? path.resolve(process.env.UNIHAN_DIR)
  : DEFAULT_UNIHAN_DIR;
const OUT_PATH = path.resolve(SPRING_TS_ROOT, 'data/unihan-hanja-metadata.json');

const TARGET_PROPERTIES = new Set([
  'kRSUnicode',
  'kTotalStrokes',
  'kSemanticVariant',
  'kSimplifiedVariant',
  'kSpecializedSemanticVariant',
  'kTraditionalVariant',
  'kZVariant',
  'kCompatibilityVariant',
]);

const RADICAL_ELEMENT_HINTS: Record<number, 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water'> = {
  32: 'Earth', // 土
  75: 'Wood',  // 木
  85: 'Water', // 水
  86: 'Fire',  // 火
  167: 'Metal', // 金
};

interface FullHanjaEntry {
  readonly hanja: string;
  readonly codepoint: string;
  readonly readings: readonly string[];
  readonly meaning: string | null;
  readonly radicalId: number | null;
  readonly strokeCount: number | null;
}

interface FullHanjaData {
  readonly entries: readonly FullHanjaEntry[];
  readonly totalCount: number;
}

interface UnihanRecord {
  readonly codepoint: string;
  readonly properties: Map<string, string>;
}

function normalizeCodepoint(value: string): string {
  const hex = value.replace(/^U\+/u, '');
  const parsed = Number.parseInt(hex, 16);
  if (!Number.isFinite(parsed)) return value;
  return `U+${parsed.toString(16).toUpperCase()}`;
}

function codepointFromHanja(hanja: string): string {
  const cp = Array.from(hanja)[0]?.codePointAt(0);
  return typeof cp === 'number' ? `U+${cp.toString(16).toUpperCase()}` : '';
}

function parseFirstRsUnicode(value: string | undefined): {
  readonly rawValues: string[];
  readonly radicalNumber: number | null;
  readonly residualStrokes: number | null;
} {
  const rawValues = String(value ?? '')
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  const first = rawValues[0] ?? '';
  const match = first.match(/^(\d{1,3})(['"]?)\.(-?\d+)$/u);
  if (!match) return { rawValues, radicalNumber: null, residualStrokes: null };
  return {
    rawValues,
    radicalNumber: Number(match[1]),
    residualStrokes: Number(match[3]),
  };
}

function parseFirstInteger(value: string | undefined): number | null {
  const first = String(value ?? '').trim().split(/\s+/u)[0];
  if (!/^\d+$/u.test(first)) return null;
  return Number(first);
}

function parseVariantCodepoints(value: string | undefined): string[] {
  return String(value ?? '')
    .trim()
    .split(/\s+/u)
    .map((item) => item.split('<')[0])
    .filter((item) => /^U\+[0-9A-Fa-f]+$/u.test(item))
    .map(normalizeCodepoint);
}

function compactVariants(variants: Record<string, string[]>): Record<string, string[]> | undefined {
  const nonEmpty = Object.fromEntries(
    Object.entries(variants).filter(([, items]) => items.length > 0),
  );
  return Object.keys(nonEmpty).length > 0 ? nonEmpty : undefined;
}

function readUnihanRecords(unihanDir: string): Map<string, UnihanRecord> {
  if (!fs.existsSync(unihanDir)) {
    throw new Error(`Unihan directory not found: ${unihanDir}`);
  }

  const records = new Map<string, UnihanRecord>();
  const files = fs.readdirSync(unihanDir)
    .filter((name) => /^Unihan_.*\.txt$/u.test(name))
    .sort();

  for (const file of files) {
    const text = fs.readFileSync(path.join(unihanDir, file), 'utf-8');
    for (const line of text.split(/\r?\n/u)) {
      if (!line || line.startsWith('#')) continue;
      const [rawCodepoint, property, value] = line.split('\t');
      if (!TARGET_PROPERTIES.has(property)) continue;
      const codepoint = normalizeCodepoint(rawCodepoint);
      const existing = records.get(codepoint) ?? {
        codepoint,
        properties: new Map<string, string>(),
      };
      existing.properties.set(property, value);
      records.set(codepoint, existing);
    }
  }

  return records;
}

const unihanRecords = readUnihanRecords(UNIHAN_DIR);
const localEntries = (fullHanjaData as FullHanjaData).entries;
const outputEntries = [];

let localRowsWithoutUnihan = 0;
let localZeroStrokeCount = 0;
let zeroStrokeResolvedByUnihan = 0;
let localMissingRadical = 0;
let radicalResolvedByUnihan = 0;
let radicalHintCount = 0;
let totalStrokeCount = 0;
let variantLinkCount = 0;

for (const entry of localEntries) {
  const codepoint = normalizeCodepoint(entry.codepoint || codepointFromHanja(entry.hanja));
  const record = unihanRecords.get(codepoint);
  const localStrokeCount = Number(entry.strokeCount);
  const localRadicalId = Number(entry.radicalId);
  if (!Number.isFinite(localStrokeCount) || localStrokeCount <= 0) localZeroStrokeCount += 1;
  if (!Number.isFinite(localRadicalId) || localRadicalId <= 0) localMissingRadical += 1;
  if (!record) {
    localRowsWithoutUnihan += 1;
    continue;
  }

  const rs = parseFirstRsUnicode(record.properties.get('kRSUnicode'));
  const totalStrokes = parseFirstInteger(record.properties.get('kTotalStrokes'));
  if (totalStrokes !== null) {
    totalStrokeCount += 1;
    if ((!Number.isFinite(localStrokeCount) || localStrokeCount <= 0) && totalStrokes > 0) {
      zeroStrokeResolvedByUnihan += 1;
    }
  }
  if (
    (!Number.isFinite(localRadicalId) || localRadicalId <= 0)
    && rs.radicalNumber !== null
  ) {
    radicalResolvedByUnihan += 1;
  }

  const variants = {
    semantic: parseVariantCodepoints(record.properties.get('kSemanticVariant')),
    simplified: parseVariantCodepoints(record.properties.get('kSimplifiedVariant')),
    specializedSemantic: parseVariantCodepoints(record.properties.get('kSpecializedSemanticVariant')),
    traditional: parseVariantCodepoints(record.properties.get('kTraditionalVariant')),
    zVariant: parseVariantCodepoints(record.properties.get('kZVariant')),
    compatibility: parseVariantCodepoints(record.properties.get('kCompatibilityVariant')),
  };
  const variantCount = Object.values(variants).reduce((sum, items) => sum + items.length, 0);
  if (variantCount > 0) variantLinkCount += variantCount;
  const variantPayload = compactVariants(variants);

  const radicalNumber = rs.radicalNumber ?? (Number.isFinite(localRadicalId) && localRadicalId > 0 ? localRadicalId : null);
  const hintedElement = radicalNumber ? RADICAL_ELEMENT_HINTS[radicalNumber] : undefined;
  if (hintedElement) radicalHintCount += 1;

  outputEntries.push({
    hanja: entry.hanja,
    codepoint,
    kRSUnicode: rs.rawValues,
    radicalNumber,
    residualStrokes: rs.residualStrokes,
    totalStrokes,
    ...(variantPayload ? { variants: variantPayload } : {}),
    ...(hintedElement
      ? {
          radicalElementHint: {
            element: hintedElement,
            radicalNumber,
            confidence: 'hint',
            sourceTier: 'T3_AUTHORED_INTERPRETATION',
            sourceRegistryId: 'radical_element_hint_policy',
            authorityTruthEligible: false,
          },
        }
      : {}),
  });
}

const output = {
  schemaVersion: 'spring-ts.unihan-hanja-metadata.v1',
  unicodeVersion: '17.0.0',
  generatedAt: new Date().toISOString(),
  sourceUrl: 'https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip',
  sourceTier: {
    tier: 'T5_OFFICIAL',
    sourceType: 'unicode_ucd',
    sourceUrl: 'https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip',
    accessedAt: '2026-05-01',
    quoteShort: null,
    humanInterpretation: 'Unicode Unihan 17.0.0 supplies kRSUnicode, kTotalStrokes, and variant properties used as a metadata overlay for local Hanja rows.',
    copyrightNote: 'Unicode data is referenced by URL and reduced to factual metadata fields needed by this engine; see https://www.unicode.org/license.txt.',
    authorityTruthEligible: true,
  },
  sourceTierScope: {
    appliesToFields: [
      'entries[].kRSUnicode',
      'entries[].radicalNumber',
      'entries[].residualStrokes',
      'entries[].totalStrokes',
      'entries[].variants',
    ],
    excludesFields: ['entries[].radicalElementHint'],
    derivedFieldRegistry: {
      'entries[].radicalElementHint': 'radical_element_hint_policy',
    },
  },
  derivedFieldSourceTiers: {
    'entries[].radicalElementHint': {
      tier: 'T3_AUTHORED_INTERPRETATION',
      sourceType: 'internal_rule_policy',
      sourceRegistryId: 'radical_element_hint_policy',
      authorityTruthEligible: false,
      humanInterpretation: 'Radical-to-Five-Element mapping is an internal hint policy layered over official Unihan radical numbers, not Unicode authority truth.',
    },
  },
  input: {
    unihanDir: UNIHAN_DIR,
    parsedProperties: Array.from(TARGET_PROPERTIES).sort(),
  },
  coverage: {
    localLegalPoolRows: localEntries.length,
    entriesWithUnihanMetadata: outputEntries.length,
    localRowsWithoutUnihan,
    localZeroStrokeCount,
    zeroStrokeResolvedByUnihan,
    localMissingRadical,
    radicalResolvedByUnihan,
    totalStrokeCount,
    radicalHintCount,
    variantLinkCount,
  },
  entries: outputEntries,
};

fs.writeFileSync(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${OUT_PATH}`);
console.log(JSON.stringify(output.coverage, null, 2));
