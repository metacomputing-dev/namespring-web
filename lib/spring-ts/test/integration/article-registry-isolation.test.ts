import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ARTICLE_AUDIENCES,
  ARTICLE_BANDS,
  _clearArticleRegistryCacheForTesting,
  loadArticleRegistry,
  type Article,
} from '../../src/report/tiered/article-registry.js';
import { selectArticle } from '../../src/report/tiered/article-selector.js';
import {
  _clearGeneratedCacheForTesting,
  getGeneratedArticle,
} from '../../src/report/tiered/generated-registry.js';

function attemptArticleMutation(article: Article): void {
  assert.throws(() => {
    (article as { summary: string }).summary = 'POISON';
  }, TypeError);
  assert.throws(() => {
    (article.body as string[]).push('POISON');
  }, TypeError);
  assert.throws(() => {
    (article.expert as string[]).splice(0);
  }, TypeError);
}

test('base registry never exposes its process-global arrays or articles', () => {
  _clearArticleRegistryCacheForTesting();
  const registry = loadArticleRegistry();
  const first = registry.all[0];
  assert.ok(first);

  const pool = registry.get(first.category, first.period, first.audience);
  const selectedBefore = selectArticle(
    registry,
    first.category,
    first.period,
    first.audience,
    first.band,
    'article-registry-isolation',
  );
  assert.ok(selectedBefore);

  const expected = {
    totalArticleCount: registry.totalArticleCount,
    allLength: registry.all.length,
    poolLength: pool.length,
    firstArticleId: first.articleId,
    firstSummary: first.summary,
    firstBody: [...first.body],
    selectedArticleId: selectedBefore.articleId,
  };

  assert.equal(Object.isFrozen(ARTICLE_AUDIENCES), true);
  assert.equal(Object.isFrozen(ARTICLE_BANDS), true);
  assert.equal(Object.isFrozen(registry), true);
  assert.equal(Object.isFrozen(registry.all), true);
  assert.equal(Object.isFrozen(pool), true);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.body), true);
  assert.equal(Object.isFrozen(first.expert), true);
  assert.throws(() => {
    (registry.all as Article[]).splice(0);
  }, TypeError);
  assert.throws(() => {
    (pool as Article[]).splice(0);
  }, TypeError);
  attemptArticleMutation(first);

  const reloaded = loadArticleRegistry();
  const reloadedFirst = reloaded.all[0];
  const selectedAfter = selectArticle(
    reloaded,
    first.category,
    first.period,
    first.audience,
    first.band,
    'article-registry-isolation',
  );
  assert.deepEqual({
    totalArticleCount: reloaded.totalArticleCount,
    allLength: reloaded.all.length,
    poolLength: reloaded.get(first.category, first.period, first.audience).length,
    firstArticleId: reloadedFirst?.articleId,
    firstSummary: reloadedFirst?.summary,
    firstBody: reloadedFirst === undefined ? [] : [...reloadedFirst.body],
    selectedArticleId: selectedAfter?.articleId,
  }, expected);
});

test('node generated-article cache exposes only immutable snapshots', () => {
  _clearGeneratedCacheForTesting();
  const classId =
    'overall.life.adult.high.balanced.bigeop.adverse.x';
  const first = getGeneratedArticle('overall', classId);
  assert.ok(first);
  const firstWithAxes = first as Article & {
    readonly caseAxes?: Readonly<Record<string, unknown>>;
  };

  const expected = {
    articleId: first.articleId,
    summary: first.summary,
    body: [...first.body],
    expert: [...first.expert],
    caseAxes: firstWithAxes.caseAxes,
  };
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.body), true);
  assert.equal(Object.isFrozen(first.expert), true);
  assert.equal(Object.isFrozen(firstWithAxes.caseAxes), true);
  attemptArticleMutation(first);
  assert.throws(() => {
    (firstWithAxes.caseAxes as Record<string, unknown>).gangyak = 'POISON';
  }, TypeError);

  const second = getGeneratedArticle('overall', classId);
  assert.strictEqual(second, first);
  const secondWithAxes = second as Article & {
    readonly caseAxes?: Readonly<Record<string, unknown>>;
  };
  assert.deepEqual(second === null ? null : {
    articleId: second.articleId,
    summary: second.summary,
    body: [...second.body],
    expert: [...second.expert],
    caseAxes: secondWithAxes.caseAxes,
  }, expected);
});
