// Apply trims defined in trims.json by direct text replacement (preserves formatting).
// Each trim entry: { file, fragmentId, oldText, newText OR newTexts: [..] }
// For splits, we replace the original quoted line with multiple lines while preserving indent.
import fs from 'node:fs';

const TRIMS_PATH = process.argv[2] || 'artifacts/phase5-agent-a2/trims.json';
const trims = JSON.parse(fs.readFileSync(TRIMS_PATH, 'utf-8'));

function countKoreanChars(s) {
  return Array.from(s).filter(c => /[가-힣]/.test(c)).length;
}

function jsonEscape(s) {
  return JSON.stringify(s).slice(1, -1); // get the escaped form without surrounding quotes
}

const byFile = new Map();
for (const trim of trims) {
  if (!byFile.has(trim.file)) byFile.set(trim.file, []);
  byFile.get(trim.file).push(trim);
}

let appliedCount = 0;
let mismatchCount = 0;
let stillTooLongCount = 0;

for (const [file, list] of byFile) {
  let raw = fs.readFileSync(file, 'utf-8');
  for (const trim of list) {
    const oldEsc = jsonEscape(trim.origText);
    const oldQuoted = `"${oldEsc}"`;
    const findIdx = raw.indexOf(oldQuoted);
    if (findIdx < 0) {
      console.error(`MISMATCH ${file} ${trim.fragmentId}: not found "${trim.origText}"`);
      mismatchCount++;
      continue;
    }
    if (Array.isArray(trim.newTexts)) {
      // For split: replace the single quoted string with multiple, separated by `,\n      ` (matching leading indentation of next line)
      // Find the indentation of the original line.
      const lineStart = raw.lastIndexOf('\n', findIdx) + 1;
      const indent = raw.slice(lineStart, findIdx);
      // Pure indent (no other chars before quote) is required; otherwise risk of mis-formatting.
      if (!/^\s*$/.test(indent)) {
        console.error(`SPLIT REQUIRES LEADING INDENT ONLY ${file} ${trim.fragmentId}`);
        mismatchCount++;
        continue;
      }
      const replacement = trim.newTexts.map(t => `"${jsonEscape(t)}"`).join(`,\n${indent}`);
      raw = raw.slice(0, findIdx) + replacement + raw.slice(findIdx + oldQuoted.length);
      for (const nt of trim.newTexts) {
        const ko = countKoreanChars(nt);
        if (ko > 30) {
          console.error(`STILL TOO LONG ${trim.fragmentId}: ${ko} -> "${nt}"`);
          stillTooLongCount++;
        }
      }
      appliedCount++;
    } else {
      const newEsc = jsonEscape(trim.newText);
      const newQuoted = `"${newEsc}"`;
      const ko = countKoreanChars(trim.newText);
      if (ko > 30) {
        console.error(`STILL TOO LONG ${trim.fragmentId}: ${ko} -> "${trim.newText}"`);
        stillTooLongCount++;
      }
      raw = raw.slice(0, findIdx) + newQuoted + raw.slice(findIdx + oldQuoted.length);
      appliedCount++;
    }
  }
  fs.writeFileSync(file, raw);
}
console.log(`applied ${appliedCount} trims, mismatches: ${mismatchCount}, still too long: ${stillTooLongCount}`);
