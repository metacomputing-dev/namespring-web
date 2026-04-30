# Phase O — Classical Authority Validation Results

This file records the validation outcomes from Phase O of the spring-ts precision project. Phase O drilled deeper into the methodology question raised by Phase N-2's '11/11 vs 4/11' headline by extracting **prose ground truth** from the classical Chinese 命理存验 (人鉴, 林庚白) text via direct visual reading of the `사주고전종합.pdf` page images.

## What Phase O measured

Per-case validation against TWO authority texts using TWO mechanical engines:

| authority | sample size | saju-ts (월지 정기) | saju_master (chengbai 투출) |
|-----------|:-----------:|:-------------------:|:---------------------------:|
| 명리심리상담사 (한국 modern, Park J.H.) | 11 | **11 / 11** ✓ | 4 / 11 |
| 命理存验 (Qing-Republican classical, 林庚白) | 6 | 1 / 6 | **0 / 6** |

Sources:
- Lecture: PR-N-1 + PR-N-2.
- Jonheom: PR-O-1 (saju-ts) + PR-O-2 (saju_master).

## Key insight: classical text uses multi-rule analysis

命理存验 prose 격국 evaluation uses a **rich composite of classical rules**:

1. 천간 투출 (transparent stem ten-god) — across year/month/hour stems, not just month
2. 月支 中氣 / 餘氣 (middle/residual hidden stems in month branch) — not just 정기
3. 殺印 composite (when 칠살 and 인성 both present) — taken as single 격국 label
4. 종합 평가 (integrated judgment) — weighing all factors

Examples per-case:

| # | 인물 | prose 격국 | basis (per prose) |
|---|------|------------|-------------------|
| 5 | 瞿鸿玑 | 정관격 | **年干** 庚 정관 투출 (not 月支) |
| 7 | 钱能训 | 인수격 | 月支 丑 **中氣** 辛 印星 當令 (not 정기) |
| 10 | 伍廷芳 | 관살격 | 천간 全位 官煞 투출 (composite) |
| 11 | 杨士琦 | 정인격 | **時干** 甲 정인 투출 (not 月支) |
| 15 | 朱瑞 | 殺印격 | composite of 戊 殺 + 庚 印 |
| 18 | 孙中山 | 정인격 | 月支 戌 정기 戊 정인 (the only 月令-rule case) |

Only **case 18** (孙中山) has its prose 격국 derivable from the 月支 정기 rule alone — and that's the only saju-ts ↔ jonheom MATCH.

## Implication for spring-ts design

**spring-ts/saju-ts uses 月支 정기 rule.** This rule is the single most common one in the lecture text (11/11 match) but only one of multiple rules used in classical Chinese authority. For Korean-modern-lecture-style 격국 evaluation, spring-ts is well-aligned. For classical-Chinese-authority-style evaluation, no single mechanical rule (neither 월지 정기 nor 월간 투출) matches reliably — composite rule reasoning is needed, which is out of scope for the current design.

**This is not a bug or a regression.** It is a documented design alignment with a specific authority methodology (Korean modern lecture). Users wanting classical-style 격국 should be informed that the surface label is the 月支 정기 form, not a 종합 form.

## Diagnostic tools added in Phase O

- `npm run validate:jonheom` (PR-O-1) — saju-ts ↔ 명리존험 prose, runs offline.
- `npm run validate:jonheom-smc` (PR-O-2) — saju_master ↔ 명리존험 prose, requires saju_master CLI environment.

## Authority data added in Phase O

- `test/baseline/authority/jonheom/<n>_<name>.json` × 6 — 인물 metadata (한자/한글), 4 pillars, prose 격국 + alt form (월지 정기) + basis + verbatim short prose phrase. Visual-extracted from `《四柱고전종합.pdf》` page images.

## Sample-size cap reasoning

Phase O extracted 6 cases. Could extend to 30-50 by reading more 명리존험 pages (1119-1131), but the 6-case sample already produces a strong, consistent finding (5/6 prose-engine DIFF, 0/6 with second engine). Adding more cases would tighten the percentage but is unlikely to change the qualitative conclusion that classical prose uses multi-rule analysis. Per advisor's plumbing-cap warning, additional sample without new insight is plumbing.

## Open thread for future PRs

If the maintainer wants to add a `precisionConfig.gyeokgukSelectionRule` opt-in (composite vs 월지 정기 vs 월간 투출), the data and tooling from Phase N + Phase O are sufficient to drive the decision and validate the resulting code. spring-ts currently emits a single 격국 surface; a composite mode would emit multiple candidate 격국 labels with their basis and let the consumer choose — a substantial API addition that should wait for a user-driven request.

Phase O closes the methodology question with explicit data. Continued progress in Phase P+ depends on the maintainer's direction.
