// ---------------------------------------------------------------------------
// SpringEngine -- the main naming-recommendation engine.
//
// Public API:
//   init()              -- load database and precompute lucky number tables
//   getNamingReport()   -- pure name analysis (no saju)
//   getSajuReport()     -- saju analysis only
//   getSpringReport()   -- single integrated report (name + saju)
//   getNameCandidates() -- name recommendations with saju integration
//   getNameCandidateSummaries() -- lightweight recommendation list for UI
//   analyze()           -- legacy all-in-one entry point (backward compatible)
//   close()             -- release database resources
// ---------------------------------------------------------------------------

import { HanjaRepository, type HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import {
  FourframeRepository,
  type FourframeMeaningEntry,
} from '../../seed-ts/src/database/fourframe-repository.js';
import {
  NameStatRepository,
  type NameStatEntry,
} from '../../seed-ts/src/database/name-stat-repository.js';
import { RepositoryDataError } from '../../seed-ts/src/database/repository-errors.js';
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
  type SchoolPresetMetadata,
  type SchoolPresetName,
} from './preset-loader.js';
import { springEvaluateName, SAJU_FRAME } from './spring-evaluator.js';
import { analyzeSaju, analyzeSajuSafe, buildSajuContext, collectElements } from './saju-adapter.js';
import type {
  SpringRequest, SpringResponse, SpringCandidate, SajuSummary, SpringOptions,
  SajuReport, NamingReport, NamingReportFrame, SpringReport, SpringCandidateSummary,
  NameCharInput, CharDetail, NameGenderTendency, BirthInfo, NamingScoreVector,
  CandidateStrengthProfile, NameElementStrategy, SajuAnalysisReasonCode, SajuAnalysisStatus,
} from './types.js';
import engineConfig from '../config/engine.json';
import { buildFortuneReport } from './report/buildFortuneReport.js';
import type { FortuneReportRequest, FortuneReport } from './report/types.js';
import { assertScorableSajuSummary, isScorableSajuSummary } from './saju-analysis-contract.js';
import { resolveFortuneTargetDate } from './report/report-input-contract.js';
import { getLegalAnnotation, normalizeToOrthodoxHanja, type HanjaLegalStatus, type HanjaPool } from './hanja-annotations.js';
import {
  SajuRequestValidationError,
  parseFortuneTargetDate,
  validateSajuConfigFortuneHorizon,
  validateSajuRequestOptions,
} from './saju-request-policy.js';
import { targetCalendarYear } from './target-date.js';
import inmyeongyongFullData from '../data/inmyeongyong_9389_full.json';
import { getEnrichedStrokeCount, getUnihanMetadata } from './hanja-unihan.js';
import { getNameTrendAnalysis, type NameTrendAnalysis } from './name-trend.js';
import { getPhoneticAnalysis, type PhoneticAnalysis } from './phonetic-rules.js';
import {
  NameStatLookupUnavailableError,
  type NameStatLookupResult,
} from './name-stat-contract.js';
import {
  FOURFRAME_MAX_NUMBER,
  compileFourFrameContract,
} from './fourframe-contract.js';
import {
  averageScores,
  clampScore,
  dedupeCandidateSummariesByHangul,
  deriveCandidateStrengthProfile,
  describeCandidateName,
  finiteScore,
  orderCandidateSummaries,
  orderSpringCandidates,
  orderSpringReports,
  roundScore,
  sliceAndRankCandidatePage,
  sliceCandidatePage,
} from './candidate-selection.js';
import {
  resolveFixedNameCharacterPool,
  resolveNameEntries,
  type ResolveNameEntriesOptions,
} from './name-entry-resolver.js';

export {
  NAME_ENTRY_RESOLUTION_FAILED,
  NameEntryResolutionError,
  type NameEntryResolutionFailureReason,
  type NameEntryRole,
} from './name-entry-resolver.js';

// ---------------------------------------------------------------------------
// Config -- all tuneable numbers come from engine.json
// ---------------------------------------------------------------------------

const MAX_CANDIDATES            = engineConfig.maxCandidates;
const CANDIDATE_SELECTION_LIMITS = Object.freeze({
  paretoPoolLimit: engineConfig.candidateSelection.paretoPoolLimit,
});
const POOL_LIMIT_SINGLE_CHAR    = engineConfig.candidatePoolLimits.singleCharPerStroke;
const POOL_LIMIT_DOUBLE_CHAR    = engineConfig.candidatePoolLimits.doubleCharPerPosition;
const POOL_LIMIT_JAMO_FILTERED  = engineConfig.candidatePoolLimits.jamoFilteredPerPosition;
const STROKE_MIN                = engineConfig.strokeRange.min;
const STROKE_MAX                = engineConfig.strokeRange.max;
const DEFAULT_OFFSET            = engineConfig.pagination.defaultOffset;
const DEFAULT_LIMIT             = engineConfig.pagination.defaultLimit;
const DEFAULT_TARGET_ELEMENT    = engineConfig.defaultTargetElement;
const ENGINE_VERSION            = engineConfig.version;
const NAME_STAT_INFO_CACHE_LIMIT = (engineConfig as { nameStatInfoCacheLimit?: number }).nameStatInfoCacheLimit ?? 1000;
const DEFAULT_PURE_HANGUL_MODE: 'auto' | 'on' | 'off' = 'auto';
const DEFAULT_USE_SURNAME_HANJA_IN_PURE = false;
const ENABLE_HANJA_NAME_EVALUATION = true;
const ENABLE_FOURFRAME_NAME_EVALUATION = true;
const FULL_POOL_ID_BASE = 900_000;

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

