# Agent Memory

## Name Generation Requirement (from user, 2026-02-14)

Implement and preserve the "name generation" mode with these rules:

1. Surname is always fully specified.
2. Given name supports length 1 to 4.
3. Given name input can be:
   - fully empty,
   - partially filled,
   - fully filled.
4. Partial constraints can be mixed per position:
   - full Hangul syllable,
   - Chosung (initial consonant),
   - Jungsung (vowel),
   - Hanja-only constraint.
5. Surname must support both single and double surname cases
   (for example, compound surname patterns such as Jegal / Seonu).
6. Candidate generation should be optimized for speed:
   - narrow by indexed name-stat combination data first,
   - then apply per-position Hangul/Hanja constraints,
   - keep returned candidate set reduced to valid/ranked results.

## Current implementation note

Core search logic already appears to implement most of this behavior.
Current UI flow is mainly focused on direct analyze-selection and does not expose
full candidate generation/search flow yet.

## SAJU integration note (implemented, 2026-02-14)

1. `lib/saju-ts` is integrated as a git submodule.
2. SAJU is always included in evaluation flow (UI toggle removed).
3. SAJU distribution now resolves from birth info via `saju-ts` (`analyzeSaju`),
   with fallback to default distribution when birth input is absent/unavailable.
4. `SAJU_JAWON_BALANCE` details include:
   - `sajuDistribution`,
   - `sajuDistributionSource` (`birth` or `fallback`),
   - `jawonDistribution`,
   - `sajuJawonDistribution`.

## SAJU-aware naming optimization note (requested, 2026-02-14)

1. Name recommendation must not overfit to "five-element standard deviation minimization" only.
2. SAJU signals (yongshin/heesin/gisin/gusin, strength, gyeokguk, ten-god imbalance) should influence scoring directly.
3. Traditional seongmyeonghak rules (four-frame numerology, pronunciation/stroke element-yinyang) remain important but can be adaptively relaxed when SAJU signal is strong.
4. Candidate search should still return high-quality recommendations even when strict pass count is low, via ranked fallback output.
