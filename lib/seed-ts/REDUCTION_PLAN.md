# seed-ts/src/ Code Reduction Investigation Report

**Date**: 2026-02-15
**Current**: 2,866 lines (23 files)
**Target**: < 2,500 lines
**Method**: 20 parallel opus-level agents, file-by-file deep analysis

---

## Executive Summary

| Category | Lines Saved | Risk | Notes |
|----------|-------------|------|-------|
| TIER 1: Build scripts relocation | **368** | VERY LOW | CLI scripts to `scripts/` |
| TIER 1: Dead file deletion | **83** | LOW | name-stat-repo + fourframe simplify |
| TIER 2: Per-file refactoring | **~230** | LOW | All files combined |
| TIER 3: Legacy removal (seed.ts) | **~61** | MEDIUM | Requires App.jsx migration |
| **Total (LOW risk)** | **~681** | | 2,866 → ~2,185 |
| **Total (all)** | **~742** | | 2,866 → ~2,124 |

---

## TIER 1: Major Structural Changes

### 1-A. Move Build Scripts Out of `src/` (-368 lines)

**Risk: VERY LOW** | Multiple agents independently confirmed

These 5 files are standalone CLI database-building scripts. They:
- Are never imported by any runtime code
- Are never exported from `index.ts`
- Use `sqlite3` (native Node.js driver), while runtime uses `sql.js` (WASM)
- Each ends with `main()` call pattern

| File | Lines | Move To |
|------|-------|---------|
| `utils/build-name-stat-db.ts` | 128 | `scripts/build-name-stat-db.ts` |
| `utils/build-hanja-db.ts` | 88 | `scripts/build-hanja-db.ts` |
| `utils/build-fourframe-db.ts` | 84 | `scripts/build-fourframe-db.ts` |
| `utils/db-helpers.ts` | 37 | `scripts/db-helpers.ts` |
| `utils/update-surname-db.ts` | 31 | `scripts/update-surname-db.ts` |

**After-move fix**: `db-helpers.ts` line 8: change `../../data` to `../data` (path adjustment).

### 1-B. Delete `name-stat-repository.ts` (-37 lines)

**Risk: LOW** | Zero consumers, stub class with no query methods

- Delete entire file (35 lines)
- Remove 2 re-export lines from `index.ts` (lines 23-24)

### 1-C. Simplify `fourframe-repository.ts` (-46 lines)

**Risk: LOW** | Engine only reads `number` and `lucky_level`

- Replace `SELECT *` with `SELECT number, lucky_level`
- Remove `parseJsonArray`, `toNullableString` helpers
- Reduce `FourframeMeaningEntry` interface from 14 fields to 2
- 63 lines → 17 lines

---

## TIER 2: Per-File Refactoring (LOW Risk)

### 2-A. `saju.ts` (416 → ~365, **-51 lines**)

| # | Change | Lines | Risk |
|---|--------|-------|------|
| 1 | Inline `SajuNameScoreBreakdown` + drop `weights`/`weightedBeforePenalty` unused fields | -18 | LOW |
| 2 | Remove `YongshinScoreResult` interface (use inferred type) | -9 | LOW |
| 3 | Unify `computeOptimalSorted` remainder distribution | -8 | MOD |
| 4 | `groupElement` switch → offset lookup table | -5 | LOW |
| 5 | Extract zero-compat constant in `getAnalysis()` | -4 | LOW |
| 6 | Remove dead `rt===0` branch (mathematically proven redundant) | -3 | LOW |
| 7 | Inline `CTX_TYPES` Set | -2 | LOW |
| 8 | Combine penalty computation | -2 | LOW |

**Mathematical proof for #6**: When `rt === 0`, `computeOptimalSorted(ini, 0)` returns `sorted(ini)` unchanged. Meanwhile `fin = ini`, so `fs = sorted(fin) = sorted(ini) = opt`. Therefore `isOpt` is always true when `rt === 0`, making the first branch unreachable independently of the second.

### 2-B. `engine.ts` (576 → ~543, **-33 lines**)

| # | Change | Lines | Risk |
|---|--------|-------|------|
| 1 | `numFields` helper for timeCorrection (extractSaju + emptySaju) | -9 | LOW |
| 2 | `strRecord` helper for sibiUnseong Map/Object handling | -7 | LOW |
| 3 | `palaceAnalysis`: mutable let+loop → `Object.fromEntries` | -6 | LOW |
| 4 | `tenGodAnalysis`: mutable let+loop → `Object.fromEntries` | -6 | LOW |
| 5 | `daeunInfo`: let+if → const ternary | -4 | LOW |
| 6 | Inline `resolveMode()` (single call site, 4-line method) | -3 | LOW |
| 7 | Remove IIFE wrapping from cheonganRelations | -2 | LOW |
| 8 | Consolidate two `./saju.js` import lines | -1 | LOW |

