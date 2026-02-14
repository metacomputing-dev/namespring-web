import { ELEMENT_INDEX } from "../constants.js";
import type { Element, LuckyLevel, Polarity } from "../types.js";
import { clamp } from "../utils.js";
import { ELEMENT_KEYS } from "./evaluator-context.js";

const FORTUNE_TOP = "\uCD5C\uC0C1\uC6B4\uC218";
const FORTUNE_HIGH = "\uC0C1\uC6B4\uC218";
const FORTUNE_GOOD = "\uC591\uC6B4\uC218";
const FORTUNE_WORST = "\uCD5C\uD749\uC6B4\uC218";
const FORTUNE_BAD = "\uD749\uC6B4\uC218";

export function isSangSaeng(first: Element, second: Element): boolean {
  return (ELEMENT_INDEX[first] + 1) % 5 === ELEMENT_INDEX[second];
}

export function isSangGeuk(first: Element, second: Element): boolean {
  const a = ELEMENT_INDEX[first];
  const b = ELEMENT_INDEX[second];
  return (a + 2) % 5 === b || (b + 2) % 5 === a;
}

export function calculateArrayScore(arrangement: readonly Element[], surnameLength = 1): number {
  if (arrangement.length < 2) {
    return 100;
  }
  let sangSaeng = 0;
  let sangGeuk = 0;
  let same = 0;
  for (let i = 0; i < arrangement.length - 1; i += 1) {
    if (surnameLength === 2 && i === 0) {
      continue;
    }
    const a = arrangement[i] as Element;
    const b = arrangement[i + 1] as Element;
    if (isSangSaeng(a, b)) {
      sangSaeng += 1;
    } else if (isSangGeuk(a, b)) {
      sangGeuk += 1;
    } else if (a === b) {
      same += 1;
    }
  }
  return clamp(70 + sangSaeng * 15 - sangGeuk * 20 - same * 5, 0, 100);
}

export function calculateBalanceScore(distribution: Readonly<Record<Element, number>>): number {
  const total = ELEMENT_KEYS.reduce((acc, key) => acc + (distribution[key] ?? 0), 0);
  if (total === 0) {
    return 0;
  }
  const avg = total / 5;
  let deviation = 0;
  for (const key of ELEMENT_KEYS) {
    deviation += Math.abs((distribution[key] ?? 0) - avg);
  }
  if (deviation <= 2) return 100;
  if (deviation <= 4) return 85;
  if (deviation <= 6) return 70;
  if (deviation <= 8) return 55;
  if (deviation <= 10) return 40;
  return 25;
}

export function checkPolarityHarmony(arrangement: readonly Polarity[], surnameLength: number): boolean {
  if (arrangement.length < 2) {
    return true;
  }
  const eum = arrangement.filter((value) => value === "\u9670").length;
  const yang = arrangement.length - eum;
  if (eum === 0 || yang === 0) {
    return false;
  }
  if (surnameLength === 1 && arrangement[0] === arrangement[arrangement.length - 1]) {
    return false;
  }
  return true;
}

export function checkElementSangSaeng(arrangement: readonly Element[], surnameLength: number): boolean {
  if (arrangement.length < 2) {
    return true;
  }

  const startIdx = surnameLength === 2 ? 1 : 0;
  for (let i = startIdx; i < arrangement.length - 1; i += 1) {
    if (isSangGeuk(arrangement[i] as Element, arrangement[i + 1] as Element)) {
      return false;
    }
  }

  const consecutiveStart = surnameLength === 2 ? 2 : 1;
  let consecutive = 1;
  for (let i = consecutiveStart; i < arrangement.length; i += 1) {
    if (arrangement[i] === arrangement[i - 1]) {
      consecutive += 1;
      if (consecutive >= 3) {
        return false;
      }
    } else {
      consecutive = 1;
    }
  }

  if (!(surnameLength === 2 && arrangement.length === 3)) {
    if (isSangGeuk(arrangement[0] as Element, arrangement[arrangement.length - 1] as Element)) {
      return false;
    }
  }

  let relationCount = 0;
  let sangSaengCount = 0;
  for (let i = 0; i < arrangement.length - 1; i += 1) {
    if (surnameLength === 2 && i === 0) {
      continue;
    }
    const a = arrangement[i] as Element;
    const b = arrangement[i + 1] as Element;
    if (a === b) {
      continue;
    }
    relationCount += 1;
    if (isSangSaeng(a, b)) {
      sangSaengCount += 1;
    }
  }

  if (relationCount > 0 && sangSaengCount / relationCount < 0.6) {
    return false;
  }
  return true;
}

export function checkFourFrameSuriElement(arrangement: readonly Element[], givenNameLength: number): boolean {
  const checked =
    givenNameLength === 1 && arrangement.length === 3
      ? arrangement.slice(0, 2)
      : arrangement.slice();
  if (checked.length < 2) {
    return false;
  }
  for (let i = 0; i < checked.length - 1; i += 1) {
    if (isSangGeuk(checked[i] as Element, checked[i + 1] as Element)) {
      return false;
    }
  }
  if (isSangGeuk(checked[checked.length - 1] as Element, checked[0] as Element)) {
    return false;
  }
  return new Set(checked).size > 1;
}

export function bucketFromFortune(fortune: string): number {
  const f = fortune ?? "";
  if (f.includes(FORTUNE_TOP) || f.includes("\uCD5C\uC0C1")) return 25;
  if (f.includes(FORTUNE_HIGH) || f.includes("\uC0C1")) return 20;
  if (f.includes(FORTUNE_GOOD) || f.includes("\uC591")) return 15;
  if (f.includes(FORTUNE_WORST) || f.includes("\uCD5C\uD749")) return 0;
  if (f.includes(FORTUNE_BAD) || f.includes("\uD749")) return 5;
  return 10;
}

export function levelToFortune(level: LuckyLevel): string {
  return level;
}

export function countDominant(distribution: Record<Element, number>): boolean {
  const total = ELEMENT_KEYS.reduce((acc, key) => acc + distribution[key], 0);
  const threshold = Math.floor(total / 2) + 1;
  return ELEMENT_KEYS.some((key) => distribution[key] >= threshold);
}

export function polarityScore(eumCount: number, yangCount: number): number {
  const total = Math.max(0, eumCount + yangCount);
  if (total === 0) {
    return 0;
  }
  const minSide = Math.min(eumCount, yangCount);
  const ratio = minSide / total;
  const ratioScore = ratio >= 0.4 ? 50 : ratio >= 0.3 ? 35 : ratio >= 0.2 ? 20 : 10;
  return 40 + ratioScore;
}
