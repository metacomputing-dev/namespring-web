/**
 * Element -- one of the Five Elements (Oh-Haeng) used in East-Asian naming.
 *
 * The five elements follow a fixed cycle:
 *   Wood -> Fire -> Earth -> Metal -> Water -> Wood -> ...
 *
 * Two relationships matter for name analysis:
 *   - "Generating" (Sang-Saeng):  an element feeds the NEXT element in the cycle.
 *       Example: Wood generates Fire (wood fuels fire).
 *   - "Overcoming" (Sang-Geuk): an element weakens the element TWO steps ahead.
 *       Example: Wood overcomes Earth (roots break soil).
 */

import fiveElementsConfig from '../../config/five-elements.json';

// ---------------------------------------------------------------------------
// Read the ordered cycle from the config file so the names and order live in
// one place (config/five-elements.json) rather than being duplicated here.
// ---------------------------------------------------------------------------
const ELEMENT_CYCLE_DATA: ReadonlyArray<{ english: string; korean: string }> =
  fiveElementsConfig.cycle;

const TOTAL_ELEMENTS = ELEMENT_CYCLE_DATA.length; // always 5


export class Element {

  // --- The five singleton instances, one per element -----------------------

  static readonly Wood  = new Element('Wood',  '목');
  static readonly Fire  = new Element('Fire',  '화');
  static readonly Earth = new Element('Earth', '토');
  static readonly Metal = new Element('Metal', '금');
  static readonly Water = new Element('Water', '수');

  // --- Ordered cycle used for relationship lookups -------------------------

  private static readonly CYCLE: readonly Element[] = [
    Element.Wood,
    Element.Fire,
    Element.Earth,
    Element.Metal,
    Element.Water,
  ];

  // --- Constructor (private -- only the five singletons above exist) -------

  private constructor(
    public readonly english: string,
    public readonly korean: string,
  ) {}

  // --- Static lookup -------------------------------------------------------

  /**
   * Find an Element by its English name (e.g. "Wood").
   * Returns Element.Earth as a safe default if the name is not recognised.
   */
  static get(name: string): Element {
    const match = Element.CYCLE.find(
      (element) => element.english === name,
    );
    return match ?? Element.Earth;
  }

  // --- Cycle-position helper (private) -------------------------------------

  /**
   * Return this element's zero-based position in the cycle.
   *   Wood=0, Fire=1, Earth=2, Metal=3, Water=4
   */
  private positionInCycle(): number {
    return Element.CYCLE.indexOf(this);
  }

  // --- Relationship checks -------------------------------------------------

  /**
   * Does this element GENERATE the target?
   *
   * "Generating" means the target is the very next element in the cycle.
   * Example: Wood.isGenerating(Fire) === true
   */
  isGenerating(target: Element): boolean {
    const nextPosition = (this.positionInCycle() + 1) % TOTAL_ELEMENTS;
    return Element.CYCLE[nextPosition] === target;
  }

  /**
   * Does this element OVERCOME the target?
   *
   * "Overcoming" means the target is two steps ahead in the cycle.
   * Example: Wood.isOvercoming(Earth) === true
   */
  isOvercoming(target: Element): boolean {
    const twoAheadPosition = (this.positionInCycle() + 2) % TOTAL_ELEMENTS;
    return Element.CYCLE[twoAheadPosition] === target;
  }

  /**
   * Are this element and the target the same element?
   */
  isSameAs(target: Element): boolean {
    return this === target;
  }
}
