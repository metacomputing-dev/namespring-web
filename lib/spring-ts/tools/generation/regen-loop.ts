/**
 * regen-loop.ts -- Headless generate → gate → regenerate loop until rejected:0.
 *
 * Bundle granularity (docs/RESUME / 사용자 지침): a bundle that has ANY reject
 * is regenerated WHOLE next round so its cells keep one coherent tone; a bundle
 * is real-ingested (saved to disk as regen-*) ONLY when it passes with zero
 * rejects. Clean bundles drop out of the target set; failing + API-failed
 * bundles carry to the next round. Loop ends when the target set is empty or
 * --max-rounds is hit.
 *
 * Runs entirely off the Message Batches API (submit-batch → fetch-batch) — no
 * Claude Code session. Needs ANTHROPIC_API_KEY in the repo-root .env. This is
 * a thin orchestrator over the existing CLI tools; it parses their stdout and
 * the results-<id>.json file rather than re-implementing generation or gating.
 *
 * Usage:
 *   npx tsx tools/generation/regen-loop.ts <category> [--offset N] [--count N]
 *   npx tsx tools/generation/regen-loop.ts --keys=k1,k2
 *     [--model=opus|sonnet|fable] [--tag=<t>] [--source=regen-<t>] [--max-rounds=4]
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..'); // lib/spring-ts
const BATCH_DIR = path.join(ROOT, 'data/generation/batches');
const TOOL = (name: string): string => `tools/generation/${name}`;

interface BundleResult { bundleKey: string; articles: Array<{ caseId: string }>; }

/** Run `npx tsx <tool> ...` from the spring-ts root. `inherit` streams the
 *  child's output to our terminal (for long pollers); otherwise we capture it. */
function run(args: string[], inherit = false): string {
  const out = execFileSync('npx', ['--yes', 'tsx', ...args], {
    cwd: ROOT,
    encoding: 'utf-8',
    stdio: inherit ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'pipe', 'inherit'],
    maxBuffer: 128 * 1024 * 1024,
    shell: process.platform === 'win32', // npx resolves to npx.cmd on Windows
  });
  return out ?? '';
}

function arg(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : undefined;
}

/** Build one batch file for the given targets; return its path + the bundleKeys
 *  it actually contains (a bundle already fully regenerated is skipped upstream,
 *  so the real target set can shrink here too). */
function prepareBatch(targets: string[] | null, category: string | undefined, offset: string, count: string): { batchFile: string; keys: string[] } {
  const stdout = targets
    ? run([TOOL('prepare-bundles.ts'), `--keys=${targets.join(',')}`])
    : run([TOOL('prepare-bundles.ts'), category as string, '--offset', offset, '--count', count]);
  process.stdout.write(stdout);
  const fileMatch = stdout.match(/→\s*(\S+\.batch\.json)/u);
  const keysMatch = stdout.match(/bundleKeys:\s*(.+)/u);
  if (!fileMatch) throw new Error('prepare-bundles: no batch file in output (0 bundles?)');
  const batchFile = path.isAbsolute(fileMatch[1]) ? fileMatch[1] : path.join(ROOT, fileMatch[1]);
  const keys = keysMatch ? keysMatch[1].trim().split(',').filter(Boolean) : [];
  return { batchFile, keys };
}

/** Submit one batch file; return the batchId submit-batch created. */
function submit(batchFile: string, model: string, tag: string): string {
  const rel = path.relative(ROOT, batchFile);
  const stdout = run([TOOL('submit-batch.ts'), rel, `--model=${model}`, `--tag=${tag}`]);
  process.stdout.write(stdout);
  const m = stdout.match(/batch submitted:\s*(\S+)/u);
  if (!m) throw new Error('submit-batch: no batchId in output (missing ANTHROPIC_API_KEY?)');
  return m[1];
}

/** Wait for the batch and read the results-<id>.json fetch-batch writes. */
function fetchResults(batchId: string): { path: string; keys: string[] } {
  run([TOOL('fetch-batch.ts'), batchId, '--wait'], /* inherit */ true);
  const resultsPath = path.join(BATCH_DIR, `results-${batchId}.json`);
  if (!fs.existsSync(resultsPath)) throw new Error(`fetch-batch produced no ${resultsPath}`);
  const parsed = JSON.parse(fs.readFileSync(resultsPath, 'utf-8')) as { results?: BundleResult[] };
  return { path: resultsPath, keys: (parsed.results ?? []).map((r) => r.bundleKey) };
}

