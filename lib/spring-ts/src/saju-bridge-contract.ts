import type {
  JieProximitySummary,
  SajuSummary,
} from './types.js';

export interface LegacyBirthInputContract {
  readonly birthYear: number;
  readonly birthMonth: number;
  readonly birthDay: number;
  readonly birthHour?: number;
  readonly birthMinute?: number;
  readonly gender?: 'MALE' | 'FEMALE';
  readonly calendarType?: 'SOLAR' | 'LUNAR';
  readonly isLeapMonth?: boolean;
  readonly timezone?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly name?: string;
}

export interface LegacySajuOptionsContract {
  readonly daeunCount?: number;
  readonly saeunStartYear?: number | null;
  readonly saeunYearCount?: number;
  readonly wolunStartYear?: number | null;
  readonly wolunMonthCount?: number;
}

export interface LegacyCivilDateTimeContract {
  readonly y: number;
  readonly m: number;
  readonly d: number;
  readonly h: number;
  readonly min: number;
}

export interface RuntimeLegacySajuConfig extends Record<string, unknown> {
  longitudeCorrectionPolicy?:
    | { readonly mode: 'off' }
    | { readonly mode: 'civilOffsetMeridian' }
    | { readonly mode: 'fixedMeridian'; readonly meridianDeg: number };
  calendar?: {
    solarTerms?: {
      method?: 'meeus' | 'approx';
      alwaysCompute?: boolean;
      algorithm?: 'bisection' | 'newton';
      readonly [key: string]: unknown;
    };
    solarPrecision?: 'classical' | 'iau1980_top10' | 'iau1980_full';
    aberrationModel?: 'constant' | 'rCorrected';
    trueSolarTime?: Record<string, unknown>;
    readonly [key: string]: unknown;
  };
  strategies?: {
    fortune?: Record<string, unknown>;
    gyeokguk?: Record<string, unknown>;
    readonly [key: string]: unknown;
  };
  weights?: {
    hiddenStems?: Record<string, unknown>;
    readonly [key: string]: unknown;
  };
  school?: Record<string, unknown>;
}

interface LegacyPillarContract {
  readonly cheongan: string;
  readonly jiji: string;
}

export interface LegacyStrengthResultContract {
  readonly dayMasterElement: string;
  readonly level: string;
  readonly isStrong: boolean;
  readonly score: {
    readonly totalSupport: number;
    readonly totalOppose: number;
    readonly deukryeong: number;
    readonly deukji: number;
    readonly deukse: number;
  };
  readonly details: readonly string[];
}

interface LegacyYongshinRecommendationContract {
  readonly type: string;
  readonly primaryElement: string;
  readonly secondaryElement: string | null;
  /** Spring compatibility boundary: 0..100 confidence points. */
  readonly confidence: number;
  readonly reasoning: string;
}

interface LegacyYongshinResultContract {
  readonly finalYongshin: string;
  readonly finalHeesin: string | null;
  readonly gisin: string | null;
  readonly gusin: string | null;
  /** Spring compatibility boundary: 0..100 confidence points. */
  readonly finalConfidence: number;
  readonly agreement: string;
  readonly consensus: unknown;
  readonly methodBreakdown: unknown;
  readonly warnings: readonly string[];
  readonly jonggyeokRisk: unknown;
  readonly recommendations: readonly LegacyYongshinRecommendationContract[];
}

interface LegacyLuckAnnotationsContract {
  readonly tenGod?: string;
  readonly lifeStage?: string;
  readonly lifeStageKo?: string;
  readonly transitShinsal?: unknown;
  readonly relationsWithNatal?: unknown;
  readonly relationsWithDecade?: unknown;
  readonly stemBranchInteraction?: unknown;
}

interface LegacyDaeunPillarContract extends LegacyLuckAnnotationsContract {
  readonly pillar: LegacyPillarContract;
  readonly startAge: number;
  readonly endAge: number;
  readonly order: number;
  readonly displayStartAge: number;
  readonly displayEndAge: number;
  readonly approxStartUtcMs?: number;
  readonly approxEndUtcMs?: number;
}

interface LegacyDaeunInfoContract {
  readonly isForward: boolean;
  readonly firstDaeunStartAge: number;
  readonly firstDaeunStartAgeDisplay: number;
  readonly ageDisplayMode: string;
  readonly ageDisplayLabel: string;
  readonly firstDaeunStartMonths: number;
  readonly boundaryTermId?: string | null;
  /** @deprecated Use boundaryTermId. Empty when no boundary term is available. */
  readonly boundaryMode: string;
  readonly boundaryUtcMs: number | null;
  readonly deltaDays: number | null;
  readonly formula: string;
  readonly warnings: readonly string[];
  readonly daeunPillars: readonly LegacyDaeunPillarContract[];
}

interface LegacySaeunPillarContract extends LegacyLuckAnnotationsContract {
  readonly year: number;
  readonly pillar: LegacyPillarContract;
  readonly startUtcMs: number | null;
  readonly endUtcMs: number | null;
  readonly approxStartAgeYears: number | null;
  readonly approxEndAgeYears: number | null;
}

interface LegacyWolunPillarContract extends LegacySaeunPillarContract {
  readonly monthOrder: number;
  readonly startJie: string;
}

