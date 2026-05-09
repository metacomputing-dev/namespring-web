// Phase 38 Agent A2 -- apply 4p->5p lifts (append-P5 mode) to 8 fragments.
// SURGICAL TEXT EDIT: locates each fragment by id, locates its templateTokens
// "kind":"text" "value":"..." pair, and rewrites ONLY the value string,
// preserving original line-endings, indentation, and JSON layout.
//
// Combo: 6 ct=1 + 2 ct=2 = 6 + 4 = 10 cell delta (target +10).
// Pool exhaustion deviation from P37-A2's ct=1-only lineage is required:
// ct=1 4p pool has only 7 candidates remaining (P37-A2 audit predicted),
// and 6/7 chosen here keeps a 1-id buffer for potential re-allocation.
//
// Run from lib/spring-ts root: `node artifacts/phase38-agent-a2/apply-lifts.mjs`
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');

const LIFTS = [
  // === ct=1 (6) ===
  {
    file: 'academic/today/standard.fragments.json',
    fragmentId: 'academic.today.standard.balanced.009',
    p5: '오늘 한 단원의 마무리 자리에 짧은 한 줄 점검 노트를 두면 좋아요. 무엇을 또렷이 알았고 어디가 모호한지 한 줄씩만 적어 두면, 내일 첫 걸음을 어디서 시작할지 자기 손으로 또렷이 잡혀요.',
  },
  {
    file: 'career/life/standard.fragments.json',
    fragmentId: 'career.life.standard.age10_19.006',
    p5: '한 학기에 한 번씩 좋아하는 활동·과목·체험을 한 줄로 짧게 적어 두는 노트를 만들어 두면 좋아요. 노트 한 권이 평생 자리에서 펼쳐 보면 자기 색을 또렷하게 받쳐 주는 작은 지도가 되어 자라나요.',
  },
  {
    file: 'family/thisWeek/standard.fragments.json',
    fragmentId: 'family.thisWeek.standard.middle.006',
    p5: '비유하자면 이번 주의 자리는 가운데 줄에 선 사람이 양쪽 가지를 받쳐 주는 모습이에요. 한쪽 가지에만 너무 큰 손이 가면 가운데 자리가 흔들리듯, 양쪽으로 골고루 손을 두고 자기 자리도 단단히 두는 한 주가 잘 맞아요.',
  },
  {
    file: 'family/thisYear/standard.fragments.json',
    fragmentId: 'family.thisYear.standard.teen.003',
    p5: '비유하자면 올해의 가족 자리는 학교라는 큰 길 옆의 작은 정원 같아요. 평일에는 큰 길을 빠르게 달리지만, 분기마다 한 번 정원에 들러 짧게 쉬어 두면 한 해의 끝에서 자기를 받쳐 주는 든든한 뿌리가 되어 줘요.',
  },
  {
    file: 'health/thisYear/standard.fragments.json',
    fragmentId: 'health.thisYear.standard.strong.001',
    p5: '비유하자면 강한 한 해의 체력은 큰 강물의 물살 같아요. 빠른 물살을 한 해 내내 그대로 두면 둑이 닳기도 하니, 분기마다 한 번 작은 둑을 두어 흐름을 잠시 잡아 두면 다음 분기의 물살이 더 또렷하게 자기 자리에 흘러요.',
  },
  {
    file: 'health/thisYear/standard.fragments.json',
    fragmentId: 'health.thisYear.standard.10_19.001',
    p5: '한 해의 작은 자리에서 잠·식사·움직임 한 가지씩 자기 페이스가 잡혀 가는 자취예요. 시험 시기·발표 자리에 자기 신호가 빨리 들리는 한 해이니, 작은 변화 한 줄을 자기에게 따뜻하게 인정해 주세요.',
  },
  // === ct=2 (2) ===
  {
    file: 'expression_children/thisYear/standard.fragments.json',
    fragmentId: 'expression_children.thisYear.standard.0_9.002',
    p5: '한 해 동안 만든 그림·노래·놀이 자취를 분기마다 한 곳에 모아 두는 작은 상자를 만들어 두세요. 상자 한 칸씩 채워 두는 시간이 일 년의 끝에서 자기 색을 또렷하게 받쳐 주는 첫 자료집으로 남아 줘요.',
  },
  {
    file: 'family/thisMonth/standard.fragments.json',
    fragmentId: 'family.thisMonth.standard.elder.008',
    p5: '비유하자면 이번 달의 자리는 오래 머문 정원의 햇볕 좋은 의자 한 자리예요. 굳이 새 꽃을 심지 않아도 한 자리에 앉아 천천히 둘러보는 시간이, 가까운 사람에게도 따뜻한 한 달의 자취로 함께 남아 줘요.',
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
