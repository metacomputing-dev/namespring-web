import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildGeneratedLocalContentV2,
  validateGeneratedLocalContentV2,
} from './pack-generated-local-v2.mjs';

function fixtureArticle(classId) {
  const [category, period, audience, band, strength, family, nameEffect, gender] = classId.split('.');
  return {
    schemaVersion: 'spring-ts.article.v1',
    articleId: classId,
    category,
    period,
    audience,
    band,
    caseAxes: {
      gangyak: strength,
      gyeokgukFamily: family,
      nameEffect,
      gender: gender === 'x' ? null : gender,
    },
    summary: '검증용 요약이에요.',
    body: ['검증용 본문이에요.'],
    expert: ['검증용 전문가 근거예요.'],
    livingTips: [],
    cautions: [],
    aiGenerated: true,
    sourceNote: 'development-fixture',
  };
}

function reverseObject(value) {
  if (Array.isArray(value)) return value.map(reverseObject);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [
    key,
    reverseObject(child),
  ]));
}

function writeCorpus(root, classIds, reverseKeys = false) {
  fs.mkdirSync(root, { recursive: true });
  for (const classId of classIds) {
    const category = classId.split('.')[0];
    const directory = path.join(root, category);
    fs.mkdirSync(directory, { recursive: true });
    const article = fixtureArticle(classId);
    fs.writeFileSync(
      path.join(directory, `${classId}.json`),
      JSON.stringify(reverseKeys ? reverseObject(article) : article, null, 2),
      'utf8',
    );
  }
}

function treeDigest(root) {
  const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const resolved = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(resolved) : [resolved];
    });
  const material = walk(root).sort().map((file) => [
    path.relative(root, file).replaceAll('\\', '/'),
    fs.readFileSync(file).toString('base64'),
  ]);
  return crypto.createHash('sha256').update(JSON.stringify(material)).digest('hex');
}

