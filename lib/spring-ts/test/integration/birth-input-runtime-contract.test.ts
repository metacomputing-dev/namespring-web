import assert from 'node:assert/strict';

import { analyzeSajuSafe } from '../../src/saju-adapter.js';
import { validateBirthInputRuntimeContract } from '../../src/saju/birth-input-contract.js';
import type {
  BirthInfo,
  SajuAnalysisReasonCode,
} from '../../src/types.js';

const validBirth: BirthInfo = {
  year: 2025,
  month: 6,
  day: 1,
  hour: 9,
  minute: 30,
  gender: 'female',
  calendarType: 'solar',
  timezone: 'Asia/Seoul',
};

assert.equal(validateBirthInputRuntimeContract(validBirth), null);
assert.equal(validateBirthInputRuntimeContract({
  year: 2025,
  month: null,
  day: null,
  hour: null,
  minute: null,
  gender: 'neutral',
}), null);

const invalidCases: ReadonlyArray<{
  readonly label: string;
  readonly birth: unknown;
  readonly reasonCode: SajuAnalysisReasonCode;
  readonly rawMarker?: string;
  readonly forbiddenMessageMarker?: string;
}> = [
  {
    label: 'numeric-string date',
    birth: { ...validBirth, year: '2025', month: '6', day: '1' },
    reasonCode: 'BIRTH_DATE_INVALID',
    rawMarker: '2025',
  },
  {
    label: 'boolean date',
    birth: { ...validBirth, month: true, day: true },
    reasonCode: 'BIRTH_DATE_INVALID',
  },
  {
    label: 'numeric-string lunar date',
    birth: {
      ...validBirth,
      year: '2025',
      calendarType: 'lunar',
      isLeapMonth: false,
    },
    reasonCode: 'BIRTH_DATE_INVALID',
    forbiddenMessageMarker: '양력',
  },
  {
    label: 'single-item array date',
    birth: { ...validBirth, year: [2025] },
    reasonCode: 'BIRTH_DATE_INVALID',
  },
  {
    label: 'numeric-string time',
    birth: { ...validBirth, hour: '9' },
    reasonCode: 'BIRTH_TIME_INVALID',
  },
  {
    label: 'missing gender',
    birth: { ...validBirth, gender: undefined },
    reasonCode: 'BIRTH_INPUT_INVALID',
  },
  {
    label: 'unknown gender',
    birth: { ...validBirth, gender: 'alien' },
    reasonCode: 'BIRTH_INPUT_INVALID',
    rawMarker: 'alien',
  },
  {
    label: 'unknown calendar type',
    birth: { ...validBirth, calendarType: 'LUNAR' },
    reasonCode: 'BIRTH_INPUT_INVALID',
    rawMarker: 'LUNAR',
  },
  {
    label: 'null calendar type',
    birth: { ...validBirth, calendarType: null },
    reasonCode: 'BIRTH_INPUT_INVALID',
  },
  {
    label: 'string leap-month flag',
    birth: {
      ...validBirth,
      calendarType: 'lunar',
      isLeapMonth: 'true',
    },
    reasonCode: 'BIRTH_INPUT_INVALID',
  },
  {
    label: 'null leap-month flag',
    birth: { ...validBirth, isLeapMonth: null },
    reasonCode: 'BIRTH_INPUT_INVALID',
  },
  {
    label: 'non-string region',
    birth: { ...validBirth, region: 123 },
    reasonCode: 'BIRTH_LOCATION_INVALID',
  },
  {
    label: 'non-string city',
    birth: { ...validBirth, city: true },
    reasonCode: 'BIRTH_LOCATION_INVALID',
  },
  {
    label: 'non-string birth place',
    birth: { ...validBirth, birthPlace: {} },
    reasonCode: 'BIRTH_LOCATION_INVALID',
  },
  {
    label: 'numeric-string coordinate',
    birth: { ...validBirth, latitude: '37.5', longitude: 127 },
    reasonCode: 'BIRTH_LOCATION_INVALID',
  },
  {
    label: 'non-string name',
    birth: { ...validBirth, name: ['unsafe'] },
    reasonCode: 'BIRTH_INPUT_INVALID',
    rawMarker: 'unsafe',
  },
  {
    label: 'non-object birth root',
    birth: [],
    reasonCode: 'BIRTH_INPUT_INVALID',
  },
];

for (const testCase of invalidCases) {
  assert.equal(
    validateBirthInputRuntimeContract(testCase.birth),
    testCase.reasonCode,
    `${testCase.label}: direct contract`,
  );

  const result = await analyzeSajuSafe(testCase.birth as BirthInfo);
  assert.equal(result.sajuEnabled, false, `${testCase.label}: disabled`);
  assert.equal(result.analysisStatus, 'failed', `${testCase.label}: status`);
  assert.equal(
    result.diagnostics?.[0]?.reasonCode,
    testCase.reasonCode,
    `${testCase.label}: reason code`,
  );
  if (testCase.rawMarker) {
    assert.equal(
      result.diagnostics?.[0]?.message.includes(testCase.rawMarker),
      false,
      `${testCase.label}: raw value is not exposed`,
    );
  }
  if (testCase.forbiddenMessageMarker) {
    assert.equal(
      result.diagnostics?.[0]?.message.includes(testCase.forbiddenMessageMarker),
      false,
      `${testCase.label}: diagnostic remains calendar-neutral`,
    );
  }
}

const validResult = await analyzeSajuSafe(validBirth);
assert.equal(validResult.sajuEnabled, true);

const neutralResult = await analyzeSajuSafe({
  ...validBirth,
  gender: 'neutral',
});
assert.equal(neutralResult.sajuEnabled, true);

const noPartsResult = await analyzeSajuSafe({ gender: 'neutral' });
assert.equal(noPartsResult.analysisStatus, 'partial');
assert.equal(noPartsResult.diagnostics?.[0]?.reasonCode, 'BIRTH_INPUT_INSUFFICIENT');

const partialLunarResult = await analyzeSajuSafe({
  year: 2025,
  month: null,
  day: null,
  gender: 'female',
  calendarType: 'lunar',
});
assert.equal(partialLunarResult.analysisStatus, 'partial');
assert.equal(partialLunarResult.diagnostics?.[0]?.reasonCode, 'LUNAR_INPUT_INSUFFICIENT');

const unknownHourResult = await analyzeSajuSafe({
  ...validBirth,
  hour: null,
  minute: null,
});
assert.equal(unknownHourResult.sajuEnabled, true);

console.log(`Birth input runtime contract: ${invalidCases.length + 7} scenarios PASS`);
