import assert from 'node:assert/strict';

import {
  FOURFRAME_CONTRACT_INVALID,
  FOURFRAME_EXPECTED_RECORD_COUNT,
  FourFrameContractError,
  compileFourFrameContract,
} from '../../src/fourframe-contract.js';
import {
  makeFourFrameRecord,
  makeValidFourFrameRecords,
} from '../helpers/fourframe-fixtures.js';

function captureContractError(records: ReturnType<typeof makeValidFourFrameRecords>): FourFrameContractError {
  try {
    compileFourFrameContract(records);
    assert.fail('Expected four-frame contract compilation to fail.');
  } catch (error) {
    assert.ok(error instanceof FourFrameContractError);
    assert.equal(error.code, FOURFRAME_CONTRACT_INVALID);
    return error;
  }
}

function issueCodes(error: FourFrameContractError): string[] {
  return error.issues.map((issue) => issue.code);
}

const valid = makeValidFourFrameRecords();
const compiled = compileFourFrameContract(valid);
assert.equal(compiled.recordsByNumber.size, FOURFRAME_EXPECTED_RECORD_COUNT);
assert.equal(compiled.luckyByNumber.size, FOURFRAME_EXPECTED_RECORD_COUNT);
assert.ok(compiled.favorableNumbers.size > 0);
assert.equal(compiled.recordsByNumber.get(1)?.title, 'Frame 1');
assert.equal(compiled.recordsByNumber.get(81)?.summary, 'Summary 81');

const empty = captureContractError([]);
assert.deepEqual(issueCodes(empty), ['EMPTY_DATASET']);

const missingNumber = captureContractError(valid.slice(0, -1));
assert.ok(issueCodes(missingNumber).includes('UNEXPECTED_RECORD_COUNT'));
assert.deepEqual(
  missingNumber.issues.find((issue) => issue.code === 'MISSING_NUMBERS'),
  { code: 'MISSING_NUMBERS', numbers: [81] },
);

const duplicateNumber = captureContractError([
  ...valid.slice(0, -1),
  makeFourFrameRecord(1, { id: 999 }),
]);
assert.ok(issueCodes(duplicateNumber).includes('DUPLICATE_NUMBER'));
assert.deepEqual(
  duplicateNumber.issues.find((issue) => issue.code === 'MISSING_NUMBERS'),
  { code: 'MISSING_NUMBERS', numbers: [81] },
);

const missingFields = captureContractError([
  makeFourFrameRecord(1, { title: ' ', summary: '', lucky_level: null }),
  ...valid.slice(1),
]);
const missingFieldNames = missingFields.issues
  .filter((issue) => issue.code === 'MISSING_REQUIRED_FIELD')
  .map((issue) => issue.field)
  .sort();
assert.deepEqual(missingFieldNames, ['lucky_level', 'summary', 'title']);

const invalidLucky = captureContractError([
  makeFourFrameRecord(1, { lucky_level: 'UNRECOGNIZED' }),
  ...valid.slice(1),
]);
assert.ok(issueCodes(invalidLucky).includes('INVALID_LUCKY_LEVEL'));

const outOfRange = captureContractError([
  ...valid.slice(0, -1),
  makeFourFrameRecord(82),
]);
assert.ok(issueCodes(outOfRange).includes('INVALID_NUMBER'));
assert.ok(issueCodes(outOfRange).includes('MISSING_NUMBERS'));

console.log('Four-frame contract: valid/empty/missing/duplicate/required-fields/lucky/range PASS');
