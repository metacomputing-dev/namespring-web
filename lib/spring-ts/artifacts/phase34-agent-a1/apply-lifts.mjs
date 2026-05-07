// Phase 34 Agent A1 — apply 8 lifts (3p -> 4p) by rewriting templateTokens[0].value
// in each owned-scope standard.fragments.json file. Preserves all other fields.
// Sum-of-ct = 6 ct=1 + 2 ct=2 = 10 cells (band delta +10).
import fs from 'node:fs';
import path from 'node:path';

const drafts = [
  {
    cat: 'academic',
    period: 'today',
    fid: 'academic.today.standard.10_19.003',
    voice: '비유',
    mode: 'insert-P3',
    para:
      '비유하자면 오늘은 작은 화분에 모종을 옮겨 심는 자리예요. 한 줄을 자기 말로 옮겨 적는 손길이 곧 모종의 뿌리를 잡아 주듯, 한 단원이 마음 안에 단단히 자리 잡게 도와줘요.',
  },
  {
    cat: 'family',
    period: 'thisWeek',
    fid: 'family.thisWeek.standard.young_adult.004',
    voice: '맥락',
    mode: 'insert-P3',
    para:
      '평생 자리에서 보면 20대 초반의 한 주가 가족 사이의 호흡을 새로 다듬는 첫 자리예요. 짧은 안부 한 통, 짧은 방문 한 번이 30대 이후 가족 사이의 거리감을 자연스럽게 만들어 줘요.',
  },
  {
    cat: 'health',
    period: 'thisWeek',
    fid: 'health.thisWeek.standard.teen.001',
    voice: '실천',
    mode: 'append-P4',
    para:
      '한 주의 시작에 잠 시각·식사 시간을 한 줄로 적어 두세요. 한 주 동안 그 한 줄을 살피며 한 칸씩 채워 가면, 시험·발표 같은 자리에 닿아도 자기 자리가 단단하게 받쳐 줘요.',
  },
  {
    cat: 'family',
    period: 'life',
    fid: 'family.life.standard.young_adult.004',
    voice: '맥락',
    mode: 'append-P4',
    para:
      '평생 자리에서 보면 20대의 가족 호흡이 30대 이후 자기 살림의 단단함을 만들어 줘요. 너무 가깝지도 멀지도 않은 자리, 그 한 뼘의 호흡이 평생 가족 자리의 토대가 되어 자기를 받쳐 줘요.',
  },
  {
    cat: 'health',
    period: 'life',
    fid: 'health.life.standard.balanced.001',
    voice: '맥락',
    mode: 'append-P4',
    para:
      '평생 단위로 보면 큰 기복 없이 흐른다는 점이 가장 큰 자산이에요. 30대·50대·70대를 지나도 작은 신호를 그때마다 살피는 습관이 자기 자리를 평생 부드럽게 받쳐 줘요.',
  },
  {
    cat: 'health',
    period: 'today',
    fid: 'health.today.standard.teen.001',
    voice: '비유',
    mode: 'append-P4',
    para:
      '비유하자면 오늘은 자기에게 작은 우산 한 개를 챙겨 두는 자리예요. 큰비가 아니어도 가벼운 빗방울 같은 피로·답답함이 올 때 우산 하나가 마음 자리를 부드럽게 만들어 자기 호흡을 따뜻하게 데워 줘요.',
  },
  {
    cat: 'movement',
    period: 'thisMonth',
    fid: 'movement.thisMonth.standard.70plus.008',
    voice: '비유',
    mode: 'insert-P3',
    para:
      '비유하자면 이번 달은 마당에 잔잔한 등잔 하나를 켜 두는 자리예요. 멀리 가지 않아도 가까운 골목·정자·동네 어귀의 등잔 같은 자리가 한 달 안에 마음을 따뜻하게 데워 줘요.',
  },
  {
    cat: 'expression_children',
    period: 'thisYear',
    fid: 'expression_children.thisYear.standard.30_39.005',
    voice: '실천',
    mode: 'append-P4',
    para:
      '한 해에 한 번은 자기 작업·말·시도를 한 폴더에 모아 두세요. 12개월 뒤 그 폴더를 다시 펼쳐 보는 자리가 30대 자기 색의 자취를 또렷하게 만들어 다음 한 해의 첫 발을 가볍게 만들어 줘요.',
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
    // existing P3 becomes P4; new paragraph slots in as new P3
    newPars = [paras[0], paras[1], d.para, paras[2]];
  } else if (d.mode === 'append-P4') {
    // new paragraph appended as P4
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
