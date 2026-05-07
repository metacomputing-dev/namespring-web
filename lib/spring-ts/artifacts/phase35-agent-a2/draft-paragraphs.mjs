// Phase 35 Agent A2 -- draft new paragraphs and verify constraints
// Each paragraph: 96-115 chars, 0 흐름이, 0 결, sentence-final 요-endings, no jargon

const drafts = [
  // 1. ct=1, P3 substantive (148ch) -> append-P4, 실천
  {
    id: 'health.life.standard.teen.001',
    voice: '실천',
    mode: 'append-P4',
    para:
      '한 학기 한 번은 자기 잠 시각·식사 시간을 한 줄로 적어 두세요. 그 한 줄을 다음 학기와 비교해 보는 자리가 평생 갈 컨디션의 자기 토대를 가벼운 손길로 단단하게 다듬어 줘요.',
  },
  // 2. ct=2, P3 short (30ch) -> insert-P3, 실천
  {
    id: 'academic.life.standard.30_39.005',
    voice: '실천',
    mode: 'insert-P3',
    para:
      '한 분기마다 책 한 권을 펼친 자리와 덮은 자리를 한 줄씩 적어 두세요. 30대 한 해 동안 그 자취가 모이면, 자기 분야의 작은 지도가 되어 다음 분기의 첫 자리를 가볍게 만들어 줘요.',
  },
  // 3. ct=2, P3 short (35ch) -> insert-P3, 비유
  {
    id: 'career.thisWeek.standard.balanced.neutral.004',
    voice: '비유',
    mode: 'insert-P3',
    para:
      '비유하자면 이번 주는 자기 책상 위 서랍 한 칸을 가지런히 다듬어 두는 자리예요. 굳이 큰 가구를 옮기지 않아도 작은 서랍의 정돈이 다음 주 자기 손길의 속도를 한 뼘 빠르게 만들어 줘요.',
  },
  // 4. ct=2, P3 substantive (67ch) -> append-P4, 맥락
  {
    id: 'expression_children.life.standard.0_9.002',
    voice: '맥락',
    mode: 'append-P4',
    para:
      '평생 자리에서 보면 어린 시절의 자유로운 표현이 10대·20대 자기 색의 뿌리로 자라요. 지금 한 줄의 동요, 한 장의 그림이 평생 자기를 또렷하게 받쳐 주는 작은 씨앗으로 남아 있어요.',
  },
  // 5. ct=2, P3 aphorism (51ch) -> insert-P3, 맥락
  {
    id: 'family.thisMonth.standard.elder.008',
    voice: '맥락',
    mode: 'insert-P3',
    para:
      '평생 자리에서 보면 어른의 한 달 호흡이 가족 전체의 자리를 부드럽게 만들어 줘요. 굳이 큰 일정을 만들지 않아도 가까운 사람과의 짧은 안부가 한 달 안의 따뜻한 자취로 모여 있어요.',
  },
  // 6. ct=2, P3 substantive cautionary (62ch) -> append-P4, 비유
  {
    id: 'movement.thisYear.standard.0_9.002',
    voice: '비유',
    mode: 'append-P4',
    para:
      '비유하자면 올해의 이동은 어린 새가 마당에서 작은 나뭇가지로 옮겨 앉아 보는 자리예요. 한 번의 작은 옮겨 앉음이 자기 날개에 자기 무게를 익히게 도와주어 다음 한 해의 첫 비행을 가볍게 만들어 줘요.',
  },
  // 7. ct=2, P3 short (36ch) -> insert-P3, 비유
  {
    id: 'overall.today.standard.balanced.neutral.008',
    voice: '비유',
    mode: 'insert-P3',
    para:
      '비유하자면 오늘은 잔잔한 호숫가에 작은 조약돌 하나를 살며시 놓아 두는 자리예요. 큰 파동을 만들지 않아도 한 점의 자취가 천천히 퍼져 자기 페이스의 자리를 부드럽게 받쳐 줘요.',
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

// Truncated-endings scan
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
