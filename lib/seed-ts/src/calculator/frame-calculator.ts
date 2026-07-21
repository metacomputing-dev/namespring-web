import { EnergyCalculator, type EnergyVisitor } from './energy-calculator.js';
import { Energy } from '../model/energy.js';
import { Element } from '../model/element.js';
import { Polarity } from '../model/polarity.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import { SeedCalculationError, SeedValidationError } from '../errors.js';
import type { FourFrameEnrichmentState } from '../types.js';
import {
  FOURFRAME_CATALOG_PROVENANCE,
  getFourframeMeaningByNumber,
  type FourframeMeaningEntry,
} from '../fourframe-catalog.js';
import { normalizeFourFrameNumber } from '../fourframe-contract.js';
import { sanitizeImmutableServiceValue } from '../service-text-policy.js';

const FOUR_FRAME_ENRICHMENT = Object.freeze({
  status: 'embedded_versioned_snapshot',
  source: 'embedded_fourframe_catalog',
  includedInScore: false,
  mutableAfterReturn: false,
  schemaVersion: FOURFRAME_CATALOG_PROVENANCE.schemaVersion,
  snapshotVersion: FOURFRAME_CATALOG_PROVENANCE.snapshotVersion,
  contentSha256: FOURFRAME_CATALOG_PROVENANCE.canonicalContentSha256,
  sourceDatabaseSha256: FOURFRAME_CATALOG_PROVENANCE.sourceDatabaseSha256,
  rowCount: FOURFRAME_CATALOG_PROVENANCE.rowCount,
  reason: 'Versioned four-frame meanings are embedded for display and do not alter scoring.',
} satisfies FourFrameEnrichmentState);

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function extractStrokeCounts(
  entries: readonly HanjaEntry[],
  path: 'surnameEntries' | 'firstNameEntries',
): readonly number[] {
  if (entries.length === 0) {
    throw new SeedValidationError(
      path === 'surnameEntries' ? 'EMPTY_SURNAME' : 'EMPTY_GIVEN_NAME',
      path === 'surnameEntries'
        ? 'At least one surname syllable is required.'
        : 'At least one given-name syllable is required.',
      path,
      entries,
    );
  }

  return Object.freeze(entries.map((entry, index) => {
    const strokes = entry.strokes;
    if (!Number.isFinite(strokes) || !Number.isInteger(strokes) || strokes <= 0) {
      throw new SeedValidationError(
        'INVALID_STROKE_COUNT',
        'Stroke count must be a positive finite integer.',
        `${path}[${index}].strokes`,
        strokes,
      );
    }
    return strokes;
  }));
}

/**
 * Calculator for the Four Frames (Won, Hyung, Lee, Jung) in naming theory.
 * Manages numerical stroke sums and their corresponding energies derived from Hanja entries.
 * Aligned with the pattern used in Hanja and Hangul calculators.
 */
export class FourFrameCalculator extends EnergyCalculator {
  public readonly type = "FourFrame";
  protected readonly surnameStrokes: readonly number[];
  protected readonly firstNameStrokes: readonly number[];
  public readonly enrichment: FourFrameEnrichmentState = FOUR_FRAME_ENRICHMENT;
  public readonly luckScore: null = null;
  
  /**
   * Represents an individual frame (Sagyuk) with its calculated stroke sum and energy.
   */
  public static Frame = class {
    public energy: Energy | null = null;
    public readonly luckLevel: null = null;
    public readonly entry!: FourframeMeaningEntry;
    public readonly enrichmentStatus = 'embedded_versioned_snapshot' as const;
    public readonly strokeSum: number;
    
    constructor(
      public readonly type: 'won' | 'hyung' | 'lee' | 'jung',
      strokeSum: number,
      fullHangul: string = '',
    ) {
      this.strokeSum = normalizeFourFrameNumber(strokeSum);
      const rawEntry = getFourframeMeaningByNumber(this.strokeSum);
      let displayEntry: FourframeMeaningEntry | undefined;

      // Scoring consumes only the normalized frame number and energy. Keep the
      // existing own/enumerable public `entry` contract, but defer the
      // presentation-only sanitizer until a report or serializer actually
      // reads it. The closure cache remains usable after the frame is frozen.
      Object.defineProperty(this, 'entry', {
        configurable: true,
        enumerable: true,
        get: () => {
          displayEntry ??= sanitizeImmutableServiceValue(rawEntry, fullHangul);
          return displayEntry;
        },
      });
    }

  };

  public readonly frames: readonly InstanceType<typeof FourFrameCalculator.Frame>[];

