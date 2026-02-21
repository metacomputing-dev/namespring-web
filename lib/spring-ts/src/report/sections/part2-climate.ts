/**
 * part2-climate.ts -- 기후·조후(調候) 분석 섹션
 *
 * PART 2-4: 사주의 기후적 특성(온도/습도 균형)을 분석합니다.
 * 출생 계절에 따른 환경 온습도와 필요 온습도의 GAP을 진단합니다.
 *
 * 페르소나: "자연 다큐멘터리 내레이터"
 * BBC 다큐멘터리처럼 자연의 경이로움을 전달하는 웅장하면서도 따뜻한 톤.
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportChart,
  ReportHighlight,
  ElementCode,
} from '../types.js';

import {
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
  elementCodeToKorean,
} from '../common/elementMaps.js';

import {
  createRng,
  pickAndFill,
  narrative,
  positive,
  caution,
  tip,
  emphasis,
  encouraging,
  SeededRandom,
} from '../common/sentenceUtils.js';

// ─────────────────────────────────────────────────────────────────────────────
//  헬퍼
// ─────────────────────────────────────────────────────────────────────────────

function safeName(input: ReportInput): string {
  return input.name?.trim() || '회원';
}

function elFull(c: string | undefined): string {
  return c ? (ELEMENT_KOREAN[c as ElementCode] ?? c) : '?';
}

function elShort(c: string | undefined): string {
  return c ? (ELEMENT_KOREAN_SHORT[c as ElementCode] ?? c) : '?';
}

/** 부호 포함 정수 문자열 */
function signedInt(v: number): string {
  const r = Math.round(v);
  return r > 0 ? `+${r}` : `${r}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  계절 한글 매핑 & 자연 비유
// ─────────────────────────────────────────────────────────────────────────────

const SEASON_KOREAN: Record<string, string> = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울',
  lateSpring: '늦은 봄',
  earlySummer: '초여름',
  lateSummer: '늦여름',
  earlyAutumn: '초가을',
  lateAutumn: '늦가을',
  earlyWinter: '초겨울',
  transition: '환절기',
};

// ─────────────────────────────────────────────────────────────────────────────
//  도입 템플릿 — 자연 다큐멘터리 내레이터 톤
// ─────────────────────────────────────────────────────────────────────────────

const INTRO_TEMPLATES: readonly string[] = [
  '한여름 뜨거운 대지에 내리는 소나기처럼, 사주에도 기후의 균형이 필요합니다. 조후(調候)란 바로 그 자연의 조화를 사주에서 읽어내는 분석이에요.',
  '거대한 지구가 사계절을 순환하듯, 사주 역시 태어난 계절의 온도와 습기를 품고 있는 법이에요. 이 기후의 균형을 살피는 것, 그것이 조후 분석이랍니다.',
  '아프리카 사바나의 건기와 우기가 생태계를 좌우하듯, 사주의 온습도 균형은 삶의 흐름에 깊은 영향을 미치는 거랍니다. 지금부터 그 기후의 비밀을 풀어볼게요.',
  '새벽 안개가 서서히 걷히며 초원에 햇살이 내려앉는 풍경을 상상해 보세요. 사주의 조후란, 바로 그런 자연의 섬세한 균형을 읽어내는 지혜라고 볼 수 있어요.',
  '봄비가 대지를 적시고, 여름 태양이 만물을 키우고, 가을바람이 곡식을 영글게 하고, 겨울 눈이 땅을 품어주듯 — 사주에도 이런 기후의 리듬이 새겨져 있거든요.',
  '대자연의 시계는 멈추는 법이 없습니다. 해가 뜨고 지는 것처럼, 사주에 깃든 기후의 균형도 끊임없이 우리 삶에 영향을 주고 있는 셈이죠.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  계절별 서사적 설명
// ─────────────────────────────────────────────────────────────────────────────

const SEASON_NARRATIVE: Record<string, readonly string[]> = {
  spring: [
    '이 사주는 봄의 풍경과도 같습니다. 얼었던 대지가 녹고 첫 새싹이 고개를 내미는 들판처럼, 목(木)의 생장 에너지가 사주 곳곳에 퍼져 있는 거랍니다.',
    '언 땅을 뚫고 피어나는 봄꽃처럼, {{이름}}님의 사주에는 싹을 틔우려는 뜨거운 생명력이 깃들어 있어요. 봄의 따스한 바람이 그 기운을 더욱 북돋워 주거든요.',
    '새벽녘 숲에서 들려오는 첫 번째 새소리처럼, {{이름}}님의 사주에는 생명이 깨어나는 봄의 에너지가 가득 담겨 있다고 볼 수 있어요.',
  ],
  summer: [
    '이 사주는 한여름 정오의 태양 아래 펼쳐진 들판과도 같습니다. 대지가 달구어지고 아지랑이가 피어오르듯, 화(火)의 뜨거운 기운이 사주를 가득 채우고 있는 셈이죠.',
    '한낮의 태양이 호수 위에 부서지며 반짝이듯, {{이름}}님의 사주에는 여름의 강렬한 에너지가 타오르고 있어요. 빛과 열정이 넘치는 기운이나 다름없어요.',
    '여름 소나기 직전, 먹구름 사이로 번개가 번쩍이는 장면을 떠올려 보세요. {{이름}}님의 사주에는 바로 그런 폭발적인 여름의 활력이 자리 잡고 있는 거랍니다.',
  ],
  autumn: [
    '이 사주는 가을 석양이 물드는 산야와도 같습니다. 서늘한 바람에 은행잎이 하나둘 떨어지듯, 금(金)의 맑고 단단한 기운이 사주를 감싸고 있는 법이에요.',
    '황금빛 들녘에서 고개 숙인 벼이삭처럼, {{이름}}님의 사주에는 가을 수확의 풍요로운 에너지가 가득해요. 결실과 성숙의 계절이 사주에 새겨져 있는 거랍니다.',
    '서리 내린 새벽, 맑은 하늘 아래 단풍이 붉게 물드는 풍경을 상상해 보세요. {{이름}}님의 사주에는 바로 그런 가을의 선명한 기운이 깃들어 있다고 볼 수 있어요.',
  ],
  winter: [
    '이 사주는 한겨울의 풍경과도 같습니다. 차가운 대지 위에 하얀 눈이 소복이 쌓이고, 얼어붙은 호수 아래로 수(水)의 깊은 기운이 고요히 흐르고 있는 셈이죠.',
    '밤하늘에 쏟아지는 겨울 별처럼, {{이름}}님의 사주에는 고요하면서도 깊은 물의 지혜가 잠들어 있어요. 겨울의 정적 속에 새봄을 준비하는 에너지가 숨어 있는 거랍니다.',
    '눈 덮인 침엽수림 사이로 바람 소리만 울리는 겨울 숲을 떠올려 보세요. {{이름}}님의 사주에는 그처럼 깊고 묵직한 겨울의 기운이 자리 잡고 있는 법이에요.',
  ],
  transition: [
    '이 사주는 계절이 바뀌는 그 찰나의 풍경과도 같습니다. 비가 갠 뒤 무지개가 떠오르듯, 토(土)의 중재하는 기운이 사주 한가운데서 다른 오행들을 감싸 안고 있는 셈이죠.',
    '산등성이에 걸린 안개가 서서히 흩어지며 새로운 풍경을 드러내듯, {{이름}}님의 사주에는 환절기 특유의 변화무쌍한 에너지가 담겨 있는 거랍니다.',
    '봄과 여름 사이, 혹은 가을과 겨울 사이 — 그 미묘한 전환의 순간처럼, {{이름}}님의 사주에는 안정과 변화가 공존하는 토(土)의 기운이 깃들어 있다고 볼 수 있어요.',
  ],
};

/** lateSpring, earlySummer 등 세분화 계절을 기본 4계절+환절기 키로 매핑 */
function seasonGroupToKey(sg: string): string {
  if (sg.includes('pring')) return 'spring';
  if (sg.includes('ummer')) return 'summer';
  if (sg.includes('utumn')) return 'autumn';
  if (sg.includes('inter')) return 'winter';
  return 'transition';
}

// ─────────────────────────────────────────────────────────────────────────────
//  온도 GAP — 자연 비유 진단
// ─────────────────────────────────────────────────────────────────────────────

interface GapDiagnosis {
  label: string;   // 테이블용 짧은 라벨 (양호/과열/과냉/과습/과건)
  tone: 'positive' | 'negative' | 'neutral';
}

function diagnoseTempGap(gap: number): GapDiagnosis & { narrative: readonly string[] } {
  if (gap > 30) {
    return {
      label: '과열',
      tone: 'negative',
      narrative: [
        '한낮의 사막처럼 타오르는 열기가 사주에 가득해요. 시원한 계곡물 같은 수(水)나 서늘한 바위 같은 금(金)의 기운이 절실하게 필요한 상황이에요.',
        '적도 부근의 열대우림처럼 뜨거운 공기가 사주를 감싸고 있어요. 시원한 바람을 불어넣어 줄 수(水)·금(金)의 기운이 꼭 필요하거든요.',
        '용암이 흐르는 화산 지대처럼, 사주에 열기가 과도하게 쏠려 있는 셈이죠. 깊은 바다 같은 수(水)의 냉각이 필요한 상태예요.',
      ],
    };
  }
  if (gap > 15) {
    return {
      label: '과열',
      tone: 'negative',
      narrative: [
        '늦여름 오후, 볕이 내리쬐는 들판처럼 사주가 다소 뜨거운 편이에요. 시원한 기운(수/금)이 그늘막 역할을 해줄 수 있답니다.',
        '뙤약볕 아래 마른 풀이 바스라지듯, 사주에 열기가 좀 과한 편이에요. 한줄기 시원한 바람 같은 금(金)·수(水)의 보충이 도움이 될 거예요.',
        '해질 무렵에도 열기가 쉽게 가시지 않는 여름 도시처럼, 사주에 온기가 조금 넘치는 상태라고 볼 수 있어요.',
      ],
    };
  }
  if (gap < -30) {
    return {
      label: '과냉',
      tone: 'negative',
      narrative: [
        '북극 한가운데 놓인 것처럼 사주가 몹시 차가운 상태예요. 모닥불 같은 화(火)의 따뜻한 기운과 봄의 싹을 틔우는 목(木)의 에너지가 간절히 필요하거든요.',
        '시베리아 동토층처럼 꽁꽁 언 사주를 녹이려면, 타오르는 화(火)와 생명을 불어넣는 목(木)의 기운이 반드시 필요해요.',
        '겨울 한밤중 얼어붙은 호수와도 같은 사주예요. 햇살처럼 따사로운 화(火)·목(木)의 기운이 이 얼음을 녹여줄 수 있답니다.',
      ],
    };
  }
  if (gap < -15) {
    return {
      label: '과냉',
      tone: 'negative',
      narrative: [
        '늦가을 새벽, 서리가 내린 들판처럼 사주가 다소 서늘한 편이에요. 따뜻한 화(火)의 기운과 싱그러운 목(木)의 에너지가 온기를 더해줄 수 있답니다.',
        '이른 아침 안개 낀 산골 마을처럼 사주가 좀 차가운 편이에요. 봄 햇살 같은 화(火)·목(木)의 보충이 온기를 불어넣어 줄 거예요.',
        '겨울 초입, 첫 서리가 내린 지붕처럼 사주에 냉기가 좀 돌고 있는 상태라고 볼 수 있어요. 따뜻한 기운이 필요하거든요.',
      ],
    };
  }
  return {
    label: '양호',
    tone: 'positive',
    narrative: [
      '봄날 오후 적당히 따사로운 양지바른 언덕처럼, 사주의 온도가 잘 맞아 있어요. 자연이 스스로 균형을 찾은 것이나 다름없는 상태랍니다.',
      '맑은 가을 하늘 아래 선선한 바람이 부는 것처럼, 사주의 온도 균형이 아주 양호해요. 이 자체로 훌륭한 기후 조건을 갖추고 있는 셈이죠.',
      '이른 아침 이슬 맺힌 풀잎에 햇살이 비치는 풍경처럼, 사주의 온도가 절묘한 균형을 이루고 있다고 볼 수 있어요.',
    ],
  };
}

function diagnoseHumidGap(gap: number): GapDiagnosis & { narrative: readonly string[] } {
  if (gap > 30) {
    return {
      label: '과습',
      tone: 'negative',
      narrative: [
        '열대 우림의 습한 공기처럼 사주에 수분이 과하게 차 있어요. 뜨거운 태양 같은 화(火)나 단단한 흙 같은 토(土)의 기운이 습기를 거둬들일 수 있답니다.',
        '장마철 끝없이 쏟아지는 빗줄기처럼, 사주에 습기가 많이 몰려 있는 상태예요. 햇볕을 품은 화(火)·토(土)의 기운이 균형을 잡아줄 수 있어요.',
        '안개가 자욱한 열대 늪지처럼 사주에 습기가 가득해요. 마른 바람 같은 화(火)와 흙의 흡수력인 토(土)가 필요하거든요.',
      ],
    };
  }
  if (gap > 15) {
    return {
      label: '과습',
      tone: 'negative',
      narrative: [
        '이른 아침 물안개가 피어오르는 호숫가처럼 사주에 습기가 좀 많은 편이에요. 따뜻한 화(火)의 기운이 안개를 걷어줄 수 있답니다.',
        '장마 초입의 눅눅한 공기처럼, 사주에 수분이 다소 과한 상태예요. 건조한 기운(화/토)이 이 습기를 적절히 다스려줄 수 있어요.',
        '비 온 뒤 젖은 흙냄새가 진하게 나는 숲처럼, 사주에 습기가 조금 넘치는 상태라고 볼 수 있어요.',
      ],
    };
  }
  if (gap < -30) {
    return {
      label: '과건',
      tone: 'negative',
      narrative: [
        '바싹 갈라진 사막의 메마른 대지처럼 사주가 극도로 건조한 상태예요. 오아시스 같은 수(水)의 기운과 초목의 촉촉함인 목(木)의 에너지가 절실하게 필요해요.',
        '끝없이 펼쳐진 건조한 초원에 비 한 방울 내리지 않는 것처럼, 사주에 수분이 극히 부족한 상태예요. 수(水)·목(木)의 기운이 생명의 물을 가져다줄 수 있답니다.',
        '사하라의 모래바람처럼, 사주에서 수분이 거의 증발해 버린 셈이에요. 깊은 우물처럼 수(水)의 기운을 보충해야 하는 상태거든요.',
      ],
    };
  }
  if (gap < -15) {
    return {
      label: '과건',
      tone: 'negative',
      narrative: [
        '가을 들판의 마른 풀처럼 사주가 다소 건조한 편이에요. 촉촉한 이슬 같은 수(水)의 기운과 푸른 나무 같은 목(木)의 에너지가 윤기를 더해줄 수 있어요.',
        '서리가 내린 뒤 바싹 마른 낙엽처럼, 사주에 수분이 좀 부족한 상태예요. 수(水)·목(木)의 기운이 촉촉함을 불어넣어 줄 거예요.',
        '맑은 겨울날 차갑고 건조한 바람이 부는 것처럼, 사주에 습기가 다소 모자란 상태라고 볼 수 있어요.',
      ],
    };
  }
  return {
    label: '양호',
    tone: 'positive',
    narrative: [
      '봄비가 적당히 내린 뒤 촉촉한 대지처럼, 사주의 습도 균형이 훌륭해요. 마치 자연이 빚어낸 완벽한 기후 조건이나 다름없는 상태랍니다.',
      '아침 이슬이 잎사귀 끝에 맺혀 영롱하게 빛나듯, 사주의 습도가 딱 알맞은 수준이에요. 이 균형 자체가 큰 축복인 셈이죠.',
      '잔잔한 호수 위에 물안개가 살짝 피어오르는 평화로운 풍경처럼, 사주의 수분 균형이 안정적이라고 볼 수 있어요.',
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  오행 기후 점수 — 자연 비유 코멘트
// ─────────────────────────────────────────────────────────────────────────────

const SCORE_BEST_TEMPLATES: readonly string[] = [
  '기후의 관점에서 보면, {{오행}} 기운이 가장 큰 도움을 주고 있어요. 마치 가뭄에 단비가 내리듯, 이 오행이 사주의 기후 균형을 잡아주는 핵심 열쇠인 셈이죠.',
  '자연이 스스로 균형을 찾아가듯, {{오행}}의 기운이 사주의 온습도를 조율하는 결정적 역할을 하고 있는 거랍니다. 기후 보정 점수가 {{점수}}점으로 가장 높거든요.',
  '드넓은 초원에서 바람이 씨앗을 퍼뜨리듯, {{오행}}의 기운이 사주의 기후를 가장 효과적으로 보완해 주고 있는 법이에요. 보정 점수 {{점수}}점이 이를 증명하는 셈이죠.',
];

const SCORE_WORST_TEMPLATES: readonly string[] = [
  '반면, {{오행}}의 기운은 기후 균형에 다소 역행하는 편이에요. 폭염 속에 불을 지피는 것과 비슷하다고 볼 수 있어요. 이 오행은 다른 영역에서 제 역할을 찾는 것이 좋겠어요.',
  '{{오행}} 기운은 현재 기후 조건에서 보면 기여도가 낮은 편이에요. 겨울에 얼음을 가져오는 것처럼 지금 필요한 방향과 다소 어긋나는 셈이죠.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  종합 균형 진단 — 서사적 마무리
// ─────────────────────────────────────────────────────────────────────────────

const BALANCE_GOOD_TEMPLATES: readonly string[] = [
  '전체적으로 사주의 기후 균형이 상당히 양호합니다. 봄날 화창한 오후, 산들바람이 부는 들판처럼 자연스러운 조화가 이루어져 있는 거랍니다. 이러한 기후 조건은 삶의 안정과 순탄함을 뒷받침해 줄 수 있어요.',
  '사주의 온도와 습도 모두 안정적인 범위 안에 있어요. 마치 온대 기후의 풍요로운 평야처럼, 사계절이 고르게 돌아가는 기후 조건을 타고난 셈이죠. 큰 보완 없이도 자연의 리듬을 잘 따라갈 수 있는 사주예요.',
];

const BALANCE_PARTIAL_TEMPLATES: readonly string[] = [
  '기후의 한쪽 축은 안정적이지만, 다른 한쪽에서 약간의 보완이 필요해요. 마치 맑은 날씨에 바람만 좀 강한 것처럼, 작은 조정으로도 큰 균형을 이룰 수 있는 상태랍니다.',
  '사주의 기후가 한쪽은 양호하고 다른 한쪽은 조금 치우쳐 있는 상태예요. 비가 적당히 내리지만 바람이 세찬 해안가처럼, 부분적인 보완이 도움이 될 수 있거든요.',
];

const BALANCE_NEED_TEMPLATES: readonly string[] = [
  '사주의 기후가 양쪽 모두 균형점에서 벗어나 있어요. 하지만 걱정할 필요는 없습니다. 거친 바다를 건너는 범선도 바람을 읽으면 순항할 수 있듯이, 적절한 오행 보완으로 기후의 균형을 맞출 수 있거든요.',
  '온도와 습도 모두 보완이 필요한 상태예요. 그러나 이것은 오히려 뚜렷한 방향성이 있다는 뜻이기도 해요. 사막에 나무를 심으면 오아시스가 되듯, 정확한 보완이 큰 변화를 만들어낼 수 있답니다.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  조언 마무리 — 자연 비유 + 다양한 어미
// ─────────────────────────────────────────────────────────────────────────────

const CLOSING_TEMPLATES: readonly string[] = [
  '자연은 언제나 균형을 향해 나아갑니다. 봄이 오면 얼음이 녹고, 가을이 오면 열매가 익듯이 — 사주의 기후도 적절한 오행 보완을 통해 더 나은 균형을 찾아갈 수 있어요. 용신 분석에서 그 구체적인 방법을 더 자세히 살펴보겠습니다.',
  '어떤 기후도 그 자체로 나쁜 것은 없습니다. 사막에는 사막의 아름다움이, 툰드라에는 툰드라의 경이로움이 있듯이요. 다만, 조후의 균형을 이해하면 삶의 에너지를 더 효율적으로 활용할 수 있는 법이에요.',
  '대자연의 기후는 거스를 수 없지만, 사주의 기후는 보완할 수 있습니다. 사막에도 관개 수로를 내면 옥토가 되듯, 부족한 기운을 채우는 지혜가 삶을 풍요롭게 만들어 준답니다.',
  '자연 다큐멘터리 끝에 언제나 희망의 메시지가 있듯이, 조후 분석도 마찬가지예요. 어떤 기후 조건이든 그에 맞는 보완책이 있거든요. 용신과 함께 살펴보면 더욱 뚜렷한 방향을 잡을 수 있을 거예요.',
  '계절이 바뀌면 자연도 준비를 합니다. 동물은 털을 갈아입고, 나무는 잎을 떨구거나 새 잎을 틔우듯이요. 사주의 기후에 맞춰 적절한 오행을 보강하는 것도 바로 그런 자연의 지혜를 따르는 것이랍니다.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  기후 데이터 추출
// ─────────────────────────────────────────────────────────────────────────────

interface ClimateData {
  seasonGroup: string;
  envTemp: number;
  envHumid: number;
  needTemp: number;
  needHumid: number;
  scores: Record<string, number>;
}

function extractClimate(input: ReportInput): ClimateData | null {
  const saju = input.saju as Record<string, unknown>;
  const rules = saju['rules'] as Record<string, unknown> | undefined;
  const facts = (rules?.['facts'] ?? saju['facts']) as Record<string, unknown> | undefined;
  const climate = (facts?.['climate'] ?? saju['climate']) as Record<string, unknown> | undefined;

  if (!climate) return null;

  const env = climate['env'] as Record<string, number> | undefined;
  const need = climate['need'] as Record<string, number> | undefined;
  const scores = climate['scores'] as Record<string, number> | undefined;

  return {
    seasonGroup: (climate['seasonGroup'] as string) ?? 'spring',
    envTemp: env?.['temperature'] ?? 50,
    envHumid: env?.['humidity'] ?? 50,
    needTemp: need?.['temperature'] ?? 50,
    needHumid: need?.['humidity'] ?? 50,
    scores: scores ?? {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  메인 생성 함수
// ─────────────────────────────────────────────────────────────────────────────

export function generateClimateSection(input: ReportInput): ReportSection | null {
  const climate = extractClimate(input);
  if (!climate) return null;

  const rng = createRng(input);
  for (let i = 0; i < 16; i++) rng.next();

  const name = safeName(input);
  const paragraphs: ReportParagraph[] = [];

  // ── 1. 도입: 자연 다큐멘터리 오프닝 ──
  paragraphs.push(narrative(rng.pick(INTRO_TEMPLATES)));

  // ── 2. 출생 계절 서사 ──
  const seasonKo = SEASON_KOREAN[climate.seasonGroup] ?? climate.seasonGroup;
  const seasonKey = seasonGroupToKey(climate.seasonGroup);
  const seasonPool = SEASON_NARRATIVE[seasonKey] ?? SEASON_NARRATIVE['transition']!;
  const seasonText = pickAndFill(rng, seasonPool, { 이름: name });
  paragraphs.push(emphasis(seasonText));

  // ── 3. 온도 GAP 분석 — 자연 비유 기반 ──
  const tempGap = climate.envTemp - climate.needTemp;
  const tempDiag = diagnoseTempGap(tempGap);
  const tempNarr = rng.pick(tempDiag.narrative);

  const tempIntroLines: readonly string[] = [
    `사주의 온도 지형을 살펴보겠습니다. 환경 온도는 ${Math.round(climate.envTemp)}, 필요 온도는 ${Math.round(climate.needTemp)}으로 온도 차이(GAP)가 ${signedInt(tempGap)}이에요.`,
    `이제 온도의 풍경을 들여다볼게요. 사주가 품고 있는 온도는 ${Math.round(climate.envTemp)}, 적정 온도는 ${Math.round(climate.needTemp)} — 그 차이는 ${signedInt(tempGap)}이랍니다.`,
    `기온의 지도를 펼쳐 보면, 환경 온도 ${Math.round(climate.envTemp)} 대 필요 온도 ${Math.round(climate.needTemp)}으로, ${signedInt(tempGap)}만큼의 간극이 존재하는 거랍니다.`,
  ];
  const tempBlock = `${rng.pick(tempIntroLines)} ${tempNarr}`;

  if (tempDiag.tone === 'positive') {
    paragraphs.push(positive(tempBlock));
  } else {
    paragraphs.push(caution(tempBlock));
  }

  // ── 4. 습도 GAP 분석 — 자연 비유 기반 ──
  const humidGap = climate.envHumid - climate.needHumid;
  const humidDiag = diagnoseHumidGap(humidGap);
  const humidNarr = rng.pick(humidDiag.narrative);

  const humidIntroLines: readonly string[] = [
    `이번에는 습도의 풍경을 살펴봅니다. 환경 습도 ${Math.round(climate.envHumid)} 대 필요 습도 ${Math.round(climate.needHumid)}, 습도 차이(GAP)는 ${signedInt(humidGap)}이에요.`,
    `수분의 세계로 시선을 옮기면, 사주의 환경 습도는 ${Math.round(climate.envHumid)}, 필요 습도는 ${Math.round(climate.needHumid)}으로 ${signedInt(humidGap)}의 차이가 있는 셈이에요.`,
    `습도의 지형도를 그려 보면, 환경 ${Math.round(climate.envHumid)} 대 필요 ${Math.round(climate.needHumid)} — ${signedInt(humidGap)}만큼의 간극이 보이거든요.`,
  ];
  const humidBlock = `${rng.pick(humidIntroLines)} ${humidNarr}`;

  if (humidDiag.tone === 'positive') {
    paragraphs.push(positive(humidBlock));
  } else {
    paragraphs.push(caution(humidBlock));
  }

  // ── 5. 오행별 기후 보정 점수 해석 ──
  const scoreEntries = Object.entries(climate.scores).sort((a, b) => b[1] - a[1]);
  if (scoreEntries.length > 0) {
    const bestEl = scoreEntries[0];
    const bestText = pickAndFill(rng, SCORE_BEST_TEMPLATES, {
      오행: elFull(bestEl[0]),
      점수: String(Math.round(bestEl[1])),
    });
    paragraphs.push(positive(bestText, bestEl[0] as ElementCode));

    // 가장 낮은 점수 오행이 있으면 간략 언급
    if (scoreEntries.length >= 3) {
      const worstEl = scoreEntries[scoreEntries.length - 1];
      if (worstEl[1] < 0 || (bestEl[1] - worstEl[1]) > 20) {
        const worstText = pickAndFill(rng, SCORE_WORST_TEMPLATES, {
          오행: elFull(worstEl[0]),
        });
        paragraphs.push(narrative(worstText, worstEl[0] as ElementCode));
      }
    }
  }

  // ── 6. 종합 균형 서사 ──
  const tempOk = Math.abs(tempGap) <= 15;
  const humidOk = Math.abs(humidGap) <= 15;

  if (tempOk && humidOk) {
    paragraphs.push(encouraging(rng.pick(BALANCE_GOOD_TEMPLATES)));
  } else if (tempOk || humidOk) {
    paragraphs.push(narrative(rng.pick(BALANCE_PARTIAL_TEMPLATES)));
  } else {
    paragraphs.push(encouraging(rng.pick(BALANCE_NEED_TEMPLATES)));
  }

  // ── 7. 마무리 조언 ──
  paragraphs.push(tip(rng.pick(CLOSING_TEMPLATES)));

  // ── 테이블: 조후 분석표 ──
  const table: ReportTable = {
    title: '조후(調候) 분석표',
    headers: ['항목', '환경값', '필요값', '차이(GAP)', '진단'],
    rows: [
      [
        '온도',
        String(Math.round(climate.envTemp)),
        String(Math.round(climate.needTemp)),
        signedInt(tempGap),
        tempDiag.label,
      ],
      [
        '습도',
        String(Math.round(climate.envHumid)),
        String(Math.round(climate.needHumid)),
        signedInt(humidGap),
        humidDiag.label,
      ],
    ],
  };

  // 오행별 기후 보정 점수 테이블 (데이터가 있을 때)
  const tables: ReportTable[] = [table];
  if (scoreEntries.length > 0) {
    tables.push({
      title: '오행별 기후 보정 점수',
      headers: ['오행', '점수', '기후 기여도'],
      rows: scoreEntries.map(([el, score]) => [
        elFull(el),
        String(Math.round(score)),
        score >= 10 ? '매우 유리' : score >= 5 ? '유리' : score >= 0 ? '보통' : score >= -5 ? '다소 불리' : '불리',
      ]),
    });
  }

  // ── 게이지 차트: 환경 vs 필요 온습도 ──
  const gaugeChart: ReportChart = {
    type: 'gauge',
    title: '환경 vs 필요 온습도 비교 게이지',
    data: {
      '환경온도': climate.envTemp,
      '필요온도': climate.needTemp,
      '환경습도': climate.envHumid,
      '필요습도': climate.needHumid,
      '온도GAP': tempGap,
      '습도GAP': humidGap,
    },
    meta: {
      tempGapLabel: tempDiag.label,
      humidGapLabel: humidDiag.label,
      seasonGroup: climate.seasonGroup,
    },
  };

  // ── 하이라이트 ──
  const highlights: ReportHighlight[] = [
    {
      label: '출생 계절',
      value: seasonKo,
      sentiment: 'neutral',
    },
    {
      label: '온도 GAP',
      value: `${signedInt(tempGap)} (${tempDiag.label})`,
      sentiment: tempOk ? 'good' : 'caution',
    },
    {
      label: '습도 GAP',
      value: `${signedInt(humidGap)} (${humidDiag.label})`,
      sentiment: humidOk ? 'good' : 'caution',
    },
  ];

  // 기후 최적 오행 하이라이트
  if (scoreEntries.length > 0) {
    const best = scoreEntries[0];
    highlights.push({
      label: '기후 최적 오행',
      value: `${elFull(best[0])} (${Math.round(best[1])}점)`,
      element: best[0] as ElementCode,
      sentiment: 'good',
    });
  }

  return {
    id: 'climate',
    title: '기후·조후(調候) 분석',
    subtitle: '사주에 깃든 자연의 온도와 습도, 그 균형의 비밀',
    paragraphs,
    tables,
    charts: [gaugeChart],
    highlights,
  };
}
