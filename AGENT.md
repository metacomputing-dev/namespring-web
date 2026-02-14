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