  /**
   * Initializes the four frames using Hanja entries to derive total stroke counts.
   * Supports multi-character surnames and names of varying lengths.
   * @param surnameEntries Array of Hanja entries for the surname
   * @param firstNameEntries Array of Hanja entries for the first name
   */
  constructor(surnameEntries: readonly HanjaEntry[], firstNameEntries: readonly HanjaEntry[]) {
    super();
    this.surnameStrokes = extractStrokeCounts(surnameEntries, 'surnameEntries');
    this.firstNameStrokes = extractStrokeCounts(firstNameEntries, 'firstNameEntries');

    const paddedGivenStrokes = [...this.firstNameStrokes];
    if (paddedGivenStrokes.length === 1) paddedGivenStrokes.push(0);

    const midpoint = Math.floor(paddedGivenStrokes.length / 2);
    const surnameTotal = sum(this.surnameStrokes);
    const givenTotal = sum(this.firstNameStrokes);
    const upperGivenTotal = sum(paddedGivenStrokes.slice(0, midpoint));
    const lowerGivenTotal = sum(paddedGivenStrokes.slice(midpoint));
    const fullHangul = [...surnameEntries, ...firstNameEntries]
      .map((entry) => entry.hangul)
      .join('');

    // Build each frame exactly once. No constructor side effects or later replacement.
    this.frames = Object.freeze([
      new FourFrameCalculator.Frame('won', givenTotal, fullHangul),
      new FourFrameCalculator.Frame('hyung', surnameTotal + upperGivenTotal, fullHangul),
      new FourFrameCalculator.Frame('lee', surnameTotal + lowerGivenTotal, fullHangul),
      new FourFrameCalculator.Frame('jung', surnameTotal + givenTotal, fullHangul),
    ]);
  }

  /**
   * Triggers the energy calculation for all Sagyuk frames using the internal visitor.
   * Execution is skipped if all frames have already been calculated.
   */
  public calculate(): void {
    if (!this.shouldCalculate()) return;
    const visitor = new FourFrameCalculator.CalculationVisitor();
    this.accept(visitor);
    this.markReady();
  }

  public getScore(): number {
    const calculationStatus = this.requireReadyOrExcluded('fourFrames.frames');
    if (calculationStatus === 'excluded') return 0;

    const energies = this.frames
      .map(frame => frame.energy)
      .filter((energy): energy is Energy => energy !== null);
    if (energies.length !== this.frames.length) {
      throw new SeedCalculationError(
        'EMPTY_ENERGY_SET',
        'All four frame energies must be calculated before scoring.',
        'fourFrames.frames',
        { frameCount: this.frames.length, energyCount: energies.length },
      );
    }
    return Energy.getScore(energies);
  }

  /**
   * Returns the list of all frames.
   */
  public getFrames() {
    return this.frames;
  }

  /**
   * Retrieves a specific frame by its type identifier.
   */
  public getFrame(type: 'won' | 'hyung' | 'lee' | 'jung') {
    return this.frames.find(f => f.type === type);
  }

  public getSurnameStrokes(): readonly number[] {
    return this.surnameStrokes;
  }

  public getFirstNameStrokes(): readonly number[] {
    return this.firstNameStrokes;
  }

  /**
   * Internal visitor class responsible for calculating energy for each frame.
   */
  public static CalculationVisitor = class implements EnergyVisitor {
    public preVisit(calculator: EnergyCalculator): void {
      // Preparation before processing frames
    }

    public visit(calculator: EnergyCalculator): void {
      if (calculator instanceof FourFrameCalculator) {
        // Calculate energy attributes for every frame in the calculator
        calculator.getFrames().forEach(frame => {
          frame.energy = {
            // Use the static Polarity getter for stroke sums
            polarity: Polarity.get(frame.strokeSum),
            element: this.calculateElementFromDigit(frame.strokeSum)
          };
        });

      }
    }

    public postVisit(calculator: EnergyCalculator): void {
      // Finalization after all frames are processed
    }

    /**
     * Determines the Element based on the last digit of the stroke sum.
     * Follows the 1,2: Wood / 3,4: Fire / 5,6: Earth / 7,8: Metal / 9,0: Water rule.
     */
    public calculateElementFromDigit(strokeSum: number): Element {
      if (!Number.isFinite(strokeSum) || !Number.isInteger(strokeSum) || strokeSum <= 0) {
        throw new SeedValidationError(
          'INVALID_STROKE_COUNT',
          'Frame stroke sum must be a positive finite integer.',
          'fourFrames.strokeSum',
          strokeSum,
        );
      }
      const lastDigit = strokeSum % 10;
      switch (lastDigit) {
        case 1: case 2: return Element.Wood;
        case 3: case 4: return Element.Fire;
        case 5: case 6: return Element.Earth;
        case 7: case 8: return Element.Metal;
        default: return Element.Water; // Covers 9 and 0
      }
    }

  }
}
