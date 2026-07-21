# Saju Engine Release Approval Policy

Review readiness for an incremental backend guardrail/refactor PR and
certification of an expert-grade engine release are separate decisions.
A PR may leave Draft for review when its changed backend scope is structurally
maintainable, change-scoped regressions pass, no frontend or default-promotion
change is included, and every unresolved accuracy limitation remains explicit.
The certified release and default-promotion gates below remain fail-closed.
Regression success alone is not evidence of expert-level judgement accuracy.

## Interim review mechanism (not release certification)

Every "review" control in this policy is implemented as a two-layer mechanism
adopted by the project owner:

1. **AI cross-verification** — a multi-model adversarial panel (blind
   analysis, reconciliation, refutation rounds) produces a dossier that is
   committed to the repository and referenced from `evidence[]`.
2. **Owner signature** — the project owner reads the dossier and signs
   (`reviewedBy`) as the accountable human. The signature is an auditable
   accountability record, not a claim of domain-expert authority.

This mechanism is **not** external human expert certification, and no PR,
document, or user-facing text may present it as such. It cannot satisfy the
signoff required for a certified engine release or default promotion. It need
not block review of an incremental backend-only guardrail/refactor PR that
meets the review-readiness conditions above. Records whose judgements
*originate from* the AI panel additionally follow the panel-adjudicated
exception in `NO_AI_POLICY.md`.
Panel and record digests authenticate repository consistency only; model
identifiers and `reviewedBy` are self-attested metadata, not provider-origin,
reviewer-identity, or domain-expertise authentication.

## External expert certification signoff

Certified engine release and default promotion require an independent human
myeongri expert to approve the exact release baseline. An incremental
guardrail/refactor PR may merge without this certification only when it makes
no certification claim, does not promote a new default, and preserves the
fail-closed release gate. The required manifest path is
`docs/release-attestations/saju-engine-expert-signoff.json`. It must bind all
17 canonical fixtures and D1-D5 to a reviewed code commit. That commit must be
a strict ancestor of the release HEAD, and every later change must be confined
to tracked, clean files under `docs/release-attestations/**`; evidence files
must match their SHA-256 digests.

`npm run quality:gate:expert-signoff` verifies this repository binding and
manifest completeness. It does **not** authenticate the reviewer identity,
qualification, or independence. Those claims still require human verification
through the protected PR review process. AI-panel output and owner approval
cannot substitute for this external expert control.

## Git-bound default-change readiness

`tools/measure_default_change.mjs` and `tools/measure_regression.mjs` enforce
default-change readiness only. They do not certify the engine or replace the
external expert gate above.

The impact fingerprint binds three fixed artifacts: the exact per-field
default snapshot diff, the canonical fixture set, and the focused gyeokguk
candidate snapshot. A candidate-only or fixture-only change therefore still
requires review even when the service snapshot has zero leaf diffs. Missing
fields, removed fixtures, and dropped cards are structural regressions and
cannot be waived.

The authoritative manifest is read from the evaluated Git branch, never the
working tree. The entire v3 registry is validated before any no-diff shortcut:
an unrelated malformed, duplicate, or pending entry blocks the gate. A
`superseded` entry requires a dated successor reference and digest-bound
evidence; supersession records that an obsolete comparison was replaced and
does not claim independent doctrinal approval. `--approval-manifest` is a
diagnostic override and can never produce an authoritative exit code 0.

Approval uses a two-commit protocol to avoid a commit-hash cycle:

1. Commit code, package scripts, fixtures, and both snapshots as the reviewed
   code-freeze commit.
2. In a later attestation commit, add only the manifest and its exact evidence
   files. The manifest subject names the reviewed commit, baseline commit,
   exact diff fingerprint, and raw SHA-256 of all three artifacts.

