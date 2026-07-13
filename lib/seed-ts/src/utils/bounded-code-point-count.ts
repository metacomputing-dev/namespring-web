/**
 * Counts Unicode code points without materializing an array. Values above the
 * supplied boundary return maximum + 1 immediately so untrusted oversized
 * text cannot amplify memory use during validation.
 */
export function countCodePointsUpTo(
  value: string,
  maximum: number,
): number {
  let count = 0;
  for (const _codePoint of value) {
    count += 1;
    if (count > maximum) return count;
  }
  return count;
}
