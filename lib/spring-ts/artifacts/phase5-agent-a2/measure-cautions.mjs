// Phase 5 agent A2 — measure cautions length in data/narrative/_coverage/
// Run from lib/spring-ts: node artifacts/phase5-agent-a2/measure-cautions.mjs [out.json]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('data/narrative/_coverage');

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(full));
    } else if (entry.name.endsWith('.fragments.json')) {
      result.push(full);
    }
  }
  return result;
}

function countKoreanChars(s) {
  return Array.from(s).filter(c => /[가-힣]/.test(c)).length;
}

function measure() {
  const files = walkFiles(ROOT);
  let total = 0;
  let totalCautions = 0;
  const violations = [];
  const distribution = { '1-20': 0, '21-30': 0, '31-35': 0, '36-40': 0, '41-50': 0, '51+': 0 };
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const frag of data.fragments || []) {
      total++;
      const cautions = Array.isArray(frag.cautions) ? frag.cautions : [];
      for (let i = 0; i < cautions.length; i++) {
        const c = cautions[i];
        if (typeof c !== 'string') continue;
        totalCautions++;
        const ko = countKoreanChars(c);
        if (ko <= 20) distribution['1-20']++;
        else if (ko <= 30) distribution['21-30']++;
        else if (ko <= 35) distribution['31-35']++;
        else if (ko <= 40) distribution['36-40']++;
        else if (ko <= 50) distribution['41-50']++;
        else distribution['51+']++;
        if (ko > 30) {
          violations.push({
            file: path.relative(path.resolve('.'), file).replaceAll(path.sep, '/'),
            fragmentId: frag.fragmentId,
            depth: frag.axis?.depth,
            index: i,
            ko,
            text: c,
          });
        }
      }
    }
  }
  return { fileCount: files.length, fragmentCount: total, cautionsCount: totalCautions, distribution, violations };
}

const r = measure();
const out = {
  scope: 'data/narrative/_coverage',
  generatedAt: new Date().toISOString(),
  threshold: 30,
  summary: {
    fileCount: r.fileCount,
    fragmentCount: r.fragmentCount,
    cautionsCount: r.cautionsCount,
    violationCount: r.violations.length,
  },
  distribution: r.distribution,
  violations: r.violations,
};

const outPath = process.argv[2];
if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`wrote ${outPath}: ${out.summary.violationCount} violations / ${out.summary.cautionsCount} cautions`);
} else {
  console.log(JSON.stringify(out, null, 2));
}
