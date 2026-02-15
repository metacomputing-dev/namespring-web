export class Element {
  static readonly Wood = new Element('Wood');
  static readonly Fire = new Element('Fire');
  static readonly Earth = new Element('Earth');
  static readonly Metal = new Element('Metal');
  static readonly Water = new Element('Water');

  private constructor(public readonly english: string) {}

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

  isGenerating(target: Element): boolean {
    const gen = this === Element.Wood ? Element.Fire : this === Element.Fire ? Element.Earth
      : this === Element.Earth ? Element.Metal : this === Element.Metal ? Element.Water : Element.Wood;
    return gen === target;
  }

  isOvercoming(target: Element): boolean {
    const over = this === Element.Wood ? Element.Earth : this === Element.Earth ? Element.Water
      : this === Element.Water ? Element.Fire : this === Element.Fire ? Element.Metal : Element.Wood;
    return over === target;
  }
}
