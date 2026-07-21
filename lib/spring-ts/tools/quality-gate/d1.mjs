import {
  AUTHORITY_SCOPES,
  authorityTruthForScope,
} from './authority-context.mjs';
import {
  gyeokgukTypeMatches,
  isAllowedField,
  strengthLevelMatches,
} from './shared.mjs';

const D1_TOTALSCORE_TOLERANCE = 2.0;
const D1_INDIVIDUAL_SCORE_TOLERANCE = 1.0;

export const D1_REQUIRED_DOCTRINE_FIELDS = Object.freeze([
  'sajuReport.gyeokgukType',
  'sajuReport.yongshinElement',
  'sajuReport.strengthLevel',
]);

export const D1_REQUIRED_NAMING_FIELDS = Object.freeze([
  'namingReport.totalScore',
  'namingReport.scores.hangul',
  'namingReport.scores.hanja',
  'namingReport.scores.fourFrame',
]);

export function classifyD1TruthCoverage(authorityCase, oracleCase, options = {}) {
  const authorityDoctrineTruth = authorityTruthForScope(
    authorityCase,
    AUTHORITY_SCOPES.SAJU_DOCTRINE,
    options,
  ) ? authorityCase : null;
  const oracleDoctrineTruth = authorityTruthForScope(
    oracleCase,
    AUTHORITY_SCOPES.SAJU_DOCTRINE,
    options,
  ) ? oracleCase : null;
  const authorityNamingTruth = authorityTruthForScope(
    authorityCase,
    AUTHORITY_SCOPES.NAMING_SCORE_CALIBRATION,
    options,
  ) ? authorityCase : null;
  const oracleNamingTruth = authorityTruthForScope(
    oracleCase,
    AUTHORITY_SCOPES.NAMING_SCORE_CALIBRATION,
    options,
  ) ? oracleCase : null;

  const authorityDoctrineFields = [
    { field: 'sajuReport.gyeokgukType', expected: authorityDoctrineTruth?.expected?.gyeokguk },
    { field: 'sajuReport.yongshinElement', expected: authorityDoctrineTruth?.expected?.yongshinElement },
    { field: 'sajuReport.strengthLevel', expected: authorityDoctrineTruth?.expected?.strengthLevel },
  ];
  const oracleDoctrineFields = [
    { field: 'sajuReport.gyeokgukType', expected: oracleDoctrineTruth?.expected?.gyeokgukType },
    { field: 'sajuReport.yongshinElement', expected: oracleDoctrineTruth?.expected?.yongshinElement },
    { field: 'sajuReport.strengthLevel', expected: oracleDoctrineTruth?.expected?.strengthLevel },
  ];

  const doctrineFields = [];
  for (const field of authorityDoctrineFields) {
    if (field.expected === undefined || field.expected === null) continue;
    doctrineFields.push({ ...field, source: 'authority' });
  }
  for (const field of oracleDoctrineFields) {
    const authorityPreempts = authorityDoctrineFields.some(
      (candidate) => candidate.field === field.field && candidate.expected !== undefined,
    );
    if (authorityPreempts || field.expected === undefined || field.expected === null) continue;
    doctrineFields.push({ ...field, source: 'oracle' });
  }

  const namingTruth = authorityNamingTruth ?? oracleNamingTruth;
  const expectedNumerical = namingTruth?.expected?.scores;
  const namingFields = [];
  if (
    namingTruth?.expected?.totalScore !== undefined ||
    expectedNumerical !== undefined
  ) {
    const totalScoreFromAuthority = authorityNamingTruth?.expected?.totalScore;
    const totalScoreFromOracle = oracleNamingTruth?.expected?.totalScore;
    const rawNamingFields = [
      {
        field: 'namingReport.totalScore',
        expected: totalScoreFromAuthority ?? totalScoreFromOracle,
        source: totalScoreFromAuthority != null ? 'authority' : 'oracle',
        tolerance: D1_TOTALSCORE_TOLERANCE,
      },
      {
        field: 'namingReport.scores.hangul',
        expected: expectedNumerical?.hangul,
        source: namingTruth === authorityNamingTruth ? 'authority' : 'oracle',
        tolerance: D1_INDIVIDUAL_SCORE_TOLERANCE,
      },
      {
        field: 'namingReport.scores.hanja',
        expected: expectedNumerical?.hanja,
        source: namingTruth === authorityNamingTruth ? 'authority' : 'oracle',
        tolerance: D1_INDIVIDUAL_SCORE_TOLERANCE,
      },
      {
        field: 'namingReport.scores.fourFrame',
        expected: expectedNumerical?.fourFrame,
        source: namingTruth === authorityNamingTruth ? 'authority' : 'oracle',
        tolerance: D1_INDIVIDUAL_SCORE_TOLERANCE,
      },
    ];
    namingFields.push(...rawNamingFields.filter(
      (field) => field.expected !== undefined && field.expected !== null,
    ));
  }

  const coveredFields = new Set([
    ...doctrineFields.map((field) => field.field),
    ...namingFields.map((field) => field.field),
  ]);
  const missingRequiredFields = [
    ...D1_REQUIRED_DOCTRINE_FIELDS.filter((field) => !coveredFields.has(field)),
    ...D1_REQUIRED_NAMING_FIELDS.filter((field) => !coveredFields.has(field)),
  ];

  return {
    complete: missingRequiredFields.length === 0,
    missingRequiredFields,
    doctrineFields,
    namingFields,
    authorityDoctrineTruth,
    oracleDoctrineTruth,
    authorityNamingTruth,
    oracleNamingTruth,
  };
}

