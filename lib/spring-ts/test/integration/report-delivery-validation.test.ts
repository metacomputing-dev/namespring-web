import assert from 'node:assert/strict';
import {
  REPORT_DELIVERY_REQUEST_SCHEMA_V1,
  CandidateSearchContractErrorV1,
  ReportDeliveryRequestValidationError,
  SpringEngine,
  validateReportDeliveryRequestV1,
  validateReportDeliverySelectionV1,
} from '../../src/index.js';

function invalid(value: unknown, reason: string): void {
  assert.throws(
    () => validateReportDeliverySelectionV1(value),
    (error: unknown) => error instanceof ReportDeliveryRequestValidationError
      && error.reason === reason,
  );
}

invalid({
  schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
  surfaces: [{ id: 'integrated', depth: 'expert' }],
}, 'UNSUPPORTED_SELECTION');

invalid({
  schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
  surfaces: [{ id: 'naming', depth: 'standard', timeline: { periods: ['today'], categories: ['overall'] } }],
}, 'UNKNOWN_FIELD');

assert.throws(
  () => validateReportDeliveryRequestV1({
    birth: { year: 2026, month: 2, day: 31, gender: 'neutral' },
    delivery: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{ id: 'saju', depth: 'brief' }],
    },
  }),
  (error: unknown) => error instanceof ReportDeliveryRequestValidationError
    && error.reason === 'INVALID_SHAPE',
  'impossible solar dates fail before astronomy work',
);

assert.throws(
  () => validateReportDeliveryRequestV1({
    birth: { year: 1986, month: 4, day: 19, gender: 'male' },
    options: { precisionConfig: { typoFlag: true } },
    delivery: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{ id: 'saju', depth: 'brief' }],
    },
  } as any),
  (error: unknown) => error instanceof ReportDeliveryRequestValidationError
    && error.reason === 'UNKNOWN_FIELD',
  'unknown local precision flags fail closed instead of being ignored',
);

assert.throws(
  () => validateReportDeliveryRequestV1({
    birth: { year: 1986, month: 4, day: 19, gender: 'male' },
    options: { precisionConfig: { lunarConversionSource: ['builtin'] } },
    delivery: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{ id: 'saju', depth: 'brief' }],
    },
  } as any),
  (error: unknown) => error instanceof ReportDeliveryRequestValidationError
    && error.reason === 'INVALID_SHAPE',
  'enum-like arrays must not pass through string coercion',
);

assert.throws(
  () => validateReportDeliveryRequestV1({
    birth: { year: 1986, month: 4, day: 19, gender: 'male' },
    surname: [{ hangul: '김', hanja: '金', strokes: '8', legalRegistrable: 'yes' }],
    delivery: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{ id: 'integrated', depth: 'brief' }],
    },
  } as any),
  (error: unknown) => error instanceof ReportDeliveryRequestValidationError
    && error.reason === 'UNKNOWN_FIELD',
  'report identity accepts only Hangul/Hanja; canonical derived metadata is engine-owned',
);

const reportRequestForName = (
  surname: readonly Record<string, unknown>[],
  givenName: readonly Record<string, unknown>[],
  pureHangulNameMode?: 'auto' | 'on' | 'off',
) => ({
  birth: { year: 1986, month: 4, day: 19, gender: 'male' },
  surname,
  givenName,
  ...(pureHangulNameMode === undefined ? {} : { options: { pureHangulNameMode } }),
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'integrated', depth: 'brief' }],
  },
});

assert.doesNotThrow(() => validateReportDeliveryRequestV1(reportRequestForName(
  [{ hangul: '김' }],
  [{ hangul: '하' }, { hangul: '늘' }],
)), 'a complete pure-Hangul identity is explicit and valid in auto mode');
for (const givenName of [
  [{ hangul: '민', hanja: '珉' }, { hangul: '준', hanja: '俊' }, { hangul: '서', hanja: '瑞' }],
  [
    { hangul: '민', hanja: '珉' }, { hangul: '준', hanja: '俊' },
    { hangul: '서', hanja: '瑞' }, { hangul: '윤', hanja: '允' },
  ],
]) {
  assert.doesNotThrow(() => validateReportDeliveryRequestV1(reportRequestForName(
    [{ hangul: '김', hanja: '金' }],
    givenName,
  )), `explicit ${givenName.length}-syllable all-Hanja analysis remains valid`);
}

