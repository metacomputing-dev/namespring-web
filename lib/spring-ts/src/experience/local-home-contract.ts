import type { PillarCode, SajuSummary } from '../types.js';
import {
  LOCAL_CONTEXT_ID_PATTERN_V1,
  LOCAL_HOME_SUMMARY_SCHEMA_V1,
  type LocalFiveElementIdV1,
  type LocalHomeAvailabilityReasonV1,
  type LocalHomeAvailabilityV1,
  type LocalHomeCoreFactsV1,
  type LocalHomeSummaryV1,
} from './local-menu-types.js';
import { assertLocalBirthPreviewV1 } from './local-birth-preview.js';
import { LOCAL_HOME_CAPABILITIES_V1 } from './local-home-capabilities.js';
import {
  assertLocalDataObject,
  failLocalMenu,
  isBoundedCanonicalText,
} from './local-menu-primitives.js';

const ELEMENT_ORDER = Object.freeze([
  'wood', 'fire', 'earth', 'metal', 'water',
] as const satisfies readonly LocalFiveElementIdV1[]);
export const LOCAL_HOME_PILLAR_POSITIONS_V1 = Object.freeze([
  'year', 'month', 'day', 'hour',
] as const);
const PILLAR_POSITIONS = LOCAL_HOME_PILLAR_POSITIONS_V1;

const HOME_AVAILABILITY_REASONS = new Set<LocalHomeAvailabilityReasonV1>([
  'SAJU_ANALYSIS_LIMITED',
  'SAJU_JUDGMENT_LOW_CONFIDENCE',
  'YONGSHIN_JONGGYEOK_RISK',
  'YONGSHIN_CONSENSUS_CONFLICT',
  'CORE_NATAL_FACTS_UNAVAILABLE',
]);


function canonicalElement(value: unknown): LocalFiveElementIdV1 | null {
  if (typeof value !== 'string') return null;
  switch (value.trim().toUpperCase()) {
    case 'WOOD': case '목': case '木': return 'wood';
    case 'FIRE': case '화': case '火': return 'fire';
    case 'EARTH': case '토': case '土': return 'earth';
    case 'METAL': case '금': case '金': return 'metal';
    case 'WATER': case '수': case '水': return 'water';
    default: return null;
  }
}

function canonicalPolarity(value: unknown): 'yin' | 'yang' | null {
  if (typeof value !== 'string') return null;
  switch (value.trim().toUpperCase()) {
    case 'YIN': case '음': case '陰': return 'yin';
    case 'YANG': case '양': case '陽': return 'yang';
    default: return null;
  }
}

function copyPillarCode(value: PillarCode): LocalHomeCoreFactsV1['pillars'][number]['stem'] {
  if (!isBoundedCanonicalText(value?.code, 32)
    || !isBoundedCanonicalText(value?.hangul, 8)
    || !isBoundedCanonicalText(value?.hanja, 8)) {
    failLocalMenu('CORE_NATAL_FACTS_INVALID');
  }
  return { code: value.code, hangul: value.hangul, hanja: value.hanja };
}

function normalizedElementDistribution(
  raw: Readonly<Record<string, number>>,
): LocalHomeCoreFactsV1['elementDistribution'] {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    failLocalMenu('CORE_NATAL_FACTS_INVALID');
  }
  const counts: Record<LocalFiveElementIdV1, number> = {
    wood: 0, fire: 0, earth: 0, metal: 0, water: 0,
  };
  for (const [key, value] of Object.entries(raw)) {
    const element = canonicalElement(key);
    if (!element || typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      failLocalMenu('CORE_NATAL_FACTS_INVALID');
    }
    counts[element] += value;
  }
  const values = ELEMENT_ORDER.map((element) => counts[element]);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!(total > 0) || !Number.isFinite(total)) failLocalMenu('CORE_NATAL_FACTS_INVALID');
  const exactBasisPoints = values.map((value) => (value / total) * 10_000);
  const basisPoints = exactBasisPoints.map(Math.floor);
  let remaining = 10_000 - basisPoints.reduce((sum, value) => sum + value, 0);
  const allocationOrder = exactBasisPoints
    .map((value, index) => ({ index, remainder: value - basisPoints[index] }))
    .filter(({ index }) => values[index] > 0)
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (let index = 0; index < remaining; index += 1) {
    basisPoints[allocationOrder[index % allocationOrder.length].index] += 1;
  }
  remaining = 10_000 - basisPoints.reduce((sum, value) => sum + value, 0);
  if (remaining !== 0) failLocalMenu('CORE_NATAL_FACTS_INVALID');
  return ELEMENT_ORDER.map((element, index) => ({
    element,
    sharePercent: basisPoints[index] / 100,
  }));
}

