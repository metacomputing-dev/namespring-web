import { extractChosung, extractJungsung } from "../hangul.js";
import type { NameBlock } from "../types.js";

export const CHOSUNG_TO_ENGLISH: Record<string, string> = {
  "\u3131": "g",
  "\u3132": "gg",
  "\u3134": "n",
  "\u3137": "d",
  "\u3138": "dd",
  "\u3139": "r",
  "\u3141": "m",
  "\u3142": "b",
  "\u3143": "bb",
  "\u3145": "s",
  "\u3146": "ss",
  "\u3147": "ng",
  "\u3148": "j",
  "\u3149": "jj",
  "\u314A": "ch",
  "\u314B": "k",
  "\u314C": "t",
  "\u314D": "p",
  "\u314E": "h",
};

const CHOSUNG_ONLY = new Set<string>(Object.keys(CHOSUNG_TO_ENGLISH));
const JUNGSUNG_ONLY = new Set<string>([
  "\u314F",
  "\u3150",
  "\u3151",
  "\u3152",
  "\u3153",
  "\u3154",
  "\u3155",
  "\u3156",
  "\u3157",
  "\u3158",
  "\u3159",
  "\u315A",
  "\u315B",
  "\u315C",
  "\u315D",
  "\u315E",
  "\u315F",
  "\u3160",
  "\u3161",
  "\u3162",
  "\u3163",
]);

export function isKoreanSyllable(char: string): boolean {
  if (!char || char.length !== 1) {
    return false;
  }
  const code = char.codePointAt(0);
  return code !== undefined && code >= 0xac00 && code <= 0xd7a3;
}

export function isKoreanEmpty(block: NameBlock): boolean {
  return block.korean === "_" || block.korean.length === 0;
}

export function isCompleteKorean(block: NameBlock): boolean {
  return block.korean.length === 1 && isKoreanSyllable(block.korean);
}

export function isChosungOnly(block: NameBlock): boolean {
  return block.korean.length === 1 && CHOSUNG_ONLY.has(block.korean);
}

export function isJungsungOnly(block: NameBlock): boolean {
  return block.korean.length === 1 && JUNGSUNG_ONLY.has(block.korean);
}

export function matchesFirstBlock(block: NameBlock, name: string): boolean {
  if (name.length === 0) {
    return false;
  }
  const first = Array.from(name)[0] ?? "";
  if (isKoreanEmpty(block)) {
    return true;
  }
  if (isCompleteKorean(block)) {
    return first === block.korean;
  }
  if (isChosungOnly(block)) {
    return extractChosung(first) === block.korean;
  }
  if (isJungsungOnly(block)) {
    return extractJungsung(first) === block.korean;
  }
  return false;
}

export function blockMatchesAt(block: NameBlock, nameChar: string, hanjaChar: string): boolean {
  const koreanOk =
    isKoreanEmpty(block) ||
    (isCompleteKorean(block) && block.korean === nameChar) ||
    (isChosungOnly(block) && extractChosung(nameChar) === block.korean) ||
    (isJungsungOnly(block) && extractJungsung(nameChar) === block.korean);

  const hanjaOk = block.hanja.length === 0 || block.hanja === "_" || block.hanja === hanjaChar;
  return koreanOk && hanjaOk;
}
