# Report Module

This module builds an `IntegratedReport` from saju-only or spring (saju + naming) data.

## Builder APIs

- `buildIntegratedReport(input: ReportInput): IntegratedReport`
  - Full entry point.
  - Use `input.options.includeSections` / `excludeSections` with section IDs below.
- `buildSajuOnlyReport(saju, options?): IntegratedReport`
  - Convenience wrapper for saju-only input.
  - Automatically excludes name-focused sections: `nameElement`, `nameBasic`, `fourFrame`, `nameHarmony`, `nameComparison`, `sajuNameSynergy`.
- `buildSpringReport(spring, options?): IntegratedReport`
  - Convenience wrapper for spring input.
  - Internally maps `spring.sajuReport` + `spring.namingReport` into `buildIntegratedReport`.

## Minimal usage (TS)

```ts
import {
  buildIntegratedReport,
  buildSajuOnlyReport,
  buildSpringReport,
} from './buildIntegratedReport.js';

const integrated = buildIntegratedReport({ saju, naming, spring });
const sajuOnly = buildSajuOnlyReport(saju, { name: 'Jane' });
const fromSpring = buildSpringReport(spring, { name: 'Jane' });
```

## Section IDs (current registry)

Use these IDs in `includeSections` / `excludeSections`.

- `pillars`: base 4 pillars table
- `dayMaster`: day master core analysis
- `hiddenStems`: hidden stems in each branch
- `elements`: five-element distribution
- `deficiency`: excess/deficiency diagnosis
- `tongguan`: mediation element (tongguan) analysis
- `climate`: climate/temperature-humidity balancing
- `tenGods`: ten-gods distribution
- `lifeStages`: 12 life-stage energy flow
- `strength`: strong/weak day master judgment
- `gyeokguk`: gyeokguk framework
- `yongshin`: yongshin priority guide
- `stemRelations`: stem-level combinations/conflicts
- `branchRelations`: branch-level combinations/conflicts
- `shinsalGood`: auspicious shinsal summary
- `shinsalBad`: caution/inauspicious shinsal summary
- `daeun`: major fortune cycles
- `saeun`: yearly-flow concept label (annual luck); kept for compatibility naming
- `yearlyFortune`: yearly fortune
- `monthlyFortune`: monthly fortune
- `weeklyFortune`: weekly fortune
- `dailyFortune`: daily/hourly fortune
- `nameBasic`: basic naming report
- `nameElement`: name element analysis
- `fourFrame`: four-frame name numerology
- `nameHarmony`: name-saju harmony
- `nameComparison`: candidate-name comparison
- `sajuNameSynergy`: combined saju-name synergy
- `summary`: final score/summary
- `elementLifestyle`: element-based lifestyle guide
- `luckItems`: luck item guide

## `saeun` vs `yearlyFortune`

- `saeun` means the concept of annual luck flow and is a naming/typing compatibility label.
- `yearlyFortune` is the actual generated section ID used by the current registry. Use this in `includeSections` / `excludeSections`.
- `options.saeunRange` controls the analyzed year window for `yearlyFortune` (default: +/-5 years around `today`).

## Runtime behavior (important)

- Each section generator can return `null`; `buildIntegratedReport` skips it.
- Section generation errors are caught per section; failed sections are skipped and the report build continues.
