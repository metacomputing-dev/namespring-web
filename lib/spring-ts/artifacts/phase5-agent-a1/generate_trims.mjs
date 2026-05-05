#!/usr/bin/env node
// Generate auto-trim candidates for livingTips violations.
// Strategy:
//   1. For each unique violating tip, try every combination of three rule sets
//      (TAIL → MID → PREFIX) and pick the longest variant whose Hangul-syllable
//      length ≤ 24. (Longer = less information loss.)
//   2. If no variant fits, mark the tip as needsManual:true so a human can
//      hand-write a replacement in trims_manual.json.
//   3. Trims that are explicitly hand-written in trims_manual.json (keyed on
//      original tip) override any auto candidate.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const beforePath = path.join(__dirname, 'before.json');
const manualPath = path.join(__dirname, 'trims_manual.json');

function koLen(s) {
  let n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xAC00 && cp <= 0xD7A3) n++;
  }
  return n;
}

// Tail rules: applied to the *end* of the tip, just before the trailing period.
const TAIL_RULES = [
  // soften "~하는 편이 좋습니다 / 좋아요" -> "~면 좋아요."
  [/(는|은|인|한)\s*편이\s*좋습니다\.?$/u, '면 좋아요.'],
  [/(는|은|인|한)\s*편이\s*좋아요\.?$/u, '면 좋아요.'],
  [/(는|은|인)\s*식이\s*좋습니다\.?$/u, '식이 좋아요.'],
  [/(는|은|인)\s*방식이\s*좋습니다\.?$/u, '방식이 좋아요.'],
  [/하는\s*편이\s*좋아요\.?$/u, '면 좋아요.'],
  [/하는\s*편이\s*좋습니다\.?$/u, '면 좋아요.'],
  [/하는\s*것이\s*좋습니다\.?$/u, '면 좋아요.'],
  [/하는\s*것이\s*좋아요\.?$/u, '면 좋아요.'],
  [/(는|을|를)\s*수\s*있어요\.?$/u, '면 돼요.'],
  [/이\s*안정됩니다\.?$/u, '이 안정돼요.'],
  [/도움이\s*됩니다\.?$/u, '도움돼요.'],
  [/줄일\s*수\s*있어요\.?$/u, '줄여요.'],
  [/(?:줄|늘)어듭니다\.?$/u, '줄어요.'],
  [/만들어\s*보세요\.?$/u, '만들어요.'],
  // specific verb endings (~해 보세요, ~정해 보세요 etc.)
  [/해\s*보세요\.?$/u, '해요.'],
  [/적어\s*보세요\.?$/u, '적어요.'],
  [/적어보세요\.?$/u, '적어요.'],
  [/정해\s*보세요\.?$/u, '정해요.'],
  [/정해보세요\.?$/u, '정해요.'],
  [/말해\s*보세요\.?$/u, '말해요.'],
  [/말해보세요\.?$/u, '말해요.'],
  [/물어\s*보세요\.?$/u, '물어요.'],
  [/물어보세요\.?$/u, '물어요.'],
  [/넣어\s*보세요\.?$/u, '넣어요.'],
  [/넣어보세요\.?$/u, '넣어요.'],
  [/잡아\s*보세요\.?$/u, '잡아요.'],
  [/잡아보세요\.?$/u, '잡아요.'],
  [/살펴\s*보세요\.?$/u, '살펴요.'],
  [/살펴보세요\.?$/u, '살펴요.'],
  [/올려\s*보세요\.?$/u, '올려요.'],
  [/내려\s*보세요\.?$/u, '내려요.'],
  [/맞춰\s*보세요\.?$/u, '맞춰요.'],
  [/맞춰보세요\.?$/u, '맞춰요.'],
  [/지켜\s*보세요\.?$/u, '지켜요.'],
  [/꺼내\s*보세요\.?$/u, '꺼내요.'],
  [/배치해\s*보세요\.?$/u, '배치해요.'],
  [/조정해\s*보세요\.?$/u, '조정해요.'],
  [/시도해\s*보세요\.?$/u, '시도해요.'],
  [/연결해\s*보세요\.?$/u, '연결해요.'],
  [/공유해\s*보세요\.?$/u, '공유해요.'],
  [/제안해\s*보세요\.?$/u, '제안해요.'],
  [/구분해\s*보세요\.?$/u, '구분해요.'],
  [/표현해\s*보세요\.?$/u, '표현해요.'],
  [/대신해\s*보세요\.?$/u, '대신해요.'],
  [/포함해\s*보세요\.?$/u, '포함해요.'],
  [/실행해\s*보세요\.?$/u, '실행해요.'],
  [/이야기해\s*보세요\.?$/u, '이야기해요.'],
  [/표시해\s*보세요\.?$/u, '표시해요.'],
  [/(나누어|나누|나눠)\s*보세요\.?$/u, '나눠요.'],
  [/풀어\s*보세요\.?$/u, '풀어요.'],
  [/(읽어|들어|걸어|뛰어|가)\s*보세요\.?$/u, '$1요.'],
  [/(챙겨|버려|남겨)\s*(?:두|보)세요\.?$/u, '$1요.'],
  [/(?:해|하)\s*주세요\.?$/u, '해 줘요.'],
  // 광범위한 ~해 보세요 제거
  [/(\S)해\s*보세요\.?$/u, '$1해요.'],
  // ~어/아/려/여/겨/워/춰/켜/줘/내/태/져 + 보세요
  [/(\S)어\s*보세요\.?$/u, '$1어요.'],
  [/(\S)아\s*보세요\.?$/u, '$1아요.'],
  [/(\S)려\s*보세요\.?$/u, '$1려요.'],
  [/(\S)여\s*보세요\.?$/u, '$1여요.'],
  [/(\S)겨\s*보세요\.?$/u, '$1겨요.'],
  [/(\S)워\s*보세요\.?$/u, '$1워요.'],
  [/(\S)춰\s*보세요\.?$/u, '$1춰요.'],
  [/(\S)켜\s*보세요\.?$/u, '$1켜요.'],
  [/(\S)줘\s*보세요\.?$/u, '$1줘요.'],
  [/(\S)내\s*보세요\.?$/u, '$1내요.'],
  [/(\S)태\s*보세요\.?$/u, '$1태요.'],
  [/(\S)져\s*보세요\.?$/u, '$1져요.'],
  // 마지막 ~보세요 fallback
  [/\s+보세요\.?$/u, ' 봐요.'],
  // ~하세요 / ~만드세요 family
  [/만드세요\.?$/u, '만들어요.'],
  [/만드십시오\.?$/u, '만들어요.'],
  [/(찾|쥐)으세요\.?$/u, '$1어요.'],
  [/(맞)추세요\.?$/u, '$1춰요.'],
  [/(가|오|놓|쓰|두|타|사)세요\.?$/u, '$1요.'],
  [/(짜|짚)세요\.?$/u, '$1요.'],
  [/(가져|적|살펴|돌아|되돌|놔)두세요\.?$/u, '$1요.'],
  [/(써|키워|버려|놓아|남겨)\s*두세요\.?$/u, '$1요.'],
  [/넣어두세요\.?$/u, '넣어요.'],
  [/넣어\s*두세요\.?$/u, '넣어요.'],
  [/넣으세요\.?$/u, '넣어요.'],
  [/비워두세요\.?$/u, '비워요.'],
  [/비워\s*두세요\.?$/u, '비워요.'],
  [/맞춰두세요\.?$/u, '맞춰요.'],
  [/맞춰\s*두세요\.?$/u, '맞춰요.'],
  [/표시해\s*두세요\.?$/u, '표시해요.'],
  [/적어\s*두세요\.?$/u, '적어요.'],
  [/정해\s*두세요\.?$/u, '정해요.'],
  [/세워\s*두세요\.?$/u, '세워요.'],
  [/(가지|채우|채|지키|지|줄이|줄|줄여|만나)세요\.?$/u, '$1요.'],
  [/하세요\.?$/u, '해요.'],
  [/(좋|쉬)습니다\.?$/u, '$1워요.'],
  [/입니다\.?$/u, '이에요.'],
  [/줄어듭니다\.?$/u, '줄어요.'],
  [/늘어납니다\.?$/u, '늘어나요.'],
];