/**
 * Local consumer contract for the dynamically loaded saju-ts V1 bridge.
 *
 * Runtime code imports only this local type so spring-ts build output remains
 * self-contained. A dedicated noEmit typecheck proves that the upstream
 * LegacySajuOutputV1 remains assignable to this consumer view.
 */
export interface LegacySajuOutputV1Contract {
  readonly bridgeSchemaVersion: 'saju-legacy.v1';
  readonly pillars: Readonly<Record<'year' | 'month' | 'day' | 'hour', LegacyPillarContract>>;
  readonly coreResult: SajuSummary['timeCorrection'];
  readonly jieProximity: JieProximitySummary | null;
  readonly strengthResult: LegacyStrengthResultContract;
  readonly yongshinResult: LegacyYongshinResultContract;
  readonly gyeokgukResult: unknown;
  readonly ohaengDistribution: Readonly<Record<string, number>>;
  readonly deficientElements: readonly string[];
  readonly excessiveElements: readonly string[];
  readonly cheonganRelations: readonly unknown[];
  readonly scoredCheonganRelations: readonly unknown[];
  readonly hapHwaEvaluations: readonly unknown[];
  readonly jijiRelations: readonly unknown[];
  readonly resolvedJijiRelations: readonly unknown[];
  readonly tenGodAnalysis: unknown;
  readonly shinsalHits: readonly unknown[];
  readonly weightedShinsalHits: readonly unknown[];
  readonly sibiUnseong: Readonly<Record<string, string>> | null;
  readonly yinYangBalance: unknown;
  readonly gongmangVoidBranches: readonly string[];
  readonly daeunInfo: LegacyDaeunInfoContract;
  readonly saeunPillars: readonly LegacySaeunPillarContract[];
  readonly wolunPillars: readonly LegacyWolunPillarContract[];
  readonly trace: readonly {
    readonly key: string;
    readonly summary: string;
    readonly evidence: readonly string[];
    readonly citations: readonly string[];
    readonly reasoning: readonly string[];
    readonly confidence: number | null;
  }[];
  readonly palaceAnalysis?: Readonly<Record<string, unknown>> | null;
}

export type SajuModule = {
  analyzeSaju: (
    input: LegacyBirthInputContract,
    config?: unknown,
    options?: LegacySajuOptionsContract,
  ) => LegacySajuOutputV1Contract;
  createBirthInput: (params: LegacyBirthInputContract) => LegacyBirthInputContract;
  configFromPreset: (preset: string) => RuntimeLegacySajuConfig;
  resolveOffsetMinutes: (
    timeZone: string,
    civil: LegacyCivilDateTimeContract,
  ) => number;
};

export const SAJU_BRIDGE_SCHEMA_VERSION = 'saju-legacy.v1' as const;
export const LEGACY_SAJU_PRESET_CODES = Object.freeze([
  'KOREAN_MAINSTREAM',
  'TRADITIONAL_CHINESE',
  'MODERN_INTEGRATED',
] as const);
export type LegacySajuPresetCode = (typeof LEGACY_SAJU_PRESET_CODES)[number];
const LEGACY_SAJU_PRESET_CODE_SET = new Set<string>(LEGACY_SAJU_PRESET_CODES);

export class SajuBridgeContractMismatchError extends Error {
  readonly code = 'SAJU_BRIDGE_CONTRACT_MISMATCH';
  readonly issue: string;

  constructor(issue: string) {
    super(`Saju bridge contract mismatch: ${issue}`);
    this.name = 'SajuBridgeContractMismatchError';
    this.issue = issue;
  }
}

type UnknownRecord = Record<string, unknown>;

