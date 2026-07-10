/**
 * Aggregate a dimension's per-fixture statuses.
 *
 * Inputs:
 *   pass / fail      — measured results.
 *   na               — "measurement missing" (reference data that should exist
 *                      but doesn't, e.g. authority truth or narrative golden
 *                      not yet captured). Still blocks a full PASS: mixing
 *                      PASS with N/A stays PARTIAL so release mode fails
 *                      closed on incomplete evidence.
 *   notApplicable    — "out of scope by design" (e.g. D5 on a non-edge
 *                      fixture). Does NOT block PASS: a dimension whose only
 *                      unmeasured fixtures are out-of-scope is fully measured.
 */
export function classifyDimensionAggregate({ pass = 0, fail = 0, na = 0, notApplicable = 0 } = {}) {
  if (fail > 0) return 'FAIL';
  if (pass > 0 && na > 0) return 'PARTIAL';
  if (pass > 0) return 'PASS';
  // pass === 0 && fail === 0: nothing measured — whether the remainder is
  // "missing measurement" (na) or "out of scope" (notApplicable), the
  // dimension carries no signal.
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
