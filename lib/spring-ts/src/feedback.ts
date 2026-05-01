import type { SchoolPresetName } from './preset-loader.js';

export const STRUCTURED_FEEDBACK_SCHEMA_VERSION = 'spring-ts.structured-feedback.v1';
export const FEEDBACK_AGGREGATE_SCHEMA_VERSION = 'spring-ts.feedback-aggregate.v1';

export const CARD_FEEDBACK_RESPONSES = [
  'accurate',
  'unclear',
  'tooStrong',
  'notRelevant',
  'wrongReason',
] as const;

export type CardFeedbackResponse = typeof CARD_FEEDBACK_RESPONSES[number];

export const CANDIDATE_NAME_REJECTION_REASONS = [
  'soundBad',
  'meaningBad',
  'tooCommon',
  'tooOld',
  'familyConflict',
  'sajuConcern',
] as const;

export type CandidateNameRejectionReason = typeof CANDIDATE_NAME_REJECTION_REASONS[number];

export const FEEDBACK_CARD_IDS = [
  'nameCompatibility',
  'overviewSummary',
  'lifeFortuneOverview',
  'personality',
  'strengthsWeaknesses',
  'cautions',
  'dailyFortune',
  'weeklyFortune',
  'monthlyFortune',
  'yearlyFortune',
  'lifeStageFortune',
  'categoryFortune',
] as const;

export type FeedbackCardId = typeof FEEDBACK_CARD_IDS[number];

export const FEEDBACK_RULE_AXES = [
  'gyeokguk',
  'yongshin',
  'sipsin',
  'shinsal',
  'johu',
  'strength',
  'legal',
  'phonetic',
  'hanjaMeaning',
  'eraFit',
  'familyFit',
  'sajuFit',
  'safety',
  'fortuneTiming',
  'categoryDomain',
] as const;

export type FeedbackRuleAxis = typeof FEEDBACK_RULE_AXES[number];

export const FEEDBACK_FORBIDDEN_FIELDS = [
  'birth',
  'birthday',
  'birthDate',
  'birthTime',
  'calendarType',
  'city',
  'comment',
  'day',
  'email',
  'examples',
  'freeText',
  'fullHangul',
  'fullHanja',
  'gender',
  'hanja',
  'hangul',
  'hour',
  'ip',
  'minute',
  'month',
  'name',
  'phone',
  'quote',
  'quoteShort',
  'rawEvent',
  'rawRow',
  'rawText',
  'sessionId',
  'sourceId',
  'sourceText',
  'sourceTier',
  'sourceUrl',
  'userId',
  'year',
] as const;

export type FeedbackForbiddenField = typeof FEEDBACK_FORBIDDEN_FIELDS[number];

export const CANDIDATE_NAME_REJECTION_REASON_AXES = {
  soundBad: ['phonetic'],
  meaningBad: ['hanjaMeaning'],
  tooCommon: ['eraFit'],
  tooOld: ['eraFit'],
  familyConflict: ['familyFit'],
  sajuConcern: ['sajuFit', 'yongshin', 'safety'],
} as const satisfies Record<CandidateNameRejectionReason, readonly FeedbackRuleAxis[]>;

export interface CardFeedbackInput {
  readonly cardId: FeedbackCardId;
  readonly response: CardFeedbackResponse;
  readonly axes?: readonly FeedbackRuleAxis[];
  readonly schoolPreset?: SchoolPresetName;
}

export interface CandidateNameRejectionFeedbackInput {
  readonly reason: CandidateNameRejectionReason;
  readonly axes?: readonly FeedbackRuleAxis[];
  readonly schoolPreset?: SchoolPresetName;
}

export interface StructuredCardFeedback {
  readonly schemaVersion: typeof STRUCTURED_FEEDBACK_SCHEMA_VERSION;
  readonly kind: 'card';
  readonly cardId: FeedbackCardId;
  readonly response: CardFeedbackResponse;
  readonly axes: readonly FeedbackRuleAxis[];
  readonly schoolPreset?: SchoolPresetName;
}

export interface StructuredCandidateNameRejectionFeedback {
  readonly schemaVersion: typeof STRUCTURED_FEEDBACK_SCHEMA_VERSION;
  readonly kind: 'candidateNameRejection';
  readonly reason: CandidateNameRejectionReason;
  readonly axes: readonly FeedbackRuleAxis[];
  readonly schoolPreset?: SchoolPresetName;
}

export type StructuredFeedbackEvent =
  | StructuredCardFeedback
  | StructuredCandidateNameRejectionFeedback;

export type FeedbackAxisCounts = Record<FeedbackRuleAxis, number>;
export type CardFeedbackResponseCounts = Record<CardFeedbackResponse, number>;

export interface CardFeedbackAggregateBucket {
  total: number;
  byResponse: CardFeedbackResponseCounts;
  byAxis: FeedbackAxisCounts;
}

