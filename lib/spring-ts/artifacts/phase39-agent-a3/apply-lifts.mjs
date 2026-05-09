// Phase 39 Agent A3 -- apply 4p->5p lifts (append-P5 mode) to 7 fragments.
// SURGICAL TEXT EDIT: locates each fragment by id, locates its templateTokens
// "kind":"text" "value":"..." pair, and rewrites ONLY the value string,
// preserving original line-endings, indentation, and JSON layout.
//
// Combo: 4 ct=1 + 3 ct=2 = 4 + 6 = 10 cell delta (target +10).
// 7 fragments selected from a 5 ct=1 + 12 ct=2 pool. The 4-of-5 ct=1
// utilization keeps 1 ct=1 buffer; the 3-of-12 ct=2 keeps 9 ct=2 buffer
// for P40+.
//
// Run from lib/spring-ts root: `node artifacts/phase39-agent-a3/apply-lifts.mjs`
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');

const LIFTS = [
  // === ct=1 (4) ===
  {
    file: 'expression_children/life/standard.fragments.json',
    fragmentId: 'expression_children.life.standard.40_54.006',
    p5: '비유하자면 평생의 자리는 오래된 정원의 잘 자란 큰 나무 한 그루 같아요. 가지 끝에 매달린 새 잎 하나하나에 욕심 내지 않아도, 큰 그늘이 곁의 작은 화초들을 자기 자리에서 자라게 받쳐 줘요.',
  },
  {
    file: 'expression_children/thisMonth/standard.fragments.json',
    fragmentId: 'expression_children.thisMonth.standard.55_69.007',
    p5: '이번 달의 자리에서 하나의 자취가 곁에 따뜻하게 남는다면 그것으로 충분해요. 다음 세대가 자기 자리에서 자라는 모습을 멀리서 또렷하게 받쳐 보는 시간이 자기에게도 좋은 한 달의 토양이 되어 줘요.',
  },
  {
    file: 'family/thisWeek/standard.fragments.json',
    fragmentId: 'family.thisWeek.standard.senior.007',
    p5: '자기 자리에서 큰 변화를 만들려 애쓰지 않아도 충분히 따뜻한 한 주예요. 가까운 사람에게 짧은 안부 한 줄, 같은 자리에서 한 끼 함께한 시간 한 자리, 그 작은 자취가 한 주의 가장 단단한 자취로 남아 줘요.',
  },
  {
    file: 'health/life/standard.fragments.json',
    fragmentId: 'health.life.standard.teen.001',
    p5: '비유하자면 평생의 컨디션은 매일 한 알씩 심어 두는 잔뿌리 씨앗 같아요. 한 학기 한 자리에서 큰 변화를 만들려 하지 않아도, 매일 잔뿌리 한 줄씩 자라난 자취가 자기 평생의 단단한 자리를 받쳐 주는 토양이 되어요.',
  },
  // === ct=2 (3) ===
  {
    file: 'movement/life/standard.fragments.json',
    fragmentId: 'movement.life.standard.30_39.005',
    p5: '30대의 큰 이동은 자기 한 사람만의 자리가 아닌 가까운 사람의 자리도 함께 움직이는 시간이에요. 자기 페이스만 빠르지 않게 가족·동료의 호흡과 한 박자 맞추는 자리가, 30대의 변화를 자기 자리에서 단단하게 받쳐 줘요.',
  },
  {
    file: 'overall/thisYear/standard.fragments.json',
    fragmentId: 'overall.thisYear.standard.balanced.neutral.008',
    p5: '비유하자면 잔잔한 한 해는 호수의 깊이가 천천히 자라는 시간이에요. 큰 파동이 적은 한 해 동안 자기 페이스의 깊이가 한 자리에서 천천히 자라나, 다음 해의 큰 자극에도 자기를 또렷하게 받쳐 줄 토양이 되어요.',
  },
  {
    file: 'overall/today/standard.fragments.json',
    fragmentId: 'overall.today.standard.balanced.neutral.008',
    p5: '오늘 하루의 끝에 한 줄로 좋았던 자취·아쉬웠던 자취를 짧게 적어 두면 좋아요. 한 줄씩 모인 며칠이 자기 페이스의 작은 지도가 되어, 다음 며칠의 자기 자리를 가벼운 손길로 받쳐 줘요.',
  },
];

