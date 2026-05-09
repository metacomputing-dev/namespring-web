// Phase 39 Agent A2 — apply 4 lifts (3p -> 4p) by string-replacing
// templateTokens[0].value in each owned-scope standard.fragments.json.
// Sum-of-ct = 2 ct=2 + 2 ct=3 = 10 cells (band delta +10, target 130 -> 140).
//
// Implementation: pure substring replace of the source `value` body
// with the new body containing inserted/appended P4. Preserves every
// other byte of the source file (including CRLF and key-formatting).
import fs from 'node:fs';
import path from 'node:path';

const drafts = [
  {
    cat: 'health',
    period: 'thisWeek',
    fid: 'health.thisWeek.standard.weak.001',
    ct: 2,
    voice: '비유',
    mode: 'insert-P3',
    para:
      '작은 소반 위에 정갈한 반찬을 두어 가지 차분히 올려 두듯, 이번 주 회복도 한 끼·한 산책·한 잠을 가지런히 받쳐 두면 잘 맞아요. 한 번에 큰 변화를 두려 하지 않아도 돼요.',
  },
  {
    cat: 'movement',
    period: 'life',
    fid: 'movement.life.standard.0_9.002',
    ct: 2,
    voice: '맥락',
    mode: 'insert-P3',
    para:
      '새 자리에 들어설 때마다 아이의 마음 안에서는 호기심과 낯섦이 짧게 마주쳐 보여요. 그 작은 마주침이 오래 쌓이면 또래보다 한 뼘 더 너른 시야를 만들어 주는 든든한 자양분이 돼요.',
  },
  {
    cat: 'academic',
    period: 'thisYear',
    fid: 'academic.thisYear.standard.55plus.007',
    ct: 3,
    voice: '실천',
    mode: 'insert-P3',
    para:
      '한 주에 한 페이지를 골라 짧은 메모를 차분히 남겨 두는 작은 약속을 두면 좋아요. 큰 진도를 두지 않아도, 한 줄·한 단락의 기록이 한 해의 단단한 발걸음으로 천천히 모여 줘요.',
  },
  {
    cat: 'family',
    period: 'today',
    fid: 'family.today.standard.thirties.005',
    ct: 3,
    voice: '비유',
    mode: 'insert-P3',
    para:
      '두 가정을 정겹게 잇는 작은 다리는 한꺼번에 놓이지 않아요. 오늘 한 통의 다정한 안부 전화, 내일 한 잔의 따뜻한 차로 이어 가다 보면 든든한 다리가 자연스레 자리를 잡아 줘요.',
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
  console.log('  applied', d.fid, '| ct=' + d.ct, '|', d.mode, '| voice=' + d.voice, '| paras=' + newPars.length);
}

// Sanity check sum-of-ct
const sumCt = drafts.reduce((a, d) => a + d.ct, 0);
console.log('Drafts: ' + drafts.length + ' fragments | sum-of-ct=' + sumCt + ' (target 10)');
if (sumCt !== 10) {
  console.error('WARN: sum-of-ct != 10');
}

// Sanity check 흐름이 / 결 in new paragraphs
for (const d of drafts) {
  const flowCt = (d.para.match(/흐름이/g) || []).length;
  const gyeolCt = (d.para.match(/결/g) || []).length;
  console.log('  ' + d.fid + ' | new para chars=' + d.para.length + ' | 흐름이=' + flowCt + ' | 결=' + gyeolCt);
  if (flowCt !== 0 || gyeolCt !== 0) {
    throw new Error('source-paragraph 흐름이/결 != 0 for ' + d.fid);
  }
}

console.log('');
console.log('Applying ' + drafts.length + ' lifts...');
for (const d of drafts) applyOne(d);
console.log('Done.');