### 2-C. `types.ts` (296 → ~272, **-24 lines**)

| # | Change | Lines | Risk |
|---|--------|-------|------|
| 1 | Remove `ScoreWeights` interface (dead: `options.weights` never accessed) | -8 | LOW |
| 2 | Inline `CheonganRelationScoreSummary` into parent | -4 | LOW |
| 3 | Inline `YongshinRecommendationSummary` into parent | -4 | LOW |
| 4 | Inline `Gender` + `BirthDateTime` into `UserInfo` | -4 | MED |
| 5 | Inline `TenGodPositionSummary` into parent | -3 | LOW |
| 6 | Remove `BirthInfo.isLunar` (never accessed) | -1 | LOW |
| 7 | Remove `NamingResult.fourFrames` (written but never read) | -1 | LOW |

### 2-D. `evaluator.ts` (206 → ~188, **-22 lines** incl. cross-file)

| # | Change | Lines | Risk |
|---|--------|-------|------|
| 1 | Remove dead `STATISTICS` frame + hardcoded stub | -4 | LOW |
| 2 | Remove dead `JAWON_OHAENG` + `EUMYANG` EvalFrame aliases | -4 | LOW |
| 3 | Derive `RELAXABLE` from `STRICT_FRAMES` (RELAXABLE = STRICT - SAJU_JAWON_BALANCE) | -3 | LOW |
| 4 | Remove dead `CalculatorSignal.key` field (duplicate of `frame`) | -2 | LOW |
| 5 | Remove dead `EvaluationResult.status` (never read by any consumer) | -2 | LOW |
| 6 | Inline intermediates in `extractSajuPriority` | -2 | LOW |
| 7 | Remove dead `CalculatorPacket.nodeId` (+4 lines in other calculators) | -5 | LOW |

### 2-E. `scoring.ts` (205 → ~184, **-21 lines**)

| # | Change | Lines | Risk |
|---|--------|-------|------|
| 1 | Extract `elementAt` helper; collapse 4 cycle functions to arrows | -8 | LOW |
| 2 | `calculateBalanceScore`: replace threshold loop with formula `Math.max(25, 100 - 15 * Math.ceil(Math.max(0, dev-2) / 2))` | -6 | LOW |
| 3 | Tighten `countDominant`: merge threshold into predicate | -3 | LOW |
| 4 | `checkFourFrameSuriElement`: avoid `.slice()` copy, use effective length | -2 | LOW |
| 5 | Reduce `SAJU_CODE_MAP` to uppercase-only with `toUpperCase()` fallback | -1 | LOW |
| 6 | Remove redundant `total` variable in `computePolarityResult` | -1 | LOW |

**Math proof for #2**: Threshold table `[2→100, 4→85, 6→70, 8→55, 10→40, else→25]` = `100 - 15 * bucket` where `bucket = ceil(max(0, dev-2) / 2)`, capped at 5. Verified for all boundary values including fractional dev.

### 2-F. `utils/index.ts` (81 → ~62, **-19 lines** incl. barrel)

| # | Change | Lines | Risk |
|---|--------|-------|------|
| 1 | Remove `HangulDecomposition` interface + dead `onsetIndex`/`nucleusIndex` fields | -8 | LOW |
| 2 | Collapse `if/else` → ternary in `buildInterpretation` | -3 | LOW |
| 3 | De-export `JUNGSEONG`, eliminate `JUNGSEONG_COUNT` constant | -1 | LOW |
| 4 | De-export `CHOSEONG`, `decomposeHangul`, `FRAME_LABELS` (internal-only) | -0 | LOW |
| 5 | Barrel re-export cleanup (2 lines → 1 line) | -2 | LOW |

### 2-G. `frame.ts` (134 → ~121, **-13 lines**)

| # | Change | Lines | Risk |
|---|--------|-------|------|
| 1 | Remove unused private fields `surnameEntries`/`givenNameEntries`/`surnameStrokes`/`givenNameStrokes` | -4 | LOW |
| 2 | Remove dead `luckLevel` property (always -1, clamped to 0) | -3 | LOW |
| 3 | Consolidate `scoreSagyeokSuri` fortune lookups via `this.frames.map` | -3 | LOW |
| 4 | `elementFromDigit` if-chain → lookup array | -2 | LOW |
| 5 | Inline `polScore` in `getAnalysis()` | -1 | LOW |

### 2-H. `model files` (84 → ~71, **-13 lines**)

| # | Change | File | Lines | Risk |
|---|--------|------|-------|------|
| 1 | Remove unused Polarity params (korean, hanja, symbol, light, trait) | polarity.ts | -8 | LOW |
| 2 | Remove unused Element params (korean, hanja) | element.ts | -3 | LOW |
| 3 | Inline `Energy.getScore` (eliminates double-computation in frame.ts) | energy.ts | -2 | LOW |

### 2-I. `hangul.ts` (116 → ~108, **-8 lines**)

