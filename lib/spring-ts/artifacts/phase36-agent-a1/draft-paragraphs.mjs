// Phase 36 Agent A1 -- draft new paragraphs and verify constraints
// Each paragraph: 96-115 chars, 0 흐름이, 0 결, sentence-final 요-endings, no jargon
// 5 ct=2 fragments => +10 cells (4p band 130 -> 140)

const drafts = [
  // 1. ct=2, P3 short aphorism (34ch) -> insert-P3, 비유
  {
    id: 'career.today.standard.balanced.neutral.004',
    voice: '비유',
    mode: 'insert-P3',
    para:
      '비유하자면 오늘은 도예가가 손에 쥔 흙을 천천히 다듬어 두는 자리예요. 굳이 큰 모양을 잡지 않아도 손끝의 작은 매만짐이 다음 자리의 단단한 형태를 자연스럽게 만들어 줘요.',
  },
  // 2. ct=2, P3 substantive (60ch) -> append-P4, 맥락
  {
    id: 'expression_children.thisMonth.standard.30_39.005',
    voice: '맥락',
    mode: 'append-P4',
    para:
      '한 분기 자리에서 보면 이번 달의 작은 협업 한 자리가 다음 분기 자기 표현의 단단한 디딤판으로 남아요. 가까운 사람과 함께 놓아 둔 한 줄이 자기 작업의 자취를 또렷하게 받쳐 줘요.',
  },
  // 3. ct=2, P3 short aphorism (24ch) -> insert-P3, 실천
  {
    id: 'family.thisWeek.standard.thirties.005',
    voice: '실천',
    mode: 'insert-P3',
    para:
      '주말 저녁에는 가족 한 사람과 짧은 산책 한 자리를 정해 두세요. 다섯 분 남짓의 그 자리가 한 주 동안 쌓인 마음의 자취를 가볍게 풀어 주어 다음 주의 첫 자리를 따뜻하게 만들어 줘요.',
  },
  // 4. ct=2, P3 substantive (84ch) -> append-P4, 비유
  {
    id: 'health.life.standard.female.001',
    voice: '비유',
    mode: 'append-P4',
    para:
      '비유하자면 평생의 컨디션은 마당 한쪽 우물물처럼 천천히 차오르는 자리예요. 한 번에 길어 올리지 않아도 매일 두 손으로 가만히 떠 두는 작은 자리가 평생을 든든하게 받쳐 줘요.',
  },
  // 5. ct=2, P3 substantive (62ch) -> append-P4, 실천
  {
    id: 'movement.thisWeek.standard.0_9.002',
    voice: '실천',
    mode: 'append-P4',
    para:
      '주중 한 번은 아이 손에 작은 종이 한 장과 색연필 한 자루를 쥐어 주세요. 외출 자리에서 본 풍경 한 장면을 짧게 그려 두는 자리가 한 주의 자취를 따뜻한 추억으로 모아 줘요.',
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
