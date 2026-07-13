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

## Exact default-change approval

`tools/measure_default_change.mjs` and `tools/measure_regression.mjs` compute
the same SHA-256 fingerprint from the exact, sorted per-field snapshot diff.
An intentional default-output change remains blocked unless
`test/baseline/default-change-approvals.json` contains a matching approved
entry and exactly one matching canonical blocker inventory. The approval is
bound to the normalized inventory by `blockerInventoryFingerprint`; approval
entries cannot self-declare or omit their own blocker list.

Snapshot-fingerprint inventories and the top-level `releaseBlockers` registry
have different scopes. `blockerInventories` binds review findings to one exact
snapshot diff. `releaseBlockers` covers release risks that the canonical
snapshot may not observe. Its exact normalized digest is bound by
`releaseBlockerInventoryFingerprint`, and both CLIs validate it before the
zero-diff path. Therefore an empty exact diff is `RELEASE_BLOCKED`, not
`NOT_REQUIRED` or `PASS`, while any global P0/P1/P2 record is still open.

A minimal schema-v2 record has this shape:

```json
{
  "schemaVersion": "spring-ts.default-change-approval.v2",
  "releaseBlockers": [
    {
      "id": "EARTH_MIXED_MONTH_STRUCTURAL_COMPATIBILITY",
      "severity": "P1",
      "status": "open"
    },
    {
      "id": "QUALITY_EVIDENCE_DEFAULT_IMPACT_REVIEW",
      "severity": "P1",
      "status": "open"
    }
  ],
  "releaseBlockerInventoryFingerprint": "sha256:<exact canonical global inventory>",
  "blockerInventories": [
    {
      "fingerprint": "sha256:<exact output diff>",
      "blockers": []
    }
  ],
  "approvals": [
    {
      "fingerprint": "sha256:<exact output diff>",
      "blockerInventoryFingerprint": "sha256:<exact canonical inventory>",
      "status": "approved",
      "reviewedBy": "reviewer identity",
      "reviewedAt": "YYYY-MM-DD",
      "evidence": [
        {
          "kind": "dossier",
          "reference": "versioned evidence path or immutable review URL",
          "summary": "What was adjudicated, by which panel, and with what result."
        }
      ]
    }
  ]
}
```

The fingerprint is printed by either comparison command. Any changed field
changes the output approval. Any blocker ID, severity, status, resolution, or
acceptance change alters the canonical inventory fingerprint and requires a new
binding. Duplicate approval entries or duplicate inventories for one output
fingerprint are invalid. Open P0/P1/P2 records block approval; a P2 may use
`accepted` only with reviewer, date, rationale, and evidence. P0/P1 cannot be
risk-accepted.

The same evidence rules apply to the global registry. A malformed registry or
digest mismatch is `MANIFEST_INVALID`; unresolved valid records are
`RELEASE_BLOCKED`. A resolved record requires resolver identity, date, and
resolution evidence. Only P2 may be accepted as risk, with acceptor identity,
date, rationale, and evidence. `NOT_REQUIRED` is available only when the exact
snapshot diff is empty and the global registry is valid and closed.

Missing fields, removed fixtures, and dropped cards are structural regressions
and cannot be waived by the manifest. The manifest and its digests make review
changes explicit but do not authenticate reviewer identity or prove that a
declared evidence path is truthful; protected human review remains required.

Do not flip a `pending` fingerprint to `approved` without dossier evidence
covering every changed judgement and service-visible output.

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
