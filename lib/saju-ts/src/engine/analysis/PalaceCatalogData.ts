import { Gender } from '../../domain/Gender.js';
import {
  FamilyRelation,
  PalaceFavor,
  PalaceInfo,
  PalaceInterpretation,
} from '../../domain/Palace.js';
import { PillarPosition } from '../../domain/PillarPosition.js';
import { Sipseong } from '../../domain/Sipseong.js';
import rawPalaceCatalog from './data/palaceCatalog.json';

interface RawFamilyValue {
  readonly member: string;
  readonly hanja: string;
}

interface RawPalaceInterpretation {
  readonly favor: string;
  readonly summary: string;
  readonly detail: string;
}

interface PalaceCatalogData {
  readonly palaceTable: readonly (readonly [string, PalaceInfo])[];
  readonly maleFamily: readonly (readonly [string, RawFamilyValue])[];
  readonly femaleFamily: readonly (readonly [string, RawFamilyValue])[];
  readonly interpretationRows: readonly (readonly [string, string, RawPalaceInterpretation])[];
}

const PALACE_CATALOG_DATA = rawPalaceCatalog as unknown as PalaceCatalogData;

const PILLAR_POSITION_SET: ReadonlySet<PillarPosition> = new Set(Object.values(PillarPosition));
const SIPSEONG_SET: ReadonlySet<Sipseong> = new Set(Object.values(Sipseong));
const PALACE_FAVOR_SET: ReadonlySet<PalaceFavor> = new Set(Object.values(PalaceFavor));

function toPillarPosition(raw: string): PillarPosition {
  if (PILLAR_POSITION_SET.has(raw as PillarPosition)) return raw as PillarPosition;
  throw new Error(`Invalid PillarPosition in PalaceCatalog: ${raw}`);
}

function toSipseong(raw: string): Sipseong {
  if (SIPSEONG_SET.has(raw as Sipseong)) return raw as Sipseong;
  throw new Error(`Invalid Sipseong in PalaceCatalog: ${raw}`);
}

function toPalaceFavor(raw: string): PalaceFavor {
  if (PALACE_FAVOR_SET.has(raw as PalaceFavor)) return raw as PalaceFavor;
  throw new Error(`Invalid PalaceFavor in PalaceCatalog: ${raw}`);
}

function interpKey(sipseong: Sipseong, position: PillarPosition): string {
  return `${sipseong}:${position}`;
}

const PALACE_TABLE: ReadonlyMap<PillarPosition, PalaceInfo> = new Map(
  PALACE_CATALOG_DATA.palaceTable.map(([position, info]) => {
    const parsed = toPillarPosition(position);
    return [parsed, { ...info, position: parsed }] as const;
  }),
);

function buildFamilyTable(
  rows: readonly (readonly [string, RawFamilyValue])[],
): Record<Sipseong, [member: string, hanja: string]> {
  const table = {} as Record<Sipseong, [member: string, hanja: string]>;
  for (const [sipseong, value] of rows) {
    table[toSipseong(sipseong)] = [value.member, value.hanja];
  }
  return table;
}

const MALE_FAMILY = buildFamilyTable(PALACE_CATALOG_DATA.maleFamily);
const FEMALE_FAMILY = buildFamilyTable(PALACE_CATALOG_DATA.femaleFamily);

const INTERPRETATION_TABLE: ReadonlyMap<string, PalaceInterpretation> = new Map(
  PALACE_CATALOG_DATA.interpretationRows.map(([sipseong, position, interpretation]) => [
    interpKey(toSipseong(sipseong), toPillarPosition(position)),
    {
      favor: toPalaceFavor(interpretation.favor),
      summary: interpretation.summary,
      detail: interpretation.detail,
    },
  ]),
);

function familyTable(gender: Gender): Record<Sipseong, [member: string, hanja: string]> {
  return gender === Gender.MALE ? MALE_FAMILY : FEMALE_FAMILY;
}

export function palaceInfo(position: PillarPosition): PalaceInfo {
  return PALACE_TABLE.get(position)!;
}

export function familyRelation(sipseong: Sipseong, gender: Gender): FamilyRelation {
  const [familyMember, hanja] = familyTable(gender)[sipseong];
  return {
    sipseong,
    gender,
    familyMember,
    hanja,
  };
}

export function familyMember(sipseong: Sipseong, gender: Gender): string {
  return familyTable(gender)[sipseong][0];
}

export function interpretation(
  sipseong: Sipseong,
  position: PillarPosition,
): PalaceInterpretation | null {
  if (position === PillarPosition.DAY) return null;
  return INTERPRETATION_TABLE.get(interpKey(sipseong, position)) ?? null;
}