export function buildLocalHomeCoreFactsContractV1(saju: SajuSummary | null): LocalHomeCoreFactsV1 | null {
  // Any analysisStatus denotes a non-complete adapter result. In particular,
  // failed/unavailable summaries contain structurally shaped empty placeholders
  // which must not be projected as natal facts (or turned into an exception).
  if (!saju || saju.analysisStatus !== undefined) return null;
  const dayMasterElement = canonicalElement(saju.dayMaster?.element);
  const dayMasterPolarity = canonicalPolarity(saju.dayMaster?.polarity);
  if (!isBoundedCanonicalText(saju.dayMaster?.stem, 32)
    || !dayMasterElement
    || !dayMasterPolarity) {
    failLocalMenu('CORE_NATAL_FACTS_INVALID');
  }
  const pillars = PILLAR_POSITIONS.map((position) => {
    const pillar = saju.pillars?.[position];
    if (!pillar) failLocalMenu('CORE_NATAL_FACTS_INVALID');
    return {
      position,
      stem: copyPillarCode(pillar.stem),
      branch: copyPillarCode(pillar.branch),
    };
  });
  return {
    pillars,
    dayMaster: {
      stem: saju.dayMaster.stem,
      element: dayMasterElement,
      polarity: dayMasterPolarity,
    },
    elementDistribution: normalizedElementDistribution(saju.elementDistribution),
  };
}

/** @internal Shared with the privacy-preserving local share projection. */
export function assertLocalHomeAvailabilityContractV1(
  value: unknown,
): asserts value is LocalHomeAvailabilityV1 {
  assertLocalDataObject(value, ['status', 'reasonCodes'], 'CONTRACT_INVALID');
  if (!['ready', 'limited', 'unavailable'].includes(String(value.status))
    || !Array.isArray(value.reasonCodes)) {
    failLocalMenu('CONTRACT_INVALID');
  }
  const reasons = new Set<string>();
  for (const reason of value.reasonCodes) {
    if (typeof reason !== 'string'
      || !HOME_AVAILABILITY_REASONS.has(reason as LocalHomeAvailabilityReasonV1)
      || reasons.has(reason)) {
      failLocalMenu('CONTRACT_INVALID');
    }
    reasons.add(reason);
  }
  if ((value.status === 'ready') !== (value.reasonCodes.length === 0)) {
    failLocalMenu('CONTRACT_INVALID');
  }
}

/** @internal Shared with the privacy-preserving local share projection. */
export function assertLocalHomeCoreFactsContractV1(
  value: unknown,
): asserts value is LocalHomeCoreFactsV1 {
  assertLocalDataObject(value, ['pillars', 'dayMaster', 'elementDistribution'], 'CONTRACT_INVALID');
  if (!Array.isArray(value.pillars) || value.pillars.length !== PILLAR_POSITIONS.length) {
    failLocalMenu('CONTRACT_INVALID');
  }
  for (let index = 0; index < value.pillars.length; index += 1) {
    const pillar = value.pillars[index];
    assertLocalDataObject(pillar, ['position', 'stem', 'branch'], 'CONTRACT_INVALID');
    if (pillar.position !== PILLAR_POSITIONS[index]) failLocalMenu('CONTRACT_INVALID');
    for (const key of ['stem', 'branch'] as const) {
      const code = pillar[key];
      assertLocalDataObject(code, ['code', 'hangul', 'hanja'], 'CONTRACT_INVALID');
      if (!isBoundedCanonicalText(code.code, 32)
        || !isBoundedCanonicalText(code.hangul, 8)
        || !isBoundedCanonicalText(code.hanja, 8)) {
        failLocalMenu('CONTRACT_INVALID');
      }
    }
  }
  assertLocalDataObject(value.dayMaster, ['stem', 'element', 'polarity'], 'CONTRACT_INVALID');
  if (!isBoundedCanonicalText(value.dayMaster.stem, 32)
    || !ELEMENT_ORDER.includes(value.dayMaster.element as LocalFiveElementIdV1)
    || (value.dayMaster.polarity !== 'yin' && value.dayMaster.polarity !== 'yang')) {
    failLocalMenu('CONTRACT_INVALID');
  }
  if (!Array.isArray(value.elementDistribution)
    || value.elementDistribution.length !== ELEMENT_ORDER.length) {
    failLocalMenu('CONTRACT_INVALID');
  }
  let total = 0;
  for (let index = 0; index < value.elementDistribution.length; index += 1) {
    const row = value.elementDistribution[index];
    assertLocalDataObject(row, ['element', 'sharePercent'], 'CONTRACT_INVALID');
    if (row.element !== ELEMENT_ORDER[index]
      || typeof row.sharePercent !== 'number'
      || !Number.isFinite(row.sharePercent)
      || row.sharePercent < 0
      || row.sharePercent > 100
      || Math.round(row.sharePercent * 100) !== row.sharePercent * 100) {
      failLocalMenu('CONTRACT_INVALID');
    }
    total += row.sharePercent;
  }
  if (Math.round(total * 100) !== 10_000) failLocalMenu('CONTRACT_INVALID');
}

