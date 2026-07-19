import type {
  BirthInfo,
  CharDetail,
  NamingReport,
  NamingReportFrame,
  SajuSummary,
  SpringReport,
} from '../../types.js';
import { targetCalendarParts } from '../../target-date.js';
import { assessNatalEvidenceV1 } from '../../natal-evidence.js';
import { ENGINE_BUILD_IDENTITY_V1 } from '../../engine-build-identity.generated.js';
import { resolveSchoolPresetMetadata } from '../../preset-loader.js';
import engineConfig from '../../../config/engine.json';
import {
  normalizeGyeokgukCategoryCode,
  normalizeGyeokgukTypeCode,
  normalizeTenGodCode,
} from '../../saju/legacy-codec.js';
import type {
  TieredCategoryId,
  TieredDepth,
  TieredFortune,
  TieredPeriodKind,
} from '../types.js';
import type { TieredMatrixSelection } from '../tiered/build-tiered-matrix.js';
import { buildNameSajuReading } from '../tiered/name-saju-reading.js';
import {
  REPORT_DELIVERY_SCHEMA_V1,
  type DaeunTimelineFactV1,
  type DayMasterFactV1,
  type DeliveryAvailabilityV1,
  type DeliveryReasonCodeV1,
  type DeliveryStatusV1,
  type ElementBalanceFactV1,
  type ElementDistributionFactV1,
  type FiveElementIdV1,
  type GongmangFactV1,
  type GyeokgukFactV1,
  type GyeokgukSeongpaeFactV1,
  type GyeokgukSeongpaeVerdictV1,
  type MetricFactV1,
  type LocalReportOptionsV1,
  type NameCharacterFactV1,
  type NameStatisticsFactV1,
  type NameSajuInteractionFactV1,
  type NamingFrameFactV1,
  type NamingPhoneticFactV1,
  type NamingTrendFactV1,
  type NatalRelationsFactV1,
  type PillarsFactV1,
  type ReportBlockV1,
  type ReportCategoryIdV1,
  type ReportDeliverySelectionV1,
  type ReportDeliveryV1,
  type ReportDepthV1,
  type ReportFactV1,
  type ReportInterpretationV1,
  type ReportSurfaceSelectionV1,
  type ReportSurfaceV1,
  type SibiUnseongFactV1,
  type StrengthFactV1,
  type SajuJudgmentStrengthV1,
  type SajuPillarPositionV1,
  type ShinsalHitsFactV1,
  type TenGodAnalysisFactV1,
  type TenGodCodeV1,
  type TenGodDescriptorV1,
  type TimeCorrectionFactV1,
  type YinYangBalanceFactV1,
  type YongshinFactV1,
  type YongshinMethodAxisV1,
} from './types.js';
import {
  assertReportDeliveryV1,
  ReportDeliveryContractError,
  validateReportDeliverySelectionV1,
} from './validation.js';
import { FOUR_FRAME_AUTHORED_COPY_APPROVED } from './content-gates.js';
import { buildSafeFourFrameCopyV1 } from './safe-four-frame-copy.js';

const PILLAR_ORDER = ['year', 'month', 'day', 'hour'] as const;
const TEN_GOD_POSITION_ORDER = [
  { source: 'YEAR', position: 'year' },
  { source: 'MONTH', position: 'month' },
  { source: 'DAY', position: 'day' },
  { source: 'HOUR', position: 'hour' },
] as const;
const TEN_GOD_CODES = new Set<TenGodCodeV1>([
  'BI_GYEON',
  'GYEOB_JAE',
  'SIK_SIN',
  'SANG_GWAN',
  'PYEON_JAE',
  'JEONG_JAE',
  'PYEON_GWAN',
  'JEONG_GWAN',
  'PYEON_IN',
  'JEONG_IN',
]);
const ELEMENT_ORDER: readonly FiveElementIdV1[] = ['wood', 'fire', 'earth', 'metal', 'water'];
const DEPTH_ORDER: Readonly<Record<ReportDepthV1, number>> = { brief: 0, standard: 1, expert: 2 };
const CATEGORY_LABELS: Readonly<Record<ReportCategoryIdV1, string>> = {
  overall: '총운',
  wealth: '재물',
  health: '건강',
  academic: '학업',
  romance: '연애',
  family: '가족',
  career: '직업',
  study_document: '학업·문서',
  expression_children: '표현·자녀',
  health_stress: '건강·스트레스',
  movement: '이동·변동',
};
const FRAME_STAGE: Readonly<Record<NamingReportFrame['type'], NamingFrameFactV1['stage']>> = {
  won: 'earlyLife',
  hyung: 'youthLife',
  lee: 'middleLife',
  jung: 'lateAndTotal',
};

export interface BuildReportDeliveryV1Input {
  readonly selection: ReportDeliverySelectionV1;
  readonly birth: BirthInfo;
  readonly targetDate: Date;
  readonly analysisId: string;
  readonly candidateId?: string;
  readonly options?: LocalReportOptionsV1;
  readonly saju: SajuSummary | null;
  readonly namingReport: NamingReport | null;
  readonly springReport: SpringReport | null;
}

const READY: DeliveryAvailabilityV1 = Object.freeze({ status: 'ready', reasonCodes: Object.freeze([]) });

function availability(
  status: Exclude<DeliveryStatusV1, 'ready'>,
  ...reasonCodes: readonly DeliveryReasonCodeV1[]
): DeliveryAvailabilityV1 {
  return { status, reasonCodes: [...new Set(reasonCodes)] };
}

