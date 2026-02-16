export interface BoundaryMomentLike {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

export function momentKey(year: number, month: number, day: number, hour: number, minute: number): number {
  return year * 100_000_000 + month * 1_000_000 + day * 10_000 + hour * 100 + minute;
}

export function boundaryMomentKey(boundary: BoundaryMomentLike): number {
  return momentKey(boundary.year, boundary.month, boundary.day, boundary.hour, boundary.minute);
}

export function compareBoundaryMoments(left: BoundaryMomentLike, right: BoundaryMomentLike): number {
  return boundaryMomentKey(left) - boundaryMomentKey(right);
}

function findByKey<T extends BoundaryMomentLike>(
  boundaries: readonly T[],
  key: number,
  matches: (boundaryKey: number, key: number) => boolean,
  moveLeftOnMatch: boolean,
): T | undefined {
  let low = 0;
  let high = boundaries.length - 1;
  let best = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const boundary = boundaries[mid];
    if (!boundary) break;
    if (matches(boundaryMomentKey(boundary), key)) {
      best = mid;
      if (moveLeftOnMatch) high = mid - 1;
      else low = mid + 1;
      continue;
    }
    if (moveLeftOnMatch) low = mid + 1;
    else high = mid - 1;
  }
  return best >= 0 ? boundaries[best] : undefined;
}

export function findLastBoundaryByKey<T extends BoundaryMomentLike>(
  boundaries: readonly T[],
  key: number,
  inclusive: boolean,
): T | undefined {
  return findByKey(boundaries, key, (candidate, target) => (inclusive ? candidate <= target : candidate < target), false);
}

export function findFirstBoundaryByKey<T extends BoundaryMomentLike>(
  boundaries: readonly T[],
  key: number,
  inclusive: boolean,
): T | undefined {
  return findByKey(boundaries, key, (candidate, target) => (inclusive ? candidate >= target : candidate > target), true);
}
