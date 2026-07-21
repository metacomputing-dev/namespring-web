// ---------------------------------------------------------------------------
// SpringEngine -- the main naming-recommendation engine.
//
// Public API:
//   init()              -- load database and precompute lucky number tables
//   getNamingReport()   -- pure name analysis (no saju)
//   getSajuReport()     -- saju analysis only
//   getSpringReport()   -- single integrated report (name + saju)
//   getReportDelivery() -- selective V1 payload for integrated/saju/naming UI
//   getNameCandidates() -- name recommendations with saju integration
//   getNameCandidateSummaries() -- lightweight recommendation list for UI
//   getCandidateSearch() -- stable-ID, engine-ranked mobile candidate page
//   analyze()           -- legacy all-in-one entry point (backward compatible)
//   close()             -- release database resources
// ---------------------------------------------------------------------------

import { HanjaRepository, type HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import { FourframeRepository } from '../../seed-ts/src/database/fourframe-repository.js';
import { RepositoryDataError } from '../../seed-ts/src/database/repository-errors.js';
import { RepositoryDatabaseIntegrityError } from '../../seed-ts/src/database/database-integrity.js';
import {
  sanitizeServiceValue,
} from '../../seed-ts/src/service-text-policy.js';
import { Polarity } from '../../seed-ts/src/model/polarity.js';
import { HangulCalculator } from './calculator/hangul-calculator.js';
import { HanjaCalculator } from './calculator/hanja-calculator.js';
import { FrameCalculator } from './calculator/frame-calculator.js';
import { evaluateName, type EvalContext, type EvaluationResult } from './core/evaluator.js';
import { type ElementKey, bucketFromFortune } from './core/scoring.js';
import { FourFrameOptimizer } from './calculator/search.js';
import { buildInterpretation, parseJamoFilter, decomposeHangul, type JamoFilter } from './core/name-utils.js';
import { buildNamingExplanation } from './naming-explanation.js';
import type { SajuOutputSummary } from './types.js';
import { SajuCalculator } from './saju-calculator.js';
import type { SajuEvaluatorHints } from './saju-calculator.js';
import {
  resolveSchoolPresetMetadata,
  resolveSchoolPresetName,
  type SchoolPresetMetadata,
  type SchoolPresetName,
} from './preset-loader.js';
import { springEvaluateName, SAJU_FRAME } from './spring-evaluator.js';
import { analyzeSaju, analyzeSajuSafe, buildSajuContext } from './saju-adapter.js';
import type {
  SpringRequest, SpringResponse, SpringCandidate, SajuSummary, SpringOptions,
  SajuReport, NamingReport, NamingReportFrame, SpringReport, SpringCandidateSummary,
  NameCharInput, CharDetail, NameGenderTendency, BirthInfo, NamingScoreVector,
  CandidateStrengthProfile, NameElementStrategy, SajuAnalysisReasonCode, SajuAnalysisStatus,
} from './types.js';
import engineConfig from '../config/engine.json';
import { buildFortuneReport } from './report/buildFortuneReport.js';
import type { FortuneReportRequest, FortuneReport } from './report/types.js';
import { buildNamingEvidencePlan } from './report/naming-evidence/build-naming-evidence-report.js';
import { resolveNamingEvidenceSajuAxes } from './report/naming-evidence/resolve-saju-axes.js';
import type { NamingRecommendationReportResult } from './report/naming-evidence/types.js';
import {
  ReportDeliveryRequestValidationError,
  validateReportDeliveryRequestV1,
  validateReportDeliverySelectionV1,
} from './report/delivery/validation.js';
import type {
  ReportDeliveryRequestV1,
  ReportDeliveryV1,
} from './report/delivery/types.js';
import {
  candidateIdFromNameIdentityV1,
  isCandidateIdV1,
} from './experience/candidate-id.js';
import {
  buildCandidateSearchResponseV1,
  CANDIDATE_QUERY_ID_PATTERN_V1,
  CandidateSearchContractErrorV1,
  type CandidateSearchContinuationV1,
  type CandidateSearchQueryV1,
  type CandidateSearchResponseV1,
  type LocalCandidateSearchRequestV1,
} from './experience/index.js';
import {
  AnalysisOptionsContractError,
  assertAnalysisOptionsContractV1,
} from './report/analysis-options-validation.js';
import { assertScorableSajuSummary, isScorableSajuSummary } from './saju-analysis-contract.js';
import {
  getLegalAnnotation,
  isRecognizedHanjaGlyph,
  type HanjaLegalStatus,
  type HanjaPool,
} from './hanja-annotations.js';
import {
  SajuRequestValidationError,
  parseFortuneTargetDate,
  validateSajuConfigFortunePolicy,
  validateSajuRequestOptions,
} from './saju-request-policy.js';
import { targetCalendarParts, targetCalendarYear } from './target-date.js';
import {
  assessNatalEvidenceV1,
  type NatalEvidenceAssessmentV1,
} from './natal-evidence.js';
import {
  buildCandidateElementGuidanceV1,
  orderCandidatePoolByElementPreference,
  type CandidateElementPreferenceStrength,
} from './candidate-guidance-policy.js';
import {
  computeRecommendationMeaningConfidence,
  hasOpaqueHanjaMeaning,
  hasUnsafeHanjaMeaning,
  hasWeakRecommendationHanjaMeaning,
} from './candidate-meaning-policy.js';
import { getEnrichedStrokeCount, getUnihanMetadata } from './hanja-unihan.js';
import { loadFullHanjaPoolEntries } from './full-hanja-pool-loader.js';
import { getNameTrendAnalysis, type NameTrendAnalysis } from './name-trend.js';
import { getPhoneticAnalysis, type PhoneticAnalysis } from './phonetic-rules.js';
import {
  NameStatLookupUnavailableError,
  type NameStatLookupResult,
} from './name-stat-contract.js';
import {
  type NameStatSourceProjection,
  toFoundNameStatLookupResult,
} from './name-stat-projection.js';
import {
  NameStatSummaryIntegrityError,
  NameStatSummaryRepository,
} from './name-stat-summary-repository.js';
import {
  FOURFRAME_MAX_NUMBER,
  compileFourFrameContract,
} from './fourframe-contract.js';
import {
  DefaultCandidateSummaryAccumulator,
  applySpringReportSelectionRanking,
  averageScores,
  clampScore,
  deriveCandidateStrengthProfile,
  describeCandidateName,
  finiteScore,
  orderCandidateSelectionProjections,
  orderCandidateSummaries,
  orderSpringCandidates,
  orderSpringReports,
  retainCandidateSummaryVariantsByHangul,
  roundScore,
  shouldUseParetoFrontier,
  sliceAndRankCandidatePage,
  sliceCandidatePage,
  type CandidateNameDiversityInfo,
} from './candidate-selection.js';
import {
  assertExplicitNameIdentity,
  hasExplicitNameHanja,
  resolveFixedNameCharacterPool,
  resolveNameEntries,
  type NameEntryRepository,
  type ResolveNameEntriesOptions,
  type NameEntryRole,
  type PreverifiedExplicitPairContext,
} from './name-entry-resolver.js';
import {
  createOperationNameEntryCache,
  createOperationNameEntryRepository,
  type OperationNameEntryCache,
} from './operation-name-entry-repository.js';
import { assertSpringNameRequestContract } from './name-input-contract.js';
import {
  snapshotCandidateSearchRequestV1,
  snapshotFortuneReportRequest,
  snapshotReportDeliveryRequestV1,
  snapshotSpringRequest,
  snapshotSajuReport,
} from './public-request-snapshot.js';

export {
  NAME_ENTRY_RESOLUTION_FAILED,
  NameEntryResolutionError,
  type NameEntryResolutionFailureReason,
  type NameEntryRole,
} from './name-entry-resolver.js';
export {
  SPRING_NAME_REQUEST_INVALID,
  SpringNameRequestValidationError,
  type SpringNameRequestValidationField,
  type SpringNameRequestValidationReason,
} from './name-input-contract.js';

// ---------------------------------------------------------------------------
// Config -- all tuneable numbers come from engine.json
// ---------------------------------------------------------------------------

const MAX_CANDIDATES            = engineConfig.maxCandidates;
const CANDIDATE_SELECTION_LIMITS = Object.freeze({
  paretoPoolLimit: engineConfig.candidateSelection.paretoPoolLimit,
});
const CANDIDATE_HANJA_VARIANTS_PER_HANGUL =
  engineConfig.candidateSelection.hanjaVariantsPerHangul;
const CANDIDATE_PRESENTATION_SCORE_WINDOW =
  engineConfig.candidateSelection.presentationScoreWindow;
const CANDIDATE_HANGUL_SEED_NAME_LIMIT =
  engineConfig.candidateSelection.hangulSeedNameLimit;
const CANDIDATE_HANJA_VARIANTS_PER_SEED_SYLLABLE =
  engineConfig.candidateSelection.hanjaVariantsPerSeedSyllable;
const CANDIDATE_SEED_VARIANTS_PER_NAME =
  engineConfig.candidateSelection.seedVariantsPerName;
const POOL_LIMIT_SINGLE_CHAR    = engineConfig.candidatePoolLimits.singleCharPerStroke;
const POOL_LIMIT_DOUBLE_CHAR    = engineConfig.candidatePoolLimits.doubleCharPerPosition;
const POOL_LIMIT_JAMO_FILTERED  = engineConfig.candidatePoolLimits.jamoFilteredPerPosition;
const STROKE_MIN                = engineConfig.strokeRange.min;
const STROKE_MAX                = engineConfig.strokeRange.max;
const DEFAULT_OFFSET            = engineConfig.pagination.defaultOffset;
const DEFAULT_LIMIT             = engineConfig.pagination.defaultLimit;
const ENGINE_VERSION            = engineConfig.version;
const NAME_STAT_INFO_CACHE_LIMIT = (engineConfig as { nameStatInfoCacheLimit?: number }).nameStatInfoCacheLimit ?? 1000;
const REPORT_ANALYSIS_ID_CACHE_LIMIT = 128;
const CANDIDATE_SEARCH_SNAPSHOT_CACHE_LIMIT = 4;
const CANDIDATE_SEARCH_SNAPSHOT_MAX_CANDIDATES = 500;
// Each evaluated row constructs multiple calculators, while cached name-stat
// filtering is much cheaper. Separate intervals bound cancellation latency
// without changing candidate admission, scoring, ordering, or identity.
const CANDIDATE_EVALUATION_YIELD_INTERVAL = 16;
const CANDIDATE_NAME_STAT_YIELD_INTERVAL = 128;
const NAME_STAT_NOT_FOUND = Object.freeze({
  status: 'not_found',
  popularityRank: null,
  maleRatio: null,
  nameGender: 'unknown',
}) satisfies NameStatLookupResult;
const DEFAULT_PURE_HANGUL_MODE: 'auto' | 'on' | 'off' = 'auto';
const DEFAULT_USE_SURNAME_HANJA_IN_PURE = false;
const ENABLE_HANJA_NAME_EVALUATION = true;
const ENABLE_FOURFRAME_NAME_EVALUATION = true;

/**
 * Public Hanja detail score.
 *
 * `STROKE_ELEMENT` is an analysis insight, but it is intentionally not an
 * evaluator signal and therefore is absent from `EvaluationResult.categoryMap`.
 * Reading the public sub-score from that sparse map silently replaced the real
 * element score with zero. Keep evaluator weighting unchanged and assemble the
 * detail score from the calculator analysis that owns both values.
 */
function publicHanjaDetailScore(hanja: HanjaCalculator): number {
  const analysis = hanja.getAnalysis().data;
  return roundScore((analysis.polarityScore + analysis.elementScore) / 2);
}

async function yieldCandidateEvaluationTurn(): Promise<void> {
  const hostScheduler = (globalThis as typeof globalThis & {
    scheduler?: { yield?: () => Promise<void> };
  }).scheduler;
  if (typeof hostScheduler?.yield === 'function') {
    await hostScheduler.yield();
    return;
  }
  // A zero-delay timer can be clamped to a full scheduler quantum on Windows
  // and on backgrounded browsers. Candidate evaluation yields frequently for
  // cancellation and rendering, so that clamp can dominate first-page wall
  // time even though the scoring work itself is unchanged. MessageChannel is
  // still a macrotask boundary, but avoids the timer clamp. Close both ports
  // after every turn so Node workers and browser sessions retain no channel.
  if (typeof globalThis.MessageChannel === 'function') {
    await new Promise<void>((resolve) => {
      const channel = new globalThis.MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.onmessage = null;
        channel.port1.close();
        channel.port2.close();
        resolve();
      };
      channel.port2.postMessage(undefined);
    });
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

interface CandidateSearchSnapshotV1 {
  readonly query: CandidateSearchQueryV1;
  readonly requestKey: string;
  readonly summaries: readonly SpringCandidateSummary[];
  readonly natalEvidence: NatalEvidenceAssessmentV1;
}

function hasOwnKey(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function optionsForFortuneTarget(
  options: SpringOptions | undefined,
  targetDate: Date,
  birthYear: number,
): SpringOptions {
  const targetYear = targetCalendarYear(targetDate);
  const inputSajuOptions = options?.sajuOptions ?? {};
  const sajuOptions: {
    daeunCount?: number;
    saeunStartYear?: number | null;
    saeunYearCount?: number;
    wolunStartYear?: number | null;
    wolunMonthCount?: number;
  } = { ...inputSajuOptions };

  if (!hasOwnKey(inputSajuOptions, 'saeunStartYear')) {
    sajuOptions.saeunStartYear = targetYear - 1;
  }
  if (!hasOwnKey(inputSajuOptions, 'saeunYearCount')) {
    const start = typeof sajuOptions.saeunStartYear === 'number'
      ? sajuOptions.saeunStartYear : targetYear - 1;
    sajuOptions.saeunYearCount = Math.max(1, Math.min(4, birthYear + 120 - start + 1));
  }
  if (!hasOwnKey(inputSajuOptions, 'wolunStartYear')) {
    sajuOptions.wolunStartYear = targetYear - 1;
  }
  if (!hasOwnKey(inputSajuOptions, 'wolunMonthCount')) {
    const start = typeof sajuOptions.wolunStartYear === 'number'
      ? sajuOptions.wolunStartYear : targetYear - 1;
    const remainingMonths = Math.max(1, (birthYear + 120 - start + 1) * 12);
    sajuOptions.wolunMonthCount = Math.min(24, remainingMonths);
  }

  return { ...(options ?? {}), sajuOptions };
}

function resolveReportAnchorDate(
  birth: BirthInfo,
  targetDateInput: string | undefined,
): { readonly targetDate: Date; readonly birthYear: number } {
  const birthYear = birth.year;
  if (typeof birthYear !== 'number' || !Number.isInteger(birthYear)) {
    throw new SajuRequestValidationError('birth year must be a finite integer', 'BIRTH_DATE_INVALID');
  }
  const targetDate = parseFortuneTargetDate(targetDateInput, birth);
  return { targetDate, birthYear };
}

function resolveFortuneTargetContext(
  birth: BirthInfo,
  targetDateInput: string | undefined,
  options: SpringOptions | undefined,
): { readonly targetDate: Date; readonly reportOptions: SpringOptions } {
  const { targetDate, birthYear } = resolveReportAnchorDate(birth, targetDateInput);
  const reportOptions = optionsForFortuneTarget(options, targetDate, birthYear);
  validateSajuRequestOptions(reportOptions.sajuOptions, birthYear);
  validateSajuConfigFortunePolicy(reportOptions.sajuConfig);
  return {
    targetDate,
    reportOptions,
  };
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`;
}

function createOpaqueCorrelationToken(): string {
  const bytes = new Uint8Array(16);
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    // These values are correlation handles, never authorization secrets. This
    // fallback preserves availability on legacy JS runtimes; paid authorization
    // uses server-issued report/entitlement identifiers instead.
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createOpaqueAnalysisId(): string {
  return `analysis_v1_${createOpaqueCorrelationToken()}`;
}

function createOpaqueCandidateQueryId(): string {
  return `candidate_query_v1_${createOpaqueCorrelationToken()}`;
}

function candidateIdFromDeliveryInput(
  request: ReportDeliveryRequestV1,
  namingReport?: NamingReport | null,
): string | undefined {
  if (namingReport) {
    return candidateIdFromNameIdentityV1({
      surnameHangul: namingReport.name.surname.map((character) => character.hangul).join(''),
      surnameHanja: namingReport.name.surname.map((character) => character.hanja ?? '').join(''),
      givenHangul: namingReport.name.givenName.map((character) => character.hangul).join(''),
      givenHanja: namingReport.name.givenName.map((character) => character.hanja ?? '').join(''),
    });
  }
  if (!request.surname || request.surname.length === 0
    || !request.givenName || request.givenName.length === 0) return undefined;
  const characters = [...request.surname ?? [], ...request.givenName];
  const explicitHanjaCount = characters.filter((character) =>
    typeof character.hanja === 'string' && character.hanja.length > 0).length;
  // Mixed unresolved/resolved input cannot establish the same canonical full
  // identity as candidate search. Defer to the resolved NamingReport.
  if (explicitHanjaCount !== 0 && explicitHanjaCount !== characters.length) return undefined;
  return candidateIdFromNameIdentityV1({
    surnameHangul: request.surname.map((character) => character.hangul).join(''),
    surnameHanja: request.surname.map((character) => character.hanja ?? '').join(''),
    givenHangul: request.givenName.map((character) => character.hangul).join(''),
    givenHanja: request.givenName.map((character) => character.hanja ?? '').join(''),
  });
}

function assertRequestedCandidateId(
  requested: string | undefined,
  resolved: string | undefined,
): void {
  if (requested === undefined) return;
  if (!isCandidateIdV1(requested) || resolved === undefined || requested !== resolved) {
    throw new ReportDeliveryRequestValidationError('CANDIDATE_ID_MISMATCH');
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a HanjaEntry into the public CharDetail shape. */
function toCharDetail(entry: HanjaEntry, pool: HanjaPool = 'curated'): CharDetail {
  const legal = getLegalAnnotation(entry, { pool });
  const enrichedStrokes = getEnrichedStrokeCount(entry.hanja, entry.strokes);
  const unihan = getUnihanMetadata(entry.hanja);
  return {
    hangul:   entry.hangul,
    hanja:    entry.hanja,
    meaning:  entry.meaning,
    strokes:  enrichedStrokes,
    element:  entry.resource_element,
    elementLabel: elementDisplayLabel(entry.resource_element),
    polarity: Polarity.get(enrichedStrokes).english,
    legalStatus: legal.legalStatus,
    legalRegistrable: legal.legalRegistrable,
    isVariantOf: legal.isVariantOf,
    unihan,
    radicalElementHint: unihan?.radicalElementHint,
  };
}

interface CandidateRejectionBucket {
  readonly reason: string;
  count: number;
  examples: Array<{
    readonly hangul?: string;
    readonly hanja?: string;
    readonly legalStatus?: HanjaLegalStatus;
    readonly detail?: string;
  }>;
}

const ELEMENT_DISPLAY_LABELS: Readonly<Record<string, string>> = {
  WOOD: '나무',
  FIRE: '불',
  EARTH: '흙',
  METAL: '쇠',
  WATER: '물',
  Wood: '나무',
  Fire: '불',
  Earth: '흙',
  Metal: '쇠',
  Water: '물',
};

function elementDisplayLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return ELEMENT_DISPLAY_LABELS[trimmed] ?? ELEMENT_DISPLAY_LABELS[trimmed.toUpperCase()] ?? trimmed;
}

function hasHanIdeograph(value: string | undefined): boolean {
  return typeof value === 'string' && isRecognizedHanjaGlyph(value);
}

function scoreLegalStatus(status: HanjaLegalStatus): number {
  if (status === 'allowed' || status === 'variantAllowed' || status === 'hangulOnly') return 100;
  if (status === 'unknown') return 75;
  return 0;
}

function computeLegalScore(entries: readonly HanjaEntry[], hanjaPool: HanjaPool): number | null {
  if (!entries.length) return null;
  return averageScores(entries.map((entry) =>
    scoreLegalStatus(getLegalAnnotation(entry, { pool: hanjaPool }).legalStatus)));
}

function computeHanjaMeaningScore(entries: readonly HanjaEntry[]): number | null {
  const hanjaEntries = entries.filter((entry) => hasHanIdeograph(entry.hanja));
  if (!hanjaEntries.length) return null;
  return averageScores(hanjaEntries.map((entry) =>
    typeof entry.meaning === 'string' && entry.meaning.trim().length > 0 ? 100 : 40));
}

/** Convert a HanjaEntry into the minimal NameCharInput shape. */
function toNameCharInput(entry: HanjaEntry, pool: HanjaPool = 'curated'): NameCharInput {
  const legal = getLegalAnnotation(entry, { pool });
  const elementLabel = elementDisplayLabel(entry.resource_element);
  return {
    hangul: entry.hangul,
    hanja: entry.hanja,
    meaning: entry.meaning,
    strokes: entry.strokes,
    element: entry.resource_element,
    ...(elementLabel === undefined ? {} : { elementLabel }),
    legalStatus: legal.legalStatus,
    ...(legal.legalRegistrable === undefined
      ? {}
      : { legalRegistrable: legal.legalRegistrable }),
    ...(legal.isVariantOf === undefined ? {} : { isVariantOf: legal.isVariantOf }),
  };
}

interface NameResolutionPolicy {
  readonly pureHangulGivenName: boolean;
  readonly useSurnameHanjaInPureHangul: boolean;
}

interface NameInputPlan {
  readonly mode: 'evaluate' | 'recommend' | 'all';
  readonly jamoFilters: readonly (JamoFilter | null)[] | undefined;
  readonly hasGenerationConstraints: boolean;
  readonly includeOriginalName: boolean;
}

interface CollectedNameInput {
  readonly givenName: NameCharInput[];
  /** Present when recommendation enrichment already resolved NameStat. */
  readonly nameStat?: {
    readonly givenNameKey: string;
    readonly info: NameStatLookupResult;
  };
}

type SpringSajuContext = ReturnType<typeof buildSajuContext>;

interface CombinedSpringCandidateEvaluation {
  readonly nameStatInfo: NameStatLookupResult;
  readonly surnameEntries: HanjaEntry[];
  readonly givenNameEntries: HanjaEntry[];
  readonly hangul: HangulCalculator;
  readonly hanja: HanjaCalculator;
  readonly frame: FrameCalculator;
  readonly saju: SajuCalculator;
  readonly combined: EvaluationResult;
  readonly hanjaPool: HanjaPool;
}

interface SpringReportCandidateInput {
  readonly candidateRequest: SpringRequest;
  readonly nameStat: NonNullable<CollectedNameInput['nameStat']>;
}

interface PreparedSpringReportCandidate extends SpringReportCandidateInput {
  readonly finalScore: number;
  readonly scoreVector?: NamingScoreVector;
  readonly strengthProfile?: CandidateStrengthProfile;
  readonly diversity: CandidateNameDiversityInfo;
}

interface PreparedFortuneReportContext {
  readonly targetDate: Date;
  readonly reportOptions: SpringOptions;
  readonly sajuReport: SajuReport;
  readonly springReport: SpringReport | null;
}

type CandidateRejectionAccumulator = Map<string, CandidateRejectionBucket>;

/** Prevents fortune cards from being synthesized from an unavailable saju placeholder. */
export class FortuneSajuUnavailableError extends Error {
  readonly code = 'FORTUNE_SAJU_UNAVAILABLE' as const;
  readonly reasonCode: SajuAnalysisReasonCode;
  readonly analysisStatus: SajuAnalysisStatus;

  constructor(
    reasonCode: SajuAnalysisReasonCode = 'SAJU_CALCULATION_FAILED',
    analysisStatus: SajuAnalysisStatus = 'failed',
  ) {
    super('Fortune report requires a usable saju analysis.');
    this.name = 'FortuneSajuUnavailableError';
    this.reasonCode = reasonCode;
    this.analysisStatus = analysisStatus;
  }
}

type SpringEngineOperationName =
  | 'getNamingReport'
  | 'getSajuReport'
  | 'getSpringReport'
  | 'getNameCandidates'
  | 'getNameCandidateSummaries'
  | 'analyze'
  | 'getFortuneReport'
  | 'getNamingRecommendationReport'
  | 'getReportDelivery'
  | 'name-stat-lookup';

interface SpringEngineOperationLease {
  readonly operation: SpringEngineOperationName;
  readonly generation: number;
  readonly nameEntryCache: OperationNameEntryCache;
}

interface CachedExplicitNameIdentity {
  readonly generation: number;
  readonly entry: HanjaEntry;
}

export const SPRING_ENGINE_INIT_CANCELLED = 'SPRING_ENGINE_INIT_CANCELLED' as const;

export class SpringEngineInitializationCancelledError extends Error {
  readonly code = SPRING_ENGINE_INIT_CANCELLED;

  constructor(
    readonly startedGeneration: number,
    readonly activeGeneration: number,
  ) {
    super(
      'SpringEngine initialization was cancelled because the engine lifecycle changed '
      + `(started=${startedGeneration}, active=${activeGeneration}).`,
    );
    this.name = 'SpringEngineInitializationCancelledError';
  }
}

export const SPRING_ENGINE_OPERATION_CANCELLED = 'SPRING_ENGINE_OPERATION_CANCELLED' as const;

export class SpringEngineOperationCancelledError extends Error {
  readonly code = SPRING_ENGINE_OPERATION_CANCELLED;
  readonly retryable = false;

  constructor(
    readonly operation: string,
    readonly startedGeneration: number,
    readonly activeGeneration: number,
  ) {
    super(
      `SpringEngine operation ${operation} was cancelled because the engine lifecycle changed `
      + `(started=${startedGeneration}, active=${activeGeneration}).`,
    );
    this.name = 'SpringEngineOperationCancelledError';
  }
}

// ---------------------------------------------------------------------------
// SpringEngine
// ---------------------------------------------------------------------------

/**
 * Repository injection is intentionally narrow: browser callers keep the
 * zero-argument defaults, while trusted server runtimes can provide immutable
 * file-backed repositories instead of attempting to fetch `/data/*`.
 */
export interface SpringEngineRepositories {
  readonly hanja?: HanjaRepository;
  readonly fourFrame?: FourframeRepository;
  readonly nameStat?: NameStatSummaryRepository;
}

export interface SpringEngineOptions {
  readonly repositories?: SpringEngineRepositories;
}

export class SpringEngine {
  private readonly hanjaRepo: HanjaRepository;
  private readonly fourFrameRepo: FourframeRepository;
  private readonly nameStatRepo: NameStatSummaryRepository;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private lifecycleGeneration = 0;
  private luckyMap = new Map<number, string>();
  private validFourFrameNumbers = new Set<number>();
  private optimizer: FourFrameOptimizer | null = null;
  private readonly nameStatInfoCache = new Map<string, NameStatLookupResult>();
  /** Session-local correlation only; never used as an authorization token. */
  private readonly reportAnalysisIds = new Map<string, string>();
  /** Bounded local snapshots keep multi-page ranking stable without a server. */
  private readonly candidateSearchSnapshots = new Map<string, CandidateSearchSnapshotV1>();

  private explicitNameIdentityCache = new WeakMap<
    NameCharInput,
    Map<string, CachedExplicitNameIdentity>
  >();

  public constructor(options: SpringEngineOptions = {}) {
    this.hanjaRepo = options.repositories?.hanja ?? new HanjaRepository();
    this.fourFrameRepo = options.repositories?.fourFrame ?? new FourframeRepository();
    this.nameStatRepo = options.repositories?.nameStat ?? new NameStatSummaryRepository();
  }

  /** Expose the hanja repository so the UI can perform hanja lookups. */
  getHanjaRepository(): HanjaRepository { return this.hanjaRepo; }

  // -------------------------------------------------------------------------
  // init -- three-step bootstrap
  // -------------------------------------------------------------------------

  init(): Promise<void> {
    // Fast path: already initialized.
    if (this.initialized) return Promise.resolve();
    // Concurrent init: every caller awaits the same promise rather than
    // re-running the heavy steps below.
    if (this.initPromise) return this.initPromise;

    const generation = this.lifecycleGeneration;
    let trackedPromise: Promise<void>;
    trackedPromise = this.initialize(generation)
      .finally(() => {
        // An older init may settle after close() and a new init(). It must not
        // erase the newer promise.
        if (this.initPromise === trackedPromise) this.initPromise = null;
      });
    this.initPromise = trackedPromise;
    return trackedPromise;
  }

  private async initialize(generation: number): Promise<void> {
    // Repository implementations own their DB publication guards. SpringEngine
    // keeps every derived value local until all async work and validation pass.
    await Promise.all([
      this.hanjaRepo.init(),
      this.fourFrameRepo.init(),
      this.nameStatRepo.init(),
    ]);
    this.assertActiveInitialization(generation);

    // Ask for one row beyond the contract so an unexpected 82nd row cannot be
    // truncated into an apparently valid 1..81 dataset.
    const records = await this.fourFrameRepo.findAll(FOURFRAME_MAX_NUMBER + 1);
    this.assertActiveInitialization(generation);

    const compiled = compileFourFrameContract(records);
    const luckyMap = new Map<number, string>(compiled.luckyByNumber);
    const validFourFrameNumbers = new Set<number>(compiled.favorableNumbers);
    const optimizer = new FourFrameOptimizer(validFourFrameNumbers);
    this.assertActiveInitialization(generation);

    // No await is allowed between these assignments: consumers observe either
    // the previous closed state or this complete validated state.
    this.luckyMap = luckyMap;
    this.validFourFrameNumbers = validFourFrameNumbers;
    this.optimizer = optimizer;
    this.initialized = true;
  }

  private assertActiveInitialization(generation: number): void {
    if (generation !== this.lifecycleGeneration) {
      throw new SpringEngineInitializationCancelledError(
        generation,
        this.lifecycleGeneration,
      );
    }
  }

  private assertActiveOperation(generation: number, operation: string): void {
    if (generation !== this.lifecycleGeneration) {
      throw new SpringEngineOperationCancelledError(
        operation,
        generation,
        this.lifecycleGeneration,
      );
    }
  }

  private beginOperation(operation: SpringEngineOperationName): SpringEngineOperationLease {
    return {
      operation,
      generation: this.lifecycleGeneration,
      nameEntryCache: createOperationNameEntryCache(),
    };
  }

  private reportAnalysisId(
    request: ReportDeliveryRequestV1,
    targetDate: Date,
  ): string {
    const parts = targetCalendarParts(targetDate);
    const { name: _displayBirthName, ...birthIdentity } = request.birth;
    const analysisOptions = request.options ?? {};
    const projectName = (characters: readonly NameCharInput[] | undefined) =>
      (characters ?? []).map((character) => ({
        hangul: character.hangul,
        hanja: character.hanja ?? '',
      }));
    const key = canonicalJson({
      birth: birthIdentity,
      surname: projectName(request.surname),
      givenName: projectName(request.givenName),
      options: analysisOptions,
      anchorDate: [parts.year, parts.month, parts.day],
    });
    const cached = this.reportAnalysisIds.get(key);
    if (cached) {
      this.reportAnalysisIds.delete(key);
      this.reportAnalysisIds.set(key, cached);
      return cached;
    }
    if (this.reportAnalysisIds.size >= REPORT_ANALYSIS_ID_CACHE_LIMIT) {
      const oldest = this.reportAnalysisIds.keys().next().value;
      if (oldest !== undefined) this.reportAnalysisIds.delete(oldest);
    }
    const id = createOpaqueAnalysisId();
    this.reportAnalysisIds.set(key, id);
    return id;
  }

  private candidateSearchRequestKey(request: SpringRequest): string {
    const { name: _displayBirthName, ...birthIdentity } = request.birth;
    const { limit: _limit, offset: _offset, ...analysisOptions } = request.options ?? {};
    const projectName = (characters: readonly NameCharInput[] | undefined) =>
      (characters ?? []).map((character) => ({
        hangul: character.hangul,
        hanja: character.hanja ?? '',
      }));
    return canonicalJson({
      birth: birthIdentity,
      surname: projectName(request.surname),
      givenName: projectName(request.givenName),
      givenNameLength: request.givenNameLength,
      mode: request.mode ?? 'auto',
      options: analysisOptions,
    });
  }

  private cacheCandidateSearchSnapshot(snapshot: CandidateSearchSnapshotV1): void {
    if (this.candidateSearchSnapshots.size >= CANDIDATE_SEARCH_SNAPSHOT_CACHE_LIMIT) {
      const oldest = this.candidateSearchSnapshots.keys().next().value;
      if (oldest !== undefined) this.candidateSearchSnapshots.delete(oldest);
    }
    this.candidateSearchSnapshots.set(snapshot.query.queryId, snapshot);
  }

  private getCandidateSearchSnapshot(
    queryId: string,
    requestKey: string,
  ): CandidateSearchSnapshotV1 {
    if (!CANDIDATE_QUERY_ID_PATTERN_V1.test(queryId)) {
      throw new CandidateSearchContractErrorV1('INVALID_QUERY_ID', 'Candidate queryId is invalid.');
    }
    const snapshot = this.candidateSearchSnapshots.get(queryId);
    if (!snapshot) {
      throw new CandidateSearchContractErrorV1(
        'QUERY_SNAPSHOT_EXPIRED',
        'Candidate query snapshot is unavailable in this engine session.',
      );
    }
    if (snapshot.requestKey !== requestKey) {
      throw new CandidateSearchContractErrorV1(
        'QUERY_ID_MISMATCH',
        'Candidate queryId does not belong to this analysis request.',
      );
    }
    this.candidateSearchSnapshots.delete(queryId);
    this.candidateSearchSnapshots.set(queryId, snapshot);
    return snapshot;
  }

  /**
   * Reuses an already-ranked first-page snapshot for the exact same analysis
   * request. Query IDs are engine-session correlation keys, so returning the
   * existing ID keeps every pager on the same immutable ordering and avoids
   * consuming another slot in the bounded four-snapshot LRU.
   */
  private getCandidateSearchSnapshotByRequestKey(
    requestKey: string,
  ): CandidateSearchSnapshotV1 | undefined {
    for (const [queryId, snapshot] of this.candidateSearchSnapshots) {
      if (snapshot.requestKey !== requestKey) continue;
      this.candidateSearchSnapshots.delete(queryId);
      this.candidateSearchSnapshots.set(queryId, snapshot);
      return snapshot;
    }
    return undefined;
  }

  private operationNameEntryRepository(
    lease: SpringEngineOperationLease,
  ): NameEntryRepository {
    return createOperationNameEntryRepository(
      this.hanjaRepo,
      lease.nameEntryCache,
      (work) => this.awaitOperationStep(lease, work),
    );
  }

  private async awaitOperationStep<T>(
    lease: SpringEngineOperationLease,
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      // The thunk must not start work in a newer lifecycle on behalf of an
      // operation that was already invalidated by close().
      this.assertActiveOperation(lease.generation, lease.operation);
      const result = await work();
      this.assertActiveOperation(lease.generation, lease.operation);
      return result;
    } catch (cause) {
      // Repository implementations have their own generation guards, but
      // their low-level cancellation messages are not part of SpringEngine's
      // public contract. A lifecycle change always wins over the inner cause.
      if (lease.generation !== this.lifecycleGeneration) {
        throw new SpringEngineOperationCancelledError(
          lease.operation,
          lease.generation,
          this.lifecycleGeneration,
        );
      }
      throw cause;
    }
  }

  private completeOperation<T>(lease: SpringEngineOperationLease, result: T): T {
    this.assertActiveOperation(lease.generation, lease.operation);
    return result;
  }

  private resolvePureHangulMode(options?: SpringRequest['options']): 'auto' | 'on' | 'off' {
    const raw = options?.pureHangulNameMode ?? DEFAULT_PURE_HANGUL_MODE;
    if (raw === 'on' || raw === 'off') {
      return raw;
    }
    return 'auto';
  }

  private resolveHanjaPool(options?: SpringRequest['options']): HanjaPool {
    return options?.precisionConfig?.hanjaPool === 'inmyeongyong_full'
      ? 'inmyeongyong_full'
      : 'curated';
  }

  private recordCandidateRejection(
    accumulator: CandidateRejectionAccumulator,
    reason: string,
    entry: Partial<NameCharInput>,
    detail?: string,
  ): void {
    const bucket = accumulator.get(reason) ?? {
      reason,
      count: 0,
      examples: [],
    };
    bucket.count += 1;
    if (bucket.examples.length < 5) {
      bucket.examples.push({
        hangul: entry.hangul,
        hanja: entry.hanja,
        legalStatus: entry.legalStatus,
        detail,
      });
    }
    accumulator.set(reason, bucket);
  }

  private candidateRejectionSummary(
    accumulator: CandidateRejectionAccumulator,
  ): CandidateRejectionBucket[] {
    return Array.from(accumulator.values())
      .map((bucket) => ({
        reason: bucket.reason,
        count: bucket.count,
        examples: bucket.examples,
      }))
      .sort((a, b) => a.reason.localeCompare(b.reason));
  }

  private resolveSchoolPresetMeta(options?: SpringRequest['options']): SchoolPresetMetadata {
    return resolveSchoolPresetMetadata(
      options?.schoolPreset,
      options?.precisionConfig?.useSchoolPreset === true,
    );
  }

  private assertSchoolPresetSelection(options?: SpringRequest['options']): void {
    resolveSchoolPresetName(options?.schoolPreset);
  }

  /** PR-Q-24 K-4 + K-5 full wire — resolve hangul signal cap.
   *  Per spec spring-info/09_finalization/05_pure_hangul_schema_wireup.md §1.2
   *  학파별 의도 매트릭스. Cap 의 우선순위:
   *   1. 명시적 `precisionConfig.pureHangulSignalCap` (caller override)
   *   2. `pureHangulSchema='auto'` + classical structure presets → 0.7
   *   3. else 1.0 (no cap, current behavior preserved). */
  private resolveHangulSignalCap(options?: SpringRequest['options']): number {
    const pc = options?.precisionConfig;
    if (typeof pc?.pureHangulSignalCap === 'number') {
      return Math.max(0, Math.min(1, pc.pureHangulSignalCap));
    }
    if (
      pc?.pureHangulSchema === 'auto' &&
      (options?.schoolPreset === 'chinese' || options?.schoolPreset === 'classical_text')
    ) {
      return 0.7;
    }
    return 1.0;
  }

  /** PR-Q-25 K-6 full wire — resolve hangul polarity model.
   *  Per spec spring-info/09_finalization/05_pure_hangul_schema_wireup.md §1.2,
   *  modern 학파 (한국 작명원 표준) 는 ternary 모델 — ㅣ/ㅡ 중성. 우선순위:
   *   1. 명시적 `precisionConfig.pureHangulPolarityModel` (caller override)
   *   2. `pureHangulSchema='auto'` + modern Korean presets → 'ternary'
   *   3. else 'binary' (default behavior preserved). */
  private resolveHangulPolarityModel(options?: SpringRequest['options']): 'binary' | 'ternary' {
    const pc = options?.precisionConfig;
    if (pc?.pureHangulPolarityModel === 'ternary' || pc?.pureHangulPolarityModel === 'binary') {
      return pc.pureHangulPolarityModel;
    }
    if (
      pc?.pureHangulSchema === 'auto' &&
      (options?.schoolPreset === 'modern' || options?.schoolPreset === 'korean_modern')
    ) {
      return 'ternary';
    }
    return 'binary';
  }

  /** Extracts the school-preset routing for SajuCalculator from a request's
   *  options. `useSchoolPreset` defaults to false (legacy behavior) and the
   *  resolved schoolPreset is forwarded as-is. SajuCalculator itself returns
   *  null presetData when useSchoolPreset is false, so the path collapses
   *  into the saju-scoring.json defaults.
   *
   *  Also forwards the PR5 per-sub-score scoringOverrides flags (balanceMode,
   *  yongshinMode, strengthMode, tenGodMode, gyeokgukMode). When the precision
   *  config block is absent, scoringOverrides is undefined and each sub-score
   *  falls through to its legacy default. */
  /** Build evaluator-side hints from request policy plus the normalized saju
   *  uncertainty contract. Returns undefined when no adaptive flag is active so
   *  SajuCalculator's putInsight can store undefined → spring-evaluator's
   *  extractSajuPriority falls through to the linear default. */
  private resolveEvaluatorHints(
    birth: BirthInfo | undefined,
    options?: SpringRequest['options'],
    sajuOutput?: SajuOutputSummary | null,
  ): SajuEvaluatorHints | undefined {
    const pc = options?.precisionConfig ?? {};

    const hints: { -readonly [K in keyof SajuEvaluatorHints]?: SajuEvaluatorHints[K] } = {};
    // PR-Q-9 (Phase M-D3): sajuPriorityCurve default flips 'linear' → 'tanh'.
    // Smoothing the cliff at priority=0/1 reduces over-rotation when a single
    // saju signal sits near the threshold. Callers can opt out with
    // explicit `'linear'`.
    const curveMode: 'linear' | 'tanh' = pc.sajuPriorityCurve ?? 'tanh';
    if (curveMode === 'tanh') {
      hints.sajuPriorityCurve = 'tanh';
    }
    // PR-Q-8 (Phase M-D2): unknownHourGuard default flips false → true.
    // The guard takes effect for an unknown hour, or for an unknown minute
    // only when the normalized HH:00..HH:59 envelope crosses a real boundary.
    // Callers can opt out explicitly
    // with `precisionConfig.unknownHourGuard: false`.
    const guardEnabled = pc.unknownHourGuard !== false;
    if (guardEnabled) {
      hints.unknownHourGuard = true;
      const normalizedUncertainty = sajuOutput?.inputUncertainty;
      const rawHour = (birth as { readonly hour?: unknown } | undefined)?.hour;
      hints.isHourUnknown = normalizedUncertainty
        ? normalizedUncertainty.unknownHour != null
          || normalizedUncertainty.unknownMinute?.boundarySensitive === true
        : rawHour == null || rawHour === '';
      if (typeof pc.unknownTimeSajuDamp === 'number') {
        hints.unknownTimeSajuDamp = pc.unknownTimeSajuDamp;
      }
    }
    // PR-Q-7: forward evaluatorMode opt-in to extractSajuPriority Step 3.5.
    // Default 'single' is the legacy linear path; 'multi_axis' uses the
    // axisStrength weighted blend when ≥2 axes are present.
    if (pc.evaluatorMode === 'multi_axis') {
      hints.evaluatorMode = 'multi_axis';
    }
    return Object.keys(hints).length > 0 ? hints as SajuEvaluatorHints : undefined;
  }

  private resolveSajuPreset(options?: SpringRequest['options']): {
    readonly useSchoolPreset: boolean;
    readonly schoolPreset?: SchoolPresetName;
    readonly scoringOverrides?: {
      readonly balanceMode?: 'mathematical' | 'yongshin_first' | 'classical_jonggyeok_aware';
      readonly yongshinMode?: 'classical_blend' | 'chengbai_strict' | 'consensus_aware';
      readonly strengthMode?: 'binary' | 'continuous';
      readonly tenGodMode?: 'simple_count' | 'positional_weighted' | 'positional_weighted_v2';
      readonly gyeokgukMode?: 'jonggyeok_only' | 'multi_special' | 'chengbai_strict';
    };
    readonly elementStrategy?: NameElementStrategy;
  } {
    const pc = options?.precisionConfig;
    return {
      useSchoolPreset: pc?.useSchoolPreset === true,
      schoolPreset: options?.schoolPreset,
      // PR-Q-10 (Phase M-D4): gyeokgukMode default flips
      // 'jonggyeok_only' → 'chengbai_strict'. Smooth penalty curve replaces
      // the 0.5-confidence cliff (saju_master chengbai parity). Callers can
      // opt out via explicit `'jonggyeok_only'` or `'multi_special'`.
      // PR-Q-11 (Phase M-D5): yongshinMode default flips
      // 'classical_blend' → 'chengbai_strict'. Stricter penalty when
      // yongshin confidence is low. Callers can opt out via 'classical_blend'.
      // PR-Q-13 (Phase M-D7): strengthMode default flips 'binary' → 'continuous'.
      // 신강도 graded 평가 (totalSupport/totalOppose 비율). narrative richness ↑.
      // PR-Q-14 (Phase M-D8): tenGodMode default flips 'simple_count' →
      // 'positional_weighted'. 월지 / 일간 / 시지 위치별 가중. 격국 도출 정확도 ↑.
      scoringOverrides: {
        balanceMode: pc?.balanceMode,
        yongshinMode: pc?.yongshinMode ?? 'chengbai_strict',
        strengthMode: pc?.strengthMode ?? 'continuous',
        tenGodMode: pc?.tenGodMode ?? 'positional_weighted',
        gyeokgukMode: pc?.gyeokgukMode ?? 'chengbai_strict',
      },
      elementStrategy: pc?.nameElementStrategy,
    };
  }

  private resolveNameResolutionPolicy(
    givenName: NameCharInput[] | undefined,
    options?: SpringRequest['options'],
  ): NameResolutionPolicy {
    const pureHangulMode = this.resolvePureHangulMode(options);
    const givenNameChars = givenName ?? [];
    const hasGivenName = givenNameChars.length > 0;
    const allGivenHangulOnly = givenNameChars.length > 0
      && givenNameChars.every((char) => !hasExplicitNameHanja(char));

    const pureHangulGivenName = pureHangulMode === 'on'
      ? hasGivenName
      : pureHangulMode === 'off'
        ? false
        : allGivenHangulOnly;

    return {
      pureHangulGivenName,
      useSurnameHanjaInPureHangul: options?.useSurnameHanjaInPureHangul
        ?? DEFAULT_USE_SURNAME_HANJA_IN_PURE,
    };
  }

  private explicitNameIdentityKey(context: PreverifiedExplicitPairContext): string {
    return `${context.role}:${context.hanjaPool}`;
  }

  private preverifiedExplicitNameIdentity(
    input: NameCharInput,
    context: PreverifiedExplicitPairContext,
  ): HanjaEntry | undefined {
    const byContext = this.explicitNameIdentityCache.get(input);
    if (!byContext) return undefined;
    const key = this.explicitNameIdentityKey(context);
    const cached = byContext.get(key);
    if (cached?.generation === this.lifecycleGeneration) return cached.entry;
    if (cached) byContext.delete(key);
    return undefined;
  }

  private cacheExplicitNameIdentities(
    resolved: ReadonlyMap<NameCharInput, HanjaEntry>,
    context: PreverifiedExplicitPairContext,
  ): void {
    const key = this.explicitNameIdentityKey(context);
    for (const [input, entry] of resolved) {
      const byContext = this.explicitNameIdentityCache.get(input) ?? new Map();
      byContext.set(key, {
        generation: this.lifecycleGeneration,
        entry,
      });
      this.explicitNameIdentityCache.set(input, byContext);
    }
  }

  private async assertExplicitRequestNameIdentity(
    request: SpringRequest,
    operation: SpringEngineOperationLease,
  ): Promise<void> {
    const hanjaPool = this.resolveHanjaPool(request.options);
    const requireLegalRegistrable = this.buildNameInputPlan(request).mode === 'recommend';
    const nameEntryRepository = this.operationNameEntryRepository(operation);
    const preverifiedExplicitPair = (
      input: NameCharInput,
      context: PreverifiedExplicitPairContext,
    ): HanjaEntry | undefined => this.preverifiedExplicitNameIdentity(input, context);

    if (request.givenName?.length) {
      const givenNameContext = { role: 'givenName', hanjaPool } as const;
      const resolvedGivenName = await this.awaitOperationStep(
        operation,
        () => assertExplicitNameIdentity(request.givenName!, nameEntryRepository, {
          hanjaPool,
          requireLegalRegistrable,
          asyncFullPoolEntries: loadFullHanjaPoolEntries,
          preverifiedExplicitPair,
        }),
      );
      this.cacheExplicitNameIdentities(resolvedGivenName, givenNameContext);
    }

    if (request.surname.some(hasExplicitNameHanja)) {
      const surnameContext = { role: 'surname', hanjaPool } as const;
      const resolvedSurname = await this.awaitOperationStep(
        operation,
        () => assertExplicitNameIdentity(request.surname, nameEntryRepository, {
          isSurname: true,
          hanjaPool,
          asyncFullPoolEntries: loadFullHanjaPoolEntries,
          preverifiedExplicitPair,
        }),
      );
      this.cacheExplicitNameIdentities(resolvedSurname, surnameContext);
    }
  }

  private assertRequestNameSyntax(
    request: SpringRequest,
    allowGivenNameGenerationFilters: boolean,
    requireGivenName = false,
    evaluateGivenName = false,
  ): void {
    assertSpringNameRequestContract(request, {
      allowGivenNameGenerationFilters,
      requireGivenName,
      evaluateGivenName,
    });
  }

  private resolveNameTrend(
    givenName: NameCharInput[] | undefined,
    birth: BirthInfo,
    options?: SpringRequest['options'],
  ): NameTrendAnalysis | undefined {
    return options?.precisionConfig?.surfaceNameTrend
      ? getNameTrendAnalysis(givenName, birth)
      : undefined;
  }

  private resolvePhoneticAnalysis(
    surname: NameCharInput[] | undefined,
    givenName: NameCharInput[] | undefined,
    options?: SpringRequest['options'],
  ): PhoneticAnalysis | undefined {
    return options?.precisionConfig?.surfacePhoneticEvidence
      ? getPhoneticAnalysis(surname, givenName)
      : undefined;
  }

  private shouldSurfaceNamingScoreVector(options?: SpringRequest['options']): boolean {
    return options?.precisionConfig?.surfaceNamingScoreVector === true
      || options?.precisionConfig?.paretoFrontierCandidates === true;
  }

  private resolveNamingScoreVectorEvidence(
    surname: NameCharInput[] | undefined,
    givenName: NameCharInput[] | undefined,
    birth: BirthInfo,
    options: SpringRequest['options'] | undefined,
    surfacedNameTrend?: NameTrendAnalysis,
    surfacedPhonetic?: PhoneticAnalysis,
  ): { readonly nameTrend?: NameTrendAnalysis; readonly phonetic?: PhoneticAnalysis } {
    if (!this.shouldSurfaceNamingScoreVector(options)) return {};
    return {
      nameTrend: surfacedNameTrend ?? getNameTrendAnalysis(givenName, birth),
      phonetic: surfacedPhonetic ?? getPhoneticAnalysis(surname, givenName),
    };
  }

  private buildNamingScoreVector(
    evaluationResult: EvaluationResult,
    surnameEntries: HanjaEntry[],
    givenNameEntries: HanjaEntry[],
    hangul: HangulCalculator,
    hanja: HanjaCalculator,
    frame: FrameCalculator,
    hanjaPool: HanjaPool,
    nameTrend?: NameTrendAnalysis,
    phonetic?: PhoneticAnalysis,
  ): NamingScoreVector {
    const allEntries = [...surnameEntries, ...givenNameEntries];
    const hasHanja = allEntries.some((entry) => hasHanIdeograph(entry.hanja));
    const sajuInsight = evaluationResult.categoryMap[SAJU_FRAME];
    const sajuScoring = (sajuInsight?.details as Record<string, any> | undefined)?.scoring as Record<string, any> | undefined;
    const penalties = sajuScoring?.penalties as Record<string, any> | undefined;
    const hangulElement = finiteScore(hangul.getAnalysis().data.elementScore);
    const hanjaElement = hasHanja ? finiteScore(hanja.getAnalysis().data.elementScore) : null;
    const frameElement = hasHanja ? finiteScore(frame.getAnalysis().data.elementScore) : null;
    const legal = computeLegalScore(allEntries, hanjaPool);
    const phoneticScore = finiteScore(phonetic?.phoneticScore);
    const familyFit = finiteScore(phonetic?.familyNameFitScore);
    const trendRisk = finiteScore(nameTrend?.trendRisk);
    const penaltyRisk = finiteScore(penalties?.total);
    const riskCandidates = [
      legal == null ? null : 100 - legal,
      phoneticScore == null ? null : 100 - phoneticScore,
      familyFit == null ? null : 100 - familyFit,
      trendRisk,
      penaltyRisk,
    ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const risk = Math.max(0, ...riskCandidates);

    return {
      legal,
      sajuFit: finiteScore(sajuInsight?.score),
      yongshinFit: finiteScore(sajuScoring?.yongshin),
      elementBalance: averageScores([
        hangulElement,
        hanjaElement,
        frameElement,
        finiteScore(sajuScoring?.balance),
      ]),
      hanjaMeaning: computeHanjaMeaningScore(givenNameEntries),
      phonetic: phoneticScore,
      eraFit: finiteScore(nameTrend?.eraFitScore ?? nameTrend?.trendFit),
      familyFit,
      risk: clampScore(risk),
    };
  }

  private filterInternallyRepeatedCandidates(
    candidates: NameCharInput[][],
    accumulator: CandidateRejectionAccumulator,
  ): NameCharInput[][] {
    const filtered: NameCharInput[][] = [];
    for (const candidate of candidates) {
      const info = describeCandidateName(candidate);
      if (info.hasRepeatedSyllable || info.hasRepeatedOrthodoxHanja) {
        this.recordCandidateRejection(
          accumulator,
          info.hasRepeatedSyllable ? 'repeated_given_syllable' : 'repeated_given_hanja',
          candidate[0],
          'Candidate removed before scoring because its given-name syllable or normalized Hanja repeats internally.',
        );
        continue;
      }
      filtered.push(candidate);
    }
    return filtered;
  }

  private filterPresentationSafeEntries(
    entries: readonly HanjaEntry[],
    hanjaPool: HanjaPool,
    accumulator: CandidateRejectionAccumulator,
  ): HanjaEntry[] {
    const filtered: HanjaEntry[] = [];
    for (const entry of entries) {
      const unsafeMeaning = hasUnsafeHanjaMeaning(entry);
      const opaqueMeaning = hasOpaqueHanjaMeaning(entry);
      if (unsafeMeaning || opaqueMeaning) {
        const legal = getLegalAnnotation(entry, { pool: hanjaPool });
        this.recordCandidateRejection(
          accumulator,
          unsafeMeaning ? 'unsafe_hanja_meaning' : 'opaque_hanja_meaning',
          {
            hangul: entry.hangul,
            hanja: entry.hanja,
            legalStatus: legal.legalStatus,
          },
          unsafeMeaning
            ? 'Candidate removed before scoring because the Hanja meaning is unsuitable for public name recommendations.'
            : 'Candidate removed before scoring because the Hanja meaning is too opaque for public name recommendations.',
        );
        continue;
      }
      filtered.push(entry);
    }
    return filtered;
  }

  private pageOrderedCandidates<T extends { readonly rank: number }>(
    results: readonly T[],
    options?: SpringRequest['options'],
  ): T[] {
    if (options?.limit == null && options?.offset == null) {
      return [...results];
    }
    const offset = options.offset ?? DEFAULT_OFFSET;
    // `limit` must stay positive for the shared pagination contract. An
    // offset-only request over an empty result set should still return an
    // empty page instead of manufacturing an invalid zero limit.
    const limit = options.limit ?? Math.max(results.length, 1);
    return sliceCandidatePage(results, offset, limit);
  }

  // -------------------------------------------------------------------------
  // getNamingReport -- pure name analysis (no saju)
  // -------------------------------------------------------------------------

  async getNamingReport(request: SpringRequest): Promise<NamingReport> {
    request = snapshotSpringRequest(request);
    this.assertSchoolPresetSelection(request.options);
    const operation = this.beginOperation('getNamingReport');
    this.assertRequestNameSyntax(request, false, true, true);
    await this.awaitOperationStep(operation, () => this.init());
    await this.assertExplicitRequestNameIdentity(request, operation);

    const resolutionPolicy = this.resolveNameResolutionPolicy(
      request.givenName,
      request.options,
    );
    const hanjaPool = this.resolveHanjaPool(request.options);
    const surnameEntries = await this.awaitOperationStep(operation, () => this.resolveEntries(request.surname, {
      forceHangulOnly: resolutionPolicy.pureHangulGivenName
        && !resolutionPolicy.useSurnameHanjaInPureHangul,
      isSurname: true,
      hanjaPool,
    }, operation));
    const givenNameEntries = await this.awaitOperationStep(operation, () => this.resolveEntries(request.givenName!, {
      forceHangulOnly: resolutionPolicy.pureHangulGivenName,
      hanjaPool,
    }, operation));

    const hangul = new HangulCalculator(surnameEntries, givenNameEntries, this.resolveHangulSignalCap(request.options), this.resolveHangulPolarityModel(request.options));
    const hanja = new HanjaCalculator(
      surnameEntries,
      givenNameEntries,
      ENABLE_HANJA_NAME_EVALUATION && !resolutionPolicy.pureHangulGivenName,
    );
    const frame  = new FrameCalculator(
      surnameEntries,
      givenNameEntries,
      ENABLE_FOURFRAME_NAME_EVALUATION && !resolutionPolicy.pureHangulGivenName,
    );

    const evalCtx: EvalContext = {
      surnameLength: surnameEntries.length,
      givenLength:   givenNameEntries.length,
      luckyMap:      this.luckyMap,
      insights:      {},
    };

    const evalResult = evaluateName([hangul, hanja, frame], evalCtx);
    const nameTrend = this.resolveNameTrend(request.givenName, request.birth, request.options);
    const phonetic = this.resolvePhoneticAnalysis(request.surname, request.givenName, request.options);
    const vectorEvidence = this.resolveNamingScoreVectorEvidence(
      request.surname,
      request.givenName,
      request.birth,
      request.options,
      nameTrend,
      phonetic,
    );
    const scoreVector = this.shouldSurfaceNamingScoreVector(request.options)
      ? this.buildNamingScoreVector(
        evalResult,
        surnameEntries,
        givenNameEntries,
        hangul,
        hanja,
        frame,
        hanjaPool,
        vectorEvidence.nameTrend,
        vectorEvidence.phonetic,
      )
      : undefined;
    const strengthProfile = scoreVector
      ? deriveCandidateStrengthProfile(scoreVector)
      : undefined;
    return this.completeOperation(operation, this.buildNamingReport(
      surnameEntries,
      givenNameEntries,
      evalResult,
      hangul,
      hanja,
      frame,
      hanjaPool,
      nameTrend,
      phonetic,
      scoreVector,
      strengthProfile,
    ));
  }

  // -------------------------------------------------------------------------
  // getSajuReport -- saju analysis only
  // -------------------------------------------------------------------------

  async getSajuReport(request: SpringRequest): Promise<SajuReport> {
    request = snapshotSpringRequest(request);
    this.assertSchoolPresetSelection(request.options);
    const operation = this.beginOperation('getSajuReport');
    const { summary, sajuEnabled } = await this.awaitOperationStep(
      operation,
      () => analyzeSajuSafe(request.birth, request.options),
    );
    return this.completeOperation(operation, { ...summary, sajuEnabled });
  }

  // -------------------------------------------------------------------------
  // getSpringReport -- single integrated report for one explicit given name
  // -------------------------------------------------------------------------

  async getSpringReport(
    request: SpringRequest,
    sajuReportOverride?: SajuReport,
  ): Promise<SpringReport> {
    const stableRequest = snapshotSpringRequest(request);
    this.assertSchoolPresetSelection(stableRequest.options);
    validateSajuConfigFortunePolicy(stableRequest.options?.sajuConfig);
    const stableOverride = sajuReportOverride === undefined
      ? undefined
      : snapshotSajuReport(sajuReportOverride);
    return this.getSpringReportFromSnapshot(stableRequest, stableOverride);
  }

  /**
   * Resolves and evaluates the mandatory combined candidate state without
   * assembling the presentation-heavy naming report. Recommendation callers
   * can therefore validate and rank the whole pool before hydrating a page.
   */
  private async evaluateCombinedSpringCandidate(
    request: SpringRequest,
    sajuContext: SpringSajuContext,
    operation: SpringEngineOperationLease,
    nameStatOverride?: CollectedNameInput['nameStat'],
  ): Promise<CombinedSpringCandidateEvaluation> {
    const givenNameKey = this.givenNameHangulKey(request.givenName!);
    if (nameStatOverride && nameStatOverride.givenNameKey !== givenNameKey) {
      throw new Error('Internal NameStat evidence does not match the requested given name.');
    }
    const nameStatInfo = nameStatOverride?.info ?? await this.awaitOperationStep(
      operation,
      () => this.getNameStatInfo(request.givenName!, operation),
    );

    const resolutionPolicy = this.resolveNameResolutionPolicy(
      request.givenName,
      request.options,
    );
    const hanjaPool = this.resolveHanjaPool(request.options);
    const surnameEntries = await this.awaitOperationStep(operation, () => this.resolveEntries(request.surname, {
      forceHangulOnly: resolutionPolicy.pureHangulGivenName
        && !resolutionPolicy.useSurnameHanjaInPureHangul,
      isSurname: true,
      hanjaPool,
    }, operation));
    const givenNameEntries = await this.awaitOperationStep(operation, () => this.resolveEntries(request.givenName!, {
      forceHangulOnly: resolutionPolicy.pureHangulGivenName,
      hanjaPool,
    }, operation));

    const hangul = new HangulCalculator(
      surnameEntries,
      givenNameEntries,
      this.resolveHangulSignalCap(request.options),
      this.resolveHangulPolarityModel(request.options),
    );
    const hanja = new HanjaCalculator(
      surnameEntries,
      givenNameEntries,
      ENABLE_HANJA_NAME_EVALUATION && !resolutionPolicy.pureHangulGivenName,
    );
    const frame = new FrameCalculator(
      surnameEntries,
      givenNameEntries,
      ENABLE_FOURFRAME_NAME_EVALUATION && !resolutionPolicy.pureHangulGivenName,
    );
    const hasSajuContext = Boolean(sajuContext.output);
    const saju = new SajuCalculator(
      surnameEntries,
      givenNameEntries,
      sajuContext.dist,
      sajuContext.output,
      {
        elementSource: resolutionPolicy.pureHangulGivenName ? 'hangul' : 'resource',
        enabled: hasSajuContext,
        ...this.resolveSajuPreset(request.options),
        evaluatorHints: this.resolveEvaluatorHints(
          request.birth,
          request.options,
          sajuContext.output,
        ),
      },
    );

    const combinedCtx: EvalContext = {
      surnameLength: surnameEntries.length,
      givenLength: givenNameEntries.length,
      luckyMap: this.luckyMap,
      insights: {},
    };
    const combined = springEvaluateName([hangul, hanja, frame, saju], combinedCtx);

    return {
      nameStatInfo,
      surnameEntries,
      givenNameEntries,
      hangul,
      hanja,
      frame,
      saju,
      combined,
      hanjaPool,
    };
  }

  private async getSpringReportFromSnapshot(
    request: SpringRequest,
    sajuReportOverride?: SajuReport,
    nameStatOverride?: CollectedNameInput['nameStat'],
    parentOperation?: SpringEngineOperationLease,
  ): Promise<SpringReport> {
    const operation = parentOperation ?? this.beginOperation('getSpringReport');
    this.assertRequestNameSyntax(request, false, true, true);
    await this.awaitOperationStep(operation, () => this.init());
    await this.assertExplicitRequestNameIdentity(request, operation);

    const sajuReport = sajuReportOverride ?? await this.awaitOperationStep(
      operation,
      () => this.getSajuReport(request),
    );
    const sajuContext = buildSajuContext(sajuReport, {
      includeTenGodByPosition: request.options?.precisionConfig?.tenGodMode === 'positional_weighted_v2',
    });
    const evaluation = await this.evaluateCombinedSpringCandidate(
      request,
      sajuContext,
      operation,
      nameStatOverride,
    );
    const {
      nameStatInfo,
      surnameEntries,
      givenNameEntries,
      hangul,
      hanja,
      frame,
      saju,
      combined,
      hanjaPool,
    } = evaluation;

    const nameOnlyCtx: EvalContext = {
      surnameLength: surnameEntries.length,
      givenLength:   givenNameEntries.length,
      luckyMap:      this.luckyMap,
      insights:      {},
    };
    const nameOnly = evaluateName([hangul, hanja, frame], nameOnlyCtx);
    const nameTrend = this.resolveNameTrend(request.givenName, request.birth, request.options);
    const phonetic = this.resolvePhoneticAnalysis(request.surname, request.givenName, request.options);
    const vectorEvidence = this.resolveNamingScoreVectorEvidence(
      request.surname,
      request.givenName,
      request.birth,
      request.options,
      nameTrend,
      phonetic,
    );
    const scoreVector = this.shouldSurfaceNamingScoreVector(request.options)
      ? this.buildNamingScoreVector(
        combined,
        surnameEntries,
        givenNameEntries,
        hangul,
        hanja,
        frame,
        hanjaPool,
        vectorEvidence.nameTrend,
        vectorEvidence.phonetic,
      )
      : undefined;
    const namingScoreVector = this.shouldSurfaceNamingScoreVector(request.options)
      ? this.buildNamingScoreVector(
        nameOnly,
        surnameEntries,
        givenNameEntries,
        hangul,
        hanja,
        frame,
        hanjaPool,
        vectorEvidence.nameTrend,
        vectorEvidence.phonetic,
      )
      : undefined;
    const strengthProfile = scoreVector
      ? deriveCandidateStrengthProfile(scoreVector)
      : undefined;
    const namingStrengthProfile = namingScoreVector
      ? deriveCandidateStrengthProfile(namingScoreVector)
      : undefined;

    return this.completeOperation(operation, {
      finalScore: roundScore(combined.score),
      ...(scoreVector ? { scoreVector } : {}),
      ...(strengthProfile ? { strengthProfile } : {}),
      schoolPreset: this.resolveSchoolPresetMeta(request.options),
      popularityRank: nameStatInfo.popularityRank,
      maleRatio: nameStatInfo.maleRatio,
      nameGender: nameStatInfo.nameGender,
      ...(nameTrend ? { nameTrend } : {}),
      ...(phonetic ? { phonetic } : {}),
      namingReport: this.buildNamingReport(
        surnameEntries,
        givenNameEntries,
        nameOnly,
        hangul,
        hanja,
        frame,
        hanjaPool,
        nameTrend,
        phonetic,
        namingScoreVector,
        namingStrengthProfile,
      ),
      sajuReport,
      sajuCompatibility: saju.getAnalysis().data,
      combinedDistribution: saju.getCombinedDistribution(),
      rank: 0,
    });
  }

  private async prepareSpringReportCandidate(
    candidateRequest: SpringRequest,
    nameStat: NonNullable<CollectedNameInput['nameStat']>,
    sajuContext: SpringSajuContext,
    operation: SpringEngineOperationLease,
  ): Promise<PreparedSpringReportCandidate> {
    this.assertRequestNameSyntax(candidateRequest, false, true, true);
    await this.assertExplicitRequestNameIdentity(candidateRequest, operation);
    const evaluation = await this.evaluateCombinedSpringCandidate(
      candidateRequest,
      sajuContext,
      operation,
      nameStat,
    );
    const nameTrend = this.resolveNameTrend(
      candidateRequest.givenName,
      candidateRequest.birth,
      candidateRequest.options,
    );
    const phonetic = this.resolvePhoneticAnalysis(
      candidateRequest.surname,
      candidateRequest.givenName,
      candidateRequest.options,
    );
    const vectorEvidence = this.resolveNamingScoreVectorEvidence(
      candidateRequest.surname,
      candidateRequest.givenName,
      candidateRequest.birth,
      candidateRequest.options,
      nameTrend,
      phonetic,
    );
    const scoreVector = this.shouldSurfaceNamingScoreVector(candidateRequest.options)
      ? this.buildNamingScoreVector(
        evaluation.combined,
        evaluation.surnameEntries,
        evaluation.givenNameEntries,
        evaluation.hangul,
        evaluation.hanja,
        evaluation.frame,
        evaluation.hanjaPool,
        vectorEvidence.nameTrend,
        vectorEvidence.phonetic,
      )
      : undefined;
    const strengthProfile = scoreVector
      ? deriveCandidateStrengthProfile(scoreVector)
      : undefined;
    const diversity = describeCandidateName(
      evaluation.givenNameEntries.map((entry) => ({
        hangul: entry.hangul,
        hanja: entry.hanja,
      })),
    );

    return {
      candidateRequest,
      nameStat,
      finalScore: roundScore(evaluation.combined.score),
      ...(scoreVector ? { scoreVector } : {}),
      ...(strengthProfile ? { strengthProfile } : {}),
      diversity,
    };
  }

  private assertPreparedCandidateHydration(
    prepared: PreparedSpringReportCandidate,
    report: SpringReport,
  ): void {
    const hydratedDiversity = describeCandidateName(
      report.namingReport.name.givenName.map((char) => ({
        hangul: char.hangul,
        hanja: char.hanja,
      })),
    );
    const nameStat = prepared.nameStat.info;
    const matches = report.finalScore === prepared.finalScore
      && JSON.stringify(report.scoreVector) === JSON.stringify(prepared.scoreVector)
      && JSON.stringify(report.strengthProfile) === JSON.stringify(prepared.strengthProfile)
      && JSON.stringify(hydratedDiversity) === JSON.stringify(prepared.diversity)
      && report.popularityRank === nameStat.popularityRank
      && report.maleRatio === nameStat.maleRatio
      && report.nameGender === nameStat.nameGender;
    if (!matches) {
      throw new Error('Hydrated candidate report does not match its validated selection projection.');
    }
  }

  private async hydratePreparedSpringReportCandidate(
    prepared: PreparedSpringReportCandidate,
    sajuReport: SajuReport,
    operation: SpringEngineOperationLease,
  ): Promise<SpringReport> {
    const report = await this.getSpringReportFromSnapshot(
      prepared.candidateRequest,
      sajuReport,
      prepared.nameStat,
      operation,
    );
    this.assertPreparedCandidateHydration(prepared, report);
    return report;
  }

  // -------------------------------------------------------------------------
  // getNameCandidates -- name recommendations with saju integration
  // -------------------------------------------------------------------------

  async getNameCandidates(request: SpringRequest): Promise<SpringReport[]> {
    request = snapshotSpringRequest(request);
    this.assertSchoolPresetSelection(request.options);
    validateSajuConfigFortunePolicy(request.options?.sajuConfig);
    const operation = this.beginOperation('getNameCandidates');
    this.assertRequestNameSyntax(request, true);
    await this.awaitOperationStep(operation, () => this.init());
    await this.assertExplicitRequestNameIdentity(request, operation);
    const candidateRejections: CandidateRejectionAccumulator = new Map();

    // 1. Saju analysis
    const sajuReport = await this.awaitOperationStep(
      operation,
      () => this.getSajuReport(request),
    );
    const sajuSummary: SajuSummary = sajuReport;

    // 2. Determine mode and collect name inputs
    const nameInputPlan = this.buildNameInputPlan(request);

    const nameInputs = await this.awaitOperationStep(operation, () => this.collectNameInputs(
      request, nameInputPlan,
      sajuSummary, candidateRejections, operation,
    ));
    const candidateInputs: SpringReportCandidateInput[] = [];

    for (const collected of nameInputs) {
      const givenNameInput = collected.givenName;
      const nameStatInfo = collected.nameStat?.info ?? await this.awaitOperationStep(
        operation,
        () => this.getNameStatInfo(givenNameInput, operation),
      );
      const nameStat = collected.nameStat ?? {
        givenNameKey: this.givenNameHangulKey(givenNameInput),
        info: nameStatInfo,
      };
      const candidateRequest = snapshotSpringRequest({
        ...request,
        givenName: givenNameInput,
        mode: 'evaluate',
      });
      candidateInputs.push({ candidateRequest, nameStat });
    }

    if (candidateInputs.length === 0) {
      return this.completeOperation(operation, []);
    }

    const offset = request.options?.offset ?? DEFAULT_OFFSET;
    const hydratesWholePool = offset === 0
      && (request.options?.limit == null || request.options.limit >= candidateInputs.length);
    if (hydratesWholePool) {
      const eagerResults: SpringReport[] = [];
      for (const candidate of candidateInputs) {
        eagerResults.push(await this.awaitOperationStep(
          operation,
          () => this.getSpringReportFromSnapshot(
            candidate.candidateRequest,
            sajuReport,
            candidate.nameStat,
            operation,
          ),
        ));
      }
      return this.completeOperation(
        operation,
        orderSpringReports(eagerResults, request.options, CANDIDATE_SELECTION_LIMITS),
      );
    }

    const sajuContext = buildSajuContext(sajuReport, {
      includeTenGodByPosition: request.options?.precisionConfig?.tenGodMode === 'positional_weighted_v2',
    });

    // 3. Validate and score the whole pool before any page-specific hydration.
    const preparedCandidates: PreparedSpringReportCandidate[] = [];
    for (const candidate of candidateInputs) {
      preparedCandidates.push(await this.prepareSpringReportCandidate(
        candidate.candidateRequest,
        candidate.nameStat,
        sajuContext,
        operation,
      ));
    }

    const rankedPage = this.pageOrderedCandidates(
      orderCandidateSelectionProjections(
        preparedCandidates.map((prepared) => ({
          source: prepared,
          score: prepared.finalScore,
          ...(prepared.scoreVector ? { vector: prepared.scoreVector } : {}),
          ...(prepared.strengthProfile ? { profile: prepared.strengthProfile } : {}),
          ...prepared.diversity,
        })),
        request.options,
        CANDIDATE_SELECTION_LIMITS,
      ),
      request.options,
    );

    // 4. Materialize only the selected page. Mandatory identity, repository,
    // combined-score and selection-vector work has completed for every row;
    // presentation-only hydration is intentionally scoped to this page.
    const results: SpringReport[] = [];
    for (const selection of rankedPage) {
      const report = await this.awaitOperationStep(
        operation,
        () => this.hydratePreparedSpringReportCandidate(
          selection.source,
          sajuReport,
          operation,
        ),
      );
      results.push(applySpringReportSelectionRanking(report, selection));
    }

    return this.completeOperation(operation, results);
  }

  // -------------------------------------------------------------------------
  // getNameCandidateSummaries -- lightweight candidates for list rendering
  // -------------------------------------------------------------------------

  async getNameCandidateSummaries(request: SpringRequest): Promise<SpringCandidateSummary[]> {
    return this.getNameCandidateSummariesInternal(request, false);
  }

  private async getNameCandidateSummariesInternal(
    request: SpringRequest,
    requireSajuGuidedRecommendation: boolean,
    onSajuReport?: (report: SajuReport) => void,
  ): Promise<SpringCandidateSummary[]> {
    request = snapshotSpringRequest(request);
    this.assertSchoolPresetSelection(request.options);
    validateSajuConfigFortunePolicy(request.options?.sajuConfig);
    this.assertRequestNameSyntax(request, true);
    const nameInputPlan = this.buildNameInputPlan(request);
    if (requireSajuGuidedRecommendation && nameInputPlan.mode !== 'recommend') {
      throw new CandidateSearchContractErrorV1(
        'UNSUPPORTED_QUERY_MODE',
        'Candidate search requires recommendation mode, not explicit-name evaluation.',
      );
    }
    const operation = this.beginOperation('getNameCandidateSummaries');
    await this.awaitOperationStep(operation, () => this.init());
    await this.assertExplicitRequestNameIdentity(request, operation);
    const candidateRejections: CandidateRejectionAccumulator = new Map();

    const sajuReport = await this.awaitOperationStep(
      operation,
      () => this.getSajuReport(request),
    );
    if (requireSajuGuidedRecommendation && !isScorableSajuSummary(sajuReport)) {
      throw new CandidateSearchContractErrorV1(
        'SAJU_ANALYSIS_UNAVAILABLE',
        'Saju-guided candidate search requires a scorable natal chart.',
      );
    }
    onSajuReport?.(sajuReport);
    const sajuSummary: SajuSummary = sajuReport;
    const candidateGuidance = buildCandidateElementGuidanceV1(sajuSummary);
    const resolvedSajuPreset = this.resolveSajuPreset(request.options);
    const hasExplicitYongshinMode =
      request.options?.precisionConfig?.yongshinMode !== undefined;
    const candidateSajuPreset = requireSajuGuidedRecommendation
      && candidateGuidance.posture === 'conservative'
      && !hasExplicitYongshinMode
      ? {
          ...resolvedSajuPreset,
          scoringOverrides: {
            ...(resolvedSajuPreset.scoringOverrides ?? {}),
            yongshinMode: 'consensus_aware' as const,
          },
        }
      : resolvedSajuPreset;
    const { dist: sajuDistribution, output: sajuOutput } = buildSajuContext(sajuSummary, {
      includeTenGodByPosition: request.options?.precisionConfig?.tenGodMode === 'positional_weighted_v2',
    });

    const nameInputs = await this.awaitOperationStep(operation, () => this.collectNameInputs(
      request, nameInputPlan,
      sajuSummary, candidateRejections, operation,
    ));
    const paretoMode = shouldUseParetoFrontier(request.options);
    const paretoResults: SpringCandidateSummary[] = [];
    const maxVariantsPerHangul = requireSajuGuidedRecommendation
      ? CANDIDATE_HANJA_VARIANTS_PER_HANGUL
      : 1;
    const defaultResults = paretoMode
      ? null
      : new DefaultCandidateSummaryAccumulator(
          maxVariantsPerHangul,
          requireSajuGuidedRecommendation,
          requireSajuGuidedRecommendation ? CANDIDATE_PRESENTATION_SCORE_WINDOW : 0,
        );
    const hanjaPool = this.resolveHanjaPool(request.options);
    const surnameEntriesByForceHangul = new Map<boolean, HanjaEntry[]>();
    const surfaceNameTrend = request.options?.precisionConfig?.surfaceNameTrend === true;
    const surfacePhonetic =
      request.options?.precisionConfig?.surfacePhoneticEvidence === true;
    const surfaceScoreVector = this.shouldSurfaceNamingScoreVector(request.options);
    const needsSelectionEvidence = requireSajuGuidedRecommendation || surfaceScoreVector;
    const nameTrendByHangul = new Map<string, NameTrendAnalysis>();
    const phoneticByHangul = new Map<string, PhoneticAnalysis>();
    let evaluatedCandidateCount = 0;

    for (const collected of nameInputs) {
      const givenNameInput = collected.givenName;
      const nameStatInfo = collected.nameStat?.info ?? await this.awaitOperationStep(
        operation,
        () => this.getNameStatInfo(givenNameInput, operation),
      );
      const resolutionPolicy = this.resolveNameResolutionPolicy(
        givenNameInput,
        request.options,
      );
      const forceHangulSurname = resolutionPolicy.pureHangulGivenName
        && !resolutionPolicy.useSurnameHanjaInPureHangul;
      let surnameEntries = surnameEntriesByForceHangul.get(forceHangulSurname);
      if (!surnameEntries) {
        surnameEntries = await this.awaitOperationStep(operation, () => this.resolveEntries(
          request.surname,
          {
            forceHangulOnly: forceHangulSurname,
            isSurname: true,
            hanjaPool,
          },
          operation,
        ));
        surnameEntriesByForceHangul.set(forceHangulSurname, surnameEntries);
      }
      const givenNameEntries = await this.awaitOperationStep(operation, () => this.resolveEntries(givenNameInput, {
        forceHangulOnly: resolutionPolicy.pureHangulGivenName,
        hanjaPool,
      }, operation));

      const hangul = new HangulCalculator(surnameEntries, givenNameEntries, this.resolveHangulSignalCap(request.options), this.resolveHangulPolarityModel(request.options));
      const hanja  = new HanjaCalculator(
        surnameEntries,
        givenNameEntries,
        ENABLE_HANJA_NAME_EVALUATION && !resolutionPolicy.pureHangulGivenName,
      );
      const frame  = new FrameCalculator(
        surnameEntries,
        givenNameEntries,
        ENABLE_FOURFRAME_NAME_EVALUATION && !resolutionPolicy.pureHangulGivenName,
      );
      const hasSajuContext = Boolean(sajuOutput);
      const saju   = new SajuCalculator(
        surnameEntries,
        givenNameEntries,
        sajuDistribution,
        sajuOutput,
        {
          elementSource: resolutionPolicy.pureHangulGivenName ? 'hangul' : 'resource',
          enabled: hasSajuContext,
          ...candidateSajuPreset,
          evaluatorHints: this.resolveEvaluatorHints(request.birth, request.options, sajuOutput),
        },
      );

      const combinedCtx: EvalContext = {
        surnameLength: surnameEntries.length,
        givenLength:   givenNameEntries.length,
        luckyMap:      this.luckyMap,
        insights:      {},
      };
      const combined = springEvaluateName([hangul, hanja, frame, saju], combinedCtx);

      const allEntries = [...surnameEntries, ...givenNameEntries];
      const givenHangulKey = this.givenNameHangulKey(givenNameInput);
      let selectionNameTrend = nameTrendByHangul.get(givenHangulKey);
      if ((needsSelectionEvidence || surfaceNameTrend) && !selectionNameTrend) {
        selectionNameTrend = getNameTrendAnalysis(givenNameInput, request.birth);
        nameTrendByHangul.set(givenHangulKey, selectionNameTrend);
      }
      let selectionPhonetic = phoneticByHangul.get(givenHangulKey);
      if ((needsSelectionEvidence || surfacePhonetic) && !selectionPhonetic) {
        selectionPhonetic = getPhoneticAnalysis(request.surname, givenNameInput);
        phoneticByHangul.set(givenHangulKey, selectionPhonetic);
      }
      const nameTrend = surfaceNameTrend ? selectionNameTrend : undefined;
      const phonetic = surfacePhonetic ? selectionPhonetic : undefined;
      const vectorEvidence = needsSelectionEvidence
        ? {
            nameTrend: selectionNameTrend,
            phonetic: selectionPhonetic,
          }
        : {};
      const completeSelectionScoreVector = needsSelectionEvidence
        ? this.buildNamingScoreVector(
          combined,
          surnameEntries,
          givenNameEntries,
          hangul,
          hanja,
          frame,
          hanjaPool,
          vectorEvidence.nameTrend,
          vectorEvidence.phonetic,
        )
        : undefined;
      const meaningConfidence = requireSajuGuidedRecommendation
        ? computeRecommendationMeaningConfidence(givenNameEntries)
        : null;
      const selectionScoreVector = completeSelectionScoreVector
        ? {
            ...completeSelectionScoreVector,
            hanjaMeaning: meaningConfidence,
          }
        : undefined;
      const scoreVector = surfaceScoreVector ? completeSelectionScoreVector : undefined;
      const strengthProfile = scoreVector
        ? deriveCandidateStrengthProfile(scoreVector)
        : undefined;
      const summary: SpringCandidateSummary = {
        finalScore: roundScore(combined.score),
        ...(scoreVector ? { scoreVector } : {}),
        ...(strengthProfile ? { strengthProfile } : {}),
        ...(requireSajuGuidedRecommendation && selectionScoreVector
          ? {
              presentationEvidence: {
                meaningConfidence,
                popularityRank: nameStatInfo.popularityRank,
                phonetic: selectionScoreVector.phonetic,
                familyFit: selectionScoreVector.familyFit,
                eraFit: selectionScoreVector.eraFit,
                risk: selectionScoreVector.risk,
                meaningBasis: 'authored_gloss_safety_v1' as const,
                popularityBasis: 'local_official_name_stat' as const,
              },
            }
          : {}),
        fullHangul: allEntries.map(entry => entry.hangul).join(''),
        fullHanja: allEntries.map(entry => entry.hanja).join(''),
        givenHangul: givenNameEntries.map(entry => entry.hangul).join(''),
        givenName: givenNameEntries.map(entry => toNameCharInput(entry, hanjaPool)),
        popularityRank: nameStatInfo.popularityRank,
        maleRatio: nameStatInfo.maleRatio,
        nameGender: nameStatInfo.nameGender,
        ...(nameTrend ? { nameTrend } : {}),
        ...(phonetic ? { phonetic } : {}),
        rank: 0,
      };
      if (defaultResults) defaultResults.add(summary, selectionScoreVector);
      else paretoResults.push(summary);

      evaluatedCandidateCount += 1;
      if (evaluatedCandidateCount % CANDIDATE_EVALUATION_YIELD_INTERVAL === 0) {
        await this.awaitOperationStep(operation, yieldCandidateEvaluationTurn);
      }
    }

    const ordered = defaultResults
      ? defaultResults.finish()
      : retainCandidateSummaryVariantsByHangul(
          orderCandidateSummaries(
            paretoResults,
            request.options,
            CANDIDATE_SELECTION_LIMITS,
          ),
          maxVariantsPerHangul,
        );
    return this.completeOperation(
      operation,
      this.pageOrderedCandidates(ordered, request.options),
    );
  }

  /**
   * Mobile candidate-list boundary. Ranking remains SpringEngine-authoritative and
   * each row carries a stable name identity that can be continued directly
   * into getReportDelivery(). Multi-page reads reuse a bounded engine-session
   * snapshot so page 2 cannot silently come from a different ordering.
   */
  async getCandidateSearch(
    request: LocalCandidateSearchRequestV1,
    continuation?: CandidateSearchContinuationV1,
  ): Promise<CandidateSearchResponseV1> {
    request = snapshotCandidateSearchRequestV1(request);
    const candidateSearchPlan = this.buildNameInputPlan(request);
    const candidateSearchNameLength = request.givenNameLength
      ?? request.givenName?.length
      ?? 2;
    const candidateRecallGeneration = !candidateSearchPlan.hasGenerationConstraints
      && candidateSearchNameLength === 2
      ? 'official_name_stat_hangul_seed_plus_legal_hanja_generation' as const
      : 'legal_hanja_generation' as const;
    const orderingMode = request.options?.precisionConfig?.paretoFrontierCandidates === true
      ? 'pareto_frontier' as const
      : 'recommended' as const;
    const requestedNameLengths = [
      request.givenNameLength,
      request.givenName === undefined ? undefined : request.givenName.length,
    ];
    if (requestedNameLengths.some((length) => length !== undefined
      && (!Number.isSafeInteger(length) || length < 1 || length > 2))) {
      throw new CandidateSearchContractErrorV1(
        'UNSUPPORTED_RECOMMENDATION_NAME_LENGTH',
        'Automatic candidate recommendation currently supports 1-2 syllable given names. '
          + 'Explicit 3-4 syllable names remain available for naming and integrated reports.',
      );
    }
    if (request.options?.pureHangulNameMode === 'on') {
      throw new CandidateSearchContractErrorV1(
        'HANJA_REQUIRED_FOR_SAJU_GUIDED_RECOMMENDATION',
        'Saju-guided candidate recommendation requires canonical Hanja identity. '
          + 'Pure-Hangul exploration belongs to a separate name-only flow without natal ranking.',
      );
    }
    const { limit: _limit, offset: _offset, ...analysisOptions } = request.options ?? {};
    try {
      assertAnalysisOptionsContractV1(analysisOptions, Number(request.birth.year), {
        allowRemoteLunarConversion: false,
      });
    } catch (error) {
      if (error instanceof AnalysisOptionsContractError) {
        if (error.kind === 'REMOTE_FORBIDDEN') {
          throw new CandidateSearchContractErrorV1(
            'REMOTE_COMPUTATION_FORBIDDEN',
            'Free candidate search permits only the built-in offline lunar converter.',
          );
        }
        throw new CandidateSearchContractErrorV1(
          'INVALID_ANALYSIS_OPTIONS',
          `Candidate analysis options are invalid: ${error.detail}`,
        );
      }
      throw error;
    }
    const offset = request.options?.offset ?? DEFAULT_OFFSET;
    const requestedLimit = request.options?.limit ?? DEFAULT_LIMIT;
    if (continuation !== undefined
      && (continuation === null
        || typeof continuation !== 'object'
        || Array.isArray(continuation)
        || Object.keys(continuation).some((key) => key !== 'queryId')
        || typeof continuation.queryId !== 'string')) {
      throw new CandidateSearchContractErrorV1(
        'INVALID_QUERY_ID',
        'Candidate continuation must contain only a queryId.',
      );
    }
    if (offset > 0 && continuation === undefined) {
      throw new CandidateSearchContractErrorV1(
        'QUERY_ID_REQUIRED',
        'Candidate pages after the first require the engine-session queryId.',
      );
    }
    const requestKey = this.candidateSearchRequestKey(request);
    const provisionalQueryId = continuation?.queryId ?? createOpaqueCandidateQueryId();
    const provisionalQuery: CandidateSearchQueryV1 = {
      queryId: provisionalQueryId,
      scope: 'engine_session',
      expiresOn: 'engine_close_or_lru_eviction',
      maxBrowsableCandidates: CANDIDATE_SEARCH_SNAPSHOT_MAX_CANDIDATES,
      truncated: false,
      clientInstruction: 'reuse_query_id_for_every_page',
    };
    // Fail invalid or oversized mobile pages before repository/astronomy work.
    buildCandidateSearchResponseV1({
      summaries: [],
      offset,
      requestedLimit,
      query: provisionalQuery,
      candidateRecallGeneration,
      orderingMode,
      requireCanonicalHanja: true,
      natalEvidence: { status: 'ready', reasonCodes: [] },
    });

    let snapshot: CandidateSearchSnapshotV1;
    if (continuation) {
      snapshot = this.getCandidateSearchSnapshot(continuation.queryId, requestKey);
    } else {
      const retainedSnapshot = this.getCandidateSearchSnapshotByRequestKey(requestKey);
      if (retainedSnapshot) {
        snapshot = retainedSnapshot;
      } else {
        let natalEvidence: NatalEvidenceAssessmentV1 | undefined;
        const summariesWithLookahead = await this.getNameCandidateSummariesInternal({
          ...request,
          options: {
            ...(request.options ?? {}),
            offset: 0,
            limit: CANDIDATE_SEARCH_SNAPSHOT_MAX_CANDIDATES + 1,
          },
        }, true, (report) => {
          natalEvidence = assessNatalEvidenceV1(report);
        });
        const retainedNatalEvidence = natalEvidence ?? assessNatalEvidenceV1(null);
        const query: CandidateSearchQueryV1 = {
          ...provisionalQuery,
          truncated: summariesWithLookahead.length > CANDIDATE_SEARCH_SNAPSHOT_MAX_CANDIDATES,
        };
        snapshot = {
          query,
          requestKey,
          summaries: summariesWithLookahead.slice(0, CANDIDATE_SEARCH_SNAPSHOT_MAX_CANDIDATES),
          natalEvidence: retainedNatalEvidence,
        };
        this.cacheCandidateSearchSnapshot(snapshot);
      }
    }
    if (offset > snapshot.summaries.length) {
      throw new CandidateSearchContractErrorV1(
        'QUERY_OFFSET_OUT_OF_RANGE',
        'Candidate offset is outside the retained query snapshot.',
      );
    }
    const page = snapshot.summaries.slice(offset, offset + requestedLimit);
    const hasMore = offset + page.length < snapshot.summaries.length;
    return buildCandidateSearchResponseV1({
      summaries: page,
      offset,
      requestedLimit,
      hasMore,
      query: snapshot.query,
      candidateRecallGeneration,
      orderingMode,
      requireCanonicalHanja: true,
      natalEvidence: snapshot.natalEvidence,
    });
  }

  // -------------------------------------------------------------------------
  // buildNamingReport -- assemble a NamingReport from calculator results
  // -------------------------------------------------------------------------

  private buildNamingReport(
    surnameEntries: HanjaEntry[],
    givenNameEntries: HanjaEntry[],
    evalResult: EvaluationResult,
    hangul: HangulCalculator,
    hanja: HanjaCalculator,
    frame: FrameCalculator,
    hanjaPool: HanjaPool = 'curated',
    nameTrend?: NameTrendAnalysis,
    phonetic?: PhoneticAnalysis,
    scoreVector?: NamingScoreVector,
    strengthProfile?: CandidateStrengthProfile,
  ): NamingReport {
    const categoryMap = evalResult.categoryMap;
    const frames = frame.frames;

    const allEntries  = [...surnameEntries, ...givenNameEntries];
    const fullHangul  = allEntries.map(e => e.hangul).join('');
    const fullHanja   = allEntries.map(e => e.hanja).join('');

    const hangulScore = roundScore(
      ((categoryMap.HANGUL_ELEMENT?.score ?? 0) + (categoryMap.HANGUL_POLARITY?.score ?? 0)) / 2,
    );
    const hanjaScore = publicHanjaDetailScore(hanja);
    const fourFrameScore = roundScore(categoryMap.FOURFRAME_LUCK?.score ?? 0);

    const enrichedFrames: NamingReportFrame[] = frames.map((frame) => {
      return {
        type: frame.type,
        strokeSum: frame.strokeSum,
        element: frame.energy?.element.english ?? '',
        elementLabel: elementDisplayLabel(frame.energy?.element.english),
        polarity: frame.energy?.polarity.english ?? '',
        luckyLevel: bucketFromFortune(this.luckyMap.get(frame.strokeSum) ?? ''),
        // Frame construction already owns the canonical, name-specific and
        // immutable display DTO. Re-reading and sanitizing the same row here
        // multiplied service-text work for every hydrated candidate.
        meaning: frame.entry,
      };
    });

    const frameAnalysis = frame.getAnalysis();
    const sanitizedFrameAnalysis = sanitizeServiceValue(frameAnalysis.data, fullHangul);
    const luckScore = roundScore(categoryMap.FOURFRAME_LUCK?.score ?? 0);
    const explanation = scoreVector
      ? buildNamingExplanation({ evaluationResult: evalResult, scoreVector, strengthProfile })
      : undefined;

    return {
      name: {
        surname:    surnameEntries.map(entry => toCharDetail(entry, hanjaPool)),
        givenName:  givenNameEntries.map(entry => toCharDetail(entry, hanjaPool)),
        fullHangul,
        fullHanja,
      },
      totalScore: roundScore(evalResult.score),
      scores: {
        hangul: hangulScore,
        hanja: hanjaScore,
        fourFrame: fourFrameScore,
      },
      ...(scoreVector ? { scoreVector } : {}),
      ...(strengthProfile ? { strengthProfile } : {}),
      analysis: {
        hangul: hangul.getAnalysis().data,
        hanja: hanja.getAnalysis().data,
        fourFrame: {
          frames: enrichedFrames,
          elementScore: sanitizedFrameAnalysis.elementScore,
          luckScore,
        },
      },
      ...(nameTrend ? { nameTrend } : {}),
      ...(phonetic ? { phonetic } : {}),
      ...(explanation ? { explanation } : {}),
      interpretation: explanation?.summary ?? buildInterpretation(evalResult),
    };
  }

  // -------------------------------------------------------------------------
  // analyze -- the main public entry point (backward compatible)
  // -------------------------------------------------------------------------

  async analyze(request: SpringRequest): Promise<SpringResponse> {
    request = snapshotSpringRequest(request);
    this.assertSchoolPresetSelection(request.options);
    validateSajuConfigFortunePolicy(request.options?.sajuConfig);
    const operation = this.beginOperation('analyze');
    this.assertRequestNameSyntax(request, true);
    await this.awaitOperationStep(operation, () => this.init());
    await this.assertExplicitRequestNameIdentity(request, operation);
    const candidateRejections: CandidateRejectionAccumulator = new Map();

    // 1. Determine the operating mode
    const nameInputPlan = this.buildNameInputPlan(request);

    // 2. Run saju (four-pillar destiny) analysis on the birth data
    const sajuSummary = await this.awaitOperationStep(
      operation,
      () => analyzeSaju(request.birth, request.options),
    );
    const { dist: sajuDistribution, output: sajuOutput } = buildSajuContext(sajuSummary, {
      includeTenGodByPosition: request.options?.precisionConfig?.tenGodMode === 'positional_weighted_v2',
    });

    // 3. Build the list of name inputs to score
    const collectedNameInputs = await this.awaitOperationStep(operation, () => this.collectNameInputs(
      request, nameInputPlan,
      sajuSummary, candidateRejections, operation,
    ));
    const nameInputs = collectedNameInputs.map((collected) => collected.givenName);

    // 4. Score every candidate and rank by total score (descending)
    const scoredCandidates = await this.awaitOperationStep(operation, () => this.scoreAllCandidates(
      request.surname, nameInputs, sajuDistribution, sajuOutput, request.birth, request.options,
      this.resolveEvaluatorHints(request.birth, request.options, sajuOutput),
      operation,
    ));

    // 5. Paginate and return
    return this.completeOperation(
      operation,
      this.buildResponse(request, nameInputPlan.mode, sajuSummary, scoredCandidates, candidateRejections),
    );
  }

  // -------------------------------------------------------------------------
  // analyze() helper -- one shared interpretation of names and filters
  // -------------------------------------------------------------------------

  private buildNameInputPlan(request: SpringRequest): NameInputPlan {
    const givenName = request.givenName;
    const hasGivenName = Boolean(givenName?.length);
    const hasPartialGivenName = hasGivenName
      && request.givenNameLength !== undefined
      && givenName!.length < request.givenNameLength;
    const jamoFilters = givenName?.map((char) =>
      hasExplicitNameHanja(char) ? null : parseJamoFilter(char.hangul));
    const hasGenerationFilter = jamoFilters?.some((filter) => filter !== null) ?? false;
    const hasGenerationConstraints = hasPartialGivenName
      || (givenName?.some((char) => !hasExplicitNameHanja(char)) ?? false);
    const allExplicitHanja = hasGivenName
      && givenName!.every(hasExplicitNameHanja);
    const allLiteralHangul = hasGivenName
      && !hasGenerationFilter
      && givenName!.every((char) => !hasExplicitNameHanja(char));
    const pureHangulMode = this.resolvePureHangulMode(request.options);
    const mode = request.mode && request.mode !== 'auto'
      ? request.mode
      : !hasPartialGivenName
          && (allExplicitHanja || (pureHangulMode === 'on' && allLiteralHangul))
        ? 'evaluate'
        : 'recommend';
    const includeOriginalName = !hasPartialGivenName
      && (allExplicitHanja
        || (allLiteralHangul && (pureHangulMode === 'on' || mode === 'evaluate')));

    return {
      mode,
      jamoFilters,
      hasGenerationConstraints,
      includeOriginalName,
    };
  }

  // -------------------------------------------------------------------------
  // analyze() helper -- gather name inputs depending on mode
  // -------------------------------------------------------------------------

  private canonicalizePureHangulCandidates(
    candidates: readonly NameCharInput[][],
  ): NameCharInput[][] {
    const unique = new Map<string, NameCharInput[]>();
    for (const candidate of candidates) {
      const canonical = candidate.map((char) => ({ hangul: char.hangul }));
      const key = canonical.map((char) => char.hangul).join('\u0000');
      if (!unique.has(key)) unique.set(key, canonical);
    }
    return [...unique.values()];
  }

  private async collectNameInputs(
    request: SpringRequest,
    plan: NameInputPlan,
    sajuSummary: SajuSummary,
    candidateRejections: CandidateRejectionAccumulator,
    operation: SpringEngineOperationLease,
  ): Promise<CollectedNameInput[]> {
    if (plan.mode === 'evaluate') {
      return [{ givenName: request.givenName! }];
    }

    // Recommend or all mode -- generate candidates
    if (plan.mode === 'recommend' || plan.mode === 'all') {
      let candidates = await this.awaitOperationStep(operation, () => this.generateCandidates(
        request,
        sajuSummary,
        plan.hasGenerationConstraints ? [...(plan.jamoFilters ?? [])] : undefined,
        candidateRejections,
        operation,
      ));

      if (plan.includeOriginalName) {
        candidates.unshift(request.givenName!);
      }

      if (this.resolvePureHangulMode(request.options) === 'on') {
        candidates = this.canonicalizePureHangulCandidates(candidates);
      }

      return this.awaitOperationStep(
        operation,
        () => this.enrichCandidatesWithNameStat(candidates, operation),
      );
    }

    return [];
  }

  private givenNameHangulKey(givenName: NameCharInput[]): string {
    return givenName.map((char) => String(char?.hangul ?? '')).join('').trim();
  }

  private async getNameStatInfo(
    givenName: NameCharInput[],
    operation: SpringEngineOperationLease = this.beginOperation('name-stat-lookup'),
  ): Promise<NameStatLookupResult> {
    this.assertActiveOperation(operation.generation, operation.operation);
    const key = this.givenNameHangulKey(givenName);
    if (!key) {
      return NAME_STAT_NOT_FOUND;
    }

    const cached = this.cacheGetNameStatInfo(key);
    if (cached) return cached;

    let found: NameStatSourceProjection | null;
    try {
      found = await this.awaitOperationStep(
        operation,
        () => this.nameStatRepo.findByName(key),
      );
    } catch (cause) {
      this.assertActiveOperation(operation.generation, operation.operation);
      if (
        cause instanceof RepositoryDataError
        || cause instanceof RepositoryDatabaseIntegrityError
        || cause instanceof NameStatSummaryIntegrityError
      ) {
        throw cause;
      }
      // Infrastructure failures must not become a durable "name does not
      // exist" decision. Do not cache this path, so a later request can retry.
      throw new NameStatLookupUnavailableError(cause);
    }
    this.assertActiveOperation(operation.generation, operation.operation);

    if (!found) {
      this.cacheSetNameStatInfo(key, NAME_STAT_NOT_FOUND);
      return NAME_STAT_NOT_FOUND;
    }

    // Contract/integrity errors remain non-retryable; only repository access
    // failures above are wrapped as infrastructure.
    const info = Object.freeze(toFoundNameStatLookupResult(found));
    this.cacheSetNameStatInfo(key, info);
    return info;
  }

  // LRU helpers for nameStatInfoCache.
  // The Map preserves insertion order, so re-inserting an entry on hit keeps
  // hot keys at the recent end; the bounded set drops only the oldest entry
  // when the limit is exceeded. This avoids unbounded growth across the up
  // to MAX_CANDIDATES (50000) candidates a single recommendation pass can
  // touch.

  private cacheGetNameStatInfo(key: string): NameStatLookupResult | undefined {
    const value = this.nameStatInfoCache.get(key);
    if (value === undefined) return undefined;
    this.nameStatInfoCache.delete(key);
    this.nameStatInfoCache.set(key, value);
    return value;
  }

  private cacheSetNameStatInfo(key: string, value: NameStatLookupResult): void {
    if (this.nameStatInfoCache.has(key)) {
      this.nameStatInfoCache.delete(key);
    } else if (this.nameStatInfoCache.size >= NAME_STAT_INFO_CACHE_LIMIT) {
      const oldest = this.nameStatInfoCache.keys().next().value;
      if (oldest !== undefined) this.nameStatInfoCache.delete(oldest);
    }
    this.nameStatInfoCache.set(key, value);
  }

  /**
   * Attaches official usage evidence without turning absence or a statistical
   * gender tendency into an admission gate. New, rare, and cross-gender names
   * remain eligible for the normal legal, safety, and scoring policies.
   */
  private async enrichCandidatesWithNameStat(
    nameInputs: NameCharInput[][],
    operation: SpringEngineOperationLease = this.beginOperation('name-stat-lookup'),
  ): Promise<CollectedNameInput[]> {
    const enriched: CollectedNameInput[] = [];
    // Hanja variants of one Hangul name share the same official usage
    // evidence. Keep that evidence request-local so a pool larger than the
    // session LRU cannot make repeated variants churn and re-await the same
    // lookup. This changes neither candidate admission nor the attached value.
    const infoByGivenNameKey = new Map<string, NameStatLookupResult>();
    let inspectedCandidateCount = 0;
    for (const givenNameInput of nameInputs) {
      if (
        inspectedCandidateCount > 0
        && inspectedCandidateCount % CANDIDATE_NAME_STAT_YIELD_INTERVAL === 0
      ) {
        await this.awaitOperationStep(operation, yieldCandidateEvaluationTurn);
      }
      inspectedCandidateCount += 1;
      const givenNameKey = this.givenNameHangulKey(givenNameInput);
      let info = infoByGivenNameKey.get(givenNameKey);
      if (info === undefined) {
        info = await this.awaitOperationStep(
          operation,
          () => this.getNameStatInfo(givenNameInput, operation),
        );
        infoByGivenNameKey.set(givenNameKey, info);
      }
      enriched.push({
        givenName: givenNameInput,
        nameStat: {
          givenNameKey,
          info,
        },
      });
    }
    return enriched;
  }

  // -------------------------------------------------------------------------
  // analyze() helper -- score all candidates and sort
  // -------------------------------------------------------------------------

  private async scoreAllCandidates(
    surname: NameCharInput[],
    nameInputs: NameCharInput[][],
    sajuDistribution: Record<ElementKey, number>,
    sajuOutput: SajuOutputSummary | null,
    birth: BirthInfo,
    requestOptions?: SpringRequest['options'],
    evaluatorHints?: SajuEvaluatorHints,
    operation: SpringEngineOperationLease = this.beginOperation('analyze'),
  ): Promise<SpringCandidate[]> {
    const scored: SpringCandidate[] = [];

    for (const givenNameInput of nameInputs) {
      scored.push(
        await this.scoreCandidate(
          surname,
          givenNameInput,
          sajuDistribution,
          sajuOutput,
          birth,
          requestOptions,
          evaluatorHints,
          operation,
        ),
      );
    }

    return orderSpringCandidates(scored, requestOptions, CANDIDATE_SELECTION_LIMITS);
  }

  // -------------------------------------------------------------------------
  // analyze() helper -- paginate and assemble the final response
  // -------------------------------------------------------------------------

  private buildResponse(
    request: SpringRequest,
    mode: 'evaluate' | 'recommend' | 'all',
    sajuSummary: SajuSummary,
    scoredCandidates: SpringCandidate[],
    candidateRejections: CandidateRejectionAccumulator = new Map(),
  ): SpringResponse {
    const offset = request.options?.offset ?? DEFAULT_OFFSET;
    const limit  = request.options?.limit  ?? DEFAULT_LIMIT;

    const page = sliceAndRankCandidatePage(scoredCandidates, offset, limit);

    return {
      request,
      mode,
      saju: sajuSummary,
      candidates: page,
      totalCount: scoredCandidates.length,
      meta: {
        version: ENGINE_VERSION,
        timestamp: new Date().toISOString(),
        hanjaPool: this.resolveHanjaPool(request.options),
        schoolPreset: this.resolveSchoolPresetMeta(request.options),
        candidateRejections: this.candidateRejectionSummary(candidateRejections),
        sajuAnalysis: {
          enabled: isScorableSajuSummary(sajuSummary),
          generationMode: isScorableSajuSummary(sajuSummary) ? 'saju_guided' : 'name_only',
          ...(sajuSummary.analysisStatus ? { status: sajuSummary.analysisStatus } : {}),
          ...(sajuSummary.diagnostics?.length ? { diagnostics: sajuSummary.diagnostics } : {}),
        },
      },
    };
  }

  // -------------------------------------------------------------------------
  // scoreCandidate -- evaluate one surname + given-name combination
  // -------------------------------------------------------------------------

  private async scoreCandidate(
    surname: NameCharInput[],
    givenName: NameCharInput[],
    sajuDistribution: Record<ElementKey, number>,
    sajuOutput: SajuOutputSummary | null,
    birth: BirthInfo,
    requestOptions?: SpringRequest['options'],
    evaluatorHints?: SajuEvaluatorHints,
    operation: SpringEngineOperationLease = this.beginOperation('analyze'),
  ): Promise<SpringCandidate> {
    const resolutionPolicy = this.resolveNameResolutionPolicy(givenName, requestOptions);
    const hanjaPool = this.resolveHanjaPool(requestOptions);
    const surnameEntries = await this.resolveEntries(surname, {
      forceHangulOnly: resolutionPolicy.pureHangulGivenName
        && !resolutionPolicy.useSurnameHanjaInPureHangul,
      isSurname: true,
      hanjaPool,
    }, operation);
    const givenNameEntries = await this.resolveEntries(givenName, {
      forceHangulOnly: resolutionPolicy.pureHangulGivenName,
      hanjaPool,
    }, operation);

    // Build one calculator per scoring category
    const hangul = new HangulCalculator(surnameEntries, givenNameEntries, this.resolveHangulSignalCap(requestOptions), this.resolveHangulPolarityModel(requestOptions));
    const hanja  = new HanjaCalculator(
      surnameEntries,
      givenNameEntries,
      ENABLE_HANJA_NAME_EVALUATION && !resolutionPolicy.pureHangulGivenName,
    );
    const frame  = new FrameCalculator(
      surnameEntries,
      givenNameEntries,
      ENABLE_FOURFRAME_NAME_EVALUATION && !resolutionPolicy.pureHangulGivenName,
    );
    const hasSajuContext = Boolean(sajuOutput);
    const saju   = new SajuCalculator(
      surnameEntries,
      givenNameEntries,
      sajuDistribution,
      sajuOutput,
      {
        elementSource: resolutionPolicy.pureHangulGivenName ? 'hangul' : 'resource',
        enabled: hasSajuContext,
        ...this.resolveSajuPreset(requestOptions),
        evaluatorHints,
      },
    );

    // Evaluate all calculators together
    const evalContext: EvalContext = {
      surnameLength: surnameEntries.length,
      givenLength:   givenNameEntries.length,
      luckyMap:      this.luckyMap,
      insights:      {},
    };

    const evaluationResult = springEvaluateName([hangul, hanja, frame, saju], evalContext);
    const categoryMap      = evaluationResult.categoryMap;

    // Assemble the full name strings
    const allEntries  = [...surnameEntries, ...givenNameEntries];
    const fullHangul  = allEntries.map(entry => entry.hangul).join('');
    const fullHanja   = allEntries.map(entry => entry.hanja).join('');
    const nameTrend = this.resolveNameTrend(givenName, birth, requestOptions);
    const phonetic = this.resolvePhoneticAnalysis(surname, givenName, requestOptions);
    const vectorEvidence = this.resolveNamingScoreVectorEvidence(
      surname,
      givenName,
      birth,
      requestOptions,
      nameTrend,
      phonetic,
    );
    const scoreVector = this.shouldSurfaceNamingScoreVector(requestOptions)
      ? this.buildNamingScoreVector(
        evaluationResult,
        surnameEntries,
        givenNameEntries,
        hangul,
        hanja,
        frame,
        hanjaPool,
        vectorEvidence.nameTrend,
        vectorEvidence.phonetic,
      )
      : undefined;
    const strengthProfile = scoreVector
      ? deriveCandidateStrengthProfile(scoreVector)
      : undefined;
    const explanation = scoreVector
      ? buildNamingExplanation({ evaluationResult, scoreVector, strengthProfile })
      : undefined;

    // Compute category sub-scores (average of related frames)
    const hangulScore = roundScore(
      ((categoryMap.HANGUL_ELEMENT?.score ?? 0) + (categoryMap.HANGUL_POLARITY?.score ?? 0)) / 2,
    );
    const hanjaScore = publicHanjaDetailScore(hanja);
    const sanitizedFourFrameAnalysis = sanitizeServiceValue(frame.getAnalysis().data, fullHangul);

    return {
      name: {
        surname:    surnameEntries.map(entry => toCharDetail(entry, hanjaPool)),
        givenName:  givenNameEntries.map(entry => toCharDetail(entry, hanjaPool)),
        fullHangul,
        fullHanja,
      },
      scores: {
        total:     roundScore(evaluationResult.score),
        hangul:    hangulScore,
        hanja:     hanjaScore,
        fourFrame: roundScore(categoryMap.FOURFRAME_LUCK?.score ?? 0),
        saju:      roundScore(categoryMap[SAJU_FRAME]?.score ?? 0),
      },
      ...(scoreVector ? { scoreVector } : {}),
      ...(strengthProfile ? { strengthProfile } : {}),
      ...(explanation ? { explanation } : {}),
      analysis: {
        hangul:    hangul.getAnalysis().data,
        hanja:     hanja.getAnalysis().data,
        fourFrame: sanitizedFourFrameAnalysis,
        saju:      saju.getAnalysis().data,
        ...(nameTrend ? { nameTrend } : {}),
        ...(phonetic ? { phonetic } : {}),
      },
      interpretation: explanation?.summary ?? buildInterpretation(evaluationResult),
      rank: 0,
    };
  }

  // -------------------------------------------------------------------------
  // generateCandidates -- produce an array of name-char combinations
  //
  // Two strategies depending on input:
  //   1. Stroke-based (no jamo filter, 1-2 char names):
  //      Uses the FourFrameOptimizer to find stroke combinations that
  //      produce lucky four-frame numbers, then picks hanja per stroke.
  //   2. Jamo-based (jamo filter present, or 3+ char names):
  //      Builds per-position pools and explores all combinations via DFS.
  // -------------------------------------------------------------------------

  private async generateCandidates(
    request: SpringRequest,
    sajuSummary: SajuSummary,
    jamoFilters?: (JamoFilter | null)[],
    candidateRejections: CandidateRejectionAccumulator = new Map(),
    operation: SpringEngineOperationLease = this.beginOperation('getNameCandidates'),
  ): Promise<NameCharInput[][]> {
    const hanjaPool      = this.resolveHanjaPool(request.options);
    const pureHangulGeneration = this.resolvePureHangulMode(request.options) === 'on';
    const surnameEntries = await this.resolveEntries(request.surname, {
      forceHangulOnly: pureHangulGeneration
        && !(request.options?.useSurnameHanjaInPureHangul
          ?? DEFAULT_USE_SURNAME_HANJA_IN_PURE),
      isSurname: true,
      hanjaPool,
    }, operation);
    const nameLength     = request.givenNameLength ?? jamoFilters?.length ?? 2;
    const hasPositionConstraints = jamoFilters !== undefined;

    const guidance = buildCandidateElementGuidanceV1(sajuSummary);
    const targetElements = new Set(guidance.preferredElements);
    const elementPreferenceStrength = guidance.preferenceStrength;

    // Build per-position character pools
    const pools = await this.buildPositionPools(
      request, nameLength, jamoFilters, hasPositionConstraints,
      surnameEntries, targetElements, elementPreferenceStrength,
      hanjaPool, candidateRejections,
      operation,
    );

    // Choose the generation strategy
    const useStrokeStrategy = !hasPositionConstraints && nameLength <= 2;

    const generated = useStrokeStrategy
      ? this.generateViaStrokeOptimizer(surnameEntries, pools, nameLength, hanjaPool)
      : this.generateViaDepthFirstSearch(pools, nameLength, hanjaPool);
    const popularHangulSeeds = !pureHangulGeneration
      && !hasPositionConstraints
      && nameLength === 2
      ? await this.generatePopularHangulSeedCandidates(
          nameLength,
          targetElements,
          elementPreferenceStrength,
          hanjaPool,
          candidateRejections,
          operation,
        )
      : [];
    const unique = new Map<string, NameCharInput[]>();
    for (const candidate of [...popularHangulSeeds, ...generated]) {
      const key = candidate
        .map((character) => `${character.hangul}\u0000${character.hanja ?? ''}`)
        .join('\u0001');
      if (!unique.has(key)) unique.set(key, candidate);
      if (unique.size >= MAX_CANDIDATES) break;
    }
    const internallyDiverse = this.filterInternallyRepeatedCandidates(
      [...unique.values()],
      candidateRejections,
    );
    return this.filterGeneratedCandidatesByLegalStatus(internallyDiverse, candidateRejections);
  }

  /**
   * Restores practical-name recall that stroke-first generation cannot provide.
   *
   * The compact official name-stat asset supplies a bounded Hangul universe.
   * Each syllable is then expanded only through the local legal-Hanja
   * repository, and every resulting full name still passes the normal
   * saju/naming calculators. This is recall seeding, never a score shortcut.
   */
  private async generatePopularHangulSeedCandidates(
    nameLength: number,
    targetElements: ReadonlySet<string>,
    elementPreferenceStrength: CandidateElementPreferenceStrength,
    hanjaPool: HanjaPool,
    candidateRejections: CandidateRejectionAccumulator,
    operation: SpringEngineOperationLease,
  ): Promise<NameCharInput[][]> {
    const repository = this.nameStatRepo as NameStatSummaryRepository & {
      findTopRankedNames?: NameStatSummaryRepository['findTopRankedNames'];
    };
    if (typeof repository.findTopRankedNames !== 'function') return [];
    const rankedNames = await this.awaitOperationStep(
      operation,
      () => repository.findTopRankedNames!({
        // Birth gender is not an admission rule for names. Seed from total
        // usage, then expose tendency only as descriptive evidence.
        gender: 'neutral',
        hangulLength: nameLength,
        limit: CANDIDATE_HANGUL_SEED_NAME_LIMIT,
      }),
    );
    const entriesBySyllable = new Map<string, HanjaEntry[]>();
    const seeds: NameCharInput[][] = [];

    for (const rankedName of rankedNames) {
      const syllables = Array.from(rankedName.name);
      if (syllables.length !== nameLength) continue;
      const positionPools: HanjaEntry[][] = [];
      for (const syllable of syllables) {
        let entries = entriesBySyllable.get(syllable);
        if (!entries) {
          const resolved = await this.resolveFixedCharPool(
            { hangul: syllable },
            hanjaPool,
            false,
            64,
            operation,
          );
          entries = this.orderCandidateGenerationPool(
            this.filterPresentationSafeEntries(
              resolved.filter((entry) => hasHanIdeograph(entry.hanja)),
              hanjaPool,
              candidateRejections,
            ),
            targetElements,
            elementPreferenceStrength,
          ).slice(0, CANDIDATE_HANJA_VARIANTS_PER_SEED_SYLLABLE);
          entriesBySyllable.set(syllable, entries);
        }
        positionPools.push(entries);
      }
      if (positionPools.some((pool) => pool.length === 0)) continue;

      let variantsForName = 0;
      const expand = (position: number, selected: HanjaEntry[]): void => {
        if (variantsForName >= CANDIDATE_SEED_VARIANTS_PER_NAME) return;
        if (position === positionPools.length) {
          variantsForName += 1;
          seeds.push(selected.map((entry) => toNameCharInput(entry, hanjaPool)));
          return;
        }
        for (const entry of positionPools[position]!) {
          if (selected.some((prior) => prior.hanja === entry.hanja)) continue;
          expand(position + 1, [...selected, entry]);
          if (variantsForName >= CANDIDATE_SEED_VARIANTS_PER_NAME) break;
        }
      };
      expand(0, []);
    }
    return seeds;
  }

  private filterGeneratedCandidatesByLegalStatus(
    candidates: NameCharInput[][],
    candidateRejections: CandidateRejectionAccumulator,
  ): NameCharInput[][] {
    const filtered: NameCharInput[][] = [];
    for (const candidate of candidates) {
      const rejected = candidate.find((char) =>
        hasExplicitNameHanja(char)
          && char.legalStatus !== 'allowed'
          && char.legalStatus !== 'variantAllowed');
      if (rejected) {
        this.recordCandidateRejection(
          candidateRejections,
          'outside_legal_hanja_pool',
          rejected,
          'Candidate removed before scoring because its raw Hanja-reading pair is absent from the official legal lookup.',
        );
        continue;
      }
      filtered.push(candidate);
    }
    return filtered;
  }

  // -------------------------------------------------------------------------
  // Strategy 1: Stroke-based generation
  //
  // The optimizer pre-filters which stroke counts produce lucky four-frame
  // numbers. For each valid stroke combination, we pick the top characters
  // from the pool keyed by stroke count.
  // -------------------------------------------------------------------------

  private generateViaStrokeOptimizer(
    surnameEntries: HanjaEntry[],
    pools: Map<number, HanjaEntry[]>,
    nameLength: number,
    hanjaPool: HanjaPool,
  ): NameCharInput[][] {
    const surnameStrokes = surnameEntries.map(entry => entry.strokes);
    const validStrokeCombinations = this.optimizer!.getValidCombinations(surnameStrokes, nameLength);
    const results: NameCharInput[][] = [];

    for (const strokeKey of validStrokeCombinations) {
      if (results.length >= MAX_CANDIDATES) break;

      const strokeCounts = strokeKey.split(',').map(Number);

      if (nameLength === 1) {
        this.appendSingleCharCandidates(results, pools, strokeCounts[0], hanjaPool);
      } else {
        this.appendDoubleCharCandidates(results, pools, strokeCounts, hanjaPool);
      }
    }

    return results;
  }

  /** For single-character given names: pick top characters at a stroke count. */
  private appendSingleCharCandidates(
    results: NameCharInput[][],
    pools: Map<number, HanjaEntry[]>,
    strokeCount: number,
    hanjaPool: HanjaPool,
  ): void {
    const candidates = (pools.get(strokeCount) ?? []).slice(0, POOL_LIMIT_SINGLE_CHAR);

    for (const candidate of candidates) {
      results.push([toNameCharInput(candidate, hanjaPool)]);
      if (results.length >= MAX_CANDIDATES) break;
    }
  }

  /** For two-character given names: cross-join top characters from two stroke pools. */
  private appendDoubleCharCandidates(
    results: NameCharInput[][],
    pools: Map<number, HanjaEntry[]>,
    strokeCounts: number[],
    hanjaPool: HanjaPool,
  ): void {
    const firstPositionCandidates  = (pools.get(strokeCounts[0]) ?? []).slice(0, POOL_LIMIT_DOUBLE_CHAR);
    const secondPositionCandidates = (pools.get(strokeCounts[1]) ?? []).slice(0, POOL_LIMIT_DOUBLE_CHAR);

    for (const firstChar of firstPositionCandidates) {
      for (const secondChar of secondPositionCandidates) {
        if (firstChar.hanja === secondChar.hanja) continue; // skip identical hanja
        results.push([
          toNameCharInput(firstChar, hanjaPool),
          toNameCharInput(secondChar, hanjaPool),
        ]);
        if (results.length >= MAX_CANDIDATES) return;
      }
      if (results.length >= MAX_CANDIDATES) return;
    }
  }

  // -------------------------------------------------------------------------
  // Strategy 2: Depth-first search generation
  //
  // Used when jamo filters are present or the given name has 3+ characters.
  // Pools are keyed by positional index (0, 1, 2, ...) rather than stroke.
  // -------------------------------------------------------------------------

  private generateViaDepthFirstSearch(
    pools: Map<number, HanjaEntry[]>,
    nameLength: number,
    hanjaPool: HanjaPool,
  ): NameCharInput[][] {
    const positionPools = Array.from(
      { length: nameLength },
      (_, position) => pools.get(position) ?? [],
    );
    const results: NameCharInput[][] = [];

    const explore = (depth: number, current: HanjaEntry[]): void => {
      if (results.length >= MAX_CANDIDATES) return;

      if (depth >= nameLength) {
        results.push(current.map(entry => toNameCharInput(entry, hanjaPool)));
        return;
      }

      for (const candidate of positionPools[depth]) {
        // Skip if the same hanja character already appears in the combination
        if (candidate.hanja.length > 0
          && current.some(existing => existing.hanja === candidate.hanja)) {
          continue;
        }
        explore(depth + 1, [...current, candidate]);
      }
    };

    explore(0, []);
    return results;
  }

  // -------------------------------------------------------------------------
  // buildPositionPools -- prepare hanja options for each name position
  //
  // Two modes:
  //   Stroke mode (no jamo, <= 2 chars): pools keyed by stroke count
  //   Jamo mode (jamo filter or 3+ chars): pools keyed by position index
  // -------------------------------------------------------------------------

  private orderCandidateGenerationPool(
    entries: readonly HanjaEntry[],
    targetElements: ReadonlySet<string>,
    elementPreferenceStrength: CandidateElementPreferenceStrength,
  ): HanjaEntry[] {
    // The positive-pattern list is an authored presentation heuristic, not an
    // authority to reject a legal Hanja. Prefer reviewed-positive glosses in a
    // bounded pool, then retain every otherwise safe/decodable entry.
    const reviewedPositive: HanjaEntry[] = [];
    const unreviewedMeaning: HanjaEntry[] = [];
    for (const entry of entries) {
      (hasWeakRecommendationHanjaMeaning(entry)
        ? unreviewedMeaning
        : reviewedPositive).push(entry);
    }
    return [
      ...orderCandidatePoolByElementPreference(
        reviewedPositive,
        targetElements,
        elementPreferenceStrength,
        (entry) => entry.resource_element,
      ),
      ...orderCandidatePoolByElementPreference(
        unreviewedMeaning,
        targetElements,
        elementPreferenceStrength,
        (entry) => entry.resource_element,
      ),
    ];
  }

  private async buildPositionPools(
    request: SpringRequest,
    nameLength: number,
    jamoFilters: (JamoFilter | null)[] | undefined,
    hasPositionConstraints: boolean,
    surnameEntries: HanjaEntry[],
    targetElements: Set<string>,
    elementPreferenceStrength: CandidateElementPreferenceStrength,
    hanjaPool: HanjaPool,
    candidateRejections: CandidateRejectionAccumulator,
    operation: SpringEngineOperationLease,
  ): Promise<Map<number, HanjaEntry[]>> {
    const useStrokeMode = !hasPositionConstraints && nameLength <= 2;

    return useStrokeMode
      ? this.buildStrokeBasedPools(
          surnameEntries, nameLength, targetElements, elementPreferenceStrength,
          hanjaPool, candidateRejections,
        )
      : this.buildJamoBasedPools(
          request, nameLength, jamoFilters, targetElements,
          elementPreferenceStrength, hanjaPool,
          candidateRejections, operation,
        );
  }

  private async findGenerationPoolByStrokeRange(
    min: number,
    max: number,
    hanjaPool: HanjaPool,
  ): Promise<HanjaEntry[]> {
    if (hanjaPool === 'curated') {
      return this.hanjaRepo.findByStrokeRange(min, max);
    }
    return (await loadFullHanjaPoolEntries())
      .filter((entry) => entry.strokes >= min && entry.strokes <= max);
  }

  // -------------------------------------------------------------------------
  // Pool builder: stroke-based
  //
  // 1. Ask the optimizer which stroke-count combinations are valid.
  // 2. Fetch all hanja in the needed stroke range.
  // 3. Group by stroke count, excluding surname-only rows.
  // 4. Apply the evidence-calibrated role preference without hard exclusion.
  // -------------------------------------------------------------------------

  private async buildStrokeBasedPools(
    surnameEntries: HanjaEntry[],
    nameLength: number,
    targetElements: Set<string>,
    elementPreferenceStrength: CandidateElementPreferenceStrength,
    hanjaPool: HanjaPool,
    candidateRejections: CandidateRejectionAccumulator,
  ): Promise<Map<number, HanjaEntry[]>> {
    const surnameStrokes = surnameEntries.map(entry => entry.strokes);
    const validCombinations = this.optimizer!.getValidCombinations(surnameStrokes, nameLength);

    // Collect every stroke count that appears in a valid combination
    const neededStrokes = new Set<number>();
    for (const key of validCombinations) {
      for (const part of key.split(',')) {
        neededStrokes.add(Number(part));
      }
    }

    // Fetch hanja in bulk for the needed stroke range
    const allHanja = await this.findGenerationPoolByStrokeRange(
      Math.min(...neededStrokes),
      Math.max(...neededStrokes),
      hanjaPool,
    );

    // A resource element can guide ordering, but harmful-role evidence stays
    // in the full-name scorer rather than deleting a character in advance.
    const pools = new Map<number, HanjaEntry[]>();

    for (const hanjaEntry of this.filterPresentationSafeEntries(
      allHanja,
      hanjaPool,
      candidateRejections,
    )) {
      if (hanjaEntry.is_surname) continue;
      if (!neededStrokes.has(hanjaEntry.strokes)) continue;

      let bucket = pools.get(hanjaEntry.strokes);
      if (!bucket) {
        bucket = [];
        pools.set(hanjaEntry.strokes, bucket);
      }
      bucket.push(hanjaEntry);
    }

    // Ready evidence uses role-preferred characters first. Limited evidence
    // interleaves preferred and neutral characters so bounded pools retain
    // viable alternatives from outside the uncertain yongshin conclusion.
    for (const [strokeCount, bucket] of pools) {
      pools.set(strokeCount, this.orderCandidateGenerationPool(
        bucket,
        targetElements,
        elementPreferenceStrength,
      ));
    }

    return pools;
  }

  // -------------------------------------------------------------------------
  // Pool builder: jamo-based (or 3+ character names)
  //
  // Each position is resolved independently:
  //   - If the user pinned a specific hanja or hangul, use that directly.
  //   - Otherwise, filter the full hanja set by jamo onset/nucleus and
  //     sort by target-element affinity.
  // -------------------------------------------------------------------------

  private async buildJamoBasedPools(
    request: SpringRequest,
    nameLength: number,
    jamoFilters: (JamoFilter | null)[] | undefined,
    targetElements: Set<string>,
    elementPreferenceStrength: CandidateElementPreferenceStrength,
    hanjaPool: HanjaPool,
    candidateRejections: CandidateRejectionAccumulator,
    operation: SpringEngineOperationLease,
  ): Promise<Map<number, HanjaEntry[]>> {
    // Pre-load the full Hanja pool. Harmful-role evidence is evaluated after
    // full-name construction instead of deleting a character by one element.
    const fullPool = this.filterPresentationSafeEntries(
      await this.findGenerationPoolByStrokeRange(STROKE_MIN, STROKE_MAX, hanjaPool),
      hanjaPool,
      candidateRejections,
    ).filter(entry => !entry.is_surname);

    const pools = new Map<number, HanjaEntry[]>();

    for (let position = 0; position < nameLength; position++) {
      const jamoFilter    = jamoFilters?.[position];
      const givenNameChar = request.givenName?.[position];

      // Case A: no jamo filter at this position and user supplied a character
      if (jamoFilter === null && givenNameChar) {
        const allowHangulFallback = request.options?.pureHangulNameMode === 'on'
          && !hasExplicitNameHanja(givenNameChar);
        const fixedEntries = await this.resolveFixedCharPool(
          givenNameChar,
          hanjaPool,
          allowHangulFallback,
          Number.MAX_SAFE_INTEGER,
          operation,
        );
        const safeHanjaEntries = this.filterPresentationSafeEntries(
          fixedEntries.filter((entry) => hasHanIdeograph(entry.hanja)),
          hanjaPool,
          candidateRejections,
        ).slice(0, POOL_LIMIT_SINGLE_CHAR);
        const pureHangulEntries = allowHangulFallback
          ? fixedEntries
              .filter((entry) => !hasHanIdeograph(entry.hanja))
              .slice(0, POOL_LIMIT_SINGLE_CHAR)
          : [];
        pools.set(position, [...safeHanjaEntries, ...pureHangulEntries]);
        continue;
      }

      // Case B: filter the full pool by jamo onset/nucleus, then take top N
      let filtered = fullPool;
      if (jamoFilter?.onset)   filtered = filtered.filter(entry => entry.onset === jamoFilter.onset);
      if (jamoFilter?.nucleus) filtered = filtered.filter(entry => entry.nucleus === jamoFilter.nucleus);

      filtered = this.orderCandidateGenerationPool(
        filtered,
        targetElements,
        elementPreferenceStrength,
      );

      pools.set(position, filtered.slice(0, POOL_LIMIT_JAMO_FILTERED));
    }

    return pools;
  }

  /** Resolve a single user-specified character into a 1-element pool. */
  private async resolveFixedCharPool(
    givenNameChar: NameCharInput,
    hanjaPool: HanjaPool,
    allowHangulFallback = false,
    poolLimit = POOL_LIMIT_SINGLE_CHAR,
    operation?: SpringEngineOperationLease,
  ): Promise<HanjaEntry[]> {
    return resolveFixedNameCharacterPool(
      givenNameChar,
      operation ? this.operationNameEntryRepository(operation) : this.hanjaRepo,
      {
        hanjaPool,
        poolLimit,
        allowHangulFallback,
        asyncFullPoolEntries: loadFullHanjaPoolEntries,
        preverifiedEntry: this.preverifiedExplicitNameIdentity(givenNameChar, {
          role: 'givenName',
          hanjaPool,
        }),
      },
    );
  }

  // -------------------------------------------------------------------------
  // resolveEntries -- look up full HanjaEntry records for a name
  // -------------------------------------------------------------------------

  private async resolveEntries(
    chars: NameCharInput[],
    options: ResolveNameEntriesOptions = {},
    operation?: SpringEngineOperationLease,
  ): Promise<HanjaEntry[]> {
    return resolveNameEntries(
      chars,
      operation ? this.operationNameEntryRepository(operation) : this.hanjaRepo,
      {
        ...options,
        asyncFullPoolEntries: loadFullHanjaPoolEntries,
        preverifiedExplicitPair: (input, context) =>
          this.preverifiedExplicitNameIdentity(input, context),
      },
    );
  }

  // -------------------------------------------------------------------------
  // getFortuneReport -- fortune report combining saju + optional name analysis
  // -------------------------------------------------------------------------

  private async prepareFortuneReportContext(
    request: FortuneReportRequest,
    operation: SpringEngineOperationLease,
  ): Promise<PreparedFortuneReportContext> {
    // Reject malformed or unbounded horizons before database or astronomy work.
    const { targetDate, reportOptions } = resolveFortuneTargetContext(
      request.birth,
      request.targetDate,
      request.options,
    );
    const hasSuppliedGivenName = Object.prototype.hasOwnProperty.call(request, 'givenName')
      && !(Array.isArray(request.givenName) && request.givenName.length === 0);
    const explicitNameRequest: SpringRequest | null = hasSuppliedGivenName
      ? {
          birth: request.birth,
          surname: request.surname ?? [],
          givenName: request.givenName,
          mode: 'evaluate',
          options: request.options,
        }
      : null;
    if (explicitNameRequest) {
      this.assertRequestNameSyntax(explicitNameRequest, false, true, true);
    }
    await this.awaitOperationStep(operation, () => this.init());
    if (explicitNameRequest) {
      await this.assertExplicitRequestNameIdentity(explicitNameRequest, operation);
    }

    const sajuReport = await this.awaitOperationStep(operation, () => this.getSajuReport({
      birth: request.birth,
      surname: request.surname ?? [],
      options: reportOptions,
    }));
    if (
      !sajuReport.sajuEnabled
      || sajuReport.analysisStatus === 'failed'
      || sajuReport.analysisStatus === 'unavailable'
    ) {
      throw new FortuneSajuUnavailableError(
        sajuReport.diagnostics?.[0]?.reasonCode ?? 'SAJU_CALCULATION_FAILED',
        sajuReport.analysisStatus ?? 'failed',
      );
    }
    assertScorableSajuSummary(sajuReport);

    let springReport: SpringReport | null = null;
    if (request.givenName && request.givenName.length > 0) {
      // A supplied name is an explicit request for name compatibility. Data
      // corruption, cancellation and infrastructure failures remain visible.
      springReport = await this.awaitOperationStep(
        operation,
        () => this.getSpringReportFromSnapshot(
          snapshotSpringRequest({
            birth: request.birth,
            surname: request.surname ?? [],
            givenName: request.givenName,
            mode: 'evaluate',
            options: reportOptions,
          }),
          sajuReport,
          undefined,
          operation,
        ),
      );
    }

    return { targetDate, reportOptions, sajuReport, springReport };
  }

  async getFortuneReport(request: FortuneReportRequest): Promise<FortuneReport> {
    request = snapshotFortuneReportRequest(request);
    this.assertSchoolPresetSelection(request.options);
    const operation = this.beginOperation('getFortuneReport');
    const context = await this.prepareFortuneReportContext(request, operation);
    const report = await this.buildFortuneReportFromPrepared(request, context, operation);
    return this.completeOperation(operation, report);
  }

  private async buildFortuneReportFromPrepared(
    request: FortuneReportRequest,
    context: PreparedFortuneReportContext,
    operation: SpringEngineOperationLease,
  ): Promise<FortuneReport> {
    const { targetDate, reportOptions, sajuReport, springReport } = context;
    const saju: SajuSummary = sajuReport;

    // 4. Build the fortune report
    // PR-Q-12 (Phase M-D6): fortuneCascadeMode default flips
    // 'simple' → 'jie_based'. saju-ts 의 정확한 절기 boundary 사용 — 60 일 / 년
    // (16%) 정확도 회복. Callers can opt out via explicit 'simple'.
    const pc = reportOptions.precisionConfig;
    const fortuneCascadeMode = pc?.fortuneCascadeMode ?? 'jie_based';
    return this.awaitOperationStep(operation, () => buildFortuneReport(saju, targetDate, springReport, {
      fortuneCascadeMode: fortuneCascadeMode === 'jie_based' || fortuneCascadeMode === 'full_5layer'
        ? fortuneCascadeMode
        : 'simple',
      narrativeStyle: pc?.narrativeStyle,
      readingFocus: pc?.readingFocus,
      schoolPreset: this.resolveSchoolPresetMeta(reportOptions),
      // PR-Q-16 (Phase K-1 PR-B): surfaceSubDomains default flips
      // false → true. Each CategoryFortuneCard now carries 1-3 sub-domain
      // rows (saju_master/event_domain_map.py doctrine). Callers can opt
      // out via explicit `surfaceSubDomains: false`.
      surfaceSubDomains: pc?.surfaceSubDomains ?? true,
      // Tiered matrix surface (precisionConfig.surfaceTieredMatrix).
      // Default unset / false = no `tieredMatrix` field, NameSpring
      // backward-compat preserved.
      surfaceTieredMatrix: pc?.surfaceTieredMatrix === true,
      // 전문 인사이트 원자료 (precisionConfig.surfaceInsightFacts). Default off.
      surfaceInsightFacts: pc?.surfaceInsightFacts === true,
    }, request.birth));
  }

  async getNamingRecommendationReport(
    request: FortuneReportRequest,
  ): Promise<NamingRecommendationReportResult> {
    request = snapshotFortuneReportRequest(request);
    this.assertSchoolPresetSelection(request.options);
    const operation = this.beginOperation('getNamingRecommendationReport');
    const context = await this.prepareFortuneReportContext(request, operation);
    if (!context.springReport) {
      throw new Error('Naming recommendation report requires an explicit given name.');
    }
    const fortuneReport = await this.buildFortuneReportFromPrepared(request, context, operation);
    const namingEvidencePlan = buildNamingEvidencePlan({
      springReport: context.springReport,
      sajuAxes: resolveNamingEvidenceSajuAxes(context.sajuReport, request.birth, context.targetDate),
    });
    return this.completeOperation(operation, { fortuneReport, namingEvidencePlan });
  }

  /**
   * Future-frontend boundary: returns only requested integrated/saju/naming
   * surfaces. Existing getFortuneReport() output remains byte-for-byte shaped
   * as before, while this method can avoid unrequested tiered cells and packs.
   */
  async getReportDelivery(request: ReportDeliveryRequestV1): Promise<ReportDeliveryV1> {
    request = snapshotReportDeliveryRequestV1(request);
    request = validateReportDeliveryRequestV1(request);
    const selection = validateReportDeliverySelectionV1(request.delivery);
    if (request.candidateId !== undefined && !isCandidateIdV1(request.candidateId)) {
      throw new ReportDeliveryRequestValidationError('CANDIDATE_ID_MISMATCH');
    }
    const provisionalCandidateId = candidateIdFromDeliveryInput(request);
    if (request.candidateId !== undefined
      && provisionalCandidateId !== undefined
      && request.candidateId !== provisionalCandidateId) {
      throw new ReportDeliveryRequestValidationError('CANDIDATE_ID_MISMATCH');
    }
    this.assertSchoolPresetSelection(request.options);
    const operation = this.beginOperation('getReportDelivery');
    const surfaceIds = new Set(selection.surfaces.map((surface) => surface.id));
    const needsIntegrated = surfaceIds.has('integrated');
    const needsSaju = needsIntegrated || surfaceIds.has('saju');
    const needsNaming = needsIntegrated || surfaceIds.has('naming');
    const baseRequest: FortuneReportRequest = {
      birth: request.birth,
      ...(request.surname === undefined ? {} : { surname: request.surname }),
      ...(request.givenName === undefined ? {} : { givenName: request.givenName }),
      ...(request.targetDate === undefined ? {} : { targetDate: request.targetDate }),
      ...(request.options === undefined ? {} : { options: request.options }),
    };
    let targetDate: Date;
    let sajuReport: SajuReport | null = null;
    let namingReport: NamingReport | null = null;
    let springReport: SpringReport | null = null;

    if (needsIntegrated) {
      const prepared = await this.prepareFortuneReportContext(baseRequest, operation);
      targetDate = prepared.targetDate;
      sajuReport = prepared.sajuReport;
      springReport = prepared.springReport;
      namingReport = springReport?.namingReport ?? null;
    } else {
      if (needsSaju) {
        const targetContext = resolveFortuneTargetContext(
          request.birth,
          request.targetDate,
          request.options,
        );
        targetDate = targetContext.targetDate;
        sajuReport = await this.awaitOperationStep(operation, () => this.getSajuReport({
          birth: request.birth,
          surname: request.surname ?? [],
          options: targetContext.reportOptions,
        }));
        if (!isScorableSajuSummary(sajuReport)) {
          throw new FortuneSajuUnavailableError(
            sajuReport.diagnostics?.[0]?.reasonCode ?? 'SAJU_CALCULATION_FAILED',
            sajuReport.analysisStatus ?? 'failed',
          );
        }
        assertScorableSajuSummary(sajuReport);
      } else {
        targetDate = resolveReportAnchorDate(request.birth, request.targetDate).targetDate;
      }
      if (needsNaming && request.givenName && request.givenName.length > 0) {
        namingReport = await this.awaitOperationStep(operation, () => this.getNamingReport({
          birth: request.birth,
          surname: request.surname ?? [],
          givenName: request.givenName,
          mode: 'evaluate',
          ...(request.options === undefined ? {} : { options: request.options }),
        }));
      }
    }

    const candidateId = candidateIdFromDeliveryInput(request, namingReport);
    assertRequestedCandidateId(request.candidateId, candidateId);
    const analysisId = this.reportAnalysisId(request, targetDate);
    const { buildReportDeliveryV1 } = await this.awaitOperationStep(
      operation,
      () => import('./report/delivery/build-report-delivery.js'),
    );
    const delivery = await this.awaitOperationStep(operation, () => buildReportDeliveryV1({
      selection,
      birth: request.birth,
      targetDate,
      analysisId,
      ...(candidateId === undefined ? {} : { candidateId }),
      ...(request.options === undefined ? {} : { options: request.options }),
      saju: sajuReport,
      namingReport,
      springReport,
    }));
    return this.completeOperation(operation, delivery);
  }

  // -------------------------------------------------------------------------
  // close -- release database resources
  // -------------------------------------------------------------------------

  close(): void {
    // Invalidate in-flight initializers before repositories can settle.
    this.lifecycleGeneration += 1;
    this.initialized = false;
    this.initPromise = null;
    this.luckyMap = new Map();
    this.validFourFrameNumbers = new Set();
    this.nameStatInfoCache.clear();
    this.reportAnalysisIds.clear();
    this.candidateSearchSnapshots.clear();
    this.explicitNameIdentityCache = new WeakMap<
      NameCharInput,
      Map<string, CachedExplicitNameIdentity>
    >();
    this.optimizer = null;

    const closeErrors: unknown[] = [];
    for (const repository of [this.hanjaRepo, this.fourFrameRepo, this.nameStatRepo]) {
      try {
        repository.close();
      } catch (error) {
        closeErrors.push(error);
      }
    }
    if (closeErrors.length > 0) {
      throw new AggregateError(closeErrors, 'SpringEngine failed to close every repository.');
    }
  }
}
