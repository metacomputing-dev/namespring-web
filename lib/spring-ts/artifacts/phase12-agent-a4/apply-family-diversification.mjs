#!/usr/bin/env node
/**
 * P12-A4 Commit 1: Diversify shared closings in family/expert fragments.
 *
 * Strategy: per (cell, shared-suffix) pair, rewrite the closing text token
 * value in 2-3 fragments with alternative phrasings that preserve meaning
 * and tag structure. Skip wildcard.001 (intentional floor template).
 *
 * Three suffix variants per shared closing keep meaning + tag structure:
 *   - "신호가 보이는 시기엔 가족 안의 작은 부딪힘을 짧게 끊고 가는 호흡이 잘 어울려요."
 *     -> Variant A: "이 함께 자리한 시기에는 말의 속도를 한 박자 늦추고 가족 분위기를 천천히 다듬는 호흡이 잘 어울려요."
 *     -> Variant B: "의 신호가 짙어지는 자리에서는 짧게 거리를 두고 다음 대화로 넘어가는 페이스가 가족 자리를 지켜 줘요."
 *
 *   - "의 자리가 함께 보이는 사주는 가족 안에서 부드럽게 도움 주고받는 흐름이 자기 자산이 되는 모양이에요."
 *     -> Variant A: "의 흐름이 함께 자리한 사주는 가족 안에서 오가는 따뜻한 한 마디가 평생의 자산으로 쌓이는 모양이에요."
 *     -> Variant B: "이 함께 보이는 자리는 가까운 가족과 주고받는 작은 챙김이 자기 흐름을 든든하게 받쳐 주는 모양이에요."
 *
 *   - "의 결이 어떻게 받쳐 주느냐를 함께 살펴 두면 흐름의 결정이 더 단단해지고, 작은 인사 한 마디가 평생의 자산이 되는 자리예요."
 *     -> Variant A: "이 흐름을 어떻게 이어 주는지 함께 살펴 두면 결정이 한층 또렷해지고, 평소 건네는 인사가 오래 남는 자리예요."
 *     -> Variant B: "의 자리가 어떻게 받쳐 주는지 함께 봐 두면 흐름이 한층 든든해지고, 다정한 한 마디가 깊은 인연으로 남는 자리예요."
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const ORIGINAL_SAMHYEONG_HYEONGSAL =
  '의 신호가 보이는 시기엔 가족 안의 작은 부딪힘을 짧게 끊고 가는 호흡이 잘 어울려요.';
const VARIANT_A_SAMHYEONG_HYEONGSAL =
  '이 함께 자리한 시기에는 말의 속도를 한 박자 늦추고 가족 분위기를 천천히 다듬는 호흡이 잘 어울려요.';
const VARIANT_B_SAMHYEONG_HYEONGSAL =
  '의 신호가 짙어지는 자리에서는 짧게 거리를 두고 다음 대화로 넘어가는 페이스가 가족 자리를 지켜 줘요.';

const ORIGINAL_CHEON_WOL =
  '의 자리가 함께 보이는 사주는 가족 안에서 부드럽게 도움 주고받는 흐름이 자기 자산이 되는 모양이에요.';
const VARIANT_A_CHEON_WOL =
  '의 흐름이 함께 자리한 사주는 가족 안에서 오가는 따뜻한 한 마디가 평생의 자산으로 쌓이는 모양이에요.';
const VARIANT_B_CHEON_WOL =
  '이 함께 보이는 자리는 가까운 가족과 주고받는 작은 챙김이 자기 흐름을 든든하게 받쳐 주는 모양이에요.';

const ORIGINAL_BUMOGUNG_JOSANG =
  '의 결이 어떻게 받쳐 주느냐를 함께 살펴 두면 흐름의 결정이 더 단단해지고, 작은 인사 한 마디가 평생의 자산이 되는 자리예요.';
const VARIANT_A_BUMOGUNG_JOSANG =
  '이 흐름을 어떻게 이어 주는지 함께 살펴 두면 결정이 한층 또렷해지고, 평소 건네는 인사가 오래 남는 자리예요.';
const VARIANT_B_BUMOGUNG_JOSANG =
  '의 자리가 어떻게 받쳐 주는지 함께 봐 두면 흐름이 한층 든든해지고, 다정한 한 마디가 깊은 인연으로 남는 자리예요.';

const TARGETS = [
  // === family.life.expert ===
  // samhyeong/hyeongsal: 4 fragments use it (no wildcard hit). Rewrite 2.
  ['data/narrative/family/life/expert.fragments.json', 'family.life.expert.jeongin_strong.002', ORIGINAL_SAMHYEONG_HYEONGSAL, VARIANT_A_SAMHYEONG_HYEONGSAL],
  ['data/narrative/family/life/expert.fragments.json', 'family.life.expert.pyeonin_independent.003', ORIGINAL_SAMHYEONG_HYEONGSAL, VARIANT_B_SAMHYEONG_HYEONGSAL],
  // cheondeok/woldeok: 5 fragments. Rewrite 2.
  ['data/narrative/family/life/expert.fragments.json', 'family.life.expert.weak_supported.006', ORIGINAL_CHEON_WOL, VARIANT_A_CHEON_WOL],
  ['data/narrative/family/life/expert.fragments.json', 'family.life.expert.elder_legacy.010', ORIGINAL_CHEON_WOL, VARIANT_B_CHEON_WOL],
  // bumyong/jojangung: 5 fragments incl. wildcard. Rewrite 2 non-wildcard.
  ['data/narrative/family/life/expert.fragments.json', 'family.life.expert.pyeonin_independent.003', ORIGINAL_BUMOGUNG_JOSANG, VARIANT_A_BUMOGUNG_JOSANG],
  ['data/narrative/family/life/expert.fragments.json', 'family.life.expert.midage_balance.009', ORIGINAL_BUMOGUNG_JOSANG, VARIANT_B_BUMOGUNG_JOSANG],

  // === family.thisMonth.expert ===
  ['data/narrative/family/thisMonth/expert.fragments.json', 'family.thisMonth.expert.bumyong_focus.002', ORIGINAL_SAMHYEONG_HYEONGSAL, VARIANT_A_SAMHYEONG_HYEONGSAL],
  ['data/narrative/family/thisMonth/expert.fragments.json', 'family.thisMonth.expert.aligned_open.007', ORIGINAL_SAMHYEONG_HYEONGSAL, VARIANT_B_SAMHYEONG_HYEONGSAL],
  ['data/narrative/family/thisMonth/expert.fragments.json', 'family.thisMonth.expert.weak_supported.005', ORIGINAL_CHEON_WOL, VARIANT_A_CHEON_WOL],
  ['data/narrative/family/thisMonth/expert.fragments.json', 'family.thisMonth.expert.strong_giving.006', ORIGINAL_CHEON_WOL, VARIANT_B_CHEON_WOL],
  ['data/narrative/family/thisMonth/expert.fragments.json', 'family.thisMonth.expert.bumyong_focus.002', ORIGINAL_BUMOGUNG_JOSANG, VARIANT_A_BUMOGUNG_JOSANG],
  ['data/narrative/family/thisMonth/expert.fragments.json', 'family.thisMonth.expert.bigyeon_geobjae.004', ORIGINAL_BUMOGUNG_JOSANG, VARIANT_B_BUMOGUNG_JOSANG],

  // === family.thisWeek.expert ===
  ['data/narrative/family/thisWeek/expert.fragments.json', 'family.thisWeek.expert.bumyong_focus.002', ORIGINAL_SAMHYEONG_HYEONGSAL, VARIANT_A_SAMHYEONG_HYEONGSAL],
  ['data/narrative/family/thisWeek/expert.fragments.json', 'family.thisWeek.expert.aligned_open.007', ORIGINAL_SAMHYEONG_HYEONGSAL, VARIANT_B_SAMHYEONG_HYEONGSAL],
  ['data/narrative/family/thisWeek/expert.fragments.json', 'family.thisWeek.expert.weak_supported.005', ORIGINAL_CHEON_WOL, VARIANT_A_CHEON_WOL],
  ['data/narrative/family/thisWeek/expert.fragments.json', 'family.thisWeek.expert.strong_giving.006', ORIGINAL_CHEON_WOL, VARIANT_B_CHEON_WOL],
  ['data/narrative/family/thisWeek/expert.fragments.json', 'family.thisWeek.expert.bigyeon_geobjae.004', ORIGINAL_BUMOGUNG_JOSANG, VARIANT_A_BUMOGUNG_JOSANG],
  ['data/narrative/family/thisWeek/expert.fragments.json', 'family.thisWeek.expert.young_caregiver.009', ORIGINAL_BUMOGUNG_JOSANG, VARIANT_B_BUMOGUNG_JOSANG],

  // === family.thisYear.expert ===
  ['data/narrative/family/thisYear/expert.fragments.json', 'family.thisYear.expert.jasik_focus.003', ORIGINAL_SAMHYEONG_HYEONGSAL, VARIANT_A_SAMHYEONG_HYEONGSAL],
  ['data/narrative/family/thisYear/expert.fragments.json', 'family.thisYear.expert.bigyeon_geobjae.004', ORIGINAL_SAMHYEONG_HYEONGSAL, VARIANT_B_SAMHYEONG_HYEONGSAL],
  ['data/narrative/family/thisYear/expert.fragments.json', 'family.thisYear.expert.strong_giving.006', ORIGINAL_CHEON_WOL, VARIANT_A_CHEON_WOL],
  ['data/narrative/family/thisYear/expert.fragments.json', 'family.thisYear.expert.elder_legacy.010', ORIGINAL_CHEON_WOL, VARIANT_B_CHEON_WOL],
  ['data/narrative/family/thisYear/expert.fragments.json', 'family.thisYear.expert.bumyong_focus.002', ORIGINAL_BUMOGUNG_JOSANG, VARIANT_A_BUMOGUNG_JOSANG],
  ['data/narrative/family/thisYear/expert.fragments.json', 'family.thisYear.expert.bigyeon_geobjae.004', ORIGINAL_BUMOGUNG_JOSANG, VARIANT_B_BUMOGUNG_JOSANG],

  // === family.today.expert ===
  ['data/narrative/family/today/expert.fragments.json', 'family.today.expert.bumyong_focus.002', ORIGINAL_SAMHYEONG_HYEONGSAL, VARIANT_A_SAMHYEONG_HYEONGSAL],
  ['data/narrative/family/today/expert.fragments.json', 'family.today.expert.weak_supported.005', ORIGINAL_SAMHYEONG_HYEONGSAL, VARIANT_B_SAMHYEONG_HYEONGSAL],
  ['data/narrative/family/today/expert.fragments.json', 'family.today.expert.bumyong_focus.002', ORIGINAL_CHEON_WOL, VARIANT_A_CHEON_WOL],
  ['data/narrative/family/today/expert.fragments.json', 'family.today.expert.bigyeon_geobjae.004', ORIGINAL_CHEON_WOL, VARIANT_B_CHEON_WOL],
  ['data/narrative/family/today/expert.fragments.json', 'family.today.expert.jasik_focus.003', ORIGINAL_BUMOGUNG_JOSANG, VARIANT_A_BUMOGUNG_JOSANG],
  ['data/narrative/family/today/expert.fragments.json', 'family.today.expert.strong_giving.006', ORIGINAL_BUMOGUNG_JOSANG, VARIANT_B_BUMOGUNG_JOSANG],
];

let applied = 0;
let notFound = 0;
let alreadyApplied = 0;
const summary = [];

// Cache: read each file once, mutate, write once
const fileBundles = new Map();

function getBundle(filePath) {
  if (!fileBundles.has(filePath)) {
    fileBundles.set(filePath, JSON.parse(fs.readFileSync(filePath, 'utf8')));
  }
  return fileBundles.get(filePath);
}

for (const [relFile, fragmentId, oldText, newText] of TARGETS) {
  const filePath = path.join(ROOT, relFile);
  const bundle = getBundle(filePath);
  const frag = (bundle.fragments || []).find((f) => f.fragmentId === fragmentId);
  if (!frag) {
    console.warn(`NOTFOUND: ${fragmentId}`);
    notFound += 1;
    continue;
  }
  // Find the text token whose value endsWith oldText (with optional trailing \n\n)
  let replaced = false;
  let alreadyHit = false;
  for (const tok of frag.templateTokens || []) {
    if (tok.kind !== 'text') continue;
    const v = tok.value || '';
    if (v.endsWith(newText) || v.endsWith(newText + '\n\n')) {
      alreadyHit = true;
      break;
    }
    if (v.endsWith(oldText + '\n\n')) {
      tok.value = v.slice(0, v.length - oldText.length - 2) + newText + '\n\n';
      replaced = true;
      break;
    }
    if (v.endsWith(oldText)) {
      tok.value = v.slice(0, v.length - oldText.length) + newText;
      replaced = true;
      break;
    }
  }
  if (alreadyHit) {
    alreadyApplied += 1;
    summary.push(`ALREADY: ${fragmentId}`);
    continue;
  }
  if (!replaced) {
    console.warn(`MISS: ${fragmentId} (oldText not found in any text token suffix)`);
    notFound += 1;
    continue;
  }
  applied += 1;
  summary.push(`OK: ${fragmentId}`);
}

for (const [filePath, bundle] of fileBundles) {
  fs.writeFileSync(filePath, `${JSON.stringify(bundle, null, 2)}\n`);
}

console.log(`Applied: ${applied}`);
console.log(`Already applied: ${alreadyApplied}`);
console.log(`Not found / miss: ${notFound}`);
console.log(`Files written: ${fileBundles.size}`);
for (const s of summary) console.log(`  ${s}`);