const MID_RULES = [
  // shorten verbose connectors
  [/하기보다는\s+/g, ' '],
  [/하기보다\s+/g, ' '],
  [/기보다는\s+/g, ' '],
  [/기보다\s+/g, ' '],
  [/처럼\s+/g, ' '],
  [/매일\s+비슷하게\s*/g, '매일 '],
  [/처음부터\s+/g, ''],
  [/한\s*번에\s+/g, ''],
  [/하나씩\s+/g, ''],
  [/잘\s+(되는|풀리는)\s+/g, '$1 '],
  [/시간대를\s+찾아\s+그\s+시간에는\s+/g, '시간대에 '],
  // drop polite/filler adverbs that don't change semantics meaningfully
  [/\s먼저\s/g, ' '],
  [/\s바로\s/g, ' '],
  [/\s꼭\s/g, ' '],
  [/\s미리\s/g, ' '],
  [/\s같이\s/g, ' '],
  [/\s한\s*번\s/g, ' '],
  [/\s여러\s*번\s/g, ' '],
  [/\s천천히\s/g, ' '],
  [/\s조금씩\s/g, ' '],
  [/\s작게\s/g, ' '],
  [/\s구체적으로\s/g, ' '],
  [/\s짧게\s/g, ' '],
  [/\s함께\s/g, ' '],
  [/\s대신\s/g, ' '],
];

