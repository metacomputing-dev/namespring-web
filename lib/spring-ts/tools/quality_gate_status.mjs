export function classifyDimensionAggregate({ pass, fail, na }) {
  if (fail > 0) return 'FAIL';
  if (pass > 0 && na > 0) return 'PARTIAL';
  if (pass > 0) return 'PASS';
  return 'N/A';
}

export function classifyGateOverall({
  sourceTierStatus,
  totalFailures,
  dimensionStatuses,
}) {
  if (
    sourceTierStatus === 'FAIL' ||
    totalFailures > 0 ||
    dimensionStatuses.some((status) => status === 'FAIL')
  ) {
    return 'FAIL';
  }

  if (
    dimensionStatuses.length === 0 ||
    dimensionStatuses.every((status) => status === 'N/A')
  ) {
    return 'N/A';
  }

  if (dimensionStatuses.every((status) => status === 'PASS')) {
    return 'PASS';
  }

  return 'PARTIAL';
}

export function qualityGateExitCode(overall, { requireComplete = false } = {}) {
  if (overall === 'FAIL') return 1;
  if (requireComplete && overall !== 'PASS') return 1;
  return 0;
}
