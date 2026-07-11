import assert from 'node:assert/strict';

import { HangulCalculator } from '../../src/calculator/hangul-calculator.js';
import type { EvalContext } from '../../src/core/evaluator.js';
import { SpringEngine } from '../../src/spring-engine.js';

const context: EvalContext = {
  surnameLength: 1,
  givenLength: 2,
  luckyMap: new Map(),
  insights: {
    HANGUL_ELEMENT: {
      frame: 'HANGUL_ELEMENT',
      score: 80,
      isPassed: true,
      label: 'fixture',
      details: {},
    },
    HANGUL_POLARITY: {
      frame: 'HANGUL_POLARITY',
      score: 70,
      isPassed: true,
      label: 'fixture',
      details: {},
    },
  },
};

function signalWeights(signalCap?: number): readonly number[] {
  const calculator = signalCap === undefined
    ? new HangulCalculator([], [])
    : new HangulCalculator([], [], signalCap);
  return calculator.backward(context).signals.map((signal) => signal.weight);
}

const defaultWeights = signalWeights();
const fullWeights = signalWeights(1);

assert.deepEqual(
  defaultWeights,
  fullWeights,
  'the default signal cap must remain equivalent to the explicit 1.0 contract',
);
assert.deepEqual(
  signalWeights(0),
  defaultWeights.map(() => 0),
  'an explicit zero cap must disable both Hangul signal contributions',
);
assert.deepEqual(
  signalWeights(0.5),
  defaultWeights.map((weight) => weight * 0.5),
  'a fractional cap must scale both Hangul signal contributions proportionally',
);
assert.deepEqual(signalWeights(Number.NaN), defaultWeights, 'NaN must fall back to the default cap');
assert.deepEqual(signalWeights(-1), defaultWeights.map(() => 0), 'negative caps must clamp to zero');
assert.deepEqual(signalWeights(2), fullWeights, 'caps above one must clamp to one');

const engine = new SpringEngine() as unknown as {
  resolveHangulSignalCap(options?: unknown): number;
};

assert.equal(engine.resolveHangulSignalCap(), 1, 'SpringEngine must default the cap to one');
assert.equal(
  engine.resolveHangulSignalCap({ precisionConfig: { pureHangulSignalCap: 0 } }),
  0,
  'SpringEngine configuration explicitly permits zero',
);
assert.equal(
  engine.resolveHangulSignalCap({ precisionConfig: { pureHangulSignalCap: 0.5 } }),
  0.5,
);
assert.equal(
  engine.resolveHangulSignalCap({ precisionConfig: { pureHangulSignalCap: 1 } }),
  1,
);
assert.equal(
  engine.resolveHangulSignalCap({ precisionConfig: { pureHangulSignalCap: -1 } }),
  0,
  'SpringEngine must clamp values below zero',
);
assert.equal(
  engine.resolveHangulSignalCap({ precisionConfig: { pureHangulSignalCap: 2 } }),
  1,
  'SpringEngine must clamp values above one',
);

console.log('Hangul signal cap: zero/fraction/full/default/invalid boundaries PASS');
