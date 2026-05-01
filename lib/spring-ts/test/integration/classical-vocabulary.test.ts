/**
 * test/integration/classical-vocabulary.test.ts
 *
 * Verifies Phase 7.2 classical vocabulary dictionary shape and lookup behavior.
 *
 * Run: npm run test:classical-vocabulary
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getClassicalVocabularyDictionary,
  listClassicalVocabularyEntries,
  listClassicalVocabularyEntriesByCode,
  lookupClassicalVocabularyTerm,
} from '../../src/classical-vocabulary.js';

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

function normalizeLookupKey(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function collectRiskyFieldPaths(value: unknown, currentPath = '$'): string[] {
  const riskyFields = new Set(['rawtext', 'ocrtext', 'sourcetext', 'chaptertext', 'fulltext', 'translation']);
  const paths: string[] = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      paths.push(...collectRiskyFieldPaths(item, `${currentPath}[${index}]`));
    });
    return paths;
  }

  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const nextPath = `${currentPath}.${key}`;
      if (riskyFields.has(key.toLowerCase())) {
        paths.push(nextPath);
      }
      paths.push(...collectRiskyFieldPaths(item, nextPath));
    }
  }

  return paths;
}

function collectQuoteShorts(value: unknown, currentPath = '$'): { path: string; value: string | null }[] {
  const quotes: { path: string; value: string | null }[] = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      quotes.push(...collectQuoteShorts(item, `${currentPath}[${index}]`));
    });
    return quotes;
  }

  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const nextPath = `${currentPath}.${key}`;
      if (key === 'quoteShort') {
        quotes.push({ path: nextPath, value: item as string | null });
      }
      quotes.push(...collectQuoteShorts(item, nextPath));
    }
  }

  return quotes;
}

console.log('Phase 7.2 classical vocabulary\n');

const dictionary = getClassicalVocabularyDictionary();
const dictionaryRaw = readJson('data/classical-vocabulary/classical-myeongri-vocabulary.json');
const schema = readJson('test/baseline/schema/classicalVocabulary.schema.json');
const sourceRegistry = readJson('data/sources/classical-myeongri.sources.json');
const registeredSourceIds = new Set((sourceRegistry.sources ?? []).map((source: any) => source.id));
const entries = dictionary.entries;
const categories = new Set(entries.map((entry) => entry.category));
const termIds = entries.map((entry) => entry.termId);
const uniqueTermIds = new Set(termIds);
const quoteShorts = collectQuoteShorts(dictionaryRaw);

const lookupKeys = new Map<string, string>();
const duplicateLookupKeys: string[] = [];
for (const entry of entries) {
  for (const key of [entry.termId, entry.term, entry.hanja, ...entry.aliases]) {
    if (typeof key !== 'string' || !key.trim()) continue;
    const normalized = normalizeLookupKey(key);
    const existing = lookupKeys.get(normalized);
    if (existing && existing !== entry.termId) {
      duplicateLookupKeys.push(`${normalized}:${existing}->${entry.termId}`);
    } else {
      lookupKeys.set(normalized, entry.termId);
    }
  }
}

check('schema file describes the vocabulary version',
  schema.properties?.schemaVersion?.const === 'spring-ts.classical-myeongri-vocabulary.v1');
check('dictionary uses expected schemaVersion',
  dictionary.schemaVersion === 'spring-ts.classical-myeongri-vocabulary.v1');
check('dictionary references Phase 7.1 source registry',
  dictionary.sourceRegistry === 'data/sources/classical-myeongri.sources.json');
check('dictionary is authored interpretation, not authority truth',
  dictionary.sourceTier?.tier === 'T3_AUTHORED_INTERPRETATION' &&
    dictionary.sourceTier?.sourceType === 'classical_vocabulary_dictionary' &&
    dictionary.sourceTier?.authorityTruthEligible === false);
check('usage policy is mapping-only and forbids bulk copied text',
  dictionary.usagePolicy?.noBulkCopy === true &&
    dictionary.usagePolicy?.dictionaryKind === 'term_to_feature_mapping' &&
    dictionary.usagePolicy?.requiresCodeSurface === true &&
    dictionary.usagePolicy?.prohibited?.includes('bulk OCR text') &&
    dictionary.usagePolicy?.prohibited?.includes('chapter copy'));
check('lookup policy cannot be used as authority truth',
  dictionary.lookupPolicy?.mappingOnly === true &&
    dictionary.lookupPolicy?.requiresCodeSurface === true &&
    dictionary.lookupPolicy?.useForAuthorityTruth === false);
check('term IDs are stable and unique',
  uniqueTermIds.size === termIds.length &&
    termIds.every((termId) => /^[a-z0-9_]+$/.test(termId)),
  `entries=${entries.length}, unique=${uniqueTermIds.size}`);
check('lookup keys do not collide across entries',
  duplicateLookupKeys.length === 0,
  duplicateLookupKeys.slice(0, 3).join(','));
check('dictionary covers required categories',
  ['tenGod', 'gyeokguk', 'relation', 'yongshinMethod', 'diseaseRemedy', 'compoundIdiom']
    .every((category) => categories.has(category as any)),
  `categories=${Array.from(categories).sort().join(',')}`);
check('dictionary includes all ten-god mappings',
  listClassicalVocabularyEntries('tenGod').length === 10);
check('dictionary includes normal and special frame mappings',
  listClassicalVocabularyEntries('gyeokguk').length >= 18);
check('dictionary includes combine/clash relation mappings',
  listClassicalVocabularyEntries('relation').length >= 10);
check('dictionary includes useful-god and disease-medicine vocabulary',
  listClassicalVocabularyEntries('yongshinMethod').length >= 8 &&
    listClassicalVocabularyEntries('diseaseRemedy').length >= 4);
check('every entry maps to an internal code surface',
  entries.every((entry) =>
    typeof entry.mapsTo?.surface === 'string' &&
      entry.mapsTo.surface.length > 0 &&
      typeof entry.mapsTo?.fieldPath === 'string' &&
      entry.mapsTo.fieldPath.length > 0 &&
      typeof entry.mapsTo?.axis === 'string' &&
      entry.mapsTo.axis.length > 0));
check('direct entries have concrete code anchors',
  entries.every((entry) => entry.status !== 'direct' || typeof entry.mapsTo.code === 'string'));
check('compound entries keep constituent code anchors',
  entries
    .filter((entry) => entry.status === 'compound')
    .every((entry) => entry.mapsTo.code === null && entry.relatedCodes.length >= 2));
check('all sourceRefs point at registered source IDs',
  entries.every((entry) =>
    entry.sourceRefs.length > 0 &&
      entry.sourceRefs.every((ref) => registeredSourceIds.has(ref.sourceId))),
  `registered=${Array.from(registeredSourceIds).sort().join(',')}`);
check('all quoteShort fields are null or within policy',
  quoteShorts.every((quote) => quote.value === null || Array.from(quote.value).length <= 80),
  `quotes=${quoteShorts.length}`);
check('dictionary stores no risky copied-text fields',
  collectRiskyFieldPaths(dictionaryRaw).length === 0);

const lookupCases = [
  { term: '正官', category: 'tenGod', code: 'JEONG_GWAN', status: 'direct' },
  { term: '七殺', category: 'tenGod', code: 'PYEON_GWAN', status: 'direct' },
  { term: '정관격', category: 'gyeokguk', code: 'JEONG_GWAN', status: 'direct' },
  { term: '化氣', category: 'gyeokguk', code: 'HUA_QI', status: 'direct' },
  { term: '天干合', category: 'relation', code: 'HAP', status: 'direct' },
  { term: '合化', category: 'relation', code: 'HAPWHA_YONGSHIN', status: 'direct' },
  { term: '通關', category: 'yongshinMethod', code: 'TONGGUAN', status: 'direct' },
  { term: '用神', category: 'yongshinMethod', code: 'YONGSHIN', status: 'direct' },
  { term: '病藥', category: 'yongshinMethod', code: 'BYEONGYAK', status: 'direct' },
  { term: '傷官見官', category: 'compoundIdiom', code: null, status: 'compound' },
] as const;

for (const expected of lookupCases) {
  const entry = lookupClassicalVocabularyTerm(expected.term);
  check(`lookup ${expected.term} maps to ${expected.category}`,
    entry?.category === expected.category &&
      entry?.mapsTo.code === expected.code &&
      entry?.status === expected.status,
    entry ? `${entry.termId}:${entry.mapsTo.code}` : 'missing');
}

check('lookup is whitespace and case tolerant',
  lookupClassicalVocabularyTerm('  QISHA  ')?.termId === 'ten_god_pyeon_gwan');
check('blank lookup returns null',
  lookupClassicalVocabularyTerm('   ') === null);
check('code lookup returns mapped and related entries',
  listClassicalVocabularyEntriesByCode('JEONG_GWAN').some((entry) => entry.termId === 'ten_god_jeong_gwan') &&
    listClassicalVocabularyEntriesByCode('JEONG_GWAN').some((entry) => entry.termId === 'gyeokguk_jeong_gwan'));

console.log(`\nClassical vocabulary: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
