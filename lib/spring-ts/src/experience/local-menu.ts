/**
 * Compatibility entry for the V1 local product contracts.
 *
 * Repository/engine builders retain their original async signatures but load
 * through literal dynamic edges. Birth preview, local context, validators,
 * and share projection therefore remain usable before the Worker/SQL chunks
 * are requested.
 */
import type { HanjaRepository } from '../../../seed-ts/src/database/hanja-repository.js';
import type { SpringEngine } from '../spring-engine.js';
import type {
  LocalAnalysisContextV1,
  LocalHanjaLookupRequestV1,
  LocalHanjaLookupV1,
  LocalHomeSummaryV1,
} from './local-menu-types.js';

export {
  assertLocalAnalysisContextV1,
  createLocalAnalysisContextV1,
} from './local-context.js';
export {
  assertLocalBirthInputV1,
  assertLocalBirthPreviewV1,
  buildLocalBirthPreviewV1,
} from './local-birth-preview.js';
export {
  assertLocalHomeAvailabilityContractV1,
  assertLocalHomeCoreFactsContractV1,
  assertLocalHomeSummaryV1,
} from './local-home-contract.js';
export { LOCAL_HOME_CAPABILITIES_V1 } from './local-home-capabilities.js';
export { assertLocalHanjaLookupV1 } from './local-hanja-contract.js';
export {
  assertLocalShareExportV1,
  buildLocalShareExportV1,
} from './local-share.js';

export async function buildLocalHomeSummaryV1(
  engine: SpringEngine,
  context: LocalAnalysisContextV1,
): Promise<LocalHomeSummaryV1> {
  const module = await import('./local-home.js');
  return module.buildLocalHomeSummaryV1(engine, context);
}

export async function buildLocalHanjaLookupV1(
  repository: HanjaRepository,
  request: LocalHanjaLookupRequestV1,
): Promise<LocalHanjaLookupV1> {
  const module = await import('./local-hanja.js');
  return module.buildLocalHanjaLookupV1(repository, request);
}
