# Hanja Data Ingestion Status (PR-P-5 ~ PR-P-9)

## Overview

5-stage delvier KoreaSCourtCode ingestion completed in Phase P
(2026-05-01) per option A approval. spring-ts now ships with full
9,495-entry 인명용 한자 list (opt-in) plus 112 verified 변이체 mapping.

## Stage-by-stage

| Stage | PR | Subject | Status |
|-------|----|---------|--------|
| 1 | P-5 [#120] | delvier db inspection (9,495 isin=1, 9.1% multi-reading, 27% empty dic, 100% rad_stroke) | done |
| 2 | P-6 [#121] | generate `inmyeongyong_9389_full.json` (9,495 entries, 1 MB) | done |
| 3 | P-7 [#122] | wire `precisionConfig.hanjaPool: 'inmyeongyong_full'` opt-in | done |
| 4 | P-8 [#123] | extend `byeolpyo2_variants.json` 50 → 112 (agent verified pairs) | done |
| 5 | P-9 [this] | closure summary | done |

## Current state of data/

```
data/
├── inmyeongyong_9389.json         50 entries  (curated seed, default)
├── inmyeongyong_9389_full.json   9,495 entries (opt-in via hanjaPool='inmyeongyong_full')
├── byeolpyo2_variants.json         112 entries (variant→정자, opt-out via normalize)
└── HANJA_INGESTION_STATUS.md      this file
```

## How to use

Production code path (default — backward compatible):

```ts
import { getLegalAnnotation } from './hanja-annotations';
const r = getLegalAnnotation(entry);
// r.legalRegistrable: boolean | undefined  (undefined = unknown / curated seed)
```

Opt-in to full 9,495 list:

```ts
const r = getLegalAnnotation(entry, { pool: 'inmyeongyong_full' });
// r.legalRegistrable: boolean  (local mirror yes/no; +106 delta remains non-authority)
```

Strict registrability filter:

```ts
isHanjaUsableForLegalName(entry, {
  pool: 'inmyeongyong_full',
  requireLegalRegistrable: true,   // reject status-unknown
})
```

## Outstanding

1. **2024 별표 2 hwpx re-discovery** — pattern `..._000200E.hwpx` likely exists alongside the 별표 1 hwpx found in PR-P-5. Currently using 1997 PDF derived pairs.
2. **9,495 vs 9,389 reconciliation** — PR-2.1 records official sources,
   exposes the +106 mirror delta in `legal-hanja-reconciliation.json`, and
   keeps those entries non-authority until T5-confirmed. Exact character-level
   official diff extraction remains pending.
3. **2,541 empty dic entries** (27%) — supplementary 의미 source needed (Unihan kKorean cross-reference).
4. **Candidate generator wiring** — PR-2.2 wires
   `precisionConfig.hanjaPool='inmyeongyong_full'` into recommendation
   generation. Remaining enrichment risk: generated full-pool entries use
   reading-derived jamo and stroke-derived scoring elements until PR-2.3 adds
   authoritative radical/Unihan metadata.

## Verification commands

```
node tools/inspect_delvier_db.mjs           # re-inspect db (PR-P-5)
node tools/generate_inmyeongyong_full.mjs   # regenerate full json (PR-P-6)
npm run test:hanja                          # 17 PASS / 0 FAIL
npm run test:legal-hanja                    # legal reconciliation regressions
npm run test:hanja-pool                     # full-pool generator wiring
npm run test:snapshot                       # 12/12 PASS (no behavioral regression)
```

## Source citations

- delvier/KoreaSCourtCode webhanja.db (`https://github.com/delvier/KoreaSCourtCode`, MIT, 2024-07-16 refresh)
- 대법원 가족관계의 등록 등에 관한 규칙 별표 1 (2024-06-11 개정, hwpx at law.go.kr)
- 별표 2 1997-12-02 PDF (transcribed verified pairs by agent)
- All snapshot tests on baseline-snapshot.json continue to PASS.

Generated: 2026-05-01.