function canonicalElement(value: unknown): FiveElementIdV1 | null {
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

function boundedEngineText(
  value: unknown,
  reason: string,
  maxLength = 120,
): string {
  if (typeof value !== 'string') throw new ReportDeliveryContractError(reason);
  const normalized = value.normalize('NFC').trim();
  if (normalized.length === 0
    || Array.from(normalized).length > maxLength
    || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new ReportDeliveryContractError(reason);
  }
  return normalized;
}

function canonicalTenGodDescriptor(
  value: unknown,
  reason: string,
): TenGodDescriptorV1 {
  const label = boundedEngineText(value, reason, 40);
  const normalizedCode = normalizeTenGodCode(label);
  return {
    label,
    code: TEN_GOD_CODES.has(normalizedCode as TenGodCodeV1)
      ? normalizedCode as TenGodCodeV1
      : null,
  };
}

function canonicalElementList(
  values: unknown,
  reason: string,
): FiveElementIdV1[] {
  if (!Array.isArray(values) || values.length > ELEMENT_ORDER.length) {
    throw new ReportDeliveryContractError(reason);
  }
  const normalized = values.map((value) => {
    const element = canonicalElement(value);
    if (!element) throw new ReportDeliveryContractError(reason);
    return element;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new ReportDeliveryContractError(reason);
  }
  return normalized;
}

function shinsalHitsFact(saju: SajuSummary): ShinsalHitsFactV1 {
  if (!Array.isArray(saju.shinsalHits) || saju.shinsalHits.length > 256) {
    throw new ReportDeliveryContractError('SHINSAL_HITS_INVALID');
  }
  const hits = saju.shinsalHits.map((hit) => {
    if (!hit || typeof hit !== 'object') {
      throw new ReportDeliveryContractError('SHINSAL_HIT_INVALID');
    }
    const seatPillars = Array.isArray(hit.seatPillars) ? [...hit.seatPillars] : [];
    if (seatPillars.length > PILLAR_ORDER.length
      || seatPillars.some((position) => !PILLAR_ORDER.includes(position))
      || new Set(seatPillars).size !== seatPillars.length) {
      throw new ReportDeliveryContractError('SHINSAL_SEAT_PILLARS_INVALID');
    }
    const occurrenceCount = hit.count ?? 1;
    if (!Number.isSafeInteger(occurrenceCount) || occurrenceCount < 1) {
      throw new ReportDeliveryContractError('SHINSAL_COUNT_INVALID');
    }
    let calculationBasisCode: string | null = null;
    if (hit.basedOn !== undefined) {
      calculationBasisCode = boundedMachineCode(hit.basedOn);
      if (!calculationBasisCode) {
        throw new ReportDeliveryContractError('SHINSAL_BASIS_CODE_INVALID');
      }
    }
    return {
      name: boundedEngineText(hit.type, 'SHINSAL_NAME_INVALID', 80),
      calculationBasis: {
        label: boundedEngineText(hit.position, 'SHINSAL_BASIS_LABEL_INVALID', 40),
        code: calculationBasisCode,
      },
      grade: boundedEngineText(hit.grade, 'SHINSAL_GRADE_INVALID', 16),
      seatPillars: seatPillars as SajuPillarPositionV1[],
      occurrenceCount,
    };
  });
  return {
    id: 'saju.shinsal-hits',
    domain: 'saju',
    method: 'saju-ts.shinsal-summary-projection.v1',
    kind: 'shinsal_hits',
    source: 'spring-ts.SajuSummary',
    projection: 'normalized_without_recalculation',
    sourceFields: ['shinsalHits'],
    hits,
  };
}

function tenGodAnalysisFact(saju: SajuSummary): TenGodAnalysisFactV1 | null {
  const analysis = saju.tenGodAnalysis;
  if (analysis === null) return null;
  if (!analysis || typeof analysis !== 'object'
    || !analysis.byPosition || typeof analysis.byPosition !== 'object') {
    throw new ReportDeliveryContractError('TEN_GOD_ANALYSIS_INVALID');
  }
  const sourcePositionKeys = Object.keys(analysis.byPosition);
  if (sourcePositionKeys.length !== TEN_GOD_POSITION_ORDER.length
    || TEN_GOD_POSITION_ORDER.some(({ source }) => !sourcePositionKeys.includes(source))) {
    throw new ReportDeliveryContractError('TEN_GOD_POSITION_SET_INVALID');
  }
  const positions = TEN_GOD_POSITION_ORDER.map(({ source, position }) => {
    const cell = analysis.byPosition[source];
    if (!cell || typeof cell !== 'object'
      || !Array.isArray(cell.hiddenStems)
      || !Array.isArray(cell.hiddenStemTenGod)
      || cell.hiddenStems.length < 1
      || cell.hiddenStems.length > 3
      || cell.hiddenStems.length !== cell.hiddenStemTenGod.length) {
      throw new ReportDeliveryContractError('TEN_GOD_POSITION_INVALID');
    }
    const hiddenStems = cell.hiddenStems.map((hidden, index) => {
      const tenGod = cell.hiddenStemTenGod[index];
      if (!hidden || !tenGod || typeof hidden !== 'object' || typeof tenGod !== 'object') {
        throw new ReportDeliveryContractError('TEN_GOD_HIDDEN_STEM_INVALID');
      }
      const stem = boundedEngineText(hidden.stem, 'TEN_GOD_HIDDEN_STEM_INVALID', 16);
      const tenGodStem = boundedEngineText(
        tenGod.stem,
        'TEN_GOD_HIDDEN_STEM_INVALID',
        16,
      );
      const element = canonicalElement(hidden.element);
      if (stem !== tenGodStem || !element
        || !Number.isFinite(hidden.ratio)
        || hidden.ratio < 0
        || hidden.ratio > 1) {
        throw new ReportDeliveryContractError('TEN_GOD_HIDDEN_STEM_INVALID');
      }
      return {
        stem,
        element,
        ratio: hidden.ratio,
        tenGod: canonicalTenGodDescriptor(
          tenGod.tenGod,
          'TEN_GOD_HIDDEN_DESCRIPTOR_INVALID',
        ),
      };
    });
    return {
      position,
      cheongan: canonicalTenGodDescriptor(
        cell.cheonganTenGod,
        'TEN_GOD_CHEONGAN_INVALID',
      ),
      jijiPrincipal: canonicalTenGodDescriptor(
        cell.jijiPrincipalTenGod,
        'TEN_GOD_JIJI_INVALID',
      ),
      hiddenStems,
    };
  });
  return {
    id: 'saju.ten-god-analysis',
    domain: 'saju',
    method: 'saju-ts.ten-god-analysis-projection.v1',
    kind: 'ten_god_analysis',
    source: 'spring-ts.SajuSummary',
    projection: 'normalized_without_recalculation',
    sourceFields: ['tenGodAnalysis'],
    dayMasterStem: boundedEngineText(
      analysis.dayMaster,
      'TEN_GOD_DAY_MASTER_INVALID',
      16,
    ),
    positions,
  };
}

function natalRelationsFact(saju: SajuSummary): NatalRelationsFactV1 {
  if (!Array.isArray(saju.cheonganRelations)
    || !Array.isArray(saju.jijiRelations)
    || saju.cheonganRelations.length > 64
    || saju.jijiRelations.length > 128) {
    throw new ReportDeliveryContractError('NATAL_RELATIONS_INVALID');
  }
  const cheongan = saju.cheonganRelations.map((relation) => {
    if (!relation || typeof relation !== 'object'
      || !Array.isArray(relation.stems)
      || relation.stems.length !== 2) {
      throw new ReportDeliveryContractError('CHEONGAN_RELATION_INVALID');
    }
    const stems = relation.stems.map((stem) =>
      boundedEngineText(stem, 'CHEONGAN_RELATION_STEM_INVALID', 16));
    if (new Set(stems).size !== stems.length) {
      throw new ReportDeliveryContractError('CHEONGAN_RELATION_STEM_INVALID');
    }
    if (relation.resultConfirmed !== undefined
      && typeof relation.resultConfirmed !== 'boolean') {
      throw new ReportDeliveryContractError('CHEONGAN_RELATION_RESULT_INVALID');
    }
    const resultElement = relation.resultElement === null
      ? null
      : canonicalElement(relation.resultElement);
    if (relation.resultElement !== null && !resultElement) {
      throw new ReportDeliveryContractError('CHEONGAN_RELATION_RESULT_INVALID');
    }
    const resultConfirmed = relation.resultConfirmed === true;
    if (resultConfirmed && resultElement === null) {
      throw new ReportDeliveryContractError('CHEONGAN_RELATION_RESULT_INVALID');
    }
    return {
      type: boundedEngineText(relation.type, 'CHEONGAN_RELATION_TYPE_INVALID', 40),
      stems,
      hapState: relation.hapState === undefined
        ? null
        : boundedEngineText(relation.hapState, 'CHEONGAN_RELATION_HAP_STATE_INVALID', 40),
      resultElement,
      resultConfirmed,
    };
  });
  const jiji = saju.jijiRelations.map((relation) => {
    if (!relation || typeof relation !== 'object'
      || !Array.isArray(relation.branches)
      || relation.branches.length < 2
      || relation.branches.length > 4) {
      throw new ReportDeliveryContractError('JIJI_RELATION_INVALID');
    }
    const branches = relation.branches.map((branch) =>
      boundedEngineText(branch, 'JIJI_RELATION_BRANCH_INVALID', 16));
    if (new Set(branches).size !== branches.length) {
      throw new ReportDeliveryContractError('JIJI_RELATION_BRANCH_INVALID');
    }
    return {
      type: boundedEngineText(relation.type, 'JIJI_RELATION_TYPE_INVALID', 40),
      branches,
      outcome: relation.outcome === null
        ? null
        : boundedEngineText(relation.outcome, 'JIJI_RELATION_OUTCOME_INVALID', 80),
    };
  });
  return {
    id: 'saju.natal-relations',
    domain: 'saju',
    method: 'saju-ts.natal-relations-projection.v1',
    kind: 'natal_relations',
    source: 'spring-ts.SajuSummary',
    projection: 'normalized_without_recalculation',
    sourceFields: ['cheonganRelations', 'jijiRelations'],
    cheongan,
    jiji,
  };
}

function elementBalanceFact(saju: SajuSummary): ElementBalanceFactV1 {
  const deficient = canonicalElementList(
    saju.deficientElements,
    'DEFICIENT_ELEMENTS_INVALID',
  );
  const excessive = canonicalElementList(
    saju.excessiveElements,
    'EXCESSIVE_ELEMENTS_INVALID',
  );
  if (deficient.some((element) => excessive.includes(element))) {
    throw new ReportDeliveryContractError('ELEMENT_BALANCE_CONFLICT');
  }
  return {
    id: 'saju.element-balance',
    domain: 'saju',
    method: 'saju-ts.element-balance-projection.v1',
    kind: 'element_balance',
    source: 'spring-ts.SajuSummary',
    projection: 'normalized_without_recalculation',
    sourceFields: ['deficientElements', 'excessiveElements'],
    deficient,
    excessive,
  };
}

const SEONGPAE_VERDICTS = new Set<GyeokgukSeongpaeVerdictV1>([
  'SEONGGYEOK',
  'PAGYEOK',
  'PAJUNG_YUGU',
  'SEONGJUNG_YUPA',
  'UNDETERMINED',
]);

function gongmangFact(saju: SajuSummary): GongmangFactV1 | null {
  const gongmang = saju.gongmang;
  if (gongmang === null || gongmang === undefined) return null;
  if (!Array.isArray(gongmang) || gongmang.length !== 2) {
    throw new ReportDeliveryContractError('GONGMANG_INVALID');
  }
  return {
    id: 'saju.gongmang',
    domain: 'saju',
    method: 'saju-ts.gongmang-projection.v1',
    kind: 'gongmang',
    source: 'spring-ts.SajuSummary',
    projection: 'normalized_without_recalculation',
    sourceFields: ['gongmang'],
    voidBranches: [
      boundedEngineText(gongmang[0], 'GONGMANG_BRANCH_INVALID', 16),
      boundedEngineText(gongmang[1], 'GONGMANG_BRANCH_INVALID', 16),
    ],
  };
}

function gyeokgukSeongpaeFact(saju: SajuSummary): GyeokgukSeongpaeFactV1 | null {
  const seongpae = saju.gyeokguk?.seongpae;
  if (seongpae === null || seongpae === undefined) return null;
  if (typeof seongpae !== 'object'
    || !SEONGPAE_VERDICTS.has(seongpae.verdict as GyeokgukSeongpaeVerdictV1)
    || (seongpae.usage !== 'SUNYONG' && seongpae.usage !== 'YEOKYONG')) {
    throw new ReportDeliveryContractError('GYEOKGUK_SEONGPAE_INVALID');
  }
  const optionalLabel = (value: unknown, reason: string): string | null =>
    value === null || value === undefined ? null : boundedEngineText(value, reason, 40);
  return {
    id: 'saju.gyeokguk-seongpae',
    domain: 'saju',
    method: 'saju-ts.gyeokguk-seongpae-projection.v1',
    kind: 'gyeokguk_seongpae',
    source: 'spring-ts.SajuSummary',
    projection: 'normalized_without_recalculation',
    sourceFields: ['gyeokguk'],
    verdict: seongpae.verdict as GyeokgukSeongpaeVerdictV1,
    usage: seongpae.usage,
    sangshin: optionalLabel(seongpae.sangshin, 'GYEOKGUK_SANGSHIN_INVALID'),
    sangshinStemHanja: optionalLabel(
      seongpae.sangshinStemHanja,
      'GYEOKGUK_SANGSHIN_INVALID',
    ),
    pagyeokFactor: optionalLabel(seongpae.pagyeokFactor, 'GYEOKGUK_PAGYEOK_INVALID'),
    gueung: optionalLabel(seongpae.gueung, 'GYEOKGUK_GUEUNG_INVALID'),
  };
}

function sibiUnseongFact(saju: SajuSummary): SibiUnseongFactV1 | null {
  const raw = (saju as Record<string, unknown>).sibiUnseong;
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ReportDeliveryContractError('SIBI_UNSEONG_INVALID');
  }
  const entries = raw as Record<string, unknown>;
  const stages: { position: SajuPillarPositionV1; stage: string }[] = [];
  for (const position of PILLAR_ORDER) {
    const stage = entries[position] ?? entries[position.toUpperCase()];
    if (stage === undefined || stage === null) continue;
    stages.push({
      position,
      stage: boundedEngineText(stage, 'SIBI_UNSEONG_STAGE_INVALID', 16),
    });
  }
  if (stages.length === 0) return null;
  return {
    id: 'saju.sibi-unseong',
    domain: 'saju',
    method: 'saju-ts.sibi-unseong-projection.v1',
    kind: 'sibi_unseong',
    source: 'spring-ts.SajuSummary',
    projection: 'normalized_without_recalculation',
    sourceFields: ['sibiUnseong'],
    stages,
  };
}

function daeunTimelineFact(saju: SajuSummary): DaeunTimelineFactV1 | null {
  const info = saju.daeunInfo;
  if (info === null || info === undefined) return null;
  if (typeof info !== 'object'
    || typeof info.isForward !== 'boolean'
    || !Number.isFinite(info.firstDaeunStartAge)
    || !Array.isArray(info.pillars)
    || info.pillars.length === 0
    || info.pillars.length > 16) {
    throw new ReportDeliveryContractError('DAEUN_INFO_INVALID');
  }
  const periods = info.pillars.map((pillar) => {
    if (!pillar || typeof pillar !== 'object'
      || !Number.isSafeInteger(pillar.order)
      || !Number.isFinite(pillar.startAge)
      || !Number.isFinite(pillar.endAge)
      || pillar.endAge <= pillar.startAge) {
      throw new ReportDeliveryContractError('DAEUN_PILLAR_INVALID');
    }
    return {
      order: pillar.order,
      stem: boundedEngineText(pillar.stem, 'DAEUN_PILLAR_STEM_INVALID', 16),
      branch: boundedEngineText(pillar.branch, 'DAEUN_PILLAR_BRANCH_INVALID', 16),
      startAge: pillar.startAge,
      endAge: pillar.endAge,
      tenGod: pillar.tenGod === undefined || pillar.tenGod === null
        ? null
        : boundedEngineText(pillar.tenGod, 'DAEUN_PILLAR_TEN_GOD_INVALID', 40),
      lifeStage: pillar.lifeStageKo === undefined || pillar.lifeStageKo === null
        ? null
        : boundedEngineText(pillar.lifeStageKo, 'DAEUN_PILLAR_LIFE_STAGE_INVALID', 16),
    };
  });
  const displayAge = info.firstDaeunStartAgeDisplay;
  return {
    id: 'saju.daeun-timeline',
    domain: 'saju',
    method: 'saju-ts.daeun-info-projection.v1',
    kind: 'daeun_timeline',
    source: 'spring-ts.SajuSummary',
    projection: 'normalized_without_recalculation',
    sourceFields: ['daeunInfo'],
    isForward: info.isForward,
    firstStartAge: info.firstDaeunStartAge,
    firstStartAgeDisplay: displayAge === undefined || displayAge === null
      ? null
      : displayAge,
    boundaryTermId: info.boundaryTermId === undefined || info.boundaryTermId === null
      ? null
      : boundedEngineText(info.boundaryTermId, 'DAEUN_BOUNDARY_TERM_INVALID', 32),
    periods,
  };
}

function yinYangBalanceFact(saju: SajuSummary): YinYangBalanceFactV1 | null {
  const balance = saju.yinYangBalance;
  if (balance === null || balance === undefined) return null;
  const counts = [
    balance.yang,
    balance.yin,
    balance.stems?.yang,
    balance.stems?.yin,
    balance.branches?.yang,
    balance.branches?.yin,
  ];
  if (counts.some((count) => !Number.isSafeInteger(count) || (count as number) < 0)
    || (balance.dominant !== 'YANG' && balance.dominant !== 'YIN' && balance.dominant !== 'EVEN')) {
    throw new ReportDeliveryContractError('YIN_YANG_BALANCE_INVALID');
  }
  return {
    id: 'saju.yin-yang-balance',
    domain: 'saju',
    method: 'saju-ts.yin-yang-balance-projection.v1',
    kind: 'yin_yang_balance',
    source: 'spring-ts.SajuSummary',
    projection: 'normalized_without_recalculation',
    sourceFields: ['yinYangBalance'],
    yang: balance.yang,
    yin: balance.yin,
    stems: { yang: balance.stems.yang, yin: balance.stems.yin },
    branches: { yang: balance.branches.yang, yin: balance.branches.yin },
    dominant: balance.dominant,
  };
}

function validLocalDateTimeParts(value: {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}): boolean {
  if (![value.year, value.month, value.day, value.hour, value.minute]
    .every(Number.isSafeInteger)
    || value.year < 1
    || value.month < 1
    || value.month > 12
    || value.day < 1
    || value.day > 31
    || value.hour < 0 || value.hour > 23 || value.minute < 0 || value.minute > 59) {
    return false;
  }
  // Date.UTC treats years 0..99 as 1900..1999. Use setUTCFullYear so the
  // engine's supported proleptic-Gregorian years retain their actual value.
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(value.year, value.month - 1, value.day);
  return date.getUTCFullYear() === value.year
    && date.getUTCMonth() === value.month - 1
    && date.getUTCDate() === value.day;
}

function timeCorrectionFact(
  saju: SajuSummary,
): TimeCorrectionFactV1 {
  const correction = saju.timeCorrection;
  const provenance = correction?.provenance;
  if (!provenance) {
    throw new ReportDeliveryContractError('TIME_CORRECTION_PROVENANCE_REQUIRED');
  }
  const standardLocalDateTime = {
    year: correction.standardYear,
    month: correction.standardMonth,
    day: correction.standardDay,
    hour: correction.standardHour,
    minute: correction.standardMinute,
  };
  const adjustedSolarLocalDateTime = {
    year: correction.adjustedYear,
    month: correction.adjustedMonth,
    day: correction.adjustedDay,
    hour: correction.adjustedHour,
    minute: correction.adjustedMinute,
  };
  const correctionValues = [
    correction.dstCorrectionMinutes,
    correction.longitudeCorrectionMinutes,
    correction.equationOfTimeMinutes,
  ];
  if (!validLocalDateTimeParts(standardLocalDateTime)
    || !validLocalDateTimeParts(adjustedSolarLocalDateTime)
    || !correctionValues.every(Number.isFinite)) {
    throw new ReportDeliveryContractError('TIME_CORRECTION_INVALID');
  }

  const insideYazaBoundary = provenance.policy.yazaMode === '23:30'
    ? adjustedSolarLocalDateTime.hour === 23 && adjustedSolarLocalDateTime.minute >= 30
    : adjustedSolarLocalDateTime.hour === 23;

  return {
    id: 'saju.time-correction',
    domain: 'saju',
    method: 'saju-ts.time-correction.v1',
    kind: 'time_correction',
    input: {
      calendarType: provenance.input.calendarType,
      providedLocalDateTime: {
        year: provenance.input.providedLocalDateTime.year,
        month: provenance.input.providedLocalDateTime.month,
        day: provenance.input.providedLocalDateTime.day,
        hour: provenance.input.providedLocalDateTime.hour,
        minute: provenance.input.providedLocalDateTime.minute,
      },
      effectiveSolarDate: {
        year: provenance.input.effectiveSolarDate.year,
        month: provenance.input.effectiveSolarDate.month,
        day: provenance.input.effectiveSolarDate.day,
      },
      timePrecision: provenance.input.timePrecision,
    },
    inputUncertainty: provenance.inputUncertainty,
    lunarConversion: provenance.lunarConversion,
    location: {
      inputLabel: provenance.location.inputLabel,
      resolvedRegionCode: provenance.location.resolvedRegionCode,
      latitude: provenance.location.latitude,
      longitude: provenance.location.longitude,
      timezone: provenance.location.timezone,
      source: provenance.location.source,
      coordinatesApplied: provenance.location.coordinatesApplied,
    },
    referenceMeridianDegrees: provenance.referenceMeridianDegrees,
    referenceMeridianBasis: provenance.referenceMeridianBasis.kind === 'disabled'
      ? { kind: 'disabled' }
      : provenance.referenceMeridianBasis.kind === 'civil_offset_at_birth'
        ? {
            kind: 'civil_offset_at_birth',
            utcOffsetMinutes: provenance.referenceMeridianBasis.utcOffsetMinutes,
          }
        : {
            kind: 'legacy_preset_registry',
            presetCode: provenance.referenceMeridianBasis.presetCode,
          },
    standardLocalDateTime,
    adjustedSolarLocalDateTime,
    corrections: {
      daylightSavingMinutes: correction.dstCorrectionMinutes,
      longitudeMinutes: correction.longitudeCorrectionMinutes,
      equationOfTimeMinutes: correction.equationOfTimeMinutes,
    },
    policy: {
      trueSolarTime: provenance.policy.trueSolarTime,
      longitudeCorrection: provenance.policy.longitudeCorrection,
      longitudeReference: provenance.policy.longitudeReference,
      explicitLocationRequired: provenance.policy.explicitLocationRequired,
      yaza: provenance.policy.yaza,
      yazaMode: provenance.policy.yazaMode,
    },
    solarDateChanged:
      standardLocalDateTime.year !== adjustedSolarLocalDateTime.year
      || standardLocalDateTime.month !== adjustedSolarLocalDateTime.month
      || standardLocalDateTime.day !== adjustedSolarLocalDateTime.day,
    yazaBoundaryEffect: provenance.policy.yaza === 'off'
      ? 'disabled'
      : insideYazaBoundary ? 'inside_boundary' : 'outside_boundary',
  };
}

function canonicalStrengthLevelCode(
  strength: SajuSummary['strength'],
): StrengthFactV1['levelCode'] {
  if (strength.levelCode === 'STRONG' || strength.levelCode === 'BALANCED'
    || strength.levelCode === 'WEAK' || strength.levelCode === 'UNKNOWN') {
    return strength.levelCode;
  }
  const compact = String(strength.level ?? '').replace(/\s+/gu, '').toLowerCase();
  if (compact.includes('중화') || compact.includes('균형') || compact.includes('balanced')) return 'BALANCED';
  if (compact.includes('신강') || compact.includes('strong')) return 'STRONG';
  if (compact.includes('신약') || compact.includes('weak')) return 'WEAK';
  return 'UNKNOWN';
}

function boundedMachineCode(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Z][A-Z_]{0,39}$/u.test(value) ? value : null;
}

