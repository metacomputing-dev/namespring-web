import type { HanjaEntry } from "../core/types.js";
import type { Energy } from "../core/types.js";

export function mergeNameEntries(
  surnameEntries: readonly HanjaEntry[],
  givenEntries: readonly HanjaEntry[],
): HanjaEntry[] {
  return [...surnameEntries, ...givenEntries];
}

export function lastEnergy<T extends { energy: Energy | null }>(
  items: readonly T[],
): Energy | null {
  if (items.length === 0) {
    return null;
  }
  return items[items.length - 1]?.energy ?? null;
}