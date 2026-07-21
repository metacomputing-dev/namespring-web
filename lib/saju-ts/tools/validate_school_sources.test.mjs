import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { validateSchoolSources } from './validate_school_sources.mjs';

const root = path.resolve('C:/repo/lib/saju-ts');
const validPath = path.resolve(root, 'docs/source.md');
const directoryPath = path.resolve(root, 'docs');
const fakeFs = {
  existsSync(candidate) {
    return candidate === validPath || candidate === directoryPath;
  },
  realpathSync(candidate) {
    return candidate;
  },
  statSync(candidate) {
    return { isFile: () => candidate === validPath };
  },
};

function validate(sources) {
  return validateSchoolSources({
    presets: [{ id: 'test-preset', ...(sources === Symbol.for('missing') ? {} : { sources }) }],
  }, { root, fsApi: fakeFs });
}

test('valid versioned source file passes', () => {
  assert.deepEqual(validate(['docs/source.md']), []);
});

test('missing, empty, non-string, and absent source lists all fail', () => {
  assert.equal(validate(['docs/missing.md'])[0].code, 'missing_source');
  assert.equal(validate([''])[0].code, 'invalid_source');
  assert.equal(validate([42])[0].code, 'invalid_source');
  assert.equal(validate([])[0].code, 'no_sources');
  assert.equal(validate(Symbol.for('missing'))[0].code, 'no_sources');
});

test('directories and traversal outside the package fail', () => {
  assert.equal(validate(['docs'])[0].code, 'source_not_file');
  assert.equal(validate(['../outside.md'])[0].code, 'source_outside_root');
});