function canonicalGyeokgukCategoryCode(
  gyeokguk: SajuSummary['gyeokguk'],
): GyeokgukFactV1['categoryCode'] {
  const code = gyeokguk.categoryCode ?? normalizeGyeokgukCategoryCode(gyeokguk.category);
  return code === 'NORMAL' || code === 'JONGGYEOK' ? code : 'UNKNOWN';
}

function koreanElementLabel(element: FiveElementIdV1 | null): string {
  switch (element) {
    case 'wood': return '나무';
    case 'fire': return '불';
    case 'earth': return '흙';
    case 'metal': return '쇠';
    case 'water': return '물';
    default: return '필요한';
  }
}

function expertElementLabel(element: FiveElementIdV1 | null): string {
  switch (element) {
    case 'wood': return '목(木)';
    case 'fire': return '화(火)';
    case 'earth': return '토(土)';
    case 'metal': return '금(金)';
    case 'water': return '수(水)';
    default: return '미확정 오행';
  }
}

function normalizedElementValues(
  counts: Readonly<Partial<Record<FiveElementIdV1, number>>>,
): ElementDistributionFactV1['values'] | null {
  const values = ELEMENT_ORDER.map((element) => {
    const value = counts[element];
    if (value === undefined) return 0;
    if (!Number.isFinite(value) || value < 0) {
      throw new ReportDeliveryContractError(
        `ELEMENT_DISTRIBUTION_INVALID_${element.toUpperCase()}`,
      );
    }
    return value;
  });
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total)) {
    throw new ReportDeliveryContractError('ELEMENT_DISTRIBUTION_TOTAL_INVALID');
  }
  if (!(total > 0)) return null;

  // Allocate integer basis points by largest remainder. This guarantees an
  // exact 100.00% total without inventing a share for a zero-count element.
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
  if (remaining !== 0) {
    throw new ReportDeliveryContractError('ELEMENT_DISTRIBUTION_ROUNDING_INVALID');
  }
  return ELEMENT_ORDER.map((element, index) => ({
    element,
    sharePercent: basisPoints[index] / 100,
  }));
}

function sajuElementDistribution(saju: SajuSummary): ElementDistributionFactV1 | null {
  const counts: Partial<Record<FiveElementIdV1, number>> = {};
  for (const [rawElement, rawValue] of Object.entries(saju.elementDistribution ?? {})) {
    const element = canonicalElement(rawElement);
    if (!element) continue;
    if (!Number.isFinite(rawValue) || rawValue < 0) {
      throw new ReportDeliveryContractError(
        `SAJU_ELEMENT_DISTRIBUTION_INVALID_${element.toUpperCase()}`,
      );
    }
    counts[element] = (counts[element] ?? 0) + rawValue;
  }
  const values = normalizedElementValues(counts);
  return values ? {
    id: 'saju.element-distribution',
    domain: 'saju',
    method: 'saju-ts.element-distribution.v1',
    kind: 'element_distribution',
    source: 'saju',
    subjectScope: 'natal_chart',
    normalization: 'within_source_percent',
    values,
  } : null;
}

function nameElementDistribution(
  rawElements: readonly unknown[],
  identity: {
    readonly id: string;
    readonly domain: ElementDistributionFactV1['domain'];
    readonly method: string;
  },
): ElementDistributionFactV1 | null {
  const counts: Partial<Record<FiveElementIdV1, number>> = {};
  for (const rawElement of rawElements) {
    const element = canonicalElement(rawElement);
    if (!element) continue;
    counts[element] = (counts[element] ?? 0) + 1;
  }
  const values = normalizedElementValues(counts);
  return values ? {
    id: identity.id,
    domain: identity.domain,
    method: identity.method,
    kind: 'element_distribution',
    source: 'name',
    subjectScope: 'full_name',
    normalization: 'within_source_percent',
    values,
  } : null;
}

/**
 * Hanja stroke numerology is meaningful only when every displayed character
 * has an explicit, resolved Hanja identity. Pure-Hangul mode deliberately
 * disables the Hanja and four-frame calculators; their evaluator-neutral
 * placeholder scores must never be surfaced as real naming evidence.
 */
function hasCompleteHanjaIdentity(namingReport: NamingReport): boolean {
  const characters = [
    ...namingReport.name.surname,
    ...namingReport.name.givenName,
  ];
  return characters.length > 0 && characters.every((character) =>
    typeof character.hanja === 'string' && character.hanja.trim().length > 0);
}

function nullableScore(
  value: unknown,
  reason: string,
): number | null {
  if (value === null) return null;
  if (typeof value !== 'number'
    || !Number.isFinite(value)
    || value < 0
    || value > 100) {
    throw new ReportDeliveryContractError(reason);
  }
  return value;
}

function positiveYear(
  value: unknown,
  reason: string,
): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new ReportDeliveryContractError(reason);
  }
  return Number(value);
}

function optionalTrendPoint(
  value: unknown,
  reason: string,
): NamingTrendFactV1['matchedPoint'] {
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReportDeliveryContractError(reason);
  }
  const point = value as Record<string, unknown>;
  if (Object.keys(point).length !== 3
    || !Object.hasOwn(point, 'year')
    || !Object.hasOwn(point, 'rank')
    || !Object.hasOwn(point, 'count')
    || !Number.isSafeInteger(point.rank)
    || Number(point.rank) < 1
    || !Number.isSafeInteger(point.count)
    || Number(point.count) < 1) {
    throw new ReportDeliveryContractError(reason);
  }
  return {
    year: positiveYear(point.year, reason),
    rank: Number(point.rank),
    count: Number(point.count),
  };
}

function namingTrendFact(
  namingReport: NamingReport,
  birth: BirthInfo,
): NamingTrendFactV1 | null {
  const trend = namingReport.nameTrend;
  if (!trend) return null;
  if (trend.sourceTier !== 'T5_OFFICIAL'
    || trend.authorityTruthEligible !== true
    || !['male', 'female', 'unknown'].includes(trend.gender)
    || !['current', 'era_fit', 'dated', 'overused', 'unknown'].includes(trend.status)) {
    throw new ReportDeliveryContractError('NAMING_TREND_PROVENANCE_INVALID');
  }
  const givenHangul = boundedEngineText(
    trend.givenHangul,
    'NAMING_TREND_IDENTITY_INVALID',
    8,
  );
  const expectedGivenHangul = namingReport.name.givenName
    .map((character) => character.hangul)
    .join('');
  if (givenHangul !== expectedGivenHangul) {
    throw new ReportDeliveryContractError('NAMING_TREND_IDENTITY_INVALID');
  }
  const birthYear = trend.birthYear === null
    ? null
    : positiveYear(trend.birthYear, 'NAMING_TREND_YEAR_INVALID');
  const matchedYear = trend.matchedYear === null
    ? null
    : positiveYear(trend.matchedYear, 'NAMING_TREND_YEAR_INVALID');
  const latestYear = positiveYear(trend.latestYear, 'NAMING_TREND_YEAR_INVALID');
  if (birthYear !== null && birthYear !== birth.year) {
    throw new ReportDeliveryContractError('NAMING_TREND_BIRTH_MISMATCH');
  }
  if ((birth.gender === 'male' || birth.gender === 'female')
    && trend.gender !== birth.gender) {
    throw new ReportDeliveryContractError('NAMING_TREND_BIRTH_MISMATCH');
  }
  const trendFit = nullableScore(trend.trendFit, 'NAMING_TREND_SCORE_INVALID');
  const trendRisk = nullableScore(trend.trendRisk, 'NAMING_TREND_SCORE_INVALID');
  const eraFitScore = nullableScore(
    trend.eraFitScore,
    'NAMING_TREND_SCORE_INVALID',
  );
  if (trendFit !== eraFitScore
    || (trend.status === 'unknown') !== (
      trendFit === null && trendRisk === null && eraFitScore === null
    )) {
    throw new ReportDeliveryContractError('NAMING_TREND_SCORE_INVALID');
  }
  const matchedPoint = optionalTrendPoint(
    trend.matchedPoint,
    'NAMING_TREND_MATCHED_POINT_INVALID',
  );
  const latestPoint = optionalTrendPoint(
    trend.latestPoint,
    'NAMING_TREND_LATEST_POINT_INVALID',
  );
  if ((matchedPoint !== null && matchedPoint.year !== matchedYear)
    || (latestPoint !== null && latestPoint.year !== latestYear)
    || (matchedYear !== null && matchedYear > latestYear)) {
    throw new ReportDeliveryContractError('NAMING_TREND_POINT_YEAR_INVALID');
  }
  return {
    id: 'naming.name-trend',
    domain: 'naming',
    method: 'spring-ts.official-name-trend-projection.v1',
    kind: 'naming_trend',
    source: 'spring-ts.NamingReport.nameTrend',
    projection: 'selective_without_recalculation',
    sourceFields: ['nameTrend'],
    sourceTier: 'T5_OFFICIAL',
    authorityTruthEligible: true,
    givenHangul,
    gender: trend.gender,
    birthYear,
    matchedYear,
    latestYear,
    trendFit,
    trendRisk,
    eraFitScore,
    status: trend.status,
    matchedPoint,
    latestPoint,
  };
}

function roundedOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function phoneticRiskForScore(
  score: number,
): NamingPhoneticFactV1['transitions'][number]['risk'] {
  if (score < 72) return 'high';
  if (score < 86) return 'medium';
  return 'low';
}

