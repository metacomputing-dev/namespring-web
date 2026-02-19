import type { EnergyCalculator } from './calculator/energy-calculator';
import type { HanjaEntry } from './database/hanja-repository';

/**
 * Represents the gender of the user.
 * Using a union type for strict type checking.
 */
export type Gender = 'male' | 'female';
export type BirthCalendarType = 'solar' | 'lunar';
export type PureHangulNameMode = 'auto' | 'on' | 'off';

/**
 * Categorizes the types of analysis performed by the engine.
 */
export type AnalysisType = 'FourFrame' | 'Hangul' | 'Hanja';

/**
 * A structured representation of birth date and time.
 * This avoids the mutability and zero-indexing issues of the native JS Date object.
 */
export interface BirthDateTime {
  readonly year: number;   // e.g., 2024
  readonly month: number;  // 1 to 12
  readonly day: number;    // 1 to 31
  readonly hour: number;   // 0 to 23
  readonly minute: number; // 0 to 59
  readonly calendarType?: BirthCalendarType;
  readonly isLeapMonth?: boolean;
}

export interface SeedAnalysisOptions {
  readonly pureHangulNameMode?: PureHangulNameMode;
  readonly useSurnameHanjaInPureHangul?: boolean;
}

/**
 * Input data provided by the user for naming analysis.
 * Now contains HanjaEntry arrays to hold rich metadata for each character.
 */
export interface UserInfo {
  readonly lastName: HanjaEntry[];
  readonly firstName: HanjaEntry[];
  readonly birthDateTime: BirthDateTime;
  readonly gender: Gender;
  readonly options?: SeedAnalysisOptions;
}

/**
 * Represents the calculation result for a single name candidate.
 * Includes scores and detailed calculator instances based on naming theories.
 * Updated to use HanjaEntry[] for rich metadata support.
 */
export interface NamingResult {
  /**
   * The last name (surname) and first name represented as HanjaEntry arrays
   * to preserve stroke counts and elemental properties for each character.
   */
  readonly lastName: HanjaEntry[];
  readonly firstName: HanjaEntry[];
  /**
   * The aggregated score based on various naming theories.
   */
  readonly totalScore: number;
  /**
   * Calculator instances containing detailed analysis for each theory.
   */
  readonly hanja: EnergyCalculator;
  readonly hangul: EnergyCalculator;
  readonly fourFrames: EnergyCalculator;
  readonly interpretation: string;
  readonly pureHangulMode?: boolean;
}

/**
 * The final top-level result object containing a collection of name candidates.
 */
export interface SeedResult {
  /**
   * A list of name candidates calculated by the engine.
   */
  readonly candidates: NamingResult[];
  /**
   * Total number of results found.
   */
  readonly totalCount: number;
}
