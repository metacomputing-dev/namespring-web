/**
 * ingest-bundles.ts -- Validate a run-bundles result and write passing
 * articles (docs/PLAN_PR1_GENERATED_TEXT_QUALITY.md §6).
 *
 * Two gate layers per bundle:
 *  1. per-article: validateGenerated (schema/register/jargon/pairing + the
 *     text-quality rules wired into it) — a failing article is rejected.
 *  2. bundle diversity: bundleDiversityViolations over (new passing articles
 *     + previously regenerated siblings on disk). For a duplicate group the
 *     FIRST occurrence is kept (disk siblings always win); the rest of the
 *     new articles in the group are rejected. An ngram-stamp violation
 *     rejects every new article involved (stamping = rewrite the bundle).
 *
 * Rejected caseIds are printed per bundle → re-run those bundles with
 * prepare-bundles --keys=... (partial bundles are fine: the next ingest sees
 * saved siblings and enforces diversity against them).
 *
 * Usage: npx tsx tools/generation/ingest-bundles.ts <results.json> --source=regen-2026-07-w1
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GenerationCase } from './case-schema.js';
import { validateGenerated, type GeneratedArticle } from './validate-generated.js';
import {
  bandKeyOf,
  bundleDiversityViolations,
  bundleKeyFromCaseId,
  crossBundleDuplicateViolations,
  paragraphKey,
  shingleSet,
  type BundleArticleLike,
  type CrossBundleIndex,
} from './text-quality-rules.js';
import { bundleKeyOfCase } from './bundle-prompt.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_DIR = path.resolve(HERE, '../../data/generation/manifest');
const OUT_DIR = path.resolve(HERE, '../../data/generated');

interface BundleResult { bundleKey: string; articles: Array<GeneratedArticle & { caseId: string }>; }

function loadManifest(): Map<string, GenerationCase> {
  const m = new Map<string, GenerationCase>();
  for (const f of fs.readdirSync(MANIFEST_DIR).filter((n) => n.endsWith('.manifest.jsonl'))) {
    for (const line of fs.readFileSync(path.join(MANIFEST_DIR, f), 'utf-8').split('\n').filter(Boolean)) {
      const c = JSON.parse(line) as GenerationCase;
      m.set(c.caseId, c);
    }
  }
  return m;
}

/** Previously regenerated siblings of this bundle already on disk. */
function savedRegenSiblings(manifest: Map<string, GenerationCase>, bundleKey: string, exclude: Set<string>): BundleArticleLike[] {
  const out: BundleArticleLike[] = [];
  for (const c of manifest.values()) {
    if (bundleKeyOfCase(c) !== bundleKey || exclude.has(c.caseId)) continue;
    const file = path.join(OUT_DIR, c.category, `${c.caseId}.json`);
    if (!fs.existsSync(file)) continue;
    try {
      const a = JSON.parse(fs.readFileSync(file, 'utf-8')) as BundleArticleLike & { sourceNote?: string };
      if (typeof a.sourceNote === 'string' && a.sourceNote.startsWith('regen-')) {
        out.push({ caseId: c.caseId, summary: a.summary ?? '', body: a.body, expert: a.expert, livingTips: a.livingTips });
      }
    } catch { /* unreadable → ignore */ }
  }
  return out;
}

