#!/usr/bin/env node
/**
 * P12-A4 Commit 3: Diversify shared closings in health/expert and
 * movement/expert fragments.
 *
 * Closings:
 *   1. Health johu (single-token suffix):
 *      "의 균형이 컨디션을 만드는 가장 큰 축이라, 계절의 결을 따라 자기 페이스를 맞춰 두는 호흡이 잘 어울려요."
 *      Variant A: "의 흐름이 컨디션의 큰 축을 잡아 주는 자리라, 계절의 결을 따라 자기 페이스를 천천히 맞춰 두는 호흡이 잘 어울려요."
 *      Variant B: "의 균형이 자기 컨디션을 받쳐 주는 가장 큰 축이라, 계절 흐름에 맞추어 천천히 페이스를 다듬어 두면 좋아요."
 *
 *   2. Health 지살/천의 (paired):
 *      first: "의 결이 보일 때는 잠깐의 환경 변화가 컨디션을 환기시키고, "
 *      tail:  "의 자리는 의료·치유 흐름의 도움을 부드럽게 받게 해 줘요."
 *      Variant A first: "의 신호가 보일 때는 잠시 환경을 바꿔 주는 자극이 컨디션에 새 호흡을 더해 주고, "
 *      Variant A tail:  "의 자리가 의료·치유 흐름의 도움을 천천히 흘려 보내 줘요."
 *      Variant B first: "의 결이 자리할 때는 짧은 외출이 자기 컨디션을 부드럽게 환기시키고, "
 *      Variant B tail:  "의 자리는 가까운 회복 흐름이 다정하게 닿아 주는 결을 만들어 줘요."
 *
 *   3. Movement 지살/천이궁 (single-token tail; first text "의 신호와 " too short to vary):
 *      tail: "의 결을 함께 살펴 두면 이동의 결이 어디로 이어질지 한층 또렷해져요."
 *      Variant A: "의 결을 함께 봐 두면 이동의 길이 어떻게 펼쳐질지 한층 또렷해져요."
 *      Variant B: "의 자리를 함께 짚어 두면 다음 동선이 어떤 결로 이어질지 한층 분명해져요."
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// Health johu single-token suffix
const ORIG_JOHU = '의 균형이 컨디션을 만드는 가장 큰 축이라, 계절의 결을 따라 자기 페이스를 맞춰 두는 호흡이 잘 어울려요.';
const A_JOHU = '의 흐름이 컨디션의 큰 축을 잡아 주는 자리라, 계절의 결을 따라 자기 페이스를 천천히 맞춰 두는 호흡이 잘 어울려요.';
const B_JOHU = '의 균형이 자기 컨디션을 받쳐 주는 가장 큰 축이라, 계절 흐름에 맞추어 천천히 페이스를 다듬어 두면 좋아요.';

// Health 지살/천의 paired
const ORIG_JISAL_FIRST = '의 결이 보일 때는 잠깐의 환경 변화가 컨디션을 환기시키고, ';
const ORIG_CHEONUI_TAIL = '의 자리는 의료·치유 흐름의 도움을 부드럽게 받게 해 줘요.';
const A_JISAL_FIRST = '의 신호가 보일 때는 잠시 환경을 바꿔 주는 자극이 컨디션에 새 호흡을 더해 주고, ';
const A_CHEONUI_TAIL = '의 자리가 의료·치유 흐름의 도움을 천천히 흘려 보내 줘요.';
const B_JISAL_FIRST = '의 결이 자리할 때는 짧은 외출이 자기 컨디션을 부드럽게 환기시키고, ';
const B_CHEONUI_TAIL = '의 자리는 가까운 회복 흐름이 다정하게 닿아 주는 결을 만들어 줘요.';

// Movement 지살/천이궁 single-token tail
const ORIG_MOVEMENT = '의 결을 함께 살펴 두면 이동의 결이 어디로 이어질지 한층 또렷해져요.';
const A_MOVEMENT = '의 결을 함께 봐 두면 이동의 길이 어떻게 펼쳐질지 한층 또렷해져요.';
const B_MOVEMENT = '의 자리를 함께 짚어 두면 다음 동선이 어떤 결로 이어질지 한층 분명해져요.';

const CLOSING_DEFS = {
  johu: {
    A: { tailOnly: true, tailOld: ORIG_JOHU, tailNew: A_JOHU },
    B: { tailOnly: true, tailOld: ORIG_JOHU, tailNew: B_JOHU },
  },
  jisalCheonui: {
    A: { firstOld: ORIG_JISAL_FIRST, firstNew: A_JISAL_FIRST, tailOld: ORIG_CHEONUI_TAIL, tailNew: A_CHEONUI_TAIL },
    B: { firstOld: ORIG_JISAL_FIRST, firstNew: B_JISAL_FIRST, tailOld: ORIG_CHEONUI_TAIL, tailNew: B_CHEONUI_TAIL },
  },
  movement: {
    A: { tailOnly: true, tailOld: ORIG_MOVEMENT, tailNew: A_MOVEMENT },
    B: { tailOnly: true, tailOld: ORIG_MOVEMENT, tailNew: B_MOVEMENT },
  },
};

const TARGETS = [
  // === Health johu (3-13 fragments per period). Skip floor/wildcard. ===
  // health.life.expert (only 1 hit — too few to diversify; skip unless period stays static)
  // Targets per period: pick 2 non-floor fragments
  { fragmentId: 'health.thisYear.expert.age.late_30s.501', closing: 'johu', variant: 'A' },
  { fragmentId: 'health.thisYear.expert.daymaster.metal.yongshin.metal.401', closing: 'johu', variant: 'B' },
  { fragmentId: 'health.today.expert.age.early_20s.501', closing: 'johu', variant: 'A' },
  { fragmentId: 'health.today.expert.recovery.501', closing: 'johu', variant: 'B' },
  { fragmentId: 'health.thisWeek.expert.recovery.401', closing: 'johu', variant: 'A' },
  { fragmentId: 'health.thisWeek.expert.johu.501', closing: 'johu', variant: 'B' },
  { fragmentId: 'health.thisMonth.expert.recovery.401', closing: 'johu', variant: 'A' },
  { fragmentId: 'health.thisMonth.expert.currentseason.autumn_winter.301', closing: 'johu', variant: 'B' },

  // === Health 지살/천의 paired (5-10 fragments per period). Skip floor/wildcard. ===
  { fragmentId: 'health.today.expert.recovery.401', closing: 'jisalCheonui', variant: 'A' },
  { fragmentId: 'health.today.expert.age.late_40s.601', closing: 'jisalCheonui', variant: 'B' },
  { fragmentId: 'health.thisWeek.expert.johu.501', closing: 'jisalCheonui', variant: 'A' },
  { fragmentId: 'health.thisWeek.expert.recovery.501', closing: 'jisalCheonui', variant: 'B' },
  { fragmentId: 'health.thisMonth.expert.daymaster.wood.yongshin.earth.401', closing: 'jisalCheonui', variant: 'A' },
  { fragmentId: 'health.thisMonth.expert.recovery.401', closing: 'jisalCheonui', variant: 'B' },
  { fragmentId: 'health.life.expert.balance.501', closing: 'jisalCheonui', variant: 'A' },
  { fragmentId: 'health.life.expert.recovery_root.504', closing: 'jisalCheonui', variant: 'B' },

  // === Movement (4-12 fragments per period) ===
  { fragmentId: 'movement.today.expert.0_9.002', closing: 'movement', variant: 'A' },
  { fragmentId: 'movement.today.expert.daymaster.metal.yongshin.metal.401', closing: 'movement', variant: 'B' },
  { fragmentId: 'movement.thisWeek.expert.weak_neutral.010', closing: 'movement', variant: 'A' },
  { fragmentId: 'movement.thisWeek.expert.expansion.501', closing: 'movement', variant: 'B' },
  { fragmentId: 'movement.thisMonth.expert.55_69.007', closing: 'movement', variant: 'A' },
  { fragmentId: 'movement.thisMonth.expert.70plus.008', closing: 'movement', variant: 'B' },
  { fragmentId: 'movement.thisYear.expert.year.501', closing: 'movement', variant: 'A' },
  { fragmentId: 'movement.thisYear.expert.direction_score.504', closing: 'movement', variant: 'B' },
  { fragmentId: 'movement.life.expert.70plus.008', closing: 'movement', variant: 'A' },
  { fragmentId: 'movement.life.expert.yeokma.501', closing: 'movement', variant: 'B' },
];

// Build fragment index
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
    if (v.endsWith(newStr) || v.endsWith(newStr + '\n\n')) return 'already';
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
  for (const tok of tokens) {
    if (tok.kind !== 'text') continue;
    if (tok.value === oldStr) {
      tok.value = newStr;
      return true;
    }
  }
  return false;
}

let applied = 0;
let alreadyApplied = 0;
let notFound = 0;
const summary = [];

for (const t of TARGETS) {
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

for (const [filePath, bundle] of fileBundles) {
  fs.writeFileSync(filePath, `${JSON.stringify(bundle, null, 2)}\n`);
}

console.log(`Applied: ${applied}`);
console.log(`Already applied: ${alreadyApplied}`);
console.log(`Not found / miss: ${notFound}`);
console.log(`Files written: ${fileBundles.size}`);
for (const s of summary) console.log(`  ${s}`);
