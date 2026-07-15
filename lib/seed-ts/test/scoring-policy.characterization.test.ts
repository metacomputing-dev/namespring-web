import assert from 'node:assert/strict';
import test from 'node:test';

import type { HanjaEntry } from '../src/database/hanja-repository.js';
import { Element } from '../src/model/element.js';
import { Energy } from '../src/model/energy.js';
import { Polarity } from '../src/model/polarity.js';
import { SEED_SCORING_POLICY } from '../src/scoring-policy.js';
import { SeedTs } from '../src/seed.js';
import { buildHangulPseudoEntry } from '../src/utils/hangul-name-entry.js';

const ELEMENT_RELATION_SCORE_MATRIX = [
  [65, 85, 50, 70, 70],
  [70, 65, 85, 50, 70],
  [70, 70, 65, 85, 50],
  [50, 70, 70, 65, 85],
  [85, 50, 70, 70, 65],
] as const;

function energy(element: Element): Energy {
  return new Energy(Polarity.Positive, element);
}

function entry(
  hangul: string,
  hanja: string,
  strokes: number,
  isSurname: boolean,
): HanjaEntry {
  return {
    ...buildHangulPseudoEntry(hangul, { hanja, isSurname }),
    strokes,
    stroke_element: 'Metal',
    resource_element: 'Water',
  };
}

test('v1 policy freezes the current 25 directional element-pair scores', () => {
  const elements = Element.values();
  const actual = elements.map((current) => elements.map((next) =>
    Energy.getElementScore([energy(current), energy(next)])));

  assert.deepEqual(actual, ELEMENT_RELATION_SCORE_MATRIX);
  assert.equal(SEED_SCORING_POLICY.schemaVersion, 'namespring.seed-scoring-policy/v1');
  assert.equal(SEED_SCORING_POLICY.energy.sameElementAdjustment, -5);
  assert.equal(
    SEED_SCORING_POLICY.reviewWarnings[0].status,
    'expert-review-required',
  );
  assert.ok(Object.isFrozen(SEED_SCORING_POLICY));
  assert.ok(Object.isFrozen(SEED_SCORING_POLICY.energy));
  assert.ok(Object.isFrozen(SEED_SCORING_POLICY.reviewWarnings));
  assert.ok(Object.isFrozen(SEED_SCORING_POLICY.reviewWarnings[0]));
});

test('v1 policy preserves the representative enabled-component total exactly', () => {
  const result = new SeedTs().analyze({
    lastName: [entry('\uAE40', '\u91D1', 8, true)],
    firstName: [
      entry('\uBBFC', '\u73C9', 9, false),
      entry('\uC900', '\u4FCA', 9, false),
    ],
    birthDateTime: {
      year: 1990,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
      calendarType: 'solar',
    },
    gender: 'neutral',
    options: { pureHangulNameMode: 'off' },
  });
  const candidate = result.candidates[0];

  assert.equal(candidate.hangul.getScore(), 68.33333333333334);
  assert.equal(candidate.hanja.getScore(), 63.333333333333336);
  assert.equal(candidate.fourFrames.getScore(), 80);
  assert.equal(candidate.totalScore, 70.55555555555556);
});
