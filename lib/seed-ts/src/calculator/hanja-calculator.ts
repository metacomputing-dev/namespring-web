import { EnergyCalculator, type AnalysisDetail } from './energy-calculator.js';
import { Energy } from '../model/energy.js';
import { Element } from '../model/element.js';
import { Polarity } from '../model/polarity.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import type { HanjaAnalysis } from '../types.js';

// ── NameBlock ─────────────────────────────────────────────────

export class HanjaNameBlock {
  public energy: Energy | null = null;

  constructor(
    public readonly entry: HanjaEntry,
    public readonly position: number,
  ) {}
}

// ── HanjaCalculator ───────────────────────────────────────────

export class HanjaCalculator extends EnergyCalculator {
  public readonly type = 'Hanja';
  public readonly hanjaNameBlocks: HanjaNameBlock[];
  public polarityScore: number = 0;
  public elementScore: number = 0;

  constructor(surnameEntries: HanjaEntry[], firstNameEntries: HanjaEntry[]) {
    super();
    const fullEntries = [...surnameEntries, ...firstNameEntries];
    this.hanjaNameBlocks = fullEntries.map(
      (entry, index) => new HanjaNameBlock(entry, index),
    );
  }

  protected doCalculate(): void {
    for (const block of this.hanjaNameBlocks) {
      block.energy = new Energy(
        Polarity.get(block.entry.strokes),
        Element.get(block.entry.resource_element),
      );
    }

    const energies = this.hanjaNameBlocks
      .map(b => b.energy)
      .filter((e): e is Energy => e !== null);
    this.polarityScore = Energy.getPolarityScore(energies);
    this.elementScore = Energy.getElementScore(energies);
  }

  public getScore(): number {
    return Energy.getScore(
      this.hanjaNameBlocks.map(b => b.energy).filter((e): e is Energy => e !== null),
    );
  }

  public getNameBlocks(): HanjaNameBlock[] {
    return this.hanjaNameBlocks;
  }

  public getAnalysis(): AnalysisDetail<HanjaAnalysis> {
    return {
      type: this.type,
      score: this.getScore(),
      polarityScore: this.polarityScore,
      elementScore: this.elementScore,
      data: {
        blocks: this.hanjaNameBlocks.map(b => ({
          hanja: b.entry.hanja,
          hangul: b.entry.hangul,
          strokes: b.entry.strokes,
          resourceElement: b.entry.resource_element,
          strokeElement: b.entry.stroke_element,
          polarity: b.energy?.polarity.english ?? '',
        })),
        polarityScore: this.polarityScore,
        elementScore: this.elementScore,
      },
    };
  }
}