export interface CandidateNameRejectionAggregateBucket {
  total: number;
  byAxis: FeedbackAxisCounts;
}

export type CardFeedbackAggregate = Record<FeedbackCardId, CardFeedbackAggregateBucket>;
export type CandidateNameRejectionAggregate =
  Record<CandidateNameRejectionReason, CandidateNameRejectionAggregateBucket>;

export interface FeedbackAggregateWindow {
  readonly startDate: string;
  readonly endDate: string;
  readonly timezone: string;
}

export interface FeedbackAggregatePrivacy {
  readonly sourceFree: true;
  readonly aggregateOnly: true;
  readonly rawFeedbackStoredInRepo: false;
  readonly minBucketCount: number;
  readonly prohibitedFields: readonly FeedbackForbiddenField[];
}

export interface FeedbackAggregateRetention {
  readonly rawFeedbackRetentionDays: 0;
  readonly aggregateRetentionDays: number;
}

export interface FeedbackAggregateTotals {
  readonly events: number;
  readonly cardFeedback: number;
  readonly candidateNameRejections: number;
}

export interface StructuredFeedbackAggregate {
  readonly schemaVersion: typeof FEEDBACK_AGGREGATE_SCHEMA_VERSION;
  readonly artifactKind: 'privacy_preserving_aggregate_feedback';
  readonly authorityUsage: 'not_authority_truth';
  readonly generatedAt: string;
  readonly window: FeedbackAggregateWindow;
  readonly privacy: FeedbackAggregatePrivacy;
  readonly retention: FeedbackAggregateRetention;
  readonly totals: FeedbackAggregateTotals;
  readonly cardFeedback: CardFeedbackAggregate;
  readonly candidateNameRejections: CandidateNameRejectionAggregate;
}

export interface FeedbackAggregateOptions {
  readonly generatedAt?: string;
  readonly window?: FeedbackAggregateWindow;
  readonly minBucketCount?: number;
  readonly aggregateRetentionDays?: number;
}

const CARD_SET = new Set<string>(FEEDBACK_CARD_IDS);
const RESPONSE_SET = new Set<string>(CARD_FEEDBACK_RESPONSES);
const CANDIDATE_REJECTION_REASON_SET = new Set<string>(CANDIDATE_NAME_REJECTION_REASONS);
const AXIS_SET = new Set<string>(FEEDBACK_RULE_AXES);
const FORBIDDEN_FIELD_SET = new Set<string>(FEEDBACK_FORBIDDEN_FIELDS);

const DEFAULT_FEEDBACK_AGGREGATE_WINDOW: FeedbackAggregateWindow = {
  startDate: '2026-05-01',
  endDate: '2026-05-31',
  timezone: 'Asia/Seoul',
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function collectForbiddenFieldPaths(value: unknown, currentPath = '$'): string[] {
  const paths: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      paths.push(...collectForbiddenFieldPaths(item, `${currentPath}[${index}]`));
    });
    return paths;
  }
  if (!isObject(value)) return paths;
  for (const [key, item] of Object.entries(value)) {
    const nextPath = `${currentPath}.${key}`;
    if (FORBIDDEN_FIELD_SET.has(key)) paths.push(nextPath);
    paths.push(...collectForbiddenFieldPaths(item, nextPath));
  }
  return paths;
}

function assertNoForbiddenFields(input: unknown): void {
  const paths = collectForbiddenFieldPaths(input);
  if (paths.length > 0) {
    throw new Error(`Feedback payload contains non-aggregate or personal fields: ${paths.join(', ')}`);
  }
}

function requireEnum<T extends string>(label: string, value: unknown, allowed: ReadonlySet<string>): T {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new Error(`Invalid ${label}: ${String(value)}`);
  }
  return value as T;
}

function sanitizeAxes(axes: unknown): readonly FeedbackRuleAxis[] {
  if (axes === undefined) return [];
  if (!Array.isArray(axes)) throw new Error('Feedback axes must be an array when provided.');
  const sanitized = axes.map((axis) => requireEnum<FeedbackRuleAxis>('feedback axis', axis, AXIS_SET));
  return Array.from(new Set(sanitized));
}

export function sanitizeCardFeedback(input: CardFeedbackInput): StructuredCardFeedback {
  assertNoForbiddenFields(input);
  const cardId = requireEnum<FeedbackCardId>('card feedback cardId', input.cardId, CARD_SET);
  const response = requireEnum<CardFeedbackResponse>('card feedback response', input.response, RESPONSE_SET);
  return {
    schemaVersion: STRUCTURED_FEEDBACK_SCHEMA_VERSION,
    kind: 'card',
    cardId,
    response,
    axes: sanitizeAxes(input.axes),
    ...(input.schoolPreset ? { schoolPreset: input.schoolPreset } : {}),
  };
}

