import type { EnergyCalculator } from "./calculator/energy-calculator.js";
import type { HanjaEntry } from "./database/hanja-repository.js";
import type { Element } from "./model/element.js";
import type { Polarity } from "./model/polarity.js";

export type Gender = "male" | "female" | "none";
export type AnalysisType = "FourFrame" | "Sound" | "Hanja" | "Hangul";

export interface BirthDateTime {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

export interface UserInfo {
  readonly surname: HanjaEntry[];
  readonly givenName: HanjaEntry[];
  readonly birthDateTime: BirthDateTime;
  readonly gender: Gender;
}

export interface NamingResult {
  readonly surname: HanjaEntry[];
  readonly givenName: HanjaEntry[];
  readonly totalScore: number;
  readonly interpretation: string;
  readonly hanja: EnergyCalculator;
  readonly sound: EnergyCalculator;
  readonly fourFrame: EnergyCalculator;
  readonly summaryEnergy?: {
    readonly element: Element;
    readonly polarity: Polarity;
  };
}

export interface SeedResult {
  readonly candidates: NamingResult[];
  readonly totalCount: number;
}
