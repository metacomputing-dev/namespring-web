#!/usr/bin/env node
/**
 * tools/check_hook_coverage.mjs
 *
 * Phase 19 Agent A4 -- brief.hook coverage CI gate.
 *
 * Failure mode this prevents: a future regression (gating-rule change,
 * fragment authoring drift, post-processor edit, or sample-generator
 * tweak) silently re-introduces dormant brief.hook fragment slots --
 * authored hooks whose fragmentId is never selected across the
 * `artifacts/sample-outputs-2026-05-05-phase3/*-tiered.json` matrix.
 *
 * History:
 *   - P13-A1 added the brief.hook field to fragment-registry.
 *   - P17-A1 reinforced gating for 8 fragmentIds across 5 cat|period
 *     combinations; P17-A3 / P15-A3 / P16-A3 added strictly-gated hooks.
 *   - P18-A2 proved 22 dormant slots in committed-sample state were a
 *     regen-staleness artifact. Post-regen, dormant count = 0; all 34
 *     authored brief.hook fragmentIds emit somewhere in the sample
 *     matrix, and all 34 distinct hook texts appear in cell.brief.hook
 *     (post-substitution).
 *
 * This gate ratchets that 0-state forward.
 *
 * Methodology (mirrors `artifacts/phase18-agent-a2/measure_p18_a2.mjs`,
 * keeping the per-fragmentId view as the gating signal because
 * authoring intent attaches to fragmentId):
 *
 *   1. Walk `data/narrative/<cat>/<period>/brief.fragments.json` for
 *      every category in {career, wealth, health, health_stress, romance,
 *      family, academic, study_document, expression_children, movement,
 *      overall} and every period in {today, thisWeek, thisMonth,
 *      thisYear, life}. Collect every fragment whose `hook` field is a
 *      non-empty string.
 *   2. Walk `artifacts/sample-outputs-2026-05-05-phase3/*-tiered.json`,
 *      visiting each `tieredMatrix.periods[periodKey].overall` and each
 *      `tieredMatrix.periods[periodKey].byCategory[catKey]` cell. For
 *      cells where `cell.brief.hook` is a non-empty string, harvest
 *      `cell.selectedFragments.brief.fragmentId` (the source-of-truth
 *      fragmentId selected by the engine for that cell).
 *   3. A "dormant" fragment slot is an authored fragment whose
 *      `fragmentId` does not appear in the harvested set. The gate fails
 *      if `dormantCount > --max-violations`.
 *
 * The samples directory is the read-only oracle. This gate does NOT
 * regenerate samples; pair it with `ci:samples-stale` (which runs the
 * generator under a snapshot+restore guard) so a freshly-built saju-ts
 * dist + a fresh regen are both verified.
 *
 * The per-hook-text view (after applying the post-processor's GyeolSub
 * substitutions) is reported for diagnostic visibility but does NOT
 * gate, because two authored fragments occasionally share the same
 * hook text (and per-text dormancy can lag per-fragmentId dormancy).
 *
 * Output:
 *   - default: human-readable summary on stdout, exit 1 on violations.
 *   - --json: structured JSON report on stdout.
 *
 * Flags:
 *   --json                       structured JSON report
 *   --max-violations=N           threshold above which the gate fails
 *                                (default 0 -- any dormant slot fails)
 *   --root=<path>                override spring-ts root
 *   --samples-dir=<path>         override samples directory (absolute
 *                                or relative to --root)
 *   --max-samples=N              cap printed/JSON dormant entries
 *                                (default 50)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SAMPLES_REL = 'artifacts/sample-outputs-2026-05-05-phase3';

const PERIODS = ['today', 'thisWeek', 'thisMonth', 'thisYear', 'life'];

// Categories that own a `brief.fragments.json` bundle. `_coverage`,
// `_glossary`, etc. are excluded because they don't carry brief.hook.
const CATEGORIES = [
  'overall',
  'career',
  'wealth',
  'health',
  'health_stress',
  'romance',
  'family',
  'academic',
  'study_document',
  'expression_children',
  'movement',
];

// Mirror of the post-processor's GyeolSub patterns from
// src/report/tiered/template-engine.ts. Used to compute the canonical
// emit form of an authored hook string. Order matters: longer patterns
// first.
const GYEOL_SUBSTITUTIONS = [
  [/결이에요/g, '흐름이에요'],
  [/결이라/g, '흐름이라'],
  [/결이고/g, '흐름이고'],
  [/결이/g, '흐름이'],
  [/결을/g, '흐름을'],
  [/결로/g, '흐름으로'],
];

function applyPostProcessor(hookText) {
  let out = hookText;
  for (const [re, replacement] of GYEOL_SUBSTITUTIONS) {
    out = out.replace(re, replacement);
  }
  return out;
}

function parseArgs(argv) {
  const args = {
    json: false,
    maxViolations: 0,
    root: DEFAULT_ROOT,
    samplesDir: null,
    maxSamples: 50,
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--json') args.json = true;
    else if (arg.startsWith('--max-violations=')) {
      const v = Number(arg.slice('--max-violations='.length));
      if (Number.isInteger(v) && v >= 0) args.maxViolations = v;
    } else if (arg.startsWith('--root=')) {
      args.root = path.resolve(arg.slice('--root='.length));
    } else if (arg.startsWith('--samples-dir=')) {
      args.samplesDir = arg.slice('--samples-dir='.length);
    } else if (arg.startsWith('--max-samples=')) {
      const v = Number(arg.slice('--max-samples='.length));
      if (Number.isInteger(v) && v >= 0) args.maxSamples = v;
    }
  }
  return args;
}

function resolveSamplesDir(root, samplesDir) {
  if (!samplesDir) return path.join(root, DEFAULT_SAMPLES_REL);
  return path.isAbsolute(samplesDir) ? samplesDir : path.resolve(root, samplesDir);
}

function loadAuthoredHooks(root) {
  const narrativeRoot = path.join(root, 'data', 'narrative');
  const authored = []; // { cat, period, fragmentId, gating, hook }
  const perCatPeriod = new Map();
  for (const cat of CATEGORIES) {
    for (const period of PERIODS) {
      const file = path.join(narrativeRoot, cat, period, 'brief.fragments.json');
      if (!fs.existsSync(file)) continue;
      let bundle;
      try {
        bundle = JSON.parse(fs.readFileSync(file, 'utf-8'));
      } catch {
        continue;
      }
      for (const frag of bundle?.fragments ?? []) {
        if (typeof frag?.hook === 'string' && frag.hook.length > 0) {
          const entry = {
            cat,
            period,
            fragmentId: frag.fragmentId ?? null,
            gating: frag.gating ?? {},
            hook: frag.hook,
          };
          authored.push(entry);
          const k = `${cat}|${period}`;
          if (!perCatPeriod.has(k)) perCatPeriod.set(k, []);
          perCatPeriod.get(k).push(entry);
        }
      }
    }
  }
  return { authored, perCatPeriod };
}

function listSampleFiles(samplesDir) {
  if (!fs.existsSync(samplesDir)) return [];
  return fs.readdirSync(samplesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /-tiered\.json$/.test(entry.name))
    .map((entry) => path.join(samplesDir, entry.name))
    .sort();
}

function harvestEmitFragments(samplesDir) {
  const sampleFiles = listSampleFiles(samplesDir);
  const selectedBriefFragmentIds = new Set();
  const perFragmentEmitCount = new Map(); // fragmentId -> count
  const emittedHookStrings = new Map(); // hookText -> count
  let totalEmitCells = 0;
  for (const file of sampleFiles) {
    let json;
    try {
      json = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      continue;
    }
    const tm = json?.payload?.tieredMatrix ?? json?.tieredMatrix;
    if (!tm?.periods) continue;
    for (const periodKey of Object.keys(tm.periods)) {
      const period = tm.periods[periodKey];
      if (!period) continue;
      const cells = [
        ['overall', period.overall],
        ...Object.entries(period.byCategory ?? {}),
      ];
      for (const [, cell] of cells) {
        if (!cell) continue;
        const briefHook = cell.brief?.hook;
        const briefFid = cell?.selectedFragments?.brief?.fragmentId;
        if (typeof briefHook === 'string' && briefHook.length > 0) {
          totalEmitCells += 1;
          if (briefFid) {
            selectedBriefFragmentIds.add(briefFid);
            perFragmentEmitCount.set(
              briefFid,
              (perFragmentEmitCount.get(briefFid) ?? 0) + 1,
            );
          }
          emittedHookStrings.set(
            briefHook,
            (emittedHookStrings.get(briefHook) ?? 0) + 1,
          );
        }
      }
    }
  }
  return {
    sampleFiles: sampleFiles.length,
    totalEmitCells,
    selectedBriefFragmentIds,
    perFragmentEmitCount,
    emittedHookStrings,
  };
}

function buildReport({ root, samplesDir, maxSamples }) {
  const resolvedSamples = resolveSamplesDir(root, samplesDir);
  const { authored, perCatPeriod } = loadAuthoredHooks(root);
  const emit = harvestEmitFragments(resolvedSamples);

  const dormantByFragmentSlot = [];
  for (const af of authored) {
    if (!af.fragmentId) continue;
    if (!emit.selectedBriefFragmentIds.has(af.fragmentId)) {
      dormantByFragmentSlot.push({
        cat: af.cat,
        period: af.period,
        ageBand: af.gating?.ageBand ?? null,
        fragmentId: af.fragmentId,
        gating: af.gating,
        hook: af.hook,
      });
    }
  }

  const dormantByHookText = [];
  const seenHookTexts = new Set();
  for (const af of authored) {
    if (seenHookTexts.has(af.hook)) continue;
    seenHookTexts.add(af.hook);
    const directEmit = emit.emittedHookStrings.has(af.hook);
    const postProcessed = applyPostProcessor(af.hook);
    const postEmit = emit.emittedHookStrings.has(postProcessed);
    if (!directEmit && !postEmit) {
      dormantByHookText.push({
        cat: af.cat,
        period: af.period,
        fragmentId: af.fragmentId,
        hook: af.hook,
        postProcessedForm: postProcessed === af.hook ? null : postProcessed,
      });
    }
  }

  const perFragmentEmitCountSorted = Array.from(emit.perFragmentEmitCount.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const lowestEmitTail = perFragmentEmitCountSorted.slice(-Math.min(5, perFragmentEmitCountSorted.length));

  const distinctAuthoredHookTexts = new Set(authored.map((a) => a.hook)).size;

  return {
    policy: 'spring-ts.brief-hook-coverage.v1',
    samplesDir: path.relative(root, resolvedSamples).replaceAll(path.sep, '/'),
    sampleFilesScanned: emit.sampleFiles,
    authored: {
      totalFragmentsWithHook: authored.length,
      distinctHookStrings: distinctAuthoredHookTexts,
      perCategoryPeriod: Object.fromEntries(
        Array.from(perCatPeriod.entries()).map(([k, v]) => [k, v.length]),
      ),
    },
    emitted: {
      totalEmitCells: emit.totalEmitCells,
      distinctSelectedFragmentIds: emit.selectedBriefFragmentIds.size,
      distinctHookStrings: emit.emittedHookStrings.size,
    },
    dormancy: {
      byFragmentSlot: {
        count: dormantByFragmentSlot.length,
        entries: dormantByFragmentSlot.slice(0, maxSamples),
      },
      byHookText: {
        count: dormantByHookText.length,
        entries: dormantByHookText.slice(0, maxSamples),
      },
    },
    fragility: {
      lowestEmitTail: lowestEmitTail.map(([fragmentId, count]) => ({ fragmentId, count })),
    },
    totalViolations: dormantByFragmentSlot.length,
  };
}

function renderHuman(report) {
  const lines = [];
  lines.push(
    `brief.hook coverage: samples=${report.sampleFilesScanned}, samplesDir=${report.samplesDir}`,
  );
  lines.push(
    `  authored: ${report.authored.totalFragmentsWithHook} fragments / ${report.authored.distinctHookStrings} distinct hook strings`,
  );
  lines.push(
    `  emitted:  ${report.emitted.totalEmitCells} cells / ${report.emitted.distinctSelectedFragmentIds} selected fragmentIds / ${report.emitted.distinctHookStrings} distinct hook strings`,
  );
  lines.push(
    `  dormant by fragmentId slot: ${report.dormancy.byFragmentSlot.count}`,
  );
  lines.push(
    `  dormant by hook text:        ${report.dormancy.byHookText.count} (diagnostic only)`,
  );
  if (report.dormancy.byFragmentSlot.count > 0) {
    lines.push('', 'Dormant fragment slots:');
    for (const e of report.dormancy.byFragmentSlot.entries) {
      lines.push(
        `- cell=${e.cat}|${e.period}  ageBand=${JSON.stringify(e.ageBand)}  fragmentId=${e.fragmentId}`,
      );
      lines.push(`    gating=${JSON.stringify(e.gating)}`);
      lines.push(`    hook="${e.hook}"`);
    }
  }
  if (report.fragility.lowestEmitTail.length > 0) {
    lines.push('', 'Lowest emit-count tail (fragility — first to fall on regression):');
    for (const t of report.fragility.lowestEmitTail) {
      lines.push(`  ${t.count}  ${t.fragmentId}`);
    }
  }
  return lines.join('\n');
}

const args = parseArgs(process.argv);
const report = buildReport({
  root: args.root,
  samplesDir: args.samplesDir,
  maxSamples: args.maxSamples,
});

if (args.json) console.log(JSON.stringify(report, null, 2));
else console.log(renderHuman(report));

if (report.totalViolations > args.maxViolations) {
  console.error(
    `brief.hook coverage: ${report.totalViolations} dormant slot(s) exceed --max-violations=${args.maxViolations}`,
  );
  process.exit(1);
}

export { buildReport, renderHuman };
