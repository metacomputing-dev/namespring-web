# Ten-God Position Weighting

PR-5.1 documents the current `tenGodMode='positional_weighted'` behavior.
PR-5.2 adds `tenGodMode='positional_weighted_v2'` as an opt-in candidate mode
without changing the public default.

## Current Result

Observed simple-count vs PR-5.1 engine-level divergence is `0 / 24`:

| Fixture set | Diverged | Total | Source |
| --- | ---:| ---:| --- |
| Default baseline fixtures | 0 | 15 | `metrics/rpi-summary.json` |
| Jonggyeok stress fixtures | 0 | 9 | `test/fixtures/jonggyeok_cases.json` |
| Combined observation | 0 | 24 | PR-5.2 RPI dashboard |

This means the branch is wired but currently null-effect at the candidate score
surface.

PR-5.2 separately records v1/v2 comparison rows in
`metrics/rpi-summary.json.tenGodPositionWeighting.baselineComparison`. Current
baseline fixtures remain unchanged (`0 / 15` v1/v2 divergence), while synthetic
fixtures prove the v2 formula can preserve source-layer and pillar-position
differences.

## Why It Cancels

The current implementation applies source-layer weights before normalization:

| Source layer | Current weight |
| --- | ---:|
| Heavenly stem | 4.0 |
| Branch principal hidden stem | 1.8 |
| Hidden stems by ratio rank | 1.2 / 0.7 / 0.45 |

After those weights are summed into five group counts, `computeTenGodScore`
normalizes every group through:

```ts
deviation = (averageCount - groupCount) / averageCount
```

That average-count normalization is the cancellation point. When positional
counts are close to a proportional rescale of simple counts, the normalized
deviation is effectively unchanged. Any remaining ten-god subscore difference
then enters the Saju blend at only `tenGodFixed = 0.05`.

There is also no pillar-position multiplier yet: year, month, day, and hour are
iterated with equal pillar weight. Hidden-stem ratios currently sort hidden
stems, but the ratio itself is not multiplied into the weight.

## Synthetic Diagnosis

`npm run test:tengod-position-weighting` holds aggregate `groupCounts` fixed
and moves one `friend` signal across source layer and pillar position.

The expected PR-5.1 behavior is:

- `simple_count` ignores the synthetic source/position layout.
- `positional_weighted` distinguishes heavenly stem from hidden stem.
- month stem and hour stem still collapse because pillar position is not
  weighted.
- month hidden and hour hidden still collapse for the same reason.
- diagnostics expose raw weighted counts, `averageCount`, and post-normalized
  group deviations.

The expected PR-5.2 opt-in behavior is:

- `positional_weighted_v2` keeps `presenceCounts` separate from
  `visibilityCounts`.
- `expectedPresenceByChartShape` anchors the deficiency calculation.
- month/hour stem signals diverge.
- month/hour hidden-stem signals diverge through pillar visibility.
- default lower-level scoring remains `simple_count`; SpringEngine default
  remains `positional_weighted`.

## PR-5.2 Formula

For v2, every position contribution records:

```ts
presence = source === 'hiddenStem' ? clamp(ratio / 100, 0, 1) : 1
visibility = presence * sourceVisibility * pillarVisibility
```

Current visibility constants are:

| Layer | Visibility |
| --- | ---:|
| Heavenly stem | 4.0 |
| Branch principal hidden stem | 1.8 |
| Hidden stems by ratio rank | 1.2 / 0.7 / 0.45 |
| Year pillar | 0.85 |
| Month pillar | 1.35 |
| Day pillar | 1.05 |
| Hour pillar | 0.75 |

The score combines presence imbalance and visibility imbalance:

```ts
presenceDeviation = (expectedPresenceByChartShape - presenceCount) / expectedPresenceByChartShape
visibilityDeviation = (expectedVisibilityForObservedPresence - visibilityCount) / expectedVisibilityForObservedPresence
rawDeviation = presenceDeviation + 0.5 * visibilityDeviation
```

Negative deviations still use the existing `TEN_GOD.negativeScale` before the
element-weight blend.

## Next PR Target

PR-5.3 should surface the ten-god position evidence in the report layer so the
user can see whether the score is driven by month/hour, heavenly-stem,
principal-branch, or hidden-stem evidence.

Run the full PR-5.1 check:

```bash
npm run test:tengod-null-effect
npm run metrics:baseline
```
