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
  summarySkeleton,
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

  // ── page simulation (F1b): 통합 보고서 한 화면에는 같은 사람·같은 기간·같은
  // 등급의 노출 6분야 summary 카드가 나란히 보인다. 분야 간 반복은 번들 게이트의
  // 사각지대이므로 여기서 계측한다. regen 글이 2개 미만인 페이지는 건너뜀. ──
  const EXPOSED = ['overall', 'wealth', 'health', 'academic', 'romance', 'family'];
  const SENSITIVE = new Set(['romance', 'family']);
  const summaryById = new Map<string, { summary: string; regen: boolean }>();
  for (const category of categories) {
    const dir = path.join(GENERATED_DIR, category);
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      const a = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as StoredArticle;
      if (a.articleId && a.summary) {
        summaryById.set(a.articleId, { summary: a.summary, regen: (a.sourceNote ?? '').startsWith('regen-') });
      }
    }
  }
  let pagesChecked = 0; let pagesViolating = 0;
  const pageRuleHits = new Map<string, number>();
  const pageWorst: string[] = [];
  const AUD_BANDS: Array<[string, string[], string[], string[]]> = [
    ['adult', ['weak', 'balanced', 'strong'], ['boost_strong', 'boost_mild', 'neutral', 'adverse'], ['high', 'mid', 'low']],
    ['teen', ['weak', 'strong'], ['boost_strong', 'boost_mild', 'neutral'], ['any']],
    ['child', ['weak', 'strong'], ['boost_strong', 'boost_mild', 'neutral'], ['any']],
  ];
  const FAMILIES = ['inseong', 'siksang', 'jaeseong', 'gwanseong', 'bigeop', 'special'];
  const PERIODS = ['today', 'thisWeek', 'thisMonth', 'thisYear', 'life'];
  for (const [aud, gangyaks, effects, bandsList] of AUD_BANDS) {
    for (const g of gangyaks) for (const gk of FAMILIES) for (const ne of effects) for (const gender of ['male', 'female']) {
      for (const period of PERIODS) for (const band of bandsList) {
        const page: Array<{ cat: string; summary: string }> = [];
        let regenCount = 0;
        for (const cat of EXPOSED) {
          const id = `${cat}.${period}.${aud}.${band}.${g}.${gk}.${ne}.${SENSITIVE.has(cat) ? gender : 'x'}`;
          const hit = summaryById.get(id);
          if (!hit) continue;
          page.push({ cat, summary: hit.summary });
          if (hit.regen) regenCount += 1;
        }
        if (regenCount < 2 || page.length < 2) continue;
        pagesChecked += 1;
        const exact = new Map<string, string[]>(); const skel = new Map<string, string[]>();
        for (const { cat, summary } of page) {
          const sNorm = summary.replace(/\s+/gu, ' ').trim();
          exact.set(sNorm, [...(exact.get(sNorm) ?? []), cat]);
          const sk = summarySkeleton(sNorm);
          skel.set(sk, [...(skel.get(sk) ?? []), cat]);
        }
        let bad = false;
        for (const [sNorm, cats] of exact) if (cats.length > 1) {
          bad = true; pageRuleHits.set('page-duplicate-summary', (pageRuleHits.get('page-duplicate-summary') ?? 0) + 1);
          if (pageWorst.length < 5) pageWorst.push(`[${aud}.${g}.${gk}.${ne}.${gender}·${period}/${band}] ${cats.join('+')}: "${sNorm.slice(0, 50)}"`);
        }
        for (const [sk, cats] of skel) if (cats.length > 2) {
          bad = true; pageRuleHits.set('page-summary-skeleton', (pageRuleHits.get('page-summary-skeleton') ?? 0) + 1);
          if (pageWorst.length < 5) pageWorst.push(`[${aud}.${g}.${gk}.${ne}.${gender}·${period}/${band}] skeleton×${cats.length} (${cats.join('+')}): "${sk.slice(0, 50)}"`);
        }
        if (bad) pagesViolating += 1;
      }
    }
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
  console.log(`\n## page simulation (F1b — 노출 6분야 summary 조합, regen≥2만): ${pagesViolating}/${pagesChecked} pages violate`);
  for (const [rule, count] of [...pageRuleHits.entries()].sort((a, b) => b[1] - a[1])) console.log(`- ${rule}: ${count}`);
  for (const w of pageWorst) console.log(`    · ${w}`);

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
