# Rule Release Checklist

Phase 9.1 defines the release checklist for rule-affecting spring-ts changes.
A rule-affecting PR must show that rule behavior, source-tier evidence, and
user-facing wording were reviewed before merge.

## Rule-Affecting Paths

Treat a PR as rule-affecting when it changes any of these paths:

- `lib/spring-ts/src/`
- `lib/spring-ts/config/`
- `lib/spring-ts/data/`
- `lib/spring-ts/metrics/`
- `lib/spring-ts/scripts/`
- `lib/spring-ts/tools/`
- `lib/spring-ts/test/baseline/`
- `lib/spring-ts/test/fixtures/`
- `lib/spring-ts/test/integration/`
- `.github/pull_request_template.md`

Docs-only changes under `lib/spring-ts/docs/` are not automatically
rule-affecting, but documentation for a rule-affecting code change should still
link the relevant release checklist evidence.

## Rule Change Checklist

- Identify whether the PR changes selected defaults, opt-in flags, scoring
  weights, candidate ranking, report evidence, fixture truth buckets, or
  generated metrics.
- Run the smallest targeted tests for the changed rule surface.
- Run `npm run validate:default-change` for any possible default behavior
  change.
- Run `npm run quality:gate` when source-tiered rule output, metrics, or
  baseline fixtures may be affected.
- Explain whether the change is default-preserving, opt-in only, evidence-only,
  or default-changing.

## Source-Tier Checklist

- Confirm no `T2`, `T1`, `T0`, `NO_REFERENCE`, AI-generated, or unsourced row is
  used as authority truth.
- Confirm any new fixture or source has an explicit source tier and source kind.
- Confirm promotion or calibration artifacts keep low-tier data diagnostic
  unless `sourceTier.authorityTruthEligible === true` and tier rank is `T3+`.
- Run `npm run ci:no-ai-policy` for fixture, source registry, dependency, or
  runtime-source changes that could affect No-AI compliance.
- Link `SOURCE_TIER_POLICY.md`, `DETERMINISTIC_CALIBRATION.md`, or the relevant
  metrics artifact when the PR affects authority gates.

## User-Facing Wording Checklist

- Review all changed report copy, explanation text, and evidence labels.
- Avoid claiming certainty for candidate, deferred, display-only, or low-tier
  evidence.
- Make school disagreement, source-tier limits, and safety posture visible when
  they are material to the user.
- Keep technical terms consistent with existing report cards and docs.
- If the wording changes a recommendation, include the report card, evidence
  row, or explanation surface where the changed wording appears.

## PR Body Requirement

Rule-affecting PRs must include a checked `Rule release checklist` section in
the PR body. The local helper verifies the three required checked lines:

- `Rule change impact reviewed`
- `Source-tier impact reviewed`
- `User-facing wording reviewed`

If any rule-affecting path is present, the helper also fails a PR body that
claims `Not rule-affecting`.

Run the helper directly when preparing a PR body:

```bash
node tools/check_release_checklist.mjs --body /path/to/pr_body.md --changed-files /path/to/files.txt
```

Within `lib/spring-ts`, the npm wrapper is:

```bash
npm run ci:release-checklist -- --body /path/to/pr_body.md --changed-files /path/to/files.txt
```

Exit codes are `0` for pass, `1` for checklist failure, and `2` for missing or
unreadable input.
