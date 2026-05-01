/**
 * test/integration/legal-hanja-reconcile.test.ts
 *
 * Verifies Phase 2 PR-2.1 legal-Hanja reconciliation metadata and status
 * buckets without initializing SpringEngine.
 *
 * Run: npm run test:legal-hanja
 */
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

function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

function readJson<T = any>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(SPRING_TS_ROOT, relativePath), 'utf-8')) as T;
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

console.log('Phase 2 legal-Hanja reconciliation\n');

const full = readJson('data/inmyeongyong_9389_full.json');
const variants = readJson('data/byeolpyo2_variants.json');
const sources = readJson('data/sources/legal-hanja.sources.json');
const reconciliation = readJson('data/legal-hanja-reconciliation.json');
const unihanMetadata = readJson('data/unihan-hanja-metadata.json');

const fullEntries: Array<{ hanja: string; codepoint: string; readings: string[]; meaning: string | null; radicalId: number | null; strokeCount: number | null }> = full.entries;
const fullSet = new Set(fullEntries.map((e) => e.hanja));
const variantToOrthodox: Record<string, string> = variants.variantToOrthodox;
const unihanEntries: any[] = unihanMetadata.entries ?? [];
const unihanByHanja = new Map(unihanEntries.map((item: any) => [item.hanja, item]));

check('full data count matches metadata',
  fullEntries.length === full.totalCount && full.totalCount === 9495,
  `entries=${fullEntries.length}, total=${full.totalCount}`);
check('official count remains visible',
  full.officialCount === 9389 && reconciliation.officialBasis.announcedAllowedCount === 9389);
check('mirror delta remains explicit',
  full.totalCount - full.officialCount === 106 &&
    reconciliation.candidateMirror.unresolvedDeltaCount === 106);
check('full data has unique Hanja entries',
  fullSet.size === fullEntries.length,
  `unique=${fullSet.size}`);

let codepointMismatch = 0;
let noReading = 0;
let noMeaning = 0;
let noRadical = 0;
for (const item of fullEntries) {
  const expected = `U+${item.hanja.codePointAt(0)!.toString(16).toUpperCase().padStart(5, '0')}`;
  if (item.codepoint !== expected) codepointMismatch += 1;
  if (!Array.isArray(item.readings) || item.readings.length === 0) noReading += 1;
  if (item.meaning == null || item.meaning === '') noMeaning += 1;
  if (item.radicalId == null) noRadical += 1;
}
check('codepoint metadata round-trips to Hanja',
  codepointMismatch === 0,
  `mismatch=${codepointMismatch}`);
check('fieldStats match recomputed counts',
  noReading === full.fieldStats.noReading &&
    noMeaning === full.fieldStats.noMeaning &&
    noRadical === full.fieldStats.noRadical,
  `noReading=${noReading}, noMeaning=${noMeaning}, noRadical=${noRadical}`);

const variantAllowedInPool = fullEntries.filter((item) => {
  const orthodox = variantToOrthodox[item.hanja];
  return typeof orthodox === 'string' && orthodox !== item.hanja && fullSet.has(orthodox);
}).length;
check('variantAllowed candidate count is reproducible',
  variantAllowedInPool === reconciliation.variantPolicy.candidateEntriesRecognizedAsVariantAllowed,
  `variantAllowed=${variantAllowedInPool}`);
check('candidate mirror status counts cover every local entry',
  Object.values(reconciliation.candidateMirrorStatusCounts)
    .reduce((sum: number, count: any) => sum + Number(count), 0) === fullEntries.length);
check('official reconciliation status counts cover the mirror denominator',
  Object.values(reconciliation.officialReconciliationStatusCounts)
    .reduce((sum: number, count: any) => sum + Number(count), 0) === fullEntries.length);
const unihanVariantLinkCount = unihanEntries
  .reduce((sum, item) => sum + Object.values(item.variants ?? {})
    .reduce((innerSum: number, links: any) => innerSum + (Array.isArray(links) ? links.length : 0), 0), 0);
const unihanRadicalHintCount = unihanEntries
  .filter((item) => item.radicalElementHint?.sourceTier === 'T3_AUTHORED_INTERPRETATION').length;
const zeroStrokeResolvedByUnihan = fullEntries
  .filter((item) => {
    const localStroke = Number(item.strokeCount);
    const unihanTotal = Number(unihanByHanja.get(item.hanja)?.totalStrokes);
    return (!Number.isFinite(localStroke) || localStroke <= 0) && Number.isInteger(unihanTotal) && unihanTotal > 0;
  }).length;
check('Unihan enrichment coverage is reproducible',
  reconciliation.unihanEnrichment?.entriesWithUnihanMetadata === unihanEntries.length &&
    reconciliation.unihanEnrichment?.localRowsWithoutUnihan === fullEntries.length - unihanEntries.length &&
    reconciliation.unihanEnrichment?.zeroStrokeResolvedByUnihan === zeroStrokeResolvedByUnihan &&
    reconciliation.unihanEnrichment?.radicalHintCount === unihanRadicalHintCount &&
    reconciliation.unihanEnrichment?.variantLinkCount === unihanVariantLinkCount,
  JSON.stringify({
    entriesWithUnihanMetadata: unihanEntries.length,
    localRowsWithoutUnihan: fullEntries.length - unihanEntries.length,
    zeroStrokeResolvedByUnihan,
    radicalHintCount: unihanRadicalHintCount,
    variantLinkCount: unihanVariantLinkCount,
  }));

const sourceRecords = [sources.sourceTier, ...sources.sources.map((s: any) => s.sourceTier)];
check('legal source registry includes T5 official source records',
  sourceRecords.filter((s: any) => s?.tier === 'T5_OFFICIAL' && s.authorityTruthEligible === true).length >= 3);
check('third-party mirror is not authority truth',
  sourceRecords.some((s: any) => s?.tier === 'T2_REFERENCE_IMPLEMENTATION' && s.authorityTruthEligible === false));

check('normalizeToOrthodoxHanja: 国 -> 國',
  normalizeToOrthodoxHanja('国') === '國');

const defaultUnknown = getLegalAnnotation(entry('최', '崔'));
check('curated default keeps non-seed Hanja unknown',
  defaultUnknown.legalRegistrable === undefined && defaultUnknown.legalStatus === 'unknown');

const seedAllowed = getLegalAnnotation(entry('가', '佳'));
check('curated seed Hanja is allowed',
  seedAllowed.legalRegistrable === true && seedAllowed.legalStatus === 'allowed');

const fullAllowed = getLegalAnnotation(entry('최', '崔'), { pool: 'inmyeongyong_full' });
check('full pool recognizes orthodox legal Hanja',
  fullAllowed.legalRegistrable === true && fullAllowed.legalStatus === 'allowed');

const fullVariant = getLegalAnnotation(entry('국', '国'), { pool: 'inmyeongyong_full' });
check('full pool recognizes legal variants',
  fullVariant.legalRegistrable === true &&
    fullVariant.legalStatus === 'variantAllowed' &&
    fullVariant.isVariantOf === '國');

const fullRejected = getLegalAnnotation(entry('답', '龘'), { pool: 'inmyeongyong_full' });
check('full pool marks non-list Hanja notAllowed',
  fullRejected.legalRegistrable === false && fullRejected.legalStatus === 'notAllowed');

const hangulOnly = getLegalAnnotation(entry('수', ''));
check('blank Hanja is hangulOnly',
  hangulOnly.legalRegistrable === undefined && hangulOnly.legalStatus === 'hangulOnly');

console.log(`\nLegal Hanja reconciliation: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
