import type { FourframeMeaningEntry } from '../../../seed-ts/src/database/fourframe-repository.js';
import {
  FOURFRAME_LUCKY_LEVELS,
  FOURFRAME_MAX_NUMBER,
  type FourFrameLuckyLevel,
} from '../../src/fourframe-contract.js';

export function makeFourFrameRecord(
  number: number,
  overrides: Partial<FourframeMeaningEntry> = {},
): FourframeMeaningEntry {
  const luckyLevel: FourFrameLuckyLevel =
    FOURFRAME_LUCKY_LEVELS[(number - 1) % FOURFRAME_LUCKY_LEVELS.length];
  return {
    id: number,
    number,
    title: `Frame ${number}`,
    summary: `Summary ${number}`,
    detailed_explanation: null,
    positive_aspects: null,
    caution_points: null,
    personality_traits: [],
    suitable_career: [],
    life_period_influence: null,
    special_characteristics: null,
    challenge_period: null,
    opportunity_area: null,
    lucky_level: luckyLevel,
    ...overrides,
  };
}

export function makeValidFourFrameRecords(): FourframeMeaningEntry[] {
  return Array.from(
    { length: FOURFRAME_MAX_NUMBER },
    (_, index) => makeFourFrameRecord(index + 1),
  );
}
