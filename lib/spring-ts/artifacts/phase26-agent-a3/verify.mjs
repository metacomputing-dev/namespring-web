// Verify paragraph counts for the 10 edited fragments
import fs from 'node:fs';

const targets = [
  ['academic.life.standard.10_19.003', 'data/narrative/academic/life/standard.fragments.json'],
  ['career.thisMonth.standard.age20_29.007', 'data/narrative/career/thisMonth/standard.fragments.json'],
  ['family.life.standard.balanced.012', 'data/narrative/family/life/standard.fragments.json'],
  ['family.life.standard.elder.008', 'data/narrative/family/life/standard.fragments.json'],
  ['health.today.standard.balanced.001', 'data/narrative/health/today/standard.fragments.json'],
  ['overall.thisMonth.standard.balanced.neutral.008', 'data/narrative/overall/thisMonth/standard.fragments.json'],
  ['wealth.thisYear.standard.55_69.009', 'data/narrative/wealth/thisYear/standard.fragments.json'],
  ['wealth.thisYear.standard.female.40_54.007', 'data/narrative/wealth/thisYear/standard.fragments.json'],
  ['wealth.thisYear.standard.male.30_39.006', 'data/narrative/wealth/thisYear/standard.fragments.json'],
  ['wealth.thisYear.standard.wildcard.001', 'data/narrative/wealth/thisYear/standard.fragments.json'],
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
  const isFive = paragraphs.length === 5;
  if (!isFive) allOK = false;
  console.log(
    (isFive ? 'OK' : 'FAIL'),
    fid,
    'paragraphs=' + paragraphs.length,
    'lengths=' + JSON.stringify(lengths)
  );
}
console.log(allOK ? '\nALL 10 EDITS VERIFIED 5P' : '\nFAILURES PRESENT');