const LEGACY_TEN_GOD_POSITIONS = ['YEAR', 'MONTH', 'DAY', 'HOUR'] as const;
const LEGACY_PILLAR_KEY_BY_TEN_GOD_POSITION = {
  YEAR: 'year',
  MONTH: 'month',
  DAY: 'day',
  HOUR: 'hour',
} as const;
const LEGACY_STEM_CODES = [
  'GAP', 'EUL', 'BYEONG', 'JEONG', 'MU',
  'GI', 'GYEONG', 'SIN', 'IM', 'GYE',
] as const;
type LegacyStemCode = (typeof LEGACY_STEM_CODES)[number];
const LEGACY_STEM_CODE_SET = new Set<string>(LEGACY_STEM_CODES);
const LEGACY_TEN_GOD_CODES = [
  'BI_GYEON', 'GYEOB_JAE',
  'SIK_SIN', 'SANG_GWAN',
  'PYEON_JAE', 'JEONG_JAE',
  'PYEON_GWAN', 'JEONG_GWAN',
  'PYEON_IN', 'JEONG_IN',
] as const;
type LegacyTenGodCode = (typeof LEGACY_TEN_GOD_CODES)[number];
const LEGACY_TEN_GOD_CODE_SET = new Set<string>(LEGACY_TEN_GOD_CODES);
// Deliberate consumer-side mirrors of the producer tables. A producer drift
// must fail closed at this dynamic package boundary instead of silently
// changing Spring scoring.
const LEGACY_STATIC_HIDDEN_STEMS_BY_BRANCH: Readonly<Record<string, readonly string[]>> = {
  JA: ['GYE'],
  CHUK: ['GI', 'GYE', 'SIN'],
  IN: ['GAP', 'BYEONG', 'MU'],
  MYO: ['EUL'],
  JIN: ['MU', 'EUL', 'GYE'],
  SA: ['BYEONG', 'GYEONG', 'MU'],
  O: ['JEONG', 'GI'],
  MI: ['GI', 'JEONG', 'EUL'],
  SIN: ['GYEONG', 'IM', 'MU'],
  YU: ['SIN'],
  SUL: ['MU', 'SIN', 'JEONG'],
  HAE: ['IM', 'GAP'],
};
const LEGACY_SARYEONG_HIDDEN_STEMS_BY_BRANCH: Readonly<Record<string, readonly string[]>> = {
  JA: ['IM', 'GYE'],
  CHUK: ['GYE', 'SIN', 'GI'],
  IN: ['MU', 'BYEONG', 'GAP'],
  MYO: ['GAP', 'EUL'],
  JIN: ['EUL', 'GYE', 'MU'],
  SA: ['MU', 'GYEONG', 'BYEONG'],
  O: ['BYEONG', 'GI', 'JEONG'],
  MI: ['JEONG', 'EUL', 'GI'],
  SIN: ['MU', 'IM', 'GYEONG'],
  YU: ['GYEONG', 'SIN'],
  SUL: ['SIN', 'JEONG', 'MU'],
  HAE: ['MU', 'GAP', 'IM'],
};
const LEGACY_SARYEONG_SEGMENT_DAYS_BY_BRANCH: Readonly<Record<string, readonly number[]>> = {
  JA: [10, 20],
  CHUK: [9, 3, 18],
  IN: [7, 7, 16],
  MYO: [10, 20],
  JIN: [9, 3, 18],
  SA: [7, 7, 16],
  O: [10, 10, 11],
  MI: [9, 3, 18],
  SIN: [7, 7, 16],
  YU: [10, 20],
  SUL: [9, 3, 18],
  HAE: [7, 7, 16],
};
const LEGACY_HIDDEN_STEM_RATIO_SUM_TOLERANCE = 1e-9;
type LegacyHiddenStemPolicyFamily = 'static' | 'saryeong';
type LegacySaryeongScheme = 'classical' | 'scaled';

interface LegacyTenGodPositionPolicy {
  readonly family: LegacyHiddenStemPolicyFamily;
  readonly ratios: readonly number[];
  readonly commandingStem?: LegacyStemCode;
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mismatch(issue: string): never {
  throw new SajuBridgeContractMismatchError(issue);
}

export function assertLegacySajuPresetCode(
  value: unknown,
  path = 'legacy saju preset code',
): asserts value is LegacySajuPresetCode {
  if (typeof value !== 'string' || !LEGACY_SAJU_PRESET_CODE_SET.has(value)) {
    mismatch(`${path} must be one of ${LEGACY_SAJU_PRESET_CODES.join(', ')}`);
  }
}

function assertFiniteNumber(value: unknown, path: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) mismatch(`${path} must be finite`);
}

function assertNullableFiniteNumber(value: unknown, path: string): void {
  if (value !== null) assertFiniteNumber(value, path);
}

function assertNonEmptyString(value: unknown, path: string): void {
  if (typeof value !== 'string' || value.length === 0) mismatch(`${path} must be a non-empty string`);
}

function assertNullableString(value: unknown, path: string): void {
  if (value !== null && typeof value !== 'string') mismatch(`${path} must be a string or null`);
}

function hasOwn(value: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function assertOwn(value: UnknownRecord, key: string, path: string): void {
  if (!hasOwn(value, key)) mismatch(`${path} is missing`);
}

function assertStringArray(value: unknown, path: string): void {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    mismatch(`${path} must be a string array`);
  }
}

function assertPillar(value: unknown, path: string): void {
  if (!isRecord(value)) mismatch(`${path} must be an object`);
  assertNonEmptyString(value.cheongan, `${path}.cheongan`);
  assertNonEmptyString(value.jiji, `${path}.jiji`);
}

function assertOptionalFiniteNumber(value: UnknownRecord, key: string, path: string): void {
  if (hasOwn(value, key) && value[key] !== undefined) assertFiniteNumber(value[key], `${path}.${key}`);
}

function assertDaeunPillar(value: unknown, path: string): void {
  if (!isRecord(value)) mismatch(`${path} must be an object`);
  assertPillar(value.pillar, `${path}.pillar`);
  for (const key of ['startAge', 'endAge', 'order', 'displayStartAge', 'displayEndAge']) {
    assertFiniteNumber(value[key], `${path}.${key}`);
  }
  assertOptionalFiniteNumber(value, 'approxStartUtcMs', path);
  assertOptionalFiniteNumber(value, 'approxEndUtcMs', path);
}

function assertSaeunPillar(value: unknown, path: string, wolun: boolean): void {
  if (!isRecord(value)) mismatch(`${path} must be an object`);
  assertFiniteNumber(value.year, `${path}.year`);
  assertPillar(value.pillar, `${path}.pillar`);
  for (const key of ['startUtcMs', 'endUtcMs', 'approxStartAgeYears', 'approxEndAgeYears']) {
    assertNullableFiniteNumber(value[key], `${path}.${key}`);
  }
  if (wolun) {
    assertFiniteNumber(value.monthOrder, `${path}.monthOrder`);
    assertNonEmptyString(value.startJie, `${path}.startJie`);
  }
}

