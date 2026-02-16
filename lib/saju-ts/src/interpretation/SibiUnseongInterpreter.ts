import { SibiUnseong } from '../domain/SibiUnseong.js';
import { PillarPosition } from '../domain/PillarPosition.js';
import rawSibiUnseongInterpretations from './data/sibiUnseongInterpretations.json';

export interface UnseongInterpretation {
  readonly stage: SibiUnseong;
  readonly position: PillarPosition;
  readonly keyword: string;
  readonly description: string;
  readonly energy: string;
}

interface SibiUnseongInterpretationsData {
  readonly entries: readonly (readonly [string, UnseongInterpretation])[];
}

const SIBI_UNSEONG_INTERPRETATIONS = rawSibiUnseongInterpretations as unknown as SibiUnseongInterpretationsData;
const SIBI_UNSEONG_SET: ReadonlySet<SibiUnseong> = new Set(Object.values(SibiUnseong));
const PILLAR_POSITION_SET: ReadonlySet<PillarPosition> = new Set(Object.values(PillarPosition));

function toSibiUnseong(raw: string): SibiUnseong {
  if (SIBI_UNSEONG_SET.has(raw as SibiUnseong)) return raw as SibiUnseong;
  throw new Error(`Invalid SibiUnseong in sibiUnseongInterpretations.json: ${raw}`);
}

function toPillarPosition(raw: string): PillarPosition {
  if (PILLAR_POSITION_SET.has(raw as PillarPosition)) return raw as PillarPosition;
  throw new Error(`Invalid PillarPosition in sibiUnseongInterpretations.json: ${raw}`);
}

function key(s: SibiUnseong, p: PillarPosition): string {
  return `${s}:${p}`;
}

function parseEntryKey(rawKey: string): readonly [SibiUnseong, PillarPosition] {
  const [rawStage, rawPosition, ...rest] = rawKey.split(':');
  if (!rawStage || !rawPosition || rest.length > 0) {
    throw new Error(`Invalid SibiUnseong catalog key: ${rawKey}`);
  }
  return [toSibiUnseong(rawStage), toPillarPosition(rawPosition)] as const;
}

const TABLE: ReadonlyMap<string, UnseongInterpretation> = new Map(
  SIBI_UNSEONG_INTERPRETATIONS.entries.map(([rawKey, interpretation]) => {
    const [stage, position] = parseEntryKey(rawKey);
    return [key(stage, position), { ...interpretation, stage, position }] as const;
  }),
);

export function interpretSibiUnseong(
  stage: SibiUnseong,
  position: PillarPosition,
): UnseongInterpretation {
  const result = TABLE.get(key(stage, position));
  if (!result) {
    throw new Error(`Missing SibiUnseongInterpreter entry: ${stage}+${position}`);
  }
  return result;
}

export const SibiUnseongInterpreter = {
  interpret: interpretSibiUnseong,
} as const;
