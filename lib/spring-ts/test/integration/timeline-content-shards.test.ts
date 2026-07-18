import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  _clearArticleRegistryCacheForTesting,
  articleShardIdsForSelection,
  assertArticleBundleForShard,
  loadArticleRegistrySelection,
} from '../../src/report/tiered/article-registry.js';
import {
  _clearGlossaryCacheForTesting,
  assertGlossaryBundleForId,
  glossaryBundleIdsForTagIds,
  loadGlossarySelection,
} from '../../src/report/tiered/glossary-loader.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ARTICLE_ROOT = path.join(ROOT, 'data', 'articles');
const GLOSSARY_ROOT = path.join(ROOT, 'data', 'narrative', '_glossary');

function walkArticleFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkArticleFiles(full);
    return entry.isFile() && entry.name.endsWith('.articles.json') ? [full] : [];
  });
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test('article shards reject malformed or cross-shard content atomically', () => {
  const valid = JSON.parse(
    fs.readFileSync(path.join(ARTICLE_ROOT, 'wealth', 'today.articles.json'), 'utf8'),
  ) as Record<string, any>;
  assert.doesNotThrow(() => assertArticleBundleForShard('wealth/today', valid));
  assert.doesNotThrow(() => assertArticleBundleForShard('wealth/today', { default: valid }));

  const wrongSchema = cloneJson(valid);
  wrongSchema.schemaVersion = 'spring-ts.article-bundle.v0';
  assert.throws(() => assertArticleBundleForShard('wealth/today', wrongSchema), /schemaVersion/);

  const wrongBundleId = cloneJson(valid);
  wrongBundleId.bundleId = 'health.today';
  assert.throws(() => assertArticleBundleForShard('wealth/today', wrongBundleId), /bundleId/);

  const malformedMixedBundle = cloneJson(valid);
  malformedMixedBundle.articles[1].hook = 7;
  assert.throws(
    () => assertArticleBundleForShard('wealth/today', malformedMixedBundle),
    /articles\[1\] fields/,
  );

  const wrongCategory = cloneJson(valid);
  wrongCategory.articles[0].category = 'health';
  assert.throws(() => assertArticleBundleForShard('wealth/today', wrongCategory), /fields/);

  const duplicateId = cloneJson(valid);
  duplicateId.articles[1].articleId = duplicateId.articles[0].articleId;
  assert.throws(() => assertArticleBundleForShard('wealth/today', duplicateId), /duplicate articleId/);

  const falseAuthority = cloneJson(valid);
  falseAuthority.sourceTier.authorityTruthEligible = true;
  assert.throws(() => assertArticleBundleForShard('wealth/today', falseAuthority), /authority truth/);
});

test('glossary bundles reject malformed or cross-bundle content atomically', () => {
  const valid = JSON.parse(
    fs.readFileSync(path.join(GLOSSARY_ROOT, 'yongshin.json'), 'utf8'),
  ) as Record<string, any>;
  assert.doesNotThrow(() => assertGlossaryBundleForId('yongshin', valid));
  assert.doesNotThrow(() => assertGlossaryBundleForId('yongshin', { default: valid }));

  const wrongSchema = cloneJson(valid);
  wrongSchema.schemaVersion = 'spring-ts.glossary-bundle.v0';
  assert.throws(() => assertGlossaryBundleForId('yongshin', wrongSchema), /schemaVersion/);

  const wrongCategory = cloneJson(valid);
  wrongCategory.category = 'tenGod';
  assert.throws(() => assertGlossaryBundleForId('yongshin', wrongCategory), /category/);

  const malformedMixedBundle = cloneJson(valid);
  malformedMixedBundle.entries[1].brief = 7;
  assert.throws(
    () => assertGlossaryBundleForId('yongshin', malformedMixedBundle),
    /entries\[1\] fields/,
  );

  const crossBundleEntry = cloneJson(valid);
  crossBundleEntry.entries[0].id = 'wood';
  assert.throws(() => assertGlossaryBundleForId('yongshin', crossBundleEntry), /fields/);

  const duplicateId = cloneJson(valid);
  duplicateId.entries[1].id = duplicateId.entries[0].id;
  assert.throws(() => assertGlossaryBundleForId('yongshin', duplicateId), /duplicate entry id/);

  const missingEntry = cloneJson(valid);
  missingEntry.entries.pop();
  assert.throws(() => assertGlossaryBundleForId('yongshin', missingEntry), /cardinality/);

  const falseAuthority = cloneJson(valid);
  falseAuthority.entries[0].sourceTier.authorityTruthEligible = true;
  assert.throws(() => assertGlossaryBundleForId('yongshin', falseAuthority), /fields/);
});

