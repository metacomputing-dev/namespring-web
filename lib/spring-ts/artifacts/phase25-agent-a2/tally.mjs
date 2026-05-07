// Phase 25 Agent A2 -- tally script (audit-only, not part of build)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');
const SAMPLE_DIR = path.join(ROOT, 'artifacts', 'sample-outputs-2026-05-05-phase3');

const fragMap = new Map();

function indexFile(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!Array.isArray(j.fragments)) return;
    for (const frag of j.fragments) {
      const text = frag.templateTokens?.find((t) => t.kind === 'text')?.value ?? '';
      const paragraphs = text.split('\n\n').filter((s) => s.trim().length > 0);
      const rel = path.relative(NARRATIVE_DIR, file).split(path.sep).join('/');
      fragMap.set(frag.fragmentId, {
        file: rel,
        paragraphs: paragraphs.length,
        depth: frag.axis?.depth ?? null,
        category: frag.axis?.category ?? null,
        period: frag.axis?.period ?? null,
        textLen: text.length,
      });
    }
  } catch (e) {
    // skip
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith('.fragments.json')) indexFile(full);
  }
}

walk(NARRATIVE_DIR);

// Scan samples
const samples = fs.readdirSync(SAMPLE_DIR).filter((f) => /-tiered\.json$/.test(f));

const counts3p = new Map(); // fragmentId -> count of 3p cells using it
const sourceTally = {
  owned_standard_period: 0,
  coverage: 0,
  metaphor: 0,
  mod_age: 0,
  mod_gender: 0,
  seed: 0,
  other: 0,
  missing_fragment: 0,
  no_selected: 0,
};

let total3p = 0;
let total4p = 0;
let total5p = 0;

for (const f of samples) {
  const s = JSON.parse(fs.readFileSync(path.join(SAMPLE_DIR, f), 'utf-8'));
  const periods = s?.payload?.tieredMatrix?.periods || s?.tieredMatrix?.periods;
  if (!periods) continue;
  for (const pk of Object.keys(periods)) {
    const period = periods[pk];
    const cells = [['overall', period.overall], ...Object.entries(period.byCategory || {})];
    for (const [ck, cell] of cells) {
      if (!cell?.standard?.paragraphs) continue;
      const paragraphCount = cell.standard.paragraphs.length;
      if (paragraphCount === 3) total3p++;
      else if (paragraphCount === 4) total4p++;
      else if (paragraphCount === 5) total5p++;
      if (paragraphCount !== 3) continue;

      const fid = cell.selectedFragments?.standard?.fragmentId;
      if (!fid) {
        sourceTally.no_selected++;
        continue;
      }
      counts3p.set(fid, (counts3p.get(fid) || 0) + 1);
      const meta = fragMap.get(fid);
      if (!meta) {
        sourceTally.missing_fragment++;
        continue;
      }
      const file = meta.file;
      if (file.startsWith('_coverage/')) sourceTally.coverage++;
      else if (file.startsWith('_metaphor/')) sourceTally.metaphor++;
      else if (file.startsWith('_modifier_age/')) sourceTally.mod_age++;
      else if (file.startsWith('_modifier_gender/')) sourceTally.mod_gender++;
      else if (file.startsWith('_seed/')) sourceTally.seed++;
      else if (file.endsWith('/standard.fragments.json')) sourceTally.owned_standard_period++;
      else sourceTally.other++;
    }
  }
}

console.log('cell paragraph histogram:', { '3': total3p, '4': total4p, '5': total5p });
console.log('source tally for 3p cells:', sourceTally);
console.log('');
console.log('Top fragmentIds selected for 3p cells (top 30):');
const top = [...counts3p.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
for (const [fid, ct] of top) {
  const meta = fragMap.get(fid);
  console.log(
    '  ct=' + String(ct).padStart(3) + '  ' + fid + '\n      file=' + (meta?.file ?? 'MISSING') + ' paragraphs=' + (meta?.paragraphs ?? '?')
  );
}

console.log('');
console.log('Sample of 3p cells sourced from owned standard.fragments.json (top 25):');
const ownedTop = [...counts3p.entries()]
  .filter(([fid]) => {
    const m = fragMap.get(fid);
    return m && m.file.endsWith('/standard.fragments.json') && !m.file.startsWith('_');
  })
  .sort((a, b) => b[1] - a[1])
  .slice(0, 25);
for (const [fid, ct] of ownedTop) {
  const meta = fragMap.get(fid);
  console.log('  ct=' + String(ct).padStart(3) + '  ' + fid + '  ' + meta.file);
}
