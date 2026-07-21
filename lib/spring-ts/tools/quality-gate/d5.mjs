import { evaluateD1 } from './d1.mjs';

const D5_EDGE_AXIS_PATTERNS = [
  /^jonggyeok/i,
  /^jonggwang/i,
  /^jaza-edge$/i,
  /^johu-/i,
  /^unknown-hour$/i,
  /^borderline-strength$/i,
  /^strength-direction$/i,
  /^jie-/i,
  /^yaza-window$/i,
  /^lunar-input$/i,
];

function isEdgeFixture(fixture) {
  const axes = Array.isArray(fixture.axis) ? fixture.axis : [];
  return axes.some((axis) => D5_EDGE_AXIS_PATTERNS.some((pattern) => pattern.test(String(axis))));
}

export function evaluateD5(fixture, snapshotResult, authorityCase, oracleCase, options = {}) {
  if (!isEdgeFixture(fixture)) {
    return {
      dimension: 'D5',
      status: 'NOT_APPLICABLE',
      stabilityStatus: 'NOT_APPLICABLE',
      accuracyStatus: 'NOT_APPLICABLE',
      reason: 'not an edge fixture (axis does not match D5 edge patterns)',
    };
  }

  const output = snapshotResult.output || {};
  const sajuReport = output.sajuReport || {};
  const namingReport = output.namingReport || {};
  const stabilityChecks = [
    { field: 'output present', pass: typeof snapshotResult.output === 'object' && snapshotResult.output !== null },
    { field: 'sajuReport present', pass: typeof output.sajuReport === 'object' && output.sajuReport !== null },
    { field: 'sajuEnabled defined', pass: sajuReport.sajuEnabled !== undefined },
    { field: 'namingReport present', pass: typeof output.namingReport === 'object' && output.namingReport !== null },
    { field: 'totalScore is finite number', pass: Number.isFinite(namingReport.totalScore) },
  ];

  if (sajuReport.sajuEnabled === true) {
    stabilityChecks.push({
      field: 'gyeokgukType surfaced when sajuEnabled',
      pass: typeof sajuReport.gyeokgukType === 'string' && sajuReport.gyeokgukType.length > 0,
    });
    stabilityChecks.push({
      field: 'strengthLevel surfaced when sajuEnabled',
      pass: typeof sajuReport.strengthLevel === 'string' && sajuReport.strengthLevel.length > 0,
    });
  }

  const failedStability = stabilityChecks.filter((check) => !check.pass);
  if (failedStability.length > 0) {
    return {
      dimension: 'D5',
      status: 'FAIL',
      stabilityStatus: 'FAIL',
      accuracyStatus: 'N/A',
      accuracyReason: 'stability prerequisite failed before truth comparison',
      checks: stabilityChecks,
      failedCount: failedStability.length,
      totalChecks: stabilityChecks.length,
      referenceRate: null,
    };
  }

  const accuracy = evaluateD1(
    fixture,
    snapshotResult,
    authorityCase,
    oracleCase,
    options,
  );
  if (accuracy.status === 'N/A') {
    return {
      dimension: 'D5',
      status: 'N/A',
      stabilityStatus: 'PASS',
      accuracyStatus: 'N/A',
      accuracyReason: accuracy.reason,
      checks: stabilityChecks,
      failedCount: 0,
      totalChecks: stabilityChecks.length,
      referenceRate: null,
    };
  }

  const referenceRate =
    (accuracy.totalChecks - accuracy.failedCount) / accuracy.totalChecks;
  return {
    dimension: 'D5',
    status: accuracy.status,
    stabilityStatus: 'PASS',
    accuracyStatus: accuracy.status,
    checks: stabilityChecks,
    accuracyChecks: accuracy.checks ?? [],
    failedCount: accuracy.failedCount,
    totalChecks: accuracy.totalChecks,
    referenceRate,
  };
}