function assertStemCode(value: unknown, path: string): asserts value is LegacyStemCode {
  assertNonEmptyString(value, path);
  if (!LEGACY_STEM_CODE_SET.has(value as string)) mismatch(`${path} is unsupported`);
}

function assertTenGodCode(value: unknown, path: string): asserts value is LegacyTenGodCode {
  assertNonEmptyString(value, path);
  if (!LEGACY_TEN_GOD_CODE_SET.has(value as string)) mismatch(`${path} is unsupported`);
}

function expectedLegacyTenGod(
  dayMaster: LegacyStemCode,
  otherStem: LegacyStemCode,
): LegacyTenGodCode {
  const dayIndex = LEGACY_STEM_CODES.indexOf(dayMaster);
  const otherIndex = LEGACY_STEM_CODES.indexOf(otherStem);
  const samePolarity = dayIndex % 2 === otherIndex % 2;
  const elementDelta =
    (Math.floor(otherIndex / 2) - Math.floor(dayIndex / 2) + 5) % 5;
  if (elementDelta === 0) return samePolarity ? 'BI_GYEON' : 'GYEOB_JAE';
  if (elementDelta === 1) return samePolarity ? 'SIK_SIN' : 'SANG_GWAN';
  if (elementDelta === 2) return samePolarity ? 'PYEON_JAE' : 'JEONG_JAE';
  if (elementDelta === 3) return samePolarity ? 'PYEON_GWAN' : 'JEONG_GWAN';
  return samePolarity ? 'PYEON_IN' : 'JEONG_IN';
}

function expectedLegacySaryeongStem(
  branch: string,
  elapsedDays: number,
  monthLengthDays: number,
  scheme: LegacySaryeongScheme,
): LegacyStemCode {
  const stems = LEGACY_SARYEONG_HIDDEN_STEMS_BY_BRANCH[branch];
  const segmentDays = LEGACY_SARYEONG_SEGMENT_DAYS_BY_BRANCH[branch];
  if (!stems || !segmentDays || stems.length !== segmentDays.length) {
    mismatch(`saryeong policy table is incomplete for branch ${branch}`);
  }
  const nominalDays = segmentDays.reduce((sum, days) => sum + days, 0);
  const safeMonthLength =
    Number.isFinite(monthLengthDays) && monthLengthDays > 0
      ? monthLengthDays
      : nominalDays;
  const safeElapsedDays =
    Number.isFinite(elapsedDays) && elapsedDays > 0 ? elapsedDays : 0;
  const scale = scheme === 'scaled' ? safeMonthLength / nominalDays : 1;

  let cursor = 0;
  for (let index = 0; index < segmentDays.length; index += 1) {
    let end = cursor + segmentDays[index]! * scale;
    if (
      scheme === 'classical'
      && index === segmentDays.length - 1
      && safeMonthLength > end
    ) {
      end = safeMonthLength;
    }
    if (safeElapsedDays < end || index === segmentDays.length - 1) {
      return stems[index] as LegacyStemCode;
    }
    cursor = end;
  }
  return stems[stems.length - 1] as LegacyStemCode;
}

