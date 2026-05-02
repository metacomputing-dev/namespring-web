/**
 * test/integration/narrative-schema.test.ts
 *
 * Validates that every authored fragment / glossary entry under
 * `data/narrative/**` honours the structural invariants declared by
 * `test/baseline/schema/narrativeFragment.schema.json` and
 * `test/baseline/schema/glossaryEntry.schema.json`.
 *
 * The check is hand-rolled (no external JSON Schema validator) so the
 * test runs without adding a runtime dep — mirrors the existing
 * classical-source-registry test pattern.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NARRATIVE_ROOT = path.resolve(SPRING_TS_ROOT, 'data/narrative');
const GLOSSARY_DIR = path.resolve(NARRATIVE_ROOT, '_glossary');

const VALID_CATEGORIES = new Set([
  'overall', 'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
]);
const VALID_PERIODS = new Set(['life', 'today', 'thisWeek', 'thisMonth', 'thisYear']);
const VALID_DEPTHS = new Set(['brief', 'standard', 'expert']);
const VALID_TAG_CATEGORIES = new Set([
  'element', 'tenGod', 'gyeokguk', 'shinsal', 'pillar',
  'palace', 'naeum', 'yongshin', 'gungsil', 'compatibility',
]);

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) { pass += 1; console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`); }
  else { fail += 1; console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`); }
}

function listFragmentBundles(rootDir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(rootDir)) return out;
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '_glossary' || entry.name === '_contract') continue;
        walk(p);
      } else if (entry.isFile() && entry.name.endsWith('.fragments.json')) {
        out.push(p);
      }
    }
  }
  walk(rootDir);
  return out;
}

console.log('Narrative schema validation — fragments + glossary\n');

// ── Glossary entries ──────────────────────────────────────────────────────
const glossaryFiles = fs.existsSync(GLOSSARY_DIR)
  ? fs.readdirSync(GLOSSARY_DIR).filter((f) => f.endsWith('.json'))
  : [];
check('glossary directory has entries', glossaryFiles.length > 0,
  `${glossaryFiles.length} bundles`);

const allTagIds = new Set<string>();
const glossaryEntries: Array<{ file: string; entry: any }> = [];

for (const file of glossaryFiles) {
  const full = path.join(GLOSSARY_DIR, file);
  const bundle: any = JSON.parse(fs.readFileSync(full, 'utf-8'));
  check(`${file}: schemaVersion === 'spring-ts.glossary-bundle.v1'`,
    bundle?.schemaVersion === 'spring-ts.glossary-bundle.v1');
  check(`${file}: entries is array`, Array.isArray(bundle?.entries),
    `${bundle?.entries?.length ?? 0}`);
  for (const entry of bundle?.entries ?? []) {
    glossaryEntries.push({ file, entry });
    check(`${file}#${entry?.id}: schemaVersion === 'spring-ts.glossary-entry.v1'`,
      entry?.schemaVersion === 'spring-ts.glossary-entry.v1');
    check(`${file}#${entry?.id}: id matches pattern`,
      typeof entry?.id === 'string' && /^[a-z][a-zA-Z0-9_]*$/.test(entry.id));
    check(`${file}#${entry?.id}: label non-empty`,
      typeof entry?.label === 'string' && entry.label.length > 0);
    check(`${file}#${entry?.id}: hashLabel starts with #`,
      typeof entry?.hashLabel === 'string' && entry.hashLabel.startsWith('#'));
    check(`${file}#${entry?.id}: category in whitelist`,
      VALID_TAG_CATEGORIES.has(entry?.category), entry?.category);
    check(`${file}#${entry?.id}: brief 8..200 chars`,
      typeof entry?.brief === 'string' && entry.brief.length >= 8 && entry.brief.length <= 200,
      `${entry?.brief?.length ?? 0}`);
    check(`${file}#${entry?.id}: detailed ≥ 30 chars`,
      typeof entry?.detailed === 'string' && entry.detailed.length >= 30);
    check(`${file}#${entry?.id}: aiGenerated marker`, entry?.aiGenerated === true);
    check(`${file}#${entry?.id}: sourceTier.tier === T1_HYPOTHESIS`,
      entry?.sourceTier?.tier === 'T1_HYPOTHESIS');
    check(`${file}#${entry?.id}: authorityTruthEligible === false`,
      entry?.sourceTier?.authorityTruthEligible === false);
    if (entry?.id) allTagIds.add(entry.id);
  }
}

for (const { file, entry } of glossaryEntries) {
  check(`${file}#${entry?.id}: related is array`,
    Array.isArray(entry?.related));
  for (const related of entry?.related ?? []) {
    check(`${file}#${entry?.id}: related tagId resolves: ${related}`,
      allTagIds.has(related), related);
  }
}

// ── Fragments ─────────────────────────────────────────────────────────────
const fragmentBundles = listFragmentBundles(NARRATIVE_ROOT);
check('at least one fragment bundle', fragmentBundles.length > 0,
  `${fragmentBundles.length} bundles`);

const seenFragmentIds = new Set<string>();
const cellSeen = new Set<string>();

for (const file of fragmentBundles) {
  const rel = path.relative(SPRING_TS_ROOT, file);
  const bundle: any = JSON.parse(fs.readFileSync(file, 'utf-8'));
  check(`${rel}: fragments is array`, Array.isArray(bundle?.fragments));
  for (const frag of bundle?.fragments ?? []) {
    const id = frag?.fragmentId;
    check(`${rel}#${id}: schemaVersion === 'spring-ts.narrative-fragment.v1'`,
      frag?.schemaVersion === 'spring-ts.narrative-fragment.v1');
    check(`${rel}#${id}: fragmentId is unique`, !seenFragmentIds.has(id), id);
    if (id) seenFragmentIds.add(id);

    check(`${rel}#${id}: axis.category in whitelist`,
      VALID_CATEGORIES.has(frag?.axis?.category), frag?.axis?.category);
    check(`${rel}#${id}: axis.period in whitelist`,
      VALID_PERIODS.has(frag?.axis?.period), frag?.axis?.period);
    check(`${rel}#${id}: axis.depth in whitelist`,
      VALID_DEPTHS.has(frag?.axis?.depth), frag?.axis?.depth);

    const cellKey = `${frag?.axis?.category}|${frag?.axis?.period}|${frag?.axis?.depth}`;
    cellSeen.add(cellKey);

    check(`${rel}#${id}: templateTokens is non-empty array`,
      Array.isArray(frag?.templateTokens) && frag.templateTokens.length > 0);
    for (const tok of frag?.templateTokens ?? []) {
      check(`${rel}#${id}: token kind in {text|slot|tag}`,
        tok?.kind === 'text' || tok?.kind === 'slot' || tok?.kind === 'tag');
      if (tok?.kind === 'tag') {
        check(`${rel}#${id}: tag.tagId resolves in glossary`,
          allTagIds.has(tok?.tagId), tok?.tagId);
      }
    }

    check(`${rel}#${id}: aiGenerated marker`, frag?.aiGenerated === true);
    check(`${rel}#${id}: sourceTier.tier === T1_HYPOTHESIS`,
      frag?.sourceTier?.tier === 'T1_HYPOTHESIS');
    check(`${rel}#${id}: authorityTruthEligible === false`,
      frag?.sourceTier?.authorityTruthEligible === false);
  }
}

// ── Coverage: every (category × period × depth) cell has ≥ 1 fragment ────
const expectedCells: string[] = [];
for (const cat of VALID_CATEGORIES) {
  for (const per of VALID_PERIODS) {
    for (const dep of VALID_DEPTHS) {
      expectedCells.push(`${cat}|${per}|${dep}`);
    }
  }
}
check(`coverage: all ${expectedCells.length} cells have ≥ 1 fragment`,
  expectedCells.every((k) => cellSeen.has(k)),
  `${[...cellSeen].length}/${expectedCells.length} cells covered`);

console.log(`\nNarrative schema: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
