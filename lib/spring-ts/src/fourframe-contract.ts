/**
 * Compatibility facade. The pure contract is owned by seed-ts so the embedded
 * catalog and SpringEngine compile exactly the same 1..81/lucky-level rules.
 */
export * from '../../seed-ts/src/fourframe-contract.js';
export type {
  CompiledFourFrameMeaningContract,
} from '../../seed-ts/src/fourframe-catalog.js';
