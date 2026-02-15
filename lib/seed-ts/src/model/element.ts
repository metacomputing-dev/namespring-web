export class Element {
  static readonly Wood = new Element('Wood', '목', '木', 'East', 'Blue', 'Spring');
  static readonly Fire = new Element('Fire', '화', '火', 'South', 'Red', 'Summer');
  static readonly Earth = new Element('Earth', '토', '土', 'Center', 'Yellow', 'Between Seasons');
  static readonly Metal = new Element('Metal', '금', '金', 'West', 'White', 'Autumn');
  static readonly Water = new Element('Water', '수', '水', 'North', 'Black', 'Winter');

  private constructor(
    public readonly english: string,
    public readonly korean: string,
    public readonly hanja: string,
    public readonly direction: string,
    public readonly color: string,
    public readonly season: string,
  ) {}

  static get(name: string): Element {
    switch (name) {
      case 'Wood': return Element.Wood;
      case 'Fire': return Element.Fire;
      case 'Earth': return Element.Earth;
      case 'Metal': return Element.Metal;
      case 'Water': return Element.Water;
      default: return Element.Earth;
    }
  }

  getGenerating(): Element {
    if (this === Element.Wood) return Element.Fire;
    if (this === Element.Fire) return Element.Earth;
    if (this === Element.Earth) return Element.Metal;
    if (this === Element.Metal) return Element.Water;
    return Element.Wood;
  }

  getOvercoming(): Element {
    if (this === Element.Wood) return Element.Earth;
    if (this === Element.Earth) return Element.Water;
    if (this === Element.Water) return Element.Fire;
    if (this === Element.Fire) return Element.Metal;
    return Element.Wood;
  }

  isGenerating(target: Element): boolean { return this.getGenerating() === target; }
  isOvercoming(target: Element): boolean { return this.getOvercoming() === target; }
}
