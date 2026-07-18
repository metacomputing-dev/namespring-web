import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_ENTRY_COUNT = 9_495;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_PATH = path.join(ROOT, 'data', 'inmyeongyong_9389_full.json');
const OUTPUT_PATH = path.join(ROOT, 'data', 'inmyeongyong_9389_glyphs.generated.json');

function fail(message) {
  throw new Error(`Full Hanja glyph registry generation failed: ${message}`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readSource() {
  const sourceBytes = fs.readFileSync(SOURCE_PATH);
  let document;
  try {
    document = JSON.parse(sourceBytes.toString('utf8'));
  } catch {
    fail('source JSON is invalid');
  }

  if (document?.schemaVersion !== '1.0.0-full') {
    fail('unexpected source schemaVersion');
  }
  if (!Array.isArray(document.entries)) {
    fail('source entries must be an array');
  }
  if (document.totalCount !== document.entries.length
    || document.entries.length !== EXPECTED_ENTRY_COUNT) {
    fail(`expected ${EXPECTED_ENTRY_COUNT} source entries`);
  }

  const glyphs = [];
  const seen = new Set();
  for (const [index, entry] of document.entries.entries()) {
    const glyph = entry?.hanja;
    if (typeof glyph !== 'string' || Array.from(glyph).length !== 1) {
      fail(`entry ${index} must contain exactly one Unicode code point`);
    }
    if (seen.has(glyph)) fail(`entry ${index} duplicates a glyph`);
    seen.add(glyph);

    if (typeof entry.codepoint !== 'string' || !/^U\+[0-9A-F]{4,6}$/.test(entry.codepoint)) {
      fail(`entry ${index} has an invalid codepoint label`);
    }
    const declaredCodePoint = Number.parseInt(entry.codepoint.slice(2), 16);
    if (declaredCodePoint !== glyph.codePointAt(0)) {
      fail(`entry ${index} codepoint does not match its glyph`);
    }
    glyphs.push(glyph);
  }

  const joinedGlyphs = glyphs.join('');
  return {
    sourceBytes,
    document,
    joinedGlyphs,
  };
}

function buildOutput() {
  const { sourceBytes, document, joinedGlyphs } = readSource();
  return `${JSON.stringify({
    schemaVersion: '1.0.0-glyph-registry',
    sourceSchemaVersion: document.schemaVersion,
    sourceSha256: sha256(sourceBytes),
    glyphsSha256: sha256(joinedGlyphs),
    count: Array.from(joinedGlyphs).length,
    glyphs: joinedGlyphs,
  })}\n`;
}

const args = new Set(process.argv.slice(2));
if (args.size !== 1 || (!args.has('--write') && !args.has('--check'))) {
  console.error('Usage: node tools/build_inmyeongyong_glyph_registry.mjs --write|--check');
  process.exit(2);
}

let expected;
try {
  expected = buildOutput();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (args.has('--write')) {
  fs.writeFileSync(OUTPUT_PATH, expected, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)} (${Buffer.byteLength(expected)} bytes)`);
  process.exit(0);
}

let actual;
try {
  actual = fs.readFileSync(OUTPUT_PATH, 'utf8');
} catch {
  console.error(`Generated registry is missing: ${path.relative(ROOT, OUTPUT_PATH)}`);
  process.exit(1);
}

if (actual !== expected) {
  console.error('Generated Hanja glyph registry is stale. Run the --write command and commit the result.');
  process.exit(1);
}

console.log(`Verified ${EXPECTED_ENTRY_COUNT} full-pool glyphs and source parity.`);
