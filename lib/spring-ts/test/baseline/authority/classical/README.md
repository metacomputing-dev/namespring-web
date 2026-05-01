# Classical Authority Fixtures

This folder holds classical-source fixtures that are not direct baseline case
truth by default.

## Public Rule Snippets

`public_text_rule_snippets.json` is a Phase 7.3 source-evidence fixture. It maps
short public-domain classical snippets to existing engine feature anchors:

- `stemTransparency`
- `seasonalCommand`
- `gyeokguk.CONG_*` / `gyeokguk.ZHUAN_WANG`
- yongshin conflict and tongguan/remedy surfaces

The file is not a pass/fail authority denominator. The top-level and per-snippet
`sourceTier.authorityTruthEligible` fields are `false`; later phases can decide
whether a separate benchmark should consume these mappings.

## Copyright Policy

Only short quotes are stored, and each quote must be at most 80 Unicode code
points. Human interpretation is stored separately in `humanInterpretation`.

Do not commit OCR dumps, copied chapters, long excerpts, copied translations, or
temporary page-image artifacts.