| # | Change | Lines | Risk |
|---|--------|-------|------|
| 1 | Remove `HangulBlock` interface, use inline type | -4 | LOW |
| 2 | Remove unused `private` on constructor params | -2 | LOW |
| 3 | Inline `SIGNAL_WEIGHT_MINOR` constant | -1 | LOW |
| 4 | Replace `ONSET_TO_ELEMENT` Map with array | -1 | LOW |

### 2-J. `hanja.ts` (79 → ~77, **-2 lines**)

| # | Change | Lines | Risk |
|---|--------|-------|------|
| 1 | Compact `backward()` return | -2 | LOW |

### 2-K. `index.ts` barrel cleanup (**-8 lines** total)

| # | Change | Lines | Risk |
|---|--------|-------|------|
| 1 | Remove `NameStatRepository` + `NameStatEntry` exports | -2 | LOW |
| 2 | Remove dead re-exports: `Frame`, `FourframeMeaningEntry`, `HangulDecomposition` | -2 | LOW |
| 3 | Simplify utils re-exports (CHOSEONG, JUNGSEONG, decomposeHangul, FRAME_LABELS) | -2 | LOW |
| 4 | Remove `FourFrameOptimizer` re-export (only used internally) | -1 | LOW |
| 5 | Remove `ScoreWeights` from type re-exports | -1 | LOW |

---

## TIER 3: Legacy Removal (MEDIUM Risk)

### 3-A. Delete `seed.ts` + Legacy Types (-61 lines)

**Risk: MEDIUM** | Requires migrating `namespring/src/App.jsx` from `SeedTs` to `SeedEngine`

`SeedTs` is a legacy synchronous facade with one consumer (`App.jsx`). It:
- Does not use databases (no HanjaRepository, no FourframeRepository)
- Does not perform saju analysis (sajuOutput: null, empty luckyMap)
- Produces partial results compared to `SeedEngine`

**If deleted**:
- `seed.ts`: -42 lines
- `types.ts` lines 274-296 (`UserInfo`, `NamingResult`, `SeedResult`, `Gender`, `BirthDateTime`): -19 lines
- `index.ts` re-export adjustments: included in barrel cleanup

**Alternative** (LOWER risk): Convert class to plain function (-11 lines)

---

## Projected Line Counts

### After TIER 1 Only (2,866 → ~2,415)

| File | Before | After | Saved |
|------|--------|-------|-------|
| Build scripts (5 files) | 368 | 0 (moved) | -368 |
| name-stat-repository.ts | 35 | 0 (deleted) | -35 |
| fourframe-repository.ts | 63 | 17 | -46 |
| index.ts (barrel cleanup) | 46 | 42 | -4 |
| **Subtotal** | | | **-453** |

### After TIER 1 + TIER 2 (2,866 → ~2,185)

| File | Before | After | Saved |
|------|--------|-------|-------|
| *TIER 1 above* | | | -453 |
| saju.ts | 416 | 365 | -51 |
| engine.ts | 576 | 543 | -33 |
| types.ts | 296 | 272 | -24 |
| evaluator.ts | 206 | 188 | -18 |
| scoring.ts | 205 | 184 | -21 |
| utils/index.ts | 81 | 62 | -19 |
| frame.ts | 134 | 121 | -13 |
| hangul.ts | 116 | 108 | -8 |
| polarity.ts | 17 | 9 | -8 |
| element.ts | 36 | 33 | -3 |
| energy.ts | 31 | 29 | -2 |
| hanja.ts | 79 | 77 | -2 |
| search.ts | 40 | 40 | 0 |
| seed.ts | 42 | 42 | 0 |
| hanja-repository.ts | 79 | 79 | 0 |
| **Subtotal TIER 2** | | | **-228** |
| **Grand Total** | **2,866** | **~2,185** | **~681** |

### After ALL TIERS (2,866 → ~2,124)

Add TIER 3 (seed.ts deletion): additional -61 lines

---

## Implementation Priority

### Phase 1: Immediate (meets 2,500 target)
1. Move build scripts to `scripts/` (-368)
2. Delete `name-stat-repository.ts` (-37)
3. Simplify `fourframe-repository.ts` (-46)

**Result: 2,866 → 2,415** (under target)

### Phase 2: Comprehensive cleanup
4. Apply all TIER 2 per-file refactoring (-228)

**Result: 2,415 → 2,185**

### Phase 3: Legacy removal (optional)
5. Migrate App.jsx to SeedEngine, delete seed.ts + legacy types (-61)

**Result: 2,185 → 2,124**

---

## Rules Followed
- NO file merging or combining files
- NO cramming multiple statements on one line
- NO removing functionality that is actually used
- Only legitimate structural improvements, dead code removal, logic simplification
- Each suggestion verified by checking actual usage across entire codebase
- Mathematical proofs provided for algorithmic simplifications
