/**
 * artifacts/phase16-agent-a3/analyze-profiles.mjs
 *
 * Phase 16 Agent A3: brief.hook expansion analysis tool.
 *
 * For each tiered sample fixture, extract the inputs that drive
 * gating selection -- ageBand (computed from birth.year vs targetDate),
 * gender, dayMasterStrength, yongshinAlignment, polarity, dayMaster
 * element -- and produce a CSV-ish printout. Used to design hook
 * gating that fires deterministically for ≥1 fixture each.
 *
 * Read-only on the sample artifacts; no engine spawn.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const SAMPLES_DIR = path.resolve(SPRING_TS_ROOT, 'artifacts/sample-outputs-2026-05-05-phase3');

const TIERED_FILE_RE = /-tiered\.json$/;
const sampleFiles = fs
  .readdirSync(SAMPLES_DIR)
  .filter((f) => TIERED_FILE_RE.test(f))
  .sort();

function ageBandOf(year, targetYear) {
  const a = targetYear - year;
  if (a < 10) return '0-9';
  if (a < 20) return '10-19';
  if (a < 30) return '20-29';
  if (a < 40) return '30-39';
  if (a < 55) return '40-54';
  if (a < 70) return '55-69';
  return '70+';
}

const out = [];
for (const file of sampleFiles) {
  const fullPath = path.join(SAMPLES_DIR, file);
  const json = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  const birth = json?.request?.birth ?? json?.payload?.nameCompatibility?.input?.birth;
  if (!birth) continue;
  const targetDate = new Date(json?.targetDate ?? json?.request?.targetDate);
  const targetYear = targetDate.getFullYear();
  const ageBand = ageBandOf(birth.year, targetYear);

  // Try to find dayMaster strength signals from various places
  const sajuVec = json?.payload?.tieredMatrix?.spring?.springReport?.vector?.sajuMatrix
    ?? json?.payload?.springReport?.vector?.sajuMatrix
    ?? json?.payload?.sajuVector;
  const tieredMatrix = json?.payload?.tieredMatrix;
  let dayMaster = null;
  let strength = null;
  let polarity = null;
  let element = null;
  let yongshinAlignment = null;

  // Search through known places
  const dive = (obj, depth = 0) => {
    if (!obj || depth > 4 || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (k === 'dayMasterStrengthCategory' && typeof v === 'string') strength = v;
      if (k === 'strengthLevel' && typeof v === 'string' && !strength) strength = v;
      if (k === 'dayMasterPolarity' && typeof v === 'string') polarity = v;
      if (k === 'polarity' && typeof v === 'string' && !polarity) polarity = v;
      if (k === 'dayMasterElement' && typeof v === 'string') element = v;
      if (k === 'yongshinAlignment' && typeof v === 'string') yongshinAlignment = v;
      if (k === 'dayMaster' && typeof v === 'object') dayMaster = v;
      if (typeof v === 'object') dive(v, depth + 1);
    }
  };
  dive(json);

  out.push({
    file,
    year: birth.year,
    age: targetYear - birth.year,
    ageBand,
    gender: birth.gender,
    strength,
    polarity,
    element,
    yongshinAlignment,
  });
}

// Histograms
const histo = (key) => out.reduce((acc, r) => {
  const v = r[key] ?? '(unknown)';
  acc[v] = (acc[v] ?? 0) + 1;
  return acc;
}, {});

console.log('Total fixtures: ' + out.length);
console.log('\nageBand distribution:');
console.log(JSON.stringify(histo('ageBand'), null, 2));
console.log('\ngender distribution:');
console.log(JSON.stringify(histo('gender'), null, 2));
console.log('\nstrength distribution:');
console.log(JSON.stringify(histo('strength'), null, 2));
console.log('\npolarity distribution:');
console.log(JSON.stringify(histo('polarity'), null, 2));
console.log('\nelement distribution:');
console.log(JSON.stringify(histo('element'), null, 2));
console.log('\nyongshinAlignment distribution:');
console.log(JSON.stringify(histo('yongshinAlignment'), null, 2));

console.log('\nFull table:');
const headers = ['file','year','age','ageBand','gender','strength','polarity','element','yongshinAlignment'];
console.log(headers.join('\t'));
for (const r of out) {
  console.log(headers.map((h) => r[h] ?? '').join('\t'));
}
