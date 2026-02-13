/**
 * 오행(五行)의 속성과 순환 관계를 정의하는 클래스입니다.
 */
export class Element {
  public static readonly Wood = new Element('Wood', '목', '木', '동쪽', '청색', '봄');
  public static readonly Fire = new Element('Fire', '화', '火', '남쪽', '적색', '여름');
  public static readonly Earth = new Element('Earth', '토', '土', '중앙', '황색', '환절기');
  public static readonly Metal = new Element('Metal', '금', '金', '서쪽', '백색', '가을');
  public static readonly Water = new Element('Water', '수', '水', '북쪽', '흑색', '겨울');

  /**
   * 오행 사이의 관계를 정의하는 내부 구조입니다.
   */
  public static readonly Relation = {
    Comparison: { 
      id: 'Comparison', 
      name: '상비(相比)', 
      description: '같은 기운이 만나 서로의 힘을 북돋아 주고 든든한 버팀목이 되어주는 관계입니다.' 
    },
    Generating: { 
      id: 'Generating', 
      name: '상생(相生)', 
      description: '어머니가 자식을 돌보듯 한 기운이 다른 기운을 생해 주어 조화롭게 발전하는 길한 관계입니다.' 
    },
    Overcoming: { 
      id: 'Overcoming', 
      name: '상극(相剋)', 
      description: '서로의 기운이 충돌하거나 억제하여 에너지의 흐름이 막히고 갈등이 생길 수 있는 관계입니다.' 
    },
    Neutral: { 
      id: 'Neutral', 
      name: '평달(平達)', 
      description: '특별히 서로를 돕거나 해치지 않으며 무난하고 평탄하게 흐르는 관계입니다.' 
    }
  } as const;

  private constructor(
    public readonly english: string,
    public readonly korean: string,
    public readonly hanja: string,
    public readonly direction: string,
    public readonly color: string,
    public readonly season: string
  ) {}

  /**
   * [멤버 함수] 이 오행이 생(生)하는 다음 오행을 반환합니다.
   */
  public getGenerating(): Element {
    if (this === Element.Wood) return Element.Fire;
    if (this === Element.Fire) return Element.Earth;
    if (this === Element.Earth) return Element.Metal;
    if (this === Element.Metal) return Element.Water;
    return Element.Wood; // Water -> Wood
  }

  /**
   * [멤버 함수] 이 오행이 극(剋)하는 대상 오행을 반환합니다.
   */
  public getOvercoming(): Element {
    if (this === Element.Wood) return Element.Earth;
    if (this === Element.Earth) return Element.Water;
    if (this === Element.Water) return Element.Fire;
    if (this === Element.Fire) return Element.Metal;
    return Element.Wood; // Metal -> Wood
  }

  /**
   * [멤버 함수] 대상 오행과 상생(相生) 관계인지 확인합니다.
   */
  public isGenerating(target: Element): boolean {
    return this.getGenerating() === target;
  }

  /**
   * [멤버 함수] 대상 오행과 상극(相剋) 관계인지 확인합니다.
   */
  public isOvercoming(target: Element): boolean {
    return this.getOvercoming() === target;
  }

  /**
   * [멤버 함수] 대상 오행과 상비(相比) 관계인지 확인합니다.
   */
  public isSameAs(target: Element): boolean {
    return this === target;
  }

  /**
   * [멤버 함수] 대상 오행과의 구체적인 관계 객체를 반환합니다.
   */
  public getRelation(target: Element): typeof Element.Relation[keyof typeof Element.Relation] {
    if (this.isSameAs(target)) return Element.Relation.Comparison;
    if (this.isGenerating(target)) return Element.Relation.Generating;
    if (this.isOvercoming(target)) return Element.Relation.Overcoming;
    return Element.Relation.Neutral;
  }

  public static values(): Element[] {
    return [this.Wood, this.Fire, this.Earth, this.Metal, this.Water];
  }
}