function withTemp(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'namespring-generated-local-v2-'));
  t.after(() => {
    const resolved = fs.realpathSync(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return root;
}

const IDS = [
  'overall.today.adult.mid.strong.inseong.boost_mild.x',
  'overall.today.adult.low.weak.bigeop.adverse.x',
  'wealth.thisWeek.adult.high.balanced.jaeseong.neutral.x',
  'romance.today.adult.high.strong.gwanseong.boost_strong.female',
];

test('optional full corpus audit builds and validates every current source article', {
  skip: process.env.FULL_GENERATED_LOCAL_V2_AUDIT !== '1',
}, (t) => {
  const root = withTemp(t);
  const source = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../data/generated',
  );
  const output = path.join(root, 'generated-local-v2');
  const buildStarted = performance.now();
  const manifest = buildGeneratedLocalContentV2({ sourceDir: source, outDir: output });
  const buildMs = performance.now() - buildStarted;
  const validationStarted = performance.now();
  const validation = validateGeneratedLocalContentV2(output);
  const validationMs = performance.now() - validationStarted;
  assert.equal(manifest.source.coverageManifestChecked, true);
  assert.equal(validation.articleCount, 21_060);
  assert.equal(validation.shardCount, 55);
  assert.ok(Math.max(...manifest.shards.map((shard) => shard.bytes)) < 4 * 1024 * 1024);
  process.stdout.write(`${JSON.stringify({
    fullCorpusAudit: 'PASS',
    buildMs: Math.round(buildMs),
    validationMs: Math.round(validationMs),
    ...validation,
  })}\n`);
});

test('V2 URLs expose category and period only, while the manifest remains non-authoritative', (t) => {
  const root = withTemp(t);
  const source = path.join(root, 'source');
  const output = path.join(root, 'generated-local-v2');
  writeCorpus(source, IDS);
  const manifest = buildGeneratedLocalContentV2({ sourceDir: source, outDir: output });
  assert.equal(manifest.contentStatus, 'development_mock_replace_before_release');
  assert.equal(manifest.releaseAuthority, false);
  assert.equal(manifest.qualityGateAuthority, false);
  assert.deepEqual(manifest.privacyBoundary.urlAxes, ['category', 'period']);
  assert.equal(manifest.privacyBoundary.selectionIndependentUrl, true);
  assert.equal(manifest.privacyBoundary.legacyPersonAxisUrlsForbidden, true);
  assert.deepEqual(
    manifest.shards.map((shard) => shard.path).sort(),
    ['overall/today.json', 'romance/today.json', 'wealth/thisWeek.json'],
  );
  for (const shard of manifest.shards) {
    assert.match(shard.path, /^[a-z_]+\/(?:life|today|thisWeek|thisMonth|thisYear)\.json$/u);
    assert.doesNotMatch(shard.path, /(?:weak|strong|balanced|male|female|boost|adverse)/u);
  }
  const manifestText = fs.readFileSync(path.join(output, 'manifest.json'), 'utf8');
  assert.doesNotMatch(manifestText, /\.strong\.|\.weak\.|\.female\./u,
    'manifest must not become a person-axis URL index');
  assert.deepEqual(validateGeneratedLocalContentV2(output), {
    articleCount: 4,
    shardCount: 3,
    corpusDigest: manifest.source.digest,
    totalBytes: fs.statSync(path.join(output, 'manifest.json')).size
      + manifest.shards.reduce((sum, shard) => sum + shard.bytes, 0),
  });
});

test('V2 output is deterministic across source creation and object-key order', (t) => {
  const root = withTemp(t);
  const firstSource = path.join(root, 'first-source');
  const secondSource = path.join(root, 'second-source');
  const firstOutput = path.join(root, 'first-output');
  const secondOutput = path.join(root, 'second-output');
  writeCorpus(firstSource, IDS);
  writeCorpus(secondSource, [...IDS].reverse(), true);
  const first = buildGeneratedLocalContentV2({ sourceDir: firstSource, outDir: firstOutput });
  const second = buildGeneratedLocalContentV2({ sourceDir: secondSource, outDir: secondOutput });
  assert.equal(first.source.digest, second.source.digest);
  assert.equal(treeDigest(firstOutput), treeDigest(secondOutput));
});

test('V2 validation fails closed on shard tampering and source identity mismatch', (t) => {
  const root = withTemp(t);
  const source = path.join(root, 'source');
  const output = path.join(root, 'output');
  writeCorpus(source, IDS);
  buildGeneratedLocalContentV2({ sourceDir: source, outDir: output });
  const shard = path.join(output, 'overall', 'today.json');
  fs.appendFileSync(shard, ' ');
  assert.throws(
    () => validateGeneratedLocalContentV2(output),
    /byte\/digest mismatch/u,
  );

  const invalidSource = path.join(root, 'invalid-source');
  const invalidId = 'overall.today.adult.mid.strong.inseong.boost_mild.x';
  writeCorpus(invalidSource, [invalidId]);
  const invalidFile = path.join(invalidSource, 'overall', `${invalidId}.json`);
  const invalidArticle = JSON.parse(fs.readFileSync(invalidFile, 'utf8'));
  invalidArticle.caseAxes.gyeokgukFamily = 'bigeop';
  fs.writeFileSync(invalidFile, JSON.stringify(invalidArticle), 'utf8');
  assert.throws(
    () => buildGeneratedLocalContentV2({
      sourceDir: invalidSource,
      outDir: path.join(root, 'invalid-output'),
    }),
    /caseAxes do not match/u,
  );
});

test('V2 validation rejects a manifest that weakens the privacy declaration', (t) => {
  const root = withTemp(t);
  const source = path.join(root, 'source');
  const output = path.join(root, 'output');
  writeCorpus(source, [IDS[0]]);
  buildGeneratedLocalContentV2({ sourceDir: source, outDir: output });
  const manifestFile = path.join(output, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  manifest.privacyBoundary.contentOnlyAxes = ['audience', 'band'];
  fs.writeFileSync(manifestFile, JSON.stringify(manifest), 'utf8');
  assert.throws(
    () => validateGeneratedLocalContentV2(output),
    /manifest contract mismatch/u,
  );
});

test('V2 build refuses source/output overlap', (t) => {
  const root = withTemp(t);
  const source = path.join(root, 'source');
  writeCorpus(source, [IDS[0]]);
  assert.throws(
    () => buildGeneratedLocalContentV2({ sourceDir: source, outDir: path.join(source, 'output') }),
    /must not overlap/u,
  );
});

test('V2 replacement cannot recursively overwrite an unrelated directory', (t) => {
  const root = withTemp(t);
  const source = path.join(root, 'source');
  const unrelated = path.join(root, 'unrelated');
  writeCorpus(source, [IDS[0]]);
  fs.mkdirSync(unrelated);
  fs.writeFileSync(path.join(unrelated, 'keep.txt'), 'do not remove', 'utf8');
  assert.throws(
    () => buildGeneratedLocalContentV2({
      sourceDir: source,
      outDir: unrelated,
      replace: true,
    }),
    /manifest\.json/u,
  );
  assert.equal(fs.readFileSync(path.join(unrelated, 'keep.txt'), 'utf8'), 'do not remove');
});
