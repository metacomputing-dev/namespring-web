/**
 * fetch-batch.ts -- Collect Message-Batches results into ingest shape.
 *
 * Reads the apibatch-<id>.json manifest written by submit-batch.ts, waits for
 * the batch to end (--wait polls every 60s), then writes
 * data/generation/batches/results-<id>.json as { results: [{bundleKey,
 * articles}] } — exactly what ingest-bundles.ts consumes. Failed bundles
 * (API error, refusal, max_tokens truncation, unparsable JSON) are listed
 * with a ready-made prepare-bundles --keys re-run command.
 *
 * Usage:
 *   npx tsx tools/generation/fetch-batch.ts <batchId> [--wait]
 *   → then: npx tsx tools/generation/ingest-bundles.ts <results file> --source=regen-<tag>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { BATCH_DIR, loadRootEnv, manifestPath, toCustomId, type ApiBatchManifest } from './batch-common.js';

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

interface BundleArticles { bundleKey: string; articles: unknown[]; }

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const batchId = argv.find((a) => !a.startsWith('--'));
  const wait = argv.includes('--wait');
  if (!batchId) { console.error('usage: fetch-batch.ts <batchId> [--wait]'); process.exit(2); }
  const manifest = JSON.parse(fs.readFileSync(manifestPath(batchId), 'utf-8')) as ApiBatchManifest;

  loadRootEnv();
  const client = new Anthropic();

  let batch = await client.messages.batches.retrieve(batchId);
  while (batch.processing_status !== 'ended') {
    if (!wait) {
      console.log(`status: ${batch.processing_status} · counts: ${JSON.stringify(batch.request_counts)}`);
      console.log('not ended yet — re-run with --wait to poll');
      process.exit(3);
    }
    console.log(`[${new Date().toISOString()}] ${batch.processing_status} · ${JSON.stringify(batch.request_counts)}`);
    await sleep(60_000);
    batch = await client.messages.batches.retrieve(batchId);
  }

  const results: BundleArticles[] = [];
  const failed: Array<{ bundleKey: string; reason: string }> = [];

  const keyByCustomId = new Map(manifest.bundles.map((b) => [toCustomId(b.bundleKey), b.bundleKey]));

  for await (const entry of await client.messages.batches.results(batchId)) {
    const key = keyByCustomId.get(entry.custom_id) ?? entry.custom_id;
    if (entry.result.type !== 'succeeded') {
      const reason = entry.result.type === 'errored'
        ? `errored: ${JSON.stringify(entry.result.error).slice(0, 160)}`
        : entry.result.type;
      failed.push({ bundleKey: key, reason });
      continue;
    }
    const message = entry.result.message;
    if (message.stop_reason === 'refusal') {
      // Fable 분류기 오탐(cyber 등) — 출력 전 거부는 과금 0, 재제출로 대부분 통과
      const category = (message as { stop_details?: { category?: string | null } }).stop_details?.category ?? '?';
      failed.push({ bundleKey: key, reason: `refusal (${category}) — 재제출 권장(무과금)` });
      continue;
    }
    const text = message.content.find((b) => b.type === 'text')?.text ?? '';
    if (message.stop_reason === 'max_tokens') {
      failed.push({ bundleKey: key, reason: `max_tokens truncation (${text.length} chars)` });
      continue;
    }
    try {
      const parsed = JSON.parse(text) as { articles?: unknown[] };
      if (!Array.isArray(parsed.articles) || parsed.articles.length === 0) {
        failed.push({ bundleKey: key, reason: 'no articles in JSON' });
        continue;
      }
      results.push({ bundleKey: key, articles: parsed.articles });
    } catch {
      failed.push({ bundleKey: key, reason: `unparsable JSON (stop: ${message.stop_reason})` });
    }
  }

  // usage/cost actuals
  let inTok = 0; let outTok = 0;
  for await (const entry of await client.messages.batches.results(batchId)) {
    if (entry.result.type === 'succeeded') {
      inTok += entry.result.message.usage.input_tokens;
      outTok += entry.result.message.usage.output_tokens;
    }
  }
  console.log(`\nsucceeded bundles: ${results.length}/${manifest.bundles.length} · tokens in ${Math.round(inTok / 1000)}K / out ${Math.round(outTok / 1000)}K`);

  const outFile = path.join(BATCH_DIR, `results-${batchId}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ results }, null, 1), 'utf-8');
  console.log(`results → ${outFile}`);
  console.log(`ingest: npx tsx tools/generation/ingest-bundles.ts "${outFile}" --source=regen-${manifest.sourceTag}`);

  if (failed.length > 0) {
    console.log(`\nfailed bundles (${failed.length}):`);
    for (const f of failed) console.log(`  ✗ ${f.bundleKey}: ${f.reason}`);
    console.log(`re-run: npx tsx tools/generation/prepare-bundles.ts --keys=${failed.map((f) => f.bundleKey).join(',')}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