interface MutableCrossIndex {
  paragraphs: Map<string, string>;
  tips: Map<string, Set<string>>;
  cautions: Map<string, Set<string>>;
  bandBodies: Map<string, Array<{ caseId: string; sh: Set<string> }>>;
}
function emptyCrossIndex(): MutableCrossIndex {
  return { paragraphs: new Map(), tips: new Map(), cautions: new Map(), bandBodies: new Map() };
}
/** Index one article's paragraphs/tips/cautions/body-shingles for cross-bundle checks. */
function addToCross(idx: MutableCrossIndex, caseId: string, a: { body?: string[]; expert?: string[]; livingTips?: string[]; cautions?: string[] }): void {
  const bundleKey = bundleKeyFromCaseId(caseId);
  for (const p of [...(a.body ?? []), ...(a.expert ?? [])]) {
    const k = paragraphKey(p);
    if (k.length >= 20 && !idx.paragraphs.has(k)) idx.paragraphs.set(k, caseId);
  }
  for (const t of a.livingTips ?? []) {
    const k = t.replace(/\s+/gu, ' ').trim();
    if (k.length < 6) continue;
    (idx.tips.get(k) ?? idx.tips.set(k, new Set()).get(k)!).add(bundleKey);
  }
  for (const c of a.cautions ?? []) {
    const k = c.replace(/\s+/gu, ' ').trim();
    if (k.length < 8) continue;
    (idx.cautions.get(k) ?? idx.cautions.set(k, new Set()).get(k)!).add(bundleKey);
  }
  if ((a.body ?? []).length) {
    const bk = bandKeyOf(caseId);
    const arr = idx.bandBodies.get(bk) ?? [];
    arr.push({ caseId, sh: shingleSet((a.body ?? []).join(' ')) });
    idx.bandBodies.set(bk, arr);
  }
}
/** Cross-bundle index over every regen- article in a category. */
function buildCrossBundleIndex(category: string): MutableCrossIndex {
  const idx = emptyCrossIndex();
  const dir = path.join(OUT_DIR, category);
  if (!fs.existsSync(dir)) return idx;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    try {
      const a = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as {
        articleId?: string; sourceNote?: string; body?: string[]; expert?: string[]; livingTips?: string[]; cautions?: string[];
      };
      if (typeof a.sourceNote !== 'string' || !a.sourceNote.startsWith('regen-')) continue;
      addToCross(idx, a.articleId ?? f, a);
    } catch { /* unreadable → skip */ }
  }
  return idx;
}

function toStored(c: GenerationCase, g: GeneratedArticle, sourceNote: string): Record<string, unknown> {
  return {
    schemaVersion: 'spring-ts.article.v1',
    articleId: c.caseId,
    category: c.category, period: c.period, audience: c.audience, band: c.band,
    caseAxes: { gangyak: c.gangyak, gyeokgukFamily: c.gyeokgukFamily, nameEffect: c.nameEffect, gender: c.gender },
    summary: g.summary,
    ...(g.hook ? { hook: g.hook } : {}),
    body: g.body, expert: g.expert,
    livingTips: g.livingTips, cautions: g.cautions,
    aiGenerated: true,
    sourceNote,
  };
}

