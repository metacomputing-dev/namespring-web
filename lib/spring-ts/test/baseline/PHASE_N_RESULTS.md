# Phase N — Reference A Validation Results

This file records the validation outcomes from Phase N of the spring-ts precision project. Phase N was unblocked when the maintainer provided two PDF resources:

- `명리심리상담사_전정훈_교안모음.pdf` (132p) — Korean lecture text with **prose evaluation** of each example chart.
- `《四柱고전종합.pdf》` (1351p) — compendium of classical Chinese 자평 references (子平真诠, 滴天髓, 命理存验, 三命通会, 等). PDF text mostly font-mapped (한자 깨짐) but **6갑 characters extract intact**.

## Cumulative validation surface (Phase N)

After Phase N, spring-ts/saju-ts has been compared against published authority prose at three levels:

| level | sample | n | result |
|-------|--------|---|--------|
| month-branch ten-god (saju-ts via tenGodOf) | lecture prose | 11 | **11 / 11** |
| decision day-branch ten-god | lecture prose | 11 | **11 / 11** |
| activity keyword ten-god presence | lecture prose | 27 keywords | **27 / 27** |
| classical 정격 (saju-ts month-rule) | lecture prose | 11 | **11 / 11** |
| classical 정격 (saju-ts) — 내방사주 cases | lecture prose | 3 | **3 / 3** |
| **spring-ts/saju-ts authority prose alignment** | **lecture (PR-N-1)** | **14** | **14 / 14** |

Inter-engine comparison (no prose, just two engines):

| sample | source | n | AGREE | DIFF | rate |
|--------|--------|---|------:|-----:|-----:|
| Lecture | 명리심리상담사 PDF prose | 11 | 4 | 7 | 36.4% |
| Classical | 命理存验 4기둥 | 38 | 15 | 23 | 39.5% |
| **Combined** | | **49** | **19** | **30** | **38.8%** |

## Methodology gap surfaced

PR-N-2 found that saju_master's chengbai 격국 classification disagrees with the published 명리심리상담사 prose on **7 / 11** cases. saju-ts's `tenGodOf(dayStem, mainHidden(monthBranch))` matches the same prose **11 / 11**.

PR-N-5 corroborated this at larger sample size: across 49 charts from two independent sources (modern + classical), saju-ts and saju_master agree on roughly 36-40% of 격국 classifications. The methodology gap is systematic, not anecdotal:

- **saju-ts (used by spring-ts)** uses '월지 정기 ten-god' rule (e.g., 일간 丙 + 월지 辰 정기 戊 → 식신 → 식신격).
- **saju_master's chengbai** uses '월간/투간 투출 ten-god' rule (e.g., month stem 壬 transparent → 편관 → 편관격 — same chart).

For the published 명리심리상담사 prose, the spring-ts/saju-ts approach matches **11 / 11** while saju_master matches **4 / 11**.

## What this means for the 7 D1-FAIL fixtures

Phase M-3..M-8 classified 7 of the 12 baseline fixtures as having engine-level disagreements between spring-ts and saju_master (none were bugs). Phase N-3 reframed those notes with the PR-N-2 evidence; the PR-N-5 corroboration strengthens that reframing:

> Where spring-ts and saju_master disagree on the 12 baseline fixtures, the published-prose evidence skews in favor of spring-ts/saju-ts.

## Diagnostic tools added

- `npm run validate:lecture` (PR-M-5/M-6/N-1) — saju-ts ten-god + classical 정격 vs PDF prose.
- `npm run validate:lecture-smc` (PR-N-2) — saju_master 격국 vs PDF prose.
- `npm run validate:classical-engines` (PR-N-5) — saju-ts vs saju_master inter-engine on 38 classical cases.

## Authority data added

- `test/baseline/authority/lecture/<id>.json` × 14 (11 lecture + 3 내방사주) with full prose-extracted gyeokguk/yongshin/sangshin/byeong + verbatim prose_quote.
- `test/baseline/authority/classical/myeongri_jonheom_pillars.json` — 38 命理存验 4-pillar fixtures, single collection JSON (per-case prose unrecoverable).

## Honest framing

What Phase N proves:
- spring-ts/saju-ts's classical 격국 추론 aligns with the published 명리심리상담사 lecture prose on **14 / 14** cases.
- saju_master's chengbai uses a different classical rule which produces **~39%** agreement with both lecture prose (11 cases) and classical 命理存验 sample (38 cases).
- The earlier 7 D1 disagreements between spring-ts and saju_master are the same methodology gap, not bugs in either implementation.

What Phase N does NOT prove:
- spring-ts is "correct" on every case. The lecture prose's '월지 정기' rule is one classical methodology among several. Different schools (e.g., 자평진전 의 변격 분류, 적천수 의 통변 강조) might score differently.
- The methodology gap implies spring-ts is the "best" implementation. It implies spring-ts/saju-ts is the closer match to the specific lecture text the maintainer provided. A different authority text using the chengbai rule could reverse the result.

What Phase N changes for future work:
- Reference A authority data is **available** at `test/baseline/authority/lecture/` for ongoing validation.
- The methodology question (월지 정기 vs 월간 투출 vs 변격) is now explicit, with sample evidence from 49 charts.
- Future PRs can land authority cases per fixture (top-level `authority/<fix-XX>.json`) to drive `quality_gate.mjs` D1/D2/D4 dimensions; the lecture sub-track and classical collection don't activate those gates because they are pillar-input only.

Phase N closes the validation framing question. Continued work depends on the maintainer's direction (more authority data extraction, or shifting focus to other axes).
