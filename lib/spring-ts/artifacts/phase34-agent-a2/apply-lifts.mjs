// Phase 34 Agent A2 -- apply 4p->5p lifts (append-P5 mode) to 13 fragments.
// SURGICAL TEXT EDIT: locates each fragment by id, locates its templateTokens
// "kind":"text" "value":"..." pair, and rewrites ONLY the value string,
// preserving original line-endings, indentation, and JSON layout
// (some files have compact one-line fragments alongside multi-line ones).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');

const LIFTS = [
  {
    file: 'academic/thisYear/standard.fragments.json',
    fragmentId: 'academic.thisYear.standard.10_19.003',
    p5: '비유하자면 한 해의 학습은 작은 등불을 한 칸씩 옮겨 켜는 자리예요. 등불 한 칸이 또렷해지면 다음 칸도 자연스레 밝아지듯, 분기마다 한 줄씩 정리한 노트가 자기 자리의 빛을 한 해 단위로 단단하게 받쳐 줘요.',
  },
  {
    file: 'academic/today/standard.fragments.json',
    fragmentId: 'academic.today.standard.20_29.004',
    p5: '한 학기 자리에서 보면 오늘의 한 시간 호흡이 학기 전체의 페이스를 잡아 줘요. 비교의 자리에 흔들리지 않고 자기 보폭을 지킨 하루가 한 학기 단위로 보면 가장 큰 자산이 되어 자기 자리를 또렷하게 받쳐 줘요.',
  },
  {
    file: 'career/thisYear/standard.fragments.json',
    fragmentId: 'career.thisYear.standard.age20_29.007',
    p5: '한 해의 시작 자리를 분기로 쪼개 한 줄씩 적어 두면 다음 분기의 출발이 또렷해져요. 분기 끝마다 가장 단단했던 한 가지와 가장 흔들렸던 한 가지를 짧게 메모해 두면, 자기 자리를 받치는 단서가 한 해 단위로 자연스레 모여요.',
  },
  {
    file: 'expression_children/thisWeek/standard.fragments.json',
    fragmentId: 'expression_children.thisWeek.standard.10_19.003',
    p5: '한 주가 끝날 때 가장 마음에 든 색 한 가지를 한 줄로 적어 두세요. 짧은 메모 한 줄이 다음 주 표현의 출발 자리를 또렷하게 잡아 주고, 자기 색을 알아차리는 폭도 한 뼘씩 자연스럽게 넓어져요.',
  },
  {
    file: 'family/thisWeek/standard.fragments.json',
    fragmentId: 'family.thisWeek.standard.teen.003',
    p5: '한 달 자리에서 보면 한 주의 폭이 가족과 친구 관계의 균형을 잡는 단위가 돼요. 가족 자리에 둔 짧은 시간과 친구 자리에 둔 짧은 시간이 한 달 단위로 모이면 자기 자리도 자연스레 단단해지는 모습이에요.',
  },
  {
    file: 'family/today/standard.fragments.json',
    fragmentId: 'family.today.standard.teen.003',
    p5: '오늘 가족과 짧게 한 가지를 같이 해 보세요. 같이 차린 한 끼, 함께 본 짧은 영상 한 편 같은 작은 자리 하나가 가족과의 거리를 한 뼘 가깝게 데워 주고, 자기 자리도 자연스럽게 따뜻해져요.',
  },
  {
    file: 'health/life/standard.fragments.json',
    fragmentId: 'health.life.standard.20_29.001',
    p5: '비유하자면 20대의 컨디션은 두꺼운 책의 첫 장 같아요. 첫 장에 모서리를 접어 둔 자리가 책 전체의 길라잡이가 되듯, 지금 챙긴 잠 한 시간과 식사 한 끼가 평생 자리에서 또렷한 길잡이로 남아 자기 자리를 받쳐 줘요.',
  },
  {
    file: 'health/thisMonth/standard.fragments.json',
    fragmentId: 'health.thisMonth.standard.teen.001',
    p5: '평생 자리에서 보면 청소년기에 적은 한 줄 컨디션 메모가 어른이 된 다음 자기 몸 신호를 읽는 길라잡이가 돼요. 한 달의 짧은 기록이 모이면 자기 자리에서 가장 또렷한 건강 지도가 되어 자기 자리를 오래 받쳐 줘요.',
  },
  {
    file: 'overall/thisYear/standard.fragments.json',
    fragmentId: 'overall.thisYear.standard.teen.001',
    p5: '한 해를 넷으로 나눠 분기마다 가장 좋아한 활동 한 가지를 짧게 적어 두세요. 분기 끝의 한 줄 메모가 다음 분기의 자리를 또렷하게 잡아 주고, 한 해의 끝에서 자기 색을 자연스럽게 알아차리는 출발점이 되어 줘요.',
  },
  {
    file: 'overall/today/standard.fragments.json',
    fragmentId: 'overall.today.standard.teen.001',
    p5: '오늘 자기 마음 신호 한 가지를 골라 짧게 적어 보세요. 한 줄 메모를 매일 한 자리에 모아 두면 한 주 단위로 자기 색이 자연스레 모이고, 어른과 짧게 나눌 한 마디의 자리도 자기 자리에서 또렷하게 잡혀 가요.',
  },
  {
    file: 'movement/thisYear/standard.fragments.json',
    fragmentId: 'movement.thisYear.standard.10_19.003',
    p5: '한 해 안에 짧은 여행 자리를 두세 번 미리 정해 두세요. 여행 자리마다 가장 좋았던 한 장면을 한 줄로 적어 두면, 한 해의 끝에서 자기 색이 또렷하게 모이고 다음 해의 자리도 자기 자리에서 자연스레 잡혀 가요.',
  },
  {
    file: 'health/thisWeek/standard.fragments.json',
    fragmentId: 'health.thisWeek.standard.female.001',
    p5: '한 달 자리에서 보면 한 주의 작은 차 한 잔, 짧은 스트레칭 한 가지가 컨디션의 출발선을 자기에게 맞춰 잡아 줘요. 한 주의 짧은 반복이 한 달 단위로 모이면 자기 자리에서 또렷한 회복의 폭이 자연스럽게 넓어져요.',
  },
  {
    file: 'family/today/standard.fragments.json',
    fragmentId: 'family.today.standard.young_adult.004',
    p5: '비유하자면 오늘 가족과의 짧은 안부는 화분에 한 모금 물을 주는 자리예요. 가득 채우려 들지 않고 한 모금씩 자주 주는 호흡이 화분을 단단하게 키우듯, 짧고 자주 챙긴 안부 한 마디가 가족 자리를 한결 부드럽게 받쳐 줘요.',
  },
];

