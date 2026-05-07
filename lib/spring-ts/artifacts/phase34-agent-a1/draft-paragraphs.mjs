// Phase 34 Agent A1 — draft new paragraphs and verify constraints
// Each paragraph: 96-115 chars, 0 흐름이, 0 결, sentence-final 요-endings, no jargon

const drafts = [
  {
    id: 'academic.today.standard.10_19.003',
    voice: '비유',
    mode: 'insert-P3',
    para:
      '비유하자면 오늘은 작은 화분에 모종을 옮겨 심는 자리예요. 한 줄을 자기 말로 옮겨 적는 손길이 곧 모종의 뿌리를 잡아 주듯, 한 단원이 마음 안에 단단히 자리 잡게 도와줘요.',
  },
  {
    id: 'family.thisWeek.standard.young_adult.004',
    voice: '맥락',
    mode: 'insert-P3',
    para:
      '평생 자리에서 보면 20대 초반의 한 주가 가족 사이의 호흡을 새로 다듬는 첫 자리예요. 짧은 안부 한 통, 짧은 방문 한 번이 30대 이후 가족 사이의 거리감을 자연스럽게 만들어 줘요.',
  },
  {
    id: 'health.thisWeek.standard.teen.001',
    voice: '실천',
    mode: 'append-P4',
    para:
      '한 주의 시작에 잠 시각·식사 시간을 한 줄로 적어 두세요. 한 주 동안 그 한 줄을 살피며 한 칸씩 채워 가면, 시험·발표 같은 자리에 닿아도 자기 자리가 단단하게 받쳐 줘요.',
  },
  {
    id: 'family.life.standard.young_adult.004',
    voice: '맥락',
    mode: 'append-P4',
    para:
      '평생 자리에서 보면 20대의 가족 호흡이 30대 이후 자기 살림의 단단함을 만들어 줘요. 너무 가깝지도 멀지도 않은 자리, 그 한 뼘의 호흡이 평생 가족 자리의 토대가 되어 자기를 받쳐 줘요.',
  },
  {
    id: 'health.life.standard.balanced.001',
    voice: '맥락',
    mode: 'append-P4',
    para:
      '평생 단위로 보면 큰 기복 없이 흐른다는 점이 가장 큰 자산이에요. 30대·50대·70대를 지나도 작은 신호를 그때마다 살피는 습관이 자기 자리를 평생 부드럽게 받쳐 줘요.',
  },
  {
    id: 'health.today.standard.teen.001',
    voice: '비유',
    mode: 'append-P4',
    para:
      '비유하자면 오늘은 자기에게 작은 우산 한 개를 챙겨 두는 자리예요. 큰비가 아니어도 가벼운 빗방울 같은 피로·답답함이 올 때 우산 하나가 마음 자리를 부드럽게 만들어 자기 호흡을 따뜻하게 데워 줘요.',
  },
  {
    id: 'movement.thisMonth.standard.70plus.008',
    voice: '비유',
    mode: 'insert-P3',
    para:
      '비유하자면 이번 달은 마당에 잔잔한 등잔 하나를 켜 두는 자리예요. 멀리 가지 않아도 가까운 골목·정자·동네 어귀의 등잔 같은 자리가 한 달 안에 마음을 따뜻하게 데워 줘요.',
  },
  {
    id: 'expression_children.thisYear.standard.30_39.005',
    voice: '실천',
    mode: 'append-P4',
    para:
      '한 해에 한 번은 자기 작업·말·시도를 한 폴더에 모아 두세요. 12개월 뒤 그 폴더를 다시 펼쳐 보는 자리가 30대 자기 색의 자취를 또렷하게 만들어 다음 한 해의 첫 발을 가볍게 만들어 줘요.',
  },
];

console.log('Voice mix:', {
  실천: drafts.filter((d) => d.voice === '실천').length,
  비유: drafts.filter((d) => d.voice === '비유').length,
  맥락: drafts.filter((d) => d.voice === '맥락').length,
});
console.log('Mode mix:', {
  'insert-P3': drafts.filter((d) => d.mode === 'insert-P3').length,
  'append-P4': drafts.filter((d) => d.mode === 'append-P4').length,
});
console.log('');

let allOk = true;
for (const d of drafts) {
  const len = [...d.para].length;
  const hasFlowYi = (d.para.match(/흐름이/g) ?? []).length;
  const hasGyeol = (d.para.match(/결/g) ?? []).length;
  const endsOk = /(?:줘요|져요|돼요|예요|세요|아요|워요|봐요|어요|혀요|켜요|펴요|쳐요|러요|려요|벼요|쉬요|에요|이요)\.$/.test(d.para);
  // jargon scan
  const jargon = ['신강', '신약', '격국', '십성', '용신', '희신', '기신', '구신', '일간', '천을귀인', '대운', '세운'];
  const jargonHit = jargon.filter((j) => d.para.includes(j));
  const ok = len >= 96 && len <= 115 && hasFlowYi === 0 && hasGyeol === 0 && endsOk && jargonHit.length === 0;
  if (!ok) allOk = false;
  console.log(
    d.id.padEnd(60),
    'len=' + String(len).padStart(3),
    'flowYi=' + hasFlowYi,
    'gyeol=' + hasGyeol,
    'endsOk=' + endsOk,
    'jargon=' + (jargonHit.join(',') || '-'),
    ok ? 'OK' : 'FAIL'
  );
}
console.log('');
console.log('All OK:', allOk);

// Truncated-endings scan (mimics tools/check_narrative_truncated_endings.mjs noun_bare_yo / verb_stem_bare_yo)
const NOUN_STEMS = ['컨디션', '상태', '관계', '약속', '회복', '친구', '가족', '책임', '감정', '일정', '결정', '운동', '식사', '동료', '이슈', '경험', '능력', '수입', '지출', '분야', '환경', '일과', '음식', '역할', '시간', '관점', '생각', '기준', '노력', '조심', '중심', '성장', '시점', '모습', '반복', '학교', '회사', '습관', '관리', '건강', '평소', '기억', '단계', '기회', '선택', '판단'];
const VERB_STEMS = ['정', '쉬', '좋', '읽', '듣', '먹', '많', '적', '크', '작', '빠', '늦', '넓', '좁', '짧', '길', '밝', '어둡', '약', '강', '무겁', '가볍', '뜨겁', '차갑'];
const nounPattern = new RegExp(`(?:${NOUN_STEMS.join('|')})요\\.`, 'u');
const verbPattern = new RegExp(`(?<![가-힣])(?:${VERB_STEMS.join('|')})요\\.`, 'u');
let scanOk = true;
console.log('');
console.log('Truncated-endings scan:');
for (const d of drafts) {
  const noun = d.para.match(nounPattern);
  const verb = d.para.match(verbPattern);
  if (noun || verb) {
    scanOk = false;
    console.log(' FAIL', d.id, 'noun=', noun?.[0] || '-', 'verb=', verb?.[0] || '-');
  }
}
console.log('Scan OK:', scanOk);

export { drafts };
