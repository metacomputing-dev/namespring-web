import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'namespring', 'dist');
const PUBLIC = path.join(ROOT, 'namespring', 'public');
const GENERATED_SOURCE = path.join(ROOT, 'lib', 'spring-ts', 'data', 'generated');
const CANONICAL_WASM = path.join(ROOT, 'lib', 'seed-ts', 'assets', 'sql-wasm-1.14.1.wasm');
const EXPECTED_ARTICLE_COUNT = 21_060;
const EXPECTED_BUNDLE_COUNT = 1_116;
const EXPECTED_WASM_BYTE_LENGTH = 659_730;
const EXPECTED_WASM_SHA256 = '438c88f666dc054ce4e9395f80fe9db4218b1a3c379960454880f048a7898aed';

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizeBase(value) {
  assert.equal(typeof value, 'string', '--base is required');
  const trimmed = value.trim();
  assert.ok(trimmed.length > 0, '--base must not be empty');
  if (trimmed === '/') return '/';
  return `/${trimmed.replace(/^\/+|\/+$/gu, '')}/`;
}

function listFiles(root, predicate = () => true) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && predicate(absolute)) result.push(absolute);
    }
  };
  visit(root);
  return result.sort();
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function assertSameFile(source, built, label) {
  assert.ok(fs.existsSync(source), `${label}: source missing`);
  assert.ok(fs.existsSync(built), `${label}: built file missing`);
  assert.equal(fs.statSync(built).size, fs.statSync(source).size, `${label}: byte length`);
  assert.equal(sha256(built), sha256(source), `${label}: sha256`);
}

const base = normalizeBase(argumentValue('--base'));
const indexFile = path.join(DIST, 'index.html');
const fallbackFile = path.join(DIST, '404.html');
assert.ok(fs.statSync(indexFile).size > 0, 'dist/index.html must be non-empty');
assertSameFile(indexFile, fallbackFile, 'Pages SPA fallback');
const indexHtml = fs.readFileSync(indexFile, 'utf8');
assert.ok(indexHtml.includes(`${base}assets/`), `index.html base ${base}`);

const databaseRelativePaths = [
  'data/hanja.db',
  'data/fourframe.db',
  ...Array.from({ length: 14 }, (_, index) => `data/name-stat-shards/${String(index + 1).padStart(2, '0')}.db`),
];
for (const relativePath of databaseRelativePaths) {
  assertSameFile(path.join(PUBLIC, relativePath), path.join(DIST, relativePath), relativePath);
}

const sourceArticles = listFiles(GENERATED_SOURCE, (file) => file.endsWith('.json'));
assert.equal(sourceArticles.length, EXPECTED_ARTICLE_COUNT, 'generated article count');
const remainingArticleIds = new Set();
for (const file of sourceArticles) {
  const relativePath = path.relative(GENERATED_SOURCE, file);
  const [sourceCategory] = relativePath.split(path.sep);
  const article = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(article && typeof article === 'object' && !Array.isArray(article), `source article object: ${relativePath}`);
  const articleId = path.basename(file, '.json');
  assert.equal(typeof article.articleId, 'string', `source articleId: ${relativePath}`);
  assert.equal(article.articleId, articleId, `source filename/articleId: ${relativePath}`);
  assert.equal(article.category, sourceCategory, `source path/category: ${relativePath}`);
  assert.equal(remainingArticleIds.has(articleId), false, `duplicate source articleId: ${articleId}`);
  remainingArticleIds.add(articleId);
}
const publicPacked = path.join(PUBLIC, 'generated-packed');
const distPacked = path.join(DIST, 'generated-packed');
const publicBundles = listFiles(publicPacked, (file) => file.endsWith('.json'));
const distBundles = listFiles(distPacked, (file) => file.endsWith('.json'));
assert.equal(publicBundles.length, EXPECTED_BUNDLE_COUNT, 'public bundle count');
assert.equal(distBundles.length, EXPECTED_BUNDLE_COUNT, 'dist bundle count');
const relativeBundles = publicBundles.map((file) => path.relative(publicPacked, file));
assert.deepEqual(distBundles.map((file) => path.relative(distPacked, file)), relativeBundles, 'bundle paths');
let packedEntryCount = 0;
for (const relativePath of relativeBundles) {
  const routeParts = relativePath.split(path.sep);
  assert.equal(routeParts.length, 2, `bundle route depth: ${relativePath}`);
  const [bundleCategory, bundleFilename] = routeParts;
  const publicBundle = path.join(publicPacked, relativePath);
  assertSameFile(publicBundle, path.join(distPacked, relativePath), `generated-packed/${relativePath}`);
  const packed = JSON.parse(fs.readFileSync(publicBundle, 'utf8'));
  assert.ok(packed && typeof packed === 'object' && !Array.isArray(packed), `bundle object: ${relativePath}`);
  for (const [articleId, article] of Object.entries(packed)) {
    assert.equal(article?.articleId, articleId, `bundle key/articleId: ${relativePath}#${articleId}`);
    const articleIdParts = articleId.split('.');
    assert.equal(articleIdParts.length, 8, `bundle articleId shape: ${relativePath}#${articleId}`);
    assert.equal(articleIdParts[0], bundleCategory, `bundle article category: ${relativePath}#${articleId}`);
    assert.equal(`${articleIdParts.slice(4).join('.')}.json`, bundleFilename, `bundle article route: ${relativePath}#${articleId}`);
    assert.equal(remainingArticleIds.delete(articleId), true, `unknown or duplicate packed articleId: ${articleId}`);
    packedEntryCount += 1;
  }
}
assert.equal(packedEntryCount, EXPECTED_ARTICLE_COUNT, 'packed article count');
assert.equal(remainingArticleIds.size, 0, `packed articles missing: ${Array.from(remainingArticleIds).slice(0, 5).join(', ')}`);

const wasmCandidates = listFiles(path.join(DIST, 'assets'), (file) => /^sql-wasm-1\.14\.1.*\.wasm$/u.test(path.basename(file)));
assert.equal(wasmCandidates.length, 1, 'one bundled sql.js WASM asset');
const emittedWasm = wasmCandidates[0];
assert.equal(fs.statSync(emittedWasm).size, EXPECTED_WASM_BYTE_LENGTH, 'WASM byte length');
assert.equal(sha256(emittedWasm), EXPECTED_WASM_SHA256, 'WASM sha256');
assertSameFile(CANONICAL_WASM, emittedWasm, 'canonical WASM');

const javascriptFiles = listFiles(path.join(DIST, 'assets'), (file) => file.endsWith('.js'));
let wasmReferenceFound = false;
let generatedPackReferenceFound = false;
for (const file of javascriptFiles) {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(path.basename(emittedWasm))) wasmReferenceFound = true;
  if (source.includes('generated-packed/') && source.includes(base)) generatedPackReferenceFound = true;
  assert.equal(source.includes('https://cdn.jsdelivr.net/npm/sql.js@1.14.0/dist/sql-wasm.wasm'), false, 'legacy sql.js CDN');
}
assert.equal(wasmReferenceFound, true, 'JS reference to emitted WASM');
assert.equal(generatedPackReferenceFound, true, 'base-aware generated pack reference');
assert.equal(fs.existsSync(path.join(DIST, 'saju-ts')), false, 'legacy saju-ts copy');

console.log(`Pages artifact contract: PASS (${databaseRelativePaths.length} DBs, ${distBundles.length} bundles, ${path.basename(emittedWasm)}, base=${base})`);
