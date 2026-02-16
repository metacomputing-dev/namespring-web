import { Sipseong } from '../domain/Sipseong.js';
import { PillarPosition } from '../domain/PillarPosition.js';
import { registerSipseongInterpretationCatalog } from './SipseongInterpretationCatalog.js';

export interface SipseongInterpretation {
  readonly sipseong: Sipseong;
  readonly position: PillarPosition;
  readonly keyword: string;
  readonly shortDescription: string;
  readonly positiveTraits: readonly string[];
  readonly negativeTraits: readonly string[];
  readonly careerHint: string;
}

function key(s: Sipseong, p: PillarPosition): string {
  return `${s}:${p}`;
}

const TABLE = new Map<string, SipseongInterpretation>();

function put(
  sipseong: Sipseong,
  position: PillarPosition,
  keyword: string,
  shortDescription: string,
  positiveTraits: readonly string[],
  negativeTraits: readonly string[],
  careerHint: string,
): void {
  TABLE.set(key(sipseong, position), {
    sipseong,
    position,
    keyword,
    shortDescription,
    positiveTraits,
    negativeTraits,
    careerHint,
  });
}

registerSipseongInterpretationCatalog(put);

export function interpretSipseong(
  sipseong: Sipseong,
  position: PillarPosition,
): SipseongInterpretation {
  const result = TABLE.get(key(sipseong, position));
  if (!result) {
    throw new Error(`Missing SipseongInterpreter entry: ${sipseong}+${position}`);
  }
  return result;
}

export const SipseongInterpreter = {
  interpret: interpretSipseong,
} as const;

