import { extractChosung, extractJungsung } from "../core/hangul.js";
import type { Element as CoreElementSymbol } from "../core/types.js";
import { elementFromCoreSymbol } from "../model/element.js";
import { polarityFromStrokeCount } from "../model/polarity.js";
import type { HanjaEntry, HanjaRow } from "./hanja-types.js";

const CORE_ELEMENT_SYMBOLS = new Set<CoreElementSymbol>(["木", "火", "土", "金", "水"]);

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function toInt(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toCoreElementSymbol(value: unknown, fallback: CoreElementSymbol): CoreElementSymbol {
  const text = toText(value) as CoreElementSymbol;
  return CORE_ELEMENT_SYMBOLS.has(text) ? text : fallback;
}

export function toCoreElementSymbolFromInput(element: string): CoreElementSymbol {
  const normalized = toText(element).toLowerCase();
  if (CORE_ELEMENT_SYMBOLS.has(element as CoreElementSymbol)) return element as CoreElementSymbol;
  if (normalized === "wood") return "木";
  if (normalized === "fire") return "火";
  if (normalized === "earth") return "土";
  if (normalized === "metal") return "金";
  if (normalized === "water") return "水";
  return "土";
}

export function mapHanjaRow(row: HanjaRow): HanjaEntry {
  const hangul = toText(row.hangul);
  const strokes = toInt(row.hoeksu, 0);
  const coreStrokeElement = toCoreElementSymbol(row.hoeksu_ohaeng, "土");
  const coreResourceElement = toCoreElementSymbol(row.jawon_ohaeng, "土");
  const coreSoundElement = toCoreElementSymbol(row.pronunciation_ohaeng, "土");
  const strokePolarity = polarityFromStrokeCount(strokes);
  const soundPolarity = toInt(row.pronunciation_eumyang, 0) === 1 ? "Positive" : "Negative";
  const isSurname = toInt(row.is_surname, 0) === 1;
  const onset = toText(row.hangul_chosung) || extractChosung(hangul);
  const nucleus = toText(row.hangul_jungsung) || extractJungsung(hangul);

  return {
    id: toInt(row.id, 0),
    hangul,
    hanja: toText(row.hanja),
    onset,
    nucleus,
    strokes,
    strokeElement: elementFromCoreSymbol(coreStrokeElement),
    resourceElement: elementFromCoreSymbol(coreResourceElement),
    soundElement: elementFromCoreSymbol(coreSoundElement),
    strokePolarity,
    soundPolarity,
    meaning: toText(row.meaning),
    radical: toText(row.boosoo),
    isSurname,
    coreStrokeElement,
    coreResourceElement,
    coreSoundElement,
  };
}
