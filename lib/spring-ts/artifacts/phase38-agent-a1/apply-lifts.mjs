// Phase 38 Agent A1 — apply 5 lifts (3p -> 4p) by string-replacing
// templateTokens[0].value in each owned-scope standard.fragments.json.
// Sum-of-ct = 5 ct=2 = 10 cells (band delta +10, target 130->140).
//
// Implementation: pure substring replace of the source `value` body
// with the new body containing inserted/appended P4. Preserves every
// other byte of the source file (including CRLF and key-formatting).
import fs from 'node:fs';
import path from 'node:path';

const drafts = [
  {
    cat: 'expression_children',
    period: 'thisYear',
    fid: 'expression_children.thisYear.standard.40_54.006',
    voice: '실천',
    mode: 'insert-P3',
    para:
      '한 해의 마무리에 가까워지면 가족 중 한 사람에게 짧은 편지 한 장을 적어 보세요. 길지 않아도 좋고, 고마운 자리 한 줄을 또렷이 적어 두면 다음 해의 자리도 한층 가벼워져요.',
  },
  {
    cat: 'expression_children',
    period: 'today',
    fid: 'expression_children.today.standard.70plus.008',
    voice: '맥락',
    mode: 'insert-P3',
    para:
      '오늘 하루의 표현은 다음 세대와 함께하는 호흡을 천천히 정돈하는 자리예요. 굳이 긴 대화가 아니어도 짧은 한마디나 따뜻한 눈맞춤 한 번이 오늘 하루의 마음을 또렷이 담아 주는 자산이 돼요.',
  },
  {
    cat: 'health',
    period: 'life',
    fid: 'health.life.standard.strong.001',
    voice: '비유',
    mode: 'append-P4',
    para:
      '비유하자면 평생 컨디션은 가마솥 한 솥의 국물 같아요. 한 번에 끓여 두는 게 아니라 천천히 우러나는 온기를 곁에서 자주 챙겨 두면 한 번 데워 마실 때마다 든든한 한 사발이 돼요.',
  },
  {
    cat: 'movement',
    period: 'life',
    fid: 'movement.life.standard.40_54.006',
    voice: '실천',
    mode: 'append-P4',
    para:
      '한 자리를 옮길 때마다 짐 한 보따리를 정리해 보세요. 가져갈 것과 두고 갈 것을 한 번 더 가려 두면 새 자리에 닿았을 때 호흡이 가벼워지고, 다음 자리에서의 시야도 또렷해져요.',
  },
  {
    cat: 'movement',
    period: 'thisWeek',
    fid: 'movement.thisWeek.standard.70plus.008',
    voice: '비유',
    mode: 'insert-P3',
    para:
      '비유하자면 한 주의 짧은 산책은 처마 끝에 매달린 풍경 소리 한 번 같아요. 큰 바람 없이 작은 흔들림 한 점이면 한 주의 마음에 가만히 맑은 음 하나가 새겨져 자리가 한층 정돈돼요.',
  },
];

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');

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
