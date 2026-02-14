import type { Element, Energy, FourFrame, HanjaEntry } from "../core/types.js";
import { elementFromStrokeLastDigit, elementToCoreSymbol } from "../model/element.js";
import { polarityFromStrokeCount as modelPolarityFromStrokeCount, toCorePolarity } from "../model/polarity.js";
import { EnergyCalculator } from "./energy-calculator.js";

export type FourFrameType = "won" | "hyeong" | "i" | "jeong";

export interface FourFrameMetric {
  type: FourFrameType;
  strokeCount: number;
  energy: Energy | null;
}

function sum(values: readonly number[]): number {
  let out = 0;
  for (const value of values) {
    out += value;
  }
  return out;
}

function elementFromStrokeCount(strokeCount: number): Element {
  return elementToCoreSymbol(elementFromStrokeLastDigit(strokeCount));
}

function polarityFromStrokeCount(strokeCount: number): Energy["polarity"] {
  return toCorePolarity(modelPolarityFromStrokeCount(strokeCount));
}

function toEnergy(strokeCount: number): Energy {
  return {
    element: elementFromStrokeCount(strokeCount),
    polarity: polarityFromStrokeCount(strokeCount),
  };
}

export function adjustTo81(value: number): number {
  if (value <= 81) {
    return value;
  }
  return ((value - 1) % 81) + 1;
}

export function calculateFourFrameNumbersFromStrokes(
  surnameStrokeCounts: readonly number[],
  givenStrokeCounts: readonly number[],
): FourFrame {
  const padded = [...givenStrokeCounts];
  if (padded.length === 1) {
    padded.push(0);
  }
  const mid = Math.floor(padded.length / 2);
  const givenUpperSum = sum(padded.slice(0, mid));
  const givenLowerSum = sum(padded.slice(mid));
  const surnameTotal = sum(surnameStrokeCounts);
  const givenTotal = sum(givenStrokeCounts);

  return {
    won: adjustTo81(sum(padded)),
    hyeong: adjustTo81(surnameTotal + givenUpperSum),
    i: adjustTo81(surnameTotal + givenLowerSum),
    jeong: adjustTo81(surnameTotal + givenTotal),
  };
}

function buildFrames(
  surnameEntries: readonly HanjaEntry[],
  givenEntries: readonly HanjaEntry[],
): FourFrameMetric[] {
  const surnameStrokes = surnameEntries.map((entry) => entry.strokeCount);
  const givenStrokes = givenEntries.map((entry) => entry.strokeCount);
  const numbers = calculateFourFrameNumbersFromStrokes(surnameStrokes, givenStrokes);

  return [
    { type: "won", strokeCount: numbers.won, energy: null },
    { type: "hyeong", strokeCount: numbers.hyeong, energy: null },
    { type: "i", strokeCount: numbers.i, energy: null },
    { type: "jeong", strokeCount: numbers.jeong, energy: null },
  ];
}

export class FourFrameCalculator extends EnergyCalculator {
  public readonly type = "FourFrame";
  private readonly frames: FourFrameMetric[];
  private readonly frameByType: Record<FourFrameType, FourFrameMetric>;

  constructor(surnameEntries: readonly HanjaEntry[], givenEntries: readonly HanjaEntry[]) {
    super();
    this.frames = buildFrames(surnameEntries, givenEntries);
    this.frameByType = {
      won: this.frames[0] as FourFrameMetric,
      hyeong: this.frames[1] as FourFrameMetric,
      i: this.frames[2] as FourFrameMetric,
      jeong: this.frames[3] as FourFrameMetric,
    };
  }

  public calculate(): void {
    for (const frame of this.frames) {
      if (frame.energy) {
        continue;
      }
      frame.energy = toEnergy(frame.strokeCount);
    }

    const jeong = this.getFrame("jeong");
    if (jeong?.energy) {
      this.setEnergy(jeong.energy);
    }
  }

  public getFrames(): readonly FourFrameMetric[] {
    return this.frames;
  }

  public getFrame(type: FourFrameType): FourFrameMetric | undefined {
    return this.frameByType[type];
  }

  public getFrameNumbers(): FourFrame {
    return {
      won: this.frameByType.won.strokeCount,
      hyeong: this.frameByType.hyeong.strokeCount,
      i: this.frameByType.i.strokeCount,
      jeong: this.frameByType.jeong.strokeCount,
    };
  }

  public getCompatibilityElementArrangement(): Element[] {
    const numbers = this.getFrameNumbers();
    return [
      elementFromStrokeCount(numbers.i),
      elementFromStrokeCount(numbers.hyeong),
      elementFromStrokeCount(numbers.won),
    ];
  }
}
