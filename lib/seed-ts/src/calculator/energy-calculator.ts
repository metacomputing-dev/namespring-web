/**
 * Structured analysis result returned by each calculator.
 */
export interface AnalysisDetail<T = unknown> {
  readonly type: string;
  readonly score: number;
  readonly polarityScore: number;
  readonly elementScore: number;
  readonly data: T;
}

/**
 * Abstract base class for all naming energy calculators.
 * Subclasses implement doCalculate() for their specific logic.
 */
export abstract class EnergyCalculator {
  private _calculated = false;

  /**
   * Runs the calculation exactly once (idempotent guard).
   */
  public calculate(): void {
    if (this._calculated) return;
    this.doCalculate();
    this._calculated = true;
  }

  protected abstract doCalculate(): void;
  public abstract getScore(): number;
  public abstract getAnalysis(): AnalysisDetail;
  public abstract get type(): string;
}
