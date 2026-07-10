import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK_PATH = path.join(ROOT, 'src', 'schools', 'packs', 'builtin.pack.json');

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function validateSchoolSources(pack, {
  root = ROOT,
  fsApi = fs,
} = {}) {
  const violations = [];
  if (!Array.isArray(pack?.presets) || pack.presets.length === 0) {
    return [{
      code: 'no_presets',
      presetId: '<pack>',
      source: null,
      message: 'school pack must contain at least one preset',
    }];
  }

  for (const preset of pack.presets) {
    const presetId = typeof preset?.id === 'string' && preset.id.trim()
      ? preset.id
      : '<unknown>';
    if (!Array.isArray(preset?.sources) || preset.sources.length === 0) {
      violations.push({
        code: 'no_sources',
        presetId,
        source: null,
        message: 'preset must declare at least one source document',
      });
      continue;
    }
    for (const source of preset.sources) {
      if (typeof source !== 'string' || source.trim().length === 0) {
        violations.push({
          code: 'invalid_source',
          presetId,
          source,
          message: 'source must be a non-empty repository-relative path',
        });
        continue;
      }
      const resolved = path.resolve(root, source);
      if (!isInside(root, resolved)) {
        violations.push({
          code: 'source_outside_root',
          presetId,
          source,
          message: 'source path must remain inside the saju-ts package',
        });
        continue;
      }
      if (!fsApi.existsSync(resolved)) {
        violations.push({
          code: 'missing_source',
          presetId,
          source,
          message: 'source document does not exist',
        });
        continue;
      }
      let realPath;
      try {
        realPath = fsApi.realpathSync(resolved);
      } catch {
        realPath = resolved;
      }
      if (!isInside(root, realPath)) {
        violations.push({
          code: 'source_symlink_outside_root',
          presetId,
          source,
          message: 'source symlink resolves outside the saju-ts package',
        });
        continue;
      }
      let isFile = false;
      try {
        isFile = fsApi.statSync(resolved).isFile();
      } catch {
        isFile = false;
      }
      if (!isFile) {
        violations.push({
          code: 'source_not_file',
          presetId,
          source,
          message: 'source path must resolve to a regular file',
        });
      }
    }
  }
  return violations;
}

export function runCli() {
  let pack;
  try {
    pack = JSON.parse(fs.readFileSync(PACK_PATH, 'utf8'));
  } catch (error) {
    console.error(`School source validation: FAIL (pack unreadable: ${error.message})`);
    return 2;
  }
  const violations = validateSchoolSources(pack);
  if (violations.length > 0) {
    const uniqueMissing = new Set(
      violations
        .filter((row) => row.code === 'missing_source' && typeof row.source === 'string')
        .map((row) => row.source),
    ).size;
    const missingSummary = uniqueMissing > 0
      ? `; ${uniqueMissing} unique missing source files`
      : '';
    console.error(
      `School source validation: FAIL (${violations.length} violations${missingSummary})`,
    );
    for (const row of violations) {
      const source = row.source === null || row.source === undefined
        ? '<none>'
        : JSON.stringify(row.source);
      console.error(`  [${row.code}] ${row.presetId}: ${source} - ${row.message}`);
    }
    console.error(
      'Release remains blocked until every preset has versioned, in-package source files.',
    );
    return 1;
  }
  console.log(`School source validation: PASS (${pack.presets.length} presets)`);
  return 0;
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) process.exit(runCli());
