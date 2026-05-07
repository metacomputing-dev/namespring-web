// Phase 33 Agent A2 — draft new paragraphs and verify constraints
// Each paragraph: 96-115 chars, 0 흐름이, 0 결X, sentence-final 요-endings, no jargon

const drafts = [
  {
    id: 'academic.thisYear.standard.10_19.003',
    voice: '실천',
    mode: 'insert-P3',
    para: '한 학기에 한 번은 자기 노트를 펼쳐 또래 한 명에게 짧게 보여 주는 자리를 만들어 두세요. 자기 글이 다른 시선과 만나는 작은 자리가 다음 학기의 출발선을 한 뼘씩 또렷하게 만들어 줘요.',
  },
  {
    id: 'academic.today.standard.20_29.004',
    voice: '비유',
    mode: 'insert-P3',
    para: '비유하자면 오늘은 큰 다리를 한 번에 짓기보다 한 칸 한 칸 디딤돌을 놓는 자리예요. 한 장의 마무리, 한 줄의 정리가 다음 디딤돌의 자리를 미리 준비해 주니, 작은 단위가 가장 잘 맞아요.',
  },
  {
    id: 'career.thisYear.standard.age20_29.007',
    voice: '실천',
    mode: 'insert-P3',
    para: '분기마다 자기 판단과 작은 실수를 한 페이지로 모아 두세요. 한 해 동안 쌓이는 그 페이지가 평생 직업관의 첫 자료가 되어, 다음 자리로 옮길 때도 자기 길의 단단한 받침이 되어 줘요.',
  },
  {
    id: 'expression_children.life.standard.10_19.003',
    voice: '맥락',
    mode: 'append-P4',
    para: '평생 자리에서 보면 청소년기의 한 번의 표현 시도가 어른이 된 자기 색의 첫 자료가 돼요. 짧은 영상, 작은 그림, 한 편의 글처럼 남아 있는 자료가 한 해 한 해 자기 자리를 또렷하게 만들어 줘요.',
  },
  {
    id: 'family.thisWeek.standard.teen.003',
    voice: '실천',
    mode: 'insert-P3',
    para: '주말 한 끼 자리에서 한 주 동안 가장 마음에 남은 한 가지를 가족과 짧게 나눠 두세요. 작은 한 마디 자리가 가족 사이의 거리를 부드럽게 좁혀 주고, 다음 주의 호흡도 한층 가볍게 만들어 줘요.',
  },
  {
    id: 'family.today.standard.teen.003',
    voice: '비유',
    mode: 'append-P4',
    para: '비유하자면 오늘 가족과의 자리는 따뜻한 화롯불 같은 시간이에요. 큰 불꽃이 아니어도 가만히 옆에 두면 온기가 천천히 번지듯, 한 끼·한 안부의 작은 온기가 자기 자리도 따뜻하게 데워 줘요.',
  },
  {
    id: 'health.life.standard.20_29.001',
    voice: '맥락',
    mode: 'append-P4',
    para: '평생 자리에서 보면 20대의 작은 잠 부족, 작은 식사 거름이 30대 이후 컨디션 출발선을 정해요. 지금 챙긴 한 시간의 잠, 한 그릇의 식사가 평생 단위로 보면 가장 큰 약이 되어 자기 자리를 받쳐 줘요.',
  },
  {
    id: 'health.thisMonth.standard.teen.001',
    voice: '실천',
    mode: 'append-P4',
    para: '한 달이 끝날 때 가장 잘 챙긴 한 가지와 가장 흔들린 한 가지를 한 줄씩 적어 두세요. 다음 달의 출발 자리가 자기에게 맞춰 자연스럽게 잡혀 가고, 자기 신호를 알아차리는 폭도 한 뼘씩 더 넓어져요.',
  },
  {
    id: 'overall.thisYear.standard.teen.001',
    voice: '비유',
    mode: 'append-P4',
    para: '비유하자면 한 해는 자기만의 작은 정원에 씨앗을 심어 두는 시간이에요. 좋아하는 활동·관심사라는 씨앗을 한 해 동안 천천히 키워 두면, 다음 해에 어떤 꽃이 필지 자기 자리에서 또렷이 보이게 돼요.',
  },
  {
    id: 'overall.today.standard.teen.001',
    voice: '맥락',
    mode: 'append-P4',
    para: '평생 자리에서 보면 청소년기에 마음 신호를 알아차리는 연습이 어른이 된 다음의 단단한 자기 자리를 만들어 줘요. 오늘 짧게 적은 한 줄, 어른과 짧게 나눈 한 마디가 평생 자기 색의 토대가 돼요.',
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
    d.id.padEnd(50),
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
