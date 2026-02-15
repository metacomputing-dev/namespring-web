/**
 * frame.ts -- FrameCalculator
 *
 * Owns two evaluation frames: SAGYEOK_SURI (fortune-bucket scoring)
 * and SAGYEOK_OHAENG (element-arrangement scoring).
 *
 * Replaces the legacy FourFrameCalculator in frame-calculator.ts.
 */

import { NameCalculator, type EvalContext, type AnalysisDetail } from './base.js';
import type { CalculatorPacket } from './graph.js';
import { Energy } from '../model/energy.js';
import { Element } from '../model/element.js';
import { Polarity } from '../model/polarity.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import type { FourFrameAnalysis } from '../types.js';
import type { ElementKey } from './element-cycle.js';
import { distributionFromArrangement } from './element-cycle.js';
import {
  calculateArrayScore,
  calculateBalanceScore,
  checkFourFrameSuriElement,
  countDominant,
  bucketFromFortune,
} from './rules.js';
import {
  NODE_FORTUNE_BUCKET_PASS,
  NODE_FOUR_FRAME_ELEMENT_PASS,
  NODE_ADJACENCY_THRESHOLD_SINGLE_CHAR,
  NODE_ADJACENCY_THRESHOLD_TWO_CHAR,
} from './constants.js';

// ── Module-private helpers ────────────────────────────────────────

function sum(values: readonly number[]): number {
  let out = 0;
  for (const v of values) out += v;
  return out;
}

function adjustTo81(value: number): number {
  if (value <= 81) return value;
  return ((value - 1) % 81) + 1;
}

/** Determines Element from the last digit of a stroke sum (수리오행). */
function elementFromDigit(strokeSum: number): Element {
  const d = strokeSum % 10;
  if (d === 1 || d === 2) return Element.Wood;
  if (d === 3 || d === 4) return Element.Fire;
  if (d === 5 || d === 6) return Element.Earth;
  if (d === 7 || d === 8) return Element.Metal;
  return Element.Water; // 9 and 0
}

// ── Frame data class ──────────────────────────────────────────────

export class Frame {
  public energy: Energy | null = null;
  public luckLevel: number = -1;

  constructor(
    public readonly type: 'won' | 'hyung' | 'lee' | 'jung',
    public readonly strokeSum: number,
  ) {}
}

// ── Signal weights (mirrored from evaluator constants) ────────────

const SIGNAL_WEIGHT_MAJOR = 1.0;
const SIGNAL_WEIGHT_MINOR = 0.6;

