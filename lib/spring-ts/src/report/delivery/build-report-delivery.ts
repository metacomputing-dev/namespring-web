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
import {
  normalizeGyeokgukCategoryCode,
  normalizeGyeokgukTypeCode,
  normalizeTenGodCode,
} from '../../saju/legacy-codec.js';
import engineConfig from '../../../config/engine.json';
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
  type DayMasterFactV1,
  type DeliveryAvailabilityV1,
  type DeliveryReasonCodeV1,
  type DeliveryStatusV1,
  type ElementDistributionFactV1,
  type FiveElementIdV1,
  type GyeokgukFactV1,
  type MetricFactV1,
  type NameCharacterFactV1,
  type NameSajuInteractionFactV1,
  type NamingFrameFactV1,
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
  type StrengthFactV1,
  type SajuJudgmentStrengthV1,
  type YongshinFactV1,
} from './types.js';
import {
  assertReportDeliveryV1,
  ReportDeliveryContractError,
  validateReportDeliverySelectionV1,
} from './validation.js';

const PILLAR_ORDER = ['year', 'month', 'day', 'hour'] as const;
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

function yongshinFact(saju: SajuSummary): YongshinFactV1 | null {
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
  return {
    id: `naming.character.${position}.${index}`,
    domain: 'naming',
    method: 'spring-ts.naming-report-character.v1',
    kind: 'name_character',
    position,
    index,
    hangul: char.hangul,
    ...(char.hanja ? { hanja: char.hanja } : {}),
    ...(char.meaning ? { meaning: char.meaning } : {}),
    ...(Number.isFinite(char.strokes) ? { strokes: char.strokes } : {}),
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
  const constrained = natalAvailability.status !== 'ready';
  const resolvedAvailability = fortuneCellAvailability(cell, natalAvailability);
  const constrainedHeadline = '사주 판단 근거가 제한되어 이 기간의 흐름을 단정하지 않아요';
  const constrainedParagraph = '출생 시각·신강약·격국·용신 판단이 확정되기 전에는 기간별 길흉과 행동 권고를 잠정 해석으로만 보세요.';
  const standard = DEPTH_ORDER[depth] >= DEPTH_ORDER.standard ? {
    paragraphs: constrained
      ? [constrainedParagraph]
      : cell.standard.paragraphs.map((paragraph) => paragraph.plainText),
    ...(!constrained && cell.standard.livingTips?.length
      ? { livingTips: [...cell.standard.livingTips] }
      : {}),
    ...(!constrained && cell.standard.cautions?.length
      ? { cautions: [...cell.standard.cautions] }
      : {}),
  } : undefined;
  const expert = DEPTH_ORDER[depth] >= DEPTH_ORDER.expert ? {
    paragraphs: constrained
      ? [constrainedParagraph]
      : cell.expert.paragraphs.map((paragraph) => paragraph.plainText),
    ...(ratingFactRef ? { numericalFactRefs: [ratingFactRef] } : {}),
  } : undefined;
  return {
    id,
    domain: 'fortune',
    availability: resolvedAvailability,
    authority: 'interpretive',
    origin: constrained ? 'deterministic_template' : origin,
    factRefs: ratingFactRef ? [ratingFactRef] : [],
    brief: {
      headline: constrained ? constrainedHeadline : cell.brief.headline,
      ...(!constrained && cell.brief.hook ? { hook: cell.brief.hook } : {}),
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
  const meaning = frame.meaning;
  if (!meaning) return null;
  const id = `naming.frame.${frame.type}.${depth}.interpretation`;
  return {
    id,
    domain: 'naming',
    availability: READY,
    authority: 'interpretive',
    origin: 'deterministic_template',
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
          ...(natalAvailability.status === 'ready'
            && cell?.stars !== null
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
        natalAvailability.status === 'ready' ? depth : 'brief',
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
  const needsNamingSurfaceFacts = requestedSurfaceIds.has('naming');
  const needsInteractionFacts = requestedSurfaceIds.has('integrated');
  const yongshinSafetyFact = needsSajuFacts && input.saju
    ? addFact(yongshinFact(input.saju))
    : null;
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
    const rating = cell.stars === null || natalEvidenceLimited ? null : addFact(metric(
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
      const interactionHeadline = input.saju?.yongshin?.jonggyeokRisk?.level === 'HIGH'
        ? '사주 용신의 종격 가능성을 먼저 재검토해야 해요'
        : natalEvidenceLimited
          ? '사주 판단 근거가 엇갈려 이름의 보완 효과를 단정하지 않아요'
        : interaction?.safety?.posture === 'aggressive'
        ? '보완보다 과도한 쏠림과 주의 근거를 먼저 보세요'
        : interaction?.limitations.includes('safety_profile_unavailable')
          ? '안전 판단 근거가 부족해 결론을 보류해요'
          : interaction?.limitations.includes('consensus_conflict_present')
            ? '사주 판단 축이 엇갈려 보완 신호를 단정하지 않아요'
        : interaction?.classification === 'supportive_signal'
        ? '이름에 보완 신호가 보여요'
        : interaction?.classification === 'mixed_signals'
          ? '보완과 주의 신호가 함께 보여요'
          : interaction?.classification === 'caution_signal'
            ? '주의 신호를 함께 살펴보세요'
            : interaction?.classification === 'no_direct_match'
              ? '직접 일치보다 전체 근거를 보세요'
              : '이름을 더하면 통합 해석이 완성돼요';
      const hero = addInterpretation({
        id: `${sliceKey}.hero.interpretation`,
        domain: 'interaction',
        availability: input.springReport ? currentAvailability : availability('limited', 'NAME_INPUT_MISSING'),
        authority: 'interpretive',
        origin: 'deterministic_template',
        factRefs: [interaction?.id, yongshinSafetyFact?.id]
          .filter((id): id is string => id !== undefined),
        brief: { headline: interactionHeadline },
        ...(surface.depth === 'standard' ? {
          standard: {
            paragraphs: [interaction?.safety?.posture === 'aggressive'
              ? '직접 일치만 보면 보완 신호가 있어도, 정본 안전 프로필에서는 과도한 보강이나 상충 요소를 함께 경고해요. 이름의 한 요소만 떼어 길하다고 단정하지 않아요.'
              : natalEvidenceLimited
                ? '이름의 직접 일치보다 먼저 출생 사주의 용신 신뢰도, 종격 가능성, 판단 축 충돌을 확인해야 해요. 이 근거가 제한된 상태에서는 이름이 사주를 보완한다고 단정하지 않아요.'
              : interaction?.limitations.includes('safety_profile_unavailable')
                ? '직접 일치 수만으로는 안전한 보완인지 판단할 수 없어요. 안전 프로필 근거가 준비될 때까지 유리하다고 단정하지 않아요.'
                : interaction?.limitations.includes('consensus_conflict_present')
                  ? '용신 판단 축이 서로 엇갈려 이름의 직접 일치가 전체적으로 유리하다고 단정할 수 없어요. 경쟁 오행과 충돌 근거를 함께 확인해야 해요.'
              : reading?.sentence ?? '현재는 사주 흐름만 준비됐어요. 이름 분석을 더하면 두 근거의 일치와 차이를 함께 볼 수 있어요.'],
          },
        } : {}),
      });
      blocks.push({
        id: `${sliceKey}.hero`, kind: 'hero', title: '사주 × 이름 핵심 한 줄',
        availability: hero!.availability,
        interpretationRef: hero!.id,
        supportingFactRefs: [interaction?.id, yongshinSafetyFact?.id]
          .filter((id): id is string => id !== undefined),
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
      const pillarFact: PillarsFactV1 = {
        id: 'saju.pillars', domain: 'saju', method: 'saju-ts.four-pillars.v1', kind: 'pillars',
        values: PILLAR_ORDER.map((position) => ({ position, ...saju.pillars[position] })),
      };
      addFact(pillarFact);
      const dayMaster: DayMasterFactV1 = {
        id: 'saju.day-master', domain: 'saju', method: 'saju-ts.day-master.v1', kind: 'day_master',
        stem: saju.dayMaster.stem,
        element: canonicalElement(saju.dayMaster.element),
        polarity: saju.dayMaster.polarity,
      };
      const strength: StrengthFactV1 = {
        id: 'saju.strength', domain: 'saju', method: 'saju-ts.strength.v1', kind: 'strength',
        level: saju.strength.level,
        levelCode: canonicalStrengthLevelCode(saju.strength),
        isStrong: saju.strength.isStrong,
        ...(saju.axisStrength?.strength
          ? { judgmentStrength: saju.axisStrength.strength }
          : {}),
      };
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
      addFact(dayMaster); addFact(strength); addFact(gyeokguk);
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
      const sajuHook = mustDefer
        ? `종격·충돌·신뢰도 근거를 더 확인해야 해 ${saju.yongshin.element} 보완 단정을 보류해요`
        : mustHedge
          ? `${saju.gyeokguk.type} 후보로 보고 ${saju.yongshin.element} 보완 가능성을 함께 검토해요`
          : `격국 ${saju.gyeokguk.type}, 보완 오행 ${saju.yongshin.element}`;
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
        id: `${sliceKey}.metrics`, kind: 'fact_group', title: '판단 단위와 신뢰도', availability: READY,
        factRefs: [dayMaster.id, strength.id, gyeokguk.id, yongshin.id, ...metricFacts.map((fact) => fact.id)],
        presentation: 'metrics',
      });
      if (sajuDistribution) {
        blocks.push({
          id: `${sliceKey}.elements`, kind: 'fact_group', title: '오행 분포', availability: READY,
          factRefs: [sajuDistribution.id], presentation: 'metrics',
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
          blocks.push({
            id: `${sliceKey}.life-flow`, kind: 'life_flow', title: '생애 흐름',
            availability: fortuneCellAvailability(lifeCell!, natalAvailability),
            interpretationRef: ref,
            ...(natalAvailability.status === 'ready'
              && lifeCell?.stars !== null
              && lifeCell?.stars !== undefined
              ? { ratingFactRef: 'fortune.life.overall.stars' }
              : {}),
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
          addFact(metric('naming.total-score', 'naming', 'spring-ts.naming-report.v1', '이름 종합 점수', namingReport.totalScore, 'score_0_100', 0, 100, 'higher_is_better')),
          addFact(metric('naming.hangul-score', 'naming', 'spring-ts.naming-report.v1', '한글 점수', namingReport.scores.hangul, 'score_0_100', 0, 100, 'higher_is_better')),
          addFact(metric('naming.hanja-score', 'naming', 'spring-ts.naming-report.v1', '한자 점수', namingReport.scores.hanja, 'score_0_100', 0, 100, 'higher_is_better')),
          addFact(metric('naming.four-frame-score', 'naming', 'seed-ts.fourframe.v1', '사격수리 점수', namingReport.scores.fourFrame, 'score_0_100', 0, 100, 'higher_is_better')),
          namingReport.phonetic?.phoneticScore == null ? null : addFact(metric('naming.phonetic-score', 'naming', 'spring-ts.phonetic-display.v1', '발음 흐름 점수', namingReport.phonetic.phoneticScore, 'score_0_100', 0, 100, 'higher_is_better')),
          namingReport.nameTrend?.trendFit == null ? null : addFact(metric('naming.trend-fit', 'naming', 'spring-ts.official-name-trend-display.v1', '출생시대 이름 적합도', namingReport.nameTrend.trendFit, 'score_0_100', 0, 100, 'higher_is_better')),
          namingReport.nameTrend?.trendRisk == null ? null : addFact(metric('naming.trend-risk', 'naming', 'spring-ts.official-name-trend-display.v1', '이름 유행 주의도', namingReport.nameTrend.trendRisk, 'score_0_100', 0, 100, 'higher_is_risk')),
        ].filter((fact): fact is MetricFactV1 => fact !== null);
        namingMetricFactRefs.push(...scoreFacts.map((fact) => fact.id));
        namingFactRefs.push(...namingMetricFactRefs);
        if (namingDistribution) namingFactRefs.push(namingDistribution.id);

        for (const frame of namingReport.analysis.fourFrame.frames) {
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
