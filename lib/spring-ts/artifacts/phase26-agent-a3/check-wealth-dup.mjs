// Check duplication across wealth candidates
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('artifacts/phase26-agent-a3/candidates-4p-ct1.json', 'utf-8'));

const wealthSet = data.filter((c) => c.category === 'wealth');
console.log('Wealth candidates:', wealthSet.length);
for (const w of wealthSet) {
  console.log(`\n${w.fragmentId}:`);
  console.log(`  ${w.paragraphs[0].slice(0, 50)}...`);
}

// Group by P2-P4 hash similarity
const groups = new Map();
for (const w of wealthSet) {
  const key = w.paragraphs.slice(1, 4).map((p) => p.slice(0, 30)).join('||');
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(w.fragmentId);
}
console.log('\n\nDuplicate clusters (matching P2/P3/P4 prefixes):');
for (const [key, fids] of groups.entries()) {
  if (fids.length > 1) {
    console.log(`  cluster (${fids.length}): ${fids.join(', ')}`);
  } else {
    console.log(`  unique: ${fids[0]}`);
  }
}
