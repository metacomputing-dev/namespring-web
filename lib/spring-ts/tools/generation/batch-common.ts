/**
 * batch-common.ts -- Shared plumbing for Message-Batches-API bundle
 * generation (docs/PLAN_PR1_GENERATED_TEXT_QUALITY.md §6, batch backend).
 *
 * Generation runs OUTSIDE the Claude Code session: submit-batch.ts sends the
 * bundle prompts to /v1/messages/batches (50% price), fetch-batch.ts collects
 * results into the shape ingest-bundles.ts already consumes. The quality
 * gates are unchanged — the batch schema below is deliberately RELAXED
 * (structured outputs reject minItems/maxItems), because validateGenerated
 * re-checks all counts/lengths at ingest anyway.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BATCH_DIR = path.resolve(HERE, '../../data/generation/batches');

/** Load ANTHROPIC_API_KEY (etc.) from the repo-root .env — never commit it. */
export function loadRootEnv(): void {
  const envFile = path.resolve(HERE, '../../../..', '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/gu, '').replace(/\r$/u, '');
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}

export interface ModelChoice {
  readonly id: string;
  /** Opus needs an explicit adaptive-thinking opt-in; Sonnet 5 defaults to adaptive. */
  readonly thinking?: { type: 'adaptive' };
  /** Pricing per MTok at Batch API rates (50% of standard), for estimates. */
  readonly batchInputPerM: number;
  readonly batchOutputPerM: number;
}

export function resolveModel(name: string): ModelChoice {
  switch (name) {
    case 'sonnet':
      // intro pricing $2/$10 through 2026-08-31 → batch $1/$5
      return { id: 'claude-sonnet-5', batchInputPerM: 1.0, batchOutputPerM: 5.0 };
    case 'opus':
      return { id: 'claude-opus-4-8', thinking: { type: 'adaptive' }, batchInputPerM: 2.5, batchOutputPerM: 12.5 };
    default:
      throw new Error(`unknown --model=${name} (use sonnet | opus)`);
  }
}

/** Output headroom per bundle: thinking + ~900 tokens/article, capped. */
export function maxTokensFor(caseCount: number): number {
  return Math.min(64000, 8000 + caseCount * 2500);
}

/** Structured-output format for one bundle. Counts/lengths enforced at ingest. */
export const BATCH_OUTPUT_FORMAT = {
  type: 'json_schema',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['articles'],
    properties: {
      articles: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['caseId', 'summary', 'body', 'expert', 'livingTips', 'cautions'],
          properties: {
            caseId: { type: 'string' },
            summary: { type: 'string' },
            hook: { type: 'string' },
            body: { type: 'array', items: { type: 'string' } },
            expert: { type: 'array', items: { type: 'string' } },
            livingTips: { type: 'array', items: { type: 'string' } },
            cautions: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  },
} as const;

export interface BundleBatchFile {
  readonly schema: unknown;
  readonly bundles: ReadonlyArray<{ bundleKey: string; caseIds: string[]; prompt: string }>;
}

export function readBundleBatchFiles(files: readonly string[]): BundleBatchFile['bundles'][number][] {
  const seen = new Set<string>();
  const out: BundleBatchFile['bundles'][number][] = [];
  for (const file of files) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as BundleBatchFile;
    for (const bundle of parsed.bundles) {
      if (seen.has(bundle.bundleKey)) continue; // dedupe across input files
      seen.add(bundle.bundleKey);
      out.push(bundle);
    }
  }
  return out;
}

/** Korean-heavy text ≈ 1.4 tokens/char on the current tokenizer (rough). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length * 1.4);
}

export interface ApiBatchManifest {
  batchId: string;
  model: string;
  sourceTag: string;
  createdAt: string;
  bundles: Array<{ bundleKey: string; caseIds: string[] }>;
}

export function manifestPath(batchId: string): string {
  return path.join(BATCH_DIR, `apibatch-${batchId}.json`);
}

/** custom_id allows only [a-zA-Z0-9_-]; our keys use dots (and no hyphens),
 * so dot→hyphen is injective. fetch-batch maps back via the manifest. */
export function toCustomId(bundleKey: string): string {
  return bundleKey.replace(/\./gu, '-');
}