function assertTenGodPosition(
  value: unknown,
  path: string,
  allowedStemCodeVariants: Readonly<Record<LegacyHiddenStemPolicyFamily, readonly string[]>>,
  dayMaster: LegacyStemCode,
  pillarStem: LegacyStemCode,
): LegacyTenGodPositionPolicy {
  if (!isRecord(value)) mismatch(`${path} must be an object`);
  assertTenGodCode(value.cheonganSipseong, `${path}.cheonganSipseong`);
  assertTenGodCode(value.jijiPrincipalSipseong, `${path}.jijiPrincipalSipseong`);
  if (value.cheonganSipseong !== expectedLegacyTenGod(dayMaster, pillarStem)) {
    mismatch(`${path}.cheonganSipseong does not match the day-master relationship`);
  }

  if (!Array.isArray(value.hiddenStems) || value.hiddenStems.length === 0) {
    mismatch(`${path}.hiddenStems must be a non-empty array`);
  }
  const hiddenStemCodes = new Set<LegacyStemCode>();
  const hiddenStemOrder: LegacyStemCode[] = [];
  const hiddenStemRatios: number[] = [];
  let ratioSum = 0;
  value.hiddenStems.forEach((hiddenStem, index) => {
    const hiddenPath = `${path}.hiddenStems[${index}]`;
    if (!isRecord(hiddenStem)) mismatch(`${hiddenPath} must be an object`);
    assertStemCode(hiddenStem.stem, `${hiddenPath}.stem`);
    if (hiddenStemCodes.has(hiddenStem.stem)) mismatch(`${hiddenPath}.stem is duplicated`);
    hiddenStemCodes.add(hiddenStem.stem);
    hiddenStemOrder.push(hiddenStem.stem);
    assertFiniteNumber(hiddenStem.ratio, `${hiddenPath}.ratio`);
    if ((hiddenStem.ratio as number) < 0 || (hiddenStem.ratio as number) > 1) {
      mismatch(`${hiddenPath}.ratio must be between 0 and 1`);
    }
    hiddenStemRatios.push(hiddenStem.ratio as number);
    ratioSum += hiddenStem.ratio as number;
  });
  const policyFamily = (Object.entries(allowedStemCodeVariants) as Array<
    [LegacyHiddenStemPolicyFamily, readonly string[]]
  >).find(([, variant]) =>
    variant.length === hiddenStemOrder.length
    && variant.every((stem, index) => stem === hiddenStemOrder[index])
  )?.[0];
  if (!policyFamily) {
    mismatch(`${path}.hiddenStems do not match an allowed pillar-branch policy`);
  }
  const principalStem = policyFamily === 'saryeong'
    ? hiddenStemOrder[hiddenStemOrder.length - 1]!
    : hiddenStemOrder[0]!;
  if (value.jijiPrincipalSipseong !== expectedLegacyTenGod(dayMaster, principalStem)) {
    mismatch(`${path}.jijiPrincipalSipseong does not match the principal hidden stem`);
  }
  if (policyFamily === 'saryeong') {
    const oneHotCount = value.hiddenStems.filter((hiddenStem) =>
      Math.abs((hiddenStem as UnknownRecord).ratio as number - 1)
        <= LEGACY_HIDDEN_STEM_RATIO_SUM_TOLERANCE
    ).length;
    const allOneHotValues = value.hiddenStems.every((hiddenStem) => {
      const ratio = (hiddenStem as UnknownRecord).ratio as number;
      return Math.abs(ratio) <= LEGACY_HIDDEN_STEM_RATIO_SUM_TOLERANCE
        || Math.abs(ratio - 1) <= LEGACY_HIDDEN_STEM_RATIO_SUM_TOLERANCE;
    });
    if (oneHotCount !== 1 || !allOneHotValues) {
      mismatch(`${path}.hiddenStems saryeong ratios must be one-hot`);
    }
  } else {
    const isDisabledPolicy =
      Math.abs(ratioSum) <= LEGACY_HIDDEN_STEM_RATIO_SUM_TOLERANCE;
    const isNormalizedPolicy =
      Math.abs(ratioSum - 1) <= LEGACY_HIDDEN_STEM_RATIO_SUM_TOLERANCE;
    if (!isDisabledPolicy && !isNormalizedPolicy) {
      mismatch(`${path}.hiddenStems static ratios must sum to 0 or 1`);
    }
  }

  if (
    !Array.isArray(value.hiddenStemSipseong)
    || value.hiddenStemSipseong.length !== value.hiddenStems.length
  ) {
    mismatch(`${path}.hiddenStemSipseong must map every hidden stem`);
  }
  const mappedStemCodes = new Set<LegacyStemCode>();
  value.hiddenStemSipseong.forEach((hiddenStem, index) => {
    const hiddenPath = `${path}.hiddenStemSipseong[${index}]`;
    if (!isRecord(hiddenStem)) mismatch(`${hiddenPath} must be an object`);
    if (!isRecord(hiddenStem.entry)) mismatch(`${hiddenPath}.entry must be an object`);
    assertStemCode(hiddenStem.entry.stem, `${hiddenPath}.entry.stem`);
    if (!hiddenStemCodes.has(hiddenStem.entry.stem)) {
      mismatch(`${hiddenPath}.entry.stem is not present in hiddenStems`);
    }
    if (mappedStemCodes.has(hiddenStem.entry.stem)) {
      mismatch(`${hiddenPath}.entry.stem is duplicated`);
    }
    mappedStemCodes.add(hiddenStem.entry.stem);
    assertTenGodCode(hiddenStem.sipseong, `${hiddenPath}.sipseong`);
    if (hiddenStem.sipseong !== expectedLegacyTenGod(dayMaster, hiddenStem.entry.stem)) {
      mismatch(`${hiddenPath}.sipseong does not match the hidden-stem relationship`);
    }
  });
  const commandingIndex = policyFamily === 'saryeong'
    ? hiddenStemRatios.findIndex((ratio) =>
      Math.abs(ratio - 1) <= LEGACY_HIDDEN_STEM_RATIO_SUM_TOLERANCE)
    : -1;
  return {
    family: policyFamily,
    ratios: hiddenStemRatios,
    ...(commandingIndex >= 0 ? { commandingStem: hiddenStemOrder[commandingIndex] } : {}),
  };
}

