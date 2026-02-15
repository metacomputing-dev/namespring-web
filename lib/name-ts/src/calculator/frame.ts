import { NameCalculator, type EvalContext, type AnalysisDetail, type CalculatorPacket } from './evaluator.js';
import { Element } from '../model/element.js';
import { Polarity } from '../model/polarity.js';
import { Energy } from '../model/energy.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import { FourframeRepository, type FourframeMeaningEntry } from '../database/fourframe-repository.js';
import type { FourFrameAnalysis } from '../model/types.js';
import {
  type ElementKey, sum, adjustTo81,
  distributionFromArrangement, calculateArrayScore, calculateBalanceScore,
  checkFourFrameSuriElement, countDominant, bucketFromFortune,
} from './scoring.js';

const DIGIT_ELEMENTS = [Element.Water, Element.Wood, Element.Wood, Element.Fire, Element.Fire, Element.Earth, Element.Earth, Element.Metal, Element.Metal, Element.Water];
function elementFromDigit(s: number): Element { return DIGIT_ELEMENTS[s % 10]; }

export interface Frame {
  readonly type: 'won' | 'hyung' | 'lee' | 'jung';
  readonly strokeSum: number;
  energy: Energy | null;
  entry: FourframeMeaningEntry | null;
}

export class FrameCalculator extends NameCalculator {
  readonly id = 'frame';
  public readonly frames: Frame[];

  private static repo: FourframeRepository | null = null;
  private static repoInitPromise: Promise<void> | null = null;

  constructor(surnameEntries: HanjaEntry[], givenNameEntries: HanjaEntry[]) {
    super();
    const surnameStrokes = surnameEntries.map(e => e.strokes);
    const givenNameStrokes = givenNameEntries.map(e => e.strokes);

    const padded = [...givenNameStrokes];
    if (padded.length === 1) padded.push(0);
    const mid = Math.floor(padded.length / 2);
    const guSum = sum(padded.slice(0, mid));
    const glSum = sum(padded.slice(mid));
    const sT = sum(surnameStrokes);
    const gT = sum(givenNameStrokes);

    this.frames = [
      { type: 'won', strokeSum: sum(padded), energy: null, entry: null },
      { type: 'hyung', strokeSum: adjustTo81(sT + guSum), energy: null, entry: null },
      { type: 'lee', strokeSum: adjustTo81(sT + glSum), energy: null, entry: null },
      { type: 'jung', strokeSum: adjustTo81(sT + gT), energy: null, entry: null },
    ];

    void this.loadEntries();
  }

  visit(ctx: EvalContext): void {
    for (const f of this.frames) f.energy = new Energy(Polarity.get(f.strokeSum), elementFromDigit(f.strokeSum));
    this.scoreFourframeLuck(ctx);
    this.scoreFourframeElement(ctx);
  }

  backward(_ctx: EvalContext): CalculatorPacket {
    return { signals: [this.signal('FOURFRAME_LUCK', _ctx, 1.0), this.signal('FOURFRAME_ELEMENT', _ctx, 0.6)] };
  }

  getAnalysis(): AnalysisDetail<FourFrameAnalysis> {
    const energies = this.frames.map(f => f.energy).filter((e): e is Energy => e !== null);
    const polScore = Energy.getPolarityScore(energies);
    const elScore = Energy.getElementScore(energies);
    return {
      type: this.id,
      score: (polScore + elScore) / 2,
      polarityScore: polScore,
      elementScore: elScore,
      data: {
        frames: this.frames.map(f => ({
          type: f.type, strokeSum: f.strokeSum,
          element: f.energy?.element.english ?? '',
          polarity: f.energy?.polarity.english ?? '',
          luckyLevel: 0,
        })),
        elementScore: elScore,
        luckScore: 0,
      },
    };
  }

  /* -- UI adapter methods (consumed by NamingReport.jsx) -- */

  getFrames(): Frame[] {
    return this.frames;
  }

  getScore(): number {
    return this.getAnalysis().score;
  }

  get luckScore(): number {
    let total = 0;
    let count = 0;
    for (const f of this.frames) {
      const parsed = Number.parseInt(f.entry?.lucky_level ?? '0', 10);
      total += Number.isNaN(parsed) ? 0 : parsed;
      count += 1;
    }
    return count > 0 ? (total / count) * 10 : 0;
  }

  get polarityScore(): number {
    return this.getAnalysis().polarityScore;
  }

  get elementScore(): number {
    return this.getAnalysis().elementScore;
  }

  /* -- async entry loading (fire-and-forget from constructor) -- */

  private async loadEntries(): Promise<void> {
    try {
      if (!FrameCalculator.repo) {
        FrameCalculator.repo = new FourframeRepository();
      }
      if (!FrameCalculator.repoInitPromise) {
        FrameCalculator.repoInitPromise = FrameCalculator.repo.init();
      }
      await FrameCalculator.repoInitPromise;
      for (const f of this.frames) {
        f.entry = await FrameCalculator.repo.findByNumber(f.strokeSum);
      }
    } catch {
      // Entry loading is best-effort; UI shows fallback text when entry is null
    }
  }

  /* -- scoring internals -- */

  private scoreFourframeLuck(ctx: EvalContext): void {
    const [won, hyung, lee, jung] = this.frames;
    const fortunes = this.frames.map(fr => ctx.luckyMap.get(fr.strokeSum) ?? '');
    const buckets = [bucketFromFortune(fortunes[0]), bucketFromFortune(fortunes[1])];
    if (ctx.givenLength > 1) buckets.push(bucketFromFortune(fortunes[2]));
    buckets.push(bucketFromFortune(fortunes[3]));
    const score = buckets.reduce((a, b) => a + b, 0);

    this.putInsight(ctx, 'FOURFRAME_LUCK', score, buckets.length > 0 && buckets.every(v => v >= 15),
      this.frames.map((fr, i) => `${fr.strokeSum}/${fortunes[i]}`).join('-'),
      { won: won.strokeSum, hyeong: hyung.strokeSum, i: lee.strokeSum, jeong: jung.strokeSum });
  }

  private scoreFourframeElement(ctx: EvalContext): void {
    const arrangement = [this.frames[2], this.frames[1], this.frames[0]]
      .map(f => elementFromDigit(f.strokeSum).english) as ElementKey[];
    const distribution = distributionFromArrangement(arrangement);
    const adjacencyScore = calculateArrayScore(arrangement, ctx.surnameLength);
    const balanceScore = calculateBalanceScore(distribution);
    const score = (balanceScore + adjacencyScore) / 2;
    const isPassed =
      checkFourFrameSuriElement(arrangement, ctx.givenLength) &&
      !countDominant(distribution) && adjacencyScore >= (ctx.surnameLength === 2 ? 65 : 60) && score >= 65;
    this.putInsight(ctx, 'FOURFRAME_ELEMENT', score, isPassed,
      arrangement.join('-'), { distribution, adjacencyScore, balanceScore });
  }
}
