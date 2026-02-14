import type { Energy, HanjaEntry } from "../core/types.js";
import { EnergyCalculator } from "./energy-calculator.js";
import { lastEnergy, mapNameEntries } from "./support.js";

export interface SequenceItemBase {
  readonly entry: HanjaEntry;
  energy: Energy | null;
}

export abstract class NameSequenceCalculator<TItem extends SequenceItemBase> extends EnergyCalculator {
  protected readonly items: TItem[];

  constructor(surnameEntries: readonly HanjaEntry[], givenEntries: readonly HanjaEntry[]) {
    super();
    this.items = mapNameEntries(surnameEntries, givenEntries, (entry, position) =>
      this.createItem(entry, position),
    );
  }

  protected abstract createItem(entry: HanjaEntry, position: number): TItem;
  protected abstract resolveEnergy(item: TItem): Energy;

  protected getItems(): readonly TItem[] {
    return this.items;
  }

  public calculate(): void {
    for (const item of this.items) {
      if (item.energy) {
        continue;
      }
      item.energy = this.resolveEnergy(item);
    }

    const energy = lastEnergy(this.items);
    if (energy) {
      this.setEnergy(energy);
    }
  }
}
