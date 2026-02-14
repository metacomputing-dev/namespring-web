import type { HanjaEntry } from "../database/hanja-repository.js";
import { elementFromStrokeLastDigit } from "../model/element.js";
import { createEnergy, type Energy } from "../model/energy.js";
import { polarityFromStrokeCount } from "../model/polarity.js";
import { EnergyCalculator } from "./energy-calculator.js";

export type FourFrameType = "won" | "hyeong" | "i" | "jeong";

export interface FourFrame {
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

function buildFrames(
  surnameEntries: readonly HanjaEntry[],
  givenEntries: readonly HanjaEntry[],
): FourFrame[] {
  const surnameStrokes = surnameEntries.map((entry) => entry.strokes);
  const givenStrokes = givenEntries.map((entry) => entry.strokes);

  const paddedGiven = givenStrokes.length === 1 ? [givenStrokes[0] ?? 0, 0] : [...givenStrokes];
  const mid = Math.floor(paddedGiven.length / 2);

  const surnameTotal = sum(surnameStrokes);
  const givenOriginalTotal = sum(givenStrokes);
  const upper = sum(paddedGiven.slice(0, mid));
  const lower = sum(paddedGiven.slice(mid));

  return [
    { type: "won", strokeCount: sum(paddedGiven), energy: null },
    { type: "hyeong", strokeCount: surnameTotal + upper, energy: null },
    { type: "i", strokeCount: surnameTotal + lower, energy: null },
    { type: "jeong", strokeCount: surnameTotal + givenOriginalTotal, energy: null },
  ];
}

export class FourFrameCalculator extends EnergyCalculator {
  public readonly type = "FourFrame";
  private readonly frames: FourFrame[];

  constructor(surnameEntries: HanjaEntry[], givenEntries: HanjaEntry[]) {
    super();
    this.frames = buildFrames(surnameEntries, givenEntries);
  }

  public calculate(): void {
    for (const frame of this.frames) {
      if (frame.energy) {
        continue;
      }
      frame.energy = createEnergy(
        elementFromStrokeLastDigit(frame.strokeCount),
        polarityFromStrokeCount(frame.strokeCount),
      );
    }

    const jeong = this.getFrame("jeong");
    if (jeong?.energy) {
      this.setEnergy(jeong.energy);
    }
  }

  public getFrames(): readonly FourFrame[] {
    return this.frames;
  }

  public getFrame(type: FourFrameType): FourFrame | undefined {
    return this.frames.find((frame) => frame.type === type);
  }
}
