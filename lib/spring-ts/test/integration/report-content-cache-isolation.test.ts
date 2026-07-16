import assert from 'node:assert/strict';
import test from 'node:test';

import { buildInsightFactsCard } from '../../src/report/cards/insight-facts-card.js';
import { SHINSAL_ENCYCLOPEDIA } from '../../src/report/knowledge/shinsalEncyclopedia.js';
import {
  _clearGlossaryCacheForTesting,
  loadGlossary,
} from '../../src/report/tiered/glossary-loader.js';
import {
  _clearInsightCacheForTesting,
  getInsightInterpretation,
  type InsightInterpretation,
} from '../../src/report/tiered/insight-registry.js';
import { buildTagGlossary } from '../../src/report/tiered/tag-inliner.js';
import type {
  FortuneTieredMatrix,
  TagId,
} from '../../src/report/types.js';

function taggedCell(tagId: TagId): unknown {
  return {
    meaningfulness: 'meaningful',
    stars: 3,
    brief: { headline: '격리 테스트' },
    standard: {
      paragraphs: [{
        plainText: '격리 테스트',
        tokens: [{ kind: 'tag', tagId }],
      }],
    },
    expert: { paragraphs: [] },
  };
}

function attemptInsightMutation(entry: InsightInterpretation): void {
  assert.throws(() => {
    (entry as { text: string }).text = 'POISON';
  }, TypeError);
  if (entry.sourceTier) {
    assert.throws(() => {
      (entry.sourceTier as { tier: string }).tier = 'POISON';
    }, TypeError);
  }
}

test('glossary cache and report-scoped views expose only immutable values', () => {
  _clearGlossaryCacheForTesting();
  const allEntries = loadGlossary();
  const entry = Object.values(allEntries)
    .find((candidate) => candidate.related.length > 0);
  assert.ok(entry);

  const expected = {
    brief: entry.brief,
    detailed: entry.detailed,
    related: [...entry.related],
    total: Object.keys(allEntries).length,
  };
  assert.equal(Object.isFrozen(allEntries), true);
  assert.equal(Object.isFrozen(entry), true);
  assert.equal(Object.isFrozen(entry.related), true);
  assert.throws(() => {
    (entry as { brief: string }).brief = 'POISON';
  }, TypeError);
  assert.throws(() => {
    (entry.related as TagId[]).push(entry.id);
  }, TypeError);

  const matrix = {
    periods: {
      life: {
        overall: taggedCell(entry.id),
        byCategory: {},
      },
    },
  } as unknown as Pick<FortuneTieredMatrix, 'periods'>;
  const scoped = buildTagGlossary(matrix, allEntries);
  assert.strictEqual(scoped.entries[entry.id], entry);

  const reloaded = loadGlossary();
  const reloadedEntry = reloaded[entry.id];
  assert.ok(reloadedEntry);
  assert.deepEqual({
    brief: reloadedEntry.brief,
    detailed: reloadedEntry.detailed,
    related: [...reloadedEntry.related],
    total: Object.keys(reloaded).length,
  }, expected);
});

test('insight registry and card builders cannot poison later reports', () => {
  _clearInsightCacheForTesting();
  const factId = 'sibiUnseong.장생';
  const entry = getInsightInterpretation(factId);
  assert.ok(entry);
  const expected = JSON.parse(JSON.stringify(entry)) as InsightInterpretation;
  assert.equal(Object.isFrozen(entry), true);
  assert.equal(Object.isFrozen(entry.sourceTier), true);
  attemptInsightMutation(entry);

  const firstCard = buildInsightFactsCard({
    sibiUnseong: { year: '장생' },
  } as never);
  const firstInterpretation = firstCard?.facts
    .find((fact) => fact.factId === `${factId}.year`)
    ?.interpretation;
  assert.ok(firstInterpretation);
  assert.equal(Object.isFrozen(firstInterpretation), true);
  attemptInsightMutation(firstInterpretation);

  const reloaded = getInsightInterpretation(factId);
  const secondCard = buildInsightFactsCard({
    sibiUnseong: { year: '장생' },
  } as never);
  const secondInterpretation = secondCard?.facts
    .find((fact) => fact.factId === `${factId}.year`)
    ?.interpretation;
  assert.deepEqual(reloaded, expected);
  assert.deepEqual(secondInterpretation, expected);
});

test('shinsal encyclopedia fallback interpretations are immutable too', () => {
  const fallbackSource = Object.values(SHINSAL_ENCYCLOPEDIA)
    .find((entry) =>
      entry.korean.length > 0
      && getInsightInterpretation(`shinsal.${entry.korean}`) === null);
  assert.ok(fallbackSource);

  const saju = {
    shinsalHits: [{
      type: fallbackSource.korean,
      position: 'DAY_BRANCH',
      grade: 'B',
      weightedScore: 70,
      seatPillars: [],
    }],
  };
  const first = buildInsightFactsCard(saju as never);
  const firstInterpretation = first?.facts
    .find((fact) => fact.factId === `shinsal.${fallbackSource.korean}`)
    ?.interpretation;
  assert.ok(firstInterpretation);
  const expected = JSON.parse(
    JSON.stringify(firstInterpretation),
  ) as InsightInterpretation;
  assert.equal(Object.isFrozen(firstInterpretation), true);
  attemptInsightMutation(firstInterpretation);

  const second = buildInsightFactsCard(saju as never);
  const secondInterpretation = second?.facts
    .find((fact) => fact.factId === `shinsal.${fallbackSource.korean}`)
    ?.interpretation;
  assert.deepEqual(secondInterpretation, expected);
});
