import vocabularyData from '../data/classical-vocabulary/classical-myeongri-vocabulary.json';

export const CLASSICAL_VOCABULARY_SCHEMA_VERSION = 'spring-ts.classical-myeongri-vocabulary.v1';

export type ClassicalVocabularyCategory =
  | 'tenGod'
  | 'gyeokguk'
  | 'relation'
  | 'yongshinMethod'
  | 'diseaseRemedy'
  | 'compoundIdiom';

export type ClassicalVocabularyStatus = 'direct' | 'compound' | 'displayOnly' | 'gap';

export interface ClassicalVocabularyMapsTo {
  readonly surface: string;
  readonly fieldPath: string;
  readonly code: string | null;
  readonly group: string | null;
  readonly axis: string | null;
}

export interface ClassicalVocabularySourceRef {
  readonly sourceId: string;
  readonly locator: string;
  readonly quoteShort: string | null;
  readonly interpretation: string;
}

export interface ClassicalVocabularyEntry {
  readonly termId: string;
  readonly term: string;
  readonly hanja: string | null;
  readonly category: ClassicalVocabularyCategory;
  readonly aliases: readonly string[];
  readonly displayGlossKo: string;
  readonly mapsTo: ClassicalVocabularyMapsTo;
  readonly relatedCodes: readonly string[];
  readonly status: ClassicalVocabularyStatus;
  readonly sourceRefs: readonly ClassicalVocabularySourceRef[];
}

export interface ClassicalVocabularyDictionary {
  readonly schemaVersion: typeof CLASSICAL_VOCABULARY_SCHEMA_VERSION;
  readonly accessedAt: string;
  readonly sourceRegistry: string;
  readonly sourceTier: {
    readonly tier: string;
    readonly sourceType: string;
    readonly sourceUrl: string | null;
    readonly accessedAt: string;
    readonly quoteShort: string | null;
    readonly humanInterpretation: string;
    readonly copyrightNote: string;
    readonly authorityTruthEligible: boolean;
  };
  readonly usagePolicy: {
    readonly noBulkCopy: boolean;
    readonly maxQuoteChars: number;
    readonly dictionaryKind: string;
    readonly requiresCodeSurface: boolean;
    readonly allowed: readonly string[];
    readonly prohibited: readonly string[];
  };
  readonly lookupPolicy: {
    readonly canonicalAnchor: string;
    readonly mappingOnly: boolean;
    readonly requiresCodeSurface: boolean;
    readonly useForAuthorityTruth: boolean;
  };
  readonly categories: readonly ClassicalVocabularyCategory[];
  readonly entries: readonly ClassicalVocabularyEntry[];
}

export interface ClassicalVocabularyLookupResult {
  readonly query: string;
  readonly entry: ClassicalVocabularyEntry | null;
}

const dictionary = vocabularyData as ClassicalVocabularyDictionary;

function normalizeLookupKey(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildLookupIndex(entries: readonly ClassicalVocabularyEntry[]): ReadonlyMap<string, ClassicalVocabularyEntry> {
  const index = new Map<string, ClassicalVocabularyEntry>();

  for (const entry of entries) {
    const keys = [entry.termId, entry.term, entry.hanja, ...entry.aliases].filter((key): key is string =>
      typeof key === 'string' && key.trim().length > 0);

    for (const key of keys) {
      const normalized = normalizeLookupKey(key);
      if (!index.has(normalized)) {
        index.set(normalized, entry);
      }
    }
  }

  return index;
}

const lookupIndex = buildLookupIndex(dictionary.entries);

export function getClassicalVocabularyDictionary(): ClassicalVocabularyDictionary {
  return dictionary;
}

export function listClassicalVocabularyEntries(
  category?: ClassicalVocabularyCategory,
): readonly ClassicalVocabularyEntry[] {
  if (!category) return dictionary.entries;
  return dictionary.entries.filter((entry) => entry.category === category);
}

export function lookupClassicalVocabularyTerm(term: string): ClassicalVocabularyEntry | null {
  const normalized = normalizeLookupKey(term);
  if (!normalized) return null;
  return lookupIndex.get(normalized) ?? null;
}

export function lookupClassicalVocabularyTerms(
  terms: readonly string[],
): readonly ClassicalVocabularyLookupResult[] {
  return terms.map((query) => ({
    query,
    entry: lookupClassicalVocabularyTerm(query),
  }));
}

export function listClassicalVocabularyEntriesByCode(code: string): readonly ClassicalVocabularyEntry[] {
  const normalized = normalizeLookupKey(code);
  if (!normalized) return [];

  return dictionary.entries.filter((entry) => {
    const directCode = entry.mapsTo.code ? normalizeLookupKey(entry.mapsTo.code) : null;
    if (directCode === normalized) return true;
    return entry.relatedCodes.some((relatedCode) => normalizeLookupKey(relatedCode) === normalized);
  });
}
