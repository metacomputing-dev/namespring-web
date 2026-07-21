/**
 * Build the development generated corpus into selection-independent local
 * assets. Unlike the legacy per-person pack, an asset URL contains only
 * category + period; age/band/strength/gyeok/name-effect/gender remain inside
 * the downloaded JSON and therefore do not enter CDN or proxy request logs.
 *
 * This tool deliberately marks every output as development mock content. A
 * later release corpus needs a separately reviewed contract/version.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const LOCAL_GENERATED_MANIFEST_SCHEMA_V2 =
  'namespring.local-generated-content-manifest.v2';
export const LOCAL_GENERATED_SHARD_SCHEMA_V2 =
  'namespring.local-generated-content-shard.v2';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCE = path.resolve(HERE, '../../data/generated');
const MAX_SOURCE_FILE_BYTES = 1024 * 1024;
const MAX_OUTPUT_SHARD_BYTES = 4 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 32 * 1024;
const CATEGORIES = new Set([
  'overall', 'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
]);
const PERIODS = new Set(['life', 'today', 'thisWeek', 'thisMonth', 'thisYear']);
const AUDIENCES = new Set([
  'adult', 'teen', 'child',
  'stage-teen', 'stage-early', 'stage-mid', 'stage-senior', 'stage-elder',
]);
const BANDS = new Set(['high', 'mid', 'low', 'any']);
const STRENGTHS = new Set(['weak', 'balanced', 'strong']);
const FAMILIES = new Set([
  'bigeop', 'gwanseong', 'inseong', 'jaeseong', 'siksang', 'special',
]);
const NAME_EFFECTS = new Set(['adverse', 'boost_mild', 'boost_strong', 'neutral']);
const GENDERS = new Set(['female', 'male', 'x']);
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function fail(message) {
  throw new TypeError(`Generated local content V2: ${message}`);
}

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(`${label} has unexpected fields`);
  }
}

function canonicalize(value, label = '$') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item, index) => canonicalize(item, `${label}[${index}]`));
  if (!isPlainRecord(value)) fail(`${label} is not JSON data`);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [
    key,
    canonicalize(value[key], `${label}.${key}`),
  ]));
}

function stableJson(value, pretty = false) {
  return `${JSON.stringify(canonicalize(value), null, pretty ? 2 : undefined)}${pretty ? '\n' : ''}`;
}

function digestBuffer(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function digestJson(value) {
  return digestBuffer(Buffer.from(stableJson(value), 'utf8'));
}

function assertTextArray(value, label, requireEntry) {
  if (!Array.isArray(value)
    || (requireEntry && value.length === 0)
    || value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
    fail(`${label} must be ${requireEntry ? 'a non-empty' : 'an'} array of text`);
  }
}

export function parseGeneratedClassIdV2(classId) {
  if (typeof classId !== 'string' || classId !== classId.normalize('NFC')) {
    fail('classId must be canonical text');
  }
  const [category, period, audience, band, strength, family, nameEffect, gender, ...extra] =
    classId.split('.');
  if (extra.length > 0
    || !CATEGORIES.has(category)
    || !PERIODS.has(period)
    || !AUDIENCES.has(audience)
    || !BANDS.has(band)
    || !STRENGTHS.has(strength)
    || !FAMILIES.has(family)
    || !NAME_EFFECTS.has(nameEffect)
    || !GENDERS.has(gender)) {
    fail(`invalid classId ${classId}`);
  }
  return { category, period, audience, band, strength, family, nameEffect, gender };
}

export function assertGeneratedSourceArticleV2(article, classId) {
  if (!isPlainRecord(article)) fail(`${classId} article must be a plain object`);
  const axes = parseGeneratedClassIdV2(classId);
  if (article.schemaVersion !== 'spring-ts.article.v1'
    || article.articleId !== classId
    || article.category !== axes.category
    || article.period !== axes.period
    || article.audience !== axes.audience
    || article.band !== axes.band
    || article.aiGenerated !== true
    || typeof article.sourceNote !== 'string'
    || article.sourceNote.trim().length === 0
    || typeof article.summary !== 'string'
    || article.summary.trim().length === 0
    || (article.hook !== undefined
      && (typeof article.hook !== 'string' || article.hook.trim().length === 0))) {
    fail(`${classId} article identity/schema mismatch`);
  }
  assertTextArray(article.body, `${classId}.body`, true);
  assertTextArray(article.expert, `${classId}.expert`, true);
  assertTextArray(article.livingTips, `${classId}.livingTips`, false);
  assertTextArray(article.cautions, `${classId}.cautions`, false);
  if (!isPlainRecord(article.caseAxes)
    || article.caseAxes.gangyak !== axes.strength
    || article.caseAxes.gyeokgukFamily !== axes.family
    || article.caseAxes.nameEffect !== axes.nameEffect
    || article.caseAxes.gender !== (axes.gender === 'x' ? null : axes.gender)) {
    fail(`${classId} caseAxes do not match its classId`);
  }
}

function pathContains(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function walkRegularFiles(root, current = root) {
  const files = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const resolved = path.join(current, entry.name);
    if (entry.isSymbolicLink()) fail('output must not contain symlinks');
    if (entry.isDirectory()) files.push(...walkRegularFiles(root, resolved));
    else if (entry.isFile()) files.push(path.relative(root, resolved).replaceAll('\\', '/'));
    else fail('output must contain only regular files and directories');
  }
  return files;
}

function assertRegularFileNoLink(file, label, maxBytes = MAX_SOURCE_FILE_BYTES) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) fail(`${label} must be a regular non-symlink file`);
  if (stat.size < 2 || stat.size > maxBytes) {
    fail(`${label} is outside its file byte budget`);
  }
}

function readJsonFile(file, label) {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    fail(`${label} is not valid JSON`);
  }
  return value;
}

function discoverExpectedCoverage(sourceDir, explicitPath) {
  const candidate = explicitPath === null
    ? path.resolve(sourceDir, '../generation/manifest/index.json')
    : path.resolve(explicitPath);
  if (!fs.existsSync(candidate)) return null;
  assertRegularFileNoLink(candidate, 'coverage manifest');
  const value = readJsonFile(candidate, 'coverage manifest');
  if (!isPlainRecord(value)
    || !Number.isSafeInteger(value.totalClasses)
    || value.totalClasses < 1
    || !isPlainRecord(value.perCategory)
    || Object.values(value.perCategory).some((count) => !Number.isSafeInteger(count) || count < 0)) {
    fail('coverage manifest has an invalid shape');
  }
  return {
    path: candidate,
    totalClasses: value.totalClasses,
    perCategory: Object.fromEntries(Object.entries(value.perCategory).sort()),
  };
}

function scanSource(sourceDir, expectedManifestPath) {
  const resolved = fs.realpathSync(path.resolve(sourceDir));
  const rootStat = fs.lstatSync(resolved);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('source must be a real directory');
  const expected = discoverExpectedCoverage(resolved, expectedManifestPath ?? null);
  const groups = new Map();
  const allArticles = new Map();
  const categoryCounts = {};

  for (const category of fs.readdirSync(resolved).sort()) {
    if (!CATEGORIES.has(category)) fail(`unexpected source category ${category}`);
    const categoryDir = path.join(resolved, category);
    const categoryStat = fs.lstatSync(categoryDir);
    if (!categoryStat.isDirectory() || categoryStat.isSymbolicLink()) {
      fail(`source category ${category} must be a real directory`);
    }
    let categoryCount = 0;
    for (const filename of fs.readdirSync(categoryDir).sort()) {
      if (!filename.endsWith('.json')) fail(`unexpected source file ${category}/${filename}`);
      const file = path.join(categoryDir, filename);
      assertRegularFileNoLink(file, `${category}/${filename}`);
      const classId = filename.slice(0, -'.json'.length);
      const axes = parseGeneratedClassIdV2(classId);
      if (axes.category !== category) fail(`${classId} is in the wrong category directory`);
      if (allArticles.has(classId)) fail(`duplicate classId ${classId}`);
      const article = readJsonFile(file, classId);
      assertGeneratedSourceArticleV2(article, classId);
      const canonicalArticle = canonicalize(article);
      allArticles.set(classId, canonicalArticle);
      const key = `${category}/${axes.period}`;
      const group = groups.get(key) ?? {
        category,
        period: axes.period,
        articles: new Map(),
      };
      group.articles.set(classId, canonicalArticle);
      groups.set(key, group);
      categoryCount += 1;
    }
    categoryCounts[category] = categoryCount;
  }
  if (allArticles.size === 0) fail('source corpus is empty');
  if (expected !== null) {
    if (allArticles.size !== expected.totalClasses
      || stableJson(categoryCounts) !== stableJson(expected.perCategory)) {
      fail('source corpus does not match the generation coverage manifest');
    }
  }
  return { sourceDir: resolved, groups, allArticles, categoryCounts, expected };
}

function corpusDigest(articles) {
  const material = [...articles.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([classId, article]) => `${classId}\u0000${digestJson(article)}\n`)
    .join('');
  return digestBuffer(Buffer.from(material, 'utf8'));
}

function writeBuildDirectory(scanned, directory) {
  fs.mkdirSync(directory, { recursive: true });
  const shards = [];
  for (const [, group] of [...scanned.groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const articles = Object.fromEntries([...group.articles.entries()]
      .sort(([left], [right]) => left.localeCompare(right)));
    const shard = {
      schemaVersion: LOCAL_GENERATED_SHARD_SCHEMA_V2,
      category: group.category,
      period: group.period,
      articleCount: group.articles.size,
      articles,
    };
    const relativePath = `${group.category}/${group.period}.json`;
    const body = Buffer.from(stableJson(shard), 'utf8');
    if (body.byteLength > MAX_OUTPUT_SHARD_BYTES) {
      fail(`${relativePath} exceeded the 4 MiB output shard budget`);
    }
    const file = path.join(directory, ...relativePath.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body, { flag: 'wx' });
    shards.push({
      category: group.category,
      period: group.period,
      path: relativePath,
      articleCount: group.articles.size,
      bytes: body.byteLength,
      digest: digestBuffer(body),
    });
  }
  const manifest = {
    schemaVersion: LOCAL_GENERATED_MANIFEST_SCHEMA_V2,
    layout: 'category_period_selection_independent',
    contentStatus: 'development_mock_replace_before_release',
    releaseAuthority: false,
    qualityGateAuthority: false,
    privacyBoundary: {
      urlAxes: ['category', 'period'],
      contentOnlyAxes: ['audience', 'band', 'strength', 'gyeokgukFamily', 'nameEffect', 'gender'],
      selectionIndependentUrl: true,
      containsUserInput: false,
      intendedRuntime: 'local_device',
      legacyPersonAxisUrlsForbidden: true,
    },
    source: {
      articleCount: scanned.allArticles.size,
      categoryCounts: scanned.categoryCounts,
      digest: corpusDigest(scanned.allArticles),
      coverageManifestChecked: scanned.expected !== null,
    },
    shards,
  };
  const manifestBody = Buffer.from(stableJson(manifest, true), 'utf8');
  if (manifestBody.byteLength > MAX_MANIFEST_BYTES) fail('manifest exceeded 32 KiB');
  fs.writeFileSync(path.join(directory, 'manifest.json'), manifestBody, { flag: 'wx' });
  return manifest;
}

function installBuildDirectory(tempDir, outDir, replace) {
  const output = path.resolve(outDir);
  if (!fs.existsSync(output)) {
    fs.renameSync(tempDir, output);
    return;
  }
  if (!replace) fail('output already exists; pass --replace for an atomic replacement');
  const backup = `${output}.backup-${process.pid}`;
  if (fs.existsSync(backup)) fail('stale output backup exists');
  fs.renameSync(output, backup);
  try {
    fs.renameSync(tempDir, output);
  } catch (error) {
    fs.renameSync(backup, output);
    throw error;
  }
  fs.rmSync(backup, { recursive: true, force: false });
}

export function buildGeneratedLocalContentV2(options) {
  if (!options || typeof options.outDir !== 'string' || options.outDir.trim().length === 0) {
    fail('outDir is required');
  }
  const sourceInput = options.sourceDir ?? DEFAULT_SOURCE;
  const source = fs.realpathSync(path.resolve(sourceInput));
  const output = path.resolve(options.outDir);
  if (pathContains(source, output) || pathContains(output, source)) {
    fail('source and output directories must not overlap');
  }
  const scanned = scanSource(source, options.expectedManifestPath);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (fs.existsSync(output)) {
    const outputStat = fs.lstatSync(output);
    if (outputStat.isSymbolicLink() || !outputStat.isDirectory()) {
      fail('existing output must be a real V2 directory');
    }
    if (options.replace !== true) {
      fail('output already exists; pass --replace for an atomic replacement');
    }
    // Never let --replace turn this build tool into a general recursive-delete
    // command. Only a complete, previously validated V2 output is replaceable.
    validateGeneratedLocalContentV2(output);
  }
  const temp = `${output}.tmp-${process.pid}`;
  if (fs.existsSync(temp)) fail('stale temporary output exists');
  try {
    const manifest = writeBuildDirectory(scanned, temp);
    validateGeneratedLocalContentV2(temp);
    installBuildDirectory(temp, output, options.replace === true);
    return manifest;
  } catch (error) {
    if (fs.existsSync(temp)) fs.rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}

export function validateGeneratedLocalContentV2(directory) {
  const root = fs.realpathSync(path.resolve(directory));
  const manifestFile = path.join(root, 'manifest.json');
  assertRegularFileNoLink(manifestFile, 'manifest.json');
  const manifestBytes = fs.readFileSync(manifestFile);
  if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) fail('manifest exceeded 32 KiB');
  const manifest = readJsonFile(manifestFile, 'manifest.json');
  if (!isPlainRecord(manifest)) fail('manifest must be a plain object');
  assertExactKeys(manifest, [
    'schemaVersion', 'layout', 'contentStatus', 'releaseAuthority',
    'qualityGateAuthority', 'privacyBoundary', 'source', 'shards',
  ], 'manifest');
  if (isPlainRecord(manifest.privacyBoundary)) {
    assertExactKeys(manifest.privacyBoundary, [
      'urlAxes', 'contentOnlyAxes', 'selectionIndependentUrl', 'containsUserInput',
      'intendedRuntime', 'legacyPersonAxisUrlsForbidden',
    ], 'manifest privacyBoundary');
  }
  if (isPlainRecord(manifest.source)) {
    assertExactKeys(manifest.source, [
      'articleCount', 'categoryCounts', 'digest', 'coverageManifestChecked',
    ], 'manifest source');
  }
  if (manifest.schemaVersion !== LOCAL_GENERATED_MANIFEST_SCHEMA_V2
    || manifest.layout !== 'category_period_selection_independent'
    || manifest.contentStatus !== 'development_mock_replace_before_release'
    || manifest.releaseAuthority !== false
    || manifest.qualityGateAuthority !== false
    || !isPlainRecord(manifest.privacyBoundary)
    || manifest.privacyBoundary.selectionIndependentUrl !== true
    || manifest.privacyBoundary.containsUserInput !== false
    || manifest.privacyBoundary.intendedRuntime !== 'local_device'
    || manifest.privacyBoundary.legacyPersonAxisUrlsForbidden !== true
    || stableJson(manifest.privacyBoundary.urlAxes) !== stableJson(['category', 'period'])
    || stableJson(manifest.privacyBoundary.contentOnlyAxes) !== stableJson([
      'audience', 'band', 'strength', 'gyeokgukFamily', 'nameEffect', 'gender',
    ])
    || !isPlainRecord(manifest.source)
    || !isPlainRecord(manifest.source.categoryCounts)
    || typeof manifest.source.coverageManifestChecked !== 'boolean'
    || typeof manifest.source.digest !== 'string'
    || !SHA256_PATTERN.test(manifest.source.digest)
    || !Array.isArray(manifest.shards)
    || manifest.shards.length === 0) {
    fail('manifest contract mismatch');
  }

  const declaredShardPaths = manifest.shards.map((entry) => isPlainRecord(entry) ? entry.path : null);
  const sortedShardPaths = [...declaredShardPaths].sort((left, right) => String(left).localeCompare(String(right)));
  if (stableJson(declaredShardPaths) !== stableJson(sortedShardPaths)) {
    fail('manifest shard entries must use deterministic path order');
  }

  const expectedFiles = new Set(['manifest.json']);
  const allArticles = new Map();
  const categoryCounts = {};
  const seenPaths = new Set();
  for (const entry of manifest.shards) {
    if (!isPlainRecord(entry)) fail('manifest shard entry must be a plain object');
    assertExactKeys(entry, ['category', 'period', 'path', 'articleCount', 'bytes', 'digest'], 'manifest shard');
    if (!CATEGORIES.has(entry.category)
      || !PERIODS.has(entry.period)
      || entry.path !== `${entry.category}/${entry.period}.json`
      || seenPaths.has(entry.path)
      || !Number.isSafeInteger(entry.articleCount)
      || entry.articleCount < 1
      || !Number.isSafeInteger(entry.bytes)
      || entry.bytes < 2
      || typeof entry.digest !== 'string'
      || !SHA256_PATTERN.test(entry.digest)) {
      fail('manifest shard entry is invalid');
    }
    seenPaths.add(entry.path);
    expectedFiles.add(entry.path);
    const shardFile = path.resolve(root, ...entry.path.split('/'));
    if (!pathContains(root, shardFile)) fail('shard path escaped output root');
    assertRegularFileNoLink(shardFile, entry.path, MAX_OUTPUT_SHARD_BYTES);
    const body = fs.readFileSync(shardFile);
    if (body.byteLength !== entry.bytes || digestBuffer(body) !== entry.digest) {
      fail(`${entry.path} byte/digest mismatch`);
    }
    const shard = readJsonFile(shardFile, entry.path);
    if (!isPlainRecord(shard)) fail(`${entry.path} must be an object`);
    assertExactKeys(shard, ['schemaVersion', 'category', 'period', 'articleCount', 'articles'], entry.path);
    if (shard.schemaVersion !== LOCAL_GENERATED_SHARD_SCHEMA_V2
      || shard.category !== entry.category
      || shard.period !== entry.period
      || shard.articleCount !== entry.articleCount
      || !isPlainRecord(shard.articles)
      || Object.keys(shard.articles).length !== entry.articleCount) {
      fail(`${entry.path} header/count mismatch`);
    }
    for (const [classId, article] of Object.entries(shard.articles)) {
      const axes = parseGeneratedClassIdV2(classId);
      if (axes.category !== entry.category || axes.period !== entry.period || allArticles.has(classId)) {
        fail(`${classId} is in an invalid or duplicate shard`);
      }
      assertGeneratedSourceArticleV2(article, classId);
      allArticles.set(classId, canonicalize(article));
      categoryCounts[entry.category] = (categoryCounts[entry.category] ?? 0) + 1;
    }
  }

  const actualFiles = walkRegularFiles(root).sort();
  if (stableJson(actualFiles) !== stableJson([...expectedFiles].sort())) {
    fail('output contains missing or undeclared files');
  }
  if (!Number.isSafeInteger(manifest.source.articleCount)
    || manifest.source.articleCount !== allArticles.size
    || manifest.source.digest !== corpusDigest(allArticles)
    || stableJson(manifest.source.categoryCounts) !== stableJson(categoryCounts)) {
    fail('manifest source coverage/digest mismatch');
  }
  return {
    articleCount: allArticles.size,
    shardCount: manifest.shards.length,
    corpusDigest: manifest.source.digest,
    totalBytes: manifest.shards.reduce((sum, shard) => sum + shard.bytes, manifestBytes.byteLength),
  };
}

function parseArgs(argv) {
  const options = {
    sourceDir: DEFAULT_SOURCE,
    outDir: null,
    expectedManifestPath: undefined,
    replace: false,
    validateDir: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--source' && argv[index + 1]) options.sourceDir = argv[++index];
    else if (token === '--out' && argv[index + 1]) options.outDir = argv[++index];
    else if (token === '--expected-manifest' && argv[index + 1]) options.expectedManifestPath = argv[++index];
    else if (token === '--replace') options.replace = true;
    else if (token === '--validate' && argv[index + 1]) options.validateDir = argv[++index];
    else fail(`unknown or incomplete argument ${token}`);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = options.validateDir !== null
    ? validateGeneratedLocalContentV2(options.validateDir)
    : buildGeneratedLocalContentV2(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
