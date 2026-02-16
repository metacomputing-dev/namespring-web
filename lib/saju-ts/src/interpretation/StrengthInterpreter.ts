import { StrengthLevel } from '../domain/StrengthResult.js';
import { createEnumValueParser } from '../domain/EnumValueParser.js';
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
const toStrengthLevel = createEnumValueParser(
  'StrengthLevel',
  'strengthInterpretations.json',
  StrengthLevel,
);

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
