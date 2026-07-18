import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const FULL_ASSET_NAME = 'inmyeongyong_9389_full.json';
const FULL_PAYLOAD_MARKER = '2026-04-30T23:40:33.132Z';

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return entry.isFile() && entry.name.endsWith('.ts') ? [absolute] : [];
  });
}

test('full Hanja metadata has one isolated static boundary and one literal dynamic edge', () => {
  const references = sourceFiles(SRC)
    .map((file) => ({ file, source: fs.readFileSync(file, 'utf8') }))
    .filter(({ source }) => source.includes(FULL_ASSET_NAME));

  assert.deepEqual(
    references.map(({ file }) => path.relative(ROOT, file).replaceAll('\\', '/')),
    ['src/full-hanja-pool-data.ts'],
  );

  const wrapper = references[0].source;
  assert.match(wrapper, /import inmyeongyongFullData from ['"]\.\.\/data\/inmyeongyong_9389_full\.json['"]/);

  const loader = fs.readFileSync(path.join(SRC, 'full-hanja-pool-loader.ts'), 'utf8');
  const dynamicEdges = loader.match(/import\(['"]\.\/full-hanja-pool-data\.js['"]\)/g) ?? [];
  assert.equal(dynamicEdges.length, 1);

  for (const file of sourceFiles(SRC)) {
    if (path.basename(file) === 'full-hanja-pool-loader.ts') continue;
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(
      source.includes('full-hanja-pool-data.js'),
      false,
      `${path.relative(ROOT, file)} must not bypass the lazy loader`,
    );
  }
});

test('generated synchronous membership registry stays compact', () => {
  const compactPath = path.join(ROOT, 'data', 'inmyeongyong_9389_glyphs.generated.json');
  const fullPath = path.join(ROOT, 'data', FULL_ASSET_NAME);
  const compactSize = fs.statSync(compactPath).size;
  const fullSize = fs.statSync(fullPath).size;

  assert.ok(compactSize < 40_000, `compact registry unexpectedly grew to ${compactSize} bytes`);
  assert.ok(fullSize > 1_000_000, 'test fixture no longer represents the full metadata asset');
  assert.ok(compactSize < fullSize / 20, 'compact registry must remain at least 20x smaller');
});

test('browser bundle keeps the full metadata payload behind a dynamic chunk', async () => {
  const result = await build({
    entryPoints: [path.join(SRC, 'spring-engine.ts')],
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    outdir: path.join(ROOT, '.bundle-boundary-test'),
    external: ['node:*'],
    metafile: true,
    write: false,
  });

  const fullInput = Object.keys(result.metafile.inputs)
    .find((input) => input.replaceAll('\\', '/').endsWith(`data/${FULL_ASSET_NAME}`));
  assert.ok(fullInput, 'esbuild must observe the full metadata source');

  const entryOutput = Object.entries(result.metafile.outputs)
    .find(([, output]) => output.entryPoint?.replaceAll('\\', '/').endsWith('src/spring-engine.ts'));
  assert.ok(entryOutput, 'spring-engine entry output must exist');

  const payloadOutputs = Object.entries(result.metafile.outputs)
    .filter(([, output]) => (output.inputs[fullInput]?.bytesInOutput ?? 0) > 0);
  assert.equal(payloadOutputs.length, 1, 'full metadata must occur in exactly one output');
  assert.notEqual(payloadOutputs[0][0], entryOutput[0], 'full metadata must not be in the initial entry');

  const outputByBasename = new Map(
    result.outputFiles.map((file) => [path.basename(file.path), file.text]),
  );
  const entryText = outputByBasename.get(path.basename(entryOutput[0]));
  const payloadText = outputByBasename.get(path.basename(payloadOutputs[0][0]));
  assert.ok(entryText);
  assert.ok(payloadText);
  assert.equal(entryText.includes(FULL_PAYLOAD_MARKER), false);
  assert.equal(payloadText.includes(FULL_PAYLOAD_MARKER), true);
  const payloadEdge = entryOutput[1].imports.find((edge) => edge.path === payloadOutputs[0][0]);
  assert.equal(
    payloadEdge?.kind,
    'dynamic-import',
    'entry must reach the opt-in payload output through a dynamic import edge',
  );
});
