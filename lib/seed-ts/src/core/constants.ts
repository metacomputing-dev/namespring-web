import type { Element, LuckyLevel, Polarity } from "./types.js";

export const CHOSUNG_LIST = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
] as const;

export const JUNGSUNG_LIST = [
  "ㅏ",
  "ㅐ",
  "ㅑ",
  "ㅒ",
  "ㅓ",
  "ㅔ",
  "ㅕ",
  "ㅖ",
  "ㅗ",
  "ㅘ",
  "ㅙ",
  "ㅚ",
  "ㅛ",
  "ㅜ",
  "ㅝ",
  "ㅞ",
  "ㅟ",
  "ㅠ",
  "ㅡ",
  "ㅢ",
  "ㅣ",
] as const;

export const YANG_VOWELS = new Set<string>([
  "ㅏ",
  "ㅑ",
  "ㅐ",
  "ㅒ",
  "ㅗ",
  "ㅛ",
  "ㅘ",
  "ㅙ",
  "ㅚ",
]);

export const CHOSUNG_ELEMENT: Record<string, Element> = {
  "ㄱ": "木",
  "ㅋ": "木",
  "ㄲ": "木",
  "ㄴ": "火",
  "ㄷ": "火",
  "ㅌ": "火",
  "ㄹ": "火",
  "ㄸ": "火",
  "ㅇ": "土",
  "ㅎ": "土",
  "ㅅ": "金",
  "ㅈ": "金",
  "ㅊ": "金",
  "ㅆ": "金",
  "ㅉ": "金",
  "ㅁ": "水",
  "ㅂ": "水",
  "ㅍ": "水",
  "ㅃ": "水",
};

export const DIGIT_TO_ELEMENT: Record<string, Element> = {
  "1": "木",
  "2": "火",
  "3": "土",
  "4": "金",
  "5": "水",
};

export const LAST_DIGIT_ELEMENT: Record<number, Element> = {
  0: "水",
  1: "木",
  2: "木",
  3: "火",
  4: "火",
  5: "土",
  6: "土",
  7: "金",
  8: "金",
  9: "水",
};

export const ELEMENT_ORDER: readonly Element[] = ["木", "火", "土", "金", "水"] as const;

export const ELEMENT_INDEX: Record<Element, number> = {
  "木": 0,
  "火": 1,
  "土": 2,
  "金": 3,
  "水": 4,
};

export const DEFAULT_POLARITY_BY_BIT: Record<0 | 1, Polarity> = {
  0: "陰",
  1: "陽",
};

export const CHEONGAN_ELEMENT: Record<string, Element> = {
  "甲": "木",
  "乙": "木",
  "丙": "火",
  "丁": "火",
  "戊": "土",
  "己": "土",
  "庚": "金",
  "辛": "金",
  "壬": "水",
  "癸": "水",
};

export const JIJI_ELEMENT: Record<string, Element> = {
  "子": "水",
  "丑": "土",
  "寅": "木",
  "卯": "木",
  "辰": "土",
  "巳": "火",
  "午": "火",
  "未": "土",
  "申": "金",
  "酉": "金",
  "戌": "土",
  "亥": "水",
};

export const YANG_CHEONGAN = new Set<string>(["甲", "丙", "戊", "庚", "壬"]);
export const YANG_JIJI = new Set<string>(["子", "寅", "辰", "午", "申", "戌"]);

export const LUCKY_POSITIVE_PATTERNS = ["최상운수", "상운수", "양운수"];
export const LUCKY_NEGATIVE_PATTERN = "흉운수";

export const LEVEL_ORDER: LuckyLevel[] = ["최상운수", "상운수", "양운수", "흉운수", "최흉운수", "미정"];

export const SANGSAENG_RELATION = new Set<string>(["木>火", "火>土", "土>金", "金>水", "水>木"]);

// ── Infrastructure Constants ──
export const DEFAULT_HANJA_STROKE_COUNT = 10;
export const MAX_STROKE_KEYS_FOR_SQL_IN = 900;
export const FOUR_FRAME_MODULO = 81;
export const MAX_STROKE_COUNT_PER_CHAR = 40;
