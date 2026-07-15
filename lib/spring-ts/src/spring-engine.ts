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
import { FourframeRepository } from '../../seed-ts/src/database/fourframe-repository.js';
import {
  NameStatRepository,
  type NameStatEntry,
} from '../../seed-ts/src/database/name-stat-repository.js';
import { Polarity } from '../../seed-ts/src/model/polarity.js';
import { HangulCalculator } from './calculator/hangul-calculator.js';
import { HanjaCalculator } from './calculator/hanja-calculator.js';
import { FrameCalculator } from './calculator/frame-calculator.js';
import { evaluateName, type EvalContext, type EvaluationResult } from './core/evaluator.js';
import { type ElementKey, bucketFromFortune } from './core/scoring.js';
import { FourFrameOptimizer } from './calculator/search.js';
import { makeFallbackEntry, buildInterpretation, parseJamoFilter, decomposeHangul, type JamoFilter } from './core/name-utils.js';
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

// ---------------------------------------------------------------------------
// Config -- all tuneable numbers come from engine.json
// ---------------------------------------------------------------------------

const MAX_CANDIDATES            = engineConfig.maxCandidates;
const POOL_LIMIT_SINGLE_CHAR    = engineConfig.candidatePoolLimits.singleCharPerStroke;
const POOL_LIMIT_DOUBLE_CHAR    = engineConfig.candidatePoolLimits.doubleCharPerPosition;
const POOL_LIMIT_JAMO_FILTERED  = engineConfig.candidatePoolLimits.jamoFilteredPerPosition;
const STROKE_MIN                = engineConfig.strokeRange.min;
const STROKE_MAX                = engineConfig.strokeRange.max;
const DEFAULT_OFFSET            = engineConfig.pagination.defaultOffset;
const DEFAULT_LIMIT             = engineConfig.pagination.defaultLimit;
const FOURFRAME_LOAD_LIMIT      = engineConfig.fourframeLoadLimit;
const LUCKY_LEVEL_KEYWORDS      = engineConfig.luckyLevelKeywords;
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

/** Round a score to one decimal place. */
function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, roundScore(value)));
}

function finiteScore(value: unknown): number | null {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clampScore(numeric) : null;
}

function averageScores(values: Array<number | null | undefined>): number | null {
  const finite = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!finite.length) return null;
  return clampScore(finite.reduce((sum, value) => sum + value, 0) / finite.length);
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

const NAMING_AXIS_DISPLAY_LABELS: Readonly<Record<keyof NamingScoreVector | 'riskQuality', string>> = {
  legal: '법적 사용 가능성',
  sajuFit: '사주 보완',
  yongshinFit: '용신 보강',
  elementBalance: '오행 균형',
  hanjaMeaning: '한자 의미',
  phonetic: '발음 흐름',
  eraFit: '시대감',
  familyFit: '성과 이름 연결',
  risk: '주의 신호',
  riskQuality: '주의 신호 안정도',
};

function elementDisplayLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return ELEMENT_DISPLAY_LABELS[trimmed] ?? ELEMENT_DISPLAY_LABELS[trimmed.toUpperCase()] ?? trimmed;
}

