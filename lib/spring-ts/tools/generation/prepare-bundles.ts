/**
 * prepare-bundles.ts -- Build a BUNDLE generation batch from the manifest.
 *
 * Groups manifest cases by person-key (audience[stages merged] × 강약 × 격국
 * × nameEffect × 성별) and emits one prompt per bundle. Resumable: a bundle
 * counts as done when every one of its articles exists under data/generated/
 * with a sourceNote starting with "regen-" (the stamped 2026-07 corpus does
 * NOT count as done — regeneration overwrites it).
 *
 * Usage:
 *   npx tsx tools/generation/prepare-bundles.ts <category> [--offset 0] [--count 20] [--all]
 *   npx tsx tools/generation/prepare-bundles.ts --keys=<bundleKey>,<bundleKey>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GenerationCase } from './case-schema.js';
import { BUNDLE_OUTPUT_SCHEMA, buildBundlePrompt, bundleKeyOfCase } from './bundle-prompt.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_DIR = path.resolve(HERE, '../../data/generation/manifest');
const BATCH_DIR = path.resolve(HERE, '../../data/generation/batches');
const GENERATED_DIR = path.resolve(HERE, '../../data/generated');

function readCases(category?: string): GenerationCase[] {
  const files = fs.readdirSync(MANIFEST_DIR)
    .filter((n) => n.endsWith('.manifest.jsonl'))
    .filter((n) => !category || n === `${category}.manifest.jsonl`);
  const out: GenerationCase[] = [];
  for (const f of files) {
    out.push(...fs.readFileSync(path.join(MANIFEST_DIR, f), 'utf-8')
      .split('\n').filter(Boolean).map((l) => JSON.parse(l) as GenerationCase));
  }
  return out;
}

/** Done = regenerated (sourceNote regen-*), not merely present. */
function isRegenerated(c: GenerationCase): boolean {
  const file = path.join(GENERATED_DIR, c.category, `${c.caseId}.json`);
  if (!fs.existsSync(file)) return false;
  try {
    const a = JSON.parse(fs.readFileSync(file, 'utf-8')) as { sourceNote?: string };
    return typeof a.sourceNote === 'string' && a.sourceNote.startsWith('regen-');
  } catch {
    return false;
  }
}

function main(): void {
  const argv = process.argv.slice(2);
  const includeDone = argv.includes('--all');
  // --missing-only: 번들에서 미완(regen 아님) caseId만 프롬프트에 싣는다.
  // 이미 완성된 편은 재생성·재과금·덮어쓰기에서 제외 — 매니페스트에 셀이
  // 추가된 뒤(S4 stage 등급 확장) 신규분만 채울 때 사용. ingest 커버리지는
  // 디스크의 regen 형제를 인정하므로 부분 결과도 그대로 통과한다.
  const missingOnly = argv.includes('--missing-only');
  const keysArg = argv.find((a) => a.startsWith('--keys='));
  const num = (flag: string, dflt: number): number => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] !== undefined ? Number(argv[i + 1]) : dflt;
  };
  const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--offset' && argv[i - 1] !== '--count');
  const category = positional[0];

  const groups = new Map<string, GenerationCase[]>();
  for (const c of readCases(keysArg ? undefined : category)) {
    const key = bundleKeyOfCase(c);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  let entries = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (keysArg) {
    const wanted = new Set(keysArg.slice('--keys='.length).split(',').filter(Boolean));
    entries = entries.filter(([key]) => wanted.has(key));
  } else {
    if (!category) { console.error('usage: prepare-bundles.ts <category> [--offset N] [--count N] [--all] | --keys=k1,k2'); process.exit(2); }
    const doneCount = entries.filter(([, cases]) => cases.every(isRegenerated)).length;
    console.log(`[${category}] 번들 ${entries.length} · regen 완료 ${doneCount} · 남음 ${entries.length - doneCount}`);
    if (!includeDone) entries = entries.filter(([, cases]) => !cases.every(isRegenerated));
    entries = entries.slice(num('--offset', 0), num('--offset', 0) + num('--count', 20));
  }

  const bundles = entries
    .map(([bundleKey, cases]) => {
      const scoped = missingOnly ? cases.filter((c) => !isRegenerated(c)) : cases;
      if (scoped.length === 0) return null;
      const ordered = [...scoped].sort((a, b) => a.caseId.localeCompare(b.caseId));
      return { bundleKey, caseIds: ordered.map((c) => c.caseId), prompt: buildBundlePrompt(ordered) };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  fs.mkdirSync(BATCH_DIR, { recursive: true });
  const name = keysArg ? `bundles-keys-${bundles.length}` : `bundles-${category}-${num('--offset', 0)}-${bundles.length}`;
  const outFile = path.join(BATCH_DIR, `${name}.batch.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    strategy: 'editorial-bundle-v1',
    schema: BUNDLE_OUTPUT_SCHEMA,
    bundles,
  }, null, 2), 'utf-8');
  const cells = bundles.reduce((n, b) => n + b.caseIds.length, 0);
  console.log(`batch: ${bundles.length} bundles (${cells} articles) → ${path.relative(process.cwd(), outFile)}`);
  console.log(`bundleKeys: ${bundles.map((b) => b.bundleKey).join(',')}`);
}

main();
