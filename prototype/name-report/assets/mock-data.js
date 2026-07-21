/*
 * Mock cases for the name-report UI prototype.
 * Text comes from real assembled reports (name-evidence pipeline, 2026-07-21):
 *   - mina   : cheon-mina  (nameEffect = boost_strong)
 *   - yajang : cheon-yajang (nameEffect = adverse) — same saju, different name
 * Frame stroke numbers for "yajang" are demo values; grades follow the real report.
 */
window.NS_CASES = {
  mina: {
    id: 'mina',
    surname: { hangul: '천', hanja: '千', onset: 'ㅊ', el: 'metal' },
    given: [
      { hangul: '민', hanja: '旼', onset: 'ㅁ', el: 'water', resource: 'fire', strokes: 8, meaning: '온화할 민, 화락할 민', rel: 'match', relLabel: '용신 일치' },
      { hangul: '아', hanja: '雅', onset: 'ㅇ', el: 'earth', resource: 'fire', strokes: 12, meaning: '맑을 아, 바를 아', rel: 'match', relLabel: '용신 일치' }
    ],
    nameEffect: 'boost_strong',
    verdict: '필요한 기운을 정면으로 살리는 이름이에요',
    verdictSub: '타고난 바탕과 이름의 방향이 같은 곳을 보고 있어요 · 이름 작용 강한 보강',
    score: 84,
    tracks: {
      sound: { state: 'mixed', label: '대체로 순함' },
      frames: { state: 'mixed', label: '대체로 밝음' },
      chars: { state: 'good', label: '정면 보강' }
    },
    flow: [
      { fromIdx: 'surname', toIdx: 0, kind: 'good', rel: '살려 줌', zone: '성-이름 경계' },
      { fromIdx: 0, toIdx: 1, kind: 'clash', rel: '부딪힘', zone: '이름 안쪽' }
    ],
    flowText: {
      plain: '성 천(千)의 첫소리 ㅊ은 쇠 기운, 민(旼)의 첫소리 ㅁ은 물 기운이에요. 쇠가 물을 낳아 주는 순서라 첫 만남 자리의 소리가 부딪힘 없이 흘러요. 민(旼)의 ㅁ은 물, 아(雅)의 ㅇ은 흙 기운이에요. 흙이 물을 막는 관계라 이름 안쪽에서 두 소리가 부딪히며 만나요. 울림소리끼리 맞닿는 연결이 있어 살짝 뭉쳐 들릴 수 있지만, 또렷하게 불러 주면 자연스럽게 풀리는 정도예요.',
      expert: '성과 이름 경계 천(千)→민(旼) 전이는 금생수의 상생이에요. 앞 글자의 ㅊ 소리가 뒤 글자의 ㅁ 소리를 생하는 순방향이라 도입부 흐름이 매끄러워요. 이름 안쪽 민(旼)→아(雅) 전이는 토극수의 역방향 상극이에요. 뒤 글자의 ㅇ 소리가 앞 글자의 ㅁ 소리를 극하는 자리라 짚어 둘 부딪힘이에요. 받침 울림소리 연쇄는 위험도가 낮은 신호예요.'
    },
    frames: [
      { name: '원격', calc: '8 + 12', num: 20, time: '어린 시절의 터', grade: 'heavy', gradeLabel: '주의가 필요한 수리' },
      { name: '형격', calc: '3 + 8', num: 11, time: '인생 한가운데의 기둥', grade: 'good', gradeLabel: '좋은 흐름' },
      { name: '이격', calc: '3 + 12', num: 15, time: '바깥세상과 만나는 문', grade: 'good', gradeLabel: '좋은 흐름' },
      { name: '정격', calc: '3 + 8 + 12', num: 23, time: '삶 전체를 담는 그릇', grade: 'best', gradeLabel: '가장 좋은 흐름' }
    ],
    framesText: {
      plain: '원격은 가장 무거운 흐름에 놓여 있어, 출발점의 기반은 생활에서 다져 주는 편이 좋아요. 형격과 이격은 좋은 흐름이라 중심 활동이 안정되게 받쳐지고, 평판과 도움이 밖에서 들어오는 방향이에요. 정격은 가장 좋은 흐름에 놓여 있어 삶의 매듭과 마무리를 든든하게 받쳐 줘요.',
      expert: '원격이 최흉운수 등급이에요. 초년 기반의 수리가 무겁게 놓인 만큼, 성장기의 안정은 수리 밖에서 받쳐 줄 필요가 있어요. 형격과 이격이 상운수, 정격이 최상운수 등급이라 흐름의 큰 그릇은 넉넉하게 놓인 구성이에요.'
    },
    charsText: {
      plain: '민(旼)과 아(雅)에 담긴 불 기운은 이 사주에 필요한 기운 그 자체예요. 이름을 부르고 쓸 때마다 필요한 기운이 함께 따라오는 셈이라, 이름 안에서 가장 든든한 몫을 하는 자리예요.',
      expert: '민(旼)과 아(雅)의 자원오행 화는 용신과 일치해요. 필요한 오행을 글자 자체에 담아 상시로 보강하는 구성이에요. 이름의 자원오행이 용신을 두 자리 이상에서 담아, 발음이나 수리가 아니라 자원오행 트랙에서 확보한 보강이라 상시로 작동해요.'
    },
    recap: {
      plain: [
        { state: 'mixed', text: '소리 사이에는 살려 주는 연결과 부딪히는 연결이 섞여 있어요. 부르는 데 무리는 없지만 한 번 걸리는 자리가 있어요.' },
        { state: 'mixed', text: '획수 풀이는 대체로 밝은 가운데 한 자리가 무겁게 놓여 있어요. 무거운 자리는 삶 전체가 아니라 한 시기의 이야기예요.' },
        { state: 'good', text: '글자에 담긴 기운은 필요한 쪽을 정면으로 채우고 있어요. 세 갈래 가운데 가장 힘 있는 대목이고, 이 이름을 좋게 보는 중심 근거예요.' }
      ],
      expert: [
        { state: 'mixed', text: '발음오행 배열에 상생과 상극이 섞여 있으나 발음 갈래의 감점은 제한적이에요.' },
        { state: 'mixed', text: '수리사격에서 한 격만 흉 등급이라 전체 수리의 균형은 길한 쪽으로 기울어 있어요.' },
        { state: 'good', text: '자원오행이 용신을 두 자리 이상에서 담은 배치라, 세 갈래 가운데 무게가 가장 큰 가점 요인이에요.' }
      ]
    },
    closing: {
      plain: '두텁게 쌓인 밭의 흙은 그 자체로 든든한 바탕이에요. 여기에 이름이 밭을 데우는 불 기운을 넉넉히 실어 주어, 배움을 바탕 삼는 타고난 결이 한층 순하게 살아나요. 잘 데워진 밭은 심는 대로 넉넉히 길러 내요.',
      expert: '정인격의 배움 중심 구조에 이름의 자원오행이 용신 화를 정면으로 실어, 인성의 축이 한층 단단해진 구성이에요. 유의점은 과유불급이라, 비겁과 인성이 함께 두터워지면 식상으로 내보내는 통로를 함께 여는 편이 좋아요.'
    },
    guide: [
      '좋은 스승과 좋은 책 곁에 머무는 시간이 가장 남는 걸음이에요.',
      '벌여 놓은 일이 많아지지 않게 갈래를 고르는 눈은 필요해요.'
    ],
    cta: { kind: 'share', label: '이 이름, 잘 지어졌어요 — 보고서 공유하기' },
    evidence: {
      pron: '천→민 금생수(상생) · 민→아 토극수(역방향 상극)',
      frames: '원 20 · 형 11 · 이 15 · 정 23'
    }
  },

  yajang: {
    id: 'yajang',
    surname: { hangul: '천', hanja: '千', onset: 'ㅊ', el: 'metal' },
    given: [
      { hangul: '야', hanja: '也', onset: 'ㅇ', el: 'earth', resource: 'water', strokes: 3, meaning: '어조사 야, 또 야', rel: 'controls', relLabel: '용신을 누름' },
      { hangul: '장', hanja: '奘', onset: 'ㅈ', el: 'metal', resource: 'wood', strokes: 10, meaning: '클 장, 튼튼할 장', rel: 'generates', relLabel: '용신을 길러 줌' }
    ],
    nameEffect: 'adverse',
    verdict: '필요한 기운은 이름 밖에서 챙겨야 하는 구성이에요',
    verdictSub: '이름이 흐름을 무너뜨리는 것은 아니에요 · 이름 작용 아쉬움',
    score: 62,
    tracks: {
      sound: { state: 'good', label: '순하게 이어짐' },
      frames: { state: 'good', label: '고르게 밝음' },
      chars: { state: 'bad', label: '보강 없음' }
    },
    flow: [
      { fromIdx: 'surname', toIdx: 0, kind: 'good', rel: '받쳐 줌', zone: '성-이름 경계' },
      { fromIdx: 0, toIdx: 1, kind: 'good', rel: '살려 줌', zone: '이름 안쪽' }
    ],
    flowText: {
      plain: '성 천(千)의 첫소리 ㅊ은 쇠 기운, 야(也)의 첫소리 ㅇ은 흙 기운이에요. 흙이 쇠를 길러 주는 관계라 첫 만남 자리의 소리가 안정되게 이어져요. 야(也)의 ㅇ은 흙, 장(奘)의 ㅈ은 쇠 기운이에요. 흙 속에서 쇠가 여물어 나오는 순서라 이름 안쪽 소리가 순하게 이어져요. 울림소리끼리 맞닿는 연결이 있어 살짝 뭉쳐 들릴 수 있지만, 또렷하게 불러 주면 자연스럽게 풀리는 정도예요.',
      expert: '성과 이름 경계 천(千)→야(也) 전이는 토생금이에요. 뒤 글자의 ㅇ 소리가 앞 글자의 ㅊ 소리를 생하는 역방향 상생이라 부딪힘 없이 받쳐 주는 연결이에요. 이름 안쪽 야(也)→장(奘) 전이는 토생금의 상생이에요. 앞 글자의 ㅇ 소리가 뒤 글자의 ㅈ 소리를 생조하는 순방향이라 소리의 결이 순해요.'
    },
    frames: [
      { name: '원격', calc: '3 + 10', num: 13, time: '어린 시절의 터', grade: 'best', gradeLabel: '가장 좋은 흐름' },
      { name: '형격', calc: '3 + 3', num: 6, time: '인생 한가운데의 기둥', grade: 'good', gradeLabel: '좋은 흐름' },
      { name: '이격', calc: '3 + 10', num: 13, time: '바깥세상과 만나는 문', grade: 'best', gradeLabel: '가장 좋은 흐름' },
      { name: '정격', calc: '3 + 3 + 10', num: 16, time: '삶 전체를 담는 그릇', grade: 'best', gradeLabel: '가장 좋은 흐름' }
    ],
    framesText: {
      plain: '원격은 가장 좋은 흐름에 놓여 있어 출발과 성장기의 기반을 든든하게 받쳐 줘요. 형격은 좋은 흐름이라 중심 활동이 안정되게 받쳐지는 방향이에요. 이격과 정격도 가장 좋은 흐름에 놓여 있어, 평판과 도움이 잘 들어오고 삶의 매듭과 마무리를 든든하게 받쳐 줘요.',
      expert: '원격이 최상운수, 형격이 상운수, 이격과 정격이 최상운수 등급이에요. 초년·중년·대외·총운의 수리가 고르게 밝아 감점 없이 받쳐 주는 배치예요.'
    },
    charsText: {
      plain: '야(也)의 물 기운은 이 사주에 필요한 불 기운과 부딪히는 방향이에요. 필요한 쪽을 살리지 못하고 눌러 버리는 자리라, 이 글자의 기운에 기대기는 어려워요. 장(奘)에 담긴 나무 기운은 필요한 불 기운을 길러 주는 바탕이에요. 필요한 기운을 직접 담지는 않았지만, 그 기운이 살아나도록 밑을 받쳐 줘요.',
      expert: '야(也)의 자원오행 수는 수극화로 용신을 누르는 방향이라 자원오행 트랙의 감점 지점이에요. 장(奘)의 자원오행 목은 목생화로 용신을 생조해요. 용신을 직접 담지 않아도 그 원천이 되어 주는 자리라, 보강의 결이 한 단계 건너 이어지는 배치예요.'
    },
    recap: {
      plain: [
        { state: 'good', text: '이름을 이루는 소리는 서로 기운을 살려 주는 방향으로만 이어져요. 소리 쪽에서는 이 이름이 챙길 숙제가 없는 셈이에요.' },
        { state: 'good', text: '이름의 획수 풀이는 보는 자리마다 좋은 흐름에 놓여 있어요. 획수 쪽에서는 더 바랄 것이 없는 짜임이에요.' },
        { state: 'bad', text: '글자에 담긴 기운은 이 사주에 필요한 쪽을 채우지 못하고 있어요. 세 갈래 가운데 가장 아쉬운 대목이라, 그 몫은 배움과 생활에서 챙기는 편이 좋아요.' }
      ],
      expert: [
        { state: 'good', text: '발음오행 전이가 상생과 동기 관계로만 이어진 배열이라 소리 흐름의 감점이 없는 구성이에요.' },
        { state: 'good', text: '수리사격의 서술 대상 격이 모두 길한 등급이라 수리 갈래는 뚜렷한 가점 요인이에요.' },
        { state: 'bad', text: '자원오행이 용신을 담지 못하고 기신 쪽에 무게가 실린 배치라, 글자 갈래의 공백이 핵심 감점이에요.' }
      ]
    },
    closing: {
      plain: '밭의 흙은 두텁고 넉넉하지만, 이 이름은 밭을 데워 줄 불 기운을 담지 못했어요. 그렇다고 밭이 식어 버리는 것은 아니고, 데울 불을 이름 밖에서 찾으면 돼요. 배움과 좋은 어른 곁에 머무는 시간, 몸을 따뜻하게 돌보는 생활이 이 밭을 기름지게 해요.',
      expert: '정인격의 배움 축이 원국의 중심이지만, 이름의 자원오행이 용신 화를 싣지 못하고 기신 쪽에 무게가 실린 구성이에요. 신강한 바탕이라 이름의 공백이 치명적이지는 않아요. 데우는 통로만 꾸준히 이어지면 결실은 따라오는 배치예요.'
    },
    guide: [
      '배움과 좋은 어른 곁에 머무는 시간이 이 밭을 기름지게 해요.',
      '몸을 따뜻하게 돌보는 생활이 이름의 빈자리를 넉넉히 메워요.'
    ],
    cta: { kind: 'recommend', label: '이 사주에 꼭 맞는 이름 찾아보기' },
    evidence: {
      pron: '천→야 토생금(역방향 상생) · 야→장 토생금(상생)',
      frames: '원 13 · 형 6 · 이 13 · 정 16'
    }
  }
};

