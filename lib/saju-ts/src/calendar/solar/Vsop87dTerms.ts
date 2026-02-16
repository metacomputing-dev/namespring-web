
type VsopTerm = readonly [number, number, number];
type PackedVsopSeries = ReadonlyArray<ReadonlyArray<number>>;

import { VSOP87D_L_PACKED, VSOP87D_R_PACKED } from './Vsop87dTermsData.js';

function requireFiniteNumber(values: ReadonlyArray<number>, index: number, label: string): number {
  const value = values[index];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Invalid VSOP87D packed value at ' + label);
  }
  return value;
}

function expandPackedPower(values: ReadonlyArray<number>, power: number): ReadonlyArray<VsopTerm> {
  if (values.length % 3 !== 0) {
    throw new Error('Invalid VSOP87D packed power length at power ' + power + ': ' + values.length);
  }

  const terms: VsopTerm[] = [];
  for (let i = 0; i < values.length; i += 3) {
    const termIndex = i / 3;
    const a = requireFiniteNumber(values, i, 'power ' + power + ', term ' + termIndex + ', A');
    const b = requireFiniteNumber(values, i + 1, 'power ' + power + ', term ' + termIndex + ', B');
    const c = requireFiniteNumber(values, i + 2, 'power ' + power + ', term ' + termIndex + ', C');
    terms.push([a, b, c]);
  }
  return terms;
}

function expandPackedSeries(series: PackedVsopSeries): ReadonlyArray<ReadonlyArray<VsopTerm>> {
  return series.map((powerTerms, power) => expandPackedPower(powerTerms, power));
}


export const VSOP87D_L_TERMS: ReadonlyArray<ReadonlyArray<VsopTerm>> = expandPackedSeries(VSOP87D_L_PACKED);
export const VSOP87D_R_TERMS: ReadonlyArray<ReadonlyArray<VsopTerm>> = expandPackedSeries(VSOP87D_R_PACKED);