function assertTenGodAnalysis(
  value: unknown,
  pillars: UnknownRecord,
  jieProximity: unknown,
): void {
  if (!isRecord(value)) mismatch('tenGodAnalysis must be an object');
  assertStemCode(value.dayMaster, 'tenGodAnalysis.dayMaster');
  const dayPillar = pillars.day;
  if (!isRecord(dayPillar)) mismatch('pillars.day must be an object');
  assertStemCode(dayPillar.cheongan, 'pillars.day.cheongan');
  if (value.dayMaster !== dayPillar.cheongan) {
    mismatch('tenGodAnalysis.dayMaster must match pillars.day.cheongan');
  }
  if (!isRecord(value.byPosition)) mismatch('tenGodAnalysis.byPosition must be an object');
  const positionKeys = Object.keys(value.byPosition);
  if (
    positionKeys.length !== LEGACY_TEN_GOD_POSITIONS.length
    || positionKeys.some((position) =>
      !LEGACY_TEN_GOD_POSITIONS.includes(
        position as (typeof LEGACY_TEN_GOD_POSITIONS)[number],
      ))
  ) {
    mismatch('tenGodAnalysis.byPosition must contain exactly YEAR, MONTH, DAY, and HOUR');
  }
  let sharedPolicyFamily: LegacyHiddenStemPolicyFamily | undefined;
  const staticRatioSignatureByArity = new Map<number, readonly number[]>();
  const saryeongCommandingStemByPosition = new Map<
    (typeof LEGACY_TEN_GOD_POSITIONS)[number],
    LegacyStemCode
  >();
  for (const position of LEGACY_TEN_GOD_POSITIONS) {
    assertOwn(value.byPosition, position, `tenGodAnalysis.byPosition.${position}`);
    const pillarKey = LEGACY_PILLAR_KEY_BY_TEN_GOD_POSITION[position];
    const pillar = pillars[pillarKey];
    if (!isRecord(pillar)) mismatch(`pillars.${pillarKey} must be an object`);
    assertStemCode(pillar.cheongan, `pillars.${pillarKey}.cheongan`);
    const branch = String(pillar.jiji);
    const staticStemCodes = LEGACY_STATIC_HIDDEN_STEMS_BY_BRANCH[branch];
    const saryeongStemCodes = LEGACY_SARYEONG_HIDDEN_STEMS_BY_BRANCH[branch];
    if (!staticStemCodes || !saryeongStemCodes) {
      mismatch(`pillars.${pillarKey}.jiji is unsupported`);
    }
    const policy = assertTenGodPosition(
      value.byPosition[position],
      `tenGodAnalysis.byPosition.${position}`,
      { static: staticStemCodes, saryeong: saryeongStemCodes },
      value.dayMaster,
      pillar.cheongan,
    );
    if (sharedPolicyFamily && sharedPolicyFamily !== policy.family) {
      mismatch('tenGodAnalysis.byPosition cannot mix static and saryeong policies');
    }
    sharedPolicyFamily = policy.family;
    if (policy.family === 'static') {
      const priorSignature = staticRatioSignatureByArity.get(policy.ratios.length);
      if (
        priorSignature
        && priorSignature.some((ratio, index) =>
          Math.abs(ratio - policy.ratios[index]!)
            > LEGACY_HIDDEN_STEM_RATIO_SUM_TOLERANCE)
      ) {
        mismatch('tenGodAnalysis.byPosition static ratios must share one global arity policy');
      }
      staticRatioSignatureByArity.set(policy.ratios.length, policy.ratios);
    } else if (policy.commandingStem) {
      saryeongCommandingStemByPosition.set(position, policy.commandingStem);
    }
  }
  if (sharedPolicyFamily === 'saryeong') {
    if (!isRecord(jieProximity)) {
      mismatch('tenGodAnalysis saryeong policy requires jieProximity');
    }
    // The public day fields are rounded for display. Use the exact millisecond
    // interval so a valid producer output is not rejected at a segment edge.
    const elapsedDays =
      ((jieProximity.birthUtcMs as number) - (jieProximity.previousUtcMs as number))
      / 86_400_000;
    const monthLengthDays =
      ((jieProximity.nextUtcMs as number) - (jieProximity.previousUtcMs as number))
      / 86_400_000;
    const matchesScheme = (scheme: LegacySaryeongScheme): boolean =>
      LEGACY_TEN_GOD_POSITIONS.every((position) => {
        const pillarKey = LEGACY_PILLAR_KEY_BY_TEN_GOD_POSITION[position];
        const pillar = pillars[pillarKey] as UnknownRecord;
        return saryeongCommandingStemByPosition.get(position)
          === expectedLegacySaryeongStem(
            String(pillar.jiji),
            elapsedDays,
            monthLengthDays,
            scheme,
          );
      });
    if (!matchesScheme('classical') && !matchesScheme('scaled')) {
      mismatch('tenGodAnalysis saryeong weights do not match one global jie policy');
    }
  }
}

/** Runtime guard for the dynamically imported saju-ts module namespace. */
export function assertSajuModuleContract(value: unknown): asserts value is SajuModule {
  if (!isRecord(value)) mismatch('module must be an object');
  if (typeof value.analyzeSaju !== 'function') mismatch('module.analyzeSaju is missing');
  if (typeof value.createBirthInput !== 'function') mismatch('module.createBirthInput is missing');
  if (typeof value.configFromPreset !== 'function') mismatch('module.configFromPreset is missing');
  if (typeof value.resolveOffsetMinutes !== 'function') {
    mismatch('module.resolveOffsetMinutes is missing');
  }
}

export interface SajuPalaceCapability {
  analyzePalaces: (input: unknown) => any;
  stemIdxFromHanja: (hanja: string) => number | null;
  branchIdxFromHanja: (hanja: string) => number | null;
  stemHanja: (index: number) => string;
}

export function assertSajuPalaceCapability(value: unknown): asserts value is SajuModule & SajuPalaceCapability {
  assertSajuModuleContract(value);
  const module = value as unknown as UnknownRecord;
  for (const key of ['analyzePalaces', 'stemIdxFromHanja', 'branchIdxFromHanja', 'stemHanja']) {
    if (typeof module[key] !== 'function') mismatch(`palace capability ${key} is missing`);
  }
}

