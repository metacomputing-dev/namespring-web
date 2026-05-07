/**
 * artifacts/phase18-agent-a2/measure_p18_a2.mjs
 *
 * Phase 18 Agent A2 measurement. Audits brief.hook authored slots vs
 * emit cells in the regenerated tiered samples to identify dormant
 * fragment slots. Builds on P17-A1 + P17-A5 hook-distribution tooling
 * with a strict per-fragmentId dormancy analyzer that does not collapse
 * fragments with shared hook text.
 *
 * Output schema:
 *   {
 *     phase: 'P18-A2',
 *     authored: { totalFragments, totalDistinctHooks, perCategoryPeriod },
 *     emitted: { fragmentIdsSelected, distinctHookStrings, perFragmentEmitCount },
 *     dormancy: {
 *       byFragmentSlot: [...] // fragments with hook never selected for any cell
 *       byHookText: [...]     // hook strings in the corpus that never appear post-substitution
 *     },
 *     postProcessor: {
 *       hooksAffectedByGyeolSub: [...] // authored hooks that the post-processor mutates
 *     }
 *   }
 *
 * Read-only on data/ and sample artifacts. Does not touch src.
 *
 * Usage: node artifacts/phase18-agent-a2/measure_p18_a2.mjs [out.json]
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NARRATIVE_DIR = path.resolve(SPRING_TS_ROOT, 'data/narrative');
const SAMPLES_DIR = path.resolve(
  SPRING_TS_ROOT,
  'artifacts/sample-outputs-2026-05-05-phase3',
);

const PERIODS = ['today', 'thisWeek', 'thisMonth', 'thisYear', 'life'];

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

// 1. Load all authored brief.hook fragments.
const cats = fs
  .readdirSync(NARRATIVE_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name)
  .sort();

const authoredFragments = []; // each: { cat, period, fragmentId, gating, hook }
const authoredByCategoryPeriod = new Map();

for (const cat of cats) {
  for (const period of PERIODS) {
    const file = path.join(NARRATIVE_DIR, cat, period, 'brief.fragments.json');
    if (!fs.existsSync(file)) continue;
    const j = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const frag of j.fragments ?? []) {
      if (typeof frag?.hook === 'string' && frag.hook.length > 0) {
        const k = `${cat}|${period}`;
        const entry = {
          cat,
          period,
          fragmentId: frag.fragmentId,
          gating: frag.gating ?? {},
          hook: frag.hook,
        };
        authoredFragments.push(entry);
        if (!authoredByCategoryPeriod.has(k)) {
          authoredByCategoryPeriod.set(k, []);
        }
        authoredByCategoryPeriod.get(k).push(entry);
      }
    }
  }
}

// 2. Load all sample tiered outputs and collect:
//    - selectedFragments.brief.fragmentId per cell (only when hook present)
//    - emit text per cell
const sampleFiles = fs
  .readdirSync(SAMPLES_DIR)
  .filter((f) => /-tiered\.json$/.test(f))
  .sort();

const selectedBriefFragmentIds = new Set();
const perFragmentEmitCount = new Map(); // fragmentId -> count
const emittedHookStrings = new Map(); // hookText -> count
const emittedByCatPeriod = new Map(); // cat|period -> Map<hookText, count>
let totalEmitCells = 0;

for (const file of sampleFiles) {
  const fullPath = path.join(SAMPLES_DIR, file);
  const json = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  const tm = json?.payload?.tieredMatrix ?? json?.tieredMatrix;
  if (!tm?.periods) continue;
  for (const periodKey of Object.keys(tm.periods)) {
    const period = tm.periods[periodKey];
    if (!period) continue;
    const cells = [
      ['overall', period.overall],
      ...Object.entries(period.byCategory ?? {}),
    ];
    for (const [catKey, cell] of cells) {
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
        const k = `${catKey}|${periodKey}`;
        if (!emittedByCatPeriod.has(k)) {
          emittedByCatPeriod.set(k, new Map());
        }
        const inner = emittedByCatPeriod.get(k);
        inner.set(briefHook, (inner.get(briefHook) ?? 0) + 1);
      }
    }
  }
}

// 3. Compute dormancy.
//    a. Per-slot: authored fragment.fragmentId never appears in
//       selectedBriefFragmentIds.
//    b. Per-text: authored hook text never appears in emittedHookStrings
//       (after applying post-processor substitutions).

const dormantByFragmentSlot = [];
for (const af of authoredFragments) {
  if (!selectedBriefFragmentIds.has(af.fragmentId)) {
    dormantByFragmentSlot.push({
      cat: af.cat,
      period: af.period,
      fragmentId: af.fragmentId,
      gating: af.gating,
      hook: af.hook,
    });
  }
}

const dormantByHookText = [];
const seenHookTexts = new Set();
for (const af of authoredFragments) {
  if (seenHookTexts.has(af.hook)) continue;
  seenHookTexts.add(af.hook);
  const directEmit = emittedHookStrings.has(af.hook);
  const postProcessed = applyPostProcessor(af.hook);
  const postEmit = emittedHookStrings.has(postProcessed);
  if (!directEmit && !postEmit) {
    dormantByHookText.push({
      hook: af.hook,
      postProcessedForm:
        postProcessed === af.hook ? null : postProcessed,
      cat: af.cat,
      period: af.period,
      fragmentId: af.fragmentId,
    });
  }
}

// 4. Identify hooks affected by post-processor (informational).
const hooksAffectedByGyeolSub = [];
for (const af of authoredFragments) {
  const post = applyPostProcessor(af.hook);
  if (post !== af.hook) {
    hooksAffectedByGyeolSub.push({
      cat: af.cat,
      period: af.period,
      fragmentId: af.fragmentId,
      sourceHook: af.hook,
      emittedHook: post,
    });
  }
}

// 5. Per fragment emit count (sorted desc).
const perFragmentEmitCountSorted = Array.from(
  perFragmentEmitCount.entries(),
)
  .sort((a, b) => b[1] - a[1])
  .reduce((obj, [k, v]) => {
    obj[k] = v;
    return obj;
  }, {});

const out = {
  phase: 'P18-A2',
  generatedAt: new Date().toISOString(),
  source: {
    narrative: path.relative(SPRING_TS_ROOT, NARRATIVE_DIR),
    samples: path.relative(SPRING_TS_ROOT, SAMPLES_DIR),
  },
  authored: {
    totalFragmentsWithHook: authoredFragments.length,
    totalDistinctHookStrings: new Set(authoredFragments.map((a) => a.hook))
      .size,
    perCategoryPeriod: Object.fromEntries(
      Array.from(authoredByCategoryPeriod.entries()).map(([k, v]) => [
        k,
        v.length,
      ]),
    ),
  },
  emitted: {
    totalEmitCells,
    distinctSelectedFragmentIds: selectedBriefFragmentIds.size,
    distinctHookStrings: emittedHookStrings.size,
    perFragmentEmitCount: perFragmentEmitCountSorted,
    perHookEmitCount: Object.fromEntries(
      Array.from(emittedHookStrings.entries()).sort((a, b) => b[1] - a[1]),
    ),
  },
  dormancy: {
    byFragmentSlot: {
      count: dormantByFragmentSlot.length,
      entries: dormantByFragmentSlot,
    },
    byHookText: {
      count: dormantByHookText.length,
      entries: dormantByHookText,
    },
  },
  postProcessor: {
    hooksAffectedByGyeolSub,
  },
};

const target = process.argv[2];
const txt = JSON.stringify(out, null, 2);
if (target) {
  fs.writeFileSync(target, txt + '\n');
  console.log(`Wrote ${target}`);
} else {
  console.log(txt);
}
