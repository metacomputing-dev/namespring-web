/**
 * chunk-runner.ts -- Session-method chunk runner for bundle generation.
 *
 * Splits the corpus into resumable chunks of N bundles. The LLM generation
 * itself rides the Claude Code session (an operator dispatches one agent per
 * bundle), so this script automates only the deterministic glue around it:
 *   prepare  → pick the next N not-done bundles, write one prompt file per
 *              bundle + a chunk manifest for the operator to generate against.
 *   finalize → collect the generated JSON per bundle, gate them, and REAL-ingest
 *              only the bundles that pass with zero rejects (bundle granularity —
 *              no partial import), optionally committing. Rejected/missing
 *              bundles are reported; they stay "not done" so the next prepare
 *              picks them up again (resume = disk regen- state, not the session).
 *
 * Per-session flow:
 *   1) npx tsx tools/generation/chunk-runner.ts prepare academic --count 10
 *   2) operator generates each bundle → writes <chunkDir>/<bundleKey>.out.json
 *   3) npx tsx tools/generation/chunk-runner.ts finalize --source=regen-academic-w1 --commit
 *
 * State lives on disk, so the session can end between chunks; the next
 * `prepare` skips bundles already saved under data/generated/ as regen-*.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');        // lib/spring-ts
const REPO = path.resolve(ROOT, '../..');        // repo root
const BATCH_DIR = path.join(ROOT, 'data/generation/batches');
const CHUNK_DIR = path.join(BATCH_DIR, 'chunk'); // gitignored (under batches/)
const MANIFEST = path.join(CHUNK_DIR, 'chunk.json');
const TOOL = (n: string): string => `tools/generation/${n}`;

interface ChunkBundle { bundleKey: string; caseIds: string[]; promptFile: string; outFile: string; }
interface ChunkManifest { category: string; createdKeys: string[]; bundles: ChunkBundle[]; }

function run(args: string[], inherit = false): string {
  const out = execFileSync('npx', ['--yes', 'tsx', ...args], {
    cwd: ROOT, encoding: 'utf-8',
    stdio: inherit ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'pipe', 'inherit'],
    maxBuffer: 128 * 1024 * 1024, shell: process.platform === 'win32',
  });
  return out ?? '';
}
function git(args: string[]): string {
  return execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
}
function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}

// ── prepare ─────────────────────────────────────────────────────────────────
type RawBundle = { bundleKey: string; caseIds: string[]; prompt: string };
function readBatch(prepStdout: string): RawBundle[] {
  const m = prepStdout.match(/→\s*(\S+\.batch\.json)/u);
  if (!m) { console.error('prepare: prepare-bundles produced no batch (0 bundles left?)'); process.exit(1); }
  const f = path.isAbsolute(m[1]) ? m[1] : path.join(ROOT, m[1]);
  return (JSON.parse(fs.readFileSync(f, 'utf-8')) as { bundles: RawBundle[] }).bundles;
}
const audienceOf = (bundleKey: string): string => bundleKey.split('.')[1];

function prepare(): void {
  const positional = process.argv.slice(3).filter((a) => !a.startsWith('--'));
  const category = positional[0];
  const keys = flag('--keys');
  const audience = flag('--audience'); // adult | child | stages | teen — chunk within one audience only
  const count = flag('--count') ?? '10';
  const offset = flag('--offset') ?? '0';
  if (!keys && !category) { console.error('prepare: <category> [--audience=adult --count N --offset M] | --keys=k1,k2'); process.exit(2); }

  let selected: RawBundle[];
  if (keys) {
    const stdout = run([TOOL('prepare-bundles.ts'), `--keys=${keys}`]);
    process.stdout.write(stdout);
    selected = readBatch(stdout);
  } else if (audience) {
    // pull the whole not-done list, keep only this audience, then slice by offset/count —
    // so a chunk never straddles an audience boundary (child/teen counts aren't ×10).
    const stdout = run([TOOL('prepare-bundles.ts'), category, '--offset', '0', '--count', '100000']);
    process.stdout.write(stdout.split('\n').slice(0, 1).join('\n') + '\n');
    const off = Number(offset);
    selected = readBatch(stdout).filter((b) => audienceOf(b.bundleKey) === audience).slice(off, off + Number(count));
  } else {
    const stdout = run([TOOL('prepare-bundles.ts'), category, '--offset', offset, '--count', count]);
    process.stdout.write(stdout);
    selected = readBatch(stdout);
  }
  if (!selected.length) { console.error(`prepare: no bundles selected${audience ? ` (audience=${audience} done or empty)` : ''}.`); process.exit(1); }

  fs.rmSync(CHUNK_DIR, { recursive: true, force: true });
  fs.mkdirSync(CHUNK_DIR, { recursive: true });
  const bundles: ChunkBundle[] = selected.map((b) => {
    const promptFile = path.join(CHUNK_DIR, `${b.bundleKey}.prompt.txt`);
    const outFile = path.join(CHUNK_DIR, `${b.bundleKey}.out.json`);
    fs.writeFileSync(promptFile, b.prompt, 'utf-8');
    return { bundleKey: b.bundleKey, caseIds: b.caseIds, promptFile, outFile };
  });
  const cat = (category ?? bundles[0]?.bundleKey.split('.')[0]) || 'mixed';
  const manifest: ChunkManifest = { category: cat, createdKeys: bundles.map((b) => b.bundleKey), bundles };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`\n[chunk] ${bundles.length} bundle(s)${audience ? ` · audience=${audience}` : ''} staged → ${path.relative(REPO, CHUNK_DIR)}`);
  for (const b of bundles) console.log(`  ${b.bundleKey}  (${b.caseIds.length}편)`);
  console.log(`\nnext: generate each bundle (read its .prompt.txt, write {"articles":[...]} to its .out.json), then:`);
  console.log(`  npx tsx tools/generation/chunk-runner.ts finalize --source=regen-<tag> --commit`);
}

// ── finalize ────────────────────────────────────────────────────────────────
function finalize(): void {
  const source = flag('--source');
  const dry = process.argv.includes('--dry');
  const commit = process.argv.includes('--commit');
  if (!source || !source.startsWith('regen-')) { console.error('finalize: --source=regen-<tag> required'); process.exit(2); }
  if (!fs.existsSync(MANIFEST)) { console.error(`finalize: no chunk manifest (${path.relative(REPO, MANIFEST)}). run prepare first.`); process.exit(2); }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8')) as ChunkManifest;

  const present: Array<{ bundleKey: string; articles: unknown[] }> = [];
  const missing: string[] = [];
  for (const b of manifest.bundles) {
    if (!fs.existsSync(b.outFile)) { missing.push(b.bundleKey); continue; }
    try {
      const j = JSON.parse(fs.readFileSync(b.outFile, 'utf-8')) as { articles?: unknown[] };
      if (Array.isArray(j.articles) && j.articles.length) present.push({ bundleKey: b.bundleKey, articles: j.articles });
      else missing.push(b.bundleKey);
    } catch { missing.push(b.bundleKey); }
  }
  if (present.length === 0) { console.error('finalize: no generated .out.json found for any bundle.'); process.exit(1); }

  const resultsPath = path.join(CHUNK_DIR, 'results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({ results: present }, null, 1), 'utf-8');

  // classify: dry-run the gate, collect bundleKeys with >=1 reject
  const dryOut = run([TOOL('ingest-bundles.ts'), resultsPath, `--source=${source}`, '--dry-run']);
  process.stdout.write(dryOut);
  const failing = new Set<string>();
  for (const ln of dryOut.split('\n')) { const m = ln.match(/^✗\s+(\S+):/u); if (m) failing.add(m[1]); }
  const clean = present.map((p) => p.bundleKey).filter((k) => !failing.has(k));

  let imported = 0;
  if (!dry && clean.length) {
    const cleanPath = path.join(CHUNK_DIR, 'results.clean.json');
    fs.writeFileSync(cleanPath, JSON.stringify({ results: present.filter((p) => clean.includes(p.bundleKey)) }, null, 1), 'utf-8');
    const realOut = run([TOOL('ingest-bundles.ts'), cleanPath, `--source=${source}`]);
    process.stdout.write(realOut);
    imported = clean.length;
    if (commit) {
      const rel = `lib/spring-ts/data/generated/${manifest.category}`;
      git(['add', rel]);
      const staged = git(['status', '--porcelain', '--', rel]).trim();
      if (staged) { git(['commit', '-q', '-m', `content(${manifest.category}): import ${imported} generated bundle(s) (${source})`]); console.log(`committed: ${imported} bundle(s) under ${rel}`); }
      else console.log('nothing new to commit (already saved?)');
    }
  }

  console.log(`\n==== chunk finalize ${dry ? '(dry)' : ''} ====`);
  console.log(`generated: ${present.length}/${manifest.bundles.length} · clean(rejected:0): ${clean.length}${dry ? ' [would import]' : ` · imported: ${imported}`}`);
  if (failing.size) console.log(`⚠ gate-failed (재생성 필요): ${[...failing].join(', ')}`);
  if (missing.length) console.log(`⚠ 미생성(.out.json 없음): ${missing.join(', ')}`);
  if (failing.size || missing.length) console.log(`re-run: npx tsx tools/generation/chunk-runner.ts prepare --keys=${[...failing, ...missing].join(',')}`);
}

function main(): void {
  const cmd = process.argv[2];
  if (cmd === 'prepare') return prepare();
  if (cmd === 'finalize') return finalize();
  console.error('usage: chunk-runner.ts prepare <category> [--count N --offset M | --keys=..] | finalize --source=regen-<tag> [--dry] [--commit]');
  process.exit(2);
}
main();
