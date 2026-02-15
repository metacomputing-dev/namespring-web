export class Polarity {
  static readonly Negative = new Polarity('Negative');
  static readonly Positive = new Polarity('Positive');
  private constructor(public readonly english: string) {}

  static get(strokes: number): Polarity {
    return strokes % 2 === 1 ? Polarity.Positive : Polarity.Negative;
  }
}
