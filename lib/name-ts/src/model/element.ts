export class Element {
  static readonly Wood = new Element('Wood');
  static readonly Fire = new Element('Fire');
  static readonly Earth = new Element('Earth');
  static readonly Metal = new Element('Metal');
  static readonly Water = new Element('Water');

  private constructor(public readonly english: string) {}

  private static readonly CYCLE = [Element.Wood, Element.Fire, Element.Earth, Element.Metal, Element.Water];
  static get(name: string): Element { return Element.CYCLE.find(e => e.english === name) ?? Element.Earth; }

  private idx(): number { return Element.CYCLE.indexOf(this); }
  isGenerating(target: Element): boolean { return Element.CYCLE[(this.idx() + 1) % 5] === target; }
  isOvercoming(target: Element): boolean { return Element.CYCLE[(this.idx() + 2) % 5] === target; }
  isSameAs(target: Element): boolean { return this === target; }
}