for (const [request, reason, label] of [
  [reportRequestForName(
    [{ hangul: '김', hanja: '金' }],
    [{ hangul: '하', hanja: '河' }, { hangul: '늘' }],
  ), 'PARTIAL_HANJA_IDENTITY', 'partial given-name Hanja'],
  [reportRequestForName(
    [{ hangul: '남', hanja: '南' }, { hangul: '궁' }],
    [{ hangul: '민', hanja: '珉' }],
  ), 'PARTIAL_HANJA_IDENTITY', 'partial compound-surname Hanja'],
  [reportRequestForName(
    [{ hangul: '김', hanja: '金' }],
    [{ hangul: '하', hanja: '河' }, { hangul: '늘', hanja: '訥' }],
    'on',
  ), 'PURE_HANGUL_MODE_CONFLICT', 'explicit Hanja in pure-Hangul mode'],
  [reportRequestForName(
    [{ hangul: '김' }],
    [{ hangul: '하' }, { hangul: '늘' }],
    'off',
  ), 'PURE_HANGUL_MODE_DISABLED', 'pure-Hangul identity with that mode disabled'],
] as const) {
  assert.throws(
    () => validateReportDeliveryRequestV1(request),
    (error: unknown) => error instanceof ReportDeliveryRequestValidationError
      && error.reason === reason,
    `${label} must fail at the bounded outer contract with a recoverable reason`,
  );
}

invalid({
  schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
  surfaces: [{ id: 'saju', depth: 'brief' }, { id: 'saju', depth: 'standard' }],
}, 'DUPLICATE_SELECTION');

invalid({
  schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
  surfaces: [{
    id: 'integrated',
    depth: 'standard',
    timeline: {
      periods: ['today', 'thisWeek', 'thisMonth', 'thisYear'],
      categories: ['overall', 'wealth', 'health', 'academic', 'romance', 'family'],
    },
  }],
}, 'REQUEST_COST_EXCEEDED');

invalid({
  schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
  surfaces: [{ id: 'integrated', depth: 'brief', unexpected: true }],
}, 'UNKNOWN_FIELD');

// Selection validation must happen before engine initialization or any I/O.
const engine = new SpringEngine() as any;
let beginOperationCalls = 0;
engine.beginOperation = () => {
  beginOperationCalls += 1;
  throw new Error('beginOperation must not run for invalid delivery selection');
};
await assert.rejects(
  engine.getReportDelivery({
    birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
    delivery: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{ id: 'integrated', depth: 'expert' }],
    },
  }),
  (error: unknown) => error instanceof ReportDeliveryRequestValidationError
    && error.reason === 'UNSUPPORTED_SELECTION',
);
assert.equal(beginOperationCalls, 0);

await assert.rejects(
  engine.getReportDelivery({
    birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
    targetDate: '1986-04-18',
    delivery: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{ id: 'saju', depth: 'brief' }],
    },
  }),
  (error: unknown) => error instanceof ReportDeliveryRequestValidationError
    && error.reason === 'INVALID_SHAPE',
  'a pre-birth fortune date fails before engine initialization',
);
assert.equal(beginOperationCalls, 0, 'semantic target-date validation runs before engine work');

await assert.rejects(
  engine.getReportDelivery({
    birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
    options: { precisionConfig: { lunarConversionSource: 'kasi' } },
    delivery: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{ id: 'saju', depth: 'brief' }],
    },
  } as any),
  (error: unknown) => error instanceof ReportDeliveryRequestValidationError
    && error.reason === 'UNSUPPORTED_SELECTION',
  'free report delivery must reject remote lunar conversion before engine work',
);
assert.equal(beginOperationCalls, 0, 'remote report computation is rejected before engine work');

await assert.rejects(
  engine.getCandidateSearch({
    birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
    surname: [{ hangul: '최', hanja: '崔' }],
    mode: 'recommend',
    options: { precisionConfig: { lunarConversionSource: 'kasi' } },
  }),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'REMOTE_COMPUTATION_FORBIDDEN',
  'free candidate search must reject remote lunar conversion before engine work',
);
assert.equal(beginOperationCalls, 0, 'remote candidate computation is rejected before engine work');

