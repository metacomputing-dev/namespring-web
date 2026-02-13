import type { Energy } from '../model/energy';

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

  /**
   * 방문자를 수용하여 단계별 프로세스를 실행합니다.
   */
  public accept(visitor: EnergyVisitor): void {
    visitor.preVisit(this);
    visitor.visit(this);
    visitor.postVisit(this);
  }

  public abstract calculate(): void;

  public getEnergy(): Energy | null {
    return this.energy;
  }

  public setEnergy(energy: Energy): void {
    this.energy = energy;
  }

  // 하위 클래스에서 식별을 위해 구현할 추상 속성
  public abstract get type(): string;
}