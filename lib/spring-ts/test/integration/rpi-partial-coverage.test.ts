import assert from 'node:assert/strict';
import { scoreAxisFromDimension } from '../../scripts/rpi-scoring.js';

const partial = scoreAxisFromDimension({
  dimensions: {
    D5: { pass: 8, fail: 0, na: 9, status: 'PARTIAL' },
  },
}, 'D5', 15, 'not measured');
assert.equal(partial.status, 'PARTIAL');
assert.equal(partial.score, 7.06);
assert.equal(partial.coverageRate, 47.1);

const complete = scoreAxisFromDimension({
  dimensions: {
    D5: { pass: 17, fail: 0, na: 0, status: 'PASS' },
  },
}, 'D5', 15, 'not measured');
assert.equal(complete.status, 'PASS');
assert.equal(complete.score, 15);

const unavailable = scoreAxisFromDimension({
  dimensions: {
    D5: { pass: 0, fail: 0, na: 17, status: 'N/A' },
  },
}, 'D5', 15, 'not measured');
assert.equal(unavailable.status, 'NOT_MEASURED');
assert.equal(unavailable.score, 0);

console.log('RPI partial coverage scoring: PASS');