export function evaluateD1(fixture, snapshotResult, authorityCase, oracleCase, options = {}) {
  const coverage = classifyD1TruthCoverage(authorityCase, oracleCase, options);
  const doctrineChecks = [];
  const namingChecks = [];
  const allowed = fixture.allowedDiff || [];
  const sajuActual = snapshotResult.output.sajuReport || {};
  const namingActual = snapshotResult.output.namingReport || {};
  const actualByField = {
    'sajuReport.gyeokgukType': sajuActual.gyeokgukType,
    'sajuReport.yongshinElement': sajuActual.yongshinElement,
    'sajuReport.strengthLevel': sajuActual.strengthLevel,
    'namingReport.totalScore': namingActual.totalScore,
    'namingReport.scores.hangul': namingActual.scores?.hangul,
    'namingReport.scores.hanja': namingActual.scores?.hanja,
    'namingReport.scores.fourFrame': namingActual.scores?.fourFrame,
  };

  for (const field of coverage.doctrineFields) {
    const check = {
      field: field.field,
      actual: actualByField[field.field],
      expected: field.expected,
    };
    const pass = field.field === 'sajuReport.strengthLevel'
      ? strengthLevelMatches(check.actual, check.expected)
      : field.field === 'sajuReport.gyeokgukType'
        ? gyeokgukTypeMatches(check.actual, check.expected)
        : check.actual === check.expected;
    doctrineChecks.push({
      ...check,
      pass,
      ...(isAllowedField(allowed, field.field) ? { declaredDiff: true } : {}),
      ...(field.source === 'oracle' ? { source: 'oracle' } : {}),
    });
  }

  for (const field of coverage.namingFields) {
    const actual = actualByField[field.field];
    if (typeof actual !== 'number' || !Number.isFinite(actual)) {
      namingChecks.push({
        field: field.field,
        actual,
        expected: field.expected,
        diff: null,
        tol: field.tolerance,
        pass: false,
        reason: 'authority expected a finite numerical field but actual output is missing or non-numeric',
      });
      continue;
    }
    if (typeof field.expected !== 'number' || !Number.isFinite(field.expected)) {
      namingChecks.push({
        field: field.field,
        actual,
        expected: field.expected,
        diff: null,
        tol: field.tolerance,
        pass: false,
        reason: 'authority numerical truth must itself be a finite number',
      });
      continue;
    }
    const diff = Math.abs(actual - field.expected);
    namingChecks.push({
      field: field.field,
      actual,
      expected: field.expected,
      diff,
      tol: field.tolerance,
      pass: diff <= field.tolerance,
      ...(isAllowedField(allowed, field.field) ? { declaredDiff: true } : {}),
    });
  }

  const checks = [...doctrineChecks, ...namingChecks];
  if (checks.length === 0) {
    return { dimension: 'D1', status: 'N/A', reason: 'no authority-truth-eligible reference data for this fixture' };
  }

  const failed = checks.filter((check) => !check.pass);
  const missingRequiredFields = coverage.missingRequiredFields;
  const missingDoctrineFields = missingRequiredFields
    .filter((field) => field.startsWith('sajuReport.'));
  const missingNamingFields = missingRequiredFields
    .filter((field) => field.startsWith('namingReport.'));
  const missingComponents = [
    ...(doctrineChecks.length === 0 ? ['saju_doctrine'] : []),
    ...(namingChecks.length === 0 ? ['naming_score_calibration'] : []),
  ];
  const status = failed.length > 0
    ? 'FAIL'
    : missingRequiredFields.length > 0
      ? 'N/A'
      : 'PASS';
  return {
    dimension: 'D1',
    status,
    componentStatus: {
      sajuDoctrine: doctrineChecks.length === 0
        ? 'N/A'
        : doctrineChecks.some((check) => !check.pass)
          ? 'FAIL'
          : missingDoctrineFields.length > 0 ? 'N/A' : 'PASS',
      namingScoreCalibration: namingChecks.length === 0
        ? 'N/A'
        : namingChecks.some((check) => !check.pass)
          ? 'FAIL'
          : missingNamingFields.length > 0 ? 'N/A' : 'PASS',
    },
    missingComponents,
    missingRequiredFields,
    ...(missingRequiredFields.length > 0 && failed.length === 0
      ? { reason: 'D1 is incomplete until every required doctrine and naming-score field is measured' }
      : {}),
    checks,
    failedCount: failed.length,
    totalChecks: checks.length,
  };
}
