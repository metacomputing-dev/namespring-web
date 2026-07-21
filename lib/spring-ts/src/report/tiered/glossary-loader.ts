/**
 * glossary-loader.ts -- Load tiered-matrix glossary entries
 *
 * The legacy full-matrix path can read every JSON bundle under
 * `data/narrative/_glossary/*.json`. ReportDeliveryV1 instead derives tag IDs
 * from its exact article shards and loads only the glossary bundles that own
 * those tags.
 *
 * Browser bundles use lazy `import.meta.glob` loaders. A compact, reviewed
 * tag-to-bundle index lets the runtime select a bundle without parsing all
 * glossary JSON first. Tests keep the index synchronized with the source
 * files and article tags.
 */

import type { GlossaryEntry, TagCategory, TagId } from '../types.js';
import { snapshotJsonValue } from './immutable-json-snapshot.js';

/** Whitespace-only cleanup. Glossary prose is authored and reviewed at the
 * source; there is deliberately no rewrite pipeline here (WYSIWYG). */
function cleanGlossaryText(value: string): string {
  return value.replace(/[ \t]+/g, ' ').trim();
}

type JsonModuleLoader = () => Promise<unknown>;

const browserGlossaryLoaders = (() => {
  try {
    return import.meta.glob('../../../data/narrative/_glossary/*.json') as Record<string, JsonModuleLoader>;
  } catch {
    return {} as Record<string, JsonModuleLoader>;
  }
})();

interface RawGlossarySourceTier {
  readonly tier: string;
  readonly sourceType: string;
  readonly sourceUrl: string | null;
  readonly accessedAt: string;
  readonly quoteShort: string | null;
  readonly humanInterpretation: string;
  readonly copyrightNote: string;
  readonly authorityTruthEligible: false;
}

interface RawGlossaryEntry {
  readonly schemaVersion: 'spring-ts.glossary-entry.v1';
  readonly id: TagId;
  readonly label: string;
  readonly hashLabel: string;
  readonly category: TagCategory;
  readonly brief: string;
  readonly detailed: string;
  readonly related: readonly TagId[];
  readonly aiGenerated: true;
  readonly sourceTier: RawGlossarySourceTier;
}

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isNodeRuntime(): boolean {
  return !isBrowserRuntime() && typeof process !== 'undefined' && Boolean(process.versions?.node);
}

const nodeBuiltins = isNodeRuntime()
  ? await (async () => {
    const [fsModule, pathModule, urlModule] = await Promise.all([
      import('node:fs'),
      import('node:path'),
      import('node:url'),
    ]);
    return {
      fs: fsModule,
      path: pathModule,
      fileURLToPath: urlModule.fileURLToPath,
    };
  })()
  : null;

let cached: Readonly<Record<TagId, GlossaryEntry>> | null = null;
let cachedPromise: Promise<Readonly<Record<TagId, GlossaryEntry>>> | null = null;

