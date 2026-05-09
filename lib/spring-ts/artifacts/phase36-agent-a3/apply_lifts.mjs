/**
 * P36-A3 — Surgical apply of 10 5p->6p lifts on expert.fragments.json files.
 * For each target fragment, locate the LAST text token's value string and
 * append \n\n<new paragraph> to its content. Preserves all other bytes.
 *
 * Adapted from artifacts/phase35-agent-a3/apply-lifts.mjs (CRLF-safe pattern).
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');

const LIFTS = [
  {
    file: 'data/narrative/health/today/expert.fragments.json',
    fragmentId: 'health.today.expert.water_day.001',
    p6: '저녁 자리에는 미지근한 물 한 잔과 짧은 환기 한 번을 두고, 잠 자리는 평소보다 조금 일찍 잡는 편이 잘 맞아요. 오늘 가라앉은 자리가 내일 첫 호흡에서 한 박자 가벼워지는 자산이 돼요. 짧은 회복 한 번이 며칠 뒤 큰 자리에서 또렷한 무기가 돼요.',
  },
  {
    file: 'data/narrative/health/thisWeek/expert.fragments.json',
    fragmentId: 'health.thisWeek.expert.weak.001',
    p6: '이번 주 챙겨 둔 작은 회복 자리는 다음 주뿐 아니라 한 달 단위 호흡까지 자산이 돼요. 무리한 강행군보다 잠·식사·짧은 산책 같은 익숙한 자리를 일정에 미리 끼워 두는 편이 잘 맞아요. 약한 일간일수록 작은 마디 반복이 평소보다 또렷한 무기가 돼요.',
  },
  {
    file: 'data/narrative/health/thisMonth/expert.fragments.json',
    fragmentId: 'health.thisMonth.expert.conflicting.001',
    p6: '다음 달로 넘어갈 때는 한 주 분량의 가벼운 일정 자리를 미리 비워 두는 편이 잘 맞아요. 어긋나는 신호가 누적된 자리에는 짧은 휴가·평일 반차 같은 자리가 약이 돼요. 분기 단위로 보면 한 달의 한 박자 쉼이 다음 분기 호흡까지 부드럽게 이어 줘요.',
  },
  {
    file: 'data/narrative/health/life/expert.fragments.json',
    fragmentId: 'health.life.expert.extreme_strong.001',
    p6: '10년 단위로 보면 20대엔 폭주를 한 박자 늦추는 자리, 40대엔 누적된 회복 자리, 60대엔 천천히 가는 호흡 자리가 큰 무기예요. 강한 일간일수록 짧은 점검 자리가 평생 자산이 돼요. 한 해 한 번의 정기 검진과 분기 한 번의 회복 자리가 평생 호흡의 가장 단단한 마디예요.',
  },
  {
    file: 'data/narrative/health_stress/today/expert.fragments.json',
    fragmentId: 'health_stress.today.expert.wildcard.001',
    p6: '잠 자리에 들기 전 짧은 정돈 시간을 두고, 내일 아침 첫 자리에는 큰 결정보다 가벼운 호흡 자리를 두는 편이 잘 맞아요. 오늘 모은 안정감이 내일 호흡까지 자연스럽게 연결돼요. 자기 페이스에 맞는 짧은 자리가 큰 회복의 자산이 돼요.',
  },
  {
    file: 'data/narrative/health_stress/life/expert.fragments.json',
    fragmentId: 'health_stress.life.expert.diversity.anchor.001',
    p6: '10년 단위로 보면 20대엔 무리한 강행군 자리, 40대엔 누적된 신호 자리, 60대엔 천천히 챙기는 자리가 도드라져요. 한 해 한 번 자기 신호를 살피는 정기 점검 자리를 두면, 평생 호흡이 한 박자 더 부드러워져요. 작은 회복 자리의 반복이 평생 가장 또렷한 무기예요.',
  },
  {
    file: 'data/narrative/movement/thisYear/expert.fragments.json',
    fragmentId: 'movement.thisYear.expert.30_39.005',
    p6: '올해의 큰 자리에서 한 박자 정돈한 호흡은 다음 해 첫 분기까지 자산으로 이어져요. 이사·이직 자리는 한 해 단위로 보지 말고 가족 호흡과 다음 해 일정까지 함께 두면 더 또렷해져요. 분기 한 번씩 가까운 사람과 호흡을 맞추는 자리가 30대 이동 자리의 가장 단단한 무기예요.',
  },
  {
    file: 'data/narrative/romance/thisWeek/expert.fragments.json',
    fragmentId: 'romance.thisWeek.expert.midlife.aligned.001',
    p6: '한 주의 작은 정성이 한 달 단위 호흡까지 자연스럽게 이어져요. 분기 단위로 보면 작은 감사·짧은 안부가 큰 갈등 자리를 미리 풀어 주는 자산이 돼요. 곁의 사람에게 익숙해진 자리에서 한 박자 새로운 표현을 두면, 신뢰의 마디가 한층 단단해져요.',
  },
  {
    file: 'data/narrative/romance/thisMonth/expert.fragments.json',
    fragmentId: 'romance.thisMonth.expert.midlife.aligned.001',
    p6: '한 달 단위로 쌓아 둔 신뢰는 분기·반기 호흡까지 그대로 자산으로 이어져요. 다음 달엔 새로운 자리·다른 환경에서의 짧은 외출 자리를 한 번 두면, 익숙한 호흡에 한 박자 새로움이 더해져요. 한 해 단위로 곁의 사람과의 마디를 같이 점검하는 자리가 큰 무기예요.',
  },
  {
    file: 'data/narrative/wealth/thisYear/expert.fragments.json',
    fragmentId: 'wealth.thisYear.expert.wildcard.001',
    p6: '한 해의 자산 자리는 다음 해까지 이어 보면 무게 중심이 더 또렷해져요. 큰 결정 자리에는 가까운 사람·전문가의 호흡을 한 번씩 빌려 두는 편이 잘 맞아요. 분기 점검과 한 해 정산 자리를 미리 일정에 넣어 두면, 한 해 자산의 마디가 다음 해까지 단단히 자리잡아요.',
  },
];

function jsonStringEscape(s) {
  // Escape per JSON string literal rules. Mimics JSON.stringify(s).slice(1, -1).
  return JSON.stringify(s).slice(1, -1);
}

function findLastTextValueRange(fileText, fragmentId) {
  // Locate fragment block by fragmentId. We search for the "fragmentId":
  // marker, then scan forward for templateTokens, then find the LAST text
  // token's "value" within that fragment object.
  //
  // Fragment object boundary is detected by tracking JSON object depth.
  const idMarker = `"fragmentId": "${fragmentId}"`;
  const idAt = fileText.indexOf(idMarker);
  if (idAt < 0) {
    throw new Error(`fragmentId ${fragmentId} not found`);
  }
  // Walk back to find the opening { of this fragment object.
  let openIdx = idAt;
  let depth = 0;
  for (let i = idAt; i >= 0; i -= 1) {
    const c = fileText[i];
    if (c === '}') depth += 1;
    else if (c === '{') {
      if (depth === 0) {
        openIdx = i;
        break;
      }
      depth -= 1;
    }
  }
  // Walk forward from openIdx tracking depth to find matching close }.
  depth = 0;
  let closeIdx = -1;
  for (let i = openIdx; i < fileText.length; i += 1) {
    const c = fileText[i];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        closeIdx = i;
        break;
      }
    } else if (c === '"') {
      // Skip over JSON string (handle \" escape).
      i += 1;
      while (i < fileText.length) {
        const cc = fileText[i];
        if (cc === '\\') {
          i += 2;
          continue;
        }
        if (cc === '"') break;
        i += 1;
      }
    }
  }
  if (closeIdx < 0) {
    throw new Error(`Could not find close } for ${fragmentId}`);
  }
  const fragmentText = fileText.slice(openIdx, closeIdx + 1);

  // Within fragmentText, find ALL text-token "value" string occurrences.
  // We rely on: each text token block looks like
  //   {
  //     "kind": "text",
  //     "value": "..."
  //   }
  // We scan for `"kind": "text"` then forward to the next `"value": "..."`.
  const matches = [];
  let scanFrom = 0;
  while (scanFrom < fragmentText.length) {
    const kindAt = fragmentText.indexOf('"kind": "text"', scanFrom);
    if (kindAt < 0) break;
    // Find next "value": " after kindAt.
    const valKey = fragmentText.indexOf('"value":', kindAt);
    if (valKey < 0) break;
    // Find opening quote of value string.
    const openQuote = fragmentText.indexOf('"', valKey + '"value":'.length);
    if (openQuote < 0) break;
    // Scan to closing quote (handle \").
    let i = openQuote + 1;
    while (i < fragmentText.length) {
      const c = fragmentText[i];
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === '"') break;
      i += 1;
    }
    if (i >= fragmentText.length) break;
    matches.push({
      openQuote: openIdx + openQuote,
      closeQuote: openIdx + i,
      valueText: fragmentText.slice(openQuote + 1, i),
    });
    scanFrom = i + 1;
  }
  if (matches.length === 0) {
    throw new Error(`No text tokens found for ${fragmentId}`);
  }
  return matches[matches.length - 1];
}

const before = {};
let appliedCount = 0;

for (const lift of LIFTS) {
  const filePath = path.join(SPRING_TS_ROOT, lift.file);
  const original = fs.readFileSync(filePath, 'utf-8');
  before[lift.fragmentId] = original;

  const range = findLastTextValueRange(original, lift.fragmentId);
  // Build new value: existing + "\n\n" + p6.
  const existingDecoded = JSON.parse(`"${range.valueText}"`);
  const newDecoded = existingDecoded + '\n\n' + lift.p6;
  const newEscaped = jsonStringEscape(newDecoded);

  const updated =
    original.slice(0, range.openQuote + 1) +
    newEscaped +
    original.slice(range.closeQuote);

  fs.writeFileSync(filePath, updated);
  appliedCount += 1;
  console.log(
    `OK\t${lift.fragmentId}\told_last_value_len=${existingDecoded.length}\tnew_p6_len=${lift.p6.length}`,
  );
}

console.log(`\nApplied ${appliedCount}/${LIFTS.length} lifts.`);
