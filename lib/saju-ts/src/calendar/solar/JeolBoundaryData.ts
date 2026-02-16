export type JeolBoundaryRow = readonly [
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  solarLongitude: number,
  sajuMonthIndex: number,
  branch: string,
];

import { JEOL_BOUNDARY_PACKED } from './JeolBoundaryPackedData.js';

const JEOL_SOLAR_LONGITUDES = [285, 315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255] as const;
const JEOL_BRANCHES = ['CHUK', 'IN', 'MYO', 'JIN', 'SA', 'O', 'MI', 'SIN', 'YU', 'SUL', 'HAE', 'JA'] as const;
const JEOL_MONTHS_PER_YEAR = 12;
const JEOL_COMPONENTS_PER_MONTH = 3; // day, hour, minute

function expandPackedYear(row: ReadonlyArray<number>): JeolBoundaryRow[] {
  const year = requireFiniteNumber(row, 0, 'year');

  const expectedLength = 1 + JEOL_MONTHS_PER_YEAR * JEOL_COMPONENTS_PER_MONTH;
  if (row.length !== expectedLength) {
    throw new Error('Invalid packed jeol boundary row length for ' + year + ': ' + row.length);
  }

  const expanded: JeolBoundaryRow[] = [];
  for (let month = 1; month <= JEOL_MONTHS_PER_YEAR; month++) {
    const offset = 1 + (month - 1) * JEOL_COMPONENTS_PER_MONTH;
    const context = year + '-' + month;
    const day = requireFiniteNumber(row, offset, 'day@' + context);
    const hour = requireFiniteNumber(row, offset + 1, 'hour@' + context);
    const minute = requireFiniteNumber(row, offset + 2, 'minute@' + context);

    const monthIndex = month - 1;
    const solarLongitude = JEOL_SOLAR_LONGITUDES[monthIndex]!;
    const sajuMonthIndex = month === 1 ? 12 : month - 1;
    const branch = JEOL_BRANCHES[monthIndex]!;

    expanded.push([
      year,
      month,
      day,
      hour,
      minute,
      solarLongitude,
      sajuMonthIndex,
      branch,
    ]);
  }

  return expanded;
}

function requireFiniteNumber(row: ReadonlyArray<number>, index: number, label: string): number {
  const value = row[index];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Invalid packed jeol boundary value at ' + label);
  }
  return value;
}

export const JEOL_BOUNDARY_DATA: readonly JeolBoundaryRow[] =
  JEOL_BOUNDARY_PACKED.flatMap(expandPackedYear);

