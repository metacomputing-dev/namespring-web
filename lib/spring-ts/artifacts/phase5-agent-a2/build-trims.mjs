// Combine auto proposals + manual trims into final trims.json file.
import fs from 'node:fs';

const proposals = JSON.parse(fs.readFileSync('artifacts/phase5-agent-a2/auto-proposals.json', 'utf-8'));
const manuals = JSON.parse(fs.readFileSync('artifacts/phase5-agent-a2/manual-trims.json', 'utf-8'));
const manualMap = new Map(manuals.map(m => [m.fragmentId, m]));

const trims = [];
for (const r of proposals) {
  const manual = manualMap.get(r.fragmentId);
  if (manual) {
    trims.push({
      file: r.file,
      fragmentId: r.fragmentId,
      origKo: r.origKo,
      origText: r.origText,
      newText: manual.newText,
    });
  } else if (r.proposals.length > 0) {
    // Pick longest proposal (preserves most text)
    const pick = r.proposals[0]; // already sorted by ko desc
    trims.push({
      file: r.file,
      fragmentId: r.fragmentId,
      origKo: r.origKo,
      origText: r.origText,
      newText: pick.text,
    });
  }
}
console.log('total trims:', trims.length);
fs.writeFileSync('artifacts/phase5-agent-a2/trims.json', JSON.stringify(trims, null, 2) + '\n');

// Sanity check
function ko(s) { return Array.from(s).filter(c => /[가-힣]/.test(c)).length; }
let bad = 0;
for (const t of trims) {
  const k = ko(t.newText);
  if (k > 30) { bad++; console.log('TOO LONG', k, t.fragmentId, t.newText); }
}
console.log('too long:', bad);
