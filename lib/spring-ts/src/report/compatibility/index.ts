export { buildCoupleCompatibilityV1 } from './build-couple-compatibility.js';
export { buildContextNotes, derivePairContext } from './context.js';
export { euRo, hasBatchim, renderBranchPairCopy, resolveBundle } from './copy-bundles.js';
export type {
  CopyBlockV1,
  CopyBundleV1,
  CopySituationIdV1,
  CopySituationParamsMapV1,
  CopyVoiceV1,
  CopyWriterV1,
} from './copy-bundles.js';
export { COUPLE_COMPATIBILITY_SCHEMA_V1 } from './types.js';
export type * from './types.js';
export {
  BRANCH_CODES,
  STEM_CODES,
  branchGlyphV1,
  lookupBranchPair,
  phoneticElementOfHangul,
  stemGlyphV1,
  stemHapElement,
  isStemChung,
  tenGodOf,
} from './relation-tables.js';
