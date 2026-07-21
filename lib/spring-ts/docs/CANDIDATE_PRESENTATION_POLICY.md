# Candidate Presentation Policy V2

`getCandidateSearch()` returns the engine's saju-guided candidate universe and
a separate user-facing presentation order. The response identifies this
contract as `spring-ts.candidate-presentation.v2`.

## Score and ordering

- `score.final` is the unchanged spring-ts engine score. This names the
  internal score origin; it is not a claim of external scholarly authority.
- A candidate more than 12 raw-score points below the best remaining candidate
  cannot cross that score window.
- Inside one window, presentation evidence is applied in this order:
  higher automatic-recommendation `meaningConfidence`, lower `risk`, lower
  official `popularityRank`, higher `phonetic`, higher `familyFit`, higher
  `eraFit`, then raw score and stable repository order.
- `meaningConfidence` separates reviewed-positive, soft-deferred, and
  unreviewed literal glosses after the hard safety gate. It is an authored
  automatic-recommendation suitability confidence, not a claim that one safe
  meaning is metaphysically or objectively superior to another.
- Missing score-axis evidence uses the disclosed fixed midpoint `50` so a
  missing field cannot change comparator shape or make ordering
  non-transitive. Missing official popularity evidence receives no usage
  bonus, but never rejects a candidate or describes a rare name as inferior.
- This presentation policy does not alter Hanja legality, the natal chart,
  saju scoring, candidate generation, or paid-report scores.

The complete basis is returned in `ordering.rankingBasis`, and clients must
preserve the engine-issued order and rank.

The exact bounded recall path is disclosed as
`ordering.rankingBasis.candidateRecall`. Unconstrained two-syllable
recommendation starts from a gender-neutral total-usage name-stat seed and
then expands only local legal-Hanja readings. One-syllable and otherwise
constrained requests use legal-Hanja generation directly instead of claiming
that an official seed was used. Both paths still run every candidate through
the ordinary full-name scorers. Before the presentation window is applied,
up to three Hanja variants for one Hangul name are retained by unchanged raw
score and stable input order; the response discloses that retention basis.

## Saju guidance during generation

- The natal chart is invariant; a selected name changes only name-conditioned
  interaction results.
- Only interpreted yongshin/heeshin roles may guide generation order.
- Raw deficient/excessive element counts are balance diagnostics, not aliases
  for yongshin/heeshin or gishin/gushin.
- Ready evidence uses a stable strong preference for yongshin/heeshin.
- Consensus conflict or low confidence uses a diversified soft preference.
- Partial/unavailable analysis or high jonggyeok risk uses neutral generation.
- No Hanja is deleted solely because its `resource_element` matches a
  gishin/gushin role; the full-name scorer evaluates the surname and given-name
  elements together.

## Meaning evidence

Legal status, decodable readings, missing/opaque glosses, and clearly unsafe
meanings remain fail-closed gates. The authored positive-meaning pattern list
is a pool-order and bounded-presentation preference; failure to match that
list does not reject a legal Hanja. Literal weapon, death, crime, and clearly
negative meanings are hard rejected. Neutral but unusual or unreviewed
literal meanings are soft-deferred and remain available for explicit
human-selected evaluation. `hanjaMeaning` remains a compatibility field but
is labeled as a Hanja-meaning evidence check in user-facing copy, with an
explicit explanation that it measures available evidence rather than semantic
superiority.
