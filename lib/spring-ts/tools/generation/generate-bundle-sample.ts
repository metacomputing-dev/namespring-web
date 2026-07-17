/**
 * generate-bundle-sample.ts -- Generate one bundle through Codex CLI for
 * local prompt QA.
 *
 * This is an interactive-development helper, not the production batch path.
 * It prepares a single bundle prompt, asks `codex exec` to return JSON only,
 * saves the result in ingest-bundles shape, then optionally runs ingest
 * dry-run so prompt changes can be checked quickly.
 *
 * Usage:
 *   npx tsx tools/generation/generate-bundle-sample.ts --key=family.adult.balanced.bigeop.adverse.female
 *   npx tsx tools/generation/generate-bundle-sample.ts family.adult.balanced.bigeop.adverse.female --out=tmp/family-sample.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

interface BundlePrompt {
  readonly bundleKey: string;
  readonly caseIds: string[];
  readonly prompt: string;
}

interface BundleBatch {
  readonly bundles: BundlePrompt[];
}

interface GeneratedBundle {
  readonly bundleKey?: string;
  readonly articles?: unknown[];
}

interface GeneratedResults {
  readonly results?: GeneratedBundle[];
  readonly articles?: unknown[];
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPRING_ROOT = path.resolve(HERE, '../..');
const BATCH_FILE = path.join(SPRING_ROOT, 'data/generation/batches/bundles-keys-1.batch.json');

function usage(): never {
  console.error([
    'usage: generate-bundle-sample.ts <bundleKey> [--out=tmp/sample.json] [--model=gpt-5.5] [--no-gate]',
    '   or: generate-bundle-sample.ts --key=<bundleKey> [--out=tmp/sample.json] [--model=gpt-5.5] [--no-gate]',
  ].join('\n'));
  process.exit(2);
}

function argValue(argv: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = argv.find((a) => a.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/gu, '-');
}

function run(command: string, args: string[], options: { input?: string } = {}): string {
  const result = spawnSync(command, args, {
    cwd: SPRING_ROOT,
    input: options.input,
    encoding: 'utf-8',
    shell: process.platform === 'win32',
    stdio: options.input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `\n${detail}` : ''}`);
  }
  return result.stdout;
}

function readPreparedBundle(bundleKey: string): BundlePrompt {
  run('npx', ['tsx', 'tools/generation/prepare-bundles.ts', `--keys=${bundleKey}`]);
  const batch = JSON.parse(fs.readFileSync(BATCH_FILE, 'utf-8')) as BundleBatch;
  const bundle = batch.bundles.find((b) => b.bundleKey === bundleKey);
  if (!bundle) throw new Error(`bundle not found after prepare: ${bundleKey}`);
  return bundle;
}

function stripMarkdownFence(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/u);
  return fence ? fence[1].trim() : trimmed;
}

function extractJson(text: string): GeneratedResults {
  const raw = stripMarkdownFence(text);
  try {
    return JSON.parse(raw) as GeneratedResults;
  } catch {
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first < 0 || last <= first) throw new Error('Codex response did not contain a JSON object');
    return JSON.parse(raw.slice(first, last + 1)) as GeneratedResults;
  }
}

function normalizeResult(bundleKey: string, parsed: GeneratedResults): { results: Array<{ bundleKey: string; articles: unknown[] }> } {
  if (Array.isArray(parsed.results)) {
    return {
      results: parsed.results.map((r) => ({
        bundleKey: r.bundleKey ?? bundleKey,
        articles: Array.isArray(r.articles) ? r.articles : [],
      })),
    };
  }
  if (Array.isArray(parsed.articles)) return { results: [{ bundleKey, articles: parsed.articles }] };
  throw new Error('Codex JSON must contain either results[] or articles[]');
}

function buildCodexPrompt(bundle: BundlePrompt): string {
  return [
    '아래 번들 생성 프롬프트를 실제로 수행하세요.',
    '',
    '반드시 지킬 것:',
    '- 최종 응답은 valid JSON 하나만 출력하세요.',
    '- markdown, 설명, 코드블록, 주석을 출력하지 마세요.',
    '- 출력 구조는 {"articles":[...]} 또는 {"results":[{"bundleKey":"...","articles":[...]}]} 입니다.',
    `- bundleKey는 ${bundle.bundleKey} 입니다.`,
    `- articles는 정확히 ${bundle.caseIds.length}개여야 합니다.`,
    '- caseId는 프롬프트에 있는 값을 철자 그대로 한 번씩만 포함하세요.',
    '',
    '--- BEGIN BUNDLE PROMPT ---',
    bundle.prompt,
    '--- END BUNDLE PROMPT ---',
  ].join('\n');
}

function main(): void {
  const argv = process.argv.slice(2);
  const bundleKey = argValue(argv, '--key') ?? argv.find((a) => !a.startsWith('--'));
  if (!bundleKey) usage();

  const model = argValue(argv, '--model');
  const skipGate = argv.includes('--no-gate');
  const outArg = argValue(argv, '--out');
  const outFile = path.resolve(SPRING_ROOT, outArg ?? `tmp/llm-sample-${safeSegment(bundleKey)}.json`);
  const rawFile = outFile.replace(/\.json$/u, '.raw.txt');

  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  console.log(`prepare: ${bundleKey}`);
  const bundle = readPreparedBundle(bundleKey);

  console.log(`generate: codex exec${model ? ` --model ${model}` : ''}`);
  const codexArgs = [
    'exec',
    '--cd', path.resolve(SPRING_ROOT, '../..'),
    '--sandbox', 'danger-full-access',
    '-c', 'approval_policy="never"',
    '--output-last-message', rawFile,
    ...(model ? ['--model', model] : []),
    '-',
  ];
  run('codex', codexArgs, { input: buildCodexPrompt(bundle) });

  const parsed = extractJson(fs.readFileSync(rawFile, 'utf-8'));
  const normalized = normalizeResult(bundleKey, parsed);
  const articleCount = normalized.results.reduce((n, r) => n + r.articles.length, 0);
  fs.writeFileSync(outFile, `${JSON.stringify(normalized, null, 2)}\n`, 'utf-8');
  console.log(`wrote: ${path.relative(SPRING_ROOT, outFile)} (${articleCount} articles)`);
  console.log(`raw:   ${path.relative(SPRING_ROOT, rawFile)}`);

  if (!skipGate) {
    const source = `regen-sample-${new Date().toISOString().slice(0, 10).replace(/-/gu, '')}`;
    console.log('\ngate: ingest-bundles --dry-run');
    const gate = run('npx', ['tsx', 'tools/generation/ingest-bundles.ts', path.relative(SPRING_ROOT, outFile), `--source=${source}`, '--dry-run']);
    process.stdout.write(gate);
  }
}

main();
