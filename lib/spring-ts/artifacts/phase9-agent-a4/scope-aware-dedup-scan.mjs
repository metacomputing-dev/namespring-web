/*
 * Scope-aware dedup scan: for each violating fragment with intra-paragraph
 * duplicate tags, identify whether the SECOND occurrence is in the P7-A4
 * closer area (the last 1-3 paragraphs separated by `\n\n` in the source
 * template). Owned scope edits only that closer area, so dups whose 2nd
 * occurrence lives in the body are NOT free reductions for us.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NARRATIVE_DIR = path.resolve(__dirname, '../../data/narrative');

// Walk a fragment's templateTokens and split into source-level paragraph buckets
// at every `\n\n` inside text token values.
function splitSourceParagraphs(tokens) {
  const buckets = [];
  let current = [];
  for (const tok of tokens) {
    if (tok.kind === 'text') {
      const segments = (tok.value ?? '').split('\n\n');
      for (let i = 0; i < segments.length; i += 1) {
        if (segments[i]) current.push({ kind: 'text', value: segments[i] });
        if (i < segments.length - 1) {
          if (current.length > 0) buckets.push(current);
          current = [];
        }
      }
    } else {
      current.push(tok);
    }
  }
  if (current.length > 0) buckets.push(current);
  return buckets;
}

// Load the violation map produced earlier and process each fragment.
const violations = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'fragment-violation-map.json'), 'utf-8'),
);

const inScope = [];
const outOfScope = [];

for (const rec of violations.records) {
  const file = rec.sourceFile;
  if (!fs.existsSync(file)) continue;
  const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const frag = json.fragments.find((f) => f.fragmentId === rec.fragmentId);
  if (!frag) continue;
  const buckets = splitSourceParagraphs(frag.templateTokens);
  // P7-A4 commits added closer paragraphs at the END. Number of buckets - typical body
  // count. We approximate "body" as the FIRST bucket and "closer area" as the rest if
  // there are 2+ buckets, since pre-P7-A4 fragments were single-paragraph (1 bucket).
  // P7-A4 split body into 2-3 paragraphs and appended 1 closer. So: if bucketCount >= 2,
  // body = bucket[0], closers = buckets[1..]. (Some fragments split further; closer is
  // always the LAST bucket.)
  if (buckets.length < 2) continue;
  const closer = buckets[buckets.length - 1];
  const closerTagIds = new Set(closer.filter((t) => t?.kind === 'tag').map((t) => t.tagId));
  const bodyBuckets = buckets.slice(0, -1);
  const bodyTagIds = new Set();
  for (const b of bodyBuckets) {
    for (const t of b) if (t?.kind === 'tag') bodyTagIds.add(t.tagId);
  }
  // Find shared tags between body and closer.
  const sharedClosersDups = [...closerTagIds].filter((id) => bodyTagIds.has(id));

  // For 9-tag cases the "closer area" includes multiple closer paragraphs (P7-A4 added 3 in
  // some coverage fragments). Treat any non-first bucket as part of closer area.
  const closerAreaBuckets = buckets.slice(1);
  const closerAreaTagIds = [];
  for (const b of closerAreaBuckets) {
    for (const t of b) if (t?.kind === 'tag') closerAreaTagIds.push(t.tagId);
  }
  const closerAreaDups = closerAreaTagIds.filter((id) => bodyTagIds.has(id));
  // dedup occurrences within the closer area itself (e.g. expression_children 301
  // has sikshin in body AND in first closer paragraph)
  const dupsByTag = {};
  for (const id of closerAreaDups) dupsByTag[id] = (dupsByTag[id] ?? 0) + 1;

  if (closerAreaDups.length > 0) {
    inScope.push({
      fragmentId: rec.fragmentId,
      tagCount: rec.tagCount,
      sourceFile: file,
      bucketCount: buckets.length,
      bodyTagCount: bodyTagIds.size,
      closerAreaTagCount: closerAreaTagIds.length,
      dupsByTag,
      closerAreaTags: closerAreaTagIds,
    });
  } else {
    outOfScope.push({
      fragmentId: rec.fragmentId,
      tagCount: rec.tagCount,
      sourceFile: file,
      bucketCount: buckets.length,
      bodyTagCount: bodyTagIds.size,
      closerAreaTagCount: closerAreaTagIds.length,
      bodyTags: [...bodyTagIds],
      closerAreaTags: closerAreaTagIds,
    });
  }
}

console.log(`In-scope dup fragments (closer area duplicates body tag): ${inScope.length}`);
for (const r of inScope) {
  console.log(` - ${r.fragmentId} tags=${r.tagCount} body=${r.bodyTagCount} closerArea=${r.closerAreaTagCount} dups=${JSON.stringify(r.dupsByTag)}`);
}
console.log(`\nOut-of-scope (no closer-body dups, must demote unique closer tag): ${outOfScope.length}`);
for (const r of outOfScope) {
  console.log(` - ${r.fragmentId} tags=${r.tagCount} body=${r.bodyTagCount} closerArea=${r.closerAreaTagCount} closer=${r.closerAreaTags.join('+')}`);
}

const outPath = path.resolve(__dirname, 'scope-aware-dedup.json');
fs.writeFileSync(
  outPath,
  `${JSON.stringify({ inScopeCount: inScope.length, outOfScopeCount: outOfScope.length, inScope, outOfScope }, null, 2)}\n`,
  'utf-8',
);
console.log(`\nWrote ${outPath}`);
