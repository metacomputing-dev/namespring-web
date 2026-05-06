#!/usr/bin/env node
/**
 * P12-A4 Commit 4: Diversify shared closings in the 301 (currentseason +
 * agephase + ageband) fragments. These are the high-specificity fragments
 * that the engine selects for 27/32 fixtures (because they match
 * currentSeason + yongshinAlignment gating). Modifying them is the
 * empirically necessary step to actually move the fixtureCount=32 entries
 * out of the heatmap.
 *
 * Strategy: per same closing kind, alternate between Variant A and Variant B
 * across periods to maintain even diversification.
 *
 * Variants reuse the phrasings from earlier P12-A4 commits.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// === Variants from earlier commits ===
const ORIG_SAMHYEONG = '의 신호가 보이는 시기엔 가족 안의 작은 부딪힘을 짧게 끊고 가는 호흡이 잘 어울려요.';
const A_SAMHYEONG = '이 함께 자리한 시기에는 말의 속도를 한 박자 늦추고 가족 분위기를 천천히 다듬는 호흡이 잘 어울려요.';
const B_SAMHYEONG = '의 신호가 짙어지는 자리에서는 짧게 거리를 두고 다음 대화로 넘어가는 페이스가 가족 자리를 지켜 줘요.';

const ORIG_CHEON_WOL = '의 자리가 함께 보이는 사주는 가족 안에서 부드럽게 도움 주고받는 흐름이 자기 자산이 되는 모양이에요.';
const A_CHEON_WOL = '의 흐름이 함께 자리한 사주는 가족 안에서 오가는 따뜻한 한 마디가 평생의 자산으로 쌓이는 모양이에요.';
const B_CHEON_WOL = '이 함께 보이는 자리는 가까운 가족과 주고받는 작은 챙김이 자기 흐름을 든든하게 받쳐 주는 모양이에요.';

const ORIG_BUMYO = '의 결이 어떻게 받쳐 주느냐를 함께 살펴 두면 흐름의 결정이 더 단단해지고, 작은 인사 한 마디가 평생의 자산이 되는 자리예요.';
const A_BUMYO = '이 흐름을 어떻게 이어 주는지 함께 살펴 두면 결정이 한층 또렷해지고, 평소 건네는 인사가 오래 남는 자리예요.';
const B_BUMYO = '의 자리가 어떻게 받쳐 주는지 함께 봐 두면 흐름이 한층 든든해지고, 다정한 한 마디가 깊은 인연으로 남는 자리예요.';

// Overall 통관/병약 paired
const ORIG_TONG_FIRST = '의 결이 보이면 흐름의 막힌 자리를 풀어 주는 자리가 보이고, ';
const ORIG_BYEONG_TAIL = '의 자리가 함께 들어오면 약한 자리를 메우는 결이 함께 작동해요.';
const A_TONG_FIRST = '의 흐름이 들어오면 답답해진 자리를 한층 가볍게 풀어 주고, ';
const A_BYEONG_TAIL = '이 함께 자리하면 약한 자리를 천천히 채워 주는 결이 같이 작동해요.';
const B_TONG_FIRST = '의 결이 자리하면 한쪽으로 막힌 흐름을 부드럽게 살려 주고, ';
const B_BYEONG_TAIL = '의 흐름이 곁에 들어오면 모자란 자리를 자연스레 받쳐 주는 결이 함께 흘러요.';

// Overall 납음/납음오행 paired
const ORIG_NAPEUM_FIRST = '의 결을 함께 살펴 두면 사주 모양의 깊은 색이 더 또렷해지고, ';
const ORIG_NAEUM_TAIL = '의 흐름이 자기 결을 보완하는 자리가 자주 등장해요.';
const A_NAPEUM_FIRST = '의 흐름을 함께 들여다보면 사주가 띤 결의 깊이가 한층 또렷해지고, ';
const A_NAEUM_TAIL = '이 자기 흐름을 받쳐 주는 결이 자주 모습을 드러내요.';
const B_NAPEUM_FIRST = '의 자리를 함께 챙겨 두면 사주 모양의 색감이 한층 짙어지고, ';
const B_NAEUM_TAIL = '의 자리가 자기 결의 빈 곳을 채워 주는 흐름이 자주 보여요.';

// Academic 대운궁실/일진 single-token suffix
const ORIG_DAEWOON = '의 자리가 함께 살아나는 시기엔 평소 미뤄 둔 학습 한 단원을 매듭짓기에 좋은 흐름이 보여요.';
const A_DAEWOON = '이 함께 활기를 띠는 시기에는 그동안 미뤄 둔 학습 한 단원을 매듭지을 결이 자연스럽게 모여요.';
const B_DAEWOON = '의 흐름이 함께 살아날 때는 한 단원씩 차분히 매듭짓기 좋은 페이스가 자리 잡아요.';

// Health johu single-token
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

const CLOSINGS = {
  samhyeong: {
    A: { tailOnly: true, tailOld: ORIG_SAMHYEONG, tailNew: A_SAMHYEONG },
    B: { tailOnly: true, tailOld: ORIG_SAMHYEONG, tailNew: B_SAMHYEONG },
  },
  cheonWol: {
    A: { tailOnly: true, tailOld: ORIG_CHEON_WOL, tailNew: A_CHEON_WOL },
    B: { tailOnly: true, tailOld: ORIG_CHEON_WOL, tailNew: B_CHEON_WOL },
  },
  bumyo: {
    A: { tailOnly: true, tailOld: ORIG_BUMYO, tailNew: A_BUMYO },
    B: { tailOnly: true, tailOld: ORIG_BUMYO, tailNew: B_BUMYO },
  },
  tonggwanByeongyak: {
    A: { firstOld: ORIG_TONG_FIRST, firstNew: A_TONG_FIRST, tailOld: ORIG_BYEONG_TAIL, tailNew: A_BYEONG_TAIL },
    B: { firstOld: ORIG_TONG_FIRST, firstNew: B_TONG_FIRST, tailOld: ORIG_BYEONG_TAIL, tailNew: B_BYEONG_TAIL },
  },
  napeumNaeum: {
    A: { firstOld: ORIG_NAPEUM_FIRST, firstNew: A_NAPEUM_FIRST, tailOld: ORIG_NAEUM_TAIL, tailNew: A_NAEUM_TAIL },
    B: { firstOld: ORIG_NAPEUM_FIRST, firstNew: B_NAPEUM_FIRST, tailOld: ORIG_NAEUM_TAIL, tailNew: B_NAEUM_TAIL },
  },
  daewoonIljin: {
    A: { tailOnly: true, tailOld: ORIG_DAEWOON, tailNew: A_DAEWOON },
    B: { tailOnly: true, tailOld: ORIG_DAEWOON, tailNew: B_DAEWOON },
  },
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

// Targets: high-specificity 301 fragments (and similar selected by engine)
// Per cell, pick variant A or B alternating. Goal: knock fixtureCount=32
// entries off the heatmap.
const TARGETS = [
  // Family 301 fragments (currentseason)
  { fragmentId: 'family.life.expert.currentseason.spring_summer.301', closing: 'bumyo', variant: 'A' },
  { fragmentId: 'family.thisYear.expert.currentseason.autumn_winter.301', closing: 'bumyo', variant: 'B' },
  { fragmentId: 'family.today.expert.currentseason.spring_summer.301', closing: 'samhyeong', variant: 'A' },
  { fragmentId: 'family.today.expert.currentseason.autumn_winter.301', closing: 'cheonWol', variant: 'B' },
  { fragmentId: 'family.thisWeek.expert.currentseason.spring_summer.301', closing: 'cheonWol', variant: 'A' },
  { fragmentId: 'family.thisWeek.expert.currentseason.autumn_winter.301', closing: 'samhyeong', variant: 'B' },
  // family.thisWeek.expert.currentseason.autumn_winter.301 also has bumyo — apply too
  { fragmentId: 'family.thisWeek.expert.currentseason.autumn_winter.301', closing: 'bumyo', variant: 'A' },
  { fragmentId: 'family.thisMonth.expert.currentseason.spring_summer.301', closing: 'cheonWol', variant: 'B' },
  { fragmentId: 'family.thisMonth.expert.currentseason.autumn_winter.301', closing: 'samhyeong', variant: 'A' },

  // Academic 301 fragments
  { fragmentId: 'academic.thisMonth.expert.currentseason.spring_summer.301', closing: 'daewoonIljin', variant: 'A' },
  { fragmentId: 'academic.thisYear.expert.currentseason.autumn_winter.301', closing: 'daewoonIljin', variant: 'B' },
  { fragmentId: 'academic.today.expert.currentseason.autumn_winter.301', closing: 'daewoonIljin', variant: 'A' },
  { fragmentId: 'academic.today.expert.ageband.senior.301', closing: 'daewoonIljin', variant: 'B' },
  { fragmentId: 'academic.thisMonth.expert.ageband.child_teen.301', closing: 'daewoonIljin', variant: 'B' },

  // Overall 301 fragments
  { fragmentId: 'overall.life.expert.agephase.early_40s.301', closing: 'napeumNaeum', variant: 'A' },
  { fragmentId: 'overall.life.expert.agephase.late_60s.301', closing: 'tonggwanByeongyak', variant: 'A' },
  { fragmentId: 'overall.life.expert.agephase.70s.301', closing: 'tonggwanByeongyak', variant: 'B' },
  { fragmentId: 'overall.life.expert.agephase.80s.301', closing: 'napeumNaeum', variant: 'B' },
  { fragmentId: 'overall.life.expert.agephase.child_0_9.301', closing: 'napeumNaeum', variant: 'A' },
  { fragmentId: 'overall.life.expert.agephase.early_teen.301', closing: 'tonggwanByeongyak', variant: 'A' },
  { fragmentId: 'overall.life.expert.agephase.late_teen.301', closing: 'napeumNaeum', variant: 'B' },
  { fragmentId: 'overall.life.expert.agephase.late_20s.301', closing: 'tonggwanByeongyak', variant: 'B' },
  { fragmentId: 'overall.life.expert.agephase.early_30s.301', closing: 'tonggwanByeongyak', variant: 'A' },
  { fragmentId: 'overall.today.expert.currentseason.spring_summer.301', closing: 'napeumNaeum', variant: 'A' },
  { fragmentId: 'overall.today.expert.currentseason.spring_summer.301', closing: 'tonggwanByeongyak', variant: 'A' },
  { fragmentId: 'overall.today.expert.currentseason.autumn_winter.301', closing: 'napeumNaeum', variant: 'B' },
  { fragmentId: 'overall.thisWeek.expert.currentseason.spring_summer.301', closing: 'tonggwanByeongyak', variant: 'B' },
  { fragmentId: 'overall.thisMonth.expert.currentseason.spring_summer.301', closing: 'napeumNaeum', variant: 'A' },
  { fragmentId: 'overall.thisMonth.expert.currentseason.autumn_winter.301', closing: 'napeumNaeum', variant: 'B' },
  { fragmentId: 'overall.thisMonth.expert.currentseason.autumn_winter.301', closing: 'tonggwanByeongyak', variant: 'A' },
  { fragmentId: 'overall.thisYear.expert.currentseason.spring_summer.301', closing: 'napeumNaeum', variant: 'A' },
  { fragmentId: 'overall.thisYear.expert.currentseason.spring_summer.301', closing: 'tonggwanByeongyak', variant: 'B' },
  { fragmentId: 'overall.thisYear.expert.currentseason.autumn_winter.301', closing: 'napeumNaeum', variant: 'A' },

  // Health 301 fragments
  { fragmentId: 'health.life.expert.currentseason.spring_summer.301', closing: 'jisalCheonui', variant: 'A' },
  { fragmentId: 'health.thisYear.expert.currentseason.autumn_winter.301', closing: 'jisalCheonui', variant: 'B' },
  { fragmentId: 'health.today.expert.currentseason.spring_summer.301', closing: 'johu', variant: 'A' },
  { fragmentId: 'health.today.expert.currentseason.spring_summer.301', closing: 'jisalCheonui', variant: 'B' },
  { fragmentId: 'health.today.expert.currentseason.autumn_winter.301', closing: 'johu', variant: 'B' },
  { fragmentId: 'health.thisWeek.expert.currentseason.spring_summer.301', closing: 'johu', variant: 'A' },
  { fragmentId: 'health.thisWeek.expert.currentseason.autumn_winter.301', closing: 'johu', variant: 'B' },
  { fragmentId: 'health.thisWeek.expert.currentseason.autumn_winter.301', closing: 'jisalCheonui', variant: 'A' },
  { fragmentId: 'health.thisMonth.expert.currentseason.spring_summer.301', closing: 'johu', variant: 'A' },
  { fragmentId: 'health.thisMonth.expert.currentseason.autumn_winter.301', closing: 'jisalCheonui', variant: 'A' },

  // Movement 301 fragments
  { fragmentId: 'movement.life.expert.currentseason.spring_summer.301', closing: 'movement', variant: 'A' },
  { fragmentId: 'movement.thisYear.expert.currentseason.spring_summer.301', closing: 'movement', variant: 'B' },
  { fragmentId: 'movement.thisYear.expert.currentseason.autumn_winter.301', closing: 'movement', variant: 'A' },
  { fragmentId: 'movement.today.expert.currentseason.autumn_winter.301', closing: 'movement', variant: 'B' },
  { fragmentId: 'movement.thisMonth.expert.currentseason.spring_summer.301', closing: 'movement', variant: 'A' },
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

let applied = 0, alreadyApplied = 0, notFound = 0;
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
    notFound += 1;
    continue;
  }
  const def = CLOSINGS[t.closing][t.variant];
  let firstResult = true;
  if (!def.tailOnly) {
    firstResult = replaceInTokens(frag.templateTokens || [], def.firstOld, def.firstNew);
  }
  const tailResult = replaceInTokens(frag.templateTokens || [], def.tailOld, def.tailNew);
  if (firstResult === 'already' && tailResult === 'already') {
    alreadyApplied += 1;
    summary.push(`ALREADY: ${t.fragmentId} ${t.closing}/${t.variant}`);
    continue;
  }
  if (firstResult === false || tailResult === false) {
    console.warn(`MISS: ${t.fragmentId} ${t.closing}/${t.variant} firstResult=${firstResult} tailResult=${tailResult}`);
    notFound += 1;
    continue;
  }
  applied += 1;
  summary.push(`OK: ${t.fragmentId} ${t.closing}/${t.variant}`);
}

for (const [filePath, bundle] of fileBundles) {
  fs.writeFileSync(filePath, `${JSON.stringify(bundle, null, 2)}\n`);
}

console.log(`Applied: ${applied}`);
console.log(`Already applied: ${alreadyApplied}`);
console.log(`Not found / miss: ${notFound}`);
console.log(`Files written: ${fileBundles.size}`);
for (const s of summary) console.log(`  ${s}`);