export interface SajuNaeumCapability {
  analyzeNaeum: (input: unknown) => any;
}

export function assertSajuNaeumCapability(value: unknown): asserts value is SajuModule & SajuNaeumCapability {
  assertSajuModuleContract(value);
  const module = value as unknown as UnknownRecord;
  if (typeof module.analyzeNaeum !== 'function') mismatch('naeum capability analyzeNaeum is missing');
}

/**
 * Validates the minimum V1 producer contract before any adapter normalizer can
 * turn missing or malformed values into plausible zero/empty output.
 */
export function assertLegacySajuOutputV1Contract(
  value: unknown,
): asserts value is LegacySajuOutputV1Contract {
  if (!isRecord(value)) mismatch('output must be an object');
  if (value.bridgeSchemaVersion !== SAJU_BRIDGE_SCHEMA_VERSION) {
    mismatch('bridgeSchemaVersion is unsupported');
  }

  if (!isRecord(value.pillars)) mismatch('pillars must be an object');
  for (const position of ['year', 'month', 'day', 'hour'] as const) {
    assertPillar(value.pillars[position], `pillars.${position}`);
  }

  if (!isRecord(value.coreResult)) mismatch('coreResult must be an object');
  for (const key of [
    'standardYear', 'standardMonth', 'standardDay', 'standardHour', 'standardMinute',
    'adjustedYear', 'adjustedMonth', 'adjustedDay', 'adjustedHour', 'adjustedMinute',
    'dstCorrectionMinutes', 'longitudeCorrectionMinutes', 'equationOfTimeMinutes',
  ]) assertFiniteNumber(value.coreResult[key], `coreResult.${key}`);

  if (value.jieProximity !== null) {
    if (!isRecord(value.jieProximity)) mismatch('jieProximity must be an object or null');
    for (const key of [
      'birthUtcMs', 'previousUtcMs', 'nextUtcMs', 'hoursSincePrevious', 'hoursUntilNext',
      'daysSincePrevious', 'daysUntilNext', 'monthLengthDays', 'nearestHours',
    ]) assertFiniteNumber(value.jieProximity[key], `jieProximity.${key}`);
    if (
      (value.jieProximity.previousUtcMs as number) > (value.jieProximity.birthUtcMs as number)
      || (value.jieProximity.birthUtcMs as number) >= (value.jieProximity.nextUtcMs as number)
    ) {
      mismatch('jieProximity timestamps must satisfy previous <= birth < next');
    }
    for (const key of ['solarTermMethod', 'previousTermId', 'nextTermId', 'nearestTermId']) {
      assertNonEmptyString(value.jieProximity[key], `jieProximity.${key}`);
    }
    if (value.jieProximity.nearestDirection !== 'previous' && value.jieProximity.nearestDirection !== 'next') {
      mismatch('jieProximity.nearestDirection is invalid');
    }
    if (typeof value.jieProximity.isNearBoundary !== 'boolean') mismatch('jieProximity.isNearBoundary is invalid');
  }

  if (!isRecord(value.strengthResult)) mismatch('strengthResult must be an object');
  if (typeof value.strengthResult.dayMasterElement !== 'string' || value.strengthResult.dayMasterElement.length === 0) {
    mismatch('strengthResult.dayMasterElement is invalid');
  }
  if (typeof value.strengthResult.level !== 'string' || typeof value.strengthResult.isStrong !== 'boolean') {
    mismatch('strengthResult classification is invalid');
  }
  if (!isRecord(value.strengthResult.score)) mismatch('strengthResult.score must be an object');
  for (const key of ['totalSupport', 'totalOppose', 'deukryeong', 'deukji', 'deukse']) {
    assertFiniteNumber(value.strengthResult.score[key], `strengthResult.score.${key}`);
  }
  assertStringArray(value.strengthResult.details, 'strengthResult.details');

  if (!isRecord(value.yongshinResult)) mismatch('yongshinResult must be an object');
  if (typeof value.yongshinResult.finalYongshin !== 'string' || value.yongshinResult.finalYongshin.length === 0) {
    mismatch('yongshinResult.finalYongshin is invalid');
  }
  assertFiniteNumber(value.yongshinResult.finalConfidence, 'yongshinResult.finalConfidence');
  for (const key of ['finalHeesin', 'gisin', 'gusin']) {
    assertNullableString(value.yongshinResult[key], `yongshinResult.${key}`);
  }
  assertNonEmptyString(value.yongshinResult.agreement, 'yongshinResult.agreement');
  for (const key of ['consensus', 'methodBreakdown', 'jonggyeokRisk']) {
    assertOwn(value.yongshinResult, key, `yongshinResult.${key}`);
  }
  if (!Array.isArray(value.yongshinResult.recommendations)) mismatch('yongshinResult.recommendations must be an array');
  value.yongshinResult.recommendations.forEach((recommendation, index) => {
    const path = `yongshinResult.recommendations[${index}]`;
    if (!isRecord(recommendation)) mismatch(`${path} must be an object`);
    for (const key of ['type', 'primaryElement', 'reasoning']) {
      assertNonEmptyString(recommendation[key], `${path}.${key}`);
    }
    assertNullableString(recommendation.secondaryElement, `${path}.secondaryElement`);
    assertFiniteNumber(recommendation.confidence, `${path}.confidence`);
  });
  assertStringArray(value.yongshinResult.warnings, 'yongshinResult.warnings');

  if (!isRecord(value.gyeokgukResult)) mismatch('gyeokgukResult must be an object');
  if (typeof value.gyeokgukResult.type !== 'string' || value.gyeokgukResult.type.length === 0) {
    mismatch('gyeokgukResult.type is invalid');
  }
  if (value.gyeokgukResult.category !== 'NORMAL' && value.gyeokgukResult.category !== 'JONGGYEOK') {
    mismatch('gyeokgukResult.category is invalid');
  }
  assertFiniteNumber(value.gyeokgukResult.confidence, 'gyeokgukResult.confidence');
  assertNullableString(value.gyeokgukResult.baseSipseong, 'gyeokgukResult.baseSipseong');
  if (typeof value.gyeokgukResult.reasoning !== 'string') mismatch('gyeokgukResult.reasoning must be a string');
  for (const key of ['basis', 'scores', 'seongpae']) assertOwn(value.gyeokgukResult, key, `gyeokgukResult.${key}`);
  if (!Array.isArray(value.gyeokgukResult.candidates) || !Array.isArray(value.gyeokgukResult.jonggyeokCandidates)) {
    mismatch('gyeokgukResult candidate arrays are missing');
  }

  if (!isRecord(value.ohaengDistribution)) mismatch('ohaengDistribution must be an object');
  for (const key of ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER']) {
    const amount = value.ohaengDistribution[key];
    assertFiniteNumber(amount, `ohaengDistribution.${key}`);
    if ((amount as number) < 0) mismatch(`ohaengDistribution.${key} must be non-negative`);
  }
  assertStringArray(value.deficientElements, 'deficientElements');
  assertStringArray(value.excessiveElements, 'excessiveElements');

  for (const key of [
    'cheonganRelations', 'scoredCheonganRelations', 'hapHwaEvaluations',
    'jijiRelations', 'resolvedJijiRelations', 'shinsalHits', 'weightedShinsalHits',
    'gongmangVoidBranches', 'saeunPillars', 'wolunPillars', 'trace',
  ]) {
    if (!Array.isArray(value[key])) mismatch(`${key} must be an array`);
  }
  if (!isRecord(value.daeunInfo)) mismatch('daeunInfo must be an object');
  if (typeof value.daeunInfo.isForward !== 'boolean') mismatch('daeunInfo.isForward must be a boolean');
  for (const key of ['firstDaeunStartAge', 'firstDaeunStartAgeDisplay', 'firstDaeunStartMonths']) {
    assertFiniteNumber(value.daeunInfo[key], `daeunInfo.${key}`);
  }
  for (const key of ['ageDisplayMode', 'ageDisplayLabel', 'boundaryMode', 'formula']) {
    if (typeof value.daeunInfo[key] !== 'string') mismatch(`daeunInfo.${key} must be a string`);
  }
  assertNullableFiniteNumber(value.daeunInfo.boundaryUtcMs, 'daeunInfo.boundaryUtcMs');
  assertNullableFiniteNumber(value.daeunInfo.deltaDays, 'daeunInfo.deltaDays');
  assertStringArray(value.daeunInfo.warnings, 'daeunInfo.warnings');
  if (!Array.isArray(value.daeunInfo.daeunPillars)) mismatch('daeunInfo.daeunPillars must be an array');
  value.daeunInfo.daeunPillars.forEach((pillar, index) => assertDaeunPillar(pillar, `daeunInfo.daeunPillars[${index}]`));

  const saeunPillars = value.saeunPillars;
  const wolunPillars = value.wolunPillars;
  const trace = value.trace;
  if (!Array.isArray(saeunPillars)) mismatch('saeunPillars must be an array');
  if (!Array.isArray(wolunPillars)) mismatch('wolunPillars must be an array');
  if (!Array.isArray(trace)) mismatch('trace must be an array');
  saeunPillars.forEach((pillar, index) => assertSaeunPillar(pillar, `saeunPillars[${index}]`, false));
  wolunPillars.forEach((pillar, index) => assertSaeunPillar(pillar, `wolunPillars[${index}]`, true));
  trace.forEach((entry, index) => {
    const path = `trace[${index}]`;
    if (!isRecord(entry)) mismatch(`${path} must be an object`);
    for (const key of ['key', 'summary']) {
      if (typeof entry[key] !== 'string') mismatch(`${path}.${key} must be a string`);
    }
    for (const key of ['evidence', 'citations', 'reasoning']) assertStringArray(entry[key], `${path}.${key}`);
    assertNullableFiniteNumber(entry.confidence, `${path}.confidence`);
  });

  for (const key of ['tenGodAnalysis', 'yinYangBalance', 'sibiUnseong']) assertOwn(value, key, key);
  assertTenGodAnalysis(value.tenGodAnalysis, value.pillars, value.jieProximity);
  if (value.sibiUnseong !== null && !isRecord(value.sibiUnseong)) {
    mismatch('sibiUnseong must be an object or null');
  }
  if (hasOwn(value, 'palaceAnalysis') && value.palaceAnalysis !== null && !isRecord(value.palaceAnalysis)) {
    mismatch('palaceAnalysis must be an object or null');
  }
}