const GLOSSARY_TAG_IDS_BY_BUNDLE = Object.freeze({
  compatibility: Object.freeze([
    'yongshinFit', 'sajuCompatibility', 'ohaengBalance', 'sipsinDistribution',
    'gyeokgukFit', 'eumyangHarmony', 'stabilityIndex', 'growthPotential', 'harmonyScore',
  ]),
  element: Object.freeze([
    'wood', 'fire', 'earth', 'metal', 'water', 'moksaenghwa', 'hwasaengto',
    'tosaenggeum', 'geumsaengsu', 'susaengmok', 'mokgeukto', 'togeuksu',
    'sugeukhwa', 'hwageukgeum', 'geumgeukmok', 'eumyang', 'yang_polarity',
    'yin_polarity', 'cheongan', 'jiji',
  ]),
  gungsil: Object.freeze([
    'siGungsil', 'daewoonGungsil', 'soun', 'yunyeon', 'wolun', 'iljin', 'sijin',
  ]),
  gyeokguk: Object.freeze([
    'jeonggwangyeok', 'pyeongwangyeok', 'jeongjaegyeok', 'pyeonjaegyeok',
    'sikshingyeok', 'sanggwangyeok', 'jeongingyeok', 'pyeoningyeok',
    'jongjaegyeok', 'jonggwangyeok', 'jongsalgyeok', 'jongagyeok', 'jongingyeok',
    'jongbigyeok', 'jeonwanggyeok', 'hwagyeok', 'yangingyeok', 'geonrokgyeok',
    'wolgeobgyeok', 'gahwagyeok', 'gajongyeok', 'ilhaengdueukgyeok',
  ]),
  naeum: Object.freeze([
    'naeum', 'naeumElement', 'haejunggeum', 'nojunghwa', 'daerimmok', 'nobangto',
    'geombongeum', 'sandoohwa', 'ganhasu', 'seongduto', 'baeknapgeum',
    'yangrumok', 'cheonjungsu', 'oksangto', 'byeokryeokhwa', 'songbaekmok',
    'jangryusu', 'sajunggeum', 'sanhahwa', 'pyeongjimok', 'byeoksangto',
    'geumbakgeum', 'bokdeunghwa', 'cheonhasu', 'daeyeokto', 'chacheongeum',
    'sangjamok', 'daegyesu', 'sajungto', 'cheonsanghwa', 'seokryumok', 'daehaesu',
  ]),
  palace: Object.freeze([
    'jojangung', 'bumyong', 'baeujagung', 'jasikgung', 'myeonggung', 'hyeongjegung',
    'nobokgung', 'cheogung', 'janyeogung', 'jaebakgung', 'jilaekgung',
    'cheonigung', 'gwanrokgung', 'bokdeokgung',
  ]),
  pillar: Object.freeze([
    'yearPillar', 'monthPillar', 'dayPillar', 'hourPillar', 'gabgihab', 'eulgyeonghab',
    'byeongsinhab', 'jeongimhab', 'mugyehab', 'jaochung', 'chukmichung',
    'insinchung', 'myoyuchung', 'jinsulchung', 'sibyiunseong', 'unseong_jeol',
    'unseong_tae', 'unseong_yang', 'unseong_jang_saeng', 'unseong_mokyok',
    'unseong_gwandae', 'unseong_geonrok', 'unseong_jewang', 'unseong_soe',
    'unseong_byeong', 'unseong_sa', 'unseong_myo', 'samhab_haemyomi',
    'samhab_inohsool', 'samhab_sayuchuk', 'samhab_sinjajin', 'banghab_inmyojin',
    'banghab_saohmi', 'banghab_sinyusool', 'banghab_haejachuk', 'jamyohyeong',
    'insasinhyeong', 'yukhae', 'pa', 'wonjin',
  ]),
  shinsal: Object.freeze([
    'cheonleulgwiin', 'hwagae', 'dohwa', 'hongyeom', 'yeokma', 'mangsin',
    'gongmang', 'samhyeong', 'yangin', 'baekho', 'goegang', 'hyeongsal',
    'eumyangchachak', 'sipakdaepae', 'cheondeokgwiin', 'woldeokgwiin',
    'munchanggwiin', 'geumyeo', 'hakdang', 'cheonui', 'cheonsal', 'jisal',
    'banansal', 'jangseongsal', 'geobsal', 'wolsal', 'yeonsal', 'jaesal',
  ]),
  tenGod: Object.freeze([
    'bigyeon', 'geobjae', 'sikshin', 'sanggwan', 'pyeonjae', 'jeongjae',
    'pyeongwan', 'jeonggwan', 'pyeonin', 'jeongin', 'bigyeon_yongshin',
    'geobjae_yongshin', 'sikshin_yongshin', 'sanggwan_yongshin',
    'pyeonjae_yongshin', 'jeongjae_yongshin', 'pyeongwan_yongshin',
    'jeonggwan_yongshin', 'pyeonin_yongshin', 'jeongin_yongshin', 'bigeob',
    'siksang', 'jaeseong', 'gwanseong', 'inseong',
  ]),
  yongshin: Object.freeze([
    'yongshin', 'heeshin', 'gishin', 'gushin', 'johu', 'tonggwanYongshin',
    'byeongyakYongshin', 'buaekYongshin', 'johuYongshin', 'gyeokgukYongshin',
    'consensus_yongshin', 'anti_yongshin',
  ]),
} as const);

