import {
  LOCAL_HOME_SUMMARY_SCHEMA_V1,
  LOCAL_SHARE_EXPORT_ID_PATTERN_V1,
  LOCAL_SHARE_EXPORT_SCHEMA_V1,
  type LocalHomeSummaryV1,
  type LocalShareExportV1,
} from './local-menu-types.js';
import {
  LOCAL_HOME_PILLAR_POSITIONS_V1,
  assertLocalHomeAvailabilityContractV1,
  assertLocalHomeCoreFactsContractV1,
  assertLocalHomeSummaryV1,
} from './local-home-contract.js';
import {
  assertLocalDataObject,
  failLocalMenu,
  freezeLocalOwned,
  isCanonicalLocalTimestamp,
  randomLocalOpaqueId,
} from './local-menu-primitives.js';

export function buildLocalShareExportV1(
  home: LocalHomeSummaryV1,
): LocalShareExportV1 {
  assertLocalHomeSummaryV1(home);
  const output: LocalShareExportV1 = {
    schemaVersion: LOCAL_SHARE_EXPORT_SCHEMA_V1,
    exportId: randomLocalOpaqueId('local_export_v1_'),
    createdAt: new Date().toISOString(),
    transport: 'native_share_or_file',
    privacy: {
      directIdentifiers: 'omitted',
      birthInput: 'omitted',
      sourceContextId: 'omitted',
      urlEmbedding: 'forbidden',
    },
    source: {
      schemaVersion: LOCAL_HOME_SUMMARY_SCHEMA_V1,
      computation: 'local_only',
    },
    summary: {
      availability: {
        status: home.availability.status,
        reasonCodes: [...home.availability.reasonCodes],
      },
      ...(home.facts ? {
        dayMaster: { ...home.facts.dayMaster },
        elementDistribution: home.facts.elementDistribution.map((row) => ({ ...row })),
      } : {}),
    },
  };
  assertLocalShareExportV1(output);
  return freezeLocalOwned(output);
}

export function assertLocalShareExportV1(
  value: unknown,
): asserts value is LocalShareExportV1 {
  assertLocalDataObject(value, [
    'schemaVersion', 'exportId', 'createdAt', 'transport', 'privacy', 'source', 'summary',
  ]);
  if (value.schemaVersion !== LOCAL_SHARE_EXPORT_SCHEMA_V1
    || !LOCAL_SHARE_EXPORT_ID_PATTERN_V1.test(String(value.exportId ?? ''))
    || typeof value.createdAt !== 'string'
    || !isCanonicalLocalTimestamp(value.createdAt)
    || value.transport !== 'native_share_or_file') {
    failLocalMenu('CONTRACT_INVALID');
  }
  assertLocalDataObject(value.privacy, [
    'directIdentifiers', 'birthInput', 'sourceContextId', 'urlEmbedding',
  ], 'CONTRACT_INVALID');
  if (value.privacy.directIdentifiers !== 'omitted'
    || value.privacy.birthInput !== 'omitted'
    || value.privacy.sourceContextId !== 'omitted'
    || value.privacy.urlEmbedding !== 'forbidden') {
    failLocalMenu('CONTRACT_INVALID');
  }
  assertLocalDataObject(value.source, ['schemaVersion', 'computation'], 'CONTRACT_INVALID');
  if (value.source.schemaVersion !== LOCAL_HOME_SUMMARY_SCHEMA_V1
    || value.source.computation !== 'local_only') {
    failLocalMenu('CONTRACT_INVALID');
  }
  assertLocalDataObject(value.summary, [
    'availability', 'dayMaster', 'elementDistribution',
  ], 'CONTRACT_INVALID');
  assertLocalHomeAvailabilityContractV1(value.summary.availability);
  const hasDayMaster = value.summary.dayMaster !== undefined;
  const hasDistribution = value.summary.elementDistribution !== undefined;
  if (hasDayMaster !== hasDistribution) failLocalMenu('CONTRACT_INVALID');
  if (hasDayMaster !== (value.summary.availability.status !== 'unavailable')) {
    failLocalMenu('CONTRACT_INVALID');
  }
  if (hasDayMaster) {
    assertLocalHomeCoreFactsContractV1({
      pillars: LOCAL_HOME_PILLAR_POSITIONS_V1.map((position) => ({
        position,
        stem: { code: 'omitted', hangul: '미제공', hanja: '未提供' },
        branch: { code: 'omitted', hangul: '미제공', hanja: '未提供' },
      })),
      dayMaster: value.summary.dayMaster,
      elementDistribution: value.summary.elementDistribution,
    });
  }
}
