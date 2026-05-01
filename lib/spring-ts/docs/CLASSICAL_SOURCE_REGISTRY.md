# Classical Source Registry

## Purpose

This registry defines the public classical myeongri texts that spring-ts may use
for later rule extraction. It is a source ledger, not a copied text corpus.

## Scope

The machine-readable registry is
`data/sources/classical-myeongri.sources.json`. Phase 7.1 registers:

- Yuanhai Ziping (`淵海子平`)
- Ditian Sui Chanwei (`滴天髓闡微`)
- Sanming Tonghui (`三命通會`)

## Source Tier Policy

Registered rows use `T4_PRIMARY_TEXT`. A T4 row may support authority work only
when a later fixture links back to the source, keeps quotations short, and
stores human interpretation separately from verbatim text.

The registry itself is not bulk authority truth. The top-level registry
`sourceTier.authorityTruthEligible` is `false`; row-level source records are
eligible only as source anchors for reviewed extraction.

## Usage Limits

Allowed:

- Bibliographic metadata
- Public source URLs
- Short quotations
- Human paraphrase
- Factual pillar data
- Human-reviewed rule identifiers

Prohibited:

- Bulk OCR text
- Chapter copies
- Long continuous excerpts
- Unreviewed machine translation as authority truth

## Short Quote Policy

Classical source fixtures must keep verbatim quote fields at or below `80`
Unicode code points. The quality gate enforces this for classical rows and
fixtures through `sourceTier.quoteShort`, `prose_quote`,
`prose_quote.verbatim`, and `prose_quotes[].quote`.

## Extraction Rules

Every extracted rule or fixture must:

- Link to one registered `sourceUrl`.
- Preserve source caveats, such as incomplete Wikisource coverage.
- Store the doctrinal mapping as human interpretation, not as copied prose.
- Keep pass/fail authority expectations out of low-tier or unreviewed records.

## Registered Public Texts

| ID | Title | Dynasty | Author | Registry note |
| --- | --- | --- | --- | --- |
| `yuanhai_ziping` | Yuanhai Ziping | Ming | Yang Cong | Wikisource flags the text as incomplete/source provenance pending. |
| `ditian_sui_chanwei` | Ditian Sui Chanwei | Qing | Ren Tieqiao | Wikisource lists public-domain status for the Qing work. |
| `sanming_tonghui` | Sanming Tonghui | Ming | Wan Minying | Wikisource notes missing volumes 10 through 12. |

## Future Phase Linkage

Phase 7.2 and later source-mining PRs should use this registry for source IDs
instead of adding ad hoc text URLs directly to fixtures.
