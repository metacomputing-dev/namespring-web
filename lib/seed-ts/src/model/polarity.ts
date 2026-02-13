/**
 * 음(陰)과 양(陽)의 기운인 극성(Polarity)과 그 조화를 정의하는 클래스입니다.
 */
export class Polarity {
  public static readonly Negative = new Polarity('Negative', '음', '陰', '달', '어둠', '유연함');
  public static readonly Positive = new Polarity('Positive', '양', '陽', '해', '밝음', '강인함');

  public static readonly Relation = {
    Harmony: { 
      id: 'Harmony', 
      name: '조화(調和)', 
      description: '서로 다른 극성이 만나 음양의 균형을 이루고 에너지가 선순환하는 이상적인 상태입니다.' 
    },
    Clash: { 
      id: 'Clash', 
      name: '편중(偏重)', 
      description: '같은 극성으로 기운이 치우쳐져 유연함이나 추진력이 부족해질 수 있는 상태입니다.' 
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
   * [멤버 함수] 현재 극성과 반대되는 극성을 반환합니다.
   */
  public getOpposite(): Polarity {
    return this === Polarity.Positive ? Polarity.Negative : Polarity.Positive;
  }

  /**
   * [멤버 함수] 대상 극성과 조화로운 관계(서로 다른 극성)인지 확인합니다.
   */
  public isHarmonious(target: Polarity): boolean {
    return this !== target;
  }

  /**
   * [멤버 함수] 대상 극성과 충돌하는 관계(같은 극성)인지 확인합니다.
   */
  public isClashing(target: Polarity): boolean {
    return this === target;
  }

  /**
   * [멤버 함수] 대상 극성과의 구체적인 관계 객체를 반환합니다.
   */
  public getRelation(target: Polarity): typeof Polarity.Relation[keyof typeof Polarity.Relation] {
    return this.isHarmonious(target) ? Polarity.Relation.Harmony : Polarity.Relation.Clash;
  }

  public static values(): Polarity[] {
    return [this.Negative, this.Positive];
  }
}