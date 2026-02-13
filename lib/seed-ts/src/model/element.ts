/**
 * Class defining the properties and cyclical relationships of the Five Elements (五行).
 */
export class Element {
  public static readonly Wood = new Element('Wood', '목', '木', 'East', 'Blue', 'Spring');
  public static readonly Fire = new Element('Fire', '화', '火', 'South', 'Red', 'Summer');
  public static readonly Earth = new Element('Earth', '토', '土', 'Center', 'Yellow', 'Between Seasons');
  public static readonly Metal = new Element('Metal', '금', '金', 'West', 'White', 'Autumn');
  public static readonly Water = new Element('Water', '수', '水', 'North', 'Black', 'Winter');

  /**
   * Defines internal relationships between elements.
   */
  public static readonly Relation = {
    Comparison: { 
      id: 'Comparison', 
      name: '상비(相比)', 
      description: 'A relationship where same energies meet to support and strengthen each other.' 
    },
    Generating: { 
      id: 'Generating', 
      name: '상생(相生)', 
      description: 'A beneficial relationship where one energy nurtures another, similar to a mother caring for a child.' 
    },
    Overcoming: { 
      id: 'Overcoming', 
      name: '상극(相剋)', 
      description: 'A relationship where energies inhibit or suppress each other, potentially causing blockages in energy flow.' 
    },
    Neutral: { 
      id: 'Neutral', 
      name: '평달(平達)', 
      description: 'A neutral state where energies do not significantly help or harm each other.' 
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
   * Returns the Element instance corresponding to the given string name.
   * @param name The name of the element (e.g., 'Wood', 'Fire').
   * @returns The matched Element instance or Earth as default.
   */
  public static get(name: string): Element {
    switch (name) {
      case 'Wood': return Element.Wood;
      case 'Fire': return Element.Fire;
      case 'Earth': return Element.Earth;
      case 'Metal': return Element.Metal;
      case 'Water': return Element.Water;
      default: return Element.Earth; // Fallback to Earth
    }
  }

  /**
   * Returns the next element in the generating (Sangseng) cycle.
   */
  public getGenerating(): Element {
    if (this === Element.Wood) return Element.Fire;
    if (this === Element.Fire) return Element.Earth;
    if (this === Element.Earth) return Element.Metal;
    if (this === Element.Metal) return Element.Water;
    return Element.Wood; // Water -> Wood
  }

  /**
   * Returns the target element in the overcoming (Sanggeuk) cycle.
   */
  public getOvercoming(): Element {
    if (this === Element.Wood) return Element.Earth;
    if (this === Element.Earth) return Element.Water;
    if (this === Element.Water) return Element.Fire;
    if (this === Element.Fire) return Element.Metal;
    return Element.Wood; // Metal -> Wood
  }

  /**
   * Checks if this element generates the target element.
   */
  public isGenerating(target: Element): boolean {
    return this.getGenerating() === target;
  }

  /**
   * Checks if this element overcomes the target element.
   */
  public isOvercoming(target: Element): boolean {
    return this.getOvercoming() === target;
  }

  /**
   * Checks if the target element is the same as this instance.
   */
  public isSameAs(target: Element): boolean {
    return this === target;
  }

  /**
   * Returns the specific relationship object with the target element.
   */
  public getRelation(target: Element): typeof Element.Relation[keyof typeof Element.Relation] {
    if (this.isSameAs(target)) return Element.Relation.Comparison;
    if (this.isGenerating(target)) return Element.Relation.Generating;
    if (this.isOvercoming(target)) return Element.Relation.Overcoming;
    return Element.Relation.Neutral;
  }

  /**
   * Returns all available element instances.
   */
  public static values(): Element[] {
    return [this.Wood, this.Fire, this.Earth, this.Metal, this.Water];
  }
}