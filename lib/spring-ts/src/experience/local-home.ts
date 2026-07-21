import { assessNatalEvidenceV1 } from '../natal-evidence.js';
import { SpringEngine } from '../spring-engine.js';
import {
  LOCAL_HOME_SUMMARY_SCHEMA_V1,
  type LocalAnalysisContextV1,
  type LocalHomeAvailabilityReasonV1,
  type LocalHomeAvailabilityV1,
  type LocalHomeSummaryV1,
} from './local-menu-types.js';
import { buildLocalBirthPreviewV1 } from './local-birth-preview.js';
import { assertLocalAnalysisContextV1 } from './local-context.js';
import { LOCAL_HOME_CAPABILITIES_V1 } from './local-home-capabilities.js';
import {
  assertLocalHomeSummaryV1,
  buildLocalHomeCoreFactsContractV1,
} from './local-home-contract.js';
import {
  failLocalMenu,
  freezeLocalOwned,
} from './local-menu-primitives.js';

export async function buildLocalHomeSummaryV1(
  engine: SpringEngine,
  context: LocalAnalysisContextV1,
): Promise<LocalHomeSummaryV1> {
  if (!(engine instanceof SpringEngine)) failLocalMenu('SPRING_ENGINE_REQUIRED');
  assertLocalAnalysisContextV1(context);
  // Natal calculation receives birth/options only. The empty surname is a
  // legacy SpringRequest carrier and makes name independence executable, not
  // merely documentary: changing a candidate cannot alter this call.
  const saju = await engine.getSajuReport({
    birth: context.birth,
    surname: [],
    mode: 'recommend',
    ...(context.options ? { options: context.options } : {}),
  });
  const facts = buildLocalHomeCoreFactsContractV1(saju);
  const natalEvidence = assessNatalEvidenceV1(saju);
  const reasonCodes = [...natalEvidence.reasonCodes] as LocalHomeAvailabilityReasonV1[];
  if (!facts && !reasonCodes.includes('CORE_NATAL_FACTS_UNAVAILABLE')) {
    reasonCodes.push('CORE_NATAL_FACTS_UNAVAILABLE');
  }
  const availability: LocalHomeAvailabilityV1 = {
    status: !facts
      ? 'unavailable'
      : reasonCodes.length > 0
        ? 'limited'
        : 'ready',
    reasonCodes,
  };
  const summary: LocalHomeSummaryV1 = {
    schemaVersion: LOCAL_HOME_SUMMARY_SCHEMA_V1,
    contextId: context.contextId,
    computation: {
      execution: 'local_only',
      source: 'SpringEngine.getSajuReport',
      scope: 'natal_preview',
      fullReportComputed: false,
      remoteLookup: 'forbidden',
      natalSaju: 'birth_derived_invariant',
    },
    birthPreview: buildLocalBirthPreviewV1(context.birth),
    availability,
    facts,
    capabilities: LOCAL_HOME_CAPABILITIES_V1,
  };
  assertLocalHomeSummaryV1(summary);
  return freezeLocalOwned(summary);
}
