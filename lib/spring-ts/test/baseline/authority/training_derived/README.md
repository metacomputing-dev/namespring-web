# Training-Derived Authority Cases (PR-L-6)

This directory contains authority-style cases **AI-derived from classical
명리학 training knowledge** to fill the L-6 gap when source books
(사주첩경 6권 / 박재완 명리실관·명리요강 / 적천수 천미 / 命理存验) are
not available for direct citation.

## Source policy

- **NOT citation-anchored**. Each case represents a doctrinally consistent
  scenario synthesized from classical 명리 patterns, not a verbatim quote
  from any specific page of any book.
- **Birth dates are real** (verified by saju-ts engine to produce the
  declared pillars). Empirical scan of birth dates produced these pillar
  configurations matching the doctrinal target.
- **Expected classifications reflect mainstream 명리 doctrine** (월지 정기
  rule + 격국 + 용신 + 강약 standard analysis).

## Verification path

When source books become available:
1. Cross-reference each case's pillars against book examples.
2. If a book case matches the pillars, replace `source.kind` from
   `'training_derived'` to `'book_extracted'` and add page citation.
3. If pillars don't match any book case but doctrine analysis is sound,
   keep as 'training_derived' but mark `verifiedBy: <reviewer>`.
4. If pillars match but doctrine analysis differs, update `expected.*` to
   match the book and note the divergence in `disagreementNotes`.

## Schema

Same as `../chumyeongga/*.json` (`spring-val.authority-case.v1-extended`)
with two additional fields:

```json
{
  "source": {
    "kind": "training_derived",
    "ai_model": "claude-opus-4-7",
    "doctrine_basis": "...",
    ...
  },
  "verificationStatus": "pending_book_check"
}
```
