import type { GivenNameConstraint, KoreanConstraintKind } from "../types";

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const CHOSUNG_RE = /^[\u3131-\u314e]$/;
const JUNGSUNG_RE = /^[\u314f-\u3163]$/;

function firstChar(value: string): string {
  return Array.from((value ?? "").trim())[0] ?? "";
}

function sanitizeBlockText(value: string): string {
  return (value ?? "").replace(/[[\]/]/g, "").trim();
}

export function isHangulSyllable(char: string): boolean {
  if (char.length !== 1) {
    return false;
  }
  const code = char.codePointAt(0);
  return code !== undefined && code >= HANGUL_BASE && code <= HANGUL_END;
}

export function classifyKoreanConstraint(value: string): KoreanConstraintKind {
  const char = firstChar(value);
  if (!char || char === "_") {
    return "empty";
  }
  if (isHangulSyllable(char)) {
    return "syllable";
  }
  if (CHOSUNG_RE.test(char)) {
    return "chosung";
  }
  if (JUNGSUNG_RE.test(char)) {
    return "jungsung";
  }
  return "invalid";
}

export function sanitizeHangulName(value: string, maxLength: number): string {
  const out: string[] = [];
  for (const char of Array.from(value ?? "")) {
    if (!isHangulSyllable(char)) {
      continue;
    }
    out.push(char);
    if (out.length >= maxLength) {
      break;
    }
  }
  return out.join("");
}

export function sanitizeKoreanConstraint(value: string): string {
  const char = firstChar(value);
  const kind = classifyKoreanConstraint(char);
  if (kind === "invalid") {
    return "";
  }
  return char === "_" ? "" : char;
}

export function sanitizeHanjaConstraint(value: string): string {
  const char = firstChar(value);
  if (!char || char === "_") {
    return "";
  }
  return sanitizeBlockText(char);
}

function toQueryToken(value: string): string {
  const normalized = sanitizeBlockText(value);
  return normalized.length > 0 ? normalized : "_";
}

function toQueryBlock(korean: string, hanja: string): string {
  return `[${toQueryToken(korean)}/${toQueryToken(hanja)}]`;
}

export function buildSearchQuery(input: {
  surnameHangul: string;
  surnameHanja: string;
  constraints: readonly GivenNameConstraint[];
}): string {
  const surnameHangul = sanitizeBlockText(input.surnameHangul);
  const surnameHanja = sanitizeBlockText(input.surnameHanja);
  if (!surnameHangul || !surnameHanja) {
    throw new Error("Surname Hangul/Hanja must be fully specified.");
  }
  if (Array.from(surnameHangul).length !== Array.from(surnameHanja).length) {
    throw new Error("Surname Hangul/Hanja length mismatch.");
  }
  if (Array.from(surnameHangul).length > 2) {
    throw new Error("Surname must be 1 or 2 characters.");
  }

  const surnameBlock = toQueryBlock(surnameHangul, surnameHanja);
  const givenBlocks = input.constraints.map((constraint) =>
    toQueryBlock(sanitizeKoreanConstraint(constraint.korean), sanitizeHanjaConstraint(constraint.hanja)),
  );

  return `${surnameBlock}${givenBlocks.join("")}`;
}
