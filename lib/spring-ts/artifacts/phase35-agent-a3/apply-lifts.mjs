// Phase 35 Agent A3 -- apply 4p->5p lifts (append-P5 mode) to 10 fragments.
// SURGICAL TEXT EDIT: locates each fragment by id, locates its templateTokens
// "kind":"text" "value":"..." pair, and rewrites ONLY the value string,
// preserving original line-endings, indentation, and JSON layout.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');

const LIFTS = [
  {
    file: 'academic/thisWeek/standard.fragments.json',
    fragmentId: 'academic.thisWeek.standard.balanced.009',
    p5: '비유하자면 한 주의 학업은 익숙한 들길에 작은 표지석을 한 칸씩 놓아 두는 자리예요. 표지석 한 칸이 또렷해지면 다음 칸도 자연스레 자리잡듯, 한 단원의 매듭이 한 학기 단위에서 자기 자리를 단단히 받쳐 줘요.',
  },
  {
    file: 'career/thisWeek/standard.fragments.json',
    fragmentId: 'career.thisWeek.standard.age10_19.006',
    p5: '한 주가 끝날 때 가장 마음에 오래 남은 한 가지 활동을 한 줄로 적어 두세요. 짧은 메모 한 줄이 다음 주의 자리를 또렷하게 잡아 주고, 한 달 단위로 모이면 자기에게 맞는 길의 단서가 자연스럽게 보여요.',
  },
  {
    file: 'expression_children/thisMonth/standard.fragments.json',
    fragmentId: 'expression_children.thisMonth.standard.10_19.003',
    p5: '비유하자면 한 달의 표현은 작은 연못에 매일 조약돌을 한 알씩 던져 두는 자리예요. 한 알의 파문이 작아 보여도 한 달 단위로 겹쳐 보면 자기만의 무늬가 또렷해져, 다음 달의 표현이 한층 자연스럽게 풀려요.',
  },
  {
    file: 'family/thisMonth/standard.fragments.json',
    fragmentId: 'family.thisMonth.standard.middle.006',
    p5: '한 분기 자리에서 보면 이번 달의 작은 안부 한 통이 부모님과 자녀 사이의 거리를 조용히 좁혀 주는 자리예요. 한 달의 짧은 균형이 모이면 한 해 단위로도 자기 자리가 부드러워지는 모습이에요.',
  },
  {
    file: 'health/life/standard.fragments.json',
    fragmentId: 'health.life.standard.balanced.001',
    p5: '평생의 한 가지 운동을 정해 매주 같은 요일·같은 시각에 짧게 이어 두세요. 한 주의 짧은 반복이 한 달 단위로 모이고, 한 해 단위로 쌓이면 자기 컨디션 지도가 또렷해져 다음 시기의 작은 신호도 한결 빠르게 알아차리게 돼요.',
  },
  {
    file: 'health/thisYear/standard.fragments.json',
    fragmentId: 'health.thisYear.standard.balanced.001',
    p5: '비유하자면 올해는 잔잔한 호수 둘레를 천천히 한 바퀴 도는 자리예요. 둘레가 익숙해 보여도 계절마다 빛이 다르게 비치듯, 작은 신호 한 줄을 분기마다 적어 두면 한 해 끝의 자기 자리가 또렷한 풍경으로 모여요.',
  },
  {
    file: 'movement/thisYear/standard.fragments.json',
    fragmentId: 'movement.thisYear.standard.55_69.007',
    p5: '한 해 자리에서 보면 새 자리로 옮기는 자체보다 옮기는 호흡이 더 큰 자산이에요. 익숙한 자리의 한 가지를 함께 챙겨 새 자리로 옮긴 첫 분기가 다음 분기의 안정감을 자연스럽게 받쳐 줘요.',
  },
  {
    file: 'movement/today/standard.fragments.json',
    fragmentId: 'movement.today.standard.55_69.007',
    p5: '비유하자면 오늘은 익숙한 동네 골목을 한 바퀴 천천히 돌아보는 자리예요. 멀리 가지 않아도 같은 길의 모서리 빛이 어제와 다르게 보이듯, 가까운 자리의 짧은 외출이 자기 자리를 한결 가볍게 데워 줘요.',
  },
  {
    file: 'overall/thisMonth/standard.fragments.json',
    fragmentId: 'overall.thisMonth.standard.teen.001',
    p5: '비유하자면 이번 달은 한 권의 노트 같은 자리예요. 매일 한 줄씩 짧게 채워 두면 한 달 끝에는 자기 색의 표지가 자연스럽게 만들어지고, 또래의 빠른 페이지 수와 비교하지 않아도 자기 노트의 두께가 한 뼘씩 단단해져요.',
  },
  {
    file: 'family/thisYear/standard.fragments.json',
    fragmentId: 'family.thisYear.standard.young_adult.004',
    p5: '한 해 안에 본가와 자기 자리를 잇는 작은 의례 한 가지를 정해 두세요. 명절 한 끼, 분기 한 통화, 생일 한 자리처럼 자기 호흡에 맞는 의례 하나가 한 해 단위로 자기 살림과 가족 자리를 자연스럽게 이어 줘요.',
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
