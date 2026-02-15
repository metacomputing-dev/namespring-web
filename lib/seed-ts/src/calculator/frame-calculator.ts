import { EnergyCalculator, type AnalysisDetail } from './energy-calculator.js';
import { Energy } from '../model/energy.js';
import { Element } from '../model/element.js';
import { Polarity } from '../model/polarity.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import { FourframeRepository } from '../database/fourframe-repository.js';
import type { FourFrameAnalysis } from '../types.js';

// ── Pure helper functions ─────────────────────────────────────

function sum(values: readonly number[]): number {
  let out = 0;
  for (const value of values) out += value;
  return out;
}

function adjustTo81(value: number): number {
  if (value <= 81) return value;
  return ((value - 1) % 81) + 1;
}

/** Determines Element from the last digit of a stroke sum (수리오행). */
function elementFromDigit(strokeSum: number): Element {
  const lastDigit = strokeSum % 10;
  switch (lastDigit) {
    case 1: case 2: return Element.Wood;
    case 3: case 4: return Element.Fire;
    case 5: case 6: return Element.Earth;
    case 7: case 8: return Element.Metal;
    default: return Element.Water; // 9 and 0
  }
}

// ── Frame data class ──────────────────────────────────────────

export class Frame {
  public energy: Energy | null = null;
  public luckLevel: number = -1;

  constructor(
    public readonly type: 'won' | 'hyung' | 'lee' | 'jung',
    public readonly strokeSum: number,
  ) {}
}

// ── FourFrameCalculator ───────────────────────────────────────

export class FourFrameCalculator extends EnergyCalculator {
  public readonly type = 'FourFrame';
  public frames: Frame[];
  public luckScore: number = 0;

  private readonly surnameStrokes: number[];
  private readonly firstNameStrokes: number[];

  constructor(surnameEntries: HanjaEntry[], firstNameEntries: HanjaEntry[]) {
    super();
    this.surnameStrokes = surnameEntries.map(e => e.strokes);
    this.firstNameStrokes = firstNameEntries.map(e => e.strokes);

    // Calculate frame stroke sums using upper/lower split
    const padded = [...this.firstNameStrokes];
    if (padded.length === 1) padded.push(0);

    const mid = Math.floor(padded.length / 2);
    const givenUpperSum = sum(padded.slice(0, mid));
    const givenLowerSum = sum(padded.slice(mid));
    const surnameTotal = sum(this.surnameStrokes);
    const givenTotal = sum(this.firstNameStrokes);

    this.frames = [
      new Frame('won', sum(padded)),
      new Frame('hyung', adjustTo81(surnameTotal + givenUpperSum)),
      new Frame('lee', adjustTo81(surnameTotal + givenLowerSum)),
      new Frame('jung', adjustTo81(surnameTotal + givenTotal)),
    ];
  }

  protected doCalculate(): void {
    // Assign energy to each frame
    for (const frame of this.frames) {
      frame.energy = new Energy(
        Polarity.get(frame.strokeSum),
        elementFromDigit(frame.strokeSum),
      );
    }

    // Element harmony score between adjacent frames
    const elementScore = this.calculateElementScore();

    // Luck score from luck levels (defaults to 0 until loadAllLuckLevels is called)
    let luckSum = 0;
    for (const frame of this.frames) {
      luckSum += Math.max(0, frame.luckLevel) * 10;
    }
    const avgLuck = luckSum / this.frames.length;

    this.luckScore = elementScore * 50 + avgLuck;
  }

  private calculateElementScore(): number {
    const energies = this.frames
      .map(f => f.energy)
      .filter((e): e is Energy => e !== null);

    // If any adjacent pair has an overcoming relation, score is 0
    for (let i = 0; i < energies.length - 1; i++) {
      if (energies[i].element.isOvercoming(energies[i + 1].element)) {
        return 0;
      }
    }

    // Check wrap-around (first vs last)
    if (energies.length >= 2) {
      const first = energies[0].element;
      const last = energies[energies.length - 1].element;
      if (first.isOvercoming(last)) return 0;
    }

    return 1;
  }

  /**
   * Loads luck levels for all frames from the FourframeRepository.
   * Must be called explicitly (no fire-and-forget).
   */
  public async loadAllLuckLevels(repo: FourframeRepository): Promise<void> {
    await repo.init();
    for (const frame of this.frames) {
      const entry = await repo.findByNumber(frame.strokeSum);
      const parsed = Number.parseInt(entry?.lucky_level ?? '0', 10);
      frame.luckLevel = Number.isNaN(parsed) ? 0 : parsed;
    }

    // Recalculate score now that luck levels are loaded
    let luckSum = 0;
    for (const frame of this.frames) {
      luckSum += frame.luckLevel * 10;
    }
    const avgLuck = luckSum / this.frames.length;
    const elementScore = this.calculateElementScore();
    this.luckScore = elementScore * 50 + avgLuck;
  }

  public getScore(): number {
    return Energy.getScore(
      this.frames.map(f => f.energy).filter((e): e is Energy => e !== null),
    );
  }

  public getFrames(): Frame[] {
    return this.frames;
  }

  public getFrame(type: 'won' | 'hyung' | 'lee' | 'jung'): Frame | undefined {
    return this.frames.find(f => f.type === type);
  }

  public getAnalysis(): AnalysisDetail<FourFrameAnalysis> {
    const energies = this.frames
      .map(f => f.energy)
      .filter((e): e is Energy => e !== null);
    const polarityScore = Energy.getPolarityScore(energies);
    const elementScore = Energy.getElementScore(energies);

    return {
      type: this.type,
      score: this.getScore(),
      polarityScore,
      elementScore,
      data: {
        frames: this.frames.map(f => ({
          type: f.type,
          strokeSum: f.strokeSum,
          element: f.energy?.element.english ?? '',
          polarity: f.energy?.polarity.english ?? '',
          luckyLevel: Math.max(0, f.luckLevel),
        })),
        elementScore,
        luckScore: this.luckScore,
      },
    };
  }
}