function main(): void {
  const resultsPath = process.argv[2];
  const sourceArg = process.argv.find((a) => a.startsWith('--source='));
  const dryRun = process.argv.includes('--dry-run');
  if (!resultsPath || !sourceArg) { console.error('usage: ingest-bundles.ts <results.json> --source=regen-2026-07-w1 [--dry-run]'); process.exit(2); }
  const sourceNote = sourceArg.slice('--source='.length);
  if (!sourceNote.startsWith('regen-')) { console.error('--source must start with "regen-" (resume detection depends on it)'); process.exit(2); }
  if (dryRun) console.log('== DRY RUN: 게이트 판정만, 파일 저장 없음 ==');

  const parsed = JSON.parse(fs.readFileSync(resultsPath, 'utf-8')) as { results?: BundleResult[] };
  const manifest = loadManifest();
  let ok = 0; let rejectedCount = 0;
  const rerunKeys = new Set<string>();
  const crossByCategory = new Map<string, MutableCrossIndex>();

  for (const bundle of parsed.results ?? []) {
    const rejected: Array<{ caseId: string; reasons: string[] }> = [];
    const passing: Array<{ c: GenerationCase; g: GeneratedArticle & { caseId: string } }> = [];

    // layer 1: per-article gate
    for (const article of bundle.articles) {
      const c = manifest.get(article.caseId);
      if (!c) { rejected.push({ caseId: article.caseId, reasons: ['case not in manifest'] }); continue; }
      if (bundleKeyOfCase(c) !== bundle.bundleKey) { rejected.push({ caseId: article.caseId, reasons: ['caseId not in this bundle'] }); continue; }
      const verdict = validateGenerated(article, c);
      if (!verdict.ok) { rejected.push({ caseId: article.caseId, reasons: verdict.violations }); continue; }
      passing.push({ c, g: article });
    }

    // layer 2: bundle diversity (new passing + saved regen siblings)
    const newIds = new Set(passing.map((p) => p.g.caseId));
    const siblings = savedRegenSiblings(manifest, bundle.bundleKey, newIds);
    const pool: BundleArticleLike[] = [
      ...siblings, // first → they win duplicate groups
      ...passing.map((p) => ({ caseId: p.g.caseId, summary: p.g.summary, body: p.g.body, expert: p.g.expert, livingTips: p.g.livingTips })),
    ];
    const rejectIds = new Set<string>();
    for (const v of bundleDiversityViolations(pool)) {
      const ids = v.caseIds ?? [];
      const involvedNew = ids.filter((id) => newIds.has(id));
      if (involvedNew.length === 0) continue; // legacy-only violation → not ours
      // keep the first occurrence (a disk sibling, or the first new one when
      // the whole group is new) — except stamping, which rejects all new.
      const keep = v.rule === 'bundle-ngram-stamp' ? undefined : ids[0];
      for (const id of involvedNew) {
        if (id === keep) continue;
        rejectIds.add(id);
        const entry = rejected.find((r) => r.caseId === id);
        const reason = `${v.rule}: ${v.detail}`;
        if (entry) entry.reasons.push(reason);
        else rejected.push({ caseId: id, reasons: [reason] });
      }
    }

    // layer 3: cross-bundle paragraph reuse (adjacent bundles of the same
    // category must not share paragraphs — name-candidate comparison UX).
    const category = bundle.bundleKey.split('.')[0];
    const cross = crossByCategory.get(category) ?? buildCrossBundleIndex(category);
    crossByCategory.set(category, cross);
    for (const { g } of passing) {
      if (rejectIds.has(g.caseId)) continue;
      for (const v of crossBundleDuplicateViolations({ ...g, caseId: g.caseId }, cross as CrossBundleIndex)) {
        const owner = v.caseIds?.[0];
        const ownerCase = owner ? manifest.get(owner) : undefined;
        if (ownerCase && bundleKeyOfCase(ownerCase) === bundle.bundleKey) continue; // sibling → layer 2's call
        rejectIds.add(g.caseId);
        const reason = `${v.rule}: ${v.detail}`;
        const entry = rejected.find((r) => r.caseId === g.caseId);
        if (entry) entry.reasons.push(reason);
        else rejected.push({ caseId: g.caseId, reasons: [reason] });
      }
    }

    // write survivors (and feed the cross-bundle index for later bundles)
    for (const { c, g } of passing) {
      if (rejectIds.has(g.caseId)) continue;
      if (!dryRun) {
        const dir = path.join(OUT_DIR, c.category);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${c.caseId}.json`), JSON.stringify(toStored(c, g, sourceNote), null, 2), 'utf-8');
      }
      ok += 1;
      addToCross(cross, c.caseId, g);
    }

    // coverage: caseIds the agent never returned
    const returned = new Set(bundle.articles.map((a) => a.caseId));
    const expected = [...manifest.values()].filter((c) => bundleKeyOfCase(c) === bundle.bundleKey).map((c) => c.caseId);
    for (const id of expected) {
      if (!returned.has(id) && !siblings.some((s) => s.caseId === id)) {
        rejected.push({ caseId: id, reasons: ['missing from agent output'] });
      }
    }

    if (rejected.length > 0) {
      rerunKeys.add(bundle.bundleKey);
      rejectedCount += rejected.length;
      console.log(`✗ ${bundle.bundleKey}:`);
      for (const r of rejected) console.log(`    ${r.caseId}: ${r.reasons.slice(0, 4).join(' | ').slice(0, 220)}`);
    }
  }

  console.log(`\ningested OK: ${ok}`);
  console.log(`rejected: ${rejectedCount}`);
  if (rerunKeys.size > 0) console.log(`re-run: npx tsx tools/generation/prepare-bundles.ts --keys=${[...rerunKeys].join(',')}`);
}

main();