/** Dry-run the gate over a results file; return the bundleKeys with ≥1 reject. */
function dryRunFailing(resultsPath: string, source: string): Set<string> {
  const stdout = run([TOOL('ingest-bundles.ts'), resultsPath, `--source=${source}`, '--dry-run']);
  process.stdout.write(stdout);
  const failing = new Set<string>();
  for (const line of stdout.split('\n')) {
    const m = line.match(/^✗\s+(\S+):/u);
    if (m) failing.add(m[1]);
  }
  return failing;
}

/** Real-ingest (save to disk) only the given clean bundles from a results file. */
function ingestClean(resultsPath: string, cleanKeys: Set<string>, source: string): number {
  const parsed = JSON.parse(fs.readFileSync(resultsPath, 'utf-8')) as { results?: BundleResult[] };
  const clean = (parsed.results ?? []).filter((r) => cleanKeys.has(r.bundleKey));
  if (clean.length === 0) return 0;
  const cleanPath = resultsPath.replace(/\.json$/u, '.clean.json');
  fs.writeFileSync(cleanPath, JSON.stringify({ results: clean }, null, 1), 'utf-8');
  const stdout = run([TOOL('ingest-bundles.ts'), cleanPath, `--source=${source}`]);
  process.stdout.write(stdout);
  return clean.reduce((n, r) => n + r.articles.length, 0);
}

function main(): void {
  const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const keysArg = arg('--keys');
  const category = positional[0];
  if (!keysArg && !category) {
    console.error('usage: regen-loop.ts <category> [--offset N --count N] | --keys=k1,k2 [--model= --tag= --source= --max-rounds=]');
    process.exit(2);
  }
  const model = arg('--model') ?? 'opus';
  const tag = arg('--tag') ?? `${category ?? 'keys'}-loop`;
  const source = arg('--source') ?? `regen-${tag}`;
  if (!source.startsWith('regen-')) { console.error('--source must start with "regen-"'); process.exit(2); }
  const maxRounds = Number(arg('--max-rounds') ?? '4');
  const offset = arg('--offset') ?? '0';
  const count = arg('--count') ?? '20';

  let targets: string[] | null = keysArg ? keysArg.split(',').filter(Boolean) : null;
  const done: string[] = [];
  let round = 0;

  while (round < maxRounds) {
    round += 1;
    console.log(`\n================ round ${round}/${maxRounds} (source=${source}) ================`);

    let batchFile: string; let roundKeys: string[];
    try {
      ({ batchFile, keys: roundKeys } = prepareBatch(targets, category, offset, count));
    } catch (e) {
      console.log(`prepare produced no work — nothing left to do (${(e as Error).message}).`);
      break;
    }
    if (roundKeys.length === 0) { console.log('no target bundles this round — stopping.'); break; }
    console.log(`round targets (${roundKeys.length}): ${roundKeys.join(', ')}`);

    const batchId = submit(batchFile, model, tag);
    const { path: resultsPath, keys: returnedKeys } = fetchResults(batchId);

    const failingGate = dryRunFailing(resultsPath, source);
    const returnedSet = new Set(returnedKeys);
    const apiFailed = roundKeys.filter((k) => !returnedSet.has(k)); // never came back from the API
    const cleanKeys = new Set(returnedKeys.filter((k) => !failingGate.has(k)));

    const saved = ingestClean(resultsPath, cleanKeys, source);
    done.push(...cleanKeys);
    console.log(`round ${round}: clean ${cleanKeys.size} (saved ${saved} articles) · gate-failed ${failingGate.size} · api-failed ${apiFailed.length}`);

    const next = [...new Set([...failingGate, ...apiFailed])];
    if (next.length === 0) { console.log('\n✅ all target bundles reached rejected:0.'); targets = []; break; }
    targets = next;
  }

  console.log(`\n==== summary ==== done: ${done.length} bundle(s)`);
  if (targets && targets.length > 0) {
    console.log(`⚠ still failing after ${maxRounds} rounds (${targets.length}): ${targets.join(', ')}`);
    console.log(`re-run: npx tsx tools/generation/regen-loop.ts --keys=${targets.join(',')} --source=${source}`);
    process.exit(1);
  }
}

main();