await assert.rejects(
  engine.getCandidateSearch({
    birth: { year: 1986, month: 4, day: 19, gender: 'male' },
    surname: [{ hangul: '김', hanja: '金' }],
    mode: 'recommend',
    options: { precisionConfig: { lunarConversionSource: ['builtin'] } },
  } as any),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'INVALID_ANALYSIS_OPTIONS',
  'candidate analysis options reject enum-like arrays before engine work',
);
await assert.rejects(
  engine.getCandidateSearch({
    birth: { year: 1986, month: 4, day: 19, gender: 'male' },
    surname: [{ hangul: '김', hanja: '金' }],
    mode: 'recommend',
    options: { sajuConfig: { remotePolicy: 'caller-controlled' } },
  } as any),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'INVALID_ANALYSIS_OPTIONS',
  'candidate clients cannot pass raw server-style saju configuration',
);
assert.equal(beginOperationCalls, 0, 'invalid candidate options fail before engine work');

const oversizedPrecisionConfig = Object.fromEntries(
  Array.from({ length: 2_100 }, (_, index) => [`key${index}`, true]),
);
await assert.rejects(
  engine.getReportDelivery({
    birth: { year: 1986, month: 4, day: 19, gender: 'male' },
    options: { precisionConfig: oversizedPrecisionConfig },
    delivery: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{ id: 'saju', depth: 'brief' }],
    },
  } as any),
  TypeError,
  'free report input has a small endpoint-specific snapshot budget',
);
await assert.rejects(
  engine.getCandidateSearch({
    birth: { year: 1986, month: 4, day: 19, gender: 'male' },
    surname: [{ hangul: '최', hanja: '崔' }],
    mode: 'recommend',
    options: { precisionConfig: oversizedPrecisionConfig },
  }),
  TypeError,
  'free candidate input has a small endpoint-specific snapshot budget',
);
assert.equal(beginOperationCalls, 0, 'oversized free inputs fail before engine work');

await assert.rejects(
  engine.getReportDelivery({
    birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
    surname: [{ hangul: '최', hanja: '崔' }],
    givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
    candidateId: `candidate_v1_${'0'.repeat(32)}`,
    delivery: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{ id: 'integrated', depth: 'brief' }],
    },
  }),
  (error: unknown) => error instanceof ReportDeliveryRequestValidationError
    && error.reason === 'CANDIDATE_ID_MISMATCH',
);
assert.equal(beginOperationCalls, 0, 'candidate mismatch fails before engine work');

await assert.rejects(
  engine.getCandidateSearch({
    birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
    surname: [{ hangul: '최', hanja: '崔' }],
    givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
    mode: 'evaluate',
  }),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'UNSUPPORTED_QUERY_MODE',
  'candidate search must not label explicit-name evaluation as a saju-guided recommendation',
);
assert.equal(beginOperationCalls, 0, 'unsupported candidate mode fails before engine work');

await assert.rejects(
  engine.getCandidateSearch({
    birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
    surname: [{ hangul: '최', hanja: '崔' }],
    mode: 'recommend',
    options: { offset: 20, limit: 20 },
  }),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'QUERY_ID_REQUIRED',
  'page 2 must not be recomputed without the original engine-session snapshot',
);

await assert.rejects(
  engine.getCandidateSearch({
    birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
    surname: [{ hangul: '최', hanja: '崔' }],
    givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
    mode: 'all',
  }),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'UNSUPPORTED_QUERY_MODE',
  'mixed original-plus-generated mode must not masquerade as recommendation-only output',
);

assert.throws(
  () => validateReportDeliveryRequestV1({
    birth: { year: 1986, month: 4, day: 19, gender: 'male' },
    targetdate: '2026-07-18',
    delivery: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{ id: 'saju', depth: 'brief' }],
    },
  }),
  (error: unknown) => error instanceof ReportDeliveryRequestValidationError
    && error.reason === 'UNKNOWN_FIELD',
  'outer request typos must not silently fall back to defaults',
);

console.log('Report delivery request validation: PASS');
