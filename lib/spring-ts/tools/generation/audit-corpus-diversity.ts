/**
 * audit-corpus-diversity.ts -- Measure repetition + text defects across the
 * whole generated corpus (docs/PLAN_PR1_GENERATED_TEXT_QUALITY.md §5).
 *
 * Reports, per category and overall:
 *  - uniqueness ratios (summary / body / expert / livingTips)
 *  - top repeated summaries and top repeated normalized 8-grams
 *  - validatePlainTextQuality rule hit counts (sampled details)
 *  - BUNDLE simulation: cells one person sees together (grouped by
 *    audience×강약×격국×nameEffect×성별) run through bundleDiversityViolations
 *  - provenance counts by sourceNote (tracks regeneration waves)
 *
 * Writes an aggregate JSON to data/generation/audit/ (small; committable as
 * a before/after baseline) and prints a summary.
 *
 * Run: npm run audit:generated            (all categories)
 *      npx tsx tools/generation/audit-corpus-diversity.ts wealth
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bundleDiversityViolations,
  validatePlainTextQuality,
  type BundleArticleLike,
} from './text-quality-rules.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = path.resolve(HERE, '../../data/generated');
const AUDIT_DIR = path.resolve(HERE, '../../data/generation/audit');

interface StoredArticle {
  articleId: string;
  category: string;
  period: string;
  audience: string;
  band: string;
  caseAxes?: { gangyak?: string; gyeokgukFamily?: string; nameEffect?: string; gender?: string | null };
  summary?: string;
  hook?: string;
  body?: string[];
  expert?: string[];
  livingTips?: string[];
  cautions?: string[];
  sourceNote?: string;
}

function norm(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function bundleKeyOf(a: StoredArticle): string {
  const x = a.caseAxes ?? {};
  return [a.category, a.audience, x.gangyak ?? '?', x.gyeokgukFamily ?? '?', x.nameEffect ?? '?', x.gender ?? 'x'].join('.');
}

interface Counter { total: number; unique: Set<string>; counts: Map<string, number>; }
function counter(): Counter { return { total: 0, unique: new Set(), counts: new Map() }; }
function add(c: Counter, value: string): void {
  const v = norm(value);
  if (!v) return;
  c.total += 1;
  c.unique.add(v);
  c.counts.set(v, (c.counts.get(v) ?? 0) + 1);
}
function top(c: Counter, n: number): Array<[string, number]> {
  return [...c.counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}
function ratio(c: Counter): string {
  return c.total === 0 ? '-' : `${c.unique.size}/${c.total} (${((c.unique.size / c.total) * 100).toFixed(1)}%)`;
}

function main(): void {
  const onlyCategory = process.argv[2];
  const categories = fs.readdirSync(GENERATED_DIR)
    .filter((d) => fs.statSync(path.join(GENERATED_DIR, d)).isDirectory())
    .filter((d) => !onlyCategory || d === onlyCategory);

  const perCategory: Record<string, Record<string, string>> = {};
  const globalSummary = counter(); const globalBody = counter();
  const globalExpert = counter(); const globalTips = counter();
  const ruleHits = new Map<string, number>();
  const ruleSamples = new Map<string, string[]>();
  const provenance = new Map<string, number>();
  const grams = new Map<string, number>();
  const bundles = new Map<string, BundleArticleLike[]>();
  let files = 0;

  for (const category of categories) {
    const catSummary = counter(); const catBody = counter();
    const catExpert = counter(); const catTips = counter();
    const dir = path.join(GENERATED_DIR, category);
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      const a = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as StoredArticle;
      files += 1;
      provenance.set(a.sourceNote ?? '?', (provenance.get(a.sourceNote ?? '?') ?? 0) + 1);
      if (a.summary) { add(catSummary, a.summary); add(globalSummary, a.summary); }
      for (const p of a.body ?? []) { add(catBody, p); add(globalBody, p); }
      for (const p of a.expert ?? []) { add(catExpert, p); add(globalExpert, p); }
      for (const t of a.livingTips ?? []) { add(catTips, t); add(globalTips, t); }

      // defect rules
      for (const v of validatePlainTextQuality(a)) {
        ruleHits.set(v.rule, (ruleHits.get(v.rule) ?? 0) + 1);
        const samples = ruleSamples.get(v.rule) ?? [];
        if (samples.length < 3) { samples.push(`${a.articleId}: ${v.detail.slice(0, 60)}`); ruleSamples.set(v.rule, samples); }
      }

      // burned-candidate mining (normalized 8-grams, per-file dedup, stride 4)
      const text = [...(a.body ?? []), ...(a.expert ?? [])].join(' ')
        .replace(/\{\{[^{}]*\}\}/gu, '□').replace(/#\{[^{}]*\}/gu, '△')
        .replace(/[\s.,!?…·—''""()\-]/gu, '');
      const seen = new Set<string>();
      for (let i = 0; i + 8 <= text.length; i += 4) {
        const g = text.slice(i, i + 8);
        if (!seen.has(g)) { seen.add(g); grams.set(g, (grams.get(g) ?? 0) + 1); }
      }

      // bundle grouping for the person-view simulation
      const key = bundleKeyOf(a);
      bundles.set(key, [...(bundles.get(key) ?? []), {
        caseId: a.articleId, summary: a.summary ?? '',
        body: a.body, expert: a.expert, livingTips: a.livingTips,
      }]);
    }
    perCategory[category] = {
      files: String(catSummary.total),
      summaryUnique: ratio(catSummary), bodyUnique: ratio(catBody),
      expertUnique: ratio(catExpert), tipsUnique: ratio(catTips),
    };
  }

  // bundle simulation
  const bundleRuleHits = new Map<string, number>();
  let violatingBundles = 0;
  const worstBundles: Array<{ key: string; violations: number; sample: string }> = [];
  for (const [key, articles] of bundles) {
    const violations = bundleDiversityViolations(articles);
    if (violations.length === 0) continue;
    violatingBundles += 1;
    for (const v of violations) bundleRuleHits.set(v.rule, (bundleRuleHits.get(v.rule) ?? 0) + 1);
    worstBundles.push({ key, violations: violations.length, sample: violations[0].detail.slice(0, 80) });
  }
  worstBundles.sort((a, b) => b.violations - a.violations);

  // ── print ──
  console.log(`# generated corpus diversity audit — ${files} files, ${categories.length} categories\n`);
  console.log('## uniqueness per category');
  for (const [cat, s] of Object.entries(perCategory)) {
    console.log(`- ${cat}: files ${s.files} · summary ${s.summaryUnique} · body ${s.bodyUnique} · expert ${s.expertUnique} · tips ${s.tipsUnique}`);
  }
  console.log(`- TOTAL: summary ${ratio(globalSummary)} · body ${ratio(globalBody)} · expert ${ratio(globalExpert)} · tips ${ratio(globalTips)}`);
  console.log('\n## top repeated summaries');
  for (const [s, c] of top(globalSummary, 10)) console.log(`- ${c}× ${s}`);
  console.log('\n## top repeated 8-grams (burned-phrase candidates)');
  for (const [g, c] of [...grams.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`- ${c}× ${g}`);
  console.log('\n## defect rule hits (validatePlainTextQuality)');
  for (const [rule, count] of [...ruleHits.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`- ${rule}: ${count}`);
    for (const s of ruleSamples.get(rule) ?? []) console.log(`    · ${s}`);
  }
  console.log(`\n## bundle simulation (person-view): ${violatingBundles}/${bundles.size} bundles violate`);
  for (const [rule, count] of [...bundleRuleHits.entries()].sort((a, b) => b[1] - a[1])) console.log(`- ${rule}: ${count}`);
  console.log('\n### worst bundles');
  for (const w of worstBundles.slice(0, 5)) console.log(`- ${w.key} (${w.violations}): ${w.sample}`);
  console.log('\n## provenance (sourceNote)');
  for (const [note, count] of [...provenance.entries()].sort((a, b) => b[1] - a[1])) console.log(`- ${note}: ${count}`);

  // ── aggregate JSON (small, committable baseline) ──
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
  const aggregate = {
    generatedAt: new Date().toISOString(),
    scope: onlyCategory ?? 'all',
    files,
    perCategory,
    total: {
      summaryUnique: globalSummary.unique.size, summaryTotal: globalSummary.total,
      bodyUnique: globalBody.unique.size, bodyTotal: globalBody.total,
      expertUnique: globalExpert.unique.size, expertTotal: globalExpert.total,
      tipsUnique: globalTips.unique.size, tipsTotal: globalTips.total,
    },
    topSummaries: top(globalSummary, 10),
    topGrams: [...grams.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
    defectRuleHits: Object.fromEntries(ruleHits),
    bundleSimulation: {
      bundles: bundles.size, violatingBundles,
      ruleHits: Object.fromEntries(bundleRuleHits),
      worst: worstBundles.slice(0, 10),
    },
    provenance: Object.fromEntries(provenance),
  };
  const outFile = path.join(AUDIT_DIR, `diversity-audit-${onlyCategory ?? 'all'}-latest.json`);
  fs.writeFileSync(outFile, JSON.stringify(aggregate, null, 2), 'utf-8');
  console.log(`\naudit JSON → ${path.relative(process.cwd(), outFile)}`);
}

main();
