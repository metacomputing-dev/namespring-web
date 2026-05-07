# P34-A2 selection plan: 13 ct=1 fragments, 4p → 5p

Math: 13 × ct=1 = +13 → 5p band 267 → 280 exact.

## Diversity constraints
- 7 categories (academic, career, expression_children, family, health, movement, overall)
- 5 periods (today, thisWeek, thisMonth, thisYear, life)
- voice-kind mix ~4-5 each of 실천/비유/맥락
- 0 흐름이 in source per P5; ≤2 결X
- 100-150자 each
- Sentence-final 요-endings

## Selection (13)

| #  | fragmentId | cat | period | P4 kind | P5 kind |
|---|---|---|---|---|---|
| 1  | academic.thisYear.standard.10_19.003          | academic            | thisYear  | 실천 | 비유 |
| 2  | academic.today.standard.20_29.004             | academic            | today     | 실천 | 맥락 |
| 3  | career.thisYear.standard.age20_29.007         | career              | thisYear  | 맥락 | 실천 |
| 4  | expression_children.thisWeek.standard.10_19.003 | expression_children | thisWeek | 비유 | 실천 |
| 5  | family.thisWeek.standard.teen.003             | family              | thisWeek  | 실천 | 맥락 |
| 6  | family.today.standard.teen.003                | family              | today     | 비유 | 실천 |
| 7  | health.life.standard.20_29.001                | health              | life      | 맥락 | 비유 |
| 8  | health.thisMonth.standard.teen.001            | health              | thisMonth | 실천 | 맥락 |
| 9  | overall.thisYear.standard.teen.001            | overall             | thisYear  | 비유 | 실천 |
| 10 | overall.today.standard.teen.001               | overall             | today     | 맥락 | 실천 |
| 11 | movement.thisYear.standard.10_19.003          | movement            | thisYear  | 비유 | 실천 |
| 12 | health.thisWeek.standard.female.001           | health              | thisWeek  | 실천 | 맥락 |
| 13 | family.today.standard.young_adult.004         | family              | today     | 실천 | 비유 |

Voice mix P5: 6 실천 / 3 비유 / 4 맥락 (each P5 contrasts with its existing P4)
Categories: 2 academic / 1 career / 1 expression_children / 3 family / 3 health / 1 movement / 2 overall = 13 ✓
Periods: today=4, thisWeek=3, thisMonth=1, thisYear=4, life=1 = 13 ✓

Note: All 13 are P33-A2/P32-A2/P31-A4 lifted-to-4p (have a substantive 4th paragraph already).
This means they all use **append-P5** mode (5th paragraph after the existing P4).

## Per-P5 spec
- 100-150자 (target ~110)
- sentence-final endings (~예요/돼요/세요/져요/줘요/어요/etc.)
- 0 흐름이 in source
- ≤2 결X (post-processor 흐름 budget)
- no jargon (신강/신약/격국/십성/용신/etc.)
- no axis/gating/livingTips/cautions/sourceTier change
