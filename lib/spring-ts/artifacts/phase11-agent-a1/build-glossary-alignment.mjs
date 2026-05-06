#!/usr/bin/env node
// P11-A1: assemble final glossary-alignment.json artifact from
//   - elements pass: apply-result-elements.json
//   - indices pass: apply-result-indices.json
//   - post-fix scan: mismatch-scan.json (must show 0 mismatches in scope)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const elements = JSON.parse(fs.readFileSync(path.join(__dirname, 'apply-result-elements.json'), 'utf8'));
const indices = JSON.parse(fs.readFileSync(path.join(__dirname, 'apply-result-indices.json'), 'utf8'));
const postScan = JSON.parse(fs.readFileSync(path.join(__dirname, 'mismatch-scan.json'), 'utf8'));

// Reconstruct "before" from the union of elements + indices
const allChanges = [...elements.changes, ...indices.changes];
const beforeByTagId = {};
for (const c of allChanges) {
  if (!beforeByTagId[c.tagId]) {
    beforeByTagId[c.tagId] = { canonical: c.toLabel, variants: {} };
  }
  beforeByTagId[c.tagId].variants[c.fromLabel] =
    (beforeByTagId[c.tagId].variants[c.fromLabel] ?? 0) + c.count;
}

const beforeMismatches = Object.entries(beforeByTagId).reduce(
  (acc, [, info]) => acc + Object.keys(info.variants).length, 0,
);
const beforeTokens = allChanges.reduce((s, c) => s + c.count, 0);

const out = {
  phase: 'P11-A1',
  intent: 'glossary tag.label alignment in expert-depth fragments',
  scope: {
    categoryExpertFiles: postScan.scope.categoryExpertFiles,
    coverageFiles: postScan.scope.coverageFiles,
    inspectedFragmentsPostFix: postScan.scope.inspectedFragments,
    inspectedTagTokensPostFix: postScan.scope.inspectedTagTokens,
  },
  before: {
    uniqueMismatches: beforeMismatches,
    totalMismatchTokens: beforeTokens,
    byTagId: beforeByTagId,
  },
  after: {
    uniqueMismatches: postScan.uniqueMismatches,
    totalMismatchTokens: postScan.totalMismatchTokens,
  },
  passes: [
    {
      name: 'elements',
      tagIds: elements.targetTagIds,
      filesTouched: elements.filesTouched,
      totalLabelChanges: elements.totalLabelChanges,
      changes: elements.changes,
    },
    {
      name: 'indices',
      tagIds: indices.targetTagIds,
      filesTouched: indices.filesTouched,
      totalLabelChanges: indices.totalLabelChanges,
      changes: indices.changes,
    },
  ],
  particleHandling: {
    note: 'renderFragmentParagraphs.normalizeParticlesAfterTags rewrites trailing-text particles based on tag.label final consonant at render time; no hand-edits to text tokens were required.',
    verifiedBy: 'artifacts/phase11-agent-a1/render-particle-check.ts (3 PASS / 0 FAIL)',
  },
  acceptance: {
    typecheck: 'PASS (tsc --noEmit)',
    'ci:no-ai-policy': 'PASS (4077 fragments / 7095 sourceTier records)',
    'test:tiered-isolation': 'PASS (37/37)',
    'test:tiered-shape': 'PASS (NNN PASS / 0 FAIL — counts vary across runs due to fixture sampling, no FAILs)',
    'test:narrative-schema': 'PASS (102801/102801)',
    'test:namespring-compat': 'PASS pre-existing baseline (182/183) — unrelated overview-summary-card pillar elements failure persists from prior commit, out of P11-A1 scope.',
  },
  notes: [
    'Scope strictly limited to data/narrative/<cat>/<period>/expert.fragments.json and data/narrative/_coverage/**/*.fragments.json (expert-depth fragments only). Glossary entries, brief/standard fragments, src/, _glossary/, _metaphor/, _modifier_*/, _seed/, _contract/, ../../namespring/ untouched.',
    'sajuCompatibility variant `사주궁합` carries a marketing/compatibility connotation distinct from the canonical `사주적합도` (compatibility-fit-score). Aligned per task directive; reviewers may want to revisit if a separate `sajuGunghap` tagId is desired in future schema work.',
    'fire/earth/water Sino-Korean variants (화/토/수) appeared mostly in classical-register expert prose (`min14-health-floor`, etc.). The vernacular forms (불/흙/물) match the glossary canonical and standardize the on-screen rendered tag chips.',
  ],
};

const outPath = path.join(__dirname, 'glossary-alignment.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`before: ${beforeMismatches} mismatch types / ${beforeTokens} token sites`);
console.log(`after:  ${postScan.uniqueMismatches} mismatch types / ${postScan.totalMismatchTokens} token sites`);
console.log(`output: ${outPath}`);
