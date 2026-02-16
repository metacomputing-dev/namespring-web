import { Jiji, JIJI_VALUES } from '../../domain/Jiji.js';
import rawRelationCatalog from './data/relationCatalog.json';

export interface PairDef {
  readonly a: Jiji;
  readonly b: Jiji;
  readonly note: string;
}

export interface TripleDef {
  readonly a: Jiji;
  readonly b: Jiji;
  readonly c: Jiji;
  readonly note: string;
}

export interface BanhapDef {
  readonly a: Jiji;
  readonly b: Jiji;
  readonly missing: Jiji;
  readonly note: string;
}

interface RawPairDef {
  readonly a: string;
  readonly b: string;
  readonly note: string;
}

interface RawTripleDef {
  readonly a: string;
  readonly b: string;
  readonly c: string;
  readonly note: string;
}

interface RawBanhapDef {
  readonly a: string;
  readonly b: string;
  readonly missing: string;
  readonly note: string;
}

interface RelationCatalogData {
  readonly yukhapPairs: readonly RawPairDef[];
  readonly samhapTriples: readonly RawTripleDef[];
  readonly banghapTriples: readonly RawTripleDef[];
  readonly chungPairs: readonly RawPairDef[];
  readonly hyeongTriples: readonly RawTripleDef[];
  readonly hyeongPairs: readonly RawPairDef[];
  readonly banhapDefs: readonly RawBanhapDef[];
  readonly selfHyeongBranches: readonly string[];
  readonly paPairs: readonly RawPairDef[];
  readonly haePairs: readonly RawPairDef[];
  readonly wonjinPairs: readonly RawPairDef[];
}

const RELATION_CATALOG_DATA = rawRelationCatalog as unknown as RelationCatalogData;
const JIJI_SET: ReadonlySet<Jiji> = new Set(JIJI_VALUES);

function toJiji(raw: string): Jiji {
  if (JIJI_SET.has(raw as Jiji)) return raw as Jiji;
  throw new Error(`Invalid Jiji in RelationCatalog: ${raw}`);
}

function toPairDef(raw: RawPairDef): PairDef {
  return { a: toJiji(raw.a), b: toJiji(raw.b), note: raw.note };
}

function toTripleDef(raw: RawTripleDef): TripleDef {
  return { a: toJiji(raw.a), b: toJiji(raw.b), c: toJiji(raw.c), note: raw.note };
}

function toBanhapDef(raw: RawBanhapDef): BanhapDef {
  return {
    a: toJiji(raw.a),
    b: toJiji(raw.b),
    missing: toJiji(raw.missing),
    note: raw.note,
  };
}

export const YUKHAP_PAIRS: readonly PairDef[] = RELATION_CATALOG_DATA.yukhapPairs.map(toPairDef);
export const SAMHAP_TRIPLES: readonly TripleDef[] = RELATION_CATALOG_DATA.samhapTriples.map(toTripleDef);
export const BANGHAP_TRIPLES: readonly TripleDef[] = RELATION_CATALOG_DATA.banghapTriples.map(toTripleDef);
export const CHUNG_PAIRS: readonly PairDef[] = RELATION_CATALOG_DATA.chungPairs.map(toPairDef);
export const HYEONG_TRIPLES: readonly TripleDef[] = RELATION_CATALOG_DATA.hyeongTriples.map(toTripleDef);
export const HYEONG_PAIRS: readonly PairDef[] = RELATION_CATALOG_DATA.hyeongPairs.map(toPairDef);
export const BANHAP_DEFS: readonly BanhapDef[] = RELATION_CATALOG_DATA.banhapDefs.map(toBanhapDef);
export const SELF_HYEONG_BRANCHES: ReadonlySet<Jiji> = new Set(
  RELATION_CATALOG_DATA.selfHyeongBranches.map(toJiji),
);
export const PA_PAIRS: readonly PairDef[] = RELATION_CATALOG_DATA.paPairs.map(toPairDef);
export const HAE_PAIRS: readonly PairDef[] = RELATION_CATALOG_DATA.haePairs.map(toPairDef);
export const WONJIN_PAIRS: readonly PairDef[] = RELATION_CATALOG_DATA.wonjinPairs.map(toPairDef);
