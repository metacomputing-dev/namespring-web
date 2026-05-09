// Phase 36 Agent A1 — apply 5 lifts (3p -> 4p) by string-replacing
// templateTokens[0].value in each owned-scope standard.fragments.json.
// Sum-of-ct = 5 ct=2 = 10 cells (band delta +10, target 130->140).
//
// Implementation: pure substring replace of the source `value` body
// with the new body containing inserted/appended P4. This preserves
// every other byte of the source file, including original whitespace
// (single-line vs multi-line key formatting) and CRLF line endings.
// Some files use compact one-line objects; others use formatted
// multi-line; both are preserved.
import fs from 'node:fs';
import path from 'node:path';

const drafts = [
  {
    cat: 'career',
    period: 'today',
    fid: 'career.today.standard.balanced.neutral.004',
    voice: '비유',
    mode: 'insert-P3',
    para:
      '비유하자면 오늘은 도예가가 손에 쥔 흙을 천천히 다듬어 두는 자리예요. 굳이 큰 모양을 잡지 않아도 손끝의 작은 매만짐이 다음 자리의 단단한 형태를 자연스럽게 만들어 줘요.',
  },
  {
    cat: 'expression_children',
    period: 'thisMonth',
    fid: 'expression_children.thisMonth.standard.30_39.005',
    voice: '맥락',
    mode: 'append-P4',
    para:
      '한 분기 자리에서 보면 이번 달의 작은 협업 한 자리가 다음 분기 자기 표현의 단단한 디딤판으로 남아요. 가까운 사람과 함께 놓아 둔 한 줄이 자기 작업의 자취를 또렷하게 받쳐 줘요.',
  },
  {
    cat: 'family',
    period: 'thisWeek',
    fid: 'family.thisWeek.standard.thirties.005',
    voice: '실천',
    mode: 'insert-P3',
    para:
      '주말 저녁에는 가족 한 사람과 짧은 산책 한 자리를 정해 두세요. 다섯 분 남짓의 그 자리가 한 주 동안 쌓인 마음의 자취를 가볍게 풀어 주어 다음 주의 첫 자리를 따뜻하게 만들어 줘요.',
  },
  {
    cat: 'health',
    period: 'life',
    fid: 'health.life.standard.female.001',
    voice: '비유',
    mode: 'append-P4',
    para:
      '비유하자면 평생의 컨디션은 마당 한쪽 우물물처럼 천천히 차오르는 자리예요. 한 번에 길어 올리지 않아도 매일 두 손으로 가만히 떠 두는 작은 자리가 평생을 든든하게 받쳐 줘요.',
  },
  {
    cat: 'movement',
    period: 'thisWeek',
    fid: 'movement.thisWeek.standard.0_9.002',
    voice: '실천',
    mode: 'append-P4',
    para:
      '주중 한 번은 아이 손에 작은 종이 한 장과 색연필 한 자루를 쥐어 주세요. 외출 자리에서 본 풍경 한 장면을 짧게 그려 두는 자리가 한 주의 자취를 따뜻한 추억으로 모아 줘요.',
  },
];

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');

// Parse fragments.json (read-only) just to locate the current value.
function findCurrentValue(file, fid) {
  const j = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const frag = j.fragments.find((x) => x.fragmentId === fid);
  if (!frag) throw new Error('fragment not found: ' + fid);
  return frag.templateTokens[0].value;
}

function applyOne(d) {
  const file = path.join(NARRATIVE_DIR, d.cat, d.period, 'standard.fragments.json');
  const oldValue = findCurrentValue(file, d.fid);
  const paras = oldValue.split('\n\n');
  if (paras.length !== 3) throw new Error('expected 3p, got ' + paras.length + ' for ' + d.fid);
  let newPars;
  if (d.mode === 'insert-P3') {
    newPars = [paras[0], paras[1], d.para, paras[2]];
  } else if (d.mode === 'append-P4') {
    newPars = [paras[0], paras[1], paras[2], d.para];
  } else {
    throw new Error('bad mode ' + d.mode);
  }
  const newValue = newPars.join('\n\n');
  // Encode for JSON literal (escape \n -> \\n, etc.)
  const oldEnc = JSON.stringify(oldValue);
  const newEnc = JSON.stringify(newValue);
  const txt = fs.readFileSync(file, 'utf-8');
  // Hits exactly once because fragmentId is unique and the value
  // strings are long-form bodies; no risk of accidental collision.
  if (!txt.includes(oldEnc)) {
    throw new Error('source body literal not found verbatim in ' + file);
  }
  const occurrences = txt.split(oldEnc).length - 1;
  if (occurrences !== 1) {
    throw new Error('expected 1 occurrence, got ' + occurrences + ' in ' + file);
  }
  const out = txt.replace(oldEnc, newEnc);
  fs.writeFileSync(file, out, 'utf-8');
  console.log('  applied', d.fid, '|', d.mode, '|', 'paras=' + newPars.length);
}

console.log('Applying ' + drafts.length + ' lifts...');
for (const d of drafts) applyOne(d);
console.log('Done.');
