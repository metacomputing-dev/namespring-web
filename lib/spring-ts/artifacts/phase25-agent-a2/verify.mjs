// Verify paragraph counts for the 12 edited fragments
import fs from 'node:fs';
import path from 'node:path';

const targets = [
  ['academic.life.standard.10_19.003', 'data/narrative/academic/life/standard.fragments.json'],
  ['career.thisMonth.standard.age20_29.007', 'data/narrative/career/thisMonth/standard.fragments.json'],
  ['expression_children.thisMonth.standard.55_69.007', 'data/narrative/expression_children/thisMonth/standard.fragments.json'],
  ['family.life.standard.balanced.012', 'data/narrative/family/life/standard.fragments.json'],
  ['family.life.standard.elder.008', 'data/narrative/family/life/standard.fragments.json'],
  ['family.thisMonth.standard.middle.006', 'data/narrative/family/thisMonth/standard.fragments.json'],
  ['family.thisYear.standard.strong.012', 'data/narrative/family/thisYear/standard.fragments.json'],
  ['health.thisYear.standard.10_19.001', 'data/narrative/health/thisYear/standard.fragments.json'],
  ['health.today.standard.balanced.001', 'data/narrative/health/today/standard.fragments.json'],
  ['movement.thisMonth.standard.30_39.005', 'data/narrative/movement/thisMonth/standard.fragments.json'],
  ['movement.thisYear.standard.55_69.007', 'data/narrative/movement/thisYear/standard.fragments.json'],
  ['overall.thisMonth.standard.balanced.neutral.008', 'data/narrative/overall/thisMonth/standard.fragments.json'],
];

let allOK = true;
for (const [fid, file] of targets) {
  const j = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const frag = j.fragments.find((f) => f.fragmentId === fid);
  if (!frag) {
    console.log('MISSING:', fid);
    allOK = false;
    continue;
  }
  const text = frag.templateTokens?.find((t) => t.kind === 'text')?.value ?? '';
  const paragraphs = text.split('\n\n').filter((s) => s.trim().length > 0);
  const lengths = paragraphs.map((p) => p.length);
  const isFour = paragraphs.length === 4;
  if (!isFour) allOK = false;
  console.log((isFour ? 'OK' : 'FAIL'), fid, 'paragraphs=' + paragraphs.length, 'lengths=' + JSON.stringify(lengths), 'p4=' + (paragraphs[3] ?? '?').slice(0, 40) + '...');
}
console.log(allOK ? '\nALL 12 EDITS VERIFIED 4P' : '\nFAILURES PRESENT');
