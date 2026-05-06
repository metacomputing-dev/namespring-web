#!/usr/bin/env node
/**
 * P12-A4 Commit 2: Diversify shared closings in overall/expert and
 * academic/expert fragments.
 *
 * Three suffix variants per shared closing keep meaning + tag structure.
 * Skip wildcard.001 floor templates per advisor guidance.
 *
 * Overall closings (two-text-token, with tag in middle):
 *   1. 통관용신/병약용신: "의 결이 보이면 흐름의 막힌 자리를 풀어 주는 자리가 보이고, "
 *      + "의 자리가 함께 들어오면 약한 자리를 메우는 결이 함께 작동해요."
 *      Variant A: "의 흐름이 들어오면 답답해진 자리를 한층 가볍게 풀어 주고, "
 *                 "이 함께 자리하면 약한 자리를 천천히 채워 주는 결이 같이 작동해요."
 *      Variant B: "의 결이 자리하면 한쪽으로 막힌 흐름을 부드럽게 살려 주고, "
 *                 "의 흐름이 곁에 들어오면 모자란 자리를 자연스레 받쳐 주는 결이 함께 흘러요."
 *
 *   2. 납음/납음오행: "의 결을 함께 살펴 두면 사주 모양의 깊은 색이 더 또렷해지고, "
 *      + "의 흐름이 자기 결을 보완하는 자리가 자주 등장해요."
 *      Variant A: "의 흐름을 함께 들여다보면 사주가 띤 결의 깊이가 한층 또렷해지고, "
 *                 "이 자기 흐름을 받쳐 주는 결이 자주 모습을 드러내요."
 *      Variant B: "의 자리를 함께 챙겨 두면 사주 모양의 색감이 한층 짙어지고, "
 *                 "의 자리가 자기 결의 빈 곳을 채워 주는 흐름이 자주 보여요."
 *
 * Academic closing (single-text-token suffix):
 *   3. 대운궁실/일진: "의 자리가 함께 살아나는 시기엔 평소 미뤄 둔 학습 한 단원을 매듭짓기에 좋은 흐름이 보여요."
 *      Variant A: "이 함께 활기를 띠는 시기에는 그동안 미뤄 둔 학습 한 단원을 매듭지을 결이 자연스럽게 모여요."
 *      Variant B: "의 흐름이 함께 살아날 때는 한 단원씩 차분히 매듭짓기 좋은 페이스가 자리 잡아요."
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// Overall: 통관/병약 pair
const ORIG_TONGGWAN_FIRST = '의 결이 보이면 흐름의 막힌 자리를 풀어 주는 자리가 보이고, ';
const ORIG_BYEONGYAK_TAIL = '의 자리가 함께 들어오면 약한 자리를 메우는 결이 함께 작동해요.';
const A_TONGGWAN_FIRST = '의 흐름이 들어오면 답답해진 자리를 한층 가볍게 풀어 주고, ';
const A_BYEONGYAK_TAIL = '이 함께 자리하면 약한 자리를 천천히 채워 주는 결이 같이 작동해요.';
const B_TONGGWAN_FIRST = '의 결이 자리하면 한쪽으로 막힌 흐름을 부드럽게 살려 주고, ';
const B_BYEONGYAK_TAIL = '의 흐름이 곁에 들어오면 모자란 자리를 자연스레 받쳐 주는 결이 함께 흘러요.';

// Overall: 납음/납음오행 pair
const ORIG_NAPEUM_FIRST = '의 결을 함께 살펴 두면 사주 모양의 깊은 색이 더 또렷해지고, ';
const ORIG_NAEUMEL_TAIL = '의 흐름이 자기 결을 보완하는 자리가 자주 등장해요.';
const A_NAPEUM_FIRST = '의 흐름을 함께 들여다보면 사주가 띤 결의 깊이가 한층 또렷해지고, ';
const A_NAEUMEL_TAIL = '이 자기 흐름을 받쳐 주는 결이 자주 모습을 드러내요.';
const B_NAPEUM_FIRST = '의 자리를 함께 챙겨 두면 사주 모양의 색감이 한층 짙어지고, ';
const B_NAEUMEL_TAIL = '의 자리가 자기 결의 빈 곳을 채워 주는 흐름이 자주 보여요.';

// Academic: 대운궁실/일진 single-token suffix
const ORIG_DAEWOON_ILJIN = '의 자리가 함께 살아나는 시기엔 평소 미뤄 둔 학습 한 단원을 매듭짓기에 좋은 흐름이 보여요.';
const A_DAEWOON_ILJIN = '이 함께 활기를 띠는 시기에는 그동안 미뤄 둔 학습 한 단원을 매듭지을 결이 자연스럽게 모여요.';
const B_DAEWOON_ILJIN = '의 흐름이 함께 살아날 때는 한 단원씩 차분히 매듭짓기 좋은 페이스가 자리 잡아요.';

// Programmatic targets: define cell -> targets
const CELL_TARGETS = {
  // Overall life expert, 통관/병약 pair appears in many fragments
  // Skip wildcard.001 + child.001 (also a floor variant). Pick 2 of the rest.
  'overall.life': [
    { fragmentId: 'overall.life.expert.extreme_strong.aligned.002', variant: 'A', closing: 'tonggwanByeongyak' },
    { fragmentId: 'overall.life.expert.weak.neutral.age40_54.011', variant: 'B', closing: 'tonggwanByeongyak' },
    { fragmentId: 'overall.life.expert.strong.aligned.male.age30_39.004', variant: 'A', closing: 'napeumNaeum' },
    { fragmentId: 'overall.life.expert.balanced.conflicting.009', variant: 'B', closing: 'napeumNaeum' },
  ],
  'overall.thisMonth': [
    { fragmentId: 'overall.thisMonth.expert.extreme_strong.aligned.002', variant: 'A', closing: 'tonggwanByeongyak' },
    { fragmentId: 'overall.thisMonth.expert.balanced.neutral.008', variant: 'B', closing: 'tonggwanByeongyak' },
    { fragmentId: 'overall.thisMonth.expert.strong.aligned.male.age30_39.004', variant: 'A', closing: 'napeumNaeum' },
    { fragmentId: 'overall.thisMonth.expert.balanced.conflicting.009', variant: 'B', closing: 'napeumNaeum' },
  ],
  'overall.thisWeek': [
    { fragmentId: 'overall.thisWeek.expert.strong.aligned.003', variant: 'A', closing: 'tonggwanByeongyak' },
    { fragmentId: 'overall.thisWeek.expert.balanced.aligned.006', variant: 'B', closing: 'tonggwanByeongyak' },
    { fragmentId: 'overall.thisWeek.expert.strong.neutral.005', variant: 'A', closing: 'napeumNaeum' },
    { fragmentId: 'overall.thisWeek.expert.balanced.aligned.female.age20_29.007', variant: 'B', closing: 'napeumNaeum' },
  ],
  'overall.thisYear': [
    { fragmentId: 'overall.thisYear.expert.extreme_strong.aligned.002', variant: 'A', closing: 'tonggwanByeongyak' },
    { fragmentId: 'overall.thisYear.expert.strong.neutral.005', variant: 'B', closing: 'tonggwanByeongyak' },
    { fragmentId: 'overall.thisYear.expert.strong.aligned.003', variant: 'A', closing: 'napeumNaeum' },
    { fragmentId: 'overall.thisYear.expert.balanced.aligned.006', variant: 'B', closing: 'napeumNaeum' },
  ],
  'overall.today': [
    { fragmentId: 'overall.today.expert.extreme_strong.aligned.002', variant: 'A', closing: 'tonggwanByeongyak' },
    { fragmentId: 'overall.today.expert.strong.neutral.005', variant: 'B', closing: 'tonggwanByeongyak' },
    { fragmentId: 'overall.today.expert.strong.aligned.003', variant: 'A', closing: 'napeumNaeum' },
    { fragmentId: 'overall.today.expert.balanced.aligned.006', variant: 'B', closing: 'napeumNaeum' },
  ],

  // Academic 대운궁실/일진 single-token suffix
  'academic.life': [
    { fragmentId: 'academic.life.expert.currentseason.spring_summer.301', variant: 'A', closing: 'daewoonIljin' },
    { fragmentId: 'academic.life.expert.input_output.504', variant: 'B', closing: 'daewoonIljin' },
  ],
  'academic.thisMonth': [
    { fragmentId: 'academic.thisMonth.expert.strong_aligned.005', variant: 'A', closing: 'daewoonIljin' },
    { fragmentId: 'academic.thisMonth.expert.structure.504', variant: 'B', closing: 'daewoonIljin' },
  ],
  'academic.thisWeek': [
    { fragmentId: 'academic.thisWeek.expert.jeongingyeok.006', variant: 'A', closing: 'daewoonIljin' },
    { fragmentId: 'academic.thisWeek.expert.focus.501', variant: 'B', closing: 'daewoonIljin' },
  ],
  'academic.thisYear': [
    { fragmentId: 'academic.thisYear.expert.aligned.002', variant: 'A', closing: 'daewoonIljin' },
    { fragmentId: 'academic.thisYear.expert.pyeoningyeok.007', variant: 'B', closing: 'daewoonIljin' },
  ],
  'academic.today': [
    { fragmentId: 'academic.today.expert.aligned.002', variant: 'A', closing: 'daewoonIljin' },
    { fragmentId: 'academic.today.expert.pyeoningyeok.007', variant: 'B', closing: 'daewoonIljin' },
  ],
};

// Build a fragmentId -> filePath index by walking data/narrative/
function buildFragmentIndex() {
  const idx = new Map();
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '_glossary' || entry.name === '_contract') continue;
        walk(p);
      } else if (entry.isFile() && entry.name.endsWith('.fragments.json')) {
        try {
          const bundle = JSON.parse(fs.readFileSync(p, 'utf8'));
          for (const frag of bundle.fragments || []) {
            if (frag.fragmentId) idx.set(frag.fragmentId, p);
          }
        } catch {}
      }
    }
  }
  walk(path.join(ROOT, 'data', 'narrative'));
  return idx;
}
const FRAGMENT_INDEX = buildFragmentIndex();

// closing kind -> (orig first text, replacement first text, orig tail, replacement tail) per variant
const CLOSING_DEFS = {
  tonggwanByeongyak: {
    A: { firstOld: ORIG_TONGGWAN_FIRST, firstNew: A_TONGGWAN_FIRST, tailOld: ORIG_BYEONGYAK_TAIL, tailNew: A_BYEONGYAK_TAIL },
    B: { firstOld: ORIG_TONGGWAN_FIRST, firstNew: B_TONGGWAN_FIRST, tailOld: ORIG_BYEONGYAK_TAIL, tailNew: B_BYEONGYAK_TAIL },
  },
  napeumNaeum: {
    A: { firstOld: ORIG_NAPEUM_FIRST, firstNew: A_NAPEUM_FIRST, tailOld: ORIG_NAEUMEL_TAIL, tailNew: A_NAEUMEL_TAIL },
    B: { firstOld: ORIG_NAPEUM_FIRST, firstNew: B_NAPEUM_FIRST, tailOld: ORIG_NAEUMEL_TAIL, tailNew: B_NAEUMEL_TAIL },
  },
  daewoonIljin: {
    A: { tailOnly: true, tailOld: ORIG_DAEWOON_ILJIN, tailNew: A_DAEWOON_ILJIN },
    B: { tailOnly: true, tailOld: ORIG_DAEWOON_ILJIN, tailNew: B_DAEWOON_ILJIN },
  },
};

let applied = 0;
let notFound = 0;
let alreadyApplied = 0;
const summary = [];

const fileBundles = new Map();
function getBundle(filePath) {
  if (!fileBundles.has(filePath)) {
    fileBundles.set(filePath, JSON.parse(fs.readFileSync(filePath, 'utf8')));
  }
  return fileBundles.get(filePath);
}

function replaceInTokens(tokens, oldStr, newStr) {
  for (const tok of tokens) {
    if (tok.kind !== 'text') continue;
    const v = tok.value || '';
    if (v.endsWith(newStr) || v.endsWith(newStr + '\n\n')) {
      return 'already';
    }
    if (v.endsWith(oldStr + '\n\n')) {
      tok.value = v.slice(0, v.length - oldStr.length - 2) + newStr + '\n\n';
      return true;
    }
    if (v.endsWith(oldStr)) {
      tok.value = v.slice(0, v.length - oldStr.length) + newStr;
      return true;
    }
    if (v === oldStr) {
      tok.value = newStr;
      return true;
    }
  }
  // Try direct equality match (for the middle text token whose value is exactly the oldStr)
  for (const tok of tokens) {
    if (tok.kind !== 'text') continue;
    if (tok.value === oldStr) {
      tok.value = newStr;
      return true;
    }
  }
  return false;
}

for (const [cellKey, targets] of Object.entries(CELL_TARGETS)) {
  for (const t of targets) {
    const filePath = FRAGMENT_INDEX.get(t.fragmentId);
    if (!filePath) {
      console.warn(`NOTFOUND: ${t.fragmentId}`);
      notFound += 1;
      continue;
    }
    const bundle = getBundle(filePath);
    const frag = (bundle.fragments || []).find((f) => f.fragmentId === t.fragmentId);
    if (!frag) {
      console.warn(`NOTFOUND: ${t.fragmentId}`);
      notFound += 1;
      continue;
    }
    const def = CLOSING_DEFS[t.closing][t.variant];
    let firstResult = true;
    if (!def.tailOnly) {
      firstResult = replaceInTokens(frag.templateTokens || [], def.firstOld, def.firstNew);
    }
    const tailResult = replaceInTokens(frag.templateTokens || [], def.tailOld, def.tailNew);
    if (firstResult === 'already' && tailResult === 'already') {
      alreadyApplied += 1;
      summary.push(`ALREADY: ${t.fragmentId} closing=${t.closing} ${t.variant}`);
      continue;
    }
    if (firstResult === false || tailResult === false) {
      console.warn(`MISS: ${t.fragmentId} closing=${t.closing} ${t.variant} firstResult=${firstResult} tailResult=${tailResult}`);
      notFound += 1;
      continue;
    }
    applied += 1;
    summary.push(`OK: ${t.fragmentId} closing=${t.closing} ${t.variant}`);
  }
}

for (const [filePath, bundle] of fileBundles) {
  fs.writeFileSync(filePath, `${JSON.stringify(bundle, null, 2)}\n`);
}

console.log(`Applied: ${applied}`);
console.log(`Already applied: ${alreadyApplied}`);
console.log(`Not found / miss: ${notFound}`);
console.log(`Files written: ${fileBundles.size}`);
for (const s of summary) console.log(`  ${s}`);
