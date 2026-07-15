export interface StrengthComponents {
  companions: number;
  resources: number;
  outputs: number;
  wealth: number;
  officers: number;
}

export interface StrengthComponentView {
  /** Pre-adjustment scoring contributions retained for audit compatibility. */
  components: StrengthComponents;
  /** Contributions reconciled to the final support/pressure totals. */
  effectiveComponents?: StrengthComponents;
}

/**
 * Components used by downstream judgements must match the adjusted strength
 * totals. Raw components remain available for audit and backwards compatibility.
 */
export function strengthDecisionComponents(strength: StrengthComponentView): StrengthComponents {
  return strength.effectiveComponents ?? strength.components;
}