function namingPhoneticFact(
  namingReport: NamingReport,
): NamingPhoneticFactV1 | null {
  const phonetic = namingReport.phonetic;
  if (!phonetic) return null;
  if (phonetic.sourceTier !== 'T3_AUTHORED_INTERPRETATION'
    || phonetic.authorityTruthEligible !== false
    || !['smooth', 'watch', 'awkward', 'unknown'].includes(phonetic.status)) {
    throw new ReportDeliveryContractError('NAMING_PHONETIC_PROVENANCE_INVALID');
  }
  const fullHangul = boundedEngineText(
    phonetic.fullHangul,
    'NAMING_PHONETIC_IDENTITY_INVALID',
    12,
  );
  const surnameHangul = boundedEngineText(
    phonetic.surnameHangul,
    'NAMING_PHONETIC_IDENTITY_INVALID',
    4,
  );
  const givenHangul = boundedEngineText(
    phonetic.givenHangul,
    'NAMING_PHONETIC_IDENTITY_INVALID',
    8,
  );
  if (surnameHangul !== namingReport.name.surname.map((char) => char.hangul).join('')
    || givenHangul !== namingReport.name.givenName.map((char) => char.hangul).join('')
    || fullHangul !== `${surnameHangul}${givenHangul}`) {
    throw new ReportDeliveryContractError('NAMING_PHONETIC_IDENTITY_INVALID');
  }
  if (!Array.isArray(phonetic.transitions)
    || phonetic.transitions.length !== Array.from(givenHangul).length
    || phonetic.transitions.length > 8) {
    throw new ReportDeliveryContractError('NAMING_PHONETIC_TRANSITIONS_INVALID');
  }
  const surnameCharacters = Array.from(surnameHangul);
  const givenCharacters = Array.from(givenHangul);
  const expectedTransitions = [
    {
      from: surnameCharacters[surnameCharacters.length - 1],
      to: givenCharacters[0],
      boundary: 'surname_given' as const,
    },
    ...givenCharacters.slice(0, -1).map((from, index) => ({
      from,
      to: givenCharacters[index + 1],
      boundary: 'given_internal' as const,
    })),
  ];
  const transitions = phonetic.transitions.map((transition, index) => {
    const expected = expectedTransitions[index];
    if (!expected
      || transition.from !== expected.from
      || transition.to !== expected.to
      || transition.boundary !== expected.boundary
      || !Number.isFinite(transition.score)
      || transition.score < 0
      || transition.score > 100
      || transition.risk !== phoneticRiskForScore(transition.score)
      || !Array.isArray(transition.signals)
      || transition.signals.length > 16) {
      throw new ReportDeliveryContractError('NAMING_PHONETIC_TRANSITION_INVALID');
    }
    const seenSignals = new Set<string>();
    const signals: NamingPhoneticFactV1['transitions'][number]['signals'] =
      transition.signals.map((signal: {
        readonly code: string;
        readonly severity: 'low' | 'medium' | 'high';
        readonly penalty: number;
      }) => {
      const code = boundedEngineText(
        signal.code,
        'NAMING_PHONETIC_SIGNAL_INVALID',
        64,
      );
      if (!/^[a-z][a-z0-9_]{0,63}$/u.test(code)
        || seenSignals.has(code)
        || !['low', 'medium', 'high'].includes(signal.severity)
        || !Number.isSafeInteger(signal.penalty)
        || signal.penalty < 0
        || signal.penalty > 100) {
        throw new ReportDeliveryContractError('NAMING_PHONETIC_SIGNAL_INVALID');
      }
      seenSignals.add(code);
      return {
        code,
        severity: signal.severity,
        penalty: signal.penalty,
      };
      });
    const expectedScore = Math.max(
      0,
      Math.min(
        100,
        roundedOneDecimal(
          100 - signals.reduce(
            (sum: number, signal) => sum + signal.penalty,
            0,
          ),
        ),
      ),
    );
    if (transition.score !== expectedScore) {
      throw new ReportDeliveryContractError('NAMING_PHONETIC_TRANSITION_SCORE_INVALID');
    }
    return {
      from: transition.from,
      to: transition.to,
      boundary: transition.boundary,
      score: transition.score,
      risk: transition.risk,
      signals,
    };
  });
  const transitionScore = nullableScore(
    phonetic.transitionScore,
    'NAMING_PHONETIC_SCORE_INVALID',
  );
  const familyNameFitScore = nullableScore(
    phonetic.familyNameFitScore,
    'NAMING_PHONETIC_SCORE_INVALID',
  );
  const phoneticScore = nullableScore(
    phonetic.phoneticScore,
    'NAMING_PHONETIC_SCORE_INVALID',
  );
  const expectedTransitionScore = transitions.length === 0
    ? null
    : roundedOneDecimal(
      transitions.reduce((sum, transition) => sum + transition.score, 0)
        / transitions.length,
    );
  const expectedFamilyNameFitScore =
    transitions.find((transition) => transition.boundary === 'surname_given')?.score
    ?? null;
  const expectedPhoneticScore =
    expectedTransitionScore === null && expectedFamilyNameFitScore === null
      ? null
      : roundedOneDecimal(
        ((expectedTransitionScore ?? 100) * 0.6)
        + ((expectedFamilyNameFitScore ?? 100) * 0.4),
      );
  const severities = transitions.flatMap((transition) =>
    transition.signals.map((
      signal: NamingPhoneticFactV1['transitions'][number]['signals'][number],
    ) => signal.severity));
  const expectedStatus = phoneticScore === null
    ? 'unknown'
    : severities.includes('high')
      ? phoneticScore < 78 ? 'awkward' : 'watch'
      : severities.filter((severity) => severity === 'medium').length >= 2
        ? 'watch'
        : phoneticScore < 72
          ? 'awkward'
          : phoneticScore < 86 ? 'watch' : 'smooth';
  if (transitionScore !== expectedTransitionScore
    || familyNameFitScore !== expectedFamilyNameFitScore
    || phoneticScore !== expectedPhoneticScore
    || phonetic.status !== expectedStatus) {
    throw new ReportDeliveryContractError('NAMING_PHONETIC_SCORE_INVALID');
  }
  return {
    id: 'naming.phonetic',
    domain: 'naming',
    method: 'spring-ts.phonetic-transition-projection.v1',
    kind: 'naming_phonetic',
    source: 'spring-ts.NamingReport.phonetic',
    projection: 'selective_without_recalculation',
    sourceFields: ['phonetic'],
    sourceTier: 'T3_AUTHORED_INTERPRETATION',
    authorityTruthEligible: false,
    fullHangul,
    surnameHangul,
    givenHangul,
    phoneticScore,
    transitionScore,
    familyNameFitScore,
    status: phonetic.status,
    transitions,
  };
}

function nameStatisticsFact(
  springReport: SpringReport | null,
  namingReport: NamingReport,
): NameStatisticsFactV1 | null {
  if (!springReport) return null;
  if (springReport.namingReport.name.fullHangul !== namingReport.name.fullHangul) {
    throw new ReportDeliveryContractError('NAME_STATISTICS_IDENTITY_INVALID');
  }
  const popularityRank = springReport.popularityRank;
  const maleRatio = springReport.maleRatio;
  const nameGender = springReport.nameGender;
  if ((popularityRank !== null
      && (typeof popularityRank !== 'number'
        || !Number.isFinite(popularityRank)
        || popularityRank <= 0
        || popularityRank > Number.MAX_SAFE_INTEGER))
    || (maleRatio !== null
      && (typeof maleRatio !== 'number'
        || !Number.isFinite(maleRatio)
        || maleRatio < 0
        || maleRatio > 1))
    || !['male', 'female', 'unknown'].includes(nameGender)
    || (maleRatio === null && nameGender !== 'unknown')
    || (maleRatio !== null
      && nameGender !== (maleRatio >= 0.5 ? 'male' : 'female'))) {
    throw new ReportDeliveryContractError('NAME_STATISTICS_INVALID');
  }
  if (popularityRank === null && maleRatio === null && nameGender === 'unknown') {
    return null;
  }
  return {
    id: 'naming.statistics',
    domain: 'naming',
    method: 'spring-ts.name-stat-summary-projection.v1',
    kind: 'name_statistics',
    source: 'spring-ts.SpringReport',
    projection: 'selective_without_recalculation',
    sourceFields: ['popularityRank', 'maleRatio', 'nameGender'],
    popularityRank,
    maleRatio,
    nameGender,
  };
}

function metric(
  id: string,
  domain: MetricFactV1['domain'],
  method: string,
  label: string,
  value: number,
  unit: MetricFactV1['unit'],
  min: number,
  max: number,
  direction: MetricFactV1['direction'],
): MetricFactV1 | null {
  if (![value, min, max].every(Number.isFinite) || min > max || value < min || value > max) {
    throw new ReportDeliveryContractError(`METRIC_OUT_OF_RANGE_${id}`);
  }
  return {
    id, domain, method, kind: 'metric', label, value, unit,
    range: { min, max }, direction,
  };
}

function legalStatus(char: CharDetail): NameCharacterFactV1['legal'] {
  const annotation = char.legalStatus === 'allowed' || char.legalStatus === 'variantAllowed'
    ? true
    : char.legalStatus === 'notAllowed'
      ? false
      : null;
  if (char.legalRegistrable !== undefined
    && annotation !== null
    && char.legalRegistrable !== annotation) {
    return 'unknown';
  }
  const resolved = char.legalRegistrable ?? annotation;
  if (resolved === true) return 'registrable';
  if (resolved === false) return 'not_registrable';
  return 'unknown';
}

const YONGSHIN_METHOD_AXES: readonly YongshinMethodAxisV1[] = [
  'eokbu',
  'johu',
  'gyeokguk',
  'tonggwan',
  'byeongyak',
  'siksangFlow',
];

function yongshinFact(
  saju: SajuSummary,
  options?: LocalReportOptionsV1,
): YongshinFactV1 | null {
  if (!saju.yongshin) return null;
  const consensus = saju.yongshinConsensus ?? saju.yongshin.consensus;
  const competingElements = consensus?.final.competingElements.map(canonicalElement) ?? [];
  if (competingElements.some((element) => element === null)) {
    throw new ReportDeliveryContractError('YONGSHIN_CONSENSUS_ELEMENT_INVALID');
  }
  const warnings = saju.yongshin.warnings ?? [];
  if (warnings.some((warning) => typeof warning !== 'string' || warning.trim().length === 0)) {
    throw new ReportDeliveryContractError('YONGSHIN_WARNING_INVALID');
  }
  const school = resolveSchoolPresetMetadata(
    options?.schoolPreset,
    options?.precisionConfig?.useSchoolPreset === true,
  );
  const yongshinMode = options?.precisionConfig?.yongshinMode ?? 'chengbai_strict';
  const methodCandidates = consensus
    ? YONGSHIN_METHOD_AXES.map((method) => {
        const candidate = consensus[method];
        const element = canonicalElement(candidate.element);
        if (candidate.element !== null && element === null) {
          throw new ReportDeliveryContractError('YONGSHIN_METHOD_ELEMENT_INVALID');
        }
        if (!Number.isFinite(candidate.score) || candidate.score < 0 || candidate.score > 1) {
          throw new ReportDeliveryContractError('YONGSHIN_METHOD_SCORE_INVALID');
        }
        return { method, element, score: candidate.score };
      })
    : [];
  return {
    id: 'saju.yongshin',
    domain: 'saju',
    method: 'saju-ts.yongshin.v1',
    kind: 'yongshin',
    element: canonicalElement(saju.yongshin.element),
    confidence: saju.yongshin.confidence,
    ...(saju.axisStrength?.yongshin
      ? { judgmentStrength: saju.axisStrength.yongshin }
      : {}),
    warnings: [...warnings],
    interpretationPolicy: {
      schoolPreset: school.selected,
      schoolLabel: school.label,
      schoolSelection: school.source === 'request' ? 'user_selected' : 'product_default',
      schoolWeightsApplied: school.useSchoolPreset,
      yongshinMode,
      yongshinModeSelection: options?.precisionConfig?.yongshinMode === undefined
        ? 'product_default'
        : 'user_selected',
    },
    ...(methodCandidates.length > 0 ? { methodCandidates } : {}),
    ...(consensus ? {
      consensus: {
        conflictLevel: consensus.final.conflictLevel,
        competingElements: competingElements as FiveElementIdV1[],
      },
    } : {}),
    ...(saju.yongshin.jonggyeokRisk ? {
      jonggyeokRisk: {
        level: saju.yongshin.jonggyeokRisk.level,
        direction: saju.yongshin.jonggyeokRisk.direction,
        strengthIndex: saju.yongshin.jonggyeokRisk.strengthIndex,
        dominanceRatio: saju.yongshin.jonggyeokRisk.dominanceRatio,
        subtypes: [...saju.yongshin.jonggyeokRisk.subtypes],
        maxCandidateScore: saju.yongshin.jonggyeokRisk.maxCandidateScore,
        confidenceAttenuated: saju.yongshin.jonggyeokRisk.confidenceAttenuated,
      },
    } : {}),
  };
}

function nameCharacterFact(
  char: CharDetail,
  position: NameCharacterFactV1['position'],
  index: number,
): NameCharacterFactV1 {
  const element = canonicalElement(char.element);
  const hasHanja = typeof char.hanja === 'string' && char.hanja.trim().length > 0;
  return {
    id: `naming.character.${position}.${index}`,
    domain: 'naming',
    method: hasHanja
      ? 'spring-ts.naming-report-character.v1'
      : 'spring-ts.pure-hangul-character.v1',
    kind: 'name_character',
    position,
    index,
    hangul: char.hangul,
    ...(hasHanja ? { hanja: char.hanja } : {}),
    ...(char.meaning ? { meaning: char.meaning } : {}),
    // Without Hanja this value is a Hangul glyph-stroke proxy used inside the
    // phonetic calculator, not an 81-numerology stroke count. The current DTO
    // has no basis discriminator, so omitting it is safer than laundering it.
    ...(hasHanja && Number.isFinite(char.strokes) ? { strokes: char.strokes } : {}),
    ...(element ? { element } : {}),
    ...(char.polarity ? { polarity: char.polarity } : {}),
    legal: legalStatus(char),
  };
}

