/**
 * run-batch.wf.js -- Generation harness (Workflow script).
 *
 * Fans out one batch of cases to parallel OPUS 사주명리+성명학 expert agents,
 * each forced to return a schema-valid article (StructuredOutput). Returns
 * { generated:[{caseId, article}] }. The workflow cannot read files, so the
 * batch (prompts + schema) arrives via `args` — build it with prepare-batch.ts
 * and pass its JSON as the Workflow `args` input.
 *
 * Agent cap is 1000/workflow, so keep a batch ≤ ~800 cases; the full manifest
 * (13,365) runs as ~17 batches. Ingest results with ingest-batch.ts.
 */
export const meta = {
  name: 'generate-articles-batch',
  description: '배치 케이스마다 병렬 OPUS 전문가가 페어링 완결글 생성',
  phases: [{ title: 'Generate', detail: 'case별 OPUS 전문가 fan-out' }],
};

const items = Array.isArray(args?.items) ? args.items : [];
const schema = args?.schema;

if (!items.length) {
  log('no items in args.items — nothing to generate');
  return { generated: [] };
}

log(`generating ${items.length} cases via parallel OPUS experts`);

const results = await parallel(items.map((it) => () =>
  agent(it.prompt, { schema, model: 'opus', label: it.caseId, phase: 'Generate' })
    .then((article) => ({ caseId: it.caseId, article }))
    .catch(() => null)
));

const generated = results.filter(Boolean);
log(`generated ${generated.length}/${items.length} (schema-valid)`);
return { generated };
