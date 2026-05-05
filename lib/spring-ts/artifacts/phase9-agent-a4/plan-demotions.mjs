/*
 * For each violating fragment, plan which closer-area tag tokens to demote
 * (kind:tag → kind:text) so the rendered tag count drops to ≤ 6.
 *
 * Strategy:
 *   1. Walk templateTokens, partition into source paragraphs at \n\n.
 *   2. Tag tokens in paragraph indices < firstP7A4Idx are body-owned (out of scope).
 *      P7-A4 always added closer paragraphs at the END, so closer area = paragraphs
 *      with index >= preP7A4ParagraphCount.
 *   3. Among closer-area tag tokens, prefer demoting those that duplicate a body
 *      tag (semantically free). If still over budget, demote remaining closer
 *      tags from earlier closer paragraphs (preserving the FINAL closer rotation
 *      pattern for diversity).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function splitSourceParagraphs(tokens) {
  const buckets = [];
  let current = [];
  for (const tok of tokens) {
    if (tok.kind === 'text') {
      const segments = (tok.value ?? '').split('\n\n');
      for (let i = 0; i < segments.length; i += 1) {
        if (segments[i]) current.push({ kind: 'text', value: segments[i], _origIdx: -1 });
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

function countTagsPerParagraph(tokens) {
  const buckets = splitSourceParagraphs(tokens);
  return buckets.map((b) => b.filter((t) => t.kind === 'tag').length);
}

const closerInfo = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'p7a4-closer-tags.json'), 'utf-8'),
);

const plans = [];

for (const rec of closerInfo.records) {
  if (!rec.preP7A4Tags) continue;
  const file = rec.sourceFile;
  if (!fs.existsSync(file)) continue;
  const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const frag = json.fragments.find((f) => f.fragmentId === rec.fragmentId);
  if (!frag) continue;

  const buckets = splitSourceParagraphs(frag.templateTokens);
  const tagCountsPerPara = buckets.map((b) => b.filter((t) => t.kind === 'tag').length);

  // Use CURRENT in-tree tag count (rec.headTags is a snapshot — may be stale
  // after other commits in this batch). Skip if already ≤ 6.
  const currentTagCount = tagCountsPerPara.reduce((a, b) => a + b, 0);
  if (currentTagCount <= 6) continue;

  // Pre-P7-A4 used to be ONE paragraph. P7-A4 split that paragraph into 1-3
  // sub-paragraphs (preserving original tag positions) and APPENDED 1-3 closer
  // paragraphs. We can identify the closer area as the LAST K paragraphs whose
  // accumulated tag count = (current tags - pre tags) when summed from the end.
  const preTagCount = rec.preP7A4Tags.length;
  const headTagCount = currentTagCount;
  const closerTagBudget = headTagCount - preTagCount;
  // Sum tags from end until accumulated >= closerTagBudget.
  let acc = 0;
  let closerStartIdx = buckets.length;
  for (let i = buckets.length - 1; i >= 0; i -= 1) {
    acc += tagCountsPerPara[i];
    closerStartIdx = i;
    if (acc >= closerTagBudget) break;
  }
  // closerStartIdx may consume body tag if K closer paragraphs have 0 tags. Push back.
  // Actually simpler: closer paragraphs are last few with non-trivial tag content.
  // Safer: closer paragraph indices = those that were NEW relative to pre.
  // We don't know pre paragraph structure exactly, but we know:
  //   total head paragraphs >= 4 (per P7-A4 contract)
  //   pre had typically 1-2 paragraphs.
  // Use a heuristic: take last (head_paragraphs - 1) paragraphs if pre had only
  // 1 in source (most common). But to be safe, just take all paragraphs
  // contributing to the +closerTagBudget at the end.

  // Body tags = pre P7-A4 tags
  const bodyTagSet = new Set(rec.preP7A4Tags);
  // For each closer-area tag token, mark whether it duplicates a body tag.
  const closerTagPositions = []; // [{paraIdx, tokenIdxInPara, tagId, isDupOfBody}]
  for (let pIdx = closerStartIdx; pIdx < buckets.length; pIdx += 1) {
    const para = buckets[pIdx];
    for (let tIdx = 0; tIdx < para.length; tIdx += 1) {
      const tok = para[tIdx];
      if (tok.kind === 'tag') {
        closerTagPositions.push({
          paraIdx: pIdx,
          tagId: tok.tagId,
          isDupOfBody: bodyTagSet.has(tok.tagId),
          isFinalCloser: pIdx === buckets.length - 1,
        });
      }
    }
  }

  // Determine how many to demote
  const targetTagCount = 6;
  const demoteCount = headTagCount - targetTagCount;

  // Candidate ordering (most preferred first):
  //  1. Closer-area tags that duplicate a body tag (free reduction)
  //  2. Closer-area tags in non-final closer paragraphs (preserve final-closer rotation)
  //  3. Closer-area tags in the final closer paragraph (last resort — breaks rotation)
  // Also: avoid demoting BOTH tags of the final closer (would nuke the rotation pattern).

  const candidates = [...closerTagPositions];
  candidates.sort((a, b) => {
    if (a.isDupOfBody !== b.isDupOfBody) return a.isDupOfBody ? -1 : 1;
    if (a.isFinalCloser !== b.isFinalCloser) return a.isFinalCloser ? 1 : -1;
    // Earlier paragraph indices first within same priority bucket
    return a.paraIdx - b.paraIdx;
  });

  // Pick demoteCount candidates, but never both tags of the final closer if it has 2.
  const finalCloserPara = buckets.length - 1;
  const finalCloserTags = closerTagPositions.filter((c) => c.paraIdx === finalCloserPara);
  const picked = [];
  let finalCloserDemoted = 0;
  for (const c of candidates) {
    if (picked.length >= demoteCount) break;
    if (c.paraIdx === finalCloserPara) {
      const finalCloserCount = finalCloserTags.length;
      // Don't demote more than (count-1) of the final closer's tags, and prefer
      // not to demote ANY if other candidates available.
      if (finalCloserDemoted >= finalCloserCount - 1) continue;
    }
    picked.push(c);
    if (c.paraIdx === finalCloserPara) finalCloserDemoted += 1;
  }

  plans.push({
    fragmentId: rec.fragmentId,
    sourceFile: rec.sourceFile,
    headTagCount,
    preTagCount,
    closerStartIdx,
    bucketCount: buckets.length,
    tagCountsPerPara,
    demoteCount,
    finalCloserTagCount: finalCloserTags.length,
    demotedPositions: picked,
    closerTagPositions,
  });
}

fs.writeFileSync(
  path.resolve(__dirname, 'demotion-plans.json'),
  `${JSON.stringify({ planCount: plans.length, plans }, null, 2)}\n`,
  'utf-8',
);

console.log(`Plans for ${plans.length} fragments:`);
for (const p of plans) {
  const summary = p.demotedPositions
    .map((d) => `${d.tagId}@p${d.paraIdx}${d.isDupOfBody ? '(dup)' : ''}${d.isFinalCloser ? '(final)' : ''}`)
    .join(', ');
  console.log(`  ${p.fragmentId} (${p.headTagCount} → ${p.headTagCount - p.demoteCount}): demote [${summary}]`);
}