The gate requires the baseline to be an ancestor of the reviewed commit and
the reviewed commit to be an ancestor of the evaluated commit. Everything
after review must be confined to the manifest and explicitly referenced
regular `.md`/`.json` evidence blobs. Each evidence record carries its raw
SHA-256; source, package, snapshot, rename, symlink, and unlisted dossier
changes fail closed.

```json
{
  "fingerprint": "sha256:<impact fingerprint>",
  "status": "approved",
  "subject": {
    "baselineCommit": "<40-hex commit>",
    "reviewedCommit": "<40-hex code-freeze commit>",
    "exactDiffFingerprint": "sha256:<exact output diff>",
    "baselineFixtureSetSha256": "sha256:<raw blob>",
    "reviewedFixtureSetSha256": "sha256:<raw blob>",
    "baselineSnapshotSha256": "sha256:<raw blob>",
    "reviewedSnapshotSha256": "sha256:<raw blob>",
    "baselineCandidateSnapshotSha256": "sha256:<raw blob>",
    "reviewedCandidateSnapshotSha256": "sha256:<raw blob>"
  },
  "reviewedBy": "accountable reviewer identity",
  "reviewedAt": "YYYY-MM-DD",
  "evidence": [{
    "kind": "dossier",
    "reference": "lib/spring-ts/docs/dossiers/default-change-.../DOSSIER.md",
    "summary": "Scope and result of the exact review.",
    "sha256": "sha256:<raw evidence blob>"
  }]
}
```

An approved entry is an auditable accountability record, not authentication
of reviewer identity, independence, or myeongri expertise. Do not promote a
pending impact without evidence covering every changed judgement and
service-visible field.

## Authority-source promotion

Generic `T3_AUTHORED_INTERPRETATION` plus an owner signature is not
eligible. The only current T3 exception is the exact, AI-disclosed,
evidence-bound panel contract, and that exception is limited to
`saju_doctrine`. T4 classical truth requires case-bound quotation evidence,
field-level bindings, a Git-tracked page artifact and quote-containing
transcript with realpath containment and matching SHA-256 digests, and approved
review metadata. A public URL alone is not evidence. T5 records are restricted
to their official data scopes. T0-T2 sources remain comparison-only.

The current repository has no eligible `naming_score_calibration`,
`product_surface_contract`, `narrative_semantic_contract`, or
`safety_copy_policy` record for the 17 release fixtures. This is a release
blocker, not an engine-rule failure and not permission to broaden another
source's scope.

## Required release gates

```bash
npm --prefix ../saju-ts run test:release-tools
npm --prefix ../saju-ts run validate:school-sources
npm run test:jonggyeok-authority:release
node tools/measure_default_change.mjs --baseline origin/main --branch HEAD
npm run quality:gate:expert-signoff
npm run quality:gate:release
COMPOSITE_GATE_BASELINE_REF=origin/main npm run test:composite-quality-gate
```

The release quality gate rejects `N/A` and `PARTIAL` on measurable dimensions.
A dimension with mixed `PASS` and missing-truth `N/A` fixtures is `PARTIAL`,
not `PASS`; fixtures that are structurally out of a dimension's scope (e.g.
non-edge fixtures for the D5 edge-stability axis) are `NOT_APPLICABLE` and do
not count against completeness. RPI scores include the missing-fixture
coverage penalty and cannot award full points for partial coverage.

D1 requires all seven fields: doctrine `gyeokguk`, `yongshinElement`, and
`strengthLevel`, plus naming `totalScore`, `hangul`, `hanja`, and `fourFrame`.
A missing scope or field keeps the component and D1 at `N/A`.
D5 reports structural edge stability separately and reuses the complete D1
contract for accuracy; stability alone therefore remains `N/A` for accuracy.

The strict jonggyeok gate requires at least 20 reviewed, authority-eligible
birth-time cases whose declared pillars are reproduced by the engine calendar
(chart-fidelity check), and an 80% calibrated match. Pillar-only intake rows
do not satisfy this requirement.
