/**
 * submit-batch.ts -- Send bundle prompts to the Message Batches API.
 *
 * Input: one or more bundles-*.batch.json files from prepare-bundles.ts
 * (bundleKeys are deduped across files). One batch request per bundle,
 * custom_id = bundleKey, structured output enforced via output_config.format.
 *
 * Writes data/generation/batches/apibatch-<id>.json (the manifest that
 * fetch-batch.ts consumes) and prints a cost estimate.
 *
 * Usage:
 *   npx tsx tools/generation/submit-batch.ts <batchFile...> --model=sonnet|opus --tag=w1s5
 */
import * as fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import {
  BATCH_OUTPUT_FORMAT, estimateTokens, loadRootEnv, manifestPath,
  maxTokensFor, readBundleBatchFiles, resolveModel, toCustomId, type ApiBatchManifest,
} from './batch-common.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const files = argv.filter((a) => !a.startsWith('--'));
  const modelArg = argv.find((a) => a.startsWith('--model='))?.slice('--model='.length);
  const tag = argv.find((a) => a.startsWith('--tag='))?.slice('--tag='.length);
  const thinkingOff = argv.includes('--thinking=off'); // Sonnet 5 과잉사고(예산 소진) 대응
  if (files.length === 0 || !modelArg || !tag) {
    console.error('usage: submit-batch.ts <batchFile...> --model=sonnet|opus --tag=<wave-tag>');
    process.exit(2);
  }
  const model = resolveModel(modelArg);
  if (thinkingOff && model.thinkingLocked) {
    console.error(`${model.id}: thinking is always on — --thinking=off would 400. Remove the flag.`);
    process.exit(2);
  }
  const bundles = readBundleBatchFiles(files);
  if (bundles.length === 0) { console.error('no bundles in input files'); process.exit(2); }

  // cost estimate before submitting
  let inTokens = 0; let outTokens = 0;
  for (const b of bundles) {
    inTokens += estimateTokens(b.prompt);
    outTokens += Math.round(maxTokensFor(b.caseIds.length, model.generousBudget) * 0.45); // articles+thinking, well under cap
  }
  const estCost = (inTokens / 1e6) * model.batchInputPerM + (outTokens / 1e6) * model.batchOutputPerM;
  console.log(`bundles: ${bundles.length} (articles: ${bundles.reduce((n, b) => n + b.caseIds.length, 0)})`);
  console.log(`model: ${model.id} · est input ~${Math.round(inTokens / 1000)}K · est output ~${Math.round(outTokens / 1000)}K`);
  console.log(`estimated cost @batch rates: ~$${estCost.toFixed(2)}`);

  loadRootEnv();
  if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not found (.env at repo root)'); process.exit(2); }
  const client = new Anthropic();

  const batch = await client.messages.batches.create({
    requests: bundles.map((b) => ({
      custom_id: toCustomId(b.bundleKey),
      params: {
        model: model.id,
        max_tokens: maxTokensFor(b.caseIds.length, model.generousBudget),
        ...(thinkingOff ? { thinking: { type: 'disabled' as const } } : model.thinking ? { thinking: model.thinking } : {}),
        output_config: { format: BATCH_OUTPUT_FORMAT },
        messages: [{ role: 'user' as const, content: b.prompt }],
      },
    })),
  });

  const manifest: ApiBatchManifest = {
    batchId: batch.id,
    model: model.id,
    sourceTag: tag,
    createdAt: new Date().toISOString(),
    bundles: bundles.map((b) => ({ bundleKey: b.bundleKey, caseIds: b.caseIds })),
  };
  fs.writeFileSync(manifestPath(batch.id), JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`\nbatch submitted: ${batch.id} (status: ${batch.processing_status})`);
  console.log(`manifest: ${manifestPath(batch.id)}`);
  console.log(`next: npx tsx tools/generation/fetch-batch.ts ${batch.id} --wait`);
}

main().catch((err) => { console.error(err); process.exit(1); });
