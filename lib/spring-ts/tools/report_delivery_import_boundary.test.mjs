import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

function walkTypeScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkTypeScriptFiles(resolved);
    return entry.isFile() && entry.name.endsWith('.ts') ? [resolved] : [];
  });
}

function normalizeMetaPath(value) {
  return value.replaceAll('\\', '/');
}

function resolveStaticOutputEdge(outputs, fromOutput, edgePath) {
  const normalizedEdge = normalizeMetaPath(edgePath);
  if (Object.hasOwn(outputs, normalizedEdge)) return normalizedEdge;
  const relative = path.posix.normalize(path.posix.join(
    path.posix.dirname(normalizeMetaPath(fromOutput)),
    normalizedEdge,
  ));
  if (Object.hasOwn(outputs, relative)) return relative;
  const basenameMatches = Object.keys(outputs).filter(
    (candidate) => path.posix.basename(normalizeMetaPath(candidate))
      === path.posix.basename(normalizedEdge),
  );
  assert.equal(
    basenameMatches.length,
    1,
    `static output edge must resolve exactly once: ${fromOutput} -> ${edgePath}`,
  );
  return basenameMatches[0];
}

function collectInitialStaticOutputs(metafile, entryOutput) {
  const visited = new Set();
  const visit = (outputPath) => {
    if (visited.has(outputPath)) return;
    visited.add(outputPath);
    const output = metafile.outputs[outputPath];
    assert.ok(output, `metafile output must exist: ${outputPath}`);
    for (const edge of output.imports) {
      // LCP transfers only entry + transitive static imports. Literal dynamic
      // imports are intentionally excluded because they load after user intent.
      if (edge.external || edge.kind === 'dynamic-import') continue;
      visit(resolveStaticOutputEdge(metafile.outputs, outputPath, edge.path));
    }
  };
  visit(entryOutput);
  return visited;
}