const UNSAFE_HANJA_MEANING_PATTERNS = [
  /장물/,
  /뇌물/,
  /도둑/,
  /훔/,
  /죄/,
  /형벌/,
  /죽을/,
  /죽음/,
  /사망/,
  /망할/,
  /흉/,
  /악할/,
  /해칠/,
  /다칠/,
  /재앙/,
  /고통/,
  /슬플/,
  /감출/,
  /숨길/,
  /가난/,
] as const;
const OPAQUE_HANJA_MEANING_PATTERN = /^[가-힣]{1,2}(?:\s*,\s*[가-힣]{1,2})*$/;
const WEAK_RECOMMENDATION_HANJA_MEANING_PATTERNS = [
  /나이/,
  /마칠/,
  /구기/,
  /비수/,
  /숟가락/,
  /어조사/,
  /어금니/,
  /무기/,
  /굽을/,
  /갈고리/,
  /풀벨/,
  /흩어질/,
  /칼/,
  /작은배/,
  /없을/,
  /말 물/,
  /나눌/,
  /쪼갤/,
  /창/,
  /전쟁/,
  /빌릴/,
  /갚을/,
  /돈/,
  /닻/,
  /배멈출/,
  /대모/,
  /노리개/,
  /패옥/,
] as const;
const POSITIVE_RECOMMENDATION_HANJA_MEANING_PATTERNS = [
  /어질/,
  /착할/,
  /바를/,
  /높일/,
  /빛/,
  /밝/,
  /클/,
  /큰/,
  /넓/,
  /지혜/,
  /슬기/,
  /총명/,
  /준걸/,
  /빼어/,
  /뛰어/,
  /아름/,
  /맑/,
  /깨끗/,
  /평안/,
  /편안/,
  /복/,
  /덕/,
  /길/,
  /귀/,
  /보배/,
  /옥/,
  /금/,
  /별/,
  /해/,
  /달/,
  /하늘/,
  /강/,
  /산/,
  /샘/,
  /꽃/,
  /향/,
  /숲/,
  /영원/,
  /오랠/,
  /단단/,
  /굳/,
  /이룰/,
  /성할/,
  /펼/,
  /도울/,
  /믿/,
  /사랑/,
  /기쁠/,
  /즐거/,
  /윤택/,
  /풍성/,
  /예절/,
  /공경/,
  /참/,
  /진실/,
  /정성/,
  /건강/,
  /솜씨/,
  /힘/,
  /다스릴/,
] as const;

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