/* Shared saju block — both demo cases share the same birth chart (1991-02-18 05:25, from
 * the engine-generated cheon-mina case.json). Pillars are hand-derived for the prototype
 * (year/month by solar terms, day by JDN, hour 05:25 = in-si with byeong-in stem); the day
 * master gi matches the engine judgment. Real wiring replaces these with engine pillars. */
window.NS_SAJU = {
  /* 년 → 월 → 일 → 시 display order. Day pillar is marked with isDay. */
  pillars: [
    { pos: '년주', stem: ['辛', '신', 'metal'], branch: ['未', '미', 'earth'] },
    { pos: '월주', stem: ['庚', '경', 'metal'], branch: ['寅', '인', 'wood'] },
    { pos: '일주', stem: ['己', '기', 'earth'], branch: ['未', '미', 'earth'], isDay: true },
    { pos: '시주', stem: ['丙', '병', 'fire'], branch: ['寅', '인', 'wood'], isHour: true }
  ],
  dayMaster: { hanja: '己', label: '기토', figure: '곡식을 기르는 밭의 흙', state: '지금은 흙이 두텁게 쌓여 기운이 넉넉하게 넘치는 상태예요.' },
  /* strength detail bars are illustrative (engine exposes deukryeong/deukji/deukse). */
  strength: { level: '신강', pos: 68, deuk: [{ k: '득령', v: 10 }, { k: '득지', v: 90 }, { k: '득세', v: 65 }] },
  yongshin: {
    el: 'fire', hanja: '火', label: '밭을 데우는 불 기운',
    plain: '배움과 사람의 도움이 그 불을 살리는 통로가 돼요.',
    expert: '용신 화 · 희신 금 · 기신 목 — 정인격(배움 중심 구조), 화생토로 일간을 직접 생하는 인성이에요.'
  },
  gyeokguk: '정인격 (인성 계열)',
  evidence: { dm: '기(토) / 신강', ys: '화 · 금 · 목', gg: '정인격 (인성 계열)' }
};

window.NS_EL_LABEL = { wood: '나무', fire: '불', earth: '흙', metal: '쇠', water: '물' };
window.NS_EL_SHORT = { wood: '목', fire: '화', earth: '토', metal: '금', water: '수' };