function interactionFact(springReport: SpringReport | null): NameSajuInteractionFactV1 | null {
  const compatibility = springReport?.sajuCompatibility;
  if (!compatibility) return null;
  const yongshinElement = canonicalElement(compatibility.yongshinElement);
  const gishinElement = canonicalElement(compatibility.gishinElement);
  const projectedNameElements = compatibility.nameElements.map(canonicalElement);
  if (projectedNameElements.some((element) => element === null)) {
    throw new ReportDeliveryContractError('INTERACTION_NAME_ELEMENT_INVALID');
  }
  const nameElements = projectedNameElements as FiveElementIdV1[];
  const requireMatchCount = (value: number, label: string): number => {
    if (!Number.isSafeInteger(value) || value < 0 || value > nameElements.length) {
      throw new ReportDeliveryContractError(`INTERACTION_${label}_COUNT_INVALID`);
    }
    return value;
  };
  const yongshinMatchCount = requireMatchCount(
    compatibility.yongshinMatchCount,
    'YONGSHIN',
  );
  const gishinMatchCount = requireMatchCount(
    compatibility.gishinMatchCount,
    'GISHIN',
  );
  if ((!yongshinElement && yongshinMatchCount !== 0)
    || (!gishinElement && gishinMatchCount !== 0)) {
    throw new ReportDeliveryContractError('INTERACTION_UNRESOLVED_ELEMENT_MATCH');
  }
  const classification: NameSajuInteractionFactV1['classification'] = !yongshinElement
    ? 'unavailable'
    : gishinMatchCount > yongshinMatchCount && gishinMatchCount >= 1
      ? 'caution_signal'
      : yongshinMatchCount > 0 && gishinMatchCount > 0
        ? 'mixed_signals'
        : yongshinMatchCount > 0
          ? 'supportive_signal'
          : 'no_direct_match';
  const conflict = compatibility.yongshinConsensusConflictLevel === 'medium'
    || compatibility.yongshinConsensusConflictLevel === 'high';
  const safetyProfile = compatibility.safetyProfile;
  const safetyCompetingElements = safetyProfile?.competingElements.map(canonicalElement) ?? [];
  if (safetyCompetingElements.some((element) => element === null)) {
    throw new ReportDeliveryContractError('INTERACTION_SAFETY_ELEMENT_INVALID');
  }
  if (safetyProfile
    && (!['safe', 'balanced', 'aggressive'].includes(safetyProfile.posture)
      || !['legacy_direct_reinforcement', 'safe_balance', 'aggressive_reinforcement']
        .includes(safetyProfile.strategy))) {
    throw new ReportDeliveryContractError('INTERACTION_SAFETY_PROFILE_INVALID');
  }
  return {
    id: 'interaction.name-saju-element-match',
    domain: 'interaction',
    method: 'yongshin-gishin-element-match.v1',
    kind: 'name_saju_interaction',
    classification,
    yongshinElement,
    gishinElement,
    nameElements,
    nameElementScope: 'surname_and_given_name',
    yongshinMatchCount,
    gishinMatchCount,
    ...(safetyProfile ? {
      safety: {
        posture: safetyProfile.posture,
        strategy: safetyProfile.strategy,
        ...(safetyProfile.conflictLevel ? { conflictLevel: safetyProfile.conflictLevel } : {}),
        competingElements: safetyCompetingElements as FiveElementIdV1[],
      },
    } : {}),
    limitations: [
      'element_match_scope_only',
      'not_a_combined_balance_score',
      ...(conflict ? ['consensus_conflict_present' as const] : []),
      ...(safetyProfile?.posture === 'aggressive' ? ['safety_profile_caution' as const] : []),
      ...(!safetyProfile ? ['safety_profile_unavailable' as const] : []),
    ],
  };
}

function interactionAvailability(fact: NameSajuInteractionFactV1 | null): DeliveryAvailabilityV1 {
  if (!fact || fact.classification === 'unavailable') {
    return availability('unavailable', 'INTERACTION_EVIDENCE_INSUFFICIENT');
  }
  if (fact.limitations.includes('safety_profile_caution')) {
    return availability('limited', 'NAME_SAJU_SAFETY_CAUTION');
  }
  return fact.limitations.includes('consensus_conflict_present')
    ? availability('limited', 'YONGSHIN_CONSENSUS_CONFLICT')
    : fact.limitations.includes('safety_profile_unavailable')
      ? availability('limited', 'METHOD_SCOPE_LIMITED')
      : READY;
}

function cellAvailability(cell: TieredFortune): DeliveryAvailabilityV1 {
  if (cell.meaningfulness === 'meaningful') return READY;
  return cell.meaningfulness === 'limited'
    ? availability('limited', 'METHOD_SCOPE_LIMITED')
    : availability('unavailable', 'NOT_APPLICABLE');
}

function natalJudgmentAvailability(
  saju: SajuSummary | null,
): DeliveryAvailabilityV1 {
  const assessment = assessNatalEvidenceV1(saju);
  return assessment.status === 'ready'
    ? READY
    : availability(assessment.status, ...assessment.reasonCodes);
}

function fortuneCellAvailability(
  cell: TieredFortune,
  natalAvailability: DeliveryAvailabilityV1,
): DeliveryAvailabilityV1 {
  const authoredAvailability = cellAvailability(cell);
  if (authoredAvailability.status === 'unavailable') return authoredAvailability;
  return aggregateAvailability([authoredAvailability, natalAvailability]);
}

function interpretationFromCell(
  id: string,
  cell: TieredFortune,
  depth: ReportDepthV1,
  ratingFactRef: string | undefined,
  origin: ReportInterpretationV1['origin'],
  natalAvailability: DeliveryAvailabilityV1,
): ReportInterpretationV1 {
  const evidenceUnavailable = natalAvailability.status === 'unavailable';
  const resolvedAvailability = fortuneCellAvailability(cell, natalAvailability);
  const unavailableHeadline = '사주 판단 근거가 없어 이 기간의 흐름을 해석할 수 없어요';
  const unavailableParagraph = '출생 사주 판단 근거를 확인한 뒤 기간별 흐름을 다시 살펴보세요.';
  const standardParagraphs = cell.standard.paragraphs.map((paragraph) => paragraph.plainText);
  const expertParagraphs = cell.expert.paragraphs.map((paragraph) => paragraph.plainText);
  const standard = DEPTH_ORDER[depth] >= DEPTH_ORDER.standard ? {
    paragraphs: evidenceUnavailable
      ? [unavailableParagraph]
      : standardParagraphs,
    ...(!evidenceUnavailable && cell.standard.livingTips?.length
      ? { livingTips: [...cell.standard.livingTips] }
      : {}),
    ...(!evidenceUnavailable && cell.standard.cautions?.length
      ? { cautions: [...cell.standard.cautions] }
      : {}),
  } : undefined;
  const expert = DEPTH_ORDER[depth] >= DEPTH_ORDER.expert ? {
    paragraphs: evidenceUnavailable
      ? [unavailableParagraph]
      : expertParagraphs,
    ...(ratingFactRef ? { numericalFactRefs: [ratingFactRef] } : {}),
  } : undefined;
  return {
    id,
    domain: 'fortune',
    availability: resolvedAvailability,
    authority: 'interpretive',
    // Limited evidence is represented by `availability`, independently of the
    // authored category copy. This lets consumers show one scoped warning
    // without replacing or prefixing every card. Fully unavailable fallbacks
    // remain deterministic delivery copy.
    origin: evidenceUnavailable ? 'deterministic_template' : origin,
    factRefs: ratingFactRef ? [ratingFactRef] : [],
    brief: {
      headline: evidenceUnavailable
        ? unavailableHeadline
        : cell.brief.headline,
      ...(!evidenceUnavailable && cell.brief.hook ? { hook: cell.brief.hook } : {}),
    },
    ...(standard ? { standard } : {}),
    ...(expert ? { expert } : {}),
  };
}

