/**
 * manual-bundle-workbench.ts -- human editing loop for generated bundles.
 *
 * Commands:
 *   npx tsx tools/generation/manual-bundle-workbench.ts categories
 *   npx tsx tools/generation/manual-bundle-workbench.ts list <category> [--pending|--regen] [--filter=TEXT] [--limit N]
 *   npx tsx tools/generation/manual-bundle-workbench.ts export <category> <index|bundleKey> [--pending|--regen] [--filter=TEXT] [--out DIR]
 *   npx tsx tools/generation/manual-bundle-workbench.ts import <folder|bundle.edit.json> [--source=regen-manual-YYYYMMDD] [--dry-run]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { GenerationCase } from './case-schema.js';
import { bundleKeyOfCase } from './bundle-prompt.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(HERE, '../..');
const REPO_ROOT = path.resolve(SPRING_TS_ROOT, '../..');
const MANIFEST_DIR = path.resolve(SPRING_TS_ROOT, 'data/generation/manifest');
const GENERATED_DIR = path.resolve(SPRING_TS_ROOT, 'data/generated');
const DEFAULT_WORK_DIR = path.resolve(SPRING_TS_ROOT, 'tmp/manual-bundles');

interface StoredArticle {
  readonly sourceNote?: string;
  readonly summary?: string;
  readonly hook?: string;
  readonly body?: readonly string[];
  readonly expert?: readonly string[];
  readonly livingTips?: readonly string[];
  readonly cautions?: readonly string[];
}

interface BundleEntry {
  readonly index: number;
  readonly bundleKey: string;
  readonly cases: readonly GenerationCase[];
  readonly sourceCounts: Readonly<Record<string, number>>;
  readonly existingCount: number;
  readonly regenCount: number;
}

function readCases(category?: string): GenerationCase[] {
  const files = fs.readdirSync(MANIFEST_DIR)
    .filter((name) => name.endsWith('.manifest.jsonl'))
    .filter((name) => !category || name === `${category}.manifest.jsonl`);
  const out: GenerationCase[] = [];
  for (const fileName of files) {
    for (const line of fs.readFileSync(path.join(MANIFEST_DIR, fileName), 'utf-8').split('\n').filter(Boolean)) {
      out.push(JSON.parse(line) as GenerationCase);
    }
  }
  return out;
}

function categories(): string[] {
  return fs.readdirSync(MANIFEST_DIR)
    .filter((name) => name.endsWith('.manifest.jsonl'))
    .map((name) => name.replace(/\.manifest\.jsonl$/u, ''))
    .sort((a, b) => a.localeCompare(b));
}

function readGenerated(generationCase: GenerationCase): StoredArticle | null {
  const file = path.join(GENERATED_DIR, generationCase.category, `${generationCase.caseId}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as StoredArticle;
  } catch {
    return null;
  }
}

function buildBundles(category: string): BundleEntry[] {
  const groups = new Map<string, GenerationCase[]>();
  for (const generationCase of readCases(category)) {
    const bundleKey = bundleKeyOfCase(generationCase);
    groups.set(bundleKey, [...(groups.get(bundleKey) ?? []), generationCase]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bundleKey, cases], i) => {
      const ordered = [...cases].sort((a, b) => a.caseId.localeCompare(b.caseId));
      const sourceCounts: Record<string, number> = {};
      let existingCount = 0;
      let regenCount = 0;
      for (const generationCase of ordered) {
        const article = readGenerated(generationCase);
        if (!article) continue;
        existingCount += 1;
        const source = article.sourceNote ?? '(no-source)';
        sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
        if (typeof article.sourceNote === 'string' && article.sourceNote.startsWith('regen-')) regenCount += 1;
      }
      return { index: i + 1, bundleKey, cases: ordered, sourceCounts, existingCount, regenCount };
    });
}

function argValue(argv: readonly string[], name: string): string | undefined {
  const exact = argv.indexOf(name);
  if (exact >= 0) return argv[exact + 1];
  const prefixed = argv.find((arg) => arg.startsWith(`${name}=`));
  return prefixed ? prefixed.slice(name.length + 1) : undefined;
}

function filterBundles(entries: readonly BundleEntry[], argv: readonly string[]): BundleEntry[] {
  const filter = argValue(argv, '--filter')?.trim().toLowerCase();
  let out = [...entries];
  if (argv.includes('--pending')) out = out.filter((entry) => entry.regenCount < entry.cases.length);
  if (argv.includes('--regen')) out = out.filter((entry) => entry.regenCount === entry.cases.length);
  if (filter) out = out.filter((entry) => entry.bundleKey.toLowerCase().includes(filter));
  return out;
}

function statusLabel(entry: BundleEntry): string {
  if (entry.regenCount === entry.cases.length) return 'regen';
  if (entry.existingCount === entry.cases.length) return 'existing';
  if (entry.existingCount > 0) return 'partial';
  return 'missing';
}

function printUsage(): void {
  console.log(`Usage:
  npx tsx tools/generation/manual-bundle-workbench.ts categories
  npx tsx tools/generation/manual-bundle-workbench.ts list <category> [--pending|--regen] [--filter=TEXT] [--limit N]
  npx tsx tools/generation/manual-bundle-workbench.ts export <category> <index|bundleKey> [--pending|--regen] [--filter=TEXT] [--out DIR]
  npx tsx tools/generation/manual-bundle-workbench.ts import <folder|bundle.edit.json> [--source=regen-manual-YYYYMMDD] [--dry-run]`);
}

function commandCategories(): void {
  for (const category of categories()) {
    const entries = buildBundles(category);
    const regen = entries.filter((entry) => entry.regenCount === entry.cases.length).length;
    console.log(`${category.padEnd(22)} bundles=${entries.length} regen=${regen} remaining=${entries.length - regen}`);
  }
}

function commandList(argv: readonly string[]): void {
  const category = argv[1];
  if (!category) throw new Error('list requires <category>');
  const entries = filterBundles(buildBundles(category), argv);
  const limit = Number(argValue(argv, '--limit') ?? entries.length);
  console.log(`[${category}] bundles=${entries.length}`);
  for (const entry of entries.slice(0, Number.isFinite(limit) ? limit : entries.length)) {
    const sources = Object.entries(entry.sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([source, count]) => `${source}:${count}`)
      .join(', ');
    console.log(`${String(entry.index).padStart(4, ' ')}. ${entry.bundleKey} | ${statusLabel(entry)} | files ${entry.existingCount}/${entry.cases.length} | regen ${entry.regenCount}/${entry.cases.length}${sources ? ` | ${sources}` : ''}`);
  }
}

function safeSegment(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/gu, '-').slice(0, 120);
}

function selectBundle(category: string, selection: string, argv: readonly string[]): BundleEntry {
  const entries = filterBundles(buildBundles(category), argv);
  const byIndex = /^\d+$/u.test(selection) ? entries.find((entry) => entry.index === Number(selection)) : undefined;
  const selected = byIndex ?? entries.find((entry) => entry.bundleKey === selection);
  if (!selected) throw new Error(`bundle not found: ${selection}`);
  return selected;
}

function editableArticle(generationCase: GenerationCase): Record<string, unknown> {
  const article = readGenerated(generationCase);
  return {
    caseId: generationCase.caseId,
    summary: article?.summary ?? '',
    ...(article?.hook ? { hook: article.hook } : {}),
    body: [...(article?.body ?? ['', '', ''])],
    expert: [...(article?.expert ?? [''])],
    livingTips: [...(article?.livingTips ?? [])],
    cautions: [...(article?.cautions ?? [])],
  };
}

function previewMarkdown(entry: BundleEntry): string {
  const lines: string[] = [];
  lines.push(`# ${entry.bundleKey}`);
  lines.push('');
  lines.push(`- index: ${entry.index}`);
  lines.push(`- status: ${statusLabel(entry)}`);
  lines.push(`- articles: ${entry.cases.length}`);
  lines.push('');
  for (const generationCase of entry.cases) {
    const article = editableArticle(generationCase) as {
      caseId: string; summary: string; body: string[]; expert: string[]; livingTips: string[]; cautions: string[];
    };
    lines.push(`## ${article.caseId}`);
    lines.push('');
    lines.push(`summary: ${article.summary}`);
    lines.push('');
    lines.push('body:');
    for (const paragraph of article.body) lines.push(`- ${paragraph}`);
    lines.push('');
    lines.push('expert:');
    for (const paragraph of article.expert) lines.push(`- ${paragraph}`);
    lines.push('');
    if (article.livingTips.length) lines.push(`livingTips: ${article.livingTips.join(' / ')}`);
    if (article.cautions.length) lines.push(`cautions: ${article.cautions.join(' / ')}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function commandExport(argv: readonly string[]): void {
  const category = argv[1];
  const selection = argv[2];
  if (!category || !selection) throw new Error('export requires <category> <index|bundleKey>');
  const entry = selectBundle(category, selection, argv);
  const outRoot = path.resolve(REPO_ROOT, argValue(argv, '--out') ?? DEFAULT_WORK_DIR);
  const outDir = path.join(outRoot, `${String(entry.index).padStart(4, '0')}-${safeSegment(entry.bundleKey)}`);
  fs.mkdirSync(outDir, { recursive: true });

  const editFile = path.join(outDir, 'bundle.edit.json');
  const result = {
    results: [{
      bundleKey: entry.bundleKey,
      articles: entry.cases.map(editableArticle),
    }],
  };
  fs.writeFileSync(editFile, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'bundle.preview.md'), previewMarkdown(entry), 'utf-8');
  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
    exportedAt: new Date().toISOString(),
    category,
    index: entry.index,
    bundleKey: entry.bundleKey,
    status: statusLabel(entry),
    caseIds: entry.cases.map((generationCase) => generationCase.caseId),
    sourceCounts: entry.sourceCounts,
  }, null, 2)}\n`, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'README.md'), [
    `# Manual bundle edit: ${entry.bundleKey}`,
    '',
    'Edit bundle.edit.json only. Keep the JSON shape unchanged:',
    '- results[0].bundleKey must stay the same.',
    '- every article.caseId must stay the same.',
    '- edit summary/body/expert/livingTips/cautions text.',
    '',
    'Validate without writing:',
    `npx tsx tools/generation/manual-bundle-workbench.ts import "${path.relative(SPRING_TS_ROOT, outDir)}" --dry-run`,
    '',
    'Write passing articles:',
    `npx tsx tools/generation/manual-bundle-workbench.ts import "${path.relative(SPRING_TS_ROOT, outDir)}" --source=regen-manual-${todayStamp()}`,
    '',
  ].join('\n'), 'utf-8');

  console.log(`exported: ${path.relative(process.cwd(), outDir)}`);
  console.log(`edit:     ${path.relative(process.cwd(), editFile)}`);
}

function todayStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

function defaultSource(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `regen-manual-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function resolveEditFile(input: string): string {
  const full = path.resolve(process.cwd(), input);
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) return path.join(full, 'bundle.edit.json');
  return full;
}

function commandImport(argv: readonly string[]): void {
  const input = argv[1];
  if (!input) throw new Error('import requires <folder|bundle.edit.json>');
  const editFile = resolveEditFile(input);
  if (!fs.existsSync(editFile)) throw new Error(`edit file not found: ${editFile}`);
  const source = argValue(argv, '--source') ?? defaultSource();
  if (!source.startsWith('regen-')) throw new Error('--source must start with regen-');
  const args = ['tsx', 'tools/generation/ingest-bundles.ts', editFile, `--source=${source}`];
  if (argv.includes('--dry-run')) args.push('--dry-run');
  console.log(`running: npx ${args.join(' ')}`);
  const result = spawnSync('npx', args, {
    cwd: SPRING_TS_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  process.exitCode = typeof result.status === 'number' ? result.status : 1;
}

function main(): void {
  const argv = process.argv.slice(2);
  const command = argv[0];
  try {
    if (!command || command === 'help' || command === '--help' || command === '-h') {
      printUsage();
      return;
    }
    if (command === 'categories') { commandCategories(); return; }
    if (command === 'list') { commandList(argv); return; }
    if (command === 'export') { commandExport(argv); return; }
    if (command === 'import') { commandImport(argv); return; }
    throw new Error(`unknown command: ${command}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printUsage();
    process.exitCode = 2;
  }
}

main();
