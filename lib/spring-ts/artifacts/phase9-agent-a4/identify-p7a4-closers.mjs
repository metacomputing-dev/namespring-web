/*
 * For each violating fragment, identify which source-level paragraph(s) were
 * ADDED by P7-A4 (vs body that pre-existed). We do this by reading the pre-P7-A4
 * version of the file (commit before the P7-A4 expand commit) and diffing the
 * tag sequences.
 *
 * Strategy: list of P7-A4 commits per category. For each fragment, check the
 * file at the commit BEFORE P7-A4 expand and at HEAD; the closer = tag tokens
 * present in HEAD but not in pre-P7-A4 version.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// REPO is the namespring-web repo root.
// __dirname = .../namespring-web/.claude/worktrees/<wt>/lib/spring-ts/artifacts/phase9-agent-a4
// 7 ../ → namespring-web
const REPO = path.resolve(__dirname, '../../../../../../../');

// P7-A4 expand commits: each expanded one category
const P7A4_COMMITS = [
  'd0db869', // academic
  '698d853', // career
  '46c846a', // expression_children
  '1fb710f', // family
  '568e678', // health
  '9a5bb8e', // health_stress
  'c269569', // movement
  '21a1017', // overall
  '781b1d4', // romance
  '92a0943', // study_document
  '173fb2c', // wealth
  '775fac1', // coverage
];

function fileAtCommit(fullPath, commitSha) {
  // Convert worktree path to repo-relative (strip .claude/worktrees/<wt>/ prefix
  // so we read the correct historical path lib/spring-ts/...).
  let rel = path.relative(REPO, fullPath).replace(/\\/g, '/');
  rel = rel.replace(/^\.claude\/worktrees\/[^/]+\//, '');
  try {
    // Use buffer + utf-8 decode to avoid Windows execSync utf-8 mode issues.
    const buf = execSync(`git show ${commitSha}~1:${rel}`, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    if (process.env.DEBUG_BUF) console.error(`  buf size for ${commitSha}~1:${rel} = ${buf.length}`);
    return buf.toString('utf-8');
  } catch (e) {
    if (process.env.DEBUG) console.error('git show failed for', commitSha, rel, ':', e.stderr?.toString().slice(0, 100));
    return null;
  }
}

function getFragmentTags(fragmentJson, fragmentId) {
  const data = JSON.parse(fragmentJson);
  const f = data.fragments?.find((x) => x.fragmentId === fragmentId);
  if (!f) return null;
  return (f.templateTokens ?? []).filter((t) => t.kind === 'tag').map((t) => t.tagId);
}

const violations = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'fragment-violation-map.json'), 'utf-8'),
);

const records = [];

for (const rec of violations.records) {
  const file = rec.sourceFile;
  if (!fs.existsSync(file)) continue;
  const headJson = fs.readFileSync(file, 'utf-8');
  const headTags = getFragmentTags(headJson, rec.fragmentId);
  if (!headTags) continue;

  // Find which P7-A4 commit modified this file
  let preP7A4Tags = null;
  let foundCommit = null;
  const debugLog = process.env.DEBUG_FRAG === rec.fragmentId;
  for (const sha of P7A4_COMMITS) {
    const before = fileAtCommit(file, sha);
    if (debugLog) console.error(`[${sha}] before=${before ? before.length : 'null'}`);
    if (before) {
      const tags = getFragmentTags(before, rec.fragmentId);
      if (debugLog) console.error(`[${sha}] tags=${tags ? tags.length : 'null'} headLen=${headTags.length}`);
      if (tags && tags.length < headTags.length) {
        // Confirm sha actually modified this fragment
        try {
          const diffOut = execSync(`git show --name-only --pretty=format: ${sha}`, { cwd: REPO, encoding: 'utf-8' });
          let rel = path.relative(REPO, file).replace(/\\/g, '/');
          rel = rel.replace(/^\.claude\/worktrees\/[^/]+\//, '');
          if (debugLog) console.error(`[${sha}] rel=${rel} included=${diffOut.includes(rel)}`);
          if (diffOut.includes(rel)) {
            preP7A4Tags = tags;
            foundCommit = sha;
            break;
          }
        } catch (e) {
          if (debugLog) console.error(`[${sha}] diffOut error:`, e.message);
        }
      }
    }
  }

  if (!preP7A4Tags) {
    // Fallback: assume body = first 5 head tags? Skip such fragments.
    records.push({
      fragmentId: rec.fragmentId,
      sourceFile: file,
      tagCount: rec.tagCount,
      headTags,
      preP7A4Tags: null,
      addedTags: null,
      note: 'Could not find pre-P7-A4 version',
    });
    continue;
  }

  // Compute the multiset difference
  const preCount = {};
  for (const t of preP7A4Tags) preCount[t] = (preCount[t] ?? 0) + 1;
  const addedTags = [];
  const headPos = [];
  for (let i = 0; i < headTags.length; i += 1) {
    const t = headTags[i];
    if ((preCount[t] ?? 0) > 0) {
      preCount[t] -= 1;
    } else {
      addedTags.push(t);
      headPos.push(i);
    }
  }

  records.push({
    fragmentId: rec.fragmentId,
    sourceFile: file,
    tagCount: rec.tagCount,
    headTags,
    preP7A4Tags,
    addedTags,
    addedTagPositions: headPos,
    foundCommit,
  });
}

const out = {
  recordCount: records.length,
  records,
};
fs.writeFileSync(
  path.resolve(__dirname, 'p7a4-closer-tags.json'),
  `${JSON.stringify(out, null, 2)}\n`,
  'utf-8',
);

console.log(`Processed ${records.length} fragments`);
const skipped = records.filter((r) => r.addedTags === null);
console.log(`Skipped (no pre-P7-A4 version found): ${skipped.length}`);
for (const r of records) {
  if (r.addedTags) {
    console.log(`  ${r.fragmentId}: head=${r.headTags.length} pre=${r.preP7A4Tags.length} added=[${r.addedTags.join(',')}]`);
  }
}