interface FullPoolDataEntry {
  readonly hanja: string;
  readonly readings: readonly string[];
  readonly meaning: string | null;
  readonly radicalId: number | null;
  readonly strokeCount: number | null;
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

function isSingleGlyph(value: string): boolean {
  return Array.from(value.trim()).length === 1;
}

function isSingleHangulSyllable(value: string): boolean {
  return /^[\uAC00-\uD7A3]$/.test(value);
}

function elementFromStrokeCount(strokes: number): ElementKey {
  const digit = ((strokes % 10) + 10) % 10;
  if (digit === 1 || digit === 2) return 'Wood';
  if (digit === 3 || digit === 4) return 'Fire';
  if (digit === 5 || digit === 6) return 'Earth';
  if (digit === 7 || digit === 8) return 'Metal';
  return 'Water';
}

let fullLegalPoolCache: readonly HanjaEntry[] | null = null;

function getFullLegalPoolEntries(): readonly HanjaEntry[] {
  if (fullLegalPoolCache) return fullLegalPoolCache;

  const entries = ((inmyeongyongFullData as { entries: readonly FullPoolDataEntry[] }).entries ?? []);
  const out: HanjaEntry[] = [];
  const seen = new Set<string>();

  for (const item of entries) {
    const localStrokes = Number(item.strokeCount);
    const strokes = getEnrichedStrokeCount(item.hanja, localStrokes);
    if (!Number.isInteger(strokes) || strokes < STROKE_MIN || strokes > STROKE_MAX) continue;
    if (typeof item.hanja !== 'string' || !isSingleGlyph(item.hanja)) continue;
    const unihan = getUnihanMetadata(item.hanja);

    for (const rawReading of item.readings ?? []) {
      const hangul = String(rawReading ?? '').trim();
      if (!isSingleHangulSyllable(hangul)) continue;
      const decomposed = decomposeHangul(hangul);
      if (!decomposed) continue;
      const key = `${hangul}\u0000${item.hanja}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // The local full pool does not carry radical/resource 오행 metadata.
      // Use a stroke-derived element so opt-in candidates remain scoreable.
      // Unihan radical data is exposed separately as a non-authority hint.
      const element = elementFromStrokeCount(strokes);
      out.push({
        id: FULL_POOL_ID_BASE + out.length,
        hangul,
        hanja: item.hanja,
        onset: decomposed.onset,
        nucleus: decomposed.nucleus,
        strokes,
        stroke_element: element,
        resource_element: element,
        meaning: item.meaning ?? '',
        radical: String(unihan?.radicalNumber ?? item.radicalId ?? ''),
        is_surname: false,
      });
    }
  }

  fullLegalPoolCache = out;
  return fullLegalPoolCache;
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
  return typeof value === 'string' && /\p{Script=Han}/u.test(value);
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

function hasUnsafeHanjaMeaning(entry: HanjaEntry): boolean {
  const meaning = String(entry.meaning ?? '').trim();
  if (!meaning) return false;
  return UNSAFE_HANJA_MEANING_PATTERNS.some((pattern) => pattern.test(meaning));
}

function hasOpaqueHanjaMeaning(entry: HanjaEntry): boolean {
  const meaning = String(entry.meaning ?? '').replace(/\s+/g, ' ').trim();
  if (!meaning) return true;
  const descriptivePart = meaning.includes(':')
    ? meaning.split(':').slice(1).join(':').trim()
    : meaning;
  if (!descriptivePart) return true;
  return OPAQUE_HANJA_MEANING_PATTERN.test(descriptivePart);
}

function hasWeakRecommendationHanjaMeaning(entry: HanjaEntry): boolean {
  const meaning = String(entry.meaning ?? '').replace(/\s+/g, ' ').trim();
  if (!meaning) return false;
  if (WEAK_RECOMMENDATION_HANJA_MEANING_PATTERNS.some((pattern) => pattern.test(meaning))) return true;
  return !POSITIVE_RECOMMENDATION_HANJA_MEANING_PATTERNS.some((pattern) => pattern.test(meaning));
}

/** Convert a HanjaEntry into the minimal NameCharInput shape. */
function toNameCharInput(entry: HanjaEntry, pool: HanjaPool = 'curated'): NameCharInput {
  const legal = getLegalAnnotation(entry, { pool });
  return {
    hangul: entry.hangul,
    hanja: entry.hanja,
    meaning: entry.meaning,
    strokes: entry.strokes,
    element: entry.resource_element,
    elementLabel: elementDisplayLabel(entry.resource_element),
    legalStatus: legal.legalStatus,
    legalRegistrable: legal.legalRegistrable,
    isVariantOf: legal.isVariantOf,
  };
}

interface NameResolutionPolicy {
  readonly pureHangulGivenName: boolean;
  readonly useSurnameHanjaInPureHangul: boolean;
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

export class SpringEngine {
  private hanjaRepo = new HanjaRepository();
  private fourFrameRepo = new FourframeRepository();
  private nameStatRepo = new NameStatRepository();
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private lifecycleGeneration = 0;
  private luckyMap = new Map<number, string>();
  private fourFrameMeaningByNumber = new Map<number, FourframeMeaningEntry>();
  private validFourFrameNumbers = new Set<number>();
  private optimizer: FourFrameOptimizer | null = null;
  private readonly nameStatInfoCache = new Map<string, NameStatLookupResult>();

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
    const fourFrameMeaningByNumber = new Map<number, FourframeMeaningEntry>(
      compiled.recordsByNumber,
    );
    const validFourFrameNumbers = new Set<number>(compiled.favorableNumbers);
    const optimizer = new FourFrameOptimizer(validFourFrameNumbers);
    this.assertActiveInitialization(generation);

    // No await is allowed between these assignments: consumers observe either
    // the previous closed state or this complete validated state.
    this.luckyMap = luckyMap;
    this.fourFrameMeaningByNumber = fourFrameMeaningByNumber;
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

  private hasExplicitHanja(char: NameCharInput): boolean {
    const hanja = String(char.hanja ?? '').trim();
    return hanja.length > 0 && hanja !== char.hangul;
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
      && givenNameChars.every((char) => !this.hasExplicitHanja(char));

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
      const weakMeaning = hasWeakRecommendationHanjaMeaning(entry);
      if (unsafeMeaning || opaqueMeaning || weakMeaning) {
        const legal = getLegalAnnotation(entry, { pool: hanjaPool });
        this.recordCandidateRejection(
          accumulator,
          unsafeMeaning ? 'unsafe_hanja_meaning' : opaqueMeaning ? 'opaque_hanja_meaning' : 'weak_hanja_meaning',
          {
            hangul: entry.hangul,
            hanja: entry.hanja,
            legalStatus: legal.legalStatus,
          },
          unsafeMeaning
            ? 'Candidate removed before scoring because the Hanja meaning is unsuitable for public name recommendations.'
            : opaqueMeaning
              ? 'Candidate removed before scoring because the Hanja meaning is too opaque for public name recommendations.'
              : 'Candidate removed before scoring because the Hanja meaning is weak for public name recommendations.',
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
    const limit = options.limit ?? results.length;
    return sliceCandidatePage(results, offset, limit);
  }

  // -------------------------------------------------------------------------
  // getNamingReport -- pure name analysis (no saju)
  // -------------------------------------------------------------------------

  async getNamingReport(request: SpringRequest): Promise<NamingReport> {
    await this.init();

    const resolutionPolicy = this.resolveNameResolutionPolicy(
      request.givenName,
      request.options,
    );
    const hanjaPool = this.resolveHanjaPool(request.options);
    const surnameEntries = await this.resolveEntries(request.surname, {
      forceHangulOnly: resolutionPolicy.pureHangulGivenName
        && !resolutionPolicy.useSurnameHanjaInPureHangul,
      isSurname: true,
      hanjaPool,
    });
    const givenNameEntries = await this.resolveEntries(request.givenName!, {
      forceHangulOnly: resolutionPolicy.pureHangulGivenName,
      hanjaPool,
    });

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
    return this.buildNamingReport(
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
    );
  }

  // -------------------------------------------------------------------------
  // getSajuReport -- saju analysis only
  // -------------------------------------------------------------------------

  async getSajuReport(request: SpringRequest): Promise<SajuReport> {
    const { summary, sajuEnabled } = await analyzeSajuSafe(request.birth, request.options);
    return { ...summary, sajuEnabled };
  }

  // -------------------------------------------------------------------------
  // getSpringReport -- single integrated report for one explicit given name
  // -------------------------------------------------------------------------

  async getSpringReport(
    request: SpringRequest,
    sajuReportOverride?: SajuReport,
  ): Promise<SpringReport> {
    await this.init();

    if (!request.givenName?.length) {
      throw new Error('getSpringReport requires givenName input.');
    }

    const sajuReport = sajuReportOverride ?? await this.getSajuReport(request);
    const { dist: sajuDistribution, output: sajuOutput } = buildSajuContext(sajuReport, {
      includeTenGodByPosition: request.options?.precisionConfig?.tenGodMode === 'positional_weighted_v2',
    });
    const nameStatInfo = await this.getNameStatInfo(request.givenName);

    const resolutionPolicy = this.resolveNameResolutionPolicy(
      request.givenName,
      request.options,
    );
    const hanjaPool = this.resolveHanjaPool(request.options);
    const surnameEntries = await this.resolveEntries(request.surname, {
      forceHangulOnly: resolutionPolicy.pureHangulGivenName
        && !resolutionPolicy.useSurnameHanjaInPureHangul,
      isSurname: true,
      hanjaPool,
    });
    const givenNameEntries = await this.resolveEntries(request.givenName, {
      forceHangulOnly: resolutionPolicy.pureHangulGivenName,
      hanjaPool,
    });

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
        ...this.resolveSajuPreset(request.options),
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
        this.resolveHanjaPool(request.options),
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
        this.resolveHanjaPool(request.options),
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

    return {
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
        this.resolveHanjaPool(request.options),
        nameTrend,
        phonetic,
        namingScoreVector,
        namingStrengthProfile,
      ),
      sajuReport,
      sajuCompatibility: saju.getAnalysis().data,
      combinedDistribution: saju.getCombinedDistribution(),
      rank: 0,
    };
  }

  // -------------------------------------------------------------------------
  // getNameCandidates -- name recommendations with saju integration
  // -------------------------------------------------------------------------

  async getNameCandidates(request: SpringRequest): Promise<SpringReport[]> {
    await this.init();
    const candidateRejections: CandidateRejectionAccumulator = new Map();

    // 1. Saju analysis
    const sajuReport = await this.getSajuReport(request);
    const sajuSummary: SajuSummary = sajuReport;

    // 2. Determine mode and collect name inputs
    const jamoFilters = request.givenName?.map(
      char => char.hanja ? null : parseJamoFilter(char.hangul),
    );
    const hasJamoInput = jamoFilters?.some(filter => filter !== null) ?? false;
    const mode = this.resolveMode(request, hasJamoInput);

    const nameInputs = await this.collectNameInputs(
      request, mode, hasJamoInput, jamoFilters, sajuSummary, candidateRejections,
    );
    // 3. Score each candidate
    const results: SpringReport[] = [];

    for (const givenNameInput of nameInputs) {
      const nameStatInfo = await this.getNameStatInfo(givenNameInput);
      if (nameStatInfo.status === 'not_found') continue;
      if (this.isGenderMismatch(request.birth.gender, nameStatInfo.nameGender)) continue;
      results.push(await this.getSpringReport(
        { ...request, givenName: givenNameInput, mode: 'evaluate' },
        sajuReport,
      ));
    }

    return this.pageOrderedCandidates(
      orderSpringReports(results, request.options, CANDIDATE_SELECTION_LIMITS),
      request.options,
    );
  }

  // -------------------------------------------------------------------------
  // getNameCandidateSummaries -- lightweight candidates for list rendering
  // -------------------------------------------------------------------------

  async getNameCandidateSummaries(request: SpringRequest): Promise<SpringCandidateSummary[]> {
    await this.init();
    const candidateRejections: CandidateRejectionAccumulator = new Map();

    const sajuReport = await this.getSajuReport(request);
    const sajuSummary: SajuSummary = sajuReport;
    const { dist: sajuDistribution, output: sajuOutput } = buildSajuContext(sajuSummary, {
      includeTenGodByPosition: request.options?.precisionConfig?.tenGodMode === 'positional_weighted_v2',
    });

    const jamoFilters = request.givenName?.map(
      char => char.hanja ? null : parseJamoFilter(char.hangul),
    );
    const hasJamoInput = jamoFilters?.some(filter => filter !== null) ?? false;
    const mode = this.resolveMode(request, hasJamoInput);

    const nameInputs = await this.collectNameInputs(
      request, mode, hasJamoInput, jamoFilters, sajuSummary, candidateRejections,
    );
    const results: SpringCandidateSummary[] = [];

    for (const givenNameInput of nameInputs) {
      const nameStatInfo = await this.getNameStatInfo(givenNameInput);
      if (nameStatInfo.status === 'not_found') continue;
      if (this.isGenderMismatch(request.birth.gender, nameStatInfo.nameGender)) continue;
      const resolutionPolicy = this.resolveNameResolutionPolicy(
        givenNameInput,
        request.options,
      );
      const surnameEntries = await this.resolveEntries(request.surname, {
        forceHangulOnly: resolutionPolicy.pureHangulGivenName
          && !resolutionPolicy.useSurnameHanjaInPureHangul,
        isSurname: true,
        hanjaPool: this.resolveHanjaPool(request.options),
      });
      const givenNameEntries = await this.resolveEntries(givenNameInput, {
        forceHangulOnly: resolutionPolicy.pureHangulGivenName,
        hanjaPool: this.resolveHanjaPool(request.options),
      });

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
          ...this.resolveSajuPreset(request.options),
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
      const nameTrend = this.resolveNameTrend(givenNameInput, request.birth, request.options);
      const phonetic = this.resolvePhoneticAnalysis(request.surname, givenNameInput, request.options);
      const vectorEvidence = this.resolveNamingScoreVectorEvidence(
        request.surname,
        givenNameInput,
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
          this.resolveHanjaPool(request.options),
          vectorEvidence.nameTrend,
          vectorEvidence.phonetic,
        )
        : undefined;
      const strengthProfile = scoreVector
        ? deriveCandidateStrengthProfile(scoreVector)
        : undefined;
      results.push({
        finalScore: roundScore(combined.score),
        ...(scoreVector ? { scoreVector } : {}),
        ...(strengthProfile ? { strengthProfile } : {}),
        fullHangul: allEntries.map(entry => entry.hangul).join(''),
        fullHanja: allEntries.map(entry => entry.hanja).join(''),
        givenHangul: givenNameEntries.map(entry => entry.hangul).join(''),
        givenName: givenNameEntries.map(entry => toNameCharInput(entry, this.resolveHanjaPool(request.options))),
        popularityRank: nameStatInfo.popularityRank,
        maleRatio: nameStatInfo.maleRatio,
        nameGender: nameStatInfo.nameGender,
        ...(nameTrend ? { nameTrend } : {}),
        ...(phonetic ? { phonetic } : {}),
        rank: 0,
      });
    }

    const ordered = orderCandidateSummaries(
      results,
      request.options,
      CANDIDATE_SELECTION_LIMITS,
    );
    return this.pageOrderedCandidates(dedupeCandidateSummariesByHangul(ordered), request.options);
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
    const hanjaScore = roundScore(
      ((categoryMap.STROKE_POLARITY?.score ?? 0) + (categoryMap.STROKE_ELEMENT?.score ?? 0)) / 2,
    );
    const fourFrameScore = roundScore(categoryMap.FOURFRAME_LUCK?.score ?? 0);

    const enrichedFrames: NamingReportFrame[] = frames.map((frame) => {
      const meaning = this.fourFrameMeaningByNumber.get(frame.strokeSum);
      return {
        type: frame.type,
        strokeSum: frame.strokeSum,
        element: frame.energy?.element.english ?? '',
        elementLabel: elementDisplayLabel(frame.energy?.element.english),
        polarity: frame.energy?.polarity.english ?? '',
        luckyLevel: bucketFromFortune(this.luckyMap.get(frame.strokeSum) ?? ''),
        meaning: meaning ? sanitizeServiceValue(meaning, fullHangul) : null,
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
    await this.init();
    const candidateRejections: CandidateRejectionAccumulator = new Map();

    // 1. Determine the operating mode
    const jamoFilters = request.givenName?.map(
      char => char.hanja ? null : parseJamoFilter(char.hangul),
    );
    const hasJamoInput = jamoFilters?.some(filter => filter !== null) ?? false;
    const mode = this.resolveMode(request, hasJamoInput);

    // 2. Run saju (four-pillar destiny) analysis on the birth data
    const sajuSummary = await analyzeSaju(request.birth, request.options);
    const { dist: sajuDistribution, output: sajuOutput } = buildSajuContext(sajuSummary, {
      includeTenGodByPosition: request.options?.precisionConfig?.tenGodMode === 'positional_weighted_v2',
    });

    // 3. Build the list of name inputs to score
    const nameInputs = await this.collectNameInputs(
      request, mode, hasJamoInput, jamoFilters, sajuSummary, candidateRejections,
    );

    // 4. Score every candidate and rank by total score (descending)
    const scoredCandidates = await this.scoreAllCandidates(
      request.surname, nameInputs, sajuDistribution, sajuOutput, request.birth, request.options,
      this.resolveEvaluatorHints(request.birth, request.options, sajuOutput),
    );

    // 5. Paginate and return
    return this.buildResponse(request, mode, sajuSummary, scoredCandidates, candidateRejections);
  }

  // -------------------------------------------------------------------------
  // analyze() helper -- resolve which mode to use
  // -------------------------------------------------------------------------

  private resolveMode(
    request: SpringRequest,
    hasJamoInput: boolean,
  ): 'evaluate' | 'recommend' | 'all' {
    if (request.mode && request.mode !== 'auto') return request.mode;

    // Auto-detect: if every given-name character has an explicit hanja,
    // the user wants an evaluation; otherwise, generate recommendations.
    const allHaveHanja = request.givenName?.length
      && request.givenName.every((char) => this.hasExplicitHanja(char));

    const pureHangulMode = this.resolvePureHangulMode(request.options);
    const allGivenHangulOnly = request.givenName?.length
      && request.givenName.every((char) => !this.hasExplicitHanja(char));
    if (pureHangulMode === 'on' && allGivenHangulOnly && !hasJamoInput) {
      return 'evaluate';
    }

    return allHaveHanja && !hasJamoInput ? 'evaluate' : 'recommend';
  }

  // -------------------------------------------------------------------------
  // analyze() helper -- gather name inputs depending on mode
  // -------------------------------------------------------------------------

  private async collectNameInputs(
    request: SpringRequest,
    mode: 'evaluate' | 'recommend' | 'all',
    hasJamoInput: boolean,
    jamoFilters: (JamoFilter | null)[] | undefined,
    sajuSummary: SajuSummary,
    candidateRejections: CandidateRejectionAccumulator,
  ): Promise<NameCharInput[][]> {
    const hasExplicitGivenName = request.givenName?.length && !hasJamoInput;

    // Evaluate mode with a fully specified name -- just score it directly
    if (mode === 'evaluate' && hasExplicitGivenName) {
      return [request.givenName!];
    }

    // Recommend or all mode -- generate candidates
    if (mode === 'recommend' || mode === 'all' || hasJamoInput) {
      const candidates = await this.generateCandidates(
        request,
        sajuSummary,
        hasJamoInput ? jamoFilters! : undefined,
        candidateRejections,
      );

      // If the user also supplied an explicit name, prepend it
      if (hasExplicitGivenName) {
        candidates.unshift(request.givenName!);
      }

      return this.filterCandidatesByNameStat(candidates, request.birth.gender);
    }

    // Fallback: just the explicit name, or nothing
    return request.givenName?.length ? [request.givenName] : [];
  }

  private givenNameHangulKey(givenName: NameCharInput[]): string {
    return givenName.map((char) => String(char?.hangul ?? '')).join('').trim();
  }

  private latestPopularityRankFromEntry(entry: NameStatEntry): number | null {
    const source = entry?.yearly_rank || {};
    const totalBucket = source?.['전체'];

    if (totalBucket && typeof totalBucket === 'object' && !Array.isArray(totalBucket)) {
      const sorted = Object.entries(totalBucket)
        .map(([year, rank]) => ({ year: Number(year), rank: Number(rank) }))
        .filter((item) => Number.isFinite(item.year) && Number.isFinite(item.rank))
        .sort((a, b) => a.year - b.year);
      const latestFromTotal = sorted.length ? sorted[sorted.length - 1].rank : null;
      return Number.isFinite(Number(latestFromTotal)) && Number(latestFromTotal) > 0
        ? Number(latestFromTotal)
        : null;
    }

    const valuesByYear = new Map<number, number[]>();
    for (const [bucketKey, bucket] of Object.entries(source)) {
      const flatYear = Number(bucketKey);
      const flatValue = Number(bucket);
      if (Number.isFinite(flatYear) && Number.isFinite(flatValue)) {
        const list = valuesByYear.get(flatYear) || [];
        list.push(flatValue);
        valuesByYear.set(flatYear, list);
        continue;
      }

      if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) continue;
      for (const [year, value] of Object.entries(bucket)) {
        const y = Number(year);
        const v = Number(value);
        if (!Number.isFinite(y) || !Number.isFinite(v)) continue;
        const list = valuesByYear.get(y) || [];
        list.push(v);
        valuesByYear.set(y, list);
      }
    }

    if (!valuesByYear.size) return null;
    const latestYear = Math.max(...valuesByYear.keys());
    const values = valuesByYear.get(latestYear) || [];
    if (!values.length) return null;
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Number.isFinite(avg) && avg > 0 ? avg : null;
  }

  private normalizeRatio(value: number): number {
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
  }

  private sumBirthsByBucket(
    yearlyBirth: Record<string, Record<string, number>>,
    bucketNames: string[],
  ): number {
    let total = 0;
    for (const bucketName of bucketNames) {
      const bucket = yearlyBirth?.[bucketName];
      if (!bucket || typeof bucket !== 'object') continue;
      for (const value of Object.values(bucket)) {
        const count = Number(value);
        if (Number.isFinite(count) && count > 0) {
          total += count;
        }
      }
    }
    return total;
  }

  private getGenderInfoFromEntry(entry: NameStatEntry | null): { maleRatio: number | null; nameGender: NameGenderTendency } {
    if (!entry) {
      return { maleRatio: null, nameGender: 'unknown' };
    }

    const maleBirths = this.sumBirthsByBucket(entry.yearly_birth, ['남자', '남']);
    const femaleBirths = this.sumBirthsByBucket(entry.yearly_birth, ['여자', '여']);
    const totalBirths = maleBirths + femaleBirths;

    if (totalBirths <= 0) {
      return { maleRatio: null, nameGender: 'unknown' };
    }

    const maleRatio = this.normalizeRatio(maleBirths / totalBirths);
    return {
      maleRatio,
      nameGender: maleRatio >= 0.5 ? 'male' : 'female',
    };
  }

  private isGenderMismatch(
    userGender: 'male' | 'female' | 'neutral',
    nameGender: NameGenderTendency,
  ): boolean {
    if (userGender === 'neutral') return false;
    if (nameGender === 'unknown') return true;
    return userGender !== nameGender;
  }

  private async getNameStatInfo(givenName: NameCharInput[]): Promise<NameStatLookupResult> {
    const generation = this.lifecycleGeneration;
    const key = this.givenNameHangulKey(givenName);
    if (!key) {
      return {
        status: 'not_found',
        popularityRank: null,
        maleRatio: null,
        nameGender: 'unknown',
      };
    }

    const cached = this.cacheGetNameStatInfo(key);
    if (cached) return cached;

    let found: NameStatEntry | null;
    try {
      found = await this.nameStatRepo.findByName(key);
    } catch (cause) {
      this.assertActiveOperation(generation, 'name-stat-lookup');
      if (cause instanceof RepositoryDataError) {
        throw cause;
      }
      // Infrastructure failures must not become a durable "name does not
      // exist" decision. Do not cache this path, so a later request can retry.
      throw new NameStatLookupUnavailableError(cause);
    }
    this.assertActiveOperation(generation, 'name-stat-lookup');

    if (!found) {
      const notFound: NameStatLookupResult = {
        status: 'not_found',
        popularityRank: null,
        maleRatio: null,
        nameGender: 'unknown',
      };
      this.cacheSetNameStatInfo(key, notFound);
      return notFound;
    }

    // Decode-derived data errors and programming defects remain non-retryable;
    // only repository access failures above are wrapped as infrastructure.
    const genderInfo = this.getGenderInfoFromEntry(found);
    const info: NameStatLookupResult = {
      status: 'found',
      popularityRank: this.latestPopularityRankFromEntry(found),
      maleRatio: genderInfo.maleRatio,
      nameGender: genderInfo.nameGender,
    };
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

  private async filterCandidatesByNameStat(
    nameInputs: NameCharInput[][],
    userGender: 'male' | 'female' | 'neutral',
  ): Promise<NameCharInput[][]> {
    const filtered: NameCharInput[][] = [];
    for (const givenNameInput of nameInputs) {
      const info = await this.getNameStatInfo(givenNameInput);
      if (info.status === 'not_found') continue;
      if (this.isGenderMismatch(userGender, info.nameGender)) continue;
      filtered.push(givenNameInput);
    }
    return filtered;
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
  ): Promise<SpringCandidate> {
    const resolutionPolicy = this.resolveNameResolutionPolicy(givenName, requestOptions);
    const hanjaPool = this.resolveHanjaPool(requestOptions);
    const surnameEntries = await this.resolveEntries(surname, {
      forceHangulOnly: resolutionPolicy.pureHangulGivenName
        && !resolutionPolicy.useSurnameHanjaInPureHangul,
      isSurname: true,
      hanjaPool,
    });
    const givenNameEntries = await this.resolveEntries(givenName, {
      forceHangulOnly: resolutionPolicy.pureHangulGivenName,
      hanjaPool,
    });

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
    const hanjaScore = roundScore(
      ((categoryMap.STROKE_POLARITY?.score ?? 0) + (categoryMap.STROKE_ELEMENT?.score ?? 0)) / 2,
    );
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
  ): Promise<NameCharInput[][]> {
    const hanjaPool      = this.resolveHanjaPool(request.options);
    const surnameEntries = await this.resolveEntries(request.surname, { isSurname: true, hanjaPool });
    const nameLength     = request.givenNameLength ?? jamoFilters?.length ?? 2;
    const hasJamoFilter  = jamoFilters?.some(filter => filter !== null) ?? false;

    // A failed or partial analysis must not be converted into the configured
    // default element. In that case generation is explicitly name-only.
    const hasSajuGuidance = isScorableSajuSummary(sajuSummary);
    const targetElements = hasSajuGuidance
      ? collectElements(
          sajuSummary.yongshin.element,
          sajuSummary.yongshin.heeshin,
          sajuSummary.deficientElements,
        )
      : new Set<string>();
    const avoidElements = hasSajuGuidance
      ? collectElements(
          sajuSummary.yongshin.gishin,
          sajuSummary.yongshin.gushin,
          sajuSummary.excessiveElements,
        )
      : new Set<string>();
    if (hasSajuGuidance && targetElements.size === 0) {
      targetElements.add(DEFAULT_TARGET_ELEMENT);
    }

    // Build per-position character pools
    const pools = await this.buildPositionPools(
      request, nameLength, jamoFilters, hasJamoFilter,
      surnameEntries, targetElements, avoidElements, hanjaPool, candidateRejections,
    );

    // Choose the generation strategy
    const useStrokeStrategy = !hasJamoFilter && nameLength <= 2;

    const generated = useStrokeStrategy
      ? this.generateViaStrokeOptimizer(surnameEntries, pools, nameLength, hanjaPool)
      : this.generateViaDepthFirstSearch(pools, nameLength, hanjaPool);
    const internallyDiverse = this.filterInternallyRepeatedCandidates(generated, candidateRejections);
    return this.filterGeneratedCandidatesByLegalStatus(internallyDiverse, hanjaPool, candidateRejections);
  }

  private filterGeneratedCandidatesByLegalStatus(
    candidates: NameCharInput[][],
    hanjaPool: HanjaPool,
    candidateRejections: CandidateRejectionAccumulator,
  ): NameCharInput[][] {
    if (hanjaPool !== 'inmyeongyong_full') return candidates;

    const filtered: NameCharInput[][] = [];
    for (const candidate of candidates) {
      const rejected = candidate.find((char) =>
        char.legalStatus !== 'allowed' && char.legalStatus !== 'variantAllowed');
      if (rejected) {
        this.recordCandidateRejection(
          candidateRejections,
          'outside_legal_hanja_pool',
          rejected,
          'Candidate removed before scoring because its Hanja is outside the active legal pool.',
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
        if (current.some(existing => existing.hanja === candidate.hanja)) continue;
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

  private async buildPositionPools(
    request: SpringRequest,
    nameLength: number,
    jamoFilters: (JamoFilter | null)[] | undefined,
    hasJamoFilter: boolean,
    surnameEntries: HanjaEntry[],
    targetElements: Set<string>,
    avoidElements: Set<string>,
    hanjaPool: HanjaPool,
    candidateRejections: CandidateRejectionAccumulator,
  ): Promise<Map<number, HanjaEntry[]>> {
    const useStrokeMode = !hasJamoFilter && nameLength <= 2;

    return useStrokeMode
      ? this.buildStrokeBasedPools(
          surnameEntries, nameLength, targetElements, avoidElements, hanjaPool, candidateRejections,
        )
      : this.buildJamoBasedPools(
          request, nameLength, jamoFilters, targetElements, avoidElements, hanjaPool, candidateRejections,
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
    return getFullLegalPoolEntries()
      .filter((entry) => entry.strokes >= min && entry.strokes <= max);
  }

  // -------------------------------------------------------------------------
  // Pool builder: stroke-based
  //
  // 1. Ask the optimizer which stroke-count combinations are valid.
  // 2. Fetch all hanja in the needed stroke range.
  // 3. Group by stroke count, excluding surnames and avoided elements.
  // 4. Sort each group so target-element characters come first.
  // -------------------------------------------------------------------------

  private async buildStrokeBasedPools(
    surnameEntries: HanjaEntry[],
    nameLength: number,
    targetElements: Set<string>,
    avoidElements: Set<string>,
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

    // Group into pools. Full-pool resource elements are stroke-derived until
    // PR-2.3, so only curated entries use resource 오행 for pre-score exclusion.
    const pools = new Map<number, HanjaEntry[]>();
    const canFilterAvoidedResourceElement = hanjaPool === 'curated';

    for (const hanjaEntry of this.filterPresentationSafeEntries(
      allHanja,
      hanjaPool,
      candidateRejections,
    )) {
      if (hanjaEntry.is_surname) continue;
      if (!neededStrokes.has(hanjaEntry.strokes)) continue;
      if (canFilterAvoidedResourceElement && avoidElements.has(hanjaEntry.resource_element)) continue;

      let bucket = pools.get(hanjaEntry.strokes);
      if (!bucket) {
        bucket = [];
        pools.set(hanjaEntry.strokes, bucket);
      }
      bucket.push(hanjaEntry);
    }

    // Sort each bucket: target-element characters first
    for (const [strokeCount, bucket] of pools) {
      pools.set(strokeCount, bucket.sort((a, b) =>
        (targetElements.has(b.resource_element) ? 1 : 0)
        - (targetElements.has(a.resource_element) ? 1 : 0),
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
    avoidElements: Set<string>,
    hanjaPool: HanjaPool,
    candidateRejections: CandidateRejectionAccumulator,
  ): Promise<Map<number, HanjaEntry[]>> {
    // Pre-load the full hanja pool. Full-pool resource elements are
    // stroke-derived until PR-2.3, so only curated entries use resource 오행
    // for pre-score exclusion.
    const canFilterAvoidedResourceElement = hanjaPool === 'curated';
    const fullPool = this.filterPresentationSafeEntries(
      await this.findGenerationPoolByStrokeRange(STROKE_MIN, STROKE_MAX, hanjaPool),
      hanjaPool,
      candidateRejections,
    ).filter(entry =>
      !entry.is_surname
      && (!canFilterAvoidedResourceElement || !avoidElements.has(entry.resource_element)));

    const pools = new Map<number, HanjaEntry[]>();

    for (let position = 0; position < nameLength; position++) {
      const jamoFilter    = jamoFilters?.[position];
      const givenNameChar = request.givenName?.[position];

      // Case A: no jamo filter at this position and user supplied a character
      if (jamoFilter === null && givenNameChar) {
        pools.set(position, await this.resolveFixedCharPool(givenNameChar, hanjaPool));
        continue;
      }

      // Case B: filter the full pool by jamo onset/nucleus, then take top N
      let filtered = fullPool;
      if (jamoFilter?.onset)   filtered = filtered.filter(entry => entry.onset === jamoFilter.onset);
      if (jamoFilter?.nucleus) filtered = filtered.filter(entry => entry.nucleus === jamoFilter.nucleus);

      filtered = [...filtered].sort((a, b) =>
        (targetElements.has(b.resource_element) ? 1 : 0)
        - (targetElements.has(a.resource_element) ? 1 : 0),
      );

      pools.set(position, filtered.slice(0, POOL_LIMIT_JAMO_FILTERED));
    }

    return pools;
  }

  /** Resolve a single user-specified character into a 1-element pool. */
  private async resolveFixedCharPool(givenNameChar: NameCharInput, hanjaPool: HanjaPool): Promise<HanjaEntry[]> {
    return resolveFixedNameCharacterPool(givenNameChar, this.hanjaRepo, {
      hanjaPool,
      poolLimit: POOL_LIMIT_SINGLE_CHAR,
      fullPoolEntries: getFullLegalPoolEntries,
    });
  }

  // -------------------------------------------------------------------------
  // resolveEntries -- look up full HanjaEntry records for a name
  // -------------------------------------------------------------------------

  private async resolveEntries(
    chars: NameCharInput[],
    options: ResolveNameEntriesOptions = {},
  ): Promise<HanjaEntry[]> {
    return resolveNameEntries(chars, this.hanjaRepo, {
      ...options,
      fullPoolEntries: getFullLegalPoolEntries,
    });
  }

  // -------------------------------------------------------------------------
  // getFortuneReport -- fortune report combining saju + optional name analysis
  // -------------------------------------------------------------------------

  async getFortuneReport(request: FortuneReportRequest): Promise<FortuneReport> {
    // 1. Reject malformed or unbounded horizons before database or astronomy work.
    const birthYear = request.birth.year;
    if (typeof birthYear !== 'number' || !Number.isInteger(birthYear)) {
      throw new SajuRequestValidationError('birth year must be a finite integer', 'BIRTH_DATE_INVALID');
    }
    const targetDate = parseFortuneTargetDate(request.targetDate, request.birth);
    const reportOptions = optionsForFortuneTarget(request.options, targetDate, birthYear);
    validateSajuRequestOptions(reportOptions.sajuOptions, birthYear);
    validateSajuConfigFortuneHorizon(reportOptions.sajuConfig);
    await this.init();

    // 2. Run saju analysis
    const sajuReport = await this.getSajuReport({
      birth: request.birth,
      surname: request.surname ?? [],
      options: reportOptions,
    });
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
    const saju: SajuSummary = sajuReport;
    assertScorableSajuSummary(sajuReport);

    // 3. Optionally run spring report if name is provided
    let springReport: SpringReport | null = null;
    if (request.givenName && request.givenName.length > 0) {
      // A supplied name is an explicit request for name compatibility. Data
      // corruption, cancellation and infrastructure failures must remain
      // visible rather than silently degrading to a successful nameless
      // fortune report.
      springReport = await this.getSpringReport(
        {
          birth: request.birth,
          surname: request.surname ?? [],
          givenName: request.givenName,
          mode: 'evaluate',
          options: reportOptions,
        },
        sajuReport,
      );
    }

    // 4. Build the fortune report
    // PR-Q-12 (Phase M-D6): fortuneCascadeMode default flips
    // 'simple' → 'jie_based'. saju-ts 의 정확한 절기 boundary 사용 — 60 일 / 년
    // (16%) 정확도 회복. Callers can opt out via explicit 'simple'.
    const pc = reportOptions.precisionConfig;
    const fortuneCascadeMode = pc?.fortuneCascadeMode ?? 'jie_based';
    return buildFortuneReport(saju, targetDate, springReport, {
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
    }, request.birth);
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
    this.fourFrameMeaningByNumber = new Map();
    this.validFourFrameNumbers = new Set();
    this.nameStatInfoCache.clear();
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
