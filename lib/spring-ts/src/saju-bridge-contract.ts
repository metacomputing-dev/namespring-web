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

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mismatch(issue: string): never {
  throw new SajuBridgeContractMismatchError(issue);
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
  if (value.sibiUnseong !== null && !isRecord(value.sibiUnseong)) {
    mismatch('sibiUnseong must be an object or null');
  }
  if (hasOwn(value, 'palaceAnalysis') && value.palaceAnalysis !== null && !isRecord(value.palaceAnalysis)) {
    mismatch('palaceAnalysis must be an object or null');
  }
}
