<!--
spring-ts 완결판 cycle PR template.
정책 reference: spring-info/PRINCIPLES_v2.md / spring-info/09_finalization/15_default_changelog_strategy.md
-->

## Summary

<!-- 1-3 sentences. What changes and why. -->

## Test plan

- [ ] `npm run typecheck`
- [ ] `npm run test:integration`
- [ ] `npm run test:snapshot` (10/10 PASS, 0 regression)
- [ ] `npm run quality:gate` (PASS or N/A - for spring-ts changes)
- [ ] (default-change PR only) `npm run validate:default-change`

## Rule release checklist (required for rule-affecting spring-ts PRs)

See `lib/spring-ts/docs/RULE_RELEASE_CHECKLIST.md`.

- [ ] Rule change impact reviewed (default-preserving / opt-in / evidence-only / default-changing).
- [ ] Source-tier impact reviewed (no low-tier or unsourced authority truth).
- [ ] User-facing wording reviewed (no overclaiming; confidence/source limits visible).

If this PR is not rule-affecting, add a one-line note:

> Not rule-affecting - docs/build/tooling only.

## Backward compatibility

- [ ] No `lib/spring-ts/src/types.ts` export shape change (API IMMUTABLE per `PRINCIPLES_v2.md §1`).
- [ ] No `SpringEngine` public method signature change.
- [ ] NameSpring side requires no code change.

## Default change checklist (only if this PR changes a `precisionConfig.*` default)

PRINCIPLES_v2.md §2.1 mandates these 4 items for every default change:

- [ ] **Intent** documented in PR description.
- [ ] **Expected diff** quantified (which fixture's which field changes).
- [ ] **Re-captured baseline snapshot** committed (`lib/spring-ts/test/baseline/spring_ts_snapshot.json`).
- [ ] **DEFAULT_CHANGELOG entry** added at `spring-info/09_finalization/DEFAULT_CHANGELOG.md` with all 9 mandatory fields per F-A15 §2 (Date / PR# / Option / Old / New / Affected fixtures / Intent / Expected diff / Snapshot ref).

If this PR is *not* a default change, leave the section above unchecked and add a one-line note here:

> Not a default change - pure tooling / fixture / type-additive PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
