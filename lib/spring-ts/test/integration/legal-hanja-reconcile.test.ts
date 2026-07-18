/**
 * Verifies that legal-Hanja claims are bound to the official court lookup,
 * including exact raw glyphs and designated Hangul readings.
 *
 * Run: npm run test:legal-hanja
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getLegalAnnotation,
  normalizeToOrthodoxHanja,
} from '../../src/hanja-annotations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean, evidence?: string): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

function readJson<T = any>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(SPRING_TS_ROOT, relativePath), 'utf8')) as T;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function entry(hangul: string, hanja: string): any {
  return {
    id: 0,
    hangul,
    hanja,
    onset: '',
    nucleus: '',
    strokes: 1,
    stroke_element: 'Wood',
    resource_element: 'Wood',
    meaning: '',
    radical: '',
    is_surname: false,
  };
}

console.log('Official legal-Hanja reconciliation\n');

const full = readJson('data/inmyeongyong_9389_full.json');
const aliases = readJson('data/byeolpyo2_variants.json');
const sources = readJson('data/sources/legal-hanja.sources.json');
const reconciliation = readJson('data/legal-hanja-reconciliation.json');
const receipt = readJson('data/official-hanja-lookup-authority.generated.json');
const unihanMetadata = readJson('data/unihan-hanja-metadata.json');

const fullEntries: Array<{
  hanja: string;
  codepoint: string;
  readings: string[];
  meaning: string | null;
  radicalId: number | null;
  strokeCount: number | null;
}> = full.entries;
const canonicalEntries = [...fullEntries]
  .sort((left, right) => left.hanja.codePointAt(0)! - right.hanja.codePointAt(0)!)
  .map((item) => [item.hanja, [...item.readings].sort(compareCodeUnits)] as const);
const glyphs = canonicalEntries.map(([glyph]) => glyph).join('');
const pairPayload = JSON.stringify(canonicalEntries);
const pairCount = canonicalEntries.reduce((sum, [, readings]) => sum + readings.length, 0);
const fullSet = new Set(fullEntries.map((item) => item.hanja));

check('local snapshot contains 9,495 unique official lookup glyph representations',
  fullEntries.length === 9495 && fullSet.size === 9495);
check('local snapshot contains 10,381 non-empty designated-reading pairs',
  pairCount === 10381,
  `pairs=${pairCount}`);
check('glyph digest matches the official lookup receipt',
  sha256(glyphs) === receipt.lookupSnapshot.glyphsSha256
    && receipt.lookupSnapshot.glyphsSha256 === reconciliation.officialLookupSnapshot.glyphsSha256);
check('glyph-reading digest matches the official lookup receipt',
  sha256(pairPayload) === receipt.lookupSnapshot.glyphReadingPairsSha256
    && receipt.lookupSnapshot.glyphReadingPairsSha256
      === reconciliation.officialLookupSnapshot.glyphReadingPairsSha256);
check('official lookup receipt records zero local differences',
  receipt.lookupSnapshot.localMirrorGlyphDifferenceCount === 0
    && receipt.lookupSnapshot.localMirrorGlyphReadingPairDifferenceCount === 0
    && reconciliation.reconciliation.localGlyphDifferenceCount === 0
    && reconciliation.reconciliation.localPairDifferenceCount === 0);
check('9,389 announcement and 9,495 lookup representations remain separate counting layers',
  receipt.announcedCharacterCount === 9389
    && receipt.lookupGlyphRepresentationCount === 9495
    && receipt.lookupRepresentationDelta === 106);

let codepointMismatch = 0;
let noReading = 0;
let noMeaning = 0;
let noRadical = 0;
for (const item of fullEntries) {
  const expected = `U+${item.hanja.codePointAt(0)!.toString(16).toUpperCase().padStart(5, '0')}`;
  if (item.codepoint !== expected) codepointMismatch += 1;
  if (item.readings.length === 0) noReading += 1;
  if (item.meaning == null || item.meaning === '') noMeaning += 1;
  if (item.radicalId == null) noRadical += 1;
}
check('codepoint metadata round-trips to each raw glyph', codepointMismatch === 0);
check('field statistics remain reproducible',
  noReading === full.fieldStats.noReading
    && noMeaning === full.fieldStats.noMeaning
    && noRadical === full.fieldStats.noRadical);
check('the one glyph without a designated reading remains fail-closed',
  noReading === 1
    && fullEntries.find((item) => item.hanja === '𥡴')?.readings.length === 0
    && getLegalAnnotation(entry('계', '𥡴'), { pool: 'inmyeongyong_full' }).legalStatus === 'notAllowed');

const aliasMap: Record<string, string> = aliases.variantToOrthodox;
const aliasRows = Object.entries(aliasMap);
const bothIn = aliasRows.filter(([input, target]) => fullSet.has(input) && fullSet.has(target));
const selfMappings = aliasRows.filter(([input, target]) => input === target);
const aliasOnlyOutside = aliasRows.filter(([input, target]) => !fullSet.has(input) && fullSet.has(target));
check('legacy input aliases are explicitly non-authoritative',
  aliases.authorityTruthEligible === false
    && reconciliation.inputAliasPolicy.authorityTruthEligible === false);
check('input-alias partition is reproducible',
  aliasRows.length === 112
    && bothIn.length === 80
    && selfMappings.length === 1
    && aliasOnlyOutside.length === 32,
  JSON.stringify({ total: aliasRows.length, bothIn: bothIn.length, self: selfMappings.length, aliasOnlyOutside: aliasOnlyOutside.length }));
check('search alias normalization remains available',
  normalizeToOrthodoxHanja('挿') === '插'
    && normalizeToOrthodoxHanja('国') === '國');

const defaultOfficial = getLegalAnnotation(entry('최', '崔'));
check('curated candidate breadth does not weaken official legal authority',
  defaultOfficial.legalRegistrable === true && defaultOfficial.legalStatus === 'allowed');
const seedAllowed = getLegalAnnotation(entry('가', '佳'));
check('curated seed requires the exact official reading',
  seedAllowed.legalRegistrable === true
    && seedAllowed.legalStatus === 'allowed'
    && getLegalAnnotation(entry('나', '佳')).legalStatus === 'notAllowed');
check('curated mode rejects an off-list input alias just like full mode',
  getLegalAnnotation(entry('삽', '挿')).legalStatus === 'notAllowed');

for (const legalCase of [
  ['국', '国'],
  ['국', '國'],
  ['삽', '插'],
  ['삽', '揷'],
  ['앵', '櫻'],
] as const) {
  const annotation = getLegalAnnotation(entry(...legalCase), { pool: 'inmyeongyong_full' });
  check(`official raw pair ${legalCase.join('/')} is allowed`,
    annotation.legalRegistrable === true
      && annotation.legalStatus === 'allowed'
      && annotation.isVariantOf === undefined);
}

for (const illegalCase of [
  ['삽', '挿'],
  ['앵', '桜'],
  ['삽', '國'],
] as const) {
  const annotation = getLegalAnnotation(entry(...illegalCase), { pool: 'inmyeongyong_full' });
  check(`non-authority raw pair ${illegalCase.join('/')} is rejected`,
    annotation.legalRegistrable === false
      && annotation.legalStatus === 'notAllowed'
      && annotation.isVariantOf === undefined);
}
check('input aliases never synthesize variantAllowed',
  aliasRows.every(([input]) => getLegalAnnotation(
    entry(fullEntries.find((item) => item.hanja === input)?.readings[0] ?? '가', input),
    { pool: 'inmyeongyong_full' },
  ).legalStatus !== 'variantAllowed'));

const sourceRecords = [sources.sourceTier, ...sources.sources.map((source: any) => source.sourceTier)];
check('source registry includes the authority-eligible official lookup',
  sources.sources.some((source: any) => source.id === 'efamily_official_hanja_lookup_2026_07_18'
    && source.sourceTier?.tier === 'T5_OFFICIAL'
    && source.sourceTier?.authorityTruthEligible === true));
check('third-party mirror remains non-authoritative on its own',
  sourceRecords.some((source: any) => source?.tier === 'T2_REFERENCE_IMPLEMENTATION'
    && source.authorityTruthEligible === false));
check('Unihan enrichment coverage remains stable',
  reconciliation.unihanEnrichment.entriesWithUnihanMetadata === unihanMetadata.entries.length
    && reconciliation.unihanEnrichment.localRowsWithoutUnihan
      === fullEntries.length - unihanMetadata.entries.length);

console.log(`\nLegal Hanja reconciliation: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