export function assertLocalHomeSummaryV1(
  value: unknown,
): asserts value is LocalHomeSummaryV1 {
  assertLocalDataObject(value, [
    'schemaVersion', 'contextId', 'computation', 'birthPreview',
    'availability', 'facts', 'capabilities',
  ]);
  if (value.schemaVersion !== LOCAL_HOME_SUMMARY_SCHEMA_V1
    || !LOCAL_CONTEXT_ID_PATTERN_V1.test(String(value.contextId ?? ''))) {
    failLocalMenu('CONTRACT_INVALID');
  }
  assertLocalDataObject(value.computation, [
    'execution', 'source', 'scope', 'fullReportComputed', 'remoteLookup', 'natalSaju',
  ], 'CONTRACT_INVALID');
  if (value.computation.execution !== 'local_only'
    || value.computation.source !== 'SpringEngine.getSajuReport'
    || value.computation.scope !== 'natal_preview'
    || value.computation.fullReportComputed !== false
    || value.computation.remoteLookup !== 'forbidden'
    || value.computation.natalSaju !== 'birth_derived_invariant') {
    failLocalMenu('CONTRACT_INVALID');
  }
  assertLocalBirthPreviewV1(value.birthPreview);
  assertLocalHomeAvailabilityContractV1(value.availability);
  if (value.facts === null) {
    if (value.availability.status !== 'unavailable'
      || !value.availability.reasonCodes.includes('CORE_NATAL_FACTS_UNAVAILABLE')) {
      failLocalMenu('CONTRACT_INVALID');
    }
  } else {
    assertLocalHomeCoreFactsContractV1(value.facts);
    if (value.availability.status === 'unavailable') failLocalMenu('CONTRACT_INVALID');
  }
  if (!Array.isArray(value.capabilities)
    || value.capabilities.length !== LOCAL_HOME_CAPABILITIES_V1.length) {
    failLocalMenu('CONTRACT_INVALID');
  }
  for (let index = 0; index < LOCAL_HOME_CAPABILITIES_V1.length; index += 1) {
    const actual = value.capabilities[index];
    const expected = LOCAL_HOME_CAPABILITIES_V1[index];
    if ('requestHint' in expected) {
      assertLocalDataObject(
        actual,
        ['id', 'execution', 'contract', 'requestHint'],
        'CONTRACT_INVALID',
      );
      assertLocalDataObject(actual.requestHint, ['surface', 'depth'], 'CONTRACT_INVALID');
      if (actual.id !== expected.id
        || actual.execution !== expected.execution
        || actual.contract !== expected.contract
        || actual.requestHint.surface !== expected.requestHint.surface
        || actual.requestHint.depth !== expected.requestHint.depth) {
        failLocalMenu('CONTRACT_INVALID');
      }
      continue;
    }
    if ('catalog' in expected) {
      assertLocalDataObject(
        actual,
        ['id', 'execution', 'contract', 'catalog', 'productId'],
        'CONTRACT_INVALID',
      );
      if (actual.id !== expected.id
        || actual.execution !== expected.execution
        || actual.contract !== expected.contract
        || actual.catalog !== expected.catalog
        || actual.productId !== expected.productId) {
        failLocalMenu('CONTRACT_INVALID');
      }
      continue;
    }
    assertLocalDataObject(actual, ['id', 'execution', 'contract'], 'CONTRACT_INVALID');
    if (actual.id !== expected.id
      || actual.execution !== expected.execution
      || actual.contract !== expected.contract) {
      failLocalMenu('CONTRACT_INVALID');
    }
  }
}
