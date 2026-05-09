// Phase 36 Agent A2 -- apply 4p->5p lifts (append-P5 mode) to 10 fragments.
// SURGICAL TEXT EDIT: locates each fragment by id, locates its templateTokens
// "kind":"text" "value":"..." pair, and rewrites ONLY the value string,
// preserving original line-endings, indentation, and JSON layout.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');

const LIFTS = [
  {
    file: 'academic/thisYear/standard.fragments.json',
    fragmentId: 'academic.thisYear.standard.20_29.004',
    p5: '비유하자면 한 해의 학업은 빈 노트 한 권에 분기마다 한 챕터를 천천히 채워 가는 자리예요. 한 챕터의 두께가 옆자리 또래의 속도와 달라도 12월에 펼쳐 보면 자기 손자취가 또렷한 한 권의 색을 띠고 있어요.',
  },
  {
    file: 'academic/today/standard.fragments.json',
    fragmentId: 'academic.today.standard.10_19.003',
    p5: '한 학기 자리에서 보면 오늘의 한 단원은 작아 보여도 매일의 자기 호흡이 모이는 자리예요. 자기 방식으로 다진 짧은 시간이 시험·발표 같은 큰 자리에 닿으면 든든한 받침이 되어 자기 자리를 단단히 받쳐 줘요.',
  },
  {
    file: 'career/life/standard.fragments.json',
    fragmentId: 'career.life.standard.balanced.neutral.004',
    p5: '비유하자면 평생의 일자리는 천천히 자라는 한 그루 나무 같은 자리예요. 매일 한 뼘씩의 변화는 보이지 않아도, 십 년의 자리에서 펼쳐 보면 자기만의 가지와 그늘이 또렷한 한 풍경으로 모여 있어요.',
  },
  {
    file: 'career/thisYear/standard.fragments.json',
    fragmentId: 'career.thisYear.standard.balanced.neutral.004',
    p5: '한 해 끝의 12월에 분기마다 한 줄로 적어 둔 자기 결정 메모를 한자리에 모아 펼쳐 보세요. 짧은 메모 네 줄이 다음 해의 첫 자리를 또렷하게 잡아 주고, 자기에게 맞는 길의 단서가 자연스럽게 보여요.',
  },
  {
    file: 'expression_children/thisYear/standard.fragments.json',
    fragmentId: 'expression_children.thisYear.standard.70plus.008',
    p5: '한 해 안에 자기 책상 한쪽에 묵은 글·그림·사진을 한 묶음으로 모아 두세요. 한 묶음을 분기마다 한 번 펼쳐 보고 한 줄씩 짧은 코멘트를 더해 두면 다음 세대에게 건넬 자기 자취가 자연스럽게 자라나요.',
  },
  {
    file: 'family/thisWeek/standard.fragments.json',
    fragmentId: 'family.thisWeek.standard.young_adult.004',
    p5: '한 주 안에 본가에 짧은 안부 한 통, 형제에게 메시지 한 줄을 정해진 요일에 보내 두세요. 같은 요일의 짧은 호흡이 한 달 단위로 모이면, 자기 살림과 본가 자리 사이의 간격이 따뜻한 자리로 메워져요.',
  },
  {
    file: 'health/thisMonth/standard.fragments.json',
    fragmentId: 'health.thisMonth.standard.strong.001',
    p5: '비유하자면 이번 달의 강한 체력은 잘 달군 가마솥 같은 자리예요. 불을 한껏 올린 가마솥도 식는 시간이 필요하듯, 한 달 안에 푹 쉬는 자리를 한두 번 챙겨 두면 다음 달에도 자기 자리가 단단해져요.',
  },
  {
    file: 'movement/thisMonth/standard.fragments.json',
    fragmentId: 'movement.thisMonth.standard.30_39.005',
    p5: '비유하자면 이번 달의 분주함은 빠른 강물 위를 건너는 자리예요. 빠른 물살에서는 한 발 더 보태기보다 한 발의 자리를 단단히 딛는 것이 자기 자리를 지키니, 큰 결정은 잠잠한 자리에서 다시 한번 살펴 두면 좋아요.',
  },
  {
    file: 'movement/thisWeek/standard.fragments.json',
    fragmentId: 'movement.thisWeek.standard.30_39.005',
    p5: '비유하자면 분주한 한 주는 짐을 가득 실은 작은 배 같은 자리예요. 짐의 무게가 한쪽으로 쏠리면 자기 자리가 흔들리니, 큰 결정은 항구의 잔잔한 자리로 옮겨 두고 한 주의 분주함이 가라앉기를 기다려 보세요.',
  },
  {
    file: 'overall/thisWeek/standard.fragments.json',
    fragmentId: 'overall.thisWeek.standard.teen.001',
    p5: '한 주의 시작 자리에서 자기에게 가장 중요한 한 가지를 한 줄로 적어 두세요. 짧은 한 줄을 매주 같은 자리에 쌓아 두면 한 학기 단위에서 자기 손자취가 또렷한 노트가 되어, 친구와 비교하지 않아도 자기 자리가 단단해져요.',
  },
];

// Group lifts by file
const byFile = new Map();
for (const lift of LIFTS) {
  if (!byFile.has(lift.file)) byFile.set(lift.file, []);
  byFile.get(lift.file).push(lift);
}

function jsonEscape(s) {
  return JSON.stringify(s);
}

// Locate fragment block by id, then within that block locate the
// "kind": "text", "value": "..." pair (could be on one line or many).
// Returns [start, end] indices of the value string literal (incl. quotes).
function findValueRange(text, fragmentId) {
  const idAnchor = `"fragmentId": "${fragmentId}"`;
  let idIdx = text.indexOf(idAnchor);
  if (idIdx === -1) {
    return null;
  }
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
      `lifted ${lift.fragmentId}  (P5 len=${lift.p5.length}, paras: ${oldParas.length}→${oldParas.length + 1})`
    );
  }

  fs.writeFileSync(filePath, text, 'utf-8');
}

console.log('');
console.log(`Total lifts applied: ${totalLifts}/${LIFTS.length}, errors: ${totalErrs}`);
if (totalErrs > 0) process.exit(1);
