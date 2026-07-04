/**
 * run-bundles.wf.js -- Bundle generation harness (Workflow).
 *
 * One OPUS expert per BUNDLE (all cells one person sees in a category), so
 * within-report diversity is written, not assembled. Agents read the batch
 * file themselves (workflow scripts have no fs access), so args stays small:
 *
 * args = { batchFile: "lib/spring-ts/data/generation/batches/<name>.batch.json",
 *          bundles: [{ bundleKey, caseIds: [...] }],
 *          schema: <BUNDLE_OUTPUT_SCHEMA> }
 *
 * Build the batch with prepare-bundles.ts; ingest with ingest-bundles.ts.
 * The workflow return value lands in <temp>/tasks/<taskId>.output under
 * .result — extract it to results.json for ingest.
 */
export const meta = {
  name: 'generate-bundles',
  description: '번들(한 사람의 챕터)당 OPUS 전문가 1명이 완결글 세트를 저작',
  phases: [{ title: 'Generate', detail: '번들별 OPUS fan-out' }],
};

const A = typeof args === 'string' ? JSON.parse(args) : (args || {});
const batchFile = A.batchFile;
const bundles = Array.isArray(A.bundles) ? A.bundles : [];
const schema = A.schema;
// Derive the contract path from the batch file so this works from any
// checkout/worktree (agents run with the main session cwd).
const CONTRACT = String(batchFile || '').replace(/data[\\/]generation[\\/]batches[\\/][^\\/]*$/u, 'tools/generation/pairing-contract.md');

if (!batchFile || !bundles.length || !schema) {
  log('missing args.batchFile / args.bundles / args.schema');
  return { results: [] };
}

log(`generating ${bundles.length} bundles via parallel OPUS experts`);

const results = await parallel(bundles.map((b) => () =>
  agent(
    `당신은 정통 사주명리학과 성명학을 깊이 섭렵한 전문가 저술가입니다.\n`
    + `1) 파일 \`${batchFile}\` 을 읽으세요 (bundles 배열에서 bundleKey가 정확히 "${b.bundleKey}" 인 항목).\n`
    + `2) 그 항목의 prompt 필드의 지시를 그대로, 빠짐없이 따라 ${b.caseIds.length}편의 완결글을 쓰세요.\n`
    + `3) 페어링 계약 \`${CONTRACT}\` 도 반드시 지키세요 (평문↔전문가 괴리 0, nameEffect 정직성).\n`
    + `4) 반드시 caseId ${b.caseIds.length}개 전부: ${b.caseIds.join(', ')}\n`
    + `StructuredOutput 도구로 { articles: [...] } JSON만 반환하세요.`,
    { schema, model: 'opus', label: b.bundleKey, phase: 'Generate' },
  ).then((r) => ({ bundleKey: b.bundleKey, articles: (r && r.articles) || [] })).catch(() => null)
));

const ok = results.filter(Boolean);
const articleCount = ok.reduce((n, r) => n + r.articles.length, 0);
log(`generated ${ok.length}/${bundles.length} bundles (${articleCount} articles, schema-valid)`);
return { results: ok };
