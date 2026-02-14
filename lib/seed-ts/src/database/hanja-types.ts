import type { Element as CoreElementSymbol } from "../core/types.js";
import type { Element } from "../model/element.js";
import type { Polarity } from "../model/polarity.js";

export interface HanjaRow {
  id: unknown;
  hangul: unknown;
  hanja: unknown;
  hoeksu: unknown;
  hoeksu_ohaeng: unknown;
  jawon_ohaeng: unknown;
  pronunciation_ohaeng: unknown;
  pronunciation_eumyang: unknown;
  hoeksu_eumyang: unknown;
  meaning: unknown;
  boosoo: unknown;
  is_surname: unknown;
  hangul_chosung: unknown;
  hangul_jungsung: unknown;
}

export interface HanjaEntry {
  readonly id: number;
  readonly hangul: string;
  readonly hanja: string;
  readonly onset: string;
  readonly nucleus: string;
  readonly strokes: number;
  readonly strokeElement: Element;
  readonly resourceElement: Element;
  readonly soundElement: Element;
  readonly strokePolarity: Polarity;
  readonly soundPolarity: Polarity;
  readonly meaning: string;
  readonly radical: string;
  readonly isSurname: boolean;
  readonly coreStrokeElement: CoreElementSymbol;
  readonly coreResourceElement: CoreElementSymbol;
  readonly coreSoundElement: CoreElementSymbol;
}
