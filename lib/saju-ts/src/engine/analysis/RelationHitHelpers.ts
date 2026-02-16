export interface PairLike<TMember> {
  readonly a: TMember;
  readonly b: TMember;
  readonly note: string;
}

export interface TripleLike<TMember> {
  readonly a: TMember;
  readonly b: TMember;
  readonly c: TMember;
  readonly note: string;
}

export type AddHit<TType, TMember> = (
  type: TType,
  members: Set<TMember>,
  note?: string,
) => void;

export function hasAllMembers<TMember>(
  present: ReadonlySet<TMember>,
  ...members: readonly TMember[]
): boolean {
  return members.every((member) => present.has(member));
}

export function addPairHits<TType, TMember>(
  type: TType,
  defs: readonly PairLike<TMember>[],
  present: ReadonlySet<TMember>,
  addHit: AddHit<TType, TMember>,
): void {
  for (const pair of defs) {
    if (hasAllMembers(present, pair.a, pair.b)) {
      addHit(type, new Set([pair.a, pair.b]), pair.note);
    }
  }
}

export function addTripleHits<TType, TMember>(
  type: TType,
  defs: readonly TripleLike<TMember>[],
  present: ReadonlySet<TMember>,
  addHit: AddHit<TType, TMember>,
): void {
  for (const triple of defs) {
    if (hasAllMembers(present, triple.a, triple.b, triple.c)) {
      addHit(type, new Set([triple.a, triple.b, triple.c]), triple.note);
    }
  }
}

