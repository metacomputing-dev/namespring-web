// Phase 37 Agent A1 — apply 5 lifts (3p -> 4p) by string-replacing
// templateTokens[0].value in each owned-scope standard.fragments.json.
// Sum-of-ct = 5 ct=2 = 10 cells (band delta +10, target 130->140).
//
// Implementation: pure substring replace of the source `value` body
// with the new body containing inserted/appended P4. This preserves
// every other byte of the source file, including original whitespace
// (single-line vs multi-line key formatting) and CRLF line endings.
import fs from 'node:fs';
import path from 'node:path';

const drafts = [
  {
    cat: 'expression_children',
    period: 'thisYear',
    fid: 'expression_children.thisYear.standard.0_9.002',
    voice: '비유',
    mode: 'insert-P3',
    para:
      '비유하자면 한 해의 자기 표현은 밤하늘에 별자리 한 점씩 그려 두는 자리예요. 한 점씩 더해 두는 작은 자리가 모여 일 년이 지나고 보면 또렷한 그림 한 장으로 남아 줘요.',
  },
  {
    cat: 'family',
    period: 'today',
    fid: 'family.today.standard.weak.011',
    voice: '실천',
    mode: 'insert-P3',
    para:
      '오늘 한 자리에서는 가족 중 한 사람에게 짧은 안부 한 줄을 먼저 건네 보세요. 답이 길지 않아도 그 한 자리가 오늘의 마음을 따뜻하게 풀어 주어 다음 자리로 자연스럽게 이어져요.',
  },
  {
    cat: 'health',
    period: 'thisYear',
    fid: 'health.thisYear.standard.female.40_54.001',
    voice: '맥락',
    mode: 'append-P4',
    para:
      '한 해의 어디쯤 와 있는지 천천히 돌아보면 다음 분기에 무엇을 더 챙길지 또렷해져요. 분기마다 짧은 점검 한 자리를 두면 한 해의 컨디션이 자연스럽게 자기 자리를 찾아 가요.',
  },
  {
    cat: 'movement',
    period: 'life',
    fid: 'movement.life.standard.30_39.005',
    voice: '비유',
    mode: 'append-P4',
    para:
      '비유하자면 30대의 큰 이동은 산길에서 고갯마루 한 자리를 넘어 두는 자리예요. 한 번에 정상까지 오르지 않아도, 한 고개씩 천천히 넘어 두는 자리가 30대 후반의 든든한 시야를 만들어 줘요.',
  },
  {
    cat: 'overall',
    period: 'thisWeek',
    fid: 'overall.thisWeek.standard.balanced.neutral.008',
    voice: '실천',
    mode: 'insert-P3',
    para:
      '주중 한 자리에서는 평소보다 조금 일찍 잠자리에 들어 보세요. 십 분 남짓 앞당긴 그 자리가 다음 날 아침의 첫 자리를 가볍게 시작하게 해 주고, 한 주 전체의 호흡을 자연스럽게 정돈해 줘요.',
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
