import { StrengthLevel } from '../domain/StrengthResult.js';
import rawStrengthInterpretations from './data/strengthInterpretations.json';

export interface StrengthInterpretation {
  readonly level: StrengthLevel;
  readonly summary: string;
  readonly personality: readonly string[];
  readonly advice: string;
}

interface StrengthInterpretationsData {
  readonly entries: readonly (readonly [string, StrengthInterpretation])[];
}

const STRENGTH_INTERPRETATIONS = rawStrengthInterpretations as unknown as StrengthInterpretationsData;
const STRENGTH_LEVEL_SET: ReadonlySet<StrengthLevel> = new Set(Object.values(StrengthLevel));

function toStrengthLevel(raw: string): StrengthLevel {
  if (STRENGTH_LEVEL_SET.has(raw as StrengthLevel)) return raw as StrengthLevel;
  throw new Error(`Invalid StrengthLevel in strengthInterpretations.json: ${raw}`);
}

const TABLE: ReadonlyMap<StrengthLevel, StrengthInterpretation> = new Map(
  STRENGTH_INTERPRETATIONS.entries.map(([level, interpretation]) => {
    const parsedLevel = toStrengthLevel(level);
    return [parsedLevel, { ...interpretation, level: parsedLevel }] as const;
  }),
);

export function interpretStrength(level: StrengthLevel): StrengthInterpretation {
  const result = TABLE.get(level);
  if (!result) {
    throw new Error(`Missing StrengthInterpreter entry: ${level}`);
  }
  return result;
}

export const StrengthInterpreter = {
  interpret: interpretStrength,
} as const;
