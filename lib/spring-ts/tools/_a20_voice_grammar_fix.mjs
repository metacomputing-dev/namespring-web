#!/usr/bin/env node
/**
 * One-shot grammar repair: ungrammatical `~는요.` (관형형 `는` + 종결조사 `요`)
 * → natural sentence-ending forms (~져요/~나요/~와요/~여요/~들어요/...).
 *
 * 31 unique patterns identified by `grep -rohE "[가-힣]+는요\."` over data/narrative/.
 * Substitutions are 1:1, length-preserving or length-reducing only — safe for brief 28-char cap.
 *
 * USAGE: node tools/_a20_voice_grammar_fix.mjs --apply
 *        node tools/_a20_voice_grammar_fix.mjs            # dry-run, prints summary
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const narrativeDir = path.join(repoRoot, 'data', 'narrative');

// Source-of-truth: 31 unique patterns.
// Each maps `<verb>는요.` → grammatical sentence-ending equivalent.
// Verified by Korean grammar:
//   `~지는요` (state-becoming) → `~져요`
//   `~이는요` (action repetitive) → `~여요`
//   `~오는요` → `~와요`
//   `~드는요` → `~들어요`
//   `~나는요` → `~나요`
//   special cases preserved per dictionary form.
const SUBSTITUTIONS = [
  ['가벼워지는요.', '가벼워져요.'],
  ['깊어지는요.', '깊어져요.'],
  ['깔끔해지는요.', '깔끔해져요.'],
  ['나오는요.', '나와요.'],
  ['늘어나는요.', '늘어나요.'],
  ['다지는요.', '다져요.'],
  ['단단해지는요.', '단단해져요.'],
  ['달라지는요.', '달라져요.'],
  ['던지는요.', '던져요.'],
  ['들썩이는요.', '들썩여요.'],
  ['들어오는요.', '들어와요.'],
  ['또렷해지는요.', '또렷해져요.'],
  ['만나는요.', '만나요.'],
  ['만드는요.', '만들어요.'],
  ['매듭지어지는요.', '매듭지어져요.'],
  ['모이는요.', '모여요.'],
  ['받아들이는요.', '받아들여요.'],
  ['밝아지는요.', '밝아져요.'],
  ['보이는요.', '보여요.'],
  ['부드러워지는요.', '부드러워져요.'],
  ['빛나는요.', '빛나요.'],
  ['쌓이는요.', '쌓여요.'],
  ['어우러지는요.', '어우러져요.'],
  ['움직이는요.', '움직여요.'],
  ['이어지는요.', '이어져요.'],
  ['일어나는요.', '일어나요.'],
  ['자라나는요.', '자라나요.'],
  ['채워지는요.', '채워져요.'],
  ['파고드는요.', '파고들어요.'],
  ['펼쳐지는요.', '펼쳐져요.'],
  ['풍요로워지는요.', '풍요로워져요.'],
];

const apply = process.argv.includes('--apply');

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (ent.isFile() && p.endsWith('.json')) yield p;
  }
}

let total = 0;
const perPattern = new Map();
const filesTouched = new Set();

for (const file of walk(narrativeDir)) {
  let content = fs.readFileSync(file, 'utf-8');
  let changed = false;
  for (const [from, to] of SUBSTITUTIONS) {
    const before = content;
    const replaced = content.split(from).join(to);
    if (replaced !== before) {
      const n = (before.length - replaced.length) / (from.length - to.length);
      const c = (before.match(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      perPattern.set(from, (perPattern.get(from) || 0) + c);
      total += c;
      content = replaced;
      changed = true;
    }
  }
  if (changed) {
    filesTouched.add(file);
    if (apply) {
      fs.writeFileSync(file, content, 'utf-8');
    }
  }
}

console.log('Grammar Fix Summary' + (apply ? '' : ' [DRY-RUN]'));
console.log('Files touched: ' + filesTouched.size);
console.log('Total replacements: ' + total);
console.log('Per-pattern:');
for (const [from, count] of [...perPattern.entries()].sort((a, b) => b[1] - a[1])) {
  console.log('  ' + from + ' → ' + count);
}
if (!apply) {
  console.log('\n(Pass --apply to write changes.)');
}