test('local-first contract modules do not acquire server or network dependencies', () => {
  const files = [
    path.join(SRC, 'candidate-selection.ts'),
    path.join(SRC, 'public-request-snapshot.ts'),
    ...walkTypeScriptFiles(path.join(SRC, 'experience')),
    ...walkTypeScriptFiles(path.join(SRC, 'report', 'delivery')),
    ...walkTypeScriptFiles(path.join(SRC, 'report', 'premium')),
  ];
  const networkCall = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/u;
  const networkModule = /(?:from\s*|import\s*\()\s*['"](?:node:)?(?:http|https|net|tls|dns|dgram|child_process)(?:['"/])/u;
  const serverRoute = /(?:from\s*|import\s*\()\s*['"][^'"]*(?:\/api\/|namespring\/api)/u;
  const absoluteNetworkUrl = /['"](?:https?|wss?):\/\//u;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const label = path.relative(ROOT, file).replaceAll('\\', '/');
    assert.doesNotMatch(source, networkCall, `${label} must not perform network I/O`);
    assert.doesNotMatch(source, networkModule, `${label} must not import network modules`);
    assert.doesNotMatch(source, serverRoute, `${label} must not import a server route`);
    assert.doesNotMatch(source, absoluteNetworkUrl, `${label} must not embed a remote URL`);
  }
});

test('report delivery and timeline registry retain literal dynamic edges', () => {
  const engine = fs.readFileSync(path.join(SRC, 'spring-engine.ts'), 'utf8');
  const delivery = fs.readFileSync(
    path.join(SRC, 'report', 'delivery', 'build-report-delivery.ts'),
    'utf8',
  );
  const legacyReport = fs.readFileSync(
    path.join(SRC, 'report', 'buildFortuneReport.ts'),
    'utf8',
  );
  const tiered = fs.readFileSync(
    path.join(SRC, 'report', 'tiered', 'build-tiered-matrix.ts'),
    'utf8',
  );
  const articles = fs.readFileSync(
    path.join(SRC, 'report', 'tiered', 'article-registry.ts'),
    'utf8',
  );
  const glossary = fs.readFileSync(
    path.join(SRC, 'report', 'tiered', 'glossary-loader.ts'),
    'utf8',
  );
  assert.equal(
    (engine.match(/import\(['"]\.\/report\/delivery\/build-report-delivery\.js['"]\)/gu) ?? []).length,
    1,
  );
  assert.equal(
    (delivery.match(/import\(['"]\.\.\/tiered\/build-tiered-matrix\.js['"]\)/gu) ?? []).length,
    1,
  );
  assert.doesNotMatch(engine, /from ['"]\.\/report\/delivery\/build-report-delivery\.js['"]/u);
  assert.match(engine, /CANDIDATE_EVALUATION_YIELD_INTERVAL = 16/u);
  assert.match(engine, /evaluatedCandidateCount % CANDIDATE_EVALUATION_YIELD_INTERVAL/u,
    'large candidate evaluation loops must yield periodically on mobile');
  assert.match(engine, /CANDIDATE_NAME_STAT_YIELD_INTERVAL = 128/u);
  assert.match(engine, /inspectedCandidateCount % CANDIDATE_NAME_STAT_YIELD_INTERVAL/u,
    'cached name-stat filtering must also yield periodically on mobile');
  assert.match(engine, /CANDIDATE_SEARCH_SNAPSHOT_CACHE_LIMIT = 4/u);
  assert.match(engine, /CANDIDATE_SEARCH_SNAPSHOT_MAX_CANDIDATES = 500/u);
  assert.match(engine, /this\.candidateSearchSnapshots\.clear\(\)/u,
    'engine close must release every retained candidate snapshot');
  assert.doesNotMatch(
    delivery,
    /^import (?!type\b).*from ['"]\.\.\/tiered\/build-tiered-matrix\.js['"]/mu,
  );
  assert.doesNotMatch(delivery, /preloadGeneratedForReport|preloadGeneratedForPerson|fetch\s*\(/u,
    'new local-first delivery must never request generated packs');
  assert.match(legacyReport, /preloadGeneratedForReport/u,
    'legacy report keeps its existing opt-in generated-pack compatibility path');
  assert.match(delivery, /await buildTieredMatrixSelection/u);
  assert.match(tiered, /loadArticleRegistrySelection\(options\.periods, options\.categoriesByPeriod\)/u);
  assert.match(tiered, /loadGlossarySelection\(articleTagIds\)/u);
  assert.match(tiered, /import\(['"]\.\/insight-registry\.js['"]\)/u,
    'legacy-only life insight payload must stay behind its own dynamic edge');
  assert.doesNotMatch(tiered, /^import (?!type\b).*from ['"]\.\/insight-registry\.js['"]/mu);
  assert.doesNotMatch(articles, /eager\s*:\s*true/u,
    'article JSON must remain behind lazy browser loader functions');
  assert.doesNotMatch(glossary, /eager\s*:\s*true/u,
    'glossary JSON must remain behind lazy browser loader functions');
  assert.match(articles, /import\.meta\.glob\('\.\.\/\.\.\/\.\.\/data\/articles\/\*\*\/\*\.articles\.json'\)/u);
  assert.match(glossary, /import\.meta\.glob\('\.\.\/\.\.\/\.\.\/data\/narrative\/_glossary\/\*\.json'\)/u);
});

test('local-device entry keeps the home LCP graph engine and database free', async () => {
  const result = await build({
    entryPoints: [path.join(SRC, 'experience', 'local-device-entry.ts')],
    bundle: true,
    splitting: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    outdir: path.join(ROOT, '.local-device-entry-boundary-test'),
    external: ['node:*'],
    metafile: true,
    write: false,
  });
  const entryOutput = Object.entries(result.metafile.outputs).find(([, output]) =>
    normalizeMetaPath(output.entryPoint ?? '')
      .endsWith('src/experience/local-device-entry.ts'))?.[0];
  assert.ok(entryOutput, 'local-device browser entry must exist');
  const initialOutputs = collectInitialStaticOutputs(result.metafile, entryOutput);
  const initialInputs = new Set([...initialOutputs].flatMap(
    (output) => Object.keys(result.metafile.outputs[output].inputs),
  ));
  const forbiddenInputs = [...initialInputs].filter((input) => {
    const normalized = normalizeMetaPath(input).toLowerCase();
    return normalized.includes('/spring-engine.')
      || normalized.includes('sql.js')
      || normalized.includes('sql-wasm')
      || normalized.includes('repository')
      || normalized.includes('hanja')
      || normalized.includes('fourframe')
      || normalized.includes('name-stat')
      || normalized.includes('/saju/');
  });
  assert.deepEqual(
    forbiddenInputs,
    [],
    `home LCP entry acquired engine/database/saju inputs: ${forbiddenInputs.join(', ')}`,
  );
  assert.ok(
    [...initialInputs].some((input) =>
      normalizeMetaPath(input).endsWith('src/experience/local-birth-preview.ts')),
    'entry must retain the real birth-preview implementation',
  );

  const outputFileByPath = new Map(result.outputFiles.map((file) => [
    normalizeMetaPath(file.path),
    file,
  ]));
  const initialFiles = [...initialOutputs].map((output) => {
    const absolute = normalizeMetaPath(path.resolve(ROOT, output));
    const file = outputFileByPath.get(absolute);
    assert.ok(file, `emitted static output must be measurable: ${output}`);
    return file;
  });
  const rawBytes = initialFiles.reduce((sum, file) => sum + file.contents.byteLength, 0);
  const gzipBytes = initialFiles.reduce(
    (sum, file) => sum + gzipSync(file.contents).byteLength,
    0,
  );
  assert.ok(rawBytes <= 48 * 1024,
    `local-device initial static graph exceeded 48 KiB raw (${rawBytes} bytes)`);
  assert.ok(gzipBytes <= 16 * 1024,
    `local-device initial static graph exceeded 16 KiB gzip (${gzipBytes} bytes)`);

  const facade = fs.readFileSync(path.join(SRC, 'experience', 'local-menu.ts'), 'utf8');
  assert.match(facade, /import\(['"]\.\/local-home\.js['"]\)/u);
  assert.match(facade, /import\(['"]\.\/local-hanja\.js['"]\)/u);
  assert.doesNotMatch(facade, /^import (?!type\b).*spring-engine/mu);
  assert.doesNotMatch(facade, /^import (?!type\b).*hanja-repository/mu);
});

test('public browser entry excludes delivery and article-registry payloads', async () => {
  const result = await build({
    // Guard the package surface consumers actually import. Testing only the
    // internal SpringEngine module can miss a later eager re-export (for
    // example from local-menu or report/index) that collapses a dynamic edge.
    entryPoints: [path.join(SRC, 'index.ts')],
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    outdir: path.join(ROOT, '.report-delivery-boundary-test'),
    external: ['node:*'],
    metafile: true,
    write: false,
  });
  const entries = Object.entries(result.metafile.outputs);
  const publicOutput = entries.find(([, output]) =>
    output.entryPoint?.replaceAll('\\', '/').endsWith('src/index.ts'));
  assert.ok(publicOutput, 'public browser entry must exist');

  const deliveryInput = Object.keys(result.metafile.inputs).find((input) =>
    input.replaceAll('\\', '/').endsWith('src/report/delivery/build-report-delivery.ts'));
  const tieredInput = Object.keys(result.metafile.inputs).find((input) =>
    input.replaceAll('\\', '/').endsWith('src/report/tiered/build-tiered-matrix.ts'));
  const generatedInput = Object.keys(result.metafile.inputs).find((input) =>
    input.replaceAll('\\', '/').endsWith('src/report/tiered/generated-registry.ts'));
  const insightInput = Object.keys(result.metafile.inputs).find((input) =>
    input.replaceAll('\\', '/').endsWith('src/report/tiered/insight-registry.ts'));
  assert.ok(deliveryInput);
  assert.ok(tieredInput);
  assert.ok(generatedInput);
  assert.ok(insightInput);
  assert.equal(publicOutput[1].inputs[deliveryInput]?.bytesInOutput ?? 0, 0,
    'delivery builder must not be in the initial public chunk');
  assert.equal(publicOutput[1].inputs[tieredInput]?.bytesInOutput ?? 0, 0,
    'timeline builder must not be in the initial public chunk');

  const deliveryOutput = entries.find(([, output]) =>
    (output.inputs[deliveryInput]?.bytesInOutput ?? 0) > 0);
  assert.ok(deliveryOutput);
  assert.equal(deliveryOutput[1].inputs[tieredInput]?.bytesInOutput ?? 0, 0,
    'naming-only delivery chunk must not embed timeline/article code');
  assert.ok(deliveryOutput[1].imports.some((edge) => edge.kind === 'dynamic-import'),
    'delivery chunk must reach timeline support through a dynamic import');

  assert.ok(publicOutput[1].bytes <= 5.5 * 1024 * 1024,
    `initial public chunk exceeded 5.5 MiB (${publicOutput[1].bytes} bytes)`);
  const timelineCodeOutput = entries.find(([, output]) =>
    (output.inputs[tieredInput]?.bytesInOutput ?? 0) > 0);
  assert.ok(timelineCodeOutput, 'timeline implementation chunk must exist');
  for (const [label, input] of [
    ['generated content registry', generatedInput],
    ['life insight registry', insightInput],
  ]) {
    assert.equal(publicOutput[1].inputs[input]?.bytesInOutput ?? 0, 0,
      `${label} must not be in the initial public chunk`);
    assert.equal(deliveryOutput[1].inputs[input]?.bytesInOutput ?? 0, 0,
      `${label} must not be in the delivery chunk`);
    assert.equal(timelineCodeOutput[1].inputs[input]?.bytesInOutput ?? 0, 0,
      `${label} must stay behind a legacy-only dynamic edge`);
  }
  assert.ok(timelineCodeOutput[1].bytes <= 128 * 1024,
    `timeline code chunk exceeded 128 KiB before lazy JSON shards (${timelineCodeOutput[1].bytes} bytes)`);
});
