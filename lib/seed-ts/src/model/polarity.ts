/**
 * Class defining Yin (陰) and Yang (陽) polarity and their harmony.
 */
export class Polarity {
  public static readonly Negative = new Polarity('Negative', '음', '陰', '달', '어둠', '유연함');
  public static readonly Positive = new Polarity('Positive', '양', '陽', '해', '밝음', '강인함');

  public static readonly Relation = {
    Harmony: { 
      id: 'Harmony', 
      name: '조화(調和)', 
      description: 'An ideal state where different polarities meet to balance Yin-Yang and create a virtuous cycle of energy.' 
    },
    Clash: { 
      id: 'Clash', 
      name: '편중(偏重)', 
      description: 'A state where energy is biased toward the same polarity, which may lead to a lack of flexibility or drive.' 
    }
  } as const;

  private constructor(
    public readonly english: string,
    public readonly korean: string,
    public readonly hanja: string,
    public readonly symbol: string,
    public readonly light: string,
    public readonly trait: string
  ) {}

  /**
   * Returns the polarity corresponding to the given stroke count.
   * Odd numbers are Positive (Yang), and even numbers are Negative (Yin).
   * @param strokes The number of strokes to evaluate.
   */
  public static get(strokes: number): Polarity {
    return strokes % 2 === 1 ? Polarity.Positive : Polarity.Negative;
  }

  /**
   * Returns the opposite polarity of the current instance.
   */
  public getOpposite(): Polarity {
    return this === Polarity.Positive ? Polarity.Negative : Polarity.Positive;
  }

  /**
   * Checks if the target polarity is harmonious (different from this instance).
   */
  public isHarmonious(target: Polarity): boolean {
    return this !== target;
  }

  /**
   * Checks if the target polarity is clashing (same as this instance).
   */
  public isClashing(target: Polarity): boolean {
    return this === target;
  }

  /**
   * Returns the specific relation object with the target polarity.
   */
  public getRelation(target: Polarity): typeof Polarity.Relation[keyof typeof Polarity.Relation] {
    return this.isHarmonious(target) ? Polarity.Relation.Harmony : Polarity.Relation.Clash;
  }

  /**
   * Returns all available polarity instances.
   */
  public static values(): Polarity[] {
    return [this.Negative, this.Positive];
  }
}