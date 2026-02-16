export enum PillarPosition {
  YEAR  = 'YEAR',
  MONTH = 'MONTH',
  DAY   = 'DAY',
  HOUR  = 'HOUR',
}

export const PILLAR_POSITION_VALUES: readonly PillarPosition[] = [
  PillarPosition.YEAR, PillarPosition.MONTH, PillarPosition.DAY, PillarPosition.HOUR,
] as const;

