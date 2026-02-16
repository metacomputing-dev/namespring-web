export interface RelationSetPairDef<T> {
  readonly pair: ReadonlySet<T>;
  readonly note: string;
}

export interface RelationValuePairDef<T> {
  readonly a: T;
  readonly b: T;
}

export function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

export function findCheonganHap<T>(
  pair: ReadonlySet<T>,
  hapPairs: readonly RelationSetPairDef<T>[],
): string | undefined {
  return findRelationNote(pair, hapPairs);
}

export function findCheonganChung<T>(
  pair: ReadonlySet<T>,
  chungPairs: readonly RelationSetPairDef<T>[],
): string | undefined {
  return findRelationNote(pair, chungPairs);
}

export function matchesJijiPair<T>(pairDef: RelationValuePairDef<T>, a: T, b: T): boolean {
  return (pairDef.a === a && pairDef.b === b) || (pairDef.a === b && pairDef.b === a);
}

export function distinct<T>(arr: readonly T[]): T[] {
  return [...new Set(arr)];
}

function findRelationNote<T>(
  pair: ReadonlySet<T>,
  defs: readonly RelationSetPairDef<T>[],
): string | undefined {
  return defs.find(def => setsEqual(def.pair, pair))?.note;
}

