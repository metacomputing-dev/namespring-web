import { extractChosung } from "../hangul.js";
import type { NameBlock } from "../types.js";
import { CHOSUNG_TO_ENGLISH, isChosungOnly, isCompleteKorean } from "./name-block-matcher.js";

export function resolveIndexKeyFromName(name: string): string {
  const first = Array.from(name)[0] ?? "";
  return CHOSUNG_TO_ENGLISH[extractChosung(first)] ?? "misc";
}

export function resolveIndexKeyFromFirstBlock(firstBlock: NameBlock): string | null {
  if (isChosungOnly(firstBlock)) {
    return CHOSUNG_TO_ENGLISH[firstBlock.korean] ?? "misc";
  }
  if (isCompleteKorean(firstBlock)) {
    const first = Array.from(firstBlock.korean)[0] ?? "";
    return CHOSUNG_TO_ENGLISH[extractChosung(first)] ?? "misc";
  }
  return null;
}

export function flattenIndexMapFiles(indexMap: Record<string, string[]>): string[] {
  const all: string[] = [];
  for (const values of Object.values(indexMap)) {
    for (const file of values) {
      all.push(file);
    }
  }
  return all;
}

export function filesToSearchFromIndexMap(indexMap: Record<string, string[]>, firstBlock: NameBlock): string[] {
  const key = resolveIndexKeyFromFirstBlock(firstBlock);
  if (key !== null) {
    return indexMap[key] ?? [];
  }
  return flattenIndexMapFiles(indexMap);
}