export function sanitizeCandidateNameRejectionFeedback(
  input: CandidateNameRejectionFeedbackInput,
): StructuredCandidateNameRejectionFeedback {
  assertNoForbiddenFields(input);
  const reason = requireEnum<CandidateNameRejectionReason>(
    'candidate name rejection reason',
    input.reason,
    CANDIDATE_REJECTION_REASON_SET,
  );
  const axes = sanitizeAxes(input.axes);
  return {
    schemaVersion: STRUCTURED_FEEDBACK_SCHEMA_VERSION,
    kind: 'candidateNameRejection',
    reason,
    axes: axes.length > 0 ? axes : CANDIDATE_NAME_REJECTION_REASON_AXES[reason],
    ...(input.schoolPreset ? { schoolPreset: input.schoolPreset } : {}),
  };
}

function createAxisCounts(): FeedbackAxisCounts {
  return Object.fromEntries(FEEDBACK_RULE_AXES.map((axis) => [axis, 0])) as FeedbackAxisCounts;
}

function createResponseCounts(): CardFeedbackResponseCounts {
  return Object.fromEntries(CARD_FEEDBACK_RESPONSES.map((response) => [response, 0])) as CardFeedbackResponseCounts;
}

function createCardFeedbackAggregate(): CardFeedbackAggregate {
  return Object.fromEntries(FEEDBACK_CARD_IDS.map((cardId) => [
    cardId,
    {
      total: 0,
      byResponse: createResponseCounts(),
      byAxis: createAxisCounts(),
    },
  ])) as CardFeedbackAggregate;
}

function createCandidateNameRejectionAggregate(): CandidateNameRejectionAggregate {
  return Object.fromEntries(CANDIDATE_NAME_REJECTION_REASONS.map((reason) => [
    reason,
    {
      total: 0,
      byAxis: createAxisCounts(),
    },
  ])) as CandidateNameRejectionAggregate;
}

function buildPrivacyPolicy(minBucketCount: number): FeedbackAggregatePrivacy {
  return {
    sourceFree: true,
    aggregateOnly: true,
    rawFeedbackStoredInRepo: false,
    minBucketCount,
    prohibitedFields: FEEDBACK_FORBIDDEN_FIELDS,
  };
}

export function createEmptyFeedbackAggregate(
  options: FeedbackAggregateOptions = {},
): StructuredFeedbackAggregate {
  return {
    schemaVersion: FEEDBACK_AGGREGATE_SCHEMA_VERSION,
    artifactKind: 'privacy_preserving_aggregate_feedback',
    authorityUsage: 'not_authority_truth',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    window: options.window ?? DEFAULT_FEEDBACK_AGGREGATE_WINDOW,
    privacy: buildPrivacyPolicy(options.minBucketCount ?? 10),
    retention: {
      rawFeedbackRetentionDays: 0,
      aggregateRetentionDays: options.aggregateRetentionDays ?? 730,
    },
    totals: {
      events: 0,
      cardFeedback: 0,
      candidateNameRejections: 0,
    },
    cardFeedback: createCardFeedbackAggregate(),
    candidateNameRejections: createCandidateNameRejectionAggregate(),
  };
}

function incrementAxes(bucket: FeedbackAxisCounts, axes: readonly FeedbackRuleAxis[]): void {
  for (const axis of axes) {
    bucket[axis] += 1;
  }
}

export function aggregateStructuredFeedback(
  events: readonly StructuredFeedbackEvent[],
  options: FeedbackAggregateOptions = {},
): StructuredFeedbackAggregate {
  const aggregate = createEmptyFeedbackAggregate(options);
  let cardFeedback = 0;
  let candidateNameRejections = 0;

  for (const event of events) {
    assertNoForbiddenFields(event);
    if (event.schemaVersion !== STRUCTURED_FEEDBACK_SCHEMA_VERSION) {
      throw new Error(`Invalid structured feedback schemaVersion: ${event.schemaVersion}`);
    }

    if (event.kind === 'card') {
      const sanitized = sanitizeCardFeedback(event);
      const bucket = aggregate.cardFeedback[sanitized.cardId];
      bucket.total += 1;
      bucket.byResponse[sanitized.response] += 1;
      incrementAxes(bucket.byAxis, sanitized.axes);
      cardFeedback += 1;
      continue;
    }

    const sanitized = sanitizeCandidateNameRejectionFeedback(event);
    const bucket = aggregate.candidateNameRejections[sanitized.reason];
    bucket.total += 1;
    incrementAxes(bucket.byAxis, sanitized.axes);
    candidateNameRejections += 1;
  }

  return {
    ...aggregate,
    totals: {
      events: cardFeedback + candidateNameRejections,
      cardFeedback,
      candidateNameRejections,
    },
  };
}
