export interface DimensionAggregate {
  pass?: number;
  fail?: number;
  na?: number;
  notApplicable?: number;
  status?: string;
}

export function scoreAxisFromDimension(
  gate: { dimensions: Record<string, DimensionAggregate> },
  dimension: string,
  points: number,
  notMeasuredReason: string,
): Record<string, unknown> {
  const aggregate = gate.dimensions[dimension];
  const pass = aggregate?.pass ?? 0;
  const fail = aggregate?.fail ?? 0;
  const na = aggregate?.na ?? 0;
  const notApplicable = aggregate?.notApplicable ?? 0;
  const measured = pass + fail;
  const total = measured + na;
  if (!aggregate || measured === 0) {
    return {
      maxPoints: points,
      score: 0,
      status: 'NOT_MEASURED',
      reason: notMeasuredReason,
      pass,
      fail,
      na,
      notApplicable,
      coverageRate: total > 0 ? 0 : null,
    };
  }
  const score = total > 0 ? points * (pass / total) : 0;
  const status = fail > 0 ? 'FAIL' : na > 0 ? 'PARTIAL' : 'PASS';
  return {
    maxPoints: points,
    score: Number(score.toFixed(2)),
    status,
    pass,
    fail,
    na,
    notApplicable,
    coverageRate: total > 0 ? Number(((measured / total) * 100).toFixed(1)) : null,
  };
}

export function scoreAccuracyAxisFromDimension(
  gate: { dimensions: Record<string, DimensionAggregate> },
  dimension: string,
  points: number,
  insufficientTruthReason: string,
): Record<string, unknown> {
  const aggregate = gate.dimensions[dimension];
  const pass = aggregate?.pass ?? 0;
  const fail = aggregate?.fail ?? 0;
  const na = aggregate?.na ?? 0;
  const notApplicable = aggregate?.notApplicable ?? 0;
  if (aggregate && pass + fail === 0 && na > 0) {
    return {
      maxPoints: points,
      score: 0,
      status: 'INSUFFICIENT_TRUTH',
      reason: insufficientTruthReason,
      pass,
      fail,
      na,
      notApplicable,
      coverageRate: 0,
    };
  }
  return scoreAxisFromDimension(
    gate,
    dimension,
    points,
    insufficientTruthReason,
  );
}
