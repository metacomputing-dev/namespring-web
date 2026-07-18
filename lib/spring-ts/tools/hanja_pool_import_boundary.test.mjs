import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const FULL_ASSET_NAME = 'inmyeongyong_9389_full.json';

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
