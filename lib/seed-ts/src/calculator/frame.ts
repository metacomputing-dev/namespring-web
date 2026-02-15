import { NameCalculator, type EvalContext, type AnalysisDetail, type CalculatorPacket } from './evaluator.js';
import { Element } from '../model/element.js';
import { Polarity } from '../model/polarity.js';
import { Energy } from '../model/energy.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import type { FourFrameAnalysis } from '../model/types.js';
import {
  type ElementKey, sum, adjustTo81,
  distributionFromArrangement, calculateArrayScore, calculateBalanceScore,
  checkFourFrameSuriElement, countDominant, bucketFromFortune,
} from './scoring.js';

function elementFromDigit(s: number): Element {
  const d = s % 10;
  if (d === 1 || d === 2) return Element.Wood;
  if (d === 3 || d === 4) return Element.Fire;
  if (d === 5 || d === 6) return Element.Earth;
  if (d === 7 || d === 8) return Element.Metal;
  return Element.Water;
}

export class Frame {
  public energy: Energy | null = null;
  public luckLevel: number = -1;
  constructor(
    public readonly type: 'won' | 'hyung' | 'lee' | 'jung',
    public readonly strokeSum: number,
  ) {}
}

export class FrameCalculator extends NameCalculator {
  readonly id = 'frame';
  public readonly frames: Frame[];
  private readonly surnameStrokes: number[];
  private readonly givenNameStrokes: number[];

  constructor(
    private readonly surnameEntries: HanjaEntry[],
    private readonly givenNameEntries: HanjaEntry[],
  ) {
    super();
    this.surnameStrokes = surnameEntries.map(e => e.strokes);
    this.givenNameStrokes = givenNameEntries.map(e => e.strokes);

    const padded = [...this.givenNameStrokes];
    if (padded.length === 1) padded.push(0);
    const mid = Math.floor(padded.length / 2);
    const guSum = sum(padded.slice(0, mid));
    const glSum = sum(padded.slice(mid));
    const sT = sum(this.surnameStrokes);
    const gT = sum(this.givenNameStrokes);

    this.frames = [
      new Frame('won', sum(padded)),
      new Frame('hyung', adjustTo81(sT + guSum)),
      new Frame('lee', adjustTo81(sT + glSum)),
      new Frame('jung', adjustTo81(sT + gT)),
    ];
  }

  visit(ctx: EvalContext): void {
    for (const f of this.frames) {
      f.energy = new Energy(Polarity.get(f.strokeSum), elementFromDigit(f.strokeSum));
    }
    this.scoreSagyeokSuri(ctx);
    this.scoreSagyeokOhaeng(ctx);
  }

  backward(_ctx: EvalContext): CalculatorPacket {
    return {
      nodeId: this.id,
      signals: [
        this.signal('SAGYEOK_SURI', _ctx, 1.0),
        this.signal('SAGYEOK_OHAENG', _ctx, 0.6),
      ],
    };
  }

  getAnalysis(): AnalysisDetail<FourFrameAnalysis> {
    const energies = this.frames.map(f => f.energy).filter((e): e is Energy => e !== null);
    const polScore = Energy.getPolarityScore(energies);
    const elScore = Energy.getElementScore(energies);
    return {
      type: this.id,
      score: Energy.getScore(energies),
      polarityScore: polScore,
      elementScore: elScore,
      data: {
        frames: this.frames.map(f => ({
          type: f.type, strokeSum: f.strokeSum,
          element: f.energy?.element.english ?? '',
          polarity: f.energy?.polarity.english ?? '',
          luckyLevel: Math.max(0, f.luckLevel),
        })),
        elementScore: elScore,
        luckScore: 0,
      },
    };
  }

  private scoreSagyeokSuri(ctx: EvalContext): void {
    const [won, hyung, lee, jung] = this.frames;
    const f = (n: number) => ctx.luckyMap.get(n) ?? '';
    const [wonF, hyeongF, iF, jeongF] = [f(won.strokeSum), f(hyung.strokeSum), f(lee.strokeSum), f(jung.strokeSum)];

    const buckets = [bucketFromFortune(wonF), bucketFromFortune(hyeongF)];
    if (ctx.givenLength > 1) buckets.push(bucketFromFortune(iF));
    buckets.push(bucketFromFortune(jeongF));

    const score = buckets.reduce((a, b) => a + b, 0);
    const isPassed = buckets.length > 0 && buckets.every(v => v >= 15);

    this.putInsight(ctx, 'SAGYEOK_SURI', score, isPassed,
      `${won.strokeSum}/${wonF}-${hyung.strokeSum}/${hyeongF}-${lee.strokeSum}/${iF}-${jung.strokeSum}/${jeongF}`,
      { won: won.strokeSum, hyeong: hyung.strokeSum, i: lee.strokeSum, jeong: jung.strokeSum });
  }

  private scoreSagyeokOhaeng(ctx: EvalContext): void {
    const arrangement = [this.frames[2], this.frames[1], this.frames[0]]
      .map(f => elementFromDigit(f.strokeSum).english) as ElementKey[];
    const distribution = distributionFromArrangement(arrangement);
    const adjacencyScore = calculateArrayScore(arrangement, ctx.surnameLength);
    const balanceScore = calculateBalanceScore(distribution);
    const score = (balanceScore + adjacencyScore) / 2;
    const threshold = ctx.surnameLength === 2 ? 65 : 60;

    const isPassed =
      checkFourFrameSuriElement(arrangement, ctx.givenLength) &&
      !countDominant(distribution) && adjacencyScore >= threshold && score >= 65;

    this.putInsight(ctx, 'SAGYEOK_OHAENG', score, isPassed,
      arrangement.join('-'), { distribution, adjacencyScore, balanceScore });
  }
}
