/**
 * run-bundles.wf.js -- Bundle generation harness (Workflow, SESSION-AGENT path).
 *
 * One expert agent per BUNDLE (all cells one person sees in a category), so
 * within-report diversity is written, not assembled. Used when API credits
 * are exhausted — generation rides the Claude Code session quota instead.
 *
 * args = {
 *   itemsDir:  "<abs path>/items-<name>"   // from split-batch.mjs (권장 —
 *              에이전트가 자기 번들 파일만 read; 대형 batch 파일 truncation 회피)
 *   batchFile: "<abs path>.batch.json"     // (레거시 소형 배치용 대안)
 *   bundleKeys: ["<bundleKey>", ...],
 *   schema: <BUNDLE_OUTPUT_SCHEMA>,        // prepare-bundles 산출물의 .schema
 *   model: undefined | 'opus' | 'sonnet'   // 미지정=세션 모델 상속(Fable 5).
 *                                          // Fable 한도 소진 시 'opus'로 폴백.
 * }
 *
 * Build inputs with prepare-bundles.ts (+ split-batch.mjs); ingest with
 * ingest-bundles.ts. The workflow return value lands in
 * <session-temp>/tasks/<taskId>.output under .result — extract with
 * extract-workflow-result.mjs into results.json for ingest.
 */
export const meta = {
  name: 'generate-bundles',
  description: '번들(한 사람의 챕터)당 전문가 에이전트 1명이 완결글 세트를 저작',
  phases: [{ title: 'Generate', detail: '번들별 전문가 fan-out' }],
};

const A = typeof args === 'string' ? JSON.parse(args) : (args || {});
const itemsDir = A.itemsDir;
const batchFile = A.batchFile;
const bundleKeys = Array.isArray(A.bundleKeys) ? A.bundleKeys : [];
const schema = A.schema;
const modelOverride = A.model; // undefined → inherit session model (Fable 5)

const srcPath = itemsDir || batchFile || '';
const CONTRACT = String(srcPath).replace(/data[\\/]generation[\\/]batches[\\/][^\\/]*$/u, 'tools/generation/pairing-contract.md');

if ((!itemsDir && !batchFile) || !bundleKeys.length || !schema) {
  log('missing args.itemsDir|batchFile / args.bundleKeys / args.schema');
  return { results: [] };
}

log(`generating ${bundleKeys.length} bundles via parallel experts (model: ${modelOverride || 'inherit'})`);

const results = await parallel(bundleKeys.map((key) => () => {
  const readStep = itemsDir
    ? `1) 파일 \`${itemsDir}/${key.replace(/\./g, '-')}.md\` 를 읽으세요 — 그 안의 지시가 곧 과제입니다.`
    : `1) 파일 \`${batchFile}\` 을 읽으세요 (bundles 배열에서 bundleKey가 정확히 "${key}" 인 항목의 prompt).`;
  return agent(
    `당신은 정통 사주명리학과 성명학을 깊이 섭렵한 전문가 저술가입니다.\n`
    + readStep + `\n`
    + `2) 지시를 그대로, 빠짐없이 따라 명시된 caseId **전부**에 대해 한 편씩 완결글을 쓰세요.\n`
    + `3) 페어링 계약 \`${CONTRACT}\` 도 반드시 지키세요 (평문↔전문가 괴리 0, nameEffect 정직성).\n`
    + `StructuredOutput 도구로 { articles: [...] } JSON만 반환하세요 (요청된 caseId 전부 포함).`,
    { schema, label: key, phase: 'Generate', ...(modelOverride ? { model: modelOverride } : {}) },
  ).then((r) => ({ bundleKey: key, articles: (r && r.articles) || [] })).catch(() => null);
}));

const ok = results.filter(Boolean);
const articleCount = ok.reduce((n, r) => n + r.articles.length, 0);
log(`generated ${ok.length}/${bundleKeys.length} bundles (${articleCount} articles, schema-valid)`);
return { results: ok };