type GlossaryBundleId = keyof typeof GLOSSARY_TAG_IDS_BY_BUNDLE;

const GLOSSARY_BUNDLE_BY_TAG_ID = (() => {
  const out = new Map<string, GlossaryBundleId>();
  for (const [bundleId, tagIds] of Object.entries(GLOSSARY_TAG_IDS_BY_BUNDLE)) {
    for (const tagId of tagIds) {
      if (out.has(tagId)) throw new Error(`Duplicate glossary tag index entry: ${tagId}`);
      out.set(tagId, bundleId as GlossaryBundleId);
    }
  }
  return out;
})();

/** Validate one glossary file as an atomic, index-owned shard. */
export function assertGlossaryBundleForId(
  bundleId: GlossaryBundleId,
  moduleValue: unknown,
): readonly GlossaryEntry[] {
  const raw = unwrapJsonModule(moduleValue);
  if (!isPlainRecord(raw)
    || !hasExactKeys(
      raw,
      ['schemaVersion', 'category', 'entries'],
      ['_sharedSourceTier'],
    )) {
    glossaryBundleError(bundleId, 'bundle shape');
  }
  if (raw.schemaVersion !== 'spring-ts.glossary-bundle.v1') {
    glossaryBundleError(bundleId, 'schemaVersion');
  }
  if (raw.category !== bundleId) glossaryBundleError(bundleId, 'category');
  if (raw._sharedSourceTier !== undefined
    && !isGlossarySourceTier(raw._sharedSourceTier)) {
    glossaryBundleError(bundleId, '_sharedSourceTier');
  }
  const expectedIds = new Set<string>(GLOSSARY_TAG_IDS_BY_BUNDLE[bundleId]);
  if (!Array.isArray(raw.entries)
    || raw.entries.length !== expectedIds.size
    || raw.entries.length > 256) {
    glossaryBundleError(bundleId, 'entries cardinality');
  }

  const seenIds = new Set<string>();
  const entries: GlossaryEntry[] = [];
  for (const [index, value] of raw.entries.entries()) {
    if (!isPlainRecord(value)
      || !hasExactKeys(value, [
        'schemaVersion', 'id', 'label', 'hashLabel', 'category', 'brief',
        'detailed', 'related', 'aiGenerated', 'sourceTier',
      ])) {
      glossaryBundleError(bundleId, `entries[${index}] shape`);
    }
    if (value.schemaVersion !== 'spring-ts.glossary-entry.v1'
      || !isBoundedText(value.id, 128)
      || !expectedIds.has(value.id)
      || value.category !== bundleId
      || !isBoundedText(value.label, 256)
      || !isBoundedText(value.hashLabel, 256)
      || !isBoundedText(value.brief)
      || !isBoundedText(value.detailed)
      || value.aiGenerated !== true
      || !isGlossarySourceTier(value.sourceTier)
      || !Array.isArray(value.related)
      || value.related.length > 64
      || value.related.some((related) =>
        typeof related !== 'string'
        || !GLOSSARY_BUNDLE_BY_TAG_ID.has(related))) {
      glossaryBundleError(bundleId, `entries[${index}] fields`);
    }
    if (seenIds.has(value.id)) {
      glossaryBundleError(bundleId, `duplicate entry id ${value.id}`);
    }
    if (new Set(value.related).size !== value.related.length) {
      glossaryBundleError(bundleId, `entries[${index}] duplicate related id`);
    }
    seenIds.add(value.id);
    entries.push(normalizeGlossaryEntry(value as unknown as RawGlossaryEntry));
  }
  if (seenIds.size !== expectedIds.size) glossaryBundleError(bundleId, 'missing indexed entry');
  return Object.freeze(entries);
}

const glossaryBundleCache = new Map<GlossaryBundleId, Promise<readonly GlossaryEntry[]>>();

function unwrapJsonModule(moduleValue: unknown): unknown {
  if (moduleValue && typeof moduleValue === 'object' && 'default' in moduleValue) {
    return (moduleValue as { default?: unknown }).default;
  }
  return moduleValue;
}