const PREFIX_RULES = [
  [/^오늘은\s+/u, ''],
  [/^이번\s*주(에는|는)\s+/u, '주중 '],
  [/^이번\s*달(에는|은)\s+/u, '월간 '],
  [/^이번\s*해(에는|는)\s+/u, '올해 '],
  [/^올해는\s+/u, '올해 '],
  [/^올해\s+(에는|은)\s+/u, '올해 '],
  [/^커리어와\s+관계의\s+선택은\s+/u, '선택은 '],
  [/^한\s*달\s+(일정에서\s+)?/u, '월간 '],
  [/^월간\s*목표를\s+/u, '월 목표는 '],
  [/^새\s*경험을\s+할\s*때는\s+/u, '새 경험은 '],
  [/^새로운\s+/u, '새 '],
  [/^중요한\s+/u, ''],
  [/^반복되는\s+/u, '반복 '],
  [/^가까운\s+관계에서는\s+/u, '가까운 관계 '],
  [/^커리어와\s+관계의\s+/u, ''],
];

function applyTail(s) {
  for (const [re, to] of TAIL_RULES) {
    const t = s.replace(re, to);
    if (t !== s) return t;
  }
  return s;
}
function applyMid(s) {
  let cur = s;
  for (const [re, to] of MID_RULES) cur = cur.replace(re, to);
  return cur;
}
function applyPrefix(s) {
  let cur = s;
  for (const [re, to] of PREFIX_RULES) cur = cur.replace(re, to);
  return cur;
}
function normalize(s) {
  return s.replace(/\s+/g, ' ').replace(/\s+\./g, '.').replace(/\.{2,}/g, '.').trim();
}

function autoTrim(orig) {
  const variants = [];
  const tail = applyTail(orig);
  const mid = applyMid(orig);
  const tailMid = applyMid(tail);
  const pre = applyPrefix(orig);
  const tailPre = applyPrefix(tail);
  const midPre = applyPrefix(mid);
  const all = applyPrefix(applyMid(tail));
  for (const cand of [tail, mid, pre, tailMid, tailPre, midPre, all]) {
    if (cand && cand !== orig) variants.push(normalize(cand));
  }
  const seen = new Set();
  const uniq = [];
  for (const v of variants) {
    if (!seen.has(v)) { seen.add(v); uniq.push(v); }
  }
  const within = uniq.filter((v) => koLen(v) <= 24);
  if (within.length === 0) return null;
  // prefer the variant that retains the most characters (least info loss)
  within.sort((a, b) => koLen(b) - koLen(a));
  return within[0];
}

const before = JSON.parse(fs.readFileSync(beforePath, 'utf8'));
const map = new Map();
for (const v of before.violations) {
  if (!map.has(v.tip)) map.set(v.tip, []);
  map.get(v.tip).push(v);
}

let manualOverrides = {};
if (fs.existsSync(manualPath)) {
  const m = JSON.parse(fs.readFileSync(manualPath, 'utf8'));
  manualOverrides = m.replacements ?? m;
  console.log(`Loaded ${Object.keys(manualOverrides).length} manual overrides`);
}

const trims = [];
let auto = 0, manualUsed = 0, needsManual = 0, badManual = 0;
for (const [tip, occurrences] of map) {
  let replacement = null;
  let kind = 'manual-needed';
  if (Object.prototype.hasOwnProperty.call(manualOverrides, tip)) {
    replacement = manualOverrides[tip];
    if (typeof replacement === 'string' && koLen(replacement) <= 24) {
      kind = 'manual';
      manualUsed++;
    } else {
      kind = 'manual-bad';
      badManual++;
    }
  } else {
    const r = autoTrim(tip);
    if (r) {
      replacement = r;
      kind = 'auto';
      auto++;
    } else {
      needsManual++;
    }
  }
  trims.push({
    original: tip,
    originalLen: koLen(tip),
    replacement,
    replacementLen: replacement ? koLen(replacement) : null,
    occurrences: occurrences.length,
    kind,
    needsManual: kind === 'manual-needed' || kind === 'manual-bad',
  });
}

trims.sort((a, b) => (a.needsManual === b.needsManual ? a.originalLen - b.originalLen : (a.needsManual ? 1 : -1)));

const outPath = path.join(__dirname, 'trims.json');
fs.writeFileSync(outPath, JSON.stringify({
  summary: {
    unique: map.size,
    auto,
    manual: manualUsed,
    badManual,
    needsManual,
    totalOccurrences: before.violations.length,
  },
  trims,
}, null, 2) + '\n', 'utf8');
console.log(`unique violations    : ${map.size}`);
console.log(`auto-trimmed         : ${auto}`);
console.log(`manual-applied       : ${manualUsed}`);
console.log(`manual-overlong (bad): ${badManual}`);
console.log(`needs manual (open)  : ${needsManual}`);
console.log(`wrote ${outPath}`);
