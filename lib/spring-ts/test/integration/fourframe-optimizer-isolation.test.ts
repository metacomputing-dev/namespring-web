import assert from 'node:assert/strict';
import test from 'node:test';

import { FourFrameOptimizer } from '../../src/index.js';

function allFourFrameNumbers(): Set<number> {
  return new Set(Array.from({ length: 81 }, (_, index) => index + 1));
}

test('snapshots constructor policy and never exposes its cached Set', () => {
  const callerOwnedPolicy = allFourFrameNumbers();
  const optimizer = new FourFrameOptimizer(callerOwnedPolicy);

  callerOwnedPolicy.clear();

  const first = optimizer.getValidCombinations([10], 2);
  const expected = [...first];
  assert.equal(first.size, 900);
  assert.equal(expected[0], '1,1');
  assert.equal(expected.at(-1), '30,30');

  first.clear();
  first.add('poison');

  const second = optimizer.getValidCombinations([10], 2);
  assert.notStrictEqual(second, first);
  assert.deepEqual([...second], expected);
  assert.equal(second.has('poison'), false);

  second.delete('1,1');
  const third = optimizer.getValidCombinations([10], 2);
  assert.notStrictEqual(third, second);
  assert.deepEqual([...third], expected);
});

test('keeps the public mutable Set contract while isolating each caller', () => {
  const optimizer = new FourFrameOptimizer(allFourFrameNumbers());
  const first = optimizer.getValidCombinations([10], 1);
  const second = optimizer.getValidCombinations([10], 1);

  assert.ok(first instanceof Set);
  assert.ok(second instanceof Set);
  assert.notStrictEqual(first, second);
  assert.deepEqual([...first], [...second]);
});

test('preserves the documented name-length boundary', () => {
  const optimizer = new FourFrameOptimizer(allFourFrameNumbers());

  assert.throws(
    () => optimizer.getValidCombinations([10], 0),
    /unsupported name length: 0/,
  );
  assert.throws(
    () => optimizer.getValidCombinations([10], 5),
    /unsupported name length: 5/,
  );
});
