/**
 * ingest-batch.ts -- Validate a run-batch result and write passing articles.
 *
 * Input: a JSON file { generated:[{caseId, article}] } (the run-batch workflow
 * output). For each, look up the case in the manifest, validate the article
 * against it (pairing + gate), and — if clean — write a full Article JSON to
 * data/generated/<category>/<caseId>.json (axis + provenance fields stamped
 * from the case). Rejected cases are logged for re-generation.
 *
 * Usage: npx tsx tools/generation/ingest-batch.ts <results.json>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GenerationCase } from './case-schema.js';
import { validateGenerated, type GeneratedArticle } from './validate-generated.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_DIR = path.resolve(HERE, '../../data/generation/manifest');
const OUT_DIR = path.resolve(HERE, '../../data/generated');

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

function toArticle(c: GenerationCase, g: GeneratedArticle): Record<string, unknown> {
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
    sourceNote: 'generation-2026-07',
  };
}

function main(): void {
  const resultsPath = process.argv[2];
  if (!resultsPath) { console.error('usage: ingest-batch.ts <results.json>'); process.exit(2); }
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8')) as { generated?: Array<{ caseId: string; article: GeneratedArticle }> };
  const manifest = loadManifest();
  let ok = 0; const rejected: Array<{ caseId: string; violations: string[] }> = [];
  for (const { caseId, article } of results.generated ?? []) {
    const c = manifest.get(caseId);
    if (!c) { rejected.push({ caseId, violations: ['case not in manifest'] }); continue; }
    const verdict = validateGenerated(article, c);
    if (!verdict.ok) { rejected.push({ caseId, violations: verdict.violations }); continue; }
    const dir = path.join(OUT_DIR, c.category);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${caseId}.json`), JSON.stringify(toArticle(c, article), null, 2), 'utf-8');
    ok += 1;
  }
  console.log(`ingested OK: ${ok}`);
  console.log(`rejected: ${rejected.length}`);
  for (const r of rejected) console.log(`  ✗ ${r.caseId}: ${r.violations.join(' | ')}`);
}

main();
