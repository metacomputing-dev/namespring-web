// Phase 35 Agent A2 — apply 7 lifts (3p -> 4p) by rewriting templateTokens[0].value
// in each owned-scope standard.fragments.json file. Preserves all other fields.
// Sum-of-ct = 1 ct=1 + 6 ct=2 = 13 cells (band delta +13, target 127->140).
import fs from 'node:fs';
import path from 'node:path';

const drafts = [
  {
    cat: 'health',
    period: 'life',
    fid: 'health.life.standard.teen.001',
    voice: '실천',
    mode: 'append-P4',
    para:
      '한 학기 한 번은 자기 잠 시각·식사 시간을 한 줄로 적어 두세요. 그 한 줄을 다음 학기와 비교해 보는 자리가 평생 갈 컨디션의 자기 토대를 가벼운 손길로 단단하게 다듬어 줘요.',
  },
  {
    cat: 'academic',
    period: 'life',
    fid: 'academic.life.standard.30_39.005',
    voice: '실천',
    mode: 'insert-P3',
    para:
      '한 분기마다 책 한 권을 펼친 자리와 덮은 자리를 한 줄씩 적어 두세요. 30대 한 해 동안 그 자취가 모이면, 자기 분야의 작은 지도가 되어 다음 분기의 첫 자리를 가볍게 만들어 줘요.',
  },
  {
    cat: 'career',
    period: 'thisWeek',
    fid: 'career.thisWeek.standard.balanced.neutral.004',
    voice: '비유',
    mode: 'insert-P3',
    para:
      '비유하자면 이번 주는 자기 책상 위 서랍 한 칸을 가지런히 다듬어 두는 자리예요. 굳이 큰 가구를 옮기지 않아도 작은 서랍의 정돈이 다음 주 자기 손길의 속도를 한 뼘 빠르게 만들어 줘요.',
  },
  {
    cat: 'expression_children',
    period: 'life',
    fid: 'expression_children.life.standard.0_9.002',
    voice: '맥락',
    mode: 'append-P4',
    para:
      '평생 자리에서 보면 어린 시절의 자유로운 표현이 10대·20대 자기 색의 뿌리로 자라요. 지금 한 줄의 동요, 한 장의 그림이 평생 자기를 또렷하게 받쳐 주는 작은 씨앗으로 남아 있어요.',
  },
  {
    cat: 'family',
    period: 'thisMonth',
    fid: 'family.thisMonth.standard.elder.008',
    voice: '맥락',
    mode: 'insert-P3',
    para:
      '평생 자리에서 보면 어른의 한 달 호흡이 가족 전체의 자리를 부드럽게 만들어 줘요. 굳이 큰 일정을 만들지 않아도 가까운 사람과의 짧은 안부가 한 달 안의 따뜻한 자취로 모여 있어요.',
  },
  {
    cat: 'movement',
    period: 'thisYear',
    fid: 'movement.thisYear.standard.0_9.002',
    voice: '비유',
    mode: 'append-P4',
    para:
      '비유하자면 올해의 이동은 어린 새가 마당에서 작은 나뭇가지로 옮겨 앉아 보는 자리예요. 한 번의 작은 옮겨 앉음이 자기 날개에 자기 무게를 익히게 도와주어 다음 한 해의 첫 비행을 가볍게 만들어 줘요.',
  },
  {
    cat: 'overall',
    period: 'today',
    fid: 'overall.today.standard.balanced.neutral.008',
    voice: '비유',
    mode: 'insert-P3',
    para:
      '비유하자면 오늘은 잔잔한 호숫가에 작은 조약돌 하나를 살며시 놓아 두는 자리예요. 큰 파동을 만들지 않아도 한 점의 자취가 천천히 퍼져 자기 페이스의 자리를 부드럽게 받쳐 줘요.',
  },
];

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');

function applyOne(d) {
  const file = path.join(NARRATIVE_DIR, d.cat, d.period, 'standard.fragments.json');
  const txt = fs.readFileSync(file, 'utf-8');
  const j = JSON.parse(txt);
  const idx = j.fragments.findIndex((x) => x.fragmentId === d.fid);
  if (idx === -1) throw new Error('fragment not found: ' + d.fid);
  const frag = j.fragments[idx];
  const tx = frag.templateTokens[0].value;
  const paras = tx.split('\n\n');
  if (paras.length !== 3) throw new Error('expected 3p, got ' + paras.length + ' for ' + d.fid);
  let newPars;
  if (d.mode === 'insert-P3') {
    newPars = [paras[0], paras[1], d.para, paras[2]];
  } else if (d.mode === 'append-P4') {
    newPars = [paras[0], paras[1], paras[2], d.para];
  } else {
    throw new Error('bad mode ' + d.mode);
  }
  frag.templateTokens[0].value = newPars.join('\n\n');
  // Detect line-ending convention from source file (CRLF on Windows clones).
  const isCrlf = txt.includes('\r\n');
  const hasTrailingNewline = txt.endsWith('\n');
  let out = JSON.stringify(j, null, 2);
  if (isCrlf) out = out.replace(/\n/g, '\r\n');
  if (hasTrailingNewline) out += isCrlf ? '\r\n' : '\n';
  fs.writeFileSync(file, out, 'utf-8');
  console.log('  applied', d.fid, '|', d.mode, '|', 'paras=' + newPars.length);
}

console.log('Applying ' + drafts.length + ' lifts...');
for (const d of drafts) applyOne(d);
console.log('Done.');
