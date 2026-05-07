#!/usr/bin/env node
/**
 * tools/check_livingtips_period_consistency.mjs
 *
 * Phase 33 Agent A1 — multi-period livingTips period-spine cluster
 * CI gate (the 20th gate).
 *
 * Failure mode this prevents: a fragment-pool revert in
 * `data/narrative/<cat>/<period>/standard.fragments.json` (only the
 * standard tier carries `livingTips` — brief and expert do not)
 * reintroduces a verbatim tip line across 4+ periods that spans 2+
 * distinct cohort stems within a single category, undoing the
 * period-spine differentiation that P28-A3 / P30-A3 / P31-A2 / P31-A3
 * / P32-A1 negotiated across all 11 narrative categories.
 *
 * History / lineage:
 *   - P28-A3 (wealth, base 25e61eaf): drove 5-period spine (오늘 / 주말
 *     / 월말 / 분기·5년 / 평생) on 15 fragments × 30 livingTips entries.
 *     Identified the "동일 4-period 반복" failure mode. See
 *     `artifacts/phase28-agent-a3/audit-2026-05-07.md`.
 *   - P30-A3 (academic + career, base ef84f66d): mirrored P28-A3
 *     spine on 15 cells / 30 entries across 2 categories. Resolved
 *     `aligned.007/008 "메모를 한 결로 엮기" 4-period verbatim` and
 *     `balanced.009/010 4-period verbatim cluster` (cross-cohort,
 *     within academic). See `artifacts/phase30-agent-a3/audit-2026-05-07.md`.
 *   - P31-A2 (overall + study_document, base a14f2e3f): 12 cells / 23
 *     tip-line edits. Resolved `balanced.conflicting.009 4-period
 *     verbatim` and `extreme_weak.conflicting.012 4-period verbatim`.
 *     See `artifacts/phase31-agent-a2/audit-2026-05-07.md`.
 *   - P31-A3 (expression_children + romance + health_stress + movement,
 *     base a14f2e3f): 12 cells / 16 entries. Resolved
 *     `romance.late_life.001 5p verbatim` and structural cluster
 *     reductions. See `artifacts/phase31-agent-a3/audit-2026-05-07.md`.
 *   - P32-A1 (family + health, base 70fa6599): 10 cells / 12 entries.
 *     Closed 11/11 narrative categories. Resolved
 *     `family.conflicting.010 4p verbatim`, `family.aligned.009 4p
 *     cross-fragment`, `health.balanced/aligned.001 잠은 평소처럼 4-cell
 *     cross-fragment`. See `artifacts/phase32-agent-a1/audit-2026-05-07.md`.
 *
 * Methodology:
 *
 *   1. Walk `data/narrative/<cat>/<period>/standard.fragments.json`
 *      for every concrete category (`_*` directories such as
 *      `_contract`, `_glossary`, `_metaphor`, `_modifier_*`, `_seed`,
 *      `_coverage` are skipped — they carry no narrative fragments)
 *      and every period in {today, thisWeek, thisMonth, thisYear, life}.
 *      Source-level scan; this gate intentionally does NOT consume
 *      `artifacts/sample-outputs-2026-05-05-phase3/` because livingTips
 *      lives in source data and the audits modified source directly.
 *      Sample regen is therefore not in scope and does not need to
 *      run before this gate fires.
 *   2. For each fragment in `bundle.fragments[]`, derive a
 *      cohort-stem from `fragmentId` by stripping the
 *      `<cat>.<period>.<depth>.` prefix (e.g.
 *      `wealth.today.standard.male.30_39.006` →
 *      `male.30_39.006`). The stem is the "cohort" the audits use
 *      when describing 4-period clusters.
 *   3. For each `(category, livingTipString)` key, accumulate the
 *      set of distinct periods it appears in and the set of distinct
 *      cohort stems it appears under (across any period).
 *   4. A `(category, livingTipString)` is a violation iff it spans
 *      `>= --min-periods` distinct periods (default 4) AND
 *      `>= --min-cohort-stems` distinct cohort stems (default 2).
 *   5. Gate fails if `violationCount > --max-violations` (default 0
 *      — Phase 28-32 lock target).
 *
 * Discriminant rationale:
 *
 *   The audits explicitly preserved several single-cohort N-period
 *   stable patterns as intentional invariants:
 *   - P28-A3 §"Untouched": `wealth.conflicting.005 "기준 한 줄 다시
 *     적어 두기"` — `기준`은 모든 horizon에서 동일하게 유지하는 stable
 *     원칙. Single cohort, intentional.
 *   - P31-A3 §"health_stress structural": child / female_20_29 /
 *     fire_strong / senior_55_69 / youth_10_19 cluster 5p verbatim
 *     each — biological-baseline cohort-anchored advice that does
 *     not gain from period-distinct differentiation. Single cohort,
 *     intentional.
 *   - P32-A1 §"child.001 5p": "잠자기 전 다정한 인사 한마디" /
 *     "함께 식사하는 자리 챙기기" / "잘 노는 자리를 응원해 주기" —
 *     어린이 호흡 anchor, period-invariant by design. Single cohort,
 *     intentional.
 *
 *   Requiring `>= 2 distinct cohort stems` excludes these (each
 *   spans 1 cohort stem only) while still catching the genuine
 *   editorial-template-leak failure mode (e.g.
 *   `academic.aligned.007 + aligned.008 "메모를 한 결로 엮기" 4p` is
 *   2 stems × 4 periods, P30-A3 §academic row 4-5 — the gate would
 *   flag a regression that re-collapses these).
 *
 * Coverage gap (not a blocker, deferred):
 *
 *   A single-cohort 4-period revert (e.g., rolling back
 *   `wealth.male.30_39.006` cluster to 4-period verbatim "5년 그림"
 *   that P28-A3 fixed) is NOT caught by this gate (1 cohort × 4
 *   periods fails the `>= 2 cohort stems` condition). Adding an
 *   allow-list for the ~24 audit-noted intentional invariants and
 *   then enforcing single-cohort `>= 4 periods` is a possible future
 *   ratchet but is out of scope for the 20th-gate baseline.
 *
 * Output:
 *   - default: human-readable summary on stdout, exit 1 on
 *     violations exceeding `--max-violations`.
 *   - --json: structured JSON report on stdout.
 *
 * Flags:
 *   --json                       structured JSON report
 *   --max-violations=N           threshold above which the gate
 *                                fails (default 0 — Phase 28-32 lock)
 *   --min-periods=N              minimum distinct periods a tip must
 *                                span to count (default 4)
 *   --min-cohort-stems=N         minimum distinct cohort stems a tip
 *                                must span to count (default 2)
 *   --root=<path>                override spring-ts root
 *   --data-dir=<path>            override narrative data directory
 *                                (absolute or relative to --root)
 *   --max-samples=N              cap printed/JSON violation samples
 *                                (default 30)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_DATA_REL = 'data/narrative';
const PERIODS = ['today', 'thisWeek', 'thisMonth', 'thisYear', 'life'];
const STANDARD_FILENAME = 'standard.fragments.json';

function parseArgs(argv) {
  const args = {
    json: false,
    maxViolations: 0,
    minPeriods: 4,
    minCohortStems: 2,
    root: DEFAULT_ROOT,
    dataDir: null,
    maxSamples: 30,
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--json') args.json = true;
    else if (arg.startsWith('--max-violations=')) {
      const v = Number(arg.slice('--max-violations='.length));
      if (Number.isInteger(v) && v >= 0) args.maxViolations = v;
    } else if (arg.startsWith('--min-periods=')) {
      const v = Number(arg.slice('--min-periods='.length));
      if (Number.isInteger(v) && v >= 1) args.minPeriods = v;
    } else if (arg.startsWith('--min-cohort-stems=')) {
      const v = Number(arg.slice('--min-cohort-stems='.length));
      if (Number.isInteger(v) && v >= 1) args.minCohortStems = v;
    } else if (arg.startsWith('--root=')) {
      args.root = path.resolve(arg.slice('--root='.length));
    } else if (arg.startsWith('--data-dir=')) {
      args.dataDir = arg.slice('--data-dir='.length);
    } else if (arg.startsWith('--max-samples=')) {
      const v = Number(arg.slice('--max-samples='.length));
      if (Number.isInteger(v) && v >= 0) args.maxSamples = v;
    }
  }
  return args;
}

function resolveDataDir(root, dataDir) {
  if (!dataDir) return path.join(root, DEFAULT_DATA_REL);
  return path.isAbsolute(dataDir) ? dataDir : path.resolve(root, dataDir);
}

function listCategories(dataDir) {
  if (!fs.existsSync(dataDir)) return [];
  return fs
    .readdirSync(dataDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .sort();
}

// Strip `<cat>.<period>.<depth>.` from `fragmentId`. Returns the
// remainder verbatim (which the audits treat as the cohort stem,
// e.g. `male.30_39.006`, `conflicting.005`, `child.001`).
function cohortStemFromFragmentId(fragmentId, category, period) {
  const prefix = category + '.' + period + '.standard.';
  if (typeof fragmentId !== 'string') return fragmentId;
  if (fragmentId.startsWith(prefix)) {
    return fragmentId.slice(prefix.length);
  }
  // Fall back: drop first 3 dot-separated segments (cat.period.depth)
  // so an unexpected depth name still yields a usable stem.
  const parts = fragmentId.split('.');
  if (parts.length < 4) return fragmentId;
  return parts.slice(3).join('.');
}

function harvestLivingTips({ dataDir, categories }) {
  // category -> Map<tipString, { periods: Map<period, Set<stem>>, fragmentIds: Set<string> }>
  const byCategory = new Map();
  let filesScanned = 0;
  let fragmentsScanned = 0;
  let livingTipsScanned = 0;

  for (const category of categories) {
    if (!byCategory.has(category)) byCategory.set(category, new Map());
    const tipMap = byCategory.get(category);
    for (const period of PERIODS) {
      const file = path.join(dataDir, category, period, STANDARD_FILENAME);
      if (!fs.existsSync(file)) continue;
      filesScanned += 1;
      let bundle;
      try {
        bundle = JSON.parse(fs.readFileSync(file, 'utf-8'));
      } catch {
        continue;
      }
      const fragments = Array.isArray(bundle?.fragments) ? bundle.fragments : [];
      for (const frag of fragments) {
        fragmentsScanned += 1;
        const tips = Array.isArray(frag?.livingTips) ? frag.livingTips : [];
        if (tips.length === 0) continue;
        const stem = cohortStemFromFragmentId(frag?.fragmentId, category, period);
        for (const tip of tips) {
          if (typeof tip !== 'string' || tip.length === 0) continue;
          livingTipsScanned += 1;
          let entry = tipMap.get(tip);
          if (!entry) {
            entry = { periods: new Map(), fragmentIds: new Set() };
            tipMap.set(tip, entry);
          }
          if (!entry.periods.has(period)) entry.periods.set(period, new Set());
          entry.periods.get(period).add(stem);
          entry.fragmentIds.add(frag?.fragmentId ?? '?');
        }
      }
    }
  }

  return {
    filesScanned,
    fragmentsScanned,
    livingTipsScanned,
    byCategory,
  };
}

function buildReport({ root, dataDir, minPeriods, minCohortStems, maxSamples }) {
  const resolvedDataDir = resolveDataDir(root, dataDir);
  const categories = listCategories(resolvedDataDir);
  const harvest = harvestLivingTips({
    dataDir: resolvedDataDir,
    categories,
  });

  const violations = [];
  for (const [category, tipMap] of harvest.byCategory.entries()) {
    for (const [tip, entry] of tipMap.entries()) {
      const periodCount = entry.periods.size;
      if (periodCount < minPeriods) continue;

      const allStems = new Set();
      for (const stems of entry.periods.values()) for (const s of stems) allStems.add(s);
      if (allStems.size < minCohortStems) continue;

      violations.push({
        category,
        tip,
        periodCount,
        cohortStemCount: allStems.size,
        periods: Array.from(entry.periods.keys()).sort(),
        cohortStems: Array.from(allStems).sort(),
        fragmentIds: Array.from(entry.fragmentIds).sort(),
      });
    }
  }

  // Sort: more periods first, then more stems, then category, then tip.
  violations.sort(
    (a, b) =>
      b.periodCount - a.periodCount ||
      b.cohortStemCount - a.cohortStemCount ||
      a.category.localeCompare(b.category) ||
      a.tip.localeCompare(b.tip),
  );

  return {
    policy: 'spring-ts.livingtips-period-consistency.v1',
    dataDir: path
      .relative(root, resolvedDataDir)
      .replaceAll(path.sep, '/'),
    categoriesScanned: categories.length,
    categories,
    filesScanned: harvest.filesScanned,
    fragmentsScanned: harvest.fragmentsScanned,
    livingTipsScanned: harvest.livingTipsScanned,
    discriminant: {
      minPeriods,
      minCohortStems,
    },
    violationCount: violations.length,
    violations: violations.slice(0, Math.max(0, maxSamples)),
  };
}

function renderHuman(report, maxViolations) {
  const lines = [];
  lines.push(
    'livingtips-period-consistency: categories=' + report.categoriesScanned +
      ', files=' + report.filesScanned +
      ', fragments=' + report.fragmentsScanned +
      ', livingTips=' + report.livingTipsScanned +
      ', dataDir=' + report.dataDir,
  );
  lines.push(
    '  policy: minPeriods=' + report.discriminant.minPeriods +
      ' minCohortStems=' + report.discriminant.minCohortStems +
      ' --max-violations=' + maxViolations,
  );
  lines.push('  violationCount=' + report.violationCount);
  if (report.violationCount > 0) {
    lines.push(
      '  Violations (cat × verbatim livingTip spanning >= minPeriods AND >= minCohortStems):',
    );
    for (const v of report.violations) {
      lines.push(
        '    ' + v.periodCount + 'p×' + v.cohortStemCount + 's  ' +
          v.category + '  ::  ' + v.tip,
      );
      lines.push(
        '      periods=[' + v.periods.join(',') + ']  cohortStems=[' +
          v.cohortStems.join(',') + ']',
      );
      lines.push('      fragments=[' + v.fragmentIds.join(',') + ']');
    }
  }
  return lines.join('\n');
}

const args = parseArgs(process.argv);
const report = buildReport({
  root: args.root,
  dataDir: args.dataDir,
  minPeriods: args.minPeriods,
  minCohortStems: args.minCohortStems,
  maxSamples: args.maxSamples,
});

if (args.json) console.log(JSON.stringify(report, null, 2));
else console.log(renderHuman(report, args.maxViolations));

if (report.violationCount > args.maxViolations) {
  console.error(
    'livingtips-period-consistency: ' + report.violationCount +
      ' cross-cohort verbatim cluster(s) (periods >= ' + args.minPeriods +
      ' AND cohortStems >= ' + args.minCohortStems +
      ') exceed --max-violations=' + args.maxViolations,
  );
  process.exit(1);
}

export {
  buildReport,
  renderHuman,
  cohortStemFromFragmentId,
  harvestLivingTips,
};
