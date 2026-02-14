import { ELEMENT_INDEX } from "../../constants.js";
import type { Element } from "../../types.js";
import { clamp } from "../../utils.js";
import { ELEMENT_KEYS } from "../evaluator-context.js";
import {
  ELEMENT_ARRAY_BASE_SCORE,
  ELEMENT_ARRAY_SANG_SAENG_BONUS,
  ELEMENT_ARRAY_SANG_GEUK_PENALTY,
  ELEMENT_ARRAY_SAME_PENALTY,
  ELEMENT_BALANCE_BRACKETS,
  ELEMENT_BALANCE_FLOOR,
  ELEMENT_SANG_SAENG_MIN_RATIO,
  ELEMENT_MAX_CONSECUTIVE_SAME,
} from "../scoring-constants.js";

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
  return clamp(
    ELEMENT_ARRAY_BASE_SCORE +
      sangSaeng * ELEMENT_ARRAY_SANG_SAENG_BONUS -
      sangGeuk * ELEMENT_ARRAY_SANG_GEUK_PENALTY -
      same * ELEMENT_ARRAY_SAME_PENALTY,
    0,
    100,
  );
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
  for (const [threshold, score] of ELEMENT_BALANCE_BRACKETS) {
    if (deviation <= threshold) return score;
  }
  return ELEMENT_BALANCE_FLOOR;
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
      if (consecutive >= ELEMENT_MAX_CONSECUTIVE_SAME) {
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

  if (relationCount > 0 && sangSaengCount / relationCount < ELEMENT_SANG_SAENG_MIN_RATIO) {
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

export function countDominant(distribution: Record<Element, number>): boolean {
  const total = ELEMENT_KEYS.reduce((acc, key) => acc + distribution[key], 0);
  const threshold = Math.floor(total / 2) + 1;
  return ELEMENT_KEYS.some((key) => distribution[key] >= threshold);
}
