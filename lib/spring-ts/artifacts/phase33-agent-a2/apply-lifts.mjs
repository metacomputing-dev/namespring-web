// Phase 33 Agent A2 — apply 10 lifts (3p -> 4p) by rewriting templateTokens[0].value
// in each owned-scope standard.fragments.json file. Preserves all other fields.
import fs from 'node:fs';
import path from 'node:path';

const drafts = [
  {
    cat: 'academic',
    period: 'thisYear',
    fid: 'academic.thisYear.standard.10_19.003',
    voice: '실천',
    mode: 'insert-P3',
    para: '한 학기에 한 번은 자기 노트를 펼쳐 또래 한 명에게 짧게 보여 주는 자리를 만들어 두세요. 자기 글이 다른 시선과 만나는 작은 자리가 다음 학기의 출발선을 한 뼘씩 또렷하게 만들어 줘요.',
  },
  {
    cat: 'academic',
    period: 'today',
    fid: 'academic.today.standard.20_29.004',
    voice: '비유',
    mode: 'insert-P3',
    para: '비유하자면 오늘은 큰 다리를 한 번에 짓기보다 한 칸 한 칸 디딤돌을 놓는 자리예요. 한 장의 마무리, 한 줄의 정리가 다음 디딤돌의 자리를 미리 준비해 주니, 작은 단위가 가장 잘 맞아요.',
  },
  {
    cat: 'career',
    period: 'thisYear',
    fid: 'career.thisYear.standard.age20_29.007',
    voice: '실천',
    mode: 'insert-P3',
    para: '분기마다 자기 판단과 작은 실수를 한 페이지로 모아 두세요. 한 해 동안 쌓이는 그 페이지가 평생 직업관의 첫 자료가 되어, 다음 자리로 옮길 때도 자기 길의 단단한 받침이 되어 줘요.',
  },
  {
    cat: 'expression_children',
    period: 'life',
    fid: 'expression_children.life.standard.10_19.003',
    voice: '맥락',
    mode: 'append-P4',
    para: '평생 자리에서 보면 청소년기의 한 번의 표현 시도가 어른이 된 자기 색의 첫 자료가 돼요. 짧은 영상, 작은 그림, 한 편의 글처럼 남아 있는 자료가 한 해 한 해 자기 자리를 또렷하게 만들어 줘요.',
  },
  {
    cat: 'family',
    period: 'thisWeek',
    fid: 'family.thisWeek.standard.teen.003',
    voice: '실천',
    mode: 'insert-P3',
    para: '주말 한 끼 자리에서 한 주 동안 가장 마음에 남은 한 가지를 가족과 짧게 나눠 두세요. 작은 한 마디 자리가 가족 사이의 거리를 부드럽게 좁혀 주고, 다음 주의 호흡도 한층 가볍게 만들어 줘요.',
  },
  {
    cat: 'family',
    period: 'today',
    fid: 'family.today.standard.teen.003',
    voice: '비유',
    mode: 'append-P4',
    para: '비유하자면 오늘 가족과의 자리는 따뜻한 화롯불 같은 시간이에요. 큰 불꽃이 아니어도 가만히 옆에 두면 온기가 천천히 번지듯, 한 끼·한 안부의 작은 온기가 자기 자리도 따뜻하게 데워 줘요.',
  },
  {
    cat: 'health',
    period: 'life',
    fid: 'health.life.standard.20_29.001',
    voice: '맥락',
    mode: 'append-P4',
    para: '평생 자리에서 보면 20대의 작은 잠 부족, 작은 식사 거름이 30대 이후 컨디션 출발선을 정해요. 지금 챙긴 한 시간의 잠, 한 그릇의 식사가 평생 단위로 보면 가장 큰 약이 되어 자기 자리를 받쳐 줘요.',
  },
  {
    cat: 'health',
    period: 'thisMonth',
    fid: 'health.thisMonth.standard.teen.001',
    voice: '실천',
    mode: 'append-P4',
    para: '한 달이 끝날 때 가장 잘 챙긴 한 가지와 가장 흔들린 한 가지를 한 줄씩 적어 두세요. 다음 달의 출발 자리가 자기에게 맞춰 자연스럽게 잡혀 가고, 자기 신호를 알아차리는 폭도 한 뼘씩 더 넓어져요.',
  },
  {
    cat: 'overall',
    period: 'thisYear',
    fid: 'overall.thisYear.standard.teen.001',
    voice: '비유',
    mode: 'append-P4',
    para: '비유하자면 한 해는 자기만의 작은 정원에 씨앗을 심어 두는 시간이에요. 좋아하는 활동·관심사라는 씨앗을 한 해 동안 천천히 키워 두면, 다음 해에 어떤 꽃이 필지 자기 자리에서 또렷이 보이게 돼요.',
  },
  {
    cat: 'overall',
    period: 'today',
    fid: 'overall.today.standard.teen.001',
    voice: '맥락',
    mode: 'append-P4',
    para: '평생 자리에서 보면 청소년기에 마음 신호를 알아차리는 연습이 어른이 된 다음의 단단한 자기 자리를 만들어 줘요. 오늘 짧게 적은 한 줄, 어른과 짧게 나눈 한 마디가 평생 자기 색의 토대가 돼요.',
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
