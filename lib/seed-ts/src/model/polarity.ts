export class Polarity {
  static readonly Negative = new Polarity('Negative', '음', '陰', '달', '어둠', '유연함');
  static readonly Positive = new Polarity('Positive', '양', '陽', '해', '밝음', '강인함');

  private constructor(
    public readonly english: string,
    public readonly korean: string,
    public readonly hanja: string,
    public readonly symbol: string,
    public readonly light: string,
    public readonly trait: string,
  ) {}

  static get(strokes: number): Polarity {
    return strokes % 2 === 1 ? Polarity.Positive : Polarity.Negative;
  }

  getOpposite(): Polarity {
    return this === Polarity.Positive ? Polarity.Negative : Polarity.Positive;
  }

  isHarmonious(target: Polarity): boolean { return this !== target; }
}