// ── FrameCalculator ───────────────────────────────────────────────

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

    // Pad single-char given names with a trailing zero
    const padded = [...this.givenNameStrokes];
    if (padded.length === 1) padded.push(0);

    const mid = Math.floor(padded.length / 2);
    const givenUpperSum = sum(padded.slice(0, mid));
    const givenLowerSum = sum(padded.slice(mid));
    const surnameTotal = sum(this.surnameStrokes);
    const givenTotal = sum(this.givenNameStrokes);

    this.frames = [
      new Frame('won', sum(padded)),
      new Frame('hyung', adjustTo81(surnameTotal + givenUpperSum)),
      new Frame('lee', adjustTo81(surnameTotal + givenLowerSum)),
      new Frame('jung', adjustTo81(surnameTotal + givenTotal)),
    ];
  }

  // ── CalculatorNode interface ──────────────────────────────────

  visit(ctx: EvalContext): void {
    // Assign energy to each frame
    for (const frame of this.frames) {
      frame.energy = new Energy(
        Polarity.get(frame.strokeSum),
        elementFromDigit(frame.strokeSum),
      );
    }

    this.scoreSagyeokSuri(ctx);
    this.scoreSagyeokOhaeng(ctx);
  }

  backward(_ctx: EvalContext): CalculatorPacket {
    return {
      nodeId: this.id,
      signals: [
        this.signal('SAGYEOK_SURI', _ctx, SIGNAL_WEIGHT_MAJOR),
        this.signal('SAGYEOK_OHAENG', _ctx, SIGNAL_WEIGHT_MINOR),
      ],
    };
  }

  // ── Analysis ──────────────────────────────────────────────────

  getAnalysis(): AnalysisDetail<FourFrameAnalysis> {
    const energies = this.frames
      .map(f => f.energy)
      .filter((e): e is Energy => e !== null);
    const polarityScore = Energy.getPolarityScore(energies);
    const elementScore = Energy.getElementScore(energies);

    return {
      type: this.id,
      score: Energy.getScore(energies),
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
        luckScore: 0,
      },
    };
  }

  // ── Public getters ────────────────────────────────────────────

  getFrameNumbers(): { won: number; hyeong: number; i: number; jeong: number } {
    return {
      won: this.frames.find(f => f.type === 'won')!.strokeSum,
      hyeong: this.frames.find(f => f.type === 'hyung')!.strokeSum,
      i: this.frames.find(f => f.type === 'lee')!.strokeSum,
      jeong: this.frames.find(f => f.type === 'jung')!.strokeSum,
    };
  }

  getCompatibilityElementArrangement(): string[] {
    const n = this.getFrameNumbers();
    return [
      elementFromDigit(n.i),
      elementFromDigit(n.hyeong),
      elementFromDigit(n.won),
    ].map(el => el.english);
  }

  // ── Private scoring ───────────────────────────────────────────

  /** SAGYEOK_SURI -- fortune-bucket scoring per frame number. */
  private scoreSagyeokSuri(ctx: EvalContext): void {
    const nums = this.getFrameNumbers();
    const fortune = (num: number): string => ctx.luckyMap.get(num) ?? '';

    const wonF = fortune(nums.won);
    const hyeongF = fortune(nums.hyeong);
    const iF = fortune(nums.i);
    const jeongF = fortune(nums.jeong);

    // won, hyeong, jeong always included; i only if multi-char given name
    const buckets = [bucketFromFortune(wonF), bucketFromFortune(hyeongF)];
    if (ctx.givenLength > 1) buckets.push(bucketFromFortune(iF));
    buckets.push(bucketFromFortune(jeongF));

    const score = buckets.reduce((a, b) => a + b, 0);
    const isPassed = buckets.length > 0 && buckets.every(v => v >= NODE_FORTUNE_BUCKET_PASS);

    this.setInsight(
      ctx,
      NameCalculator.createInsight('SAGYEOK_SURI', score, isPassed,
        `${nums.won}/${wonF}-${nums.hyeong}/${hyeongF}-${nums.i}/${iF}-${nums.jeong}/${jeongF}`,
        { won: nums.won, hyeong: nums.hyeong, i: nums.i, jeong: nums.jeong }),
    );
  }

  /** SAGYEOK_OHAENG -- element-arrangement adjacency + balance scoring. */
  private scoreSagyeokOhaeng(ctx: EvalContext): void {
    const arrangement = this.getCompatibilityElementArrangement() as ElementKey[];
    const distribution = distributionFromArrangement(arrangement);
    const adjacencyScore = calculateArrayScore(arrangement, ctx.surnameLength);
    const balanceScore = calculateBalanceScore(distribution);
    const score = (balanceScore + adjacencyScore) / 2;

    const threshold = ctx.surnameLength === 2
      ? NODE_ADJACENCY_THRESHOLD_TWO_CHAR
      : NODE_ADJACENCY_THRESHOLD_SINGLE_CHAR;

    const isPassed =
      checkFourFrameSuriElement(arrangement, ctx.givenLength) &&
      !countDominant(distribution) &&
      adjacencyScore >= threshold &&
      score >= NODE_FOUR_FRAME_ELEMENT_PASS;

    this.setInsight(
      ctx,
      NameCalculator.createInsight('SAGYEOK_OHAENG', score, isPassed, arrangement.join('-'), {
        distribution, adjacencyScore, balanceScore,
      }),
    );
  }
}
