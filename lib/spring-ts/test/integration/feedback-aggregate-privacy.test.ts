/**
 * test/integration/feedback-aggregate-privacy.test.ts
 *
 * Verifies Phase 8.1 structured feedback and aggregate-only privacy policy.
 *
 * Run: npm run test:feedback-privacy
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CARD_FEEDBACK_RESPONSES,
  CANDIDATE_NAME_REJECTION_REASON_AXES,
  CANDIDATE_NAME_REJECTION_REASONS,
  FEEDBACK_AGGREGATE_SCHEMA_VERSION,
  FEEDBACK_CARD_IDS,
  FEEDBACK_FORBIDDEN_FIELDS,
  FEEDBACK_RULE_AXES,
  STRUCTURED_FEEDBACK_SCHEMA_VERSION,
  aggregateStructuredFeedback,
  createEmptyFeedbackAggregate,
  sanitizeCardFeedback,
  sanitizeCandidateNameRejectionFeedback,
  type CardFeedbackInput,
  type CandidateNameRejectionFeedbackInput,
  type StructuredFeedbackEvent,
} from '../../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

function readJson<T = any>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(SPRING_TS_ROOT, relativePath), 'utf-8')) as T;
}

function expectThrow(label: string, action: () => unknown, expectedText: string): void {
  try {
    action();
    check(label, false, 'no error thrown');
  } catch (error) {
    check(label, error instanceof Error && error.message.includes(expectedText),
      error instanceof Error ? error.message : String(error));
  }
}

function collectForbiddenKeyPaths(
  value: unknown,
  forbiddenKeys: ReadonlySet<string>,
  currentPath = '$',
): string[] {
  const paths: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      paths.push(...collectForbiddenKeyPaths(item, forbiddenKeys, `${currentPath}[${index}]`));
    });
    return paths;
  }
  if (!value || typeof value !== 'object') return paths;
  for (const [key, item] of Object.entries(value)) {
    const nextPath = `${currentPath}.${key}`;
    if (forbiddenKeys.has(key)) paths.push(nextPath);
    paths.push(...collectForbiddenKeyPaths(item, forbiddenKeys, nextPath));
  }
  return paths;
}

function collectUnderThresholdBuckets(
  value: unknown,
  minBucketCount: number,
  currentPath = '$',
): string[] {
  const paths: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      paths.push(...collectUnderThresholdBuckets(item, minBucketCount, `${currentPath}[${index}]`));
    });
    return paths;
  }
  if (!value || typeof value !== 'object') return paths;
  const record = value as Record<string, unknown>;
  if (typeof record.total === 'number' && record.total > 0 && record.total < minBucketCount) {
    paths.push(`${currentPath}.total=${record.total}`);
  }
  for (const [key, item] of Object.entries(record)) {
    paths.push(...collectUnderThresholdBuckets(item, minBucketCount, `${currentPath}.${key}`));
  }
  return paths;
}

console.log('Phase 8.1 feedback aggregate privacy\n');

const schema = readJson('test/baseline/schema/feedbackAggregate.schema.json');
const metric = readJson('metrics/feedback-aggregate.json');
const forbiddenKeySet = new Set<string>(FEEDBACK_FORBIDDEN_FIELDS);

check('schema file describes the feedback aggregate version',
  schema.properties?.schemaVersion?.const === FEEDBACK_AGGREGATE_SCHEMA_VERSION);
check('static feedback metric uses expected schemaVersion',
  metric.schemaVersion === FEEDBACK_AGGREGATE_SCHEMA_VERSION);
check('static feedback metric is source-free aggregate only',
  metric.artifactKind === 'privacy_preserving_aggregate_feedback' &&
    metric.authorityUsage === 'not_authority_truth' &&
    metric.privacy?.sourceFree === true &&
    metric.privacy?.aggregateOnly === true &&
    metric.privacy?.rawFeedbackStoredInRepo === false);
check('static feedback metric keeps raw retention at zero days',
  metric.retention?.rawFeedbackRetentionDays === 0 &&
    metric.retention?.aggregateRetentionDays <= 730,
  JSON.stringify(metric.retention));
check('static feedback metric stores no prohibited field keys',
  collectForbiddenKeyPaths(metric, forbiddenKeySet).length === 0,
  collectForbiddenKeyPaths(metric, forbiddenKeySet).join(', '));
check('static feedback metric has no undersized published buckets',
  collectUnderThresholdBuckets(metric, metric.privacy?.minBucketCount ?? 10).length === 0);

check('card feedback categories are exactly the PR-8.1 enum',
  JSON.stringify(CARD_FEEDBACK_RESPONSES) === JSON.stringify([
    'accurate',
    'unclear',
    'tooStrong',
    'notRelevant',
    'wrongReason',
  ]));
check('candidate-name rejection reasons are exactly the PR-8.1 enum',
  JSON.stringify(CANDIDATE_NAME_REJECTION_REASONS) === JSON.stringify([
    'soundBad',
    'meaningBad',
    'tooCommon',
    'tooOld',
    'familyConflict',
    'sajuConcern',
  ]));
check('feedback card IDs cover report cards',
  [
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
  ].every((cardId) => FEEDBACK_CARD_IDS.includes(cardId as any)));
check('feedback rule axes cover naming and saju dimensions',
  ['phonetic', 'hanjaMeaning', 'eraFit', 'familyFit', 'sajuFit', 'yongshin', 'safety']
    .every((axis) => FEEDBACK_RULE_AXES.includes(axis as any)));
check('candidate rejection reasons map to rule axes',
  CANDIDATE_NAME_REJECTION_REASON_AXES.soundBad.includes('phonetic') &&
    CANDIDATE_NAME_REJECTION_REASON_AXES.meaningBad.includes('hanjaMeaning') &&
    CANDIDATE_NAME_REJECTION_REASON_AXES.tooCommon.includes('eraFit') &&
    CANDIDATE_NAME_REJECTION_REASON_AXES.tooOld.includes('eraFit') &&
    CANDIDATE_NAME_REJECTION_REASON_AXES.familyConflict.includes('familyFit') &&
    CANDIDATE_NAME_REJECTION_REASON_AXES.sajuConcern.includes('sajuFit') &&
    CANDIDATE_NAME_REJECTION_REASON_AXES.sajuConcern.includes('yongshin'));

const cardFeedback = sanitizeCardFeedback({
  cardId: 'personality',
  response: 'tooStrong',
  axes: ['sipsin', 'strength'],
} satisfies CardFeedbackInput);
const candidateRejection = sanitizeCandidateNameRejectionFeedback({
  reason: 'sajuConcern',
} satisfies CandidateNameRejectionFeedbackInput);
const events = [cardFeedback, candidateRejection] satisfies StructuredFeedbackEvent[];
const aggregate = aggregateStructuredFeedback(events, {
  generatedAt: '2026-05-02T00:00:00.000Z',
  window: {
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    timezone: 'Asia/Seoul',
  },
});
const emptyAggregate = createEmptyFeedbackAggregate({ generatedAt: '2026-05-02T00:00:00.000Z' });

check('sanitized card feedback keeps only structured enum fields',
  cardFeedback.schemaVersion === STRUCTURED_FEEDBACK_SCHEMA_VERSION &&
    cardFeedback.kind === 'card' &&
    cardFeedback.cardId === 'personality' &&
    cardFeedback.response === 'tooStrong' &&
    cardFeedback.axes.includes('sipsin') &&
    cardFeedback.axes.includes('strength'));
check('sanitized candidate-name rejection defaults to mapped axes',
  candidateRejection.kind === 'candidateNameRejection' &&
    candidateRejection.reason === 'sajuConcern' &&
    candidateRejection.axes.includes('sajuFit') &&
    candidateRejection.axes.includes('safety'));
check('aggregate counts feedback by card response and rule axis',
  aggregate.totals.cardFeedback === 1 &&
    aggregate.cardFeedback.personality.byResponse.tooStrong === 1 &&
    aggregate.cardFeedback.personality.byAxis.sipsin === 1 &&
    aggregate.cardFeedback.personality.byAxis.strength === 1);
check('aggregate counts candidate-name rejections by reason and rule axis',
  aggregate.totals.candidateNameRejections === 1 &&
    aggregate.candidateNameRejections.sajuConcern.total === 1 &&
    aggregate.candidateNameRejections.sajuConcern.byAxis.sajuFit === 1 &&
    aggregate.candidateNameRejections.sajuConcern.byAxis.yongshin === 1);
check('created empty aggregate has no raw feedback totals',
  emptyAggregate.totals.events === 0 &&
    emptyAggregate.privacy.sourceFree === true &&
    emptyAggregate.retention.rawFeedbackRetentionDays === 0);
check('runtime aggregate stores no prohibited field keys',
  collectForbiddenKeyPaths(aggregate, forbiddenKeySet).length === 0,
  collectForbiddenKeyPaths(aggregate, forbiddenKeySet).join(', '));

expectThrow('card feedback rejects personal name fields', () => sanitizeCardFeedback({
  cardId: 'personality',
  response: 'unclear',
  name: 'Kim Example',
} as unknown as CardFeedbackInput), '$.name');
expectThrow('candidate-name rejection feedback rejects source fields', () => sanitizeCandidateNameRejectionFeedback({
  reason: 'soundBad',
  sourceUrl: 'https://example.test/source',
} as unknown as CandidateNameRejectionFeedbackInput), '$.sourceUrl');
expectThrow('aggregate rejects raw text on incoming events', () => aggregateStructuredFeedback([{
  ...cardFeedback,
  rawText: 'free form user text',
} as unknown as StructuredFeedbackEvent]), '$.rawText');

console.log(`\nFeedback aggregate privacy: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
