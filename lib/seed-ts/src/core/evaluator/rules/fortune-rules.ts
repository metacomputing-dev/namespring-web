import type { LuckyLevel } from "../../types.js";
import {
  FORTUNE_BUCKET_TOP,
  FORTUNE_BUCKET_HIGH,
  FORTUNE_BUCKET_GOOD,
  FORTUNE_BUCKET_WORST,
  FORTUNE_BUCKET_BAD,
  FORTUNE_BUCKET_DEFAULT,
} from "../scoring-constants.js";

const FORTUNE_TOP = "\uCD5C\uC0C1\uC6B4\uC218";
const FORTUNE_HIGH = "\uC0C1\uC6B4\uC218";
const FORTUNE_GOOD = "\uC591\uC6B4\uC218";
const FORTUNE_WORST = "\uCD5C\uD749\uC6B4\uC218";
const FORTUNE_BAD = "\uD749\uC6B4\uC218";

export function bucketFromFortune(fortune: string): number {
  const f = fortune ?? "";
  if (f.includes(FORTUNE_TOP) || f.includes("\uCD5C\uC0C1")) return FORTUNE_BUCKET_TOP;
  if (f.includes(FORTUNE_HIGH) || f.includes("\uC0C1")) return FORTUNE_BUCKET_HIGH;
  if (f.includes(FORTUNE_GOOD) || f.includes("\uC591")) return FORTUNE_BUCKET_GOOD;
  if (f.includes(FORTUNE_WORST) || f.includes("\uCD5C\uD749")) return FORTUNE_BUCKET_WORST;
  if (f.includes(FORTUNE_BAD) || f.includes("\uD749")) return FORTUNE_BUCKET_BAD;
  return FORTUNE_BUCKET_DEFAULT;
}

export function levelToFortune(level: LuckyLevel): string {
  return level;
}
