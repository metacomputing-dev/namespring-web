# tools/

CLI scripts that run alongside the engine for cross-validation.
They read the in-tree fixtures under `tests/precision/fixtures/` and
the built engine under `dist/`. Run `npm run build` first (or use the
package scripts, which build automatically).

## validate_kasi_2027.mjs

Compares the engine's solar-term timing for 2027 against the KASI
24-term minute-level fixture across all three solarPrecision modes.

```bash
npm run validate:kasi
```

**Pass criterion**: every term within ±2 min on `'iau1980_full'`
(matches saju_master's own regression policy). Exits 0 on pass, 1 on
fail.

The script always prints a per-mode summary table and the full
per-term delta list for `'iau1980_full'`, so a failing run still
shows which term drifted and by how much.

Current measured baseline (2026-04 main):

| solarPrecision | max \|Δ\| | mean \|Δ\| | fails (±2 min) |
| --- | --- | --- | --- |
| classical (default) | 1.224 min | 0.460 min | 0/24 |
| iau1980_top10 | 0.700 min | 0.298 min | 0/24 |
| iau1980_full | 0.711 min | 0.297 min | 0/24 |

## validate_saju_master_xref.mjs

Cross-validates four-pillar output against the saju_master v9.2
education-casebook fixture.

```bash
npm run validate:xref
```

For every fixture case with a known `birth.instant`, the script
calls `engine.analyze(...)` and compares year/month/day/hour ganji.
Direct-ganji-only fixture entries (1972/1966/1964) are skipped.

Boundary samples exercised:
- `day-pillar-2000-01-01` (whole-day day-pillar check)
- `ipchun-2024` (year ganji 直前/直後 at safe whole-day margins)

Exits 0 on full match, 1 on any mismatch.

## validate:all

```bash
npm run validate:all
```

Runs `validate:kasi` then `validate:xref`, exiting non-zero on the
first failure.

## When to run

- **Before opening a precision PR** that may touch the solar pipeline
  or the saryeong/hidden-stems path. `npm run validate:all` is the
  canonical pre-PR check, alongside `npm test`.
- **After merging a precision PR** to confirm the engine still
  reproduces the published baselines on `main`.
- **As part of CI** if/when the team wants the cross-validation
  cadence to track every commit.

## Adding a new validator

1. Place the script next to the existing ones in `tools/`.
2. Read fixtures from `tests/precision/fixtures/` and the built
   engine from `dist/` (use `pathToFileURL(...)` for ESM imports
   so the path round-trips on Windows).
3. Print a per-row pass/fail table; exit 0 on pass, 1 on fail.
4. Register an `npm run validate:…` script in `package.json` and
   document it here.
