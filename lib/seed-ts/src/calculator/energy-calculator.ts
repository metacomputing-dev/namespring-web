import type { Energy } from "../model/energy.js";

export type EnergyCalculatorType = "Hanja" | "Sound" | "FourFrame";

export interface EnergyVisitor<T extends EnergyCalculator = EnergyCalculator> {
  preVisit?(calculator: T): void;
  visit(calculator: T): void;
  postVisit?(calculator: T): void;
}

export abstract class EnergyCalculator {
  protected energy: Energy | null = null;

  public abstract readonly type: EnergyCalculatorType;
  public abstract calculate(): void;

  public accept(visitor: EnergyVisitor): void {
    visitor.preVisit?.(this);
    visitor.visit(this);
    visitor.postVisit?.(this);
  }

  public getEnergy(): Energy | null {
    return this.energy;
  }

  public setEnergy(energy: Energy): void {
    this.energy = energy;
  }
}
