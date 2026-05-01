import type { ElementKey } from './core/scoring.js';
import unihanData from '../data/unihan-hanja-metadata.json';

export type RadicalElementHintSourceTier = 'T3_AUTHORED_INTERPRETATION';

export interface RadicalElementHint {
  readonly element: ElementKey;
  readonly radicalNumber: number;
  readonly confidence: 'hint';
  readonly sourceTier: RadicalElementHintSourceTier;
  readonly sourceRegistryId: 'radical_element_hint_policy';
  readonly authorityTruthEligible: false;
}

export interface UnihanVariantLinks {
  readonly semantic?: readonly string[];
  readonly simplified?: readonly string[];
  readonly specializedSemantic?: readonly string[];
  readonly traditional?: readonly string[];
  readonly zVariant?: readonly string[];
  readonly compatibility?: readonly string[];
}

export interface HanjaUnihanMetadata {
  readonly hanja: string;
  readonly codepoint: string;
  readonly kRSUnicode: readonly string[];
  readonly radicalNumber: number | null;
  readonly residualStrokes: number | null;
  readonly totalStrokes: number | null;
  readonly variants?: UnihanVariantLinks;
  readonly radicalElementHint?: RadicalElementHint;
}

interface UnihanDataFile {
  readonly entries: readonly HanjaUnihanMetadata[];
}

const metadataByHanja = new Map<string, HanjaUnihanMetadata>(
  ((unihanData as UnihanDataFile).entries ?? []).map((entry) => [entry.hanja, entry]),
);

export function getUnihanMetadata(hanja: string | undefined): HanjaUnihanMetadata | undefined {
  if (!hanja) return undefined;
  return metadataByHanja.get(hanja);
}

export function getEnrichedStrokeCount(hanja: string | undefined, localStrokeCount: number): number {
  if (Number.isInteger(localStrokeCount) && localStrokeCount > 0) return localStrokeCount;
  const totalStrokes = getUnihanMetadata(hanja)?.totalStrokes;
  return Number.isInteger(totalStrokes) && Number(totalStrokes) > 0
    ? Number(totalStrokes)
    : localStrokeCount;
}

export function getRadicalElementHint(hanja: string | undefined): RadicalElementHint | undefined {
  return getUnihanMetadata(hanja)?.radicalElementHint;
}
