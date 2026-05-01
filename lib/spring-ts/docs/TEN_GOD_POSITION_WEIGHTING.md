# Ten-God Position Weighting

PR-5.1 documents the current `tenGodMode='positional_weighted'` behavior. It
does not change scoring semantics. The goal is to make the null effect
measurable before PR-5.2 changes the scoring formula.

## Current Result

Observed engine-level divergence is `0 / 21`:

| Fixture set | Diverged | Total | Source |
| --- | ---:| ---:| --- |
| Default baseline fixtures | 0 | 12 | documented by `md8-tengod-divergence.test.ts` |
| Jonggyeok stress fixtures | 0 | 9 | `test/fixtures/jonggyeok_cases.json` |
| Combined observation | 0 | 21 | PR-5.1 RPI dashboard |

This means the branch is wired but currently null-effect at the candidate score
surface.

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

## Next PR Target

PR-5.2 should change the normalization anchor so source-layer and
pillar-position visibility survive beyond raw `groupCounts`. The specific
patch point is `src/saju-calculator.ts` inside `computeTenGodScore`, after raw
position contributions are collected and before `deviation_from_average_count`
collapses them.

Run the full PR-5.1 check:

```bash
npm run test:tengod-null-effect
npm run metrics:baseline
```