function formatCandidateScore(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${roundScore(value)}점`
    : '자료 없음';
}

const SERVICE_TEXT_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ['파괴운', '분산 주의 흐름'],
  ['흉운수', '주의가 필요한 수리'],
  ['흩어지는 수', '에너지가 흩어지기 쉬운 수'],
  ['외로워지기 쉬운 수', '혼자 감당하는 느낌이 커지기 쉬운 수'],
  ['이별이 따르기 쉬운 수', '관계의 거리감에 신경 쓰면 좋은 수'],
  ['모든 것이 한곳에 모이기 어렵고 흩어지는 형상', '에너지가 여러 방향으로 흩어지기 쉬운 형상'],
  ['모든 것이 흩어지는 형상', '에너지가 여러 방향으로 흩어지기 쉬운 형상'],
  ['재물이 새어나가는 기운', '예상 밖 지출이 생기기 쉬운 흐름'],
  ['재물이 빠져나가는 기운', '예상 밖 지출이 생기기 쉬운 흐름'],
  ['예상 밖 지출이 생기기 쉬운 흐름이 따라 돈과 마음의 안정감을', '예상 밖 지출이 생기기 쉬워 돈과 마음의 안정감을'],
  ['경제적으로나 마음으로나 쉽게 안정되기 어려운 파동', '돈과 마음의 안정감을 꾸준히 관리할 필요가 있는 흐름'],
  ['돈과 마음의 안정감을 꾸준히 관리할 필요가 있는 흐름이 있어요', '돈과 마음의 안정감을 꾸준히 관리할 필요가 있어요'],
  ['특히 조심하면 좋을 점은', '미리 살펴보면 좋은 점은'],
  ['님은 미리 살펴보면 좋은 점은', '님이 미리 살펴보면 좋은 점은'],
  ['잦은 마찰이나 멀어짐', '작은 오해나 거리감'],
  ['충동적인 투자나 다른 사람의 보증, 무리한 사업 확장은 반드시 피하시고', '충동적인 투자, 보증, 무리한 확장은 되도록 피하고'],
  ['규칙적인 운동과 정기 건강 검진으로 몸과 마음의 균형을 유지하시길 권해 드려요', '규칙적인 운동과 충분한 휴식으로 생활 리듬을 안정적으로 유지해 보세요'],
  ['정기 건강 검진', '컨디션 점검'],
  ['건강 검진', '컨디션 점검'],
  ['정기 검진', '컨디션 점검'],
  ['심리치료, 사회복지, 의료봉사', '마음 돌봄, 사회복지, 봉사 활동'],
  ['심리치료', '마음 돌봄'],
  ['의료봉사', '봉사 활동'],
  ['건강 면에서도 특별히 신경을 써야 한다고', '건강 면에서도 기본 관리를 챙기면 좋다고'],
  ['가정환경이 불안정하거나 부모 형제와의 인연이 약한 흐름이 나타날 수 있어', '가정 안에서 변화나 거리감을 느낄 수 있어'],
  ['사람 관계가 끊어졌다 이어지기를 반복할 수 있는데', '사람 관계의 변화가 잦을 수 있는데'],
  ['경제적 오르내림과 가정 안에서의 갈등에 주의해야 하지만', '돈 관리와 가까운 사람과의 대화를 차분히 챙기면 좋고'],
  ["'어려움을 참고 견디면 반드시 뒤에 복이 온다'는 원리대로", '어려운 시기를 지나며 안정감을 만들어 갈 수 있다는 관점으로'],
  ["'어려움을 참고 견디면 반드시 뒤에 복이 온다'", "'어려운 시기를 지나며 뒤늦게 안정감을 만들 수 있다'"],
  ['어려움을 참고 견디면 반드시 뒤에 복이 온다', '어려운 시기를 지나며 뒤늦게 안정감을 만들 수 있다'],
  ['힘든 일을 참고 견디면 반드시 뒤에 복이 찾아온다는 뜻', '힘든 시기를 지나며 뒤늦게 안정감을 만들 수 있다는 뜻'],
  ['반드시 걱정할 필요 없이', '크게 걱정하기보다'],
  ['최고의 자리에 올라 큰 성공을 이루게 되는', '높은 수준의 성과를 만들 가능성이 큰'],
  ['최고의 자리에 오르는', '높은 수준의 성과를 향해 가는'],
  ['최고의 자리', '높은 수준의 자리'],
  ['높은 자리에 오르게 되는 흐름', '책임 있는 역할을 맡기 쉬운 흐름'],
  ['부와 명예를 동시에 손에 넣는', '성과와 인정을 함께 얻는'],
  ['반드시 좋은 결과를 맺는', '좋은 결과를 만들 가능성이 큰'],
  ['반드시 큰 일을 이루어 많은 사람들이 우러러보는 자리에 이르는, 정말 복된 수리예요', '큰 일을 이룰 가능성이 커서 주변의 인정을 받을 수 있는 수리예요'],
  ['반드시 뜻깊은 열매를 거두실 거예요', '뜻깊은 결실을 만들 수 있어요'],
  ['반드시 풍성한 결실을 맺을 수 있을 거예요', '풍성한 결실을 만들 수 있어요'],
  ['어떤 시련 앞에서도', '어려운 상황에서도'],
  ['시련기', '조정기'],
  ['시련', '어려움'],
  ['분산 주의 흐름의 무게', '흩어지는 흐름의 부담'],
  ['흩어지는 흐름의 부담를', '흩어지는 흐름의 부담을'],
  ['최상의 좋은 수', '매우 좋은 수'],
  ['이름을 널리 떨치고 풍요와 명예를 동시에 이루는', '성과와 인정을 함께 얻기 쉬운'],
  ['눈부신 성공', '뚜렷한 성과'],
  ['눈부신 성과', '뚜렷한 성과'],
  ['전성기를 맞이해요', '강점이 잘 드러나는 시기를 맞이해요'],
  ['사회적으로 이름을 알리게 되는 강점이 잘 드러나는 시기를 맞이해요', '주변에 실력을 알릴 기회가 커지는 시기를 맞이해요'],
  ['이름을 떨치는 황금기', '성과가 드러나기 쉬운 시기'],
  ['하늘을 찌르는 기상이 절정에 달하여', '강한 추진력과 자신감이 크게 드러나'],
  ['많은 사람들이 우러러보는 높은 자리에 오르고', '주변의 인정을 받는 역할을 맡고'],
  ['윗사람의 신뢰와 아랫사람의 충성을 함께 얻는 전성기예요', '윗사람과 동료의 신뢰를 함께 얻기 쉬운 시기예요'],
  ['존경받는 어른의 위치에서 풍요롭고 건강한 만년을 누리시며, 후대에 귀한 덕을 물려주시는 자리에 이르실 수 있어요', '주변에 좋은 영향을 주며 안정적인 노년을 보낼 가능성이 있어요'],
  ['이성 문제나 자만심을 경계하셔야 해요', '가까운 관계의 오해나 자만심을 주의하면 좋아요'],
  ['융창운의 좋은 흐름이 생애 전체에 고르게 펼쳐질 거예요', '융창운의 좋은 흐름이 더 안정적으로 이어질 수 있어요'],
  ['좋은 흐름이 생애 전체에 고르게 펼쳐질 거예요', '좋은 흐름이 더 안정적으로 이어질 수 있어요'],
  ['풍부운의 절정기로, 힘과 재물이 동시에 모여드는 인생의 황금기가 펼쳐져요', '풍부운이 강하게 드러나는 시기로, 성과와 경제적 여유가 함께 커지기 쉬워요'],
  ['사회적 이름값과 경제적 풍요를 동시에 누리실 수 있어요', '사회적 인정과 경제적 여유를 함께 느낄 수 있어요'],
  ['주변의 인정과 부를 동시에 얻는 황금기', '주변의 인정과 경제적 안정감을 함께 얻는 좋은 시기'],
  ['주변의 인정과 경제적 안정감을 함께 얻는 좋은 시기가 펼쳐지니', '주변의 인정과 경제적 안정감을 함께 키우기 좋은 흐름이 생기니'],
  ['이 시기를 놓치지 않도록 잘 준비하시길 권해 드려요', '이 흐름을 차분히 준비해 보세요'],
  ['깊은 존경과 편안한 노년을 누리실 수 있어요', '좋은 신뢰와 나중의 안정감을 준비해 갈 수 있어요'],
  ['좋은 신뢰와 안정적인 노년을 만들어 갈 수 있어요', '좋은 신뢰와 나중의 안정감을 준비해 갈 수 있어요'],
  ['기회가 물밀듯 찾아오는', '기회가 자주 들어오는'],
  ['사회에 나가자마자 빠른 속도로 두각을 나타내고', '사회생활 초반부터 두각을 나타내고'],
  ['중년기에 크게 이루기 위한', '중년기에 성과를 키우기 위한'],
  ['크게 번창하며', '안정적으로 성장하며'],
  ['힘과 재물을 동시에 손에 넣을 수 있는', '실행력과 경제적 성과가 함께 커지기 쉬운'],
  ['더할 나위 없이 좋은 수', '좋은 수'],
  ['오래오래 잘 사는 삶을 이루는', '오래 안정적으로 살아가는 데 도움이 되는'],
  ['오래오래 건강하게 사는 기운', '오래 이어 갈 안정감'],
  ['마른 나무에서 꽃이 피는 기운이 드디어 빛을 발하는 황금기', '오랫동안 쌓은 실력이 드러나는 좋은 시기'],
  ['세상에 인정받으며 이름과 존경을 얻게 되는 시기예요', '주변의 인정과 신뢰를 얻기 쉬운 시기예요'],
  ['기운의 흐름이 부딪히는 시기라면 결혼을 서두르기보다', '기운의 흐름이 부딪히는 시기라면 중요한 관계 결정을 서두르기보다'],
  ['보다 안정적인 가정을 꾸리시는 것이 좋아요', '보다 안정적인 관계의 기반을 만들면 좋아요'],
  ['아름다운 마무리가 기다리고 있으니', '좋은 마무리를 만들 수 있으니'],
  ['존경과 사랑을 받으시는', '좋은 평가를 받는'],
  ['아름다운 결실을 거두시길 진심으로 응원해요', '좋은 결실을 만들어 가세요'],
  ['밝은 기운과 함께하시길 진심으로 응원해요', '밝은 기운을 잘 이어가세요'],
  ['진심으로 응원해요', '차분히 이어가세요'],
  ['모든 일이 잘 풀리는 아름다운 인생', '일이 더 안정적으로 풀리는 흐름'],
  ['축복', '좋은 흐름'],
  ['하늘이 내린 복', '좋은 잠재력'],
  ['타고나셨어요', '보이는 편이에요'],
  ['타고나서', '갖고 있어서'],
  ['이 시기야말로 하나의 전문 분야를 정하고 꾸준히 실력을 쌓아가는 것이 훗날의 안정을 여는 열쇠예요', '이 시기에는 하나의 전문 분야를 정하고 꾸준히 실력을 쌓아 가면 훗날 안정의 기반이 돼요'],
  ['기초를 다져두시면, 그것이 나중에 평생의 자산이 된답니다', '기초를 다져 두면 나중에 평생의 자산이 돼요'],
  ['화려한 성공보다 실력을 묵묵히 쌓아가는 것이 중요하며', '화려한 성공보다 실력을 묵묵히 쌓아 가는 태도가 중요하고'],
  ['한 분야에 집중하시면 중년에 크게 꽃피울 토대가 만들어져요', '한 분야에 집중하면 중년에 실력이 크게 드러날 토대가 만들어져요'],
  ['꾸준히 실력을 쌓아가는', '꾸준히 실력을 쌓아 가는'],
  ['묵묵히 쌓아가는', '묵묵히 쌓아 가는'],
  ['기초를 다져두시면', '기초를 다져 두면'],
  ['집중하시면', '집중하면'],
  ['집중하시고', '집중하고'],
  ['준비하셔서', '준비해서'],
  ['주변의 주목을 받으시지만', '주변의 주목을 받지만'],
  ['답답함을 경험하실 수 있어요', '답답함을 경험할 수 있어요'],
  ['뚜렷한 성과을 거두시지만', '뚜렷한 성과를 거두지만'],
  ['돈 문제가 찾아올 수 있으며', '돈 문제가 찾아올 수 있고'],
  ['결정을 내리실 수 있게 되며', '결정을 내릴 수 있게 되고'],
  ['기반을 다지시는 데 집중하면', '기반을 다지는 데 집중하면'],
  ['기회를 만드실 수 있어요', '기회를 만들 수 있어요'],
  ['노후를 누리실 수 있어요', '후반기를 준비할 수 있어요'],
  ['노후를 누릴 수 있어요', '후반기를 준비할 수 있어요'],
  ['좋은 경험을 많이 쌓으시는 것이 좋아요', '좋은 경험을 많이 쌓으면 좋아요'],
  ['목표를 향해 달려가시게 되는데', '목표를 향해 달려가게 되는데'],
  ['사람 사이 갈등을 조심하시고', '사람 사이 갈등을 조심하고'],
  ['겸손함을 함께 실천하시면', '겸손함을 함께 실천하면'],
  ['사회적 인정을 받으실 수 있어요', '사회적 인정을 받을 수 있어요'],
  ['따뜻한 마음을 더하시면', '따뜻한 마음을 더하면'],
  ['넓은 시야를 키워두시면', '넓은 시야를 키워 두면'],
  ['실력을 먼저 쌓으시면', '실력을 먼저 쌓으면'],
  ['차근차근 기반을 다져 나가시게 되며', '차근차근 기반을 다져 나가게 되고'],
  ['직장에 들어가시면', '직장에 들어가면'],
  ['아래에서 출발하시더라도', '아래에서 출발하더라도'],
  ['동시에 얻으시게 되며', '동시에 얻게 되고'],
  ['보내실 수 있어요', '보낼 수 있어요'],
  ['느끼실 수 있어요', '느낄 수 있어요'],
  ['가꾸어 가시길 권해 드려요', '가꾸어 가면 좋아요'],
  ['후배나 후진', '후배나 다음 세대'],
  ['후배나 다음 세대을', '후배나 다음 세대를'],
  ['부귀와 명예', '성과와 인정'],
  ['자녀분들이', '자녀가'],
  ['겸손과 화합을 놓지 않으신다면', '겸손과 화합을 놓지 않으면'],
  ['좋은 흐름을 만들어 주는 좋은 운이에요', '좋은 흐름이에요'],
  ['건강하고 번창한다는 이름 그대로', '건강하고 활기찬 흐름처럼'],
  ['넉넉하고 오래오래 건강한 기운 그대로, ', '넉넉하고 건강한 흐름 속에서, '],
  ['건강하고 여유로운 노후를 보내시며', '건강하고 여유로운 노후를 보내며'],
  ['부자의 복이 온전히 열매를 맺어', '재물 안정의 흐름이 열매를 맺어'],
  ['23수 융창운의 기운이 본격적으로 꽃을 피우는 성과가 드러나기 쉬운 시기로', '23수 융창운의 기운이 본격적으로 드러나는 시기로'],
  ['똑똑한 머리와 남다른 담력', '빠른 이해력과 남다른 담력'],
  ['똑똑한 머리와 끈기 있는 적극적 행동', '빠른 이해력과 끈기 있는 행동'],
  ['똑똑한 머리', '빠른 이해력'],
  ['남다른 똑똑함과 활발한 기질', '빠른 이해력과 활발한 기질'],
  ['남다른 똑똑함', '빠른 이해력'],
  ['똑똑하고 재능이 빛나지만', '이해가 빠르고 재능이 빛나지만'],
  ['빠른 이해력와', '빠른 이해력과'],
  ['특유의 추진력과 머리로', '특유의 추진력과 판단력으로'],
  ['쌓아온 명성과 풍요', '쌓아 온 성과와 여유'],
  ['건강하고 활기찬 흐름처럼 건강하고 활기찬 노후를 보내실 수 있으니', '활기찬 후반기를 준비할 수 있으니'],
  ['건강하고 활기찬 노후를 보낼 수 있으니', '활기찬 후반기를 준비할 수 있으니'],
  ['노후를 보내실 수 있으니', '후반기를 준비할 수 있으니'],
  ['노후를 보낼 수 있으니', '후반기를 준비할 수 있으니'],
  ['넉넉하고 건강한 흐름 속에서, 건강하고 여유로운 노후를 보내며', '건강과 여유를 챙기며'],
  ['사회적 명성과 존경', '사회적 신뢰와 인정'],
  ['명성이 가장 높은 곳에 이르러', '성과가 크게 드러나'],
  ['재물 모으는 운이 본격적으로 꽃을 피우는 전성기', '재물 흐름이 또렷해지는 시기'],
  ['큰 재물과 사회적 명성', '경제적 안정과 사회적 인정'],
  ['자녀가 잘 되고 번창하며', '가족 안에서도 안정감이 커지며'],
  ['17수의 용감하게 나아가는 기운', '17수의 앞으로 나아가는 기운'],
  ['빠른 성공과 사회적 인정을', '빠른 성장과 사회적 인정을'],
  ['큰일을 이루고 많은 사람의 존경을 받는', '큰 성과를 만들고 주변의 인정을 받는'],
  ['복된 삶이 기다리고 있으니', '안정된 삶을 기대할 수 있으니'],
  ['마침내 열매를 맺어 마음의 풍요와 내면의 평화를 누릴 수 있으니', '시간이 지나며 안정감과 마음의 여유를 만들 수 있으니'],
  ['건강과 안정의 흐름이 무르익어서 건강과 재물, 평판이 고루 갖추어진', '몸과 마음이 안정되고 재물과 평판도 고르게 챙기는'],
  ['사람 복', '사람의 도움'],
  ['적은 노력으로도 많은 재물을 얻게 되는 부자 운', '성과를 효율적으로 키우는 흐름'],
  ['잘난 척하는 마음', '자기주장이 강하게 보이는 태도'],
  ['잘난 척과', '자기주장이 강하게 보이는 태도와'],
  ['잘난 척이나', '자기주장이 강하게 보이는 태도나'],
  ['잘난 척', '자기주장이 강하게 보이는 태도'],
  ['성공의 열매', '성과'],
  ['복과 오래 사는 기운', '건강과 안정의 흐름'],
  ['풍요로운 생활을 누리게 되며', '여유로운 생활을 기대할 수 있고'],
  ['주변 사람들한테', '주변 사람들에게'],
  ['존경받는 어른이자 좋은 선생님 같은 자리', '신뢰받는 조언자 같은 자리'],
  ['이름값', '평판'],
  ['받으시지만', '받지만'],
  ['경험하실 수 있어요', '경험할 수 있어요'],
  ['하실 수 있어요', '할 수 있어요'],
  ['하시고', '하고'],
  ['하시면', '하면'],
  ['하시되', '하되'],
];

function sanitizeServiceText(value: string, fullHangul: string): string {
  const displayName = fullHangul.trim() || '이름 주인공';
  let sanitized = value.replace(/\[성함\]/g, displayName);
  for (let pass = 0; pass < 3; pass += 1) {
    const before = sanitized;
    for (const [search, replacement] of SERVICE_TEXT_REPLACEMENTS) {
      sanitized = sanitized.replaceAll(search, replacement);
    }
    if (sanitized === before) break;
  }
  sanitized = sanitized
    .replace(/([가-힣]+)님께서도/g, '$1님도')
    .replace(/([가-힣]+)님께서는/g, '$1님은')
    .replace(/([가-힣]+)님께서/g, '$1님은')
    .replace(/([가-힣]+)님은도/g, '$1님도')
    .replace(/([가-힣]+)님은 각/g, '$1님이 각')
    .replace(/([가-힣]+님) 한평생/g, '$1은 한평생')
    .replace(/성과와 인정를/g, '성과와 인정을')
    .replace(/성과을/g, '성과를')
    .replace(/뒷받침해주지/g, '뒷받침해 주지');
  return sanitized;
}

function sanitizeServiceValue<T>(value: T, fullHangul: string): T {
  if (typeof value === 'string') {
    return sanitizeServiceText(value, fullHangul) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeServiceValue(item, fullHangul)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitizeServiceValue(nested, fullHangul);
    }
    return out as T;
  }
  return value;
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

interface NameStatInfo {
  readonly exists: boolean;
  readonly popularityRank: number | null;
  readonly maleRatio: number | null;
  readonly nameGender: NameGenderTendency;
}

interface NameResolutionPolicy {
  readonly pureHangulGivenName: boolean;
  readonly useSurnameHanjaInPureHangul: boolean;
}

interface CandidateSelectionInfo {
  readonly score: number;
  readonly vector?: NamingScoreVector;
  readonly profile?: CandidateStrengthProfile;
  readonly givenHangul: string;
  readonly givenHanja: string;
  readonly syllables: readonly string[];
  readonly orthodoxHanjas: readonly string[];
}

interface CandidateDiversityState {
  readonly profileCounts: Map<string, number>;
  readonly syllableCounts: Map<string, number>;
  readonly hanjaCounts: Map<string, number>;
  readonly hangulCounts: Map<string, number>;
  readonly hanjaNameCounts: Map<string, number>;
}

interface ResolveEntriesOptions {
  readonly forceHangulOnly?: boolean;
  readonly isSurname?: boolean;
  readonly hanjaPool?: HanjaPool;
}

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

// ---------------------------------------------------------------------------
// SpringEngine
// ---------------------------------------------------------------------------

export class SpringEngine {
  private hanjaRepo = new HanjaRepository();
  private fourFrameRepo = new FourframeRepository();
  private nameStatRepo = new NameStatRepository();
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private luckyMap = new Map<number, string>();
  private validFourFrameNumbers = new Set<number>();
  private optimizer: FourFrameOptimizer | null = null;
  private readonly nameStatInfoCache = new Map<string, NameStatInfo>();
  private readonly candidateRejections = new Map<string, CandidateRejectionBucket>();

  /** Expose the hanja repository so the UI can perform hanja lookups. */
  getHanjaRepository(): HanjaRepository { return this.hanjaRepo; }

  // -------------------------------------------------------------------------
  // init -- three-step bootstrap
  // -------------------------------------------------------------------------

  async init(): Promise<void> {
    // Fast path: already initialized.
    if (this.initialized) return;
    // Concurrent init: every caller awaits the same promise rather than
    // re-running the heavy steps below.
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // Step 1: Open repositories in parallel
        await Promise.all([
          this.hanjaRepo.init(),
          this.fourFrameRepo.init(),
          this.nameStatRepo.init(),
        ]);

        // Step 2: Load four-frame fortune data and build the lucky-number set
        await this.buildLuckyNumberSet();

        // Step 3: Create the four-frame optimizer used for candidate generation
        this.optimizer = new FourFrameOptimizer(this.validFourFrameNumbers);

        this.initialized = true;
      } catch (err) {
        // Failed init: clear the cached promise so a subsequent caller can retry.
        this.initPromise = null;
        throw err;
      }
    })();
    return this.initPromise;
  }

  /** Scan all four-frame records and classify each by its lucky level. */
  private async buildLuckyNumberSet(): Promise<void> {
    const allRecords = await this.fourFrameRepo.findAll(FOURFRAME_LOAD_LIMIT);

    for (const record of allRecords) {
      const luckyLevel = record.lucky_level ?? '';
      this.luckyMap.set(record.number, luckyLevel);

      const isLucky = LUCKY_LEVEL_KEYWORDS.some(keyword => luckyLevel.includes(keyword));
      if (isLucky) {
        this.validFourFrameNumbers.add(record.number);
      }
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

  private resetCandidateRejections(): void {
    this.candidateRejections.clear();
  }

  private recordCandidateRejection(
    reason: string,
    entry: Partial<NameCharInput>,
    detail?: string,
  ): void {
    const bucket = this.candidateRejections.get(reason) ?? {
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
    this.candidateRejections.set(reason, bucket);
  }

  private candidateRejectionSummary(): CandidateRejectionBucket[] {
    return Array.from(this.candidateRejections.values())
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
  /** Build the evaluator-side hints (PR8) from a request's precisionConfig +
   *  birth.hour presence. Returns undefined when no PR8 flag is active so
   *  SajuCalculator's putInsight can store undefined → spring-evaluator's
   *  extractSajuPriority falls through to the linear default. */
  private resolveEvaluatorHints(birth: BirthInfo | undefined, options?: SpringRequest['options']): SajuEvaluatorHints | undefined {
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
    // The guard only takes effect when `birth.hour == null` (시간미상);
    // hour-known fixtures are unaffected. Callers can opt out explicitly
    // with `precisionConfig.unknownHourGuard: false`.
    const guardEnabled = pc.unknownHourGuard !== false;
    if (guardEnabled) {
      hints.unknownHourGuard = true;
      hints.isHourUnknown = birth?.hour == null;
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

  private shouldUseParetoFrontier(options?: SpringRequest['options']): boolean {
    return options?.precisionConfig?.paretoFrontierCandidates === true;
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

  private deriveCandidateStrengthProfile(
    vector: NamingScoreVector,
    paretoFrontier: boolean = false,
  ): CandidateStrengthProfile {
    const riskQuality = clampScore(100 - vector.risk);
    const profileRows: Array<{
      readonly id: CandidateStrengthProfile['id'];
      readonly label: string;
      readonly primaryAxis: CandidateStrengthProfile['primaryAxis'];
      readonly score: number | null;
      readonly axes: Array<keyof NamingScoreVector | 'riskQuality'>;
    }> = [
      {
        id: 'saju_reinforcement',
        label: '사주 보완형',
        primaryAxis: 'sajuFit',
        score: averageScores([vector.sajuFit, vector.yongshinFit, vector.elementBalance]),
        axes: ['sajuFit', 'yongshinFit', 'elementBalance'],
      },
      {
        id: 'phonetic_stability',
        label: '발음 안정형',
        primaryAxis: 'phonetic',
        score: averageScores([vector.phonetic, vector.familyFit, riskQuality]),
        axes: ['phonetic', 'familyFit', 'riskQuality'],
      },
      {
        id: 'era_balance',
        label: '시대 조화형',
        primaryAxis: 'eraFit',
        score: averageScores([vector.eraFit, riskQuality]),
        axes: ['eraFit', 'riskQuality'],
      },
      {
        id: 'legal_meaning',
        label: '한자 의미 안정형',
        primaryAxis: 'legal',
        score: averageScores([vector.legal, vector.hanjaMeaning, riskQuality]),
        axes: ['legal', 'hanjaMeaning', 'riskQuality'],
      },
      {
        id: 'risk_managed',
        label: '위험 관리형',
        primaryAxis: 'risk',
        score: riskQuality,
        axes: ['riskQuality'],
      },
      {
        id: 'balanced',
        label: '균형형',
        primaryAxis: 'balanced',
        score: averageScores([
          vector.legal,
          vector.sajuFit,
          vector.yongshinFit,
          vector.elementBalance,
          vector.hanjaMeaning,
          vector.phonetic,
          vector.eraFit,
          vector.familyFit,
          riskQuality,
        ]),
        axes: ['legal', 'sajuFit', 'yongshinFit', 'elementBalance', 'hanjaMeaning', 'phonetic', 'eraFit', 'familyFit', 'riskQuality'],
      },
    ];
    const selected = profileRows
      .filter((row): row is typeof profileRows[number] & { readonly score: number } => row.score !== null)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0];

    if (!selected) {
      return {
        id: 'balanced',
        label: '균형형',
        primaryAxis: 'balanced',
        reasons: ['비교할 수 있는 점수 벡터 축이 아직 없어요.'],
        displayReasons: ['비교할 수 있는 점수 정보가 아직 없어요.'],
        paretoFrontier,
      };
    }

    const displayReasons = selected.axes
      .map((axis) => {
        const value = axis === 'riskQuality' ? riskQuality : vector[axis];
        return `${NAMING_AXIS_DISPLAY_LABELS[axis]} ${formatCandidateScore(value)}`;
      });

    return {
      id: selected.id,
      label: selected.label,
      primaryAxis: selected.primaryAxis,
      reasons: displayReasons,
      displayReasons,
      paretoFrontier,
    };
  }

  private withParetoFlag(
    profile: CandidateStrengthProfile | undefined,
    paretoFrontier: boolean,
  ): CandidateStrengthProfile | undefined {
    return profile ? { ...profile, paretoFrontier } : undefined;
  }

  private normalizedHanjaKey(hanja: string | undefined): string {
    const value = String(hanja ?? '').trim();
    return hasHanIdeograph(value) ? normalizeToOrthodoxHanja(value) : '';
  }

  private nameDiversityInfo(chars: readonly NameCharInput[]): {
    readonly givenHangul: string;
    readonly givenHanja: string;
    readonly syllables: readonly string[];
    readonly orthodoxHanjas: readonly string[];
    readonly hasRepeatedSyllable: boolean;
    readonly hasRepeatedOrthodoxHanja: boolean;
  } {
    const syllables = chars.map((char) => String(char.hangul ?? '').trim()).filter(Boolean);
    const orthodoxHanjas = chars
      .map((char) => this.normalizedHanjaKey(char.hanja))
      .filter(Boolean);
    return {
      givenHangul: syllables.join(''),
      givenHanja: orthodoxHanjas.join(''),
      syllables,
      orthodoxHanjas,
      hasRepeatedSyllable: new Set(syllables).size < syllables.length,
      hasRepeatedOrthodoxHanja: new Set(orthodoxHanjas).size < orthodoxHanjas.length,
    };
  }

  private filterInternallyRepeatedCandidates(candidates: NameCharInput[][]): NameCharInput[][] {
    const filtered: NameCharInput[][] = [];
    for (const candidate of candidates) {
      const info = this.nameDiversityInfo(candidate);
      if (info.hasRepeatedSyllable || info.hasRepeatedOrthodoxHanja) {
        this.recordCandidateRejection(
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

  private filterPresentationSafeEntries(entries: readonly HanjaEntry[], hanjaPool: HanjaPool): HanjaEntry[] {
    const filtered: HanjaEntry[] = [];
    for (const entry of entries) {
      const unsafeMeaning = hasUnsafeHanjaMeaning(entry);
      const opaqueMeaning = hasOpaqueHanjaMeaning(entry);
      const weakMeaning = hasWeakRecommendationHanjaMeaning(entry);
      if (unsafeMeaning || opaqueMeaning || weakMeaning) {
        const legal = getLegalAnnotation(entry, { pool: hanjaPool });
        this.recordCandidateRejection(
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

  private vectorDominates(a: NamingScoreVector, b: NamingScoreVector): boolean {
    const axisValues = (vector: NamingScoreVector): Array<number | null> => [
      vector.legal,
      vector.sajuFit,
      vector.yongshinFit,
      vector.elementBalance,
      vector.hanjaMeaning,
      vector.phonetic,
      vector.eraFit,
      vector.familyFit,
      100 - vector.risk,
    ];
    const aValues = axisValues(a);
    const bValues = axisValues(b);
    let comparable = 0;
    let strictlyBetter = false;
    for (let index = 0; index < aValues.length; index += 1) {
      const left = aValues[index];
      const right = bValues[index];
      if (left == null || right == null) continue;
      comparable += 1;
      if (left < right - 0.000001) return false;
      if (left > right + 0.000001) strictlyBetter = true;
    }
    return comparable >= 2 && strictlyBetter;
  }

  private emptyDiversityState(): CandidateDiversityState {
    return {
      profileCounts: new Map(),
      syllableCounts: new Map(),
      hanjaCounts: new Map(),
      hangulCounts: new Map(),
      hanjaNameCounts: new Map(),
    };
  }

  private diversityPenalty(info: CandidateSelectionInfo, state: CandidateDiversityState): number {
    let penalty = 0;
    penalty += (state.profileCounts.get(info.profile?.id ?? '') ?? 0) * 4;
    penalty += (state.hangulCounts.get(info.givenHangul) ?? 0) * 8;
    if (info.givenHanja) penalty += (state.hanjaNameCounts.get(info.givenHanja) ?? 0) * 8;
    for (const syllable of info.syllables) penalty += Math.min(5, (state.syllableCounts.get(syllable) ?? 0) * 2.5);
    for (const hanja of info.orthodoxHanjas) penalty += Math.min(5, (state.hanjaCounts.get(hanja) ?? 0) * 2.5);
    return penalty;
  }

  private recordDiversitySelection(info: CandidateSelectionInfo, state: CandidateDiversityState): void {
    const add = (map: Map<string, number>, key: string): void => {
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + 1);
    };
    add(state.profileCounts, info.profile?.id ?? '');
    add(state.hangulCounts, info.givenHangul);
    add(state.hanjaNameCounts, info.givenHanja);
    for (const syllable of info.syllables) add(state.syllableCounts, syllable);
    for (const hanja of info.orthodoxHanjas) add(state.hanjaCounts, hanja);
  }

  private orderParetoCandidates<T>(
    items: readonly T[],
    options: SpringRequest['options'] | undefined,
    getInfo: (item: T) => CandidateSelectionInfo,
    withParetoFrontier: (item: T, paretoFrontier: boolean) => T,
  ): T[] {
    const sorted = [...items].sort((a, b) => getInfo(b).score - getInfo(a).score);
    if (!this.shouldUseParetoFrontier(options)) return sorted;

    const rows = sorted.map((item, index) => ({ item, index, info: getInfo(item) }));
    const frontier = new Set<number>();
    for (const row of rows) {
      const rowVector = row.info.vector;
      if (!rowVector) continue;
      const dominated = rows.some((other) =>
        other.index !== row.index &&
        other.info.vector &&
        this.vectorDominates(other.info.vector, rowVector));
      if (!dominated) frontier.add(row.index);
    }

    const state = this.emptyDiversityState();
    const remaining = [...rows];
    const ordered: T[] = [];

    while (remaining.length > 0) {
      const bestScore = Math.max(...remaining.map((row) => row.info.score));
      const window = remaining.filter((row) => row.info.score >= bestScore - 8);
      const selected = window
        .map((row) => {
          const frontierBonus = frontier.has(row.index) ? 3 : 0;
          const diversity = this.diversityPenalty(row.info, state);
          const profileNovelty = (state.profileCounts.get(row.info.profile?.id ?? '') ?? 0) === 0 ? 2 : 0;
          return {
            row,
            selectorScore: row.info.score + frontierBonus + profileNovelty - diversity,
          };
        })
        .sort((a, b) =>
          b.selectorScore - a.selectorScore ||
          b.row.info.score - a.row.info.score ||
          a.row.index - b.row.index)[0];

      const selectedIndex = remaining.findIndex((row) => row.index === selected.row.index);
      remaining.splice(selectedIndex, 1);
      this.recordDiversitySelection(selected.row.info, state);
      ordered.push(withParetoFrontier(selected.row.item, frontier.has(selected.row.index)));
    }

    return ordered;
  }

  private selectionInfoForSpringReport(report: SpringReport): CandidateSelectionInfo {
    const diversity = this.nameDiversityInfo(
      report.namingReport.name.givenName.map((char) => ({
        hangul: char.hangul,
        hanja: char.hanja,
      })),
    );
    return {
      score: report.finalScore,
      vector: report.scoreVector,
      profile: report.strengthProfile,
      ...diversity,
    };
  }

  private selectionInfoForCandidateSummary(summary: SpringCandidateSummary): CandidateSelectionInfo {
    const diversity = this.nameDiversityInfo(summary.givenName);
    return {
      score: summary.finalScore,
      vector: summary.scoreVector,
      profile: summary.strengthProfile,
      ...diversity,
    };
  }

  private selectionInfoForSpringCandidate(candidate: SpringCandidate): CandidateSelectionInfo {
    const diversity = this.nameDiversityInfo(
      candidate.name.givenName.map((char) => ({
        hangul: char.hangul,
        hanja: char.hanja,
      })),
    );
    return {
      score: candidate.scores.total,
      vector: candidate.scoreVector,
      profile: candidate.strengthProfile,
      ...diversity,
    };
  }

  private orderSpringReports(
    results: readonly SpringReport[],
    options?: SpringRequest['options'],
  ): SpringReport[] {
    return this.orderParetoCandidates(
      results,
      options,
      (report) => this.selectionInfoForSpringReport(report),
      (report, paretoFrontier) => {
        const strengthProfile = this.withParetoFlag(report.strengthProfile, paretoFrontier);
        const namingStrengthProfile = this.withParetoFlag(report.namingReport.strengthProfile, paretoFrontier);
        return {
          ...report,
          ...(strengthProfile ? { strengthProfile } : {}),
          namingReport: {
            ...report.namingReport,
            ...(namingStrengthProfile ? { strengthProfile: namingStrengthProfile } : {}),
          },
        };
      },
    ).map((report, index) => ({ ...report, rank: index + 1 }));
  }

  private orderCandidateSummaries(
    results: readonly SpringCandidateSummary[],
    options?: SpringRequest['options'],
  ): SpringCandidateSummary[] {
    return this.orderParetoCandidates(
      results,
      options,
      (summary) => this.selectionInfoForCandidateSummary(summary),
      (summary, paretoFrontier) => ({
        ...summary,
        ...(summary.strengthProfile
          ? { strengthProfile: this.withParetoFlag(summary.strengthProfile, paretoFrontier) }
          : {}),
      }),
    ).map((summary, index) => ({ ...summary, rank: index + 1 }));
  }

  private dedupeCandidateSummariesByHangul(
    results: readonly SpringCandidateSummary[],
  ): SpringCandidateSummary[] {
    const seen = new Set<string>();
    const deduped: SpringCandidateSummary[] = [];
    for (const summary of results) {
      const key = summary.fullHangul || summary.givenHangul;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(summary);
    }
    return deduped.map((summary, index) => ({ ...summary, rank: index + 1 }));
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
    return results.slice(offset, offset + limit);
  }

  private orderSpringCandidates(
    results: readonly SpringCandidate[],
    options?: SpringRequest['options'],
  ): SpringCandidate[] {
    return this.orderParetoCandidates(
      results,
      options,
      (candidate) => this.selectionInfoForSpringCandidate(candidate),
      (candidate, paretoFrontier) => ({
        ...candidate,
        ...(candidate.strengthProfile
          ? { strengthProfile: this.withParetoFlag(candidate.strengthProfile, paretoFrontier) }
          : {}),
      }),
    );
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
    await frame.ensureEntriesLoaded();
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
      ? this.deriveCandidateStrengthProfile(scoreVector)
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
        evaluatorHints: this.resolveEvaluatorHints(request.birth, request.options),
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
    await frame.ensureEntriesLoaded();

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
      ? this.deriveCandidateStrengthProfile(scoreVector)
      : undefined;
    const namingStrengthProfile = namingScoreVector
      ? this.deriveCandidateStrengthProfile(namingScoreVector)
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
      request, mode, hasJamoInput, jamoFilters, sajuSummary,
    );
    // 3. Score each candidate
    const results: SpringReport[] = [];

    for (const givenNameInput of nameInputs) {
      const nameStatInfo = await this.getNameStatInfo(givenNameInput);
      if (!nameStatInfo.exists) continue;
      if (this.isGenderMismatch(request.birth.gender, nameStatInfo.nameGender)) continue;
      results.push(await this.getSpringReport(
        { ...request, givenName: givenNameInput, mode: 'evaluate' },
        sajuReport,
      ));
    }

    return this.pageOrderedCandidates(this.orderSpringReports(results, request.options), request.options);
  }

  // -------------------------------------------------------------------------
  // getNameCandidateSummaries -- lightweight candidates for list rendering
  // -------------------------------------------------------------------------

  async getNameCandidateSummaries(request: SpringRequest): Promise<SpringCandidateSummary[]> {
    await this.init();

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
      request, mode, hasJamoInput, jamoFilters, sajuSummary,
    );
    const results: SpringCandidateSummary[] = [];

    for (const givenNameInput of nameInputs) {
      const nameStatInfo = await this.getNameStatInfo(givenNameInput);
      if (!nameStatInfo.exists) continue;
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
          evaluatorHints: this.resolveEvaluatorHints(request.birth, request.options),
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
        ? this.deriveCandidateStrengthProfile(scoreVector)
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

    const ordered = this.orderCandidateSummaries(results, request.options);
    return this.pageOrderedCandidates(this.dedupeCandidateSummariesByHangul(ordered), request.options);
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

    const enrichedFrames: NamingReportFrame[] = frames.map(f => ({
      type: f.type,
      strokeSum: f.strokeSum,
      element: f.energy?.element.english ?? '',
      elementLabel: elementDisplayLabel(f.energy?.element.english),
      polarity: f.energy?.polarity.english ?? '',
      luckyLevel: bucketFromFortune(this.luckyMap.get(f.strokeSum) ?? ''),
      meaning: f.entry ? sanitizeServiceValue(f.entry, fullHangul) : null,
    }));

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
    this.resetCandidateRejections();

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
      request, mode, hasJamoInput, jamoFilters, sajuSummary,
    );

    // 4. Score every candidate and rank by total score (descending)
    const scoredCandidates = await this.scoreAllCandidates(
      request.surname, nameInputs, sajuDistribution, sajuOutput, request.birth, request.options,
      this.resolveEvaluatorHints(request.birth, request.options),
    );

    // 5. Paginate and return
    return this.buildResponse(request, mode, sajuSummary, scoredCandidates);
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

  private async getNameStatInfo(givenName: NameCharInput[]): Promise<NameStatInfo> {
    const key = this.givenNameHangulKey(givenName);
    if (!key) {
      return {
        exists: false,
        popularityRank: null,
        maleRatio: null,
        nameGender: 'unknown',
      };
    }

    const cached = this.cacheGetNameStatInfo(key);
    if (cached) return cached;

    try {
      const found = await this.nameStatRepo.findByName(key);
      const genderInfo = this.getGenderInfoFromEntry(found);
      const info = {
        exists: Boolean(found),
        popularityRank: found ? this.latestPopularityRankFromEntry(found) : null,
        maleRatio: genderInfo.maleRatio,
        nameGender: genderInfo.nameGender,
      };
      this.cacheSetNameStatInfo(key, info);
      return info;
    } catch {
      const fallback: NameStatInfo = {
        exists: false,
        popularityRank: null,
        maleRatio: null,
        nameGender: 'unknown',
      };
      this.cacheSetNameStatInfo(key, fallback);
      return fallback;
    }
  }

  // LRU helpers for nameStatInfoCache.
  // The Map preserves insertion order, so re-inserting an entry on hit keeps
  // hot keys at the recent end; the bounded set drops only the oldest entry
  // when the limit is exceeded. This avoids unbounded growth across the up
  // to MAX_CANDIDATES (50000) candidates a single recommendation pass can
  // touch.

  private cacheGetNameStatInfo(key: string): NameStatInfo | undefined {
    const value = this.nameStatInfoCache.get(key);
    if (value === undefined) return undefined;
    this.nameStatInfoCache.delete(key);
    this.nameStatInfoCache.set(key, value);
    return value;
  }

  private cacheSetNameStatInfo(key: string, value: NameStatInfo): void {
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
      if (!info.exists) continue;
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

    return this.orderSpringCandidates(scored, requestOptions);
  }

  // -------------------------------------------------------------------------
  // analyze() helper -- paginate and assemble the final response
  // -------------------------------------------------------------------------

  private buildResponse(
    request: SpringRequest,
    mode: 'evaluate' | 'recommend' | 'all',
    sajuSummary: SajuSummary,
    scoredCandidates: SpringCandidate[],
  ): SpringResponse {
    const offset = request.options?.offset ?? DEFAULT_OFFSET;
    const limit  = request.options?.limit  ?? DEFAULT_LIMIT;

    const page = scoredCandidates
      .slice(offset, offset + limit)
      .map((candidate, index) => ({ ...candidate, rank: offset + index + 1 }));

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
        candidateRejections: this.candidateRejectionSummary(),
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
      ? this.deriveCandidateStrengthProfile(scoreVector)
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
      surnameEntries, targetElements, avoidElements, hanjaPool,
    );

    // Choose the generation strategy
    const useStrokeStrategy = !hasJamoFilter && nameLength <= 2;

    const generated = useStrokeStrategy
      ? this.generateViaStrokeOptimizer(surnameEntries, pools, nameLength, hanjaPool)
      : this.generateViaDepthFirstSearch(pools, nameLength, hanjaPool);
    const internallyDiverse = this.filterInternallyRepeatedCandidates(generated);
    return this.filterGeneratedCandidatesByLegalStatus(internallyDiverse, hanjaPool);
  }

  private filterGeneratedCandidatesByLegalStatus(
    candidates: NameCharInput[][],
    hanjaPool: HanjaPool,
  ): NameCharInput[][] {
    if (hanjaPool !== 'inmyeongyong_full') return candidates;

    const filtered: NameCharInput[][] = [];
    for (const candidate of candidates) {
      const rejected = candidate.find((char) =>
        char.legalStatus !== 'allowed' && char.legalStatus !== 'variantAllowed');
      if (rejected) {
        this.recordCandidateRejection(
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
  ): Promise<Map<number, HanjaEntry[]>> {
    const useStrokeMode = !hasJamoFilter && nameLength <= 2;

    return useStrokeMode
      ? this.buildStrokeBasedPools(surnameEntries, nameLength, targetElements, avoidElements, hanjaPool)
      : this.buildJamoBasedPools(request, nameLength, jamoFilters, targetElements, avoidElements, hanjaPool);
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

    for (const hanjaEntry of this.filterPresentationSafeEntries(allHanja, hanjaPool)) {
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
  ): Promise<Map<number, HanjaEntry[]>> {
    // Pre-load the full hanja pool. Full-pool resource elements are
    // stroke-derived until PR-2.3, so only curated entries use resource 오행
    // for pre-score exclusion.
    const canFilterAvoidedResourceElement = hanjaPool === 'curated';
    const fullPool = this.filterPresentationSafeEntries(
      await this.findGenerationPoolByStrokeRange(STROKE_MIN, STROKE_MAX, hanjaPool),
      hanjaPool,
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
    if (givenNameChar.hanja) {
      const entry = await this.hanjaRepo.findByHanja(givenNameChar.hanja);
      if (entry) return [{ ...entry, hangul: givenNameChar.hangul, is_surname: false }];
      if (hanjaPool === 'inmyeongyong_full') {
        const fullMatches = getFullLegalPoolEntries()
          .filter((candidate) => candidate.hanja === givenNameChar.hanja)
          .sort((a, b) =>
            Number(b.hangul === givenNameChar.hangul) - Number(a.hangul === givenNameChar.hangul));
        if (fullMatches.length) return [{ ...fullMatches[0], hangul: givenNameChar.hangul, is_surname: false }];
      }
      return [makeFallbackEntry(givenNameChar.hangul, { hanja: givenNameChar.hanja })];
    }

    const entries = hanjaPool === 'inmyeongyong_full'
      ? getFullLegalPoolEntries().filter((entry) => entry.hangul === givenNameChar.hangul)
      : await this.hanjaRepo.findByHangul(givenNameChar.hangul);
    return entries.length
      ? entries.slice(0, POOL_LIMIT_SINGLE_CHAR)
      : [makeFallbackEntry(givenNameChar.hangul, { hanja: '' })];
  }

  // -------------------------------------------------------------------------
  // resolveEntries -- look up full HanjaEntry records for a name
  // -------------------------------------------------------------------------

  private async resolveEntries(
    chars: NameCharInput[],
    options: ResolveEntriesOptions = {},
  ): Promise<HanjaEntry[]> {
    const forceHangulOnly = options.forceHangulOnly ?? false;
    const isSurname = options.isSurname ?? false;
    const hanjaPool = options.hanjaPool ?? 'curated';

    return Promise.all(chars.map(async (char) => {
      const hasHanjaField = Object.prototype.hasOwnProperty.call(char, 'hanja');
      const normalizedHanja = String(char.hanja ?? '').trim();

      if (forceHangulOnly || (hasHanjaField && normalizedHanja.length === 0)) {
        return makeFallbackEntry(char.hangul, {
          hanja: '',
          isSurname,
        });
      }

      if (normalizedHanja.length > 0) {
        const entry = await this.hanjaRepo.findByHanja(normalizedHanja);
        if (entry) return { ...entry, hangul: char.hangul, is_surname: isSurname };
        if (hanjaPool === 'inmyeongyong_full') {
          const fullMatches = getFullLegalPoolEntries()
            .filter((candidate) => candidate.hanja === normalizedHanja)
            .sort((a, b) =>
              Number(b.hangul === char.hangul) - Number(a.hangul === char.hangul));
          if (fullMatches.length) return { ...fullMatches[0], is_surname: isSurname };
        }
      }
      const byHangul = hanjaPool === 'inmyeongyong_full'
        ? getFullLegalPoolEntries()
          .filter((entry) => entry.hangul === char.hangul)
          .map((entry) => ({ ...entry, is_surname: isSurname }))
        : await this.hanjaRepo.findByHangul(char.hangul);
      return byHangul[0] ?? makeFallbackEntry(char.hangul, {
        hanja: normalizedHanja,
        isSurname,
      });
    }));
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
      try {
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
      } catch {
        // Name analysis failed -- proceed without it
        springReport = null;
      }
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

  close() {
    this.hanjaRepo.close();
    this.fourFrameRepo.close();
    this.nameStatRepo.close();
    // Reset lifecycle state so a subsequent init() reopens cleanly.
    this.initialized = false;
    this.initPromise = null;
    this.luckyMap.clear();
    this.validFourFrameNumbers.clear();
    this.nameStatInfoCache.clear();
    this.optimizer = null;
  }
}
