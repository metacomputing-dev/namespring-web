export interface StrengthComponents {
  companions: number;
  resources: number;
  outputs: number;
  wealth: number;
  officers: number;
}

export interface StrengthComponentView {
  /** Unadjusted strength ledger under the selected strength policy. */
  components: StrengthComponents;
  /** Contributions reconciled to the final support/pressure totals. */
  effectiveComponents?: StrengthComponents;
}

/**
 * Components used by downstream judgements must match the adjusted strength
 * totals. Unadjusted components remain available for audit.
 */
export function strengthDecisionComponents(strength: StrengthComponentView): StrengthComponents {
  return strength.effectiveComponents ?? strength.components;
}
