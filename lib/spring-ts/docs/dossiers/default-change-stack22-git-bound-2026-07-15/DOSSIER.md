# Stack 22 default-change and Git-binding review

Date: 2026-07-15

Baseline: `c5d25a6046c670ac0392409021eca883f74921c3` (merged Stack 21)

Reviewed code freeze: `54fce187d637b3e0ef33cd9185d03a878cd19607`

## Scope and conclusion

Stack 22 adds a typed `boundaryTermId` while retaining the legacy alias,
discloses the twelve-life-stage text as AI-authored T1 display content, rejects
malformed non-default shinsal policy inputs, removes floating-point ambiguity
at the documented two-day start-age boundary, and adds opt-in adapter contract
tests. It also replaces the default-change manifest v1 reader with a Git-bound
v3 gate.

The canonical 17-fixture service snapshot, fixture set, and focused gyeokguk
candidate snapshot are byte-identical to the Stack 21 baseline. The new
`boundaryTermId` transports the same solar-term identifier already exposed by
the deprecated `boundaryMode` alias and is covered by precedence, fallback,
null, and malformed-value tests. No default myeongri judgement changed.

## Verification evidence

- `saju-ts` typecheck: pass.
- `saju-ts` CI suite: 62 files, 600 tests, all pass.
- strict shinsal, start-age boundary, scope, and non-default contracts:
  42 focused tests, all pass.
- Spring adapter shinsal/gongmang: 27 pass.
- Spring fortune request guards: 69 pass.
- Spring daewoon adapter: 38 pass.
- Spring transit report: 14 pass.
- Insight registry authored-content coverage: 102 pass.
- No-AI release scope including insight data: pass.
- Adapter palace/naeum opt-ins: pass.
- Canonical service snapshot: 17/17 pass.
- Focused gyeokguk candidate snapshot: 261/261 pass.
- Git-bound default-change gate: 14/14 pass, including dirty-worktree
  isolation, duplicate-key rejection, unrelated pending blocking,
  candidate/fixture-only impact detection, and post-review source mutation.
- Frontend source diff under `namespring/`: zero.

## Historical pending entries

The v1 manifest contained three fingerprints produced against earlier moving
baselines. They are superseded as comparison records, not promoted to external
expert approval:

1. `sha256:2b92727a...` was the monolithic PR #653 cumulative comparison. The
   review unit was replaced by the 25 incremental stack PRs, each merged only
   after exact-parent local review.
2. `sha256:2ca4ddcf...` was the Stack 01 candidate-score comparison. Its final
   reviewed implementation landed through PR #654 at merge commit
   `0d9378b00a4e40be5c4d63376b88bf0fc8f362bf`.
3. `sha256:6018d66d...` was the pre-rebuild Stack 18 comparison. Stack 18 was
   rebuilt with strict mixed-earth compatibility, private WASM ownership, and
   current snapshots, then landed through PR #671 at merge commit
   `e316cf939cf4b9bfdca6c9a59f432c2a8416f038`.

Superseding these stale baseline comparisons does not certify their doctrine.
It records that they no longer describe a pending branch delta. External
myeongri certification and D1-D5 authority completeness remain separate,
fail-closed release gates.

## Remaining limitations

- Git and SHA-256 binding authenticate repository consistency, not reviewer
  identity, independence, or expertise.
- GitHub Actions remains unavailable because jobs are rejected before runner
  allocation by the account billing lock; the evidence above is local.
- This dossier supports incremental backend merge readiness only. It is not
  an expert-grade engine certification or permission to market the engine as
  certified.
