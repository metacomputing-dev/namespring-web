/**
 * run-bundles.wf.js -- Editorial bundle generation harness.
 *
 * The prompt file already contains the full editorial workflow:
 * brief -> blueprint -> draft -> editor pass -> gate preflight -> final JSON.
 *
 * This runner keeps one agent per bundle, but it no longer frames the task as
 * "fill every caseId quickly". The agent is explicitly asked to do the hidden
 * editorial passes first and to return only the final structured result.
 *
 * args = {
 *   itemsDir:  "<abs path>/items-<name>"   // from split-batch.mjs
 *   batchFile: "<abs path>.batch.json"     // fallback, one large batch
 *   bundleKeys: ["<bundleKey>", ...],
 *   schema: <BUNDLE_OUTPUT_SCHEMA>,
 *   model: undefined | 'opus' | 'sonnet'
 * }
 */
export const meta = {
  name: 'generate-bundles-editorial',
  description: 'Generate saju/name-reading bundles through hidden editorial passes.',
  phases: [{ title: 'Generate', detail: 'bundle-level editorial agents' }],
};

const A = typeof args === 'string' ? JSON.parse(args) : (args || {});
const itemsDir = A.itemsDir;
const batchFile = A.batchFile;
const bundleKeys = Array.isArray(A.bundleKeys) ? A.bundleKeys : [];
const schema = A.schema;
const modelOverride = A.model;

if ((!itemsDir && !batchFile) || !bundleKeys.length || !schema) {
  log('missing args.itemsDir|batchFile / args.bundleKeys / args.schema');
  return { results: [] };
}

function itemPathFor(key) {
  return `${itemsDir}/${key.replace(/\./g, '-')}.md`;
}

log(`generating ${bundleKeys.length} editorial bundles (model: ${modelOverride || 'inherit'})`);

const results = await parallel(bundleKeys.map((key) => () => {
  const readStep = itemsDir
    ? `Read only this prompt file: \`${itemPathFor(key)}\`.`
    : `Read \`${batchFile}\` and use only the bundle whose bundleKey is exactly \`${key}\`.`;

  return agent(
    [
      'You are the final writer-editor for a Korean saju/name-reading product.',
      readStep,
      'Follow the prompt inside that file exactly.',
      'Important: perform the hidden editorial process before writing final JSON: editorial brief, paragraph blueprint, draft, Korean editor pass, and gate preflight.',
      'Do not expose notes, checklist, markdown, or explanations.',
      'Return only structured output matching the provided schema.',
      'Every requested caseId in the prompt must be present exactly once.',
    ].join('\n'),
    { schema, label: key, phase: 'Generate', ...(modelOverride ? { model: modelOverride } : {}) },
  ).then((r) => ({ bundleKey: key, articles: (r && r.articles) || [] })).catch(() => null);
}));

const ok = results.filter(Boolean);
const articleCount = ok.reduce((n, r) => n + r.articles.length, 0);
log(`generated ${ok.length}/${bundleKeys.length} bundles (${articleCount} articles, schema-valid)`);
return { results: ok };
