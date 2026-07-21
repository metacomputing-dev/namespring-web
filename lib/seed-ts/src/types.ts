import type { EnergyCalculator } from './calculator/energy-calculator.js';
import type { HanjaEntry } from './database/hanja-repository.js';

/**
 * Represents the gender of the user.
 * Using a union type for strict type checking.
 */
export type Gender = 'male' | 'female' | 'neutral';

export type BirthCalendarType = 'solar' | 'lunar';
export type PureHangulNameMode = 'auto' | 'on' | 'off';

/**
 * Categorizes the types of analysis performed by the engine.
 */
export type AnalysisType = 'FourFrame' | 'Hangul' | 'Hanja';

/**
 * External four-frame meanings are deliberately outside the synchronous,
 * deterministic score contract. Async consumers may enrich a separate DTO,
 * but SeedTs.analyze() never starts I/O or mutates its returned value later.
 */
export interface FourFrameEnrichmentState {
  readonly status: 'embedded_versioned_snapshot';
  readonly source: 'embedded_fourframe_catalog';
  readonly includedInScore: false;
  readonly mutableAfterReturn: false;
  readonly schemaVersion: 'namespring.fourframe-meaning-catalog/v1';
  readonly snapshotVersion: string;
  readonly contentSha256: string;
  readonly sourceDatabaseSha256: string;
  readonly rowCount: 81;
  readonly reason: string;
}

/**
 * A structured representation of birth date and time.
 * This avoids the mutability and zero-indexing issues of the native JS Date object.
 */
export interface BirthDateTime {
  readonly year?: number | null;   // e.g., 2024
  readonly month?: number | null;  // 1 to 12
  readonly day?: number | null;    // 1 to 31
  readonly hour?: number | null;   // 0 to 23
  readonly minute?: number | null; // 0 to 59
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
  readonly lastName: readonly HanjaEntry[];
  readonly firstName: readonly HanjaEntry[];
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
  readonly lastName: readonly HanjaEntry[];
  readonly firstName: readonly HanjaEntry[];
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
  readonly fourFrameEnrichment: FourFrameEnrichmentState;
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
  readonly candidates: readonly NamingResult[];
  /**
   * Total number of results found.
   */
  readonly totalCount: number;
}