const byFile = new Map();
for (const lift of LIFTS) {
  if (!byFile.has(lift.file)) byFile.set(lift.file, []);
  byFile.get(lift.file).push(lift);
}

function jsonEscape(s) {
  return JSON.stringify(s);
}

function findValueRange(text, fragmentId) {
  const idAnchor = `"fragmentId": "${fragmentId}"`;
  let idIdx = text.indexOf(idAnchor);
  if (idIdx === -1) return null;
  const tplKey = '"templateTokens"';
  const tplIdx = text.indexOf(tplKey, idIdx);
  if (tplIdx === -1) return null;
  const valKey = '"value":';
  const valIdx = text.indexOf(valKey, tplIdx);
  if (valIdx === -1) return null;
  let i = valIdx + valKey.length;
  while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i++;
  if (text[i] !== '"') return null;
  const startQuote = i;
  i++;
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2;
      continue;
    }
    if (text[i] === '"') {
      const endQuote = i;
      return [startQuote, endQuote + 1, idIdx];
    }
    i++;
  }
  return null;
}

let totalLifts = 0;
let totalErrs = 0;

for (const [file, lifts] of byFile.entries()) {
  const filePath = path.join(NARRATIVE_DIR, file);
  let text = fs.readFileSync(filePath, 'utf-8');

  const liftsWithRange = [];
  for (const lift of lifts) {
    const range = findValueRange(text, lift.fragmentId);
    if (!range) {
      console.error(`MISSING value range for: ${lift.fragmentId} in ${file}`);
      totalErrs++;
      continue;
    }
    liftsWithRange.push({ lift, range });
  }
  liftsWithRange.sort((a, b) => b.range[2] - a.range[2]);

  for (const { lift, range } of liftsWithRange) {
    const [s, e] = range;
    const oldLiteral = text.slice(s, e);
    const oldValue = JSON.parse(oldLiteral);
    const oldParas = oldValue.split('\n\n').filter((p) => p.trim().length > 0);
    if (oldParas.length !== 4) {
      console.error(`NOT 4p (got ${oldParas.length}): ${lift.fragmentId}`);
      totalErrs++;
      continue;
    }
    if (lift.p5.includes('흐름이')) {
      console.error(`P5 contains 흐름이: ${lift.fragmentId}`);
      totalErrs++;
      continue;
    }
    const gyeolCount = (lift.p5.match(/결/g) || []).length;
    if (gyeolCount > 1) {
      console.error(`P5 has ${gyeolCount} 결 (>1, audit discipline): ${lift.fragmentId}`);
      totalErrs++;
      continue;
    }
    if (lift.p5.length < 100 || lift.p5.length > 150) {
      console.error(`P5 length ${lift.p5.length} out of [100..150]: ${lift.fragmentId}`);
      totalErrs++;
      continue;
    }

    const newValue = oldValue + '\n\n' + lift.p5;
    const newLiteral = jsonEscape(newValue);
    text = text.slice(0, s) + newLiteral + text.slice(e);
    totalLifts++;
    console.log(
      `lifted ${lift.fragmentId}  (P5 len=${lift.p5.length}, paras: ${oldParas.length}->${oldParas.length + 1})`
    );
  }

  fs.writeFileSync(filePath, text, 'utf-8');
}

console.log('');
console.log(`Total lifts applied: ${totalLifts}/${LIFTS.length}, errors: ${totalErrs}`);
if (totalErrs > 0) process.exit(1);