function formatAnchorDate(targetDate: Date): string {
  const parts = targetCalendarParts(targetDate);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function frameInterpretation(
  frame: NamingReportFrame,
  depth: ReportDepthV1,
): ReportInterpretationV1 | null {
  if (!FOUR_FRAME_AUTHORED_COPY_APPROVED) {
    const safeCopy = buildSafeFourFrameCopyV1(frame);
    const id = `naming.frame.${frame.type}.${depth}.interpretation`;
    return {
      id,
      domain: 'naming',
      availability: READY,
      authority: 'interpretive',
      origin: 'deterministic_template',
      factRefs: [`naming.frame.${frame.type}`],
      brief: { headline: safeCopy.headline },
      ...(DEPTH_ORDER[depth] >= DEPTH_ORDER.standard ? {
        standard: { paragraphs: [...safeCopy.paragraphs] },
      } : {}),
      ...(depth === 'expert' ? {
        expert: { paragraphs: [...safeCopy.paragraphs] },
      } : {}),
    };
  }
  const meaning = frame.meaning;
  if (!meaning) return null;
  const id = `naming.frame.${frame.type}.${depth}.interpretation`;
  return {
    id,
    domain: 'naming',
    availability: READY,
    authority: 'interpretive',
    // The frame judgment itself is deterministic, but the human-readable
    // title/body comes from the versioned four-frame meaning asset.
    origin: 'authored_bundle',
    factRefs: [`naming.frame.${frame.type}`],
    brief: { headline: meaning.title, hook: meaning.summary },
    ...(DEPTH_ORDER[depth] >= DEPTH_ORDER.standard ? {
      standard: {
        paragraphs: [meaning.positive_aspects, meaning.caution_points, meaning.life_period_influence].filter(Boolean),
      },
    } : {}),
    ...(DEPTH_ORDER[depth] >= DEPTH_ORDER.expert ? {
      expert: {
        paragraphs: [
          meaning.detailed_explanation,
          meaning.special_characteristics,
          meaning.challenge_period,
          meaning.opportunity_area,
          ...meaning.personality_traits,
          ...meaning.suitable_career,
        ].filter(Boolean),
      },
    } : {}),
  };
}

function surfaceAvailability(
  surface: ReportSurfaceSelectionV1,
  saju: SajuSummary | null,
  namingReport: NamingReport | null,
  springReport: SpringReport | null,
  generatedContentLimited: boolean,
  interaction: NameSajuInteractionFactV1 | null,
): DeliveryAvailabilityV1 {
  const reasons: DeliveryReasonCodeV1[] = [];
  if (saju && surface.id !== 'naming') {
    reasons.push(...natalJudgmentAvailability(saju).reasonCodes);
  }
  if (surface.id === 'naming' && !namingReport) {
    return availability('unavailable', 'NAME_ANALYSIS_UNAVAILABLE');
  }
  if ((surface.id === 'naming' || surface.id === 'integrated')
    && namingReport
    && !hasCompleteHanjaIdentity(namingReport)) {
    reasons.push('METHOD_SCOPE_LIMITED');
  }
  if (surface.id === 'integrated' && !springReport) {
    reasons.push('NAME_INPUT_MISSING');
  }
  if (surface.id === 'integrated'
    && springReport
    && (!interaction || interaction.classification === 'unavailable')) {
    reasons.push('INTERACTION_EVIDENCE_INSUFFICIENT');
  }
  if (surface.id === 'integrated' && interaction?.limitations.includes('consensus_conflict_present')) {
    reasons.push('YONGSHIN_CONSENSUS_CONFLICT');
  }
  if (surface.id === 'integrated' && interaction?.limitations.includes('safety_profile_caution')) {
    reasons.push('NAME_SAJU_SAFETY_CAUTION');
  }
  if (surface.id === 'integrated' && interaction?.limitations.includes('safety_profile_unavailable')) {
    reasons.push('METHOD_SCOPE_LIMITED');
  }
  if (surface.id !== 'naming' && surface.timeline && generatedContentLimited) {
    reasons.push('GENERATED_CONTENT_PARTIAL');
  }
  return reasons.length ? availability('limited', ...reasons) : READY;
}

function overallAvailability(surfaces: readonly ReportSurfaceV1[]): DeliveryAvailabilityV1 {
  if (surfaces.every((surface) => surface.availability.status === 'unavailable')) {
    return availability(
      'unavailable',
      ...surfaces.flatMap((surface) => surface.availability.reasonCodes),
    );
  }
  const reasons = surfaces.flatMap((surface) => surface.availability.reasonCodes);
  return reasons.length ? availability('limited', ...reasons) : READY;
}

function aggregateAvailability(
  values: readonly DeliveryAvailabilityV1[],
): DeliveryAvailabilityV1 {
  if (values.length === 0 || values.every((value) => value.status === 'ready')) return READY;
  const reasonCodes = values.flatMap((value) => value.reasonCodes);
  return values.every((value) => value.status === 'unavailable')
    ? availability('unavailable', ...reasonCodes)
    : availability('limited', ...reasonCodes);
}

function cellKey(period: TieredPeriodKind, category: ReportCategoryIdV1): string {
  return `${period}:${category}`;
}

function surfaceSliceKey(surface: ReportSurfaceSelectionV1): string {
  const timeline = surface.id === 'naming' ? undefined : surface.timeline;
  const periods = timeline?.periods.join('-') ?? 'none';
  const categories = timeline?.categories.join('-') ?? 'none';
  const life = surface.id === 'saju' ? surface.life ?? 'none' : 'none';
  return [
    surface.id,
    surface.depth,
    `periods-${periods}`,
    `categories-${categories}`,
    `life-${life}`,
  ].join('.');
}

function cellFor(
  matrix: TieredMatrixSelection | null,
  period: TieredPeriodKind,
  category: ReportCategoryIdV1,
): TieredFortune | null {
  const scoped = matrix?.periods[period];
  if (!scoped) return null;
  if (category === 'overall') return scoped.overall;
  return scoped.byCategory[category as TieredCategoryId] ?? null;
}

function timelineBlock(
  surface: Extract<ReportSurfaceSelectionV1, { readonly id: 'integrated' | 'saju' }>,
  matrix: TieredMatrixSelection | null,
  natalAvailability: DeliveryAvailabilityV1,
): ReportBlockV1 | null {
  if (!surface.timeline) return null;
  const availablePeriodOrder = [...surface.timeline.periods];
  const periods = availablePeriodOrder.map((period) => {
    const scoped = matrix?.periods[period];
    return {
      id: period,
      label: scoped?.periodLabel ?? period,
      cells: surface.timeline!.categories.map((category) => {
        const cell = cellFor(matrix, period, category);
        const status = cell
          ? fortuneCellAvailability(cell, natalAvailability)
          : availability('unavailable', 'NOT_APPLICABLE');
        const suffix = `${period}.${category}`;
        return {
          category,
          availability: status,
          ...(cell?.stars !== null
            && cell?.stars !== undefined
            ? { ratingFactRef: `fortune.${suffix}.stars` }
            : {}),
          ...(cell ? { interpretationRef: `fortune.${suffix}.${surface.depth}.interpretation` } : {}),
        };
      }),
    };
  });
  return {
    id: `${surfaceSliceKey(surface)}.timeline`,
    kind: 'timeline',
    title: '사주 시기 흐름',
    basis: 'natal_saju_calendar',
    availability: aggregateAvailability(periods.flatMap((period) =>
      period.cells.map((cell) => cell.availability))),
    defaultPeriod: availablePeriodOrder.includes('today') ? 'today' : availablePeriodOrder[0],
    availablePeriodOrder,
    periods,
  };
}

/**
 * Builds only the requested three-page delivery DTO. The raw generated schema,
 * internal class axes, selection key, and premium body never cross this allowlist.
 */
export async function buildReportDeliveryV1(
  input: BuildReportDeliveryV1Input,
): Promise<ReportDeliveryV1> {
  const selection = validateReportDeliverySelectionV1(input.selection);
  const requestedSurfaceIds = new Set(selection.surfaces.map((surface) => surface.id));
  const needsSaju = requestedSurfaceIds.has('saju') || requestedSurfaceIds.has('integrated');
  if (needsSaju && !input.saju) {
    throw new ReportDeliveryContractError('SAJU_REQUIRED_FOR_REQUESTED_SURFACE');
  }
  const natalAvailability = natalJudgmentAvailability(input.saju);
  if (needsSaju && natalAvailability.status === 'unavailable') {
    throw new ReportDeliveryContractError('SAJU_UNAVAILABLE_FOR_REQUESTED_SURFACE');
  }
  const requestedPeriods = new Set<TieredPeriodKind>();
  const requestedCategoriesByPeriod = new Map<
    TieredPeriodKind,
    Set<TieredCategoryId | 'overall'>
  >();
  const requestedCellDepths = new Set<string>();
  const requestedMaxDepthByCell = new Map<string, ReportDepthV1>();
  const retainMaxDepth = (
    period: TieredPeriodKind,
    category: ReportCategoryIdV1,
    depth: ReportDepthV1,
  ): void => {
    const key = cellKey(period, category);
    const prior = requestedMaxDepthByCell.get(key);
    if (!prior || DEPTH_ORDER[depth] > DEPTH_ORDER[prior]) {
      requestedMaxDepthByCell.set(key, depth);
    }
  };

  for (const surface of selection.surfaces) {
    if (surface.id !== 'naming' && surface.timeline) {
      for (const period of surface.timeline.periods) {
        requestedPeriods.add(period);
        const periodCategories = requestedCategoriesByPeriod.get(period)
          ?? new Set<TieredCategoryId | 'overall'>();
        requestedCategoriesByPeriod.set(period, periodCategories);
        for (const category of surface.timeline.categories) {
          periodCategories.add(category);
          requestedCellDepths.add(`${cellKey(period, category)}:${surface.depth}`);
          retainMaxDepth(period, category, surface.depth);
        }
      }
    }
    if (surface.id === 'saju' && surface.life === 'summary') {
      requestedPeriods.add('life');
      const lifeCategories = requestedCategoriesByPeriod.get('life')
        ?? new Set<TieredCategoryId | 'overall'>();
      lifeCategories.add('overall');
      requestedCategoriesByPeriod.set('life', lifeCategories);
      requestedCellDepths.add(`${cellKey('life', 'overall')}:${surface.depth}`);
      retainMaxDepth('life', 'overall', surface.depth);
    }
  }

  let matrix: TieredMatrixSelection | null = null;
  if (requestedPeriods.size > 0) {
    if (!input.saju) {
      throw new ReportDeliveryContractError('SAJU_REQUIRED_FOR_TIMELINE');
    }
    const { buildTieredMatrixSelection } =
      await import('../tiered/build-tiered-matrix.js');
    matrix = await buildTieredMatrixSelection(input.saju, input.birth, input.targetDate, {
      periods: [...requestedPeriods],
      categoriesByPeriod: Object.fromEntries(
        [...requestedCategoriesByPeriod.entries()].map(([period, categories]) => [
          period,
          [...categories],
        ]),
      ),
      depthByCell: Object.fromEntries([...requestedMaxDepthByCell].map(([key, depth]) => [
        key,
        // Limited evidence keeps the user-requested category depth so the
        // delivery layer can qualify, rather than erase, useful differentiated
        // content. Only a fully unavailable natal basis fails closed to brief.
        natalAvailability.status === 'unavailable' ? 'brief' : depth,
      ])),
      namingReport: input.namingReport ?? undefined,
      sajuCompatibility: input.springReport?.sajuCompatibility,
    });
  }

  const generatedStatus = matrix?.meta.generatedContent?.status;
  const generatedContentLimited = generatedStatus !== undefined
    && generatedStatus !== 'complete'
    && generatedStatus !== 'not_applicable';
  const facts: ReportFactV1[] = [];
  const factIds = new Set<string>();
  const addFact = <T extends ReportFactV1 | null>(fact: T): T => {
    if (fact && !factIds.has(fact.id)) {
      facts.push(fact);
      factIds.add(fact.id);
    }
    return fact;
  };
  const interpretations: ReportInterpretationV1[] = [];
  const interpretationIds = new Set<string>();
  const addInterpretation = <T extends ReportInterpretationV1 | null>(value: T): T => {
    if (value && !interpretationIds.has(value.id)) {
      interpretations.push(value);
      interpretationIds.add(value.id);
    }
    return value;
  };

  const needsSajuFacts = requestedSurfaceIds.has('saju') || requestedSurfaceIds.has('integrated');
  const requiresSajuSurface = requestedSurfaceIds.has('saju');
  const needsNamingSurfaceFacts = requestedSurfaceIds.has('naming');
  const needsInteractionFacts = requestedSurfaceIds.has('integrated');
  const completeHanjaIdentity = input.namingReport
    ? hasCompleteHanjaIdentity(input.namingReport)
    : false;
  const yongshinSafetyFact = needsSajuFacts && input.saju
    ? addFact(yongshinFact(input.saju, input.options))
    : null;
  const sajuPillarFact = needsSajuFacts
    && input.saju
    && input.saju.pillars
    && PILLAR_ORDER.every((position) => input.saju?.pillars?.[position])
    ? addFact<PillarsFactV1>({
        id: 'saju.pillars',
        domain: 'saju',
        method: 'saju-ts.four-pillars.v1',
        kind: 'pillars',
        values: PILLAR_ORDER.map((position) => ({
          position,
          ...input.saju!.pillars[position],
        })),
      })
    : null;
  const sajuTimeFact = needsSajuFacts
    && input.saju
    && (requiresSajuSurface || input.saju.timeCorrection?.provenance)
    ? addFact(timeCorrectionFact(input.saju))
    : null;
  const sajuDayMasterFact = needsSajuFacts && input.saju && input.saju.dayMaster
    ? addFact<DayMasterFactV1>({
        id: 'saju.day-master',
        domain: 'saju',
        method: 'saju-ts.day-master.v1',
        kind: 'day_master',
        stem: input.saju.dayMaster.stem,
        element: canonicalElement(input.saju.dayMaster.element),
        polarity: input.saju.dayMaster.polarity,
      })
    : null;
  const sajuStrengthFact = needsSajuFacts && input.saju && input.saju.strength
    ? addFact<StrengthFactV1>({
        id: 'saju.strength',
        domain: 'saju',
        method: 'saju-ts.strength.v1',
        kind: 'strength',
        level: input.saju.strength.level,
        levelCode: canonicalStrengthLevelCode(input.saju.strength),
        isStrong: input.saju.strength.isStrong,
        ...(input.saju.axisStrength?.strength
          ? { judgmentStrength: input.saju.axisStrength.strength }
          : {}),
      })
    : null;
  const sajuEvidenceFacts: (
    | ShinsalHitsFactV1
    | TenGodAnalysisFactV1
    | NatalRelationsFactV1
    | ElementBalanceFactV1
    | GongmangFactV1
    | GyeokgukSeongpaeFactV1
    | SibiUnseongFactV1
    | DaeunTimelineFactV1
    | YinYangBalanceFactV1
  )[] = [];
  if (requiresSajuSurface && input.saju) {
    const projectedFacts = [
      shinsalHitsFact(input.saju),
      tenGodAnalysisFact(input.saju),
      natalRelationsFact(input.saju),
      elementBalanceFact(input.saju),
      gongmangFact(input.saju),
      gyeokgukSeongpaeFact(input.saju),
      sibiUnseongFact(input.saju),
      daeunTimelineFact(input.saju),
      yinYangBalanceFact(input.saju),
    ];
    for (const projected of projectedFacts) {
      if (projected) {
        addFact(projected);
        sajuEvidenceFacts.push(projected);
      }
    }
  }
  const integratedNameFacts = needsInteractionFacts && input.namingReport
    ? [
        ...input.namingReport.name.surname.map((character, index) =>
          addFact(nameCharacterFact(character, 'surname', index))),
        ...input.namingReport.name.givenName.map((character, index) =>
          addFact(nameCharacterFact(character, 'givenName', index))),
        input.namingReport.phonetic?.phoneticScore == null
          ? null
          : addFact(metric(
              'naming.phonetic-score',
              'naming',
              'spring-ts.phonetic-display.v1',
              '발음 흐름 점수',
              input.namingReport.phonetic.phoneticScore,
              'score_0_100',
              0,
              100,
              'higher_is_better',
            )),
        input.namingReport.nameTrend?.trendFit == null
          ? null
          : addFact(metric(
              'naming.trend-fit',
              'naming',
              'spring-ts.official-name-trend-display.v1',
              '출생시대 이름 적합도',
              input.namingReport.nameTrend.trendFit,
              'score_0_100',
              0,
              100,
              'higher_is_better',
            )),
      ].filter((fact): fact is NameCharacterFactV1 | MetricFactV1 => fact !== null)
    : [];
  const namingDistribution = needsNamingSurfaceFacts && input.namingReport
    ? addFact(nameElementDistribution(
      [...input.namingReport.name.surname, ...input.namingReport.name.givenName]
        .map((character) => character.element),
      {
        id: 'naming.inherent-element-distribution',
        domain: 'naming',
        method: 'spring-ts.naming-report-full-name-elements.v1',
      },
    ))
    : null;
  const namingDetailFacts: (
    | NamingTrendFactV1
    | NamingPhoneticFactV1
    | NameStatisticsFactV1
  )[] = [];
  if (needsNamingSurfaceFacts && input.namingReport) {
    const projectedFacts = [
      namingTrendFact(input.namingReport, input.birth),
      namingPhoneticFact(input.namingReport),
      nameStatisticsFact(input.springReport, input.namingReport),
    ];
    for (const projected of projectedFacts) {
      if (projected) {
        addFact(projected);
        namingDetailFacts.push(projected);
      }
    }
  }
  const interactionNameDistribution = needsInteractionFacts && input.springReport
    ? addFact(nameElementDistribution(
      input.springReport.sajuCompatibility.nameElements,
      {
        id: 'interaction.name-element-distribution',
        domain: 'interaction',
        method: 'spring-ts.saju-compatibility-name-elements.v1',
      },
    ))
    : null;
  const sajuDistribution = input.saju
    && (requestedSurfaceIds.has('saju') || interactionNameDistribution)
    ? addFact(sajuElementDistribution(input.saju))
    : null;
  const interaction = needsInteractionFacts ? addFact(interactionFact(input.springReport)) : null;
  const natalEvidenceLimited = natalAvailability.status !== 'ready';
  const premiumEligible = Boolean(
    input.candidateId
    && input.springReport
    && interaction
    && interaction.classification !== 'unavailable'
    && interaction.safety
    && !natalEvidenceLimited,
  );

  for (const key of requestedCellDepths) {
    const [period, category, depth] = key.split(':') as [
      TieredPeriodKind,
      ReportCategoryIdV1,
      ReportDepthV1,
    ];
    const cell = cellFor(matrix, period, category);
    if (!cell) continue;
    const baseId = `fortune.${period}.${category}`;
    const rating = cell.stars === null ? null : addFact(metric(
      `${baseId}.stars`,
      'saju',
      'spring-ts.tiered-cell-grader.v1',
      `${CATEGORY_LABELS[category]} 별점`,
      cell.stars,
      'stars_1_5',
      1,
      5,
      'higher_is_better',
    ));
    addInterpretation(interpretationFromCell(
      `${baseId}.${depth}.interpretation`,
      cell,
      depth,
      rating?.id,
      matrix?.meta.contentSource === 'authored' ? 'authored_bundle' : 'deterministic_template',
      natalAvailability,
    ));
  }

  const surfaces: ReportSurfaceV1[] = [];
  for (const surface of selection.surfaces) {
    const blocks: ReportBlockV1[] = [];
    const sliceKey = surfaceSliceKey(surface);
    const currentAvailability = surfaceAvailability(
      surface,
      input.saju,
      input.namingReport,
      input.springReport,
      generatedContentLimited,
      interaction,
    );

    if (surface.id === 'integrated') {
      const yongshinName = koreanElementLabel(
        canonicalElement(input.springReport?.sajuCompatibility.yongshinElement),
      );
      const reading = input.springReport ? buildNameSajuReading({
        yongshinMatchCount: input.springReport.sajuCompatibility.yongshinMatchCount,
        gishinMatchCount: input.springReport.sajuCompatibility.gishinMatchCount,
        yongshinName,
        yongshinResolved: interaction?.yongshinElement !== null,
      }) : undefined;
      const hasMethodConflict = interaction?.limitations.includes('consensus_conflict_present') === true;
      const selectedMethodHeadline = interaction?.classification === 'supportive_signal'
        ? '이름에 보완 신호가 보여요'
        : interaction?.classification === 'mixed_signals'
          ? '보완과 주의 신호가 함께 보여요'
          : interaction?.classification === 'caution_signal'
            ? '주의 신호를 함께 살펴보세요'
            : interaction?.classification === 'no_direct_match'
              ? '직접 일치보다 전체 근거를 보세요'
              : '이름을 더하면 통합 해석이 완성돼요';
      const interactionHeadline = input.saju?.yongshin?.jonggyeokRisk?.level === 'HIGH'
        ? `${yongshinName || '선택된 기운'} 후보는 계산됐지만 종격 가능성을 함께 재검토해야 해요`
        : hasMethodConflict
          ? `선택한 기준의 ${yongshinName || '보완 기운'} 결과에서는 ${selectedMethodHeadline}`
        : natalEvidenceLimited
          ? `선택한 기준에서는 ${yongshinName || '보완 기운'} 후보를 참고 범위로 보여드려요`
        : interaction?.safety?.posture === 'aggressive'
        ? '보완보다 과도한 쏠림과 주의 근거를 먼저 보세요'
        : interaction?.limitations.includes('safety_profile_unavailable')
          ? '안전 판단 근거가 부족해 결론을 보류해요'
          : selectedMethodHeadline;
      const integratedSupportingFactRefs = [
        interaction?.id,
        yongshinSafetyFact?.id,
        sajuPillarFact?.id,
        sajuTimeFact?.id,
        sajuDistribution?.id,
        sajuDayMasterFact?.id,
        sajuStrengthFact?.id,
        ...integratedNameFacts.map((fact) => fact.id),
      ].filter((id): id is string => id !== undefined);
      const hero = addInterpretation({
        id: `${sliceKey}.hero.interpretation`,
        domain: 'interaction',
        availability: input.springReport ? currentAvailability : availability('limited', 'NAME_INPUT_MISSING'),
        authority: 'interpretive',
        origin: 'deterministic_template',
        factRefs: [...integratedSupportingFactRefs],
        brief: { headline: interactionHeadline },
        ...(surface.depth === 'standard' ? {
          standard: {
            paragraphs: [interaction?.safety?.posture === 'aggressive'
              ? '직접 일치만 보면 보완 신호가 있어도, 정본 안전 프로필에서는 과도한 보강이나 상충 요소를 함께 경고해요. 이름의 한 요소만 떼어 길하다고 단정하지 않아요.'
              : hasMethodConflict
                ? `${reading?.sentence ?? `선택한 기준에서는 ${yongshinName || '보완 기운'} 후보를 계산했어요.`} 다른 방법이 고른 기운과 차이가 있어 이 결과를 모든 방법의 공통 결론으로 넓히지 않으며, 방법별 후보를 함께 보여드려요.`
              : natalEvidenceLimited
                ? `${reading?.sentence ?? `선택한 기준에서는 ${yongshinName || '보완 기운'} 후보를 계산했어요.`} 신뢰도가 낮은 판단만 참고 범위로 한정하고, 네 기둥·시간 보정·오행 분포 같은 계산 사실은 그대로 표시해요.`
              : interaction?.limitations.includes('safety_profile_unavailable')
                ? '직접 일치 수만으로는 안전한 보완인지 판단할 수 없어요. 안전 프로필 근거가 준비될 때까지 유리하다고 단정하지 않아요.'
              : reading?.sentence ?? '현재는 사주 흐름만 준비됐어요. 이름 분석을 더하면 두 근거의 일치와 차이를 함께 볼 수 있어요.'],
          },
        } : {}),
      });
      blocks.push({
        id: `${sliceKey}.hero`, kind: 'hero', title: '사주 × 이름 핵심 한 줄',
        availability: hero!.availability,
        interpretationRef: hero!.id,
        supportingFactRefs: [...integratedSupportingFactRefs],
      });
      if (interaction) {
        blocks.push({
          id: `${sliceKey}.interaction`, kind: 'fact_group', title: '사주와 이름의 상호작용',
          availability: aggregateAvailability([
            interactionAvailability(interaction),
            natalAvailability,
          ]),
          factRefs: [interaction.id],
          presentation: 'summary',
        });
      }
      if (sajuDistribution && interactionNameDistribution) {
        blocks.push({
          id: `${sliceKey}.elements`, kind: 'element_comparison', title: '사주와 이름의 오행 비율',
          availability: READY,
          sajuDistributionFactRef: sajuDistribution.id,
          nameDistributionFactRef: interactionNameDistribution.id,
          presentation: 'overlay',
          normalization: 'within_source_percent',
        });
      }
      const timeline = timelineBlock(surface, matrix, natalAvailability);
      if (timeline) blocks.push(timeline);
      if (premiumEligible) {
        const teaser = addInterpretation({
          id: `${sliceKey}.story-completion.teaser.interpretation`,
          domain: 'interaction',
          availability: availability('limited', 'SERVER_ENTITLEMENT_REQUIRED'),
          authority: 'interpretive',
          origin: 'deterministic_template',
          factRefs: interaction ? [interaction.id] : [],
          brief: { headline: '이야기 완성하기' },
          ...(surface.depth === 'standard' ? {
            standard: { paragraphs: ['무료 결과의 핵심 근거를 바탕으로 이어지는 개인 서사는 서버의 구매 권한 확인 뒤 별도 응답으로 제공돼요.'] },
          } : {}),
        });
        blocks.push({
          id: `${sliceKey}.story-completion`, kind: 'premium_teaser', title: '이야기 완성하기',
          availability: teaser!.availability,
          offerId: 'story_completion',
          teaserInterpretationRef: teaser!.id,
        });
      }
      blocks.push({
        id: `${sliceKey}.deep-links`, kind: 'deep_links', title: '상세 근거 보기', availability: READY,
        targets: [{ surface: 'saju' }, { surface: 'naming' }],
      });
    } else if (surface.id === 'saju') {
      if (!input.saju) {
        throw new ReportDeliveryContractError('SAJU_REQUIRED_FOR_SAJU_SURFACE');
      }
      const saju = input.saju;
      const pillarFact = sajuPillarFact;
      const timeFact = sajuTimeFact;
      if (!pillarFact || !timeFact) {
        throw new ReportDeliveryContractError('SAJU_CORE_FACTS_REQUIRED');
      }
      const timeFactAvailability = timeFact.input.timePrecision === 'exact'
        ? READY
        : availability('limited', 'BIRTH_TIME_IMPUTED');
      const dayMaster = sajuDayMasterFact;
      const strength = sajuStrengthFact;
      if (!dayMaster || !strength) {
        throw new ReportDeliveryContractError('SAJU_CORE_JUDGMENT_FACTS_REQUIRED');
      }
      const gyeokguk: GyeokgukFactV1 = {
        id: 'saju.gyeokguk', domain: 'saju', method: 'saju-ts.gyeokguk.v1', kind: 'gyeokguk',
        type: saju.gyeokguk.type,
        typeCode: boundedMachineCode(
          saju.gyeokguk.typeCode ?? normalizeGyeokgukTypeCode(saju.gyeokguk.type),
        ),
        category: saju.gyeokguk.category,
        categoryCode: canonicalGyeokgukCategoryCode(saju.gyeokguk),
        baseTenGod: saju.gyeokguk.baseTenGod,
        baseTenGodCode: boundedMachineCode(
          saju.gyeokguk.baseTenGodCode
            ?? (saju.gyeokguk.baseTenGod ? normalizeTenGodCode(saju.gyeokguk.baseTenGod) : null),
        ),
        confidence: saju.gyeokguk.confidence,
        ...(saju.axisStrength?.gyeokguk
          ? { judgmentStrength: saju.axisStrength.gyeokguk }
          : {}),
      };
      const yongshin = yongshinSafetyFact;
      if (!yongshin) {
        throw new ReportDeliveryContractError('YONGSHIN_FACT_REQUIRED');
      }
      const yongshinConsensus = saju.yongshinConsensus ?? saju.yongshin.consensus;
      const yongshinWarnings = saju.yongshin.warnings ?? [];
      addFact(gyeokguk);
      const metricFacts = [
        addFact(metric('saju.yongshin-confidence', 'saju', 'saju-ts.yongshin.v1', '용신 신뢰도', saju.yongshin.confidence, 'confidence_0_100', 0, 100, 'higher_is_better')),
        addFact(metric('saju.gyeokguk-confidence', 'saju', 'saju-ts.gyeokguk.v1', '격국 신뢰 비율', saju.gyeokguk.confidence, 'ratio_0_1', 0, 1, 'higher_is_better')),
      ].filter((fact): fact is MetricFactV1 => fact !== null);
      const judgmentWeights: Readonly<Record<SajuJudgmentStrengthV1, number>> = {
        definite: 0,
        practical: 1,
        candidate: 2,
        deferred: 3,
      };
      const relevantJudgments = [
        saju.axisStrength?.strength,
        saju.axisStrength?.gyeokguk,
        saju.axisStrength?.yongshin,
      ].filter((value): value is SajuJudgmentStrengthV1 => value !== undefined);
      const weakestJudgment = relevantJudgments.sort(
        (left, right) => judgmentWeights[right] - judgmentWeights[left],
      )[0];
      const mustDefer = saju.yongshin.jonggyeokRisk?.level === 'HIGH'
        || weakestJudgment === 'deferred'
        || saju.gyeokguk.confidence < 0.45
        || saju.yongshin.confidence < 45;
      const mustHedge = mustDefer
        || weakestJudgment === 'candidate'
        || weakestJudgment === 'practical';
      const strengthLabel = saju.axisStrength?.strength === 'candidate'
        || saju.axisStrength?.strength === 'deferred'
        ? `${saju.strength.level} 가능성`
        : saju.strength.level;
      const yongshinLabel = expertElementLabel(canonicalElement(saju.yongshin.element));
      const sajuHook = mustDefer
        ? `선택한 용신 방법에서는 ${yongshinLabel}을 보완 후보로 계산했어요. 종격·방법 차이·신뢰도 때문에 모든 방법의 공통 결론으로 일반화는 보류해요`
        : mustHedge
          ? `${saju.gyeokguk.type} 후보로 보고 ${yongshinLabel} 보완 가능성을 함께 검토해요`
          : `격국 ${saju.gyeokguk.type}, 보완 오행 ${yongshinLabel}`;
      const riskParagraphs = [
        ...yongshinWarnings,
        ...(saju.yongshin.jonggyeokRisk?.level === 'HIGH'
          ? [`종격 가능성 신호가 높아 일반 억부 용신 결론의 신뢰도가 ${saju.yongshin.jonggyeokRisk.confidenceAttenuated ? '하향 조정됐어요' : '제한돼요'}.`]
          : []),
        ...(yongshinConsensus
          && (yongshinConsensus.final.conflictLevel === 'medium'
            || yongshinConsensus.final.conflictLevel === 'high')
          ? [`용신 판단 축 사이의 충돌 수준은 ${yongshinConsensus.final.conflictLevel}이며 경쟁 오행을 함께 검토해야 해요.`]
          : []),
      ];
      const hero = addInterpretation({
        id: `${sliceKey}.hero.interpretation`, domain: 'saju', availability: currentAvailability,
        authority: 'interpretive', origin: 'deterministic_template',
        factRefs: [dayMaster.id, strength.id, gyeokguk.id, yongshin.id, ...metricFacts.map((fact) => fact.id)],
        brief: {
          headline: `${saju.dayMaster.stem} 일간 · ${strengthLabel}`,
          hook: sajuHook,
        },
        ...(DEPTH_ORDER[surface.depth] >= DEPTH_ORDER.standard ? {
          standard: { paragraphs: [...saju.strength.details.slice(0, 6), ...riskParagraphs] },
        } : {}),
        ...(surface.depth === 'expert' ? {
          expert: {
            paragraphs: [
              saju.gyeokguk.reasoning,
              saju.yongshin.agreement,
              ...riskParagraphs,
            ].filter(Boolean),
            numericalFactRefs: metricFacts.map((fact) => fact.id),
          },
        } : {}),
      });
      blocks.push({
        id: `${sliceKey}.hero`, kind: 'hero', title: '사주 핵심 구조', availability: currentAvailability,
        interpretationRef: hero!.id,
        supportingFactRefs: [dayMaster.id, strength.id, gyeokguk.id, yongshin.id],
      });
      blocks.push({
        id: `${sliceKey}.pillars`, kind: 'fact_group', title: '사주 원국', availability: READY,
        factRefs: [pillarFact.id], presentation: 'pillars',
      });
      blocks.push({
        id: `${sliceKey}.time-correction`,
        kind: 'fact_group',
        title: '시간 보정 근거',
        availability: timeFactAvailability,
        factRefs: [timeFact.id],
        presentation: 'metrics',
      });
      blocks.push({
        id: `${sliceKey}.metrics`, kind: 'fact_group', title: '판단 단위와 신뢰도',
        availability: natalAvailability,
        factRefs: [
          dayMaster.id,
          strength.id,
          gyeokguk.id,
          yongshin.id,
          ...metricFacts.map((fact) => fact.id),
        ],
        presentation: 'metrics',
      });
      if (sajuDistribution) {
        blocks.push({
          id: `${sliceKey}.elements`, kind: 'fact_group', title: '오행 분포', availability: READY,
          factRefs: [sajuDistribution.id], presentation: 'metrics',
        });
      }
      if (sajuEvidenceFacts.length > 0) {
        blocks.push({
          id: `${sliceKey}.structural-evidence`,
          kind: 'fact_group',
          title: '세부 구조 근거',
          availability: natalAvailability,
          factRefs: sajuEvidenceFacts.map((fact) => fact.id),
          presentation: 'evidence',
        });
      }
      const timeline = timelineBlock(surface, matrix, natalAvailability);
      if (timeline) blocks.push(timeline);
      if (surface.life === 'summary') {
        const lifeCell = cellFor(matrix, 'life', 'overall');
        const ref = lifeCell
          ? `fortune.life.overall.${surface.depth}.interpretation`
          : undefined;
        if (ref) {
          const daeunRatings: { order: number; ratingFactRef: string }[] = [];
          for (const point of matrix?.daeunStars ?? []) {
            if (point.stars === null) continue;
            const factId = `fortune.life.daeun.${point.order}.stars`;
            if (!facts.some((fact) => fact.id === factId)) {
              addFact(metric(
                factId,
                'saju',
                'spring-ts.tiered-daeun-grade.v1',
                `대운 ${point.order + 1}구간 별점`,
                point.stars,
                'stars_1_5',
                1,
                5,
                'higher_is_better',
              ));
            }
            daeunRatings.push({ order: point.order, ratingFactRef: factId });
          }
          blocks.push({
            id: `${sliceKey}.life-flow`, kind: 'life_flow', title: '생애 흐름',
            availability: fortuneCellAvailability(lifeCell!, natalAvailability),
            interpretationRef: ref,
            ...(lifeCell?.stars !== null
              && lifeCell?.stars !== undefined
              ? { ratingFactRef: 'fortune.life.overall.stars' }
              : {}),
            ...(daeunRatings.length > 0 ? { daeunRatings } : {}),
          });
        }
      }
      blocks.push({
        id: `${sliceKey}.deep-links`, kind: 'deep_links', title: '다른 보고서 보기', availability: READY,
        targets: [{ surface: 'integrated' }, { surface: 'naming' }],
      });
    } else {
      const namingReport = input.namingReport;
      const namingFactRefs: string[] = [];
      const namingCharacterFactRefs: string[] = [];
      const namingMetricFactRefs: string[] = [];
      const namingDetailFactRefs = namingDetailFacts.map((fact) => fact.id);
      const frameItems: Array<{ stage: NamingFrameFactV1['stage']; factRef: string; interpretationRef?: string }> = [];
      if (namingReport) {
        for (const [index, char] of namingReport.name.surname.entries()) {
          const factId = addFact(nameCharacterFact(char, 'surname', index))!.id;
          namingFactRefs.push(factId);
          namingCharacterFactRefs.push(factId);
        }
        for (const [index, char] of namingReport.name.givenName.entries()) {
          const factId = addFact(nameCharacterFact(char, 'givenName', index))!.id;
          namingFactRefs.push(factId);
          namingCharacterFactRefs.push(factId);
        }
        const scoreFacts = [
          completeHanjaIdentity
            ? addFact(metric('naming.total-score', 'naming', 'spring-ts.naming-report.v1', '이름 종합 점수', namingReport.totalScore, 'score_0_100', 0, 100, 'higher_is_better'))
            : null,
          addFact(metric('naming.hangul-score', 'naming', 'spring-ts.naming-report.v1', '한글 점수', namingReport.scores.hangul, 'score_0_100', 0, 100, 'higher_is_better')),
          completeHanjaIdentity
            ? addFact(metric('naming.hanja-score', 'naming', 'spring-ts.naming-report.v1', '한자 점수', namingReport.scores.hanja, 'score_0_100', 0, 100, 'higher_is_better'))
            : null,
          completeHanjaIdentity
            ? addFact(metric('naming.four-frame-score', 'naming', 'seed-ts.fourframe.v1', '사격수리 점수', namingReport.scores.fourFrame, 'score_0_100', 0, 100, 'higher_is_better'))
            : null,
          namingReport.phonetic?.phoneticScore == null ? null : addFact(metric('naming.phonetic-score', 'naming', 'spring-ts.phonetic-display.v1', '발음 흐름 점수', namingReport.phonetic.phoneticScore, 'score_0_100', 0, 100, 'higher_is_better')),
          namingReport.nameTrend?.trendFit == null ? null : addFact(metric('naming.trend-fit', 'naming', 'spring-ts.official-name-trend-display.v1', '출생시대 이름 적합도', namingReport.nameTrend.trendFit, 'score_0_100', 0, 100, 'higher_is_better')),
          namingReport.nameTrend?.trendRisk == null ? null : addFact(metric('naming.trend-risk', 'naming', 'spring-ts.official-name-trend-display.v1', '이름 유행 주의도', namingReport.nameTrend.trendRisk, 'score_0_100', 0, 100, 'higher_is_risk')),
        ].filter((fact): fact is MetricFactV1 => fact !== null);
        namingMetricFactRefs.push(...scoreFacts.map((fact) => fact.id));
        namingFactRefs.push(...namingMetricFactRefs);
        namingFactRefs.push(...namingDetailFactRefs);
        if (namingDistribution) namingFactRefs.push(namingDistribution.id);

        for (const frame of completeHanjaIdentity
          ? namingReport.analysis.fourFrame.frames
          : []) {
          const fact: NamingFrameFactV1 = {
            id: `naming.frame.${frame.type}`,
            domain: 'naming',
            method: 'seed-ts.fourframe.v1',
            kind: 'naming_frame',
            stage: FRAME_STAGE[frame.type],
            frameType: frame.type,
            strokeSum: frame.strokeSum,
            element: canonicalElement(frame.element),
            polarity: frame.polarity,
            luckyLevel: frame.luckyLevel,
          };
          addFact(fact);
          const interpretation = addInterpretation(frameInterpretation(frame, surface.depth));
          frameItems.push({
            stage: fact.stage,
            factRef: fact.id,
            ...(interpretation ? { interpretationRef: interpretation.id } : {}),
          });
        }
      }

      const heroAvailability = namingReport ? READY : availability('unavailable', 'NAME_ANALYSIS_UNAVAILABLE');
      const hero = addInterpretation({
        id: `${sliceKey}.hero.interpretation`,
        domain: 'naming',
        availability: heroAvailability,
        authority: 'interpretive',
        origin: 'mixed',
        factRefs: namingFactRefs,
        brief: {
          headline: namingReport ? `${namingReport.name.fullHangul} 이름 분석` : '이름 분석을 준비할 수 없어요',
          ...(namingReport?.explanation?.summary ? { hook: namingReport.explanation.summary } : {}),
        },
        ...(namingReport && DEPTH_ORDER[surface.depth] >= DEPTH_ORDER.standard ? {
          standard: {
            paragraphs: [
              ...namingReport.explanation?.strengths ?? [],
              ...namingReport.explanation?.cautions ?? [],
              ...namingReport.phonetic?.warnings.map((warning) => warning.message) ?? [],
            ].slice(0, 12),
          },
        } : {}),
        ...(namingReport && surface.depth === 'expert' ? {
          expert: { paragraphs: [namingReport.interpretation].filter(Boolean) },
        } : {}),
      });
      blocks.push({
        id: `${sliceKey}.hero`, kind: 'hero', title: '성명학 핵심', availability: heroAvailability,
        interpretationRef: hero!.id,
        supportingFactRefs: namingFactRefs,
      });
      if (namingCharacterFactRefs.length > 0) {
        blocks.push({
          id: `${sliceKey}.characters`, kind: 'fact_group', title: '이름 글자', availability: READY,
          factRefs: namingCharacterFactRefs, presentation: 'characters',
        });
      }
      if (namingMetricFactRefs.length > 0) {
        blocks.push({
          id: `${sliceKey}.metrics`, kind: 'fact_group', title: '이름 분석 지표', availability: READY,
          factRefs: namingMetricFactRefs, presentation: 'metrics',
        });
      }
      if (namingDistribution) {
        blocks.push({
          id: `${sliceKey}.elements`, kind: 'fact_group', title: '이름 오행 분포', availability: READY,
          factRefs: [namingDistribution.id], presentation: 'metrics',
        });
      }
      if (namingDetailFactRefs.length > 0) {
        blocks.push({
          id: `${sliceKey}.name-details`,
          kind: 'fact_group',
          title: '이름의 소리와 시대 흐름',
          availability: READY,
          factRefs: namingDetailFactRefs,
          presentation: 'evidence',
        });
      }
      if (frameItems.length > 0) {
        blocks.push({
          id: `${sliceKey}.four-frames`, kind: 'four_frames', title: '원형이정 생애 단계',
          availability: READY, items: frameItems,
        });
      }
      blocks.push({
        id: `${sliceKey}.calendar-capability`, kind: 'capability', title: '일일·주간 이름 운세',
        availability: availability('unavailable', 'NAMING_CALENDAR_METHOD_NOT_ESTABLISHED'),
        feature: 'calendar_fortune',
      });
      blocks.push({
        id: `${sliceKey}.deep-links`, kind: 'deep_links', title: '시기 흐름 함께 보기', availability: READY,
        targets: [{ surface: 'integrated', anchor: 'interaction' }],
      });
    }

    const contentBlocks = blocks.filter((block) =>
      block.kind !== 'capability'
      && block.kind !== 'premium_teaser'
      && block.kind !== 'deep_links');
    const resolvedAvailability = aggregateAvailability([
      currentAvailability,
      ...contentBlocks.map((block) => block.availability),
    ]);
    surfaces.push({
      id: surface.id,
      depth: surface.depth,
      sliceKey,
      availability: resolvedAvailability,
      blocks,
    });
  }

  const displayName = input.namingReport?.name.fullHangul;
  const delivery: ReportDeliveryV1 = {
    schemaVersion: REPORT_DELIVERY_SCHEMA_V1,
    analysisId: input.analysisId,
    generatedAt: new Date().toISOString(),
    anchorDate: formatAnchorDate(input.targetDate),
    subject: {
      ...(displayName ? { displayName } : {}),
      ...(input.candidateId ? { candidateId: input.candidateId } : {}),
    },
    coverage: { surfaces: selection.surfaces },
    provenance: {
      engine: 'spring-ts',
      facts: 'deterministic-engine-output',
      narratives: 'interpretive-not-fact-authority',
      cacheScope: 'engine_session',
      artifactIdentity: {
        manifestSchema: ENGINE_BUILD_IDENTITY_V1.schemaVersion,
        digest: ENGINE_BUILD_IDENTITY_V1.aggregateDigest,
        authority: ENGINE_BUILD_IDENTITY_V1.authority,
        correctnessAuthority: false,
      },
      versions: {
        engine: engineConfig.version,
        ruleset: ENGINE_BUILD_IDENTITY_V1.rulesetDigest,
        data: ENGINE_BUILD_IDENTITY_V1.dataDigest,
        deliveryTemplate: 'delivery-template-v1',
        timelineArticleTemplate: 'article-v1',
      },
      computation: {
        natalSaju: 'birth-derived-invariant',
        naming: 'name-derived',
        interaction: 'birth-and-name-conditioned',
      },
    },
    availability: overallAvailability(surfaces),
    facts,
    interpretations,
    surfaces,
    offers: requestedSurfaceIds.has('integrated') && premiumEligible ? [{
      id: 'story_completion',
      productId: 'report.story-completion.v1',
      access: 'requires_server_entitlement',
      entitlementAuthority: 'server',
      contentState: 'omitted',
      analysisId: input.analysisId,
      ...(input.candidateId ? { candidateId: input.candidateId } : {}),
    }] : [],
  };
  assertReportDeliveryV1(delivery, selection);
  return delivery;
}
