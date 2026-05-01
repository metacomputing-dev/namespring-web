# Feedback Metrics Privacy

Phase 8.1 feedback is an inbound measurement surface, not an authority source.
It must stay separate from report payloads, source registries, and authority
fixtures.

## Storage Boundary

- Public helpers live in `src/feedback.ts`.
- The in-repository metric seed lives at `metrics/feedback-aggregate.json`.
- JSON Schema for aggregate artifacts lives at
  `test/baseline/schema/feedbackAggregate.schema.json`.
- Raw feedback rows are never committed to this repository.

## Allowed Payloads

Per-card feedback may store only:

- `cardId`
- `response`
- rule `axes`
- optional `schoolPreset`

Candidate-name rejection feedback may store only:

- `reason`
- rule `axes`
- optional `schoolPreset`

The accepted card responses are `accurate`, `unclear`, `tooStrong`,
`notRelevant`, and `wrongReason`. The accepted candidate-name rejection reasons
are `soundBad`, `meaningBad`, `tooCommon`, `tooOld`, `familyConflict`, and
`sajuConcern`.

## Prohibited Fields

Feedback payloads and committed aggregate artifacts must not store names, Hanja,
Hangul, birth data, gender, city, IP address, user ID, session ID, email, phone,
free text, comments, examples, raw rows, source IDs, source URLs, source text,
quotes, or `sourceTier` metadata.

Hashes are also avoided. Short Korean names and birth details are low-entropy
inputs, so hashes can still be linkable.

## Aggregation Policy

Durable repository artifacts are aggregate-only and source-free:

- `privacy.sourceFree: true`
- `privacy.aggregateOnly: true`
- `privacy.rawFeedbackStoredInRepo: false`
- `retention.rawFeedbackRetentionDays: 0`

Production export jobs should publish only buckets that satisfy
`privacy.minBucketCount`. The seed artifact carries zero totals and no raw
feedback events.

## Authority Policy

Feedback aggregates are user-product telemetry. They may inform UX priorities,
wording audits, or candidate-ranking diagnostics, but they are not doctrinal
truth and must not enter source-tier authority denominators.
