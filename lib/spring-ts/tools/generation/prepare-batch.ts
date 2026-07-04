/**
 * prepare-batch.ts -- Build a generation batch from the manifest.
 *
 * Reads cases from data/generation/manifest/<category>.manifest.jsonl and emits
 * a batch file { schema, items:[{caseId, prompt}] } that the run-batch workflow
 * fans out over. Keeps the (drift-free) prompt logic here in Node — the
 * workflow only calls agent(prompt, {schema}).
 *
 * Usage:
 *   npx tsx tools/generation/prepare-batch.ts <category> <start> <count>
 *   npx tsx tools/generation/prepare-batch.ts --ids=<caseId>,<caseId>,...
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GenerationCase } from './case-schema.js';
import { ARTICLE_OUTPUT_SCHEMA, buildExpertPrompt } from './expert-prompt.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_DIR = path.resolve(HERE, '../../data/generation/manifest');
const BATCH_DIR = path.resolve(HERE, '../../data/generation/batches');

function readShard(category: string): GenerationCase[] {
  const file = path.join(MANIFEST_DIR, `${category}.manifest.jsonl`);
  return fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as GenerationCase);
}

function readAllCases(): GenerationCase[] {
  const out: GenerationCase[] = [];
  for (const f of fs.readdirSync(MANIFEST_DIR).filter((n) => n.endsWith('.manifest.jsonl'))) {
    out.push(...fs.readFileSync(path.join(MANIFEST_DIR, f), 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as GenerationCase));
  }
  return out;
}

function main(): void {
  const argv = process.argv.slice(2);
  let cases: GenerationCase[] = [];
  let name = 'batch';
  const idsArg = argv.find((a) => a.startsWith('--ids='));
  if (idsArg) {
    const ids = new Set(idsArg.slice('--ids='.length).split(',').filter(Boolean));
    cases = readAllCases().filter((c) => ids.has(c.caseId));
    name = `ids-${cases.length}`;
  } else {
    const [category, startStr, countStr] = argv;
    if (!category || startStr === undefined || countStr === undefined) {
      console.error('usage: prepare-batch.ts <category> <start> <count> | --ids=a,b,c');
      process.exit(2);
    }
    const start = Number(startStr); const count = Number(countStr);
    cases = readShard(category).slice(start, start + count);
    name = `${category}-${start}-${count}`;
  }
  const items = cases.map((c) => ({ caseId: c.caseId, prompt: buildExpertPrompt(c) }));
  fs.mkdirSync(BATCH_DIR, { recursive: true });
  const outFile = path.join(BATCH_DIR, `${name}.batch.json`);
  fs.writeFileSync(outFile, JSON.stringify({ schema: ARTICLE_OUTPUT_SCHEMA, items }, null, 2), 'utf-8');
  console.log(`batch: ${items.length} items → ${path.relative(process.cwd(), outFile)}`);
}

main();
