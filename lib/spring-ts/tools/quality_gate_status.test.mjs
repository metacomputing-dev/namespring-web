import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyDimensionAggregate,
  classifyGateOverall,
  qualityGateExitCode,
} from './quality_gate_status.mjs';

test('dimension aggregation reports mixed PASS and N/A as PARTIAL', () => {
  assert.equal(classifyDimensionAggregate({ pass: 12, fail: 0, na: 5 }), 'PARTIAL');
  assert.equal(classifyDimensionAggregate({ pass: 8, fail: 0, na: 9 }), 'PARTIAL');
  assert.equal(classifyDimensionAggregate({ pass: 17, fail: 0, na: 0 }), 'PASS');
  assert.equal(classifyDimensionAggregate({ pass: 0, fail: 0, na: 17 }), 'N/A');
  assert.equal(classifyDimensionAggregate({ pass: 16, fail: 1, na: 0 }), 'FAIL');
});

test('out-of-scope fixtures (notApplicable) do not block a dimension PASS', () => {
  // D5 semantics: non-edge fixtures are out of scope by design. A dimension
  // that measured every in-scope fixture and passed is PASS, not PARTIAL.
  assert.equal(
    classifyDimensionAggregate({ pass: 14, fail: 0, na: 0, notApplicable: 3 }),
    'PASS',
  );
  // Missing measurements (na) keep blocking even when out-of-scope rows exist.
  assert.equal(
    classifyDimensionAggregate({ pass: 12, fail: 0, na: 2, notApplicable: 3 }),
    'PARTIAL',
  );
  // A failure always dominates.
  assert.equal(
    classifyDimensionAggregate({ pass: 13, fail: 1, na: 0, notApplicable: 3 }),
    'FAIL',
  );
  // A dimension whose fixtures are all out of scope carries no signal.
  assert.equal(
    classifyDimensionAggregate({ pass: 0, fail: 0, na: 0, notApplicable: 17 }),
    'N/A',
  );
  // Missing counts default to zero (backward-compatible call sites).
  assert.equal(classifyDimensionAggregate({ pass: 17, fail: 0, na: 0 }), 'PASS');
});

test('reports PASS only when every requested dimension is measured and passes', () => {
  assert.equal(
    classifyGateOverall({
      sourceTierStatus: 'PASS',
      totalFailures: 0,
      dimensionStatuses: ['PASS', 'PASS', 'PASS'],
    }),
    'PASS',
  );
});

test('reports PARTIAL when passing dimensions coexist with unmeasured dimensions', () => {
  assert.equal(
    classifyGateOverall({
      sourceTierStatus: 'PASS',
      totalFailures: 0,
      dimensionStatuses: ['N/A', 'PASS', 'N/A'],
    }),
    'PARTIAL',
  );
});

test('reports N/A when no requested dimension is measured', () => {
  assert.equal(
    classifyGateOverall({
      sourceTierStatus: 'PASS',
      totalFailures: 0,
      dimensionStatuses: ['N/A', 'N/A'],
    }),
    'N/A',
  );
});

test('fails closed on any source, fixture, or dimension failure', () => {
  assert.equal(
    classifyGateOverall({
      sourceTierStatus: 'FAIL',
      totalFailures: 0,
      dimensionStatuses: ['PASS'],
    }),
    'FAIL',
  );
  assert.equal(
    classifyGateOverall({
      sourceTierStatus: 'PASS',
      totalFailures: 1,
      dimensionStatuses: ['PASS'],
    }),
    'FAIL',
  );
  assert.equal(
    classifyGateOverall({
      sourceTierStatus: 'PASS',
      totalFailures: 0,
      dimensionStatuses: ['PASS', 'FAIL'],
    }),
    'FAIL',
  );
});

test('release mode rejects PARTIAL and N/A reports', () => {
  assert.equal(qualityGateExitCode('PASS', { requireComplete: true }), 0);
  assert.equal(qualityGateExitCode('PARTIAL', { requireComplete: true }), 1);
  assert.equal(qualityGateExitCode('N/A', { requireComplete: true }), 1);
  assert.equal(qualityGateExitCode('FAIL', { requireComplete: true }), 1);
  assert.equal(qualityGateExitCode('PARTIAL'), 0);
});
