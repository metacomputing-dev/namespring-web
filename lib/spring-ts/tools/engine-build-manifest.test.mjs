import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  ENGINE_BUILD_IDENTITY_AUTHORITY_V1,
  ENGINE_BUILD_MANIFEST_SCHEMA_V1,
  buildEngineBuildManifestV1,
  checkEngineBuildManifestV1,
  generatedIdentityPath,
  manifestPath,
  repositoryRoot,
} from './engine-build-manifest.mjs';

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hashBytes(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function digestRecords(domain, records) {
  const hash = createHash('sha256');
  hash.update(`${domain}\0`, 'utf8');
  for (const record of records) {
    hash.update(`${record.category}\0${record.path}\0${record.byteLength}\0${record.sha256}\n`, 'utf8');
  }
  return `sha256:${hash.digest('hex')}`;
}

test('engine build manifest is fresh, byte-derived, sorted, and domain separated', () => {
  const first = buildEngineBuildManifestV1();
  const second = buildEngineBuildManifestV1();
  assert.deepEqual(second, first, 'identical source bytes must produce an identical manifest');
  assert.doesNotThrow(() => checkEngineBuildManifestV1(first));
  assert.equal(first.schemaVersion, ENGINE_BUILD_MANIFEST_SCHEMA_V1);
  assert.equal(first.authority, ENGINE_BUILD_IDENTITY_AUTHORITY_V1);
  assert.match(first.completeness, /not-execution-reproducibility$/u);
  assert.equal('generatedAt' in first, false, 'wall-clock time must not enter immutable identity');

  const paths = first.files.map((file) => file.path);
  assert.deepEqual(paths, [...paths].sort(compareText));
  assert.equal(new Set(paths).size, paths.length);
  assert.equal(first.summary.fileCount, first.files.length);
  assert.equal(
    first.summary.byteLength,
    first.files.reduce((sum, file) => sum + file.byteLength, 0),
  );
  for (const file of first.files) {
    const bytes = readFileSync(resolve(repositoryRoot, file.path));
    assert.equal(file.byteLength, bytes.byteLength, file.path);
    assert.equal(file.sha256, hashBytes(bytes), file.path);
  }
  assert.equal(
    first.digests.aggregate,
    digestRecords('namespring.engine-build-inputs.v1', first.files),
  );
  assert.equal(
    first.digests.ruleset,
    digestRecords(
      'namespring.engine-ruleset-code-and-rules.v1',
      first.files.filter((file) => file.category === 'code' || file.category === 'rules'),
    ),
  );
  assert.equal(
    first.digests.data,
    digestRecords(
      'namespring.engine-data-inputs.v1',
      first.files.filter((file) => file.category === 'data'),
    ),
  );
});

test('manifest covers delivery loaders and paid assets without claiming legacy packs', () => {
  const manifest = buildEngineBuildManifestV1();
  const paths = new Set(manifest.files.map((file) => file.path));
  for (const required of [
    'lib/spring-ts/src/spring-engine.ts',
    'lib/spring-ts/src/report/delivery/build-report-delivery.ts',
    'lib/spring-ts/src/report/tiered/article-registry.ts',
    'lib/spring-ts/src/report/tiered/glossary-loader.ts',
    'lib/spring-ts/tsconfig.json',
    'lib/saju-ts/src/index.ts',
    'lib/saju-ts/tsconfig.build.json',
    'lib/seed-ts/src/database/hanja-repository.ts',
    'lib/seed-ts/tsconfig.build.json',
    'lib/spring-ts/data/name-stat/name-stat-summary.v1.bin',
    'lib/seed-ts/assets/sql-wasm-1.14.1.wasm',
    'namespring/public/data/hanja.db',
    'namespring/public/data/fourframe.db',
  ]) {
    assert.ok(paths.has(required), `${required} must be inside the declared identity`);
  }
  assert.ok(
    [...paths].some((path) => path.startsWith('lib/spring-ts/data/articles/')),
    'lazy article shards must be represented',
  );
  assert.ok(
    [...paths].some((path) => path.startsWith('lib/spring-ts/data/narrative/_glossary/')),
    'lazy glossary shards must be represented',
  );
  assert.equal(
    [...paths].some((path) => path.startsWith('lib/spring-ts/data/generated/')),
    false,
    'legacy generated packs remain outside ReportDeliveryV1 identity and bundle',
  );
  assert.equal([...paths].some((path) => path.includes('/dist/')), false);
  assert.equal([...paths].some((path) => /\.(?:test|spec)\.ts$/u.test(path)), false);
});

test('mobile runtime identity stays compact and never imports the full manifest', () => {
  const compactBytes = statSync(generatedIdentityPath).size;
  const manifestBytes = statSync(manifestPath).size;
  assert.ok(compactBytes <= 1024, `compact identity grew to ${compactBytes} bytes`);
  assert.ok(manifestBytes <= 128 * 1024, `build-only manifest grew to ${manifestBytes} bytes`);
  const compactSource = readFileSync(generatedIdentityPath, 'utf8');
  assert.doesNotMatch(compactSource, /node:|files\s*:/u);
  assert.match(compactSource, /build-time-artifact-identity-only/u);

  const runtimeSources = [
    'lib/spring-ts/src/report/delivery/build-report-delivery.ts',
    'lib/spring-ts/src/report/delivery/validation.ts',
    'lib/spring-ts/src/report/delivery/index.ts',
  ].map((path) => readFileSync(resolve(repositoryRoot, path), 'utf8')).join('\n');
  assert.doesNotMatch(runtimeSources, /engine-build-input-manifest\.v1\.json/u);
  assert.doesNotMatch(runtimeSources, /node:(?:crypto|fs|path)/u);
  assert.match(runtimeSources, /engine-build-identity\.generated/u);
});