function normalizeGlossaryEntry(entry: RawGlossaryEntry): GlossaryEntry {
  return snapshotJsonValue({
    id: entry.id,
    label: entry.label,
    hashLabel: entry.hashLabel,
    category: entry.category,
    brief: cleanGlossaryText(entry.brief ?? ''),
    detailed: cleanGlossaryText(entry.detailed ?? ''),
    related: Array.isArray(entry.related) ? entry.related : [],
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
}

function isBoundedText(value: unknown, maxLength = 8192): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && value.trim().length > 0;
}

function glossaryBundleError(bundleId: string, detail: string): never {
  throw new Error(`Invalid glossary bundle ${bundleId}: ${detail}`);
}

function isGlossarySourceTier(value: unknown): value is RawGlossarySourceTier {
  if (!isPlainRecord(value)
    || !hasExactKeys(value, [
      'tier', 'sourceType', 'sourceUrl', 'accessedAt', 'quoteShort',
      'humanInterpretation', 'copyrightNote', 'authorityTruthEligible',
    ])) return false;
  return isBoundedText(value.tier, 128)
    && isBoundedText(value.sourceType, 128)
    && (value.sourceUrl === null || isBoundedText(value.sourceUrl, 2048))
    && isBoundedText(value.accessedAt, 32)
    && (value.quoteShort === null || isBoundedText(value.quoteShort, 1024))
    && isBoundedText(value.humanInterpretation)
    && isBoundedText(value.copyrightNote)
    && value.authorityTruthEligible === false;
}

export function loadGlossary(): Readonly<Record<TagId, GlossaryEntry>> {
  if (cached) return cached;
  const out: Record<TagId, GlossaryEntry> = {};
  if (!isNodeRuntime()) {
    throw new Error('Browser glossary loading is asynchronous; use loadGlossaryAsync()');
  }
  // All fs / path resolution deferred until first call so module evaluation
  // does not touch externalized node builtins on a browser bundle.
  if (!nodeBuiltins) {
    throw new Error('Glossary Node builtins unavailable');
  }
  const here = nodeBuiltins.path.dirname(nodeBuiltins.fileURLToPath(import.meta.url));
  const glossaryDir = nodeBuiltins.path.resolve(here, '../../../data/narrative/_glossary');
  if (!nodeBuiltins.fs.existsSync(glossaryDir)) {
    throw new Error('Glossary directory unavailable');
  }
  const bundleIds = Object.keys(GLOSSARY_TAG_IDS_BY_BUNDLE).sort() as GlossaryBundleId[];
  for (const bundleId of bundleIds) {
    const full = nodeBuiltins.path.join(glossaryDir, `${bundleId}.json`);
    let bundle: unknown;
    try {
      bundle = JSON.parse(nodeBuiltins.fs.readFileSync(full, 'utf-8')) as unknown;
    } catch (error) {
      throw new Error(`Glossary bundle unavailable: ${bundleId}`, { cause: error });
    }
    for (const entry of assertGlossaryBundleForId(bundleId, bundle)) {
      if (Object.hasOwn(out, entry.id)) {
        throw new Error(`Duplicate glossary entry across bundles: ${entry.id}`);
      }
      out[entry.id] = entry;
    }
  }
  cached = Object.freeze(out);
  return cached;
}

function browserGlossaryLoaderByBundle(): ReadonlyMap<GlossaryBundleId, JsonModuleLoader> {
  const out = new Map<GlossaryBundleId, JsonModuleLoader>();
  for (const [rawPath, loader] of Object.entries(browserGlossaryLoaders)) {
    const normalized = rawPath.replaceAll('\\', '/');
    const marker = '/data/narrative/_glossary/';
    const markerIndex = normalized.lastIndexOf(marker);
    if (markerIndex < 0 || !normalized.endsWith('.json')) continue;
    const bundleId = normalized.slice(markerIndex + marker.length, -'.json'.length) as GlossaryBundleId;
    if (bundleId in GLOSSARY_TAG_IDS_BY_BUNDLE) out.set(bundleId, loader);
  }
  return out;
}

const BROWSER_GLOSSARY_LOADER_BY_BUNDLE = browserGlossaryLoaderByBundle();

function loadGlossaryBundle(bundleId: GlossaryBundleId): Promise<readonly GlossaryEntry[]> {
  const existing = glossaryBundleCache.get(bundleId);
  if (existing) return existing;
  const promise = (async () => {
    if (isNodeRuntime()) {
      if (!nodeBuiltins) throw new Error('Glossary Node builtins unavailable');
      const here = nodeBuiltins.path.dirname(nodeBuiltins.fileURLToPath(import.meta.url));
      const glossaryDir = nodeBuiltins.path.resolve(here, '../../../data/narrative/_glossary');
      const file = nodeBuiltins.path.resolve(glossaryDir, `${bundleId}.json`);
      if (!file.startsWith(`${glossaryDir}${nodeBuiltins.path.sep}`)) {
        throw new Error(`Glossary bundle escaped its root: ${bundleId}`);
      }
      try {
        return assertGlossaryBundleForId(
          bundleId,
          JSON.parse(nodeBuiltins.fs.readFileSync(file, 'utf-8')) as unknown,
        );
      } catch (error) {
        throw new Error(`Glossary bundle unavailable: ${bundleId}`, { cause: error });
      }
    }
    const loader = BROWSER_GLOSSARY_LOADER_BY_BUNDLE.get(bundleId);
    if (!loader) throw new Error(`Glossary bundle loader unavailable: ${bundleId}`);
    return assertGlossaryBundleForId(bundleId, await loader());
  })().catch((error: unknown) => {
    glossaryBundleCache.delete(bundleId);
    throw error;
  });
  glossaryBundleCache.set(bundleId, promise);
  return promise;
}

/** Resolve exact owning bundles for a set of article tags. Unknown IDs are
 * intentionally omitted here and fail closed later in `buildTagGlossary`. */
export function glossaryBundleIdsForTagIds(tagIds: readonly TagId[]): readonly GlossaryBundleId[] {
  const bundleIds = new Set<GlossaryBundleId>();
  for (const tagId of tagIds) {
    const bundleId = GLOSSARY_BUNDLE_BY_TAG_ID.get(tagId);
    if (bundleId) bundleIds.add(bundleId);
  }
  return Object.freeze([...bundleIds].sort());
}

async function loadGlossaryBundles(
  bundleIds: readonly GlossaryBundleId[],
  requestedTagIds?: ReadonlySet<TagId>,
): Promise<Readonly<Record<TagId, GlossaryEntry>>> {
  const bundles = await Promise.all(bundleIds.map(loadGlossaryBundle));
  const out: Record<TagId, GlossaryEntry> = {};
  for (const entries of bundles) {
    for (const entry of entries) {
      if (requestedTagIds && !requestedTagIds.has(entry.id)) continue;
      if (Object.hasOwn(out, entry.id)) {
        throw new Error(`Duplicate glossary entry across bundles: ${entry.id}`);
      }
      out[entry.id] = entry;
    }
  }
  return Object.freeze(out);
}

/** Full async glossary for the opt-in legacy matrix. */
export function loadGlossaryAsync(): Promise<Readonly<Record<TagId, GlossaryEntry>>> {
  if (cached) return Promise.resolve(cached);
  if (cachedPromise) return cachedPromise;
  if (isNodeRuntime()) {
    cachedPromise = Promise.resolve(loadGlossary());
    return cachedPromise;
  }
  const bundleIds = Object.keys(GLOSSARY_TAG_IDS_BY_BUNDLE).sort() as GlossaryBundleId[];
  cachedPromise = loadGlossaryBundles(bundleIds).then((value) => {
    cached = value;
    return value;
  }).catch((error: unknown) => {
    cachedPromise = null;
    throw error;
  });
  return cachedPromise;
}

/** Load and return only glossary entries referenced by selected article
 * shards. Underlying browser imports are limited to owning bundles. */
export function loadGlossarySelection(
  tagIds: readonly TagId[],
): Promise<Readonly<Record<TagId, GlossaryEntry>>> {
  const requested = new Set<TagId>(tagIds);
  return loadGlossaryBundles(glossaryBundleIdsForTagIds(tagIds), requested);
}

/** Test-only -- clear memo caches so a test can re-load freshly. */
export function _clearGlossaryCacheForTesting(): void {
  cached = null;
  cachedPromise = null;
  glossaryBundleCache.clear();
}