test('mixed-period selection resolves exact shards without a Cartesian category union', async () => {
  const periods = ['today', 'thisWeek'] as const;
  const categoriesByPeriod = {
    today: ['wealth'],
    thisWeek: ['health'],
  } as const;
  const shards = articleShardIdsForSelection(periods, categoriesByPeriod);
  assert.deepEqual(shards, [
    'health/thisWeek',
    'wealth/today',
  ]);
  assert.equal(shards.some((shard) => shard.startsWith('overall/')), false,
    'overall must be loaded only when explicitly requested');
  assert.equal(shards.includes('health/today'), false);
  assert.equal(shards.includes('wealth/thisWeek'), false);

  _clearArticleRegistryCacheForTesting();
  const registry = await loadArticleRegistrySelection(periods, categoriesByPeriod);
  assert.ok(registry.totalArticleCount > 0);
  const allowed = new Set([
    'wealth|today',
    'health|thisWeek',
  ]);
  for (const article of registry.all) {
    assert.equal(allowed.has(`${article.category}|${article.period}`), true, article.articleId);
  }

  const allBytes = walkArticleFiles(ARTICLE_ROOT)
    .reduce((sum, file) => sum + fs.statSync(file).size, 0);
  const selectedBytes = shards
    .reduce((sum, shard) => sum + fs.statSync(path.join(ARTICLE_ROOT, `${shard}.articles.json`)).size, 0);
  assert.ok(selectedBytes < allBytes * 0.25,
    `selected source shards must stay below 25% of full article bytes (${selectedBytes}/${allBytes})`);
});

test('integrated today delivery loads exactly the six requested article shards', () => {
  const shards = articleShardIdsForSelection(['today'], {
    today: ['overall', 'health', 'wealth', 'academic', 'romance', 'family'],
  });
  assert.deepEqual(shards, [
    'academic/today',
    'family/today',
    'health/today',
    'overall/today',
    'romance/today',
    'wealth/today',
  ]);
  assert.equal(shards.some((shard) => !shard.endsWith('/today')), false);

  const allBytes = walkArticleFiles(ARTICLE_ROOT)
    .reduce((sum, file) => sum + fs.statSync(file).size, 0);
  const selectedBytes = shards
    .reduce((sum, shard) => sum + fs.statSync(path.join(ARTICLE_ROOT, `${shard}.articles.json`)).size, 0);
  assert.ok(selectedBytes < allBytes,
    `integrated today must not load unselected period shards (${selectedBytes}/${allBytes})`);
});

test('glossary index matches every source entry and every authored article tag', async () => {
  const glossaryFiles = fs.readdirSync(GLOSSARY_ROOT)
    .filter((file) => file.endsWith('.json'))
    .sort();
  for (const file of glossaryFiles) {
    const bundleId = path.basename(file, '.json');
    const bundle = JSON.parse(fs.readFileSync(path.join(GLOSSARY_ROOT, file), 'utf8')) as {
      entries?: Array<{ id?: string }>;
    };
    for (const entry of bundle.entries ?? []) {
      assert.equal(typeof entry.id, 'string');
      assert.deepEqual(glossaryBundleIdsForTagIds([entry.id!]), [bundleId], entry.id);
    }
  }

  const authoredTagIds = new Set<string>();
  for (const file of walkArticleFiles(ARTICLE_ROOT)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/#\{([^}]+)\}/gu)) authoredTagIds.add(match[1]);
  }
  assert.ok(authoredTagIds.size > 0);
  for (const tagId of authoredTagIds) {
    assert.equal(glossaryBundleIdsForTagIds([tagId]).length, 1, tagId);
  }

  _clearGlossaryCacheForTesting();
  const selected = await loadGlossarySelection(['dayPillar', 'yongshin']);
  assert.deepEqual(Object.keys(selected).sort(), ['dayPillar', 'yongshin']);
  assert.equal(Object.isFrozen(selected), true);
});
