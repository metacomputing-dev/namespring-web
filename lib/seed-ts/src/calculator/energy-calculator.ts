import type { Energy } from "../core/types.js";

export type EnergyCalculatorType = "Hanja" | "Sound" | "FourFrame";

export interface EnergyVisitor<TContext = void, TCalculator extends EnergyCalculator = EnergyCalculator> {
  preVisit?(calculator: TCalculator, context: TContext): void;
  visit(calculator: TCalculator, context: TContext): void;
  postVisit?(calculator: TCalculator, context: TContext): void;
}

export abstract class EnergyCalculator {
  protected energy: Energy | null = null;

  public abstract readonly type: EnergyCalculatorType;
  public abstract calculate(): void;

  public accept<TContext = void>(visitor: EnergyVisitor<TContext>, context: TContext): void {
    visitor.preVisit?.(this, context);
    visitor.visit(this, context);
    visitor.postVisit?.(this, context);
  }

  public getEnergy(): Energy | null {
    return this.energy;
  }

  public setEnergy(energy: Energy): void {
    this.energy = energy;
  }
}
