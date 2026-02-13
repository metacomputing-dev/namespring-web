import type { EnergyCalculator } from './calculator/energy-calculator';

/**
 * Represents the gender of the user.
 * Using a union type for strict type checking.
 */
export type Gender = 'male' | 'female';

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
}

/**
 * Input data provided by the user for naming analysis.
 * All properties are readonly to ensure data integrity during calculation.
 */
export interface UserInfo {
  readonly lastName: string;
  readonly firstName: string;
  readonly birthDateTime: BirthDateTime;
  readonly gender: Gender;
}

/**
 * Represents the calculation result for a single name candidate.
 * Includes scores and detailed calculator instances based on naming theories.
 */
export interface NamingResult {
  readonly lastName: string;
  readonly firstName: string;
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