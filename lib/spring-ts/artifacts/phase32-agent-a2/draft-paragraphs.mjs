// Phase 32 Agent A2 — draft new paragraphs and verify constraints
// Each paragraph: 96-115 chars, 0 흐름이, 0 결X, sentence-final 요-endings, no jargon

const drafts = [
  {
    id: 'academic.today.standard.55plus.006',
    voice: '맥락',
    mode: 'insert-P3',
    para: '오늘 한 문장을 곱씹는 자리는 그 자체로 작은 회복의 시간이 되어 줘요. 평생 모아 온 단어들이 한 줄을 더 깊게 읽게 만들어 주니, 빠른 진도보다 음미하는 자리가 자기에게 잘 맞아요.',
  },
  {
    id: 'academic.thisYear.standard.20_29.004',
    voice: '실천',
    mode: 'insert-P3',
    para: '학기마다 짧게라도 자기 글 한 편을 마무리해 두고, 분기에 한 번 좋아하는 사람에게 보여 주는 자리를 잡아 두세요. 한 해 동안 쌓이는 마무리 한 장 한 장이 다음 진로의 단단한 받침이 되어 줘요.',
  },
  {
    id: 'career.life.standard.age10_19.006',
    voice: '비유',
    mode: 'insert-P3',
    para: '비유하자면 지금은 어떤 씨앗이 자기 흙에 잘 맞을지 천천히 살펴보는 봄이에요. 빠르게 한 자리를 정하기보다, 여러 모종 사이를 천천히 거닐어 보는 시간 자체가 평생의 양분이 되어 줘요.',
  },
  {
    id: 'career.thisWeek.standard.age10_19.006',
    voice: '실천',
    mode: 'insert-P3',
    para: '이번 주는 짧은 영상 한 편, 책 한 챕터처럼 가벼운 관심사 자리를 여러 개 펼쳐 두세요. 한 주가 끝날 때 마음에 가장 오래 남는 한 가지를 짧게 적어 두면 다음 주의 첫 자리가 자연스럽게 잡혀요.',
  },
  {
    id: 'expression_children.life.standard.40_54.006',
    voice: '맥락',
    mode: 'append-P4',
    para: '평생 자리에서 보면 지금은 자기 표현이 곁의 사람을 받쳐 주는 형태로 천천히 넓어져요. 자기 작품만이 아닌 누군가의 자리를 함께 또렷하게 만들어 주는 표현이, 다음 시기의 단단한 자산이 되어 줘요.',
  },
  {
    id: 'expression_children.thisWeek.standard.10_19.003',
    voice: '비유',
    mode: 'append-P4',
    para: '비유하자면 한 주는 작은 화폭에 색을 시험해 보는 자리예요. 한 주 동안 마음에 가장 오래 남은 색을 한 가지 골라 두면, 다음 주의 화폭이 자기 색에 맞춰 자연스럽게 밝아지는 모습을 만나게 돼요.',
  },
  {
    id: 'family.thisMonth.standard.teen.003',
    voice: '비유',
    mode: 'insert-P3',
    para: '비유하자면 가족과의 자리가 한 달 안의 따뜻한 등불 같은 시간이에요. 매일 켜 두지 않아도 한 달 안에 한두 번 또렷하게 밝아지는 등불이, 학업·친구 자리에서 흔들리는 마음을 든든하게 받쳐 줘요.',
  },
  {
    id: 'family.thisYear.standard.young_adult.004',
    voice: '실천',
    mode: 'insert-P3',
    para: '한 해 안에 본가와 자기 자리를 잇는 연락 한 가지를 정해 두세요. 매주의 짧은 안부, 매달의 영상통화, 분기 한 번의 방문처럼 자기 호흡에 맞는 한 가지를 꾸준히 이어 가면 한 해의 폭이 부드러워져요.',
  },
  {
    id: 'health.thisYear.standard.strong.001',
    voice: '맥락',
    mode: 'append-P4',
    para: '한 해 자리에서 보면 강한 체력은 무리한 자리에서 자기 신호를 둔하게 만들기도 해요. 분기마다 한 번 점검 시간을 잡고, 잠·식사·근력의 균형을 한 해 단위로 살펴 두면 다음 한 해가 더 단단해져요.',
  },
  {
    id: 'overall.thisWeek.standard.teen.001',
    voice: '비유',
    mode: 'append-P4',
    para: '비유하자면 한 주는 학교 가방에 담는 작은 짐 같은 시간이에요. 너무 무겁게 싸 두면 어깨가 빨리 지치고, 너무 가볍게만 두면 자기 자리가 비어 보이니, 한 주 시작에 짐의 무게를 한 번 살펴 두세요.',
  },
];

console.log('Voice mix:', {
  실천: drafts.filter((d) => d.voice === '실천').length,
  비유: drafts.filter((d) => d.voice === '비유').length,
  맥락: drafts.filter((d) => d.voice === '맥락').length,
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