// Group lifts by file
const byFile = new Map();
for (const lift of LIFTS) {
  if (!byFile.has(lift.file)) byFile.set(lift.file, []);
  byFile.get(lift.file).push(lift);
}

// JSON-encode a string the same way JSON.stringify would for the value field
// (handles \n, \", \\, \t, etc.). Since templateTokens.value uses \n\n
// separators, we rely on JSON.stringify's default escaping.
function jsonEscape(s) {
  return JSON.stringify(s);
}

// Locate fragment block by id, then within that block locate the
// "kind": "text", "value": "..." pair (could be on one line or many).
// Returns [start, end] indices of the value string literal (incl. quotes).
function findValueRange(text, fragmentId) {
  // Anchor on "fragmentId": "<id>"
  const idAnchor = `"fragmentId": "${fragmentId}"`;
  let idIdx = text.indexOf(idAnchor);
  if (idIdx === -1) {
    // try double-space variants? Standard is single-space (": ").
    return null;
  }
  // From idIdx forward, find the first "templateTokens" occurrence in this fragment
  const tplKey = '"templateTokens"';
  const tplIdx = text.indexOf(tplKey, idIdx);
  if (tplIdx === -1) return null;
  // Then within that array, find "kind": "text" then the matching "value"
  // Actually simplest: from tplIdx, find next "value": "...
  const valKey = '"value":';
  const valIdx = text.indexOf(valKey, tplIdx);
  if (valIdx === -1) return null;
  // skip "value": and any whitespace
  let i = valIdx + valKey.length;
  while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i++;
  if (text[i] !== '"') return null;
  const startQuote = i;
  // walk through string literal handling escapes
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

  // Apply lifts in REVERSE-document-order so earlier offsets remain stable.
  // Determine each lift's idIdx so we can sort.
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
  liftsWithRange.sort((a, b) => b.range[2] - a.range[2]); // reverse order

  for (const { lift, range } of liftsWithRange) {
    const [s, e] = range;
    const oldLiteral = text.slice(s, e);
    // parse JSON string literal back to value
    const oldValue = JSON.parse(oldLiteral);
    const oldParas = oldValue.split('\n\n').filter((p) => p.trim().length > 0);
    if (oldParas.length !== 4) {
      console.error(`NOT 4p (got ${oldParas.length}): ${lift.fragmentId}`);
      totalErrs++;
      continue;
    }
    // Validate P5 spec
    if (lift.p5.includes('흐름이')) {
      console.error(`P5 contains 흐름이: ${lift.fragmentId}`);
      totalErrs++;
      continue;
    }
    const gyeolCount = (lift.p5.match(/결/g) || []).length;
    if (gyeolCount > 2) {
      console.error(`P5 has ${gyeolCount} 결X (>2): ${lift.fragmentId}`);
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
