/**
 * run-fileread.wf.js -- Scalable generation harness (Workflow).
 *
 * Agents READ the batch file themselves, so args stays tiny (path + caseIds)
 * and one workflow can drive up to ~1000 classes. Each caseId → one parallel
 * OPUS expert that reads its prompt from the batch and returns a schema-valid
 * article. Build the batch with prepare-batch.ts; ingest with ingest-batch.ts.
 *
 * args = { batchFile: "lib/spring-ts/data/generation/batches/<name>.batch.json",
 *          caseIds: [...], schema: <ARTICLE_OUTPUT_SCHEMA> }
 */
export const meta = {
  name: 'generate-classes',
  description: '클래스별 병렬 OPUS 사주명리+성명학 전문가가 페어링 완결글 생성(파일 read)',
  phases: [{ title: 'Generate', detail: 'class별 OPUS fan-out' }],
};

// args may arrive as a JSON string — normalize.
const A = typeof args === 'string' ? JSON.parse(args) : (args || {});
const batchFile = A.batchFile;
const caseIds = Array.isArray(A.caseIds) ? A.caseIds : [];
const schema = A.schema;
const CONTRACT = 'lib/spring-ts/tools/generation/pairing-contract.md';

if (!batchFile || !caseIds.length) {
  log('missing args.batchFile or args.caseIds');
  return { generated: [] };
}

log(`generating ${caseIds.length} classes via parallel OPUS experts (fileread)`);

const results = await parallel(caseIds.map((id) => () =>
  agent(
    `당신은 정통 사주명리학과 성명학(음양오행·자원오행·사격·수리)을 깊이 섭렵한 전문가 저술가입니다.\n`
    + `1) 파일 \`${batchFile}\` 를 읽으세요.\n`
    + `2) items 배열에서 caseId가 정확히 "${id}" 인 항목을 찾으세요.\n`
    + `3) 그 항목의 prompt 필드에 적힌 지시를 그대로, 빠짐없이 따라 완결글을 쓰세요.\n`
    + `4) 페어링 규칙 \`${CONTRACT}\` 를 반드시 지키세요(평문↔전문가 괴리 0, nameEffect 정직성).\n`
    + `StructuredOutput 도구로 { summary, hook?, body[], expert[], livingTips[], cautions[] } JSON만 반환하세요.`,
    { schema, model: 'opus', label: id, phase: 'Generate' },
  ).then((article) => ({ caseId: id, article })).catch(() => null)
));

const generated = results.filter(Boolean);
log(`generated ${generated.length}/${caseIds.length} (schema-valid)`);
return { generated };
