// Propose conservative trims for cautions violations.
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('artifacts/phase5-agent-a2/cautions-baseline.json', 'utf-8'));

function ko(s) { return Array.from(s).filter(c => /[가-힣]/.test(c)).length; }

function dropFinalR(syl) {
  const code = syl.charCodeAt(0) - 0xAC00;
  if (code < 0 || code >= 11172) return null;
  const final = code % 28;
  if (final !== 8) return null;
  return String.fromCodePoint(0xAC00 + (code - final));
}

// V-(ㄹ) 수 있으니 -> V-니
function fixSugiOnyi(s) {
  return s.replace(/([가-힣]) 수 있으니/g, (m, syl) => {
    const stem = dropFinalR(syl);
    if (!stem) return m;
    return stem + '니';
  });
}

// V-(ㄹ) 수 있어요 -> V-아/어요 ONLY at sentence end (followed by . or end)
function fixSugiOyo(s) {
  return s.replace(/([가-힣]) 수 있어요(\.?)$/g, (m, syl, dot) => {
    const code = syl.charCodeAt(0) - 0xAC00;
    if (code < 0 || code >= 11172) return m;
    const final = code % 28;
    if (final !== 8) return m;
    const stemCode = code - final;
    const stem = String.fromCodePoint(0xAC00 + stemCode);
    const middle = Math.floor(stemCode / 28) % 21;
    const initial = Math.floor(stemCode / (28 * 21));
    if (middle === 20) {
      const newCode = initial * 21 * 28 + 6 * 28 + 0;
      return String.fromCodePoint(0xAC00 + newCode) + '요' + (dot || '');
    }
    if (middle === 0 || middle === 8) return stem + '아요' + (dot || '');
    return stem + '어요' + (dot || '');
  });
}

// V-(ㄹ) 수 있습니다 -> V-아/어집니다 ONLY at sentence end
function fixSugiSeumnida(s) {
  return s.replace(/([가-힣]) 수 있습니다(\.?)$/g, (m, syl, dot) => {
    const code = syl.charCodeAt(0) - 0xAC00;
    if (code < 0 || code >= 11172) return m;
    const final = code % 28;
    if (final !== 8) return m;
    const stemCode = code - final;
    const stem = String.fromCodePoint(0xAC00 + stemCode);
    const middle = Math.floor(stemCode / 28) % 21;
    const initial = Math.floor(stemCode / (28 * 21));
    if (middle === 20) {
      const newCode = initial * 21 * 28 + 6 * 28 + 0;
      return String.fromCodePoint(0xAC00 + newCode) + '집니다' + (dot || '');
    }
    if (middle === 0 || middle === 8) return stem + '아집니다' + (dot || '');
    return stem + '어집니다' + (dot || '');
  });
}

// Conservative phrase substitutions only:
const phraseSubs = [
  ['에는', '엔'],
  ['되지 않도록', '되지 않게'],
  ['이어지지 않도록', '이어지지 않게'],
  ['보이지 않도록', '안 보이게'],
  ['들리지 않도록', '안 들리게'],
  ['있을 수 있', '있'],
  // safe Verb-주세요 -> Verb-세요 (1 char less)
  ['해 주세요', '하세요'],
  ['전해 주세요', '전하세요'],
  ['적어 주세요', '적으세요'],
  ['넘겨 주세요', '넘기세요'],
  ['받아 주세요', '받으세요'],
  ['남겨 주세요', '남기세요'],
  ['세워 주세요', '세우세요'],
  ['맞춰 주세요', '맞추세요'],
  ['지켜 주세요', '지키세요'],
  ['살펴 주세요', '살피세요'],
  ['열어 주세요', '여세요'],
  ['이미 해온', '익숙한'],
  ['이미 익숙한', '익숙한'],
  ['모든 것을 ', ''],
  ['실제로 ', ''],
  ['지금까지 해온', '해온'],
];

function tryReductions(s) {
  const candidates = new Set();
  // Apply each individually
  candidates.add(fixSugiOnyi(s));
  candidates.add(fixSugiOyo(s));
  candidates.add(fixSugiSeumnida(s));
  for (const [a, b] of phraseSubs) {
    candidates.add(s.split(a).join(b));
  }
  // Apply all
  let combined = fixSugiOnyi(fixSugiOyo(fixSugiSeumnida(s)));
  for (const [a, b] of phraseSubs) {
    combined = combined.split(a).join(b);
  }
  candidates.add(combined);
  // Apply only Korean-grammar fixes (no phrase subs)
  candidates.add(fixSugiOnyi(fixSugiOyo(s)));
  candidates.delete(s);
  return [...candidates];
}

const out = [];
for (const v of data.violations) {
  const proposals = [];
  const tried = new Set();
  for (const att of tryReductions(v.text)) {
    if (att !== v.text && !tried.has(att) && ko(att) <= 30) {
      proposals.push({ko: ko(att), text: att});
      tried.add(att);
    }
  }
  proposals.sort((a, b) => b.ko - a.ko);
  out.push({
    file: v.file,
    fragmentId: v.fragmentId,
    origKo: v.ko,
    origText: v.text,
    proposals,
  });
}

let autoCount = 0;
let manualCount = 0;
const lines = [];
for (const r of out) {
  if (r.proposals.length === 0) {
    manualCount++;
    lines.push(`MANUAL ${r.fragmentId} (${r.origKo}): ${r.origText}`);
  } else {
    autoCount++;
    lines.push(`AUTO  ${r.fragmentId} (${r.origKo} -> ${r.proposals[0].ko}): ${r.proposals[0].text}`);
  }
}
console.log(lines.join('\n'));
console.error(`auto: ${autoCount}, manual: ${manualCount}`);
fs.writeFileSync('artifacts/phase5-agent-a2/auto-proposals.json', JSON.stringify(out, null, 2));
