// Phase 37 Agent A2 -- apply 4p->5p lifts (append-P5 mode) to 10 fragments.
// SURGICAL TEXT EDIT: locates each fragment by id, locates its templateTokens
// "kind":"text" "value":"..." pair, and rewrites ONLY the value string,
// preserving original line-endings, indentation, and JSON layout.
//
// Run from lib/spring-ts root: `node artifacts/phase37-agent-a2/apply-lifts.mjs`
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');

const LIFTS = [
  {
    file: 'academic/today/standard.fragments.json',
    fragmentId: 'academic.today.standard.55plus.006',
    p5: '비유하자면 오늘 한 줄을 곱씹는 자리는 오래 익은 차 한 잔을 천천히 음미하는 시간 같아요. 한 번에 큰 잔을 비우려 하지 않아도 같은 차의 향이 두 번째 잔에서 더 또렷해지듯, 익숙한 한 페이지가 오늘 더 깊은 한 자락을 내어 줘요.',
  },
  {
    file: 'career/thisYear/standard.fragments.json',
    fragmentId: 'career.thisYear.standard.age10_19.006',
    p5: '비유하자면 올해의 진로 탐색은 한 권의 빈 스크랩북을 한 해 동안 천천히 채워 가는 자리예요. 한 페이지의 사진·메모·짧은 후기가 쌓여 12월 자리에 펼쳐 보면, 자기에게 어떤 색이 잘 어울리는지 한눈에 보이는 한 권의 자료집이 되어 있어요.',
  },
  {
    file: 'expression_children/life/standard.fragments.json',
    fragmentId: 'expression_children.life.standard.10_19.003',
    p5: '한 학기 자리에 좋아하는 작가·아티스트의 한 작품을 골라 자기 식으로 한 번 다시 만들어 보세요. 짧은 모방의 한 자취가 한 해 단위에서 모이면, 또래와 비교하기보다 자기 색을 찾아 가는 단단한 손자취가 자연스럽게 자라나요.',
  },
  {
    file: 'expression_children/thisWeek/standard.fragments.json',
    fragmentId: 'expression_children.thisWeek.standard.55_69.007',
    p5: '한 주 안에 손주·후배에게 한 권의 책을 골라 표지에 짧은 메모 한 줄을 남겨 건네 보세요. 짧은 메모 한 줄이 받는 자리에 길게 남고, 한 주의 작은 자리가 다음 세대 안에서 한 자취로 자연스럽게 이어져요.',
  },
  {
    file: 'expression_children/today/standard.fragments.json',
    fragmentId: 'expression_children.today.standard.40_54.006',
    p5: '비유하자면 오늘의 한 마무리는 가을 들판의 알맹이 한 알을 손바닥에 모아 두는 자리예요. 한 알의 무게는 작아 보여도 한 해의 끝에 모여 보면 자기 손에서 익어 온 곡식의 한 자락으로 쌓여 있어요.',
  },
  {
    file: 'family/thisMonth/standard.fragments.json',
    fragmentId: 'family.thisMonth.standard.teen.003',
    p5: '한 달 안에 주말 한 끼를 정해 두고, 가족과 함께 자기 한 주의 짧은 소식 한 줄을 나눠 보세요. 같은 자리·같은 한 끼가 한 달 단위로 모이면, 학업과 친구로 분주한 시기에도 가족과의 따뜻한 매듭이 단단하게 잡혀요.',
  },
  {
    file: 'family/thisYear/standard.fragments.json',
    fragmentId: 'family.thisYear.standard.strong.012',
    p5: '비유하자면 올해의 자리는 가족이라는 정원에서 큰 나무가 옆 가지를 받쳐 주는 자리예요. 그 나무의 뿌리에 햇볕과 물이 닿아야 옆 가지도 같이 자라듯, 분기마다 자기 자리에 쉬는 시간을 두면 받쳐 주는 손이 한 해 내내 따뜻해요.',
  },
  {
    file: 'health/thisWeek/standard.fragments.json',
    fragmentId: 'health.thisWeek.standard.55_69.001',
    p5: '비유하자면 이번 주의 차분한 페이스는 오래 우려낸 따뜻한 차 한 잔과 닮아요. 끓는 물 한 번에 진하게 우려 내려 하지 않아도 천천히 우러난 차의 향이 한 주 동안 마음 자리를 부드럽게 데워 주는 시간이에요.',
  },
  {
    file: 'health/today/standard.fragments.json',
    fragmentId: 'health.today.standard.teen.001',
    p5: '오늘 자기 전에 한 줄로 잠 시간·기분 한 단어·식사 한 줄을 적어 두면 좋아요. 한 줄의 기록이 한 주 단위로 모이면, 시험 시기·발표 자리에 닿았을 때 자기 신호를 빨리 알아차릴 수 있는 단단한 자료가 돼요.',
  },
  {
    file: 'movement/thisMonth/standard.fragments.json',
    fragmentId: 'movement.thisMonth.standard.10_19.003',
    p5: '비유하자면 이번 달의 짧은 여행은 한 권의 사진집에 새 페이지를 끼워 두는 자리예요. 한 장의 풍경 사진이 시험 시기에 펼쳐 본 마음 한쪽을 환기해 주듯, 한 달의 작은 체험이 학업의 자리에서도 든든한 한 자락이 돼요.',
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
