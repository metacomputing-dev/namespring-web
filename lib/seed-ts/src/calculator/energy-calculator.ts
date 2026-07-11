import type { Energy } from '../model/energy.js';
import { SeedCalculationError } from '../errors.js';

export type EnergyCalculationStatus = 'pending' | 'ready' | 'excluded';

const CALCULATION_STATUS = Symbol('EnergyCalculator.calculationStatus');

/**
 * 방문자 인터페이스: 각 계산 모델을 순회하며 전/중/후 로직을 수행합니다.
 */
export interface EnergyVisitor {
  preVisit(calculator: EnergyCalculator): void;
  visit(calculator: EnergyCalculator): void;
  postVisit(calculator: EnergyCalculator): void;
}

/**
 * 모든 계산 모델의 최상위 추상 클래스입니다.
 */
export abstract class EnergyCalculator {
  protected energy: Energy | null = null;
  private [CALCULATION_STATUS]: EnergyCalculationStatus = 'pending';

  /**
   * Explicit lifecycle for UI and aggregation consumers.
   * - pending: calculation has not completed and scoring must fail closed
   * - ready: calculation completed and a finite score is available
   * - excluded: this theory does not apply to the selected analysis mode; score is zero
   */
  public get calculationStatus(): EnergyCalculationStatus {
    return this[CALCULATION_STATUS];
  }

  public excludeFromAnalysis(): void {
    if (this[CALCULATION_STATUS] === 'excluded') return;
    this[CALCULATION_STATUS] = 'excluded';
  }

  protected shouldCalculate(): boolean {
    return this[CALCULATION_STATUS] === 'pending';
  }

  protected markReady(): void {
    if (this[CALCULATION_STATUS] === 'pending') {
      this[CALCULATION_STATUS] = 'ready';
    }
  }

  protected requireReadyOrExcluded(path: string): 'ready' | 'excluded' {
    if (this[CALCULATION_STATUS] === 'excluded') return 'excluded';
    if (this[CALCULATION_STATUS] === 'ready') return 'ready';
    throw new SeedCalculationError(
      'EMPTY_ENERGY_SET',
      'Calculator scoring requires a completed calculation.',
      path,
      { calculationStatus: this[CALCULATION_STATUS] },
    );
  }

  /**
   * 방문자를 수용하여 단계별 프로세스를 실행합니다.
   */
  public accept(visitor: EnergyVisitor): void {
    visitor.preVisit(this);
    visitor.visit(this);
    visitor.postVisit(this);
  }

  public abstract calculate(): void;

  public abstract getScore(): number;

  public getEnergy(): Energy | null {
    return this.energy;
  }

  public setEnergy(energy: Energy): void {
    this.energy = energy;
  }

  // 하위 클래스에서 식별을 위해 구현할 추상 속성
  public abstract get type(): string;
}
