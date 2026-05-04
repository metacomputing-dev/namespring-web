/**
 * template-engine.ts -- Resolve template tokens into ParagraphToken arrays
 *
 * A fragment's `templateTokens` is a mix of {kind:'text', value} (plain
 * prose), {kind:'slot', name, type} (variant pool / feature lookup), and
 * {kind:'tag', tagId, label} (inline glossary reference). The engine
 * resolves slots, leaves text and tag tokens unchanged, then groups
 * everything into ParagraphToken[] suitable for TaggedParagraph consumption.
 */

import type { ParagraphToken, TaggedParagraph } from '../types.js';
import type { FeatureVector } from './feature-selector.js';
import type { NarrativeFragment, FragmentToken } from './fragment-registry.js';

const ELEMENT_NAME_KO: Record<string, string> = {
  WOOD: '나무', FIRE: '불', EARTH: '흙', METAL: '쇠', WATER: '물',
};

const ELEMENT_METAPHOR_KO: Record<string, string> = {
  WOOD: '자라는 나무', FIRE: '피어나는 불꽃', EARTH: '단단한 자리',
  METAL: '맑게 다듬은 쇠', WATER: '깊이 흐르는 물',
};

const AGE_LABEL_KO: Record<string, string> = {
  '0-9': '어린 시절', '10-19': '청소년기', '20-29': '청년기',
  '30-39': '활발한 활동기', '40-54': '장년기', '55-69': '안정기', '70+': '원숙기',
};

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pickFromPool(pool: readonly string[], seed: number): string {
  if (pool.length === 0) return '';
  return pool[seed % pool.length];
}

export function normalizeRenderedText(value: string): string {
  let out = value;
  out = out.replace(/(나무|불|흙|쇠|물) 타고난 중심 기운에/g, '$1 기운을 타고난 사람에게');
  out = out.replace(/(나무|불|흙|쇠|물) 타고난 중심 기운의/g, '$1 기운을 타고난 사람의');
  out = out.replace(/(나무|불|흙|쇠|물) 타고난 중심 기운/g, '$1 기운을 타고난 사람의 흐름');
  out = out.replace(/(나무|불|흙|쇠|물) 도움이 되는 기운은/g, '$1 기운은');
  out = out.replace(/(나무|불|흙|쇠|물) 도움이 되는 기운이/g, '$1 기운이');
  out = out.replace(/도움이 되는 기운 기운/g, '도움이 되는 기운');
  out = out.replace(/(봄|여름|가을|겨울)에 태어난 흐름은/g, '$1에 태어난 사람은');
  out = out.replace(/(봄|여름|가을|겨울)에 태어난 흐름이/g, '$1에 태어난 사람은');
  out = out.replace(/(봄|여름|가을|겨울)에 태어난 흐름/g, '$1에 태어난 사람은');
  out = out.replace(/태어난 사람은은/g, '태어난 사람은');
  out = out.replace(/양의 타고난 중심 기운 흐름/g, '바깥으로 향하는 타고난 흐름');
  out = out.replace(/음의 타고난 중심 기운 흐름/g, '안쪽에서 다듬는 타고난 흐름');
  out = out.replace(/중립적인 타고난 중심 기운 흐름/g, '상황에 맞춰 움직이는 타고난 흐름');
  out = out.replace(/기운이 매우 강한 상태 흐름/g, '기운이 매우 강한 흐름');
  out = out.replace(/기운이 강한 상태 흐름/g, '기운이 강한 흐름');
  out = out.replace(/기운이 매우 약한 상태 흐름/g, '기운이 매우 약한 흐름');
  out = out.replace(/기운이 약한 상태 흐름/g, '기운이 약한 흐름');
  out = out.replace(/균형 흐름/g, '균형 잡힌 흐름');
  out = out.replace(/작은 결을 차곡차곡/g, '작은 흐름을 차곡차곡');
  out = out.replace(/다듬는 결/g, '다듬는 방식');
  out = out.replace(/결을 잡아 가는 결/g, '흐름을 잡아 가는 모습');
  out = out.replace(/결이 또렷해지는 결/g, '방향이 또렷해지는 흐름');
  out = out.replace(/결의 결정/g, '결정');
  out = out.replace(/의 결과 잘/g, '의 흐름과 잘');
  out = out.replace(/자리의 결/g, '자리의 방향');
  out = out.replace(/자기 결(?!과|정)/g, '자기 흐름');
  out = out.replace(/평생의 결/g, '평생의 흐름');
  out = out.replace(/한 달의 결/g, '한 달의 방향');
  out = out.replace(/이번 달의 결/g, '이번 달의 흐름');
  out = out.replace(/오늘의 직업 결/g, '오늘의 직업 흐름');
  out = out.replace(/인생 전체의 직업 결/g, '인생 전체의 직업 방향');
  out = out.replace(/결이 한결/g, '흐름이 한층');
  out = out.replace(/자기 결과 다른 흐름/g, '자기 속도와 다른 흐름');
  out = out.replace(/흐름 흐름/g, '흐름');
  out = out.replace(/학업과 일는/g, '학업과 일은');
  out = out.replace(/겁재이/g, '겁재가');
  out = out.replace(/한 평생/g, '한평생');
  out = out.replace(/#용신방향/g, '#용신 방향');
  out = out.replace(/자기 흐름정의/g, '자기 점검의');
  out = out.replace(/자기 흐름과 옆에/g, '자기 결과 옆에');
  out = out.replace(/친구의 결과를 자기 결과 옆에 둘수록/g, '친구의 성과를 자기 기준으로 삼을수록');
  out = out.replace(/친구의 결과를 자기 결과 옆에 두는 거예요/g, '친구의 성과를 자기 기준으로 삼는 거예요');
  out = out.replace(/자기 결과 가족 흐름/g, '자기 자리와 가족 흐름');
  out = out.replace(/자기 결과 가족 결/g, '자기 자리와 가족 흐름');
  out = out.replace(/결의 시기/g, '흐름의 시기');
  out = out.replace(/좋아하는 결과 잘하는/g, '좋아하는 분야와 잘하는 일이');
  out = out.replace(/자기 가정의 작은 결과 양가의/g, '자기 가정의 작은 일과 양가의');
  out = out.replace(/자기 가정의 결과 양가/g, '자기 가정의 일과 양가');
  out = out.replace(/궁실의 결과 잘/g, '궁실 흐름과 잘');
  out = out.replace(/동료의 결과 잘/g, '동료와도 잘');
  out = out.replace(/자기가 가까운 사람의 자리/g, '가까운 사람의 자리');
  out = out.replace(/큰 결정은 미루고/g, '중요한 결정은 한 번 더 검토하고');
  out = out.replace(/큰 결정은 미루는 게/g, '중요한 결정은 한 번 더 검토하는 게');
  out = out.replace(/큰 결정은 한 박자 미루/g, '중요한 결정은 한 박자 늦추');
  out = out.replace(/큰 결정은 다음 주로 미루/g, '중요한 결정은 다음 주에 다시 보');
  out = out.replace(/큰 결정은 다음 달로 미루/g, '중요한 결정은 다음 달에 다시 보');
  out = out.replace(/큰 결정은 다음 해로 미루/g, '중요한 결정은 다음 해에 다시 보');
  out = out.replace(/큰 결정은 다음 자리로 미루/g, '중요한 결정은 다음 기회에 다시 보');
  out = out.replace(/갑작스런 큰 결정은 미루기/g, '갑작스러운 큰 결정은 한 번 더 검토하기');
  out = out.replace(/큰 결정은 한 박자 늦추기/g, '중요한 결정은 한 박자 늦추기');
  out = out.replace(/하루 유예해 보세요/g, '하루 여유를 두고 확인해 보세요');
  out = out.replace(/큰 돈거래/g, '큰돈 거래');
  out = out.replace(/큰 돈/g, '큰돈');
  out = out.replace(/#편재 성 선택/g, '#편재가 만드는 기회성 선택');
  out = out.replace(/#정재 식 확인/g, '#정재의 확인 절차');
  out = out.replace(/#도화이/g, '#도화가');
  out = out.replace(/#역마이/g, '#역마가');
  out = reduceOverusedGyeol(out);
  out = out.replace(/비흐름/g, '방법');
  out = out.replace(/돈 흐름의 흐름/g, '돈의 흐름');
  out = out.replace(/인생 흐름의 흐름/g, '인생 흐름');
  out = out.replace(/흐름의 흐름/g, '흐름');
  out = out.replace(/큰 흐름은 단단하니/g, '전체 흐름은 단단하니');
  out = out.replace(/큰 흐름은 단단한 사주이니/g, '전체 흐름은 안정적인 사주이니');
  out = out.replace(/작은 신호를 가볍게 적어 두는 흐름이 잘 맞아요/g, '작은 신호를 가볍게 적어 두는 습관이 잘 맞아요');
  out = out.replace(/흐름을 점검하는 흐름/g, '흐름을 점검하는 자리');
  out = out.replace(/흐름을 보여 주는 흐름/g, '흐름을 보여 주는 신호');
  out = out.replace(/흐름을 풀어 주는 흐름이라/g, '흐름을 풀어 보는 단서라');
  out = out.replace(/흐름을 풀어 주는 흐름을/g, '흐름을 풀어 주는 기운을');
  out = out.replace(/흐름의 모양을 만드는 흐름/g, '흐름의 모양을 만들어 가는 과정');
  out = out.replace(/흐름을 잡아 가는 흐름/g, '흐름을 잡아 가는 과정');
  out = out.replace(/흐름을 봐 가는 흐름/g, '흐름을 봐 가는 방식');
  out = out.replace(/한 사람에게 흐름이 몰리지 않도록 골고루 분배하는 흐름이 좋고/g, '한 사람에게 부담이 몰리지 않도록 골고루 나누는 편이 좋고');
  out = out.replace(/한 사람에게 흐름이 몰리지 않게 골고루 두고/g, '한 사람에게 부담이 몰리지 않게 골고루 나누고');
  out = out.replace(/따뜻한 거래/g, '따뜻한 주고받음');
  out = out.replace(/자녀의 흐름/g, '자녀와의 관계');
  out = out.replace(/아이의 흐름/g, '아이의 하루');
  out = out.replace(/가까운 흐름/g, '가까운 관계');
  out = out.replace(/가족의 흐름/g, '가족 관계');
  out = out.replace(/받는 흐름을 부끄러워하지 않는/g, '도움을 받는 일을 부끄러워하지 않는');
  out = out.replace(/자기 흐름을 무리하게 끌고 가지 않아도/g, '혼자 무리하게 끌고 가지 않아도');
  out = out.replace(/듣는 흐름/g, '듣는 시간');
  out = out.replace(/한 해의 길이로/g, '한 해 동안');
  out = out.replace(/한 해의 길이만큼/g, '한 해 동안');
  out = out.replace(/큰 흐름'을 잡는 흐름/g, "큰 판을 읽는 힘");
  out = out.replace(/작은 결정을 쌓아 가는 흐름/g, '작은 결정을 하나씩 쌓아 가는 방식');
  out = out.replace(/장년기의 차분한 흐름이 (오늘 하루|이번 주|이번 달|올해)에 부드럽게 이어지는 흐름이에요/g, '장년기의 차분한 기운이 $1에 부드럽게 이어져요');
  out = out.replace(/받쳐 줘야 할 사람·맡아야 할 책임 사이에서 흐름을 잡는/g, '받쳐 줘야 할 사람과 맡아야 할 책임 사이에서 우선순위를 잡는');
  out = out.replace(/결정 흐름을 짧게/g, '결정 기준을 짧게');
  out = out.replace(/흐름을 한 줄씩 더해/g, '관점을 한 줄씩 더해');
  out = out.replace(/활동성 쉼/g, '몸을 움직이는 휴식');
  out = out.replace(/몸을 움직이는 휴식이 잘 어울리는 흐름이라/g, '몸을 움직이는 휴식이 잘 어울리는 구조라');
  out = out.replace(/산행·자전거·등산 같은 흐름/g, '산행·자전거·가벼운 등산 같은 활동');
  out = out.replace(/오늘의 인연 흐름은 부드러운 일간 흐름이라/g, '오늘의 인연은 부드러운 일간 특성상');
  out = out.replace(/이번 주의 인연 흐름은 부드러운 일간 흐름이라/g, '이번 주의 인연은 부드러운 일간 특성상');
  out = out.replace(/이번 달의 인연 흐름은 부드러운 일간 흐름이라/g, '이번 달의 인연은 부드러운 일간 특성상');
  out = out.replace(/올해의 인연 흐름은 부드러운 일간 흐름이라/g, '올해의 인연은 부드러운 일간 특성상');
  out = out.replace(/곁의 흐름을 받아들이/g, '곁의 신호를 받아들이');
  out = out.replace(/들어오는 흐름을 따뜻하게 맞이/g, '들어오는 관심을 따뜻하게 맞이');
  out = out.replace(/에너지의 흐름이 잔잔한 하루예요/g, '에너지가 잔잔한 하루예요');
  out = out.replace(/에너지의 흐름이 잔잔한 흐름이에요/g, '에너지가 잔잔하게 이어지는 시기예요');
  out = out.replace(/이동 흐름은 익숙한 동선을 지키면 호흡이 편안한 흐름이에요/g, '이동운은 익숙한 동선을 지킬 때 호흡이 편안해지는 모습이에요');
  out = out.replace(/이동 흐름은 익숙한 동선을 지키면 호흡이 편안해지는 흐름이에요/g, '이동운은 익숙한 동선을 지킬 때 호흡이 편안해지는 모습이에요');
  out = out.replace(/이동 흐름은 익숙한 자리에서 한 발짝씩 넓혀 가는 흐름이에요/g, '이동운은 익숙한 자리에서 한 발짝씩 넓혀 가기 좋은 모습이에요');
  out = out.replace(/기운은 충분한데 방향이 살짝 흩어진 흐름이에요/g, '기운이 충분하지만 방향이 살짝 흩어질 수 있어요');
  out = out.replace(/재물 흐름은 큰 굴곡 없이 자리 잡는 흐름이에요/g, '재물운은 큰 굴곡 없이 자리 잡는 모습이에요');
  out = out.replace(/재물 흐름은 큰 굴곡 없이 차곡차곡 모이는 흐름을 따라가요/g, '재물운은 큰 굴곡 없이 차곡차곡 모이는 모습이에요');
  out = out.replace(/잘 풀리는 흐름은/g, '잘 풀리는 방향은');
  out = out.replace(/주의할 흐름은/g, '주의할 점은');
  out = out.replace(/친구의 흐름을 충분히 누리는/g, '친구와의 시간을 충분히 누리는');
  out = out.replace(/다양한 친구의 흐름을 경험/g, '다양한 친구 관계를 경험');
  out = out.replace(/친구·동료의 흐름을 다듬는/g, '친구·동료 관계를 다듬는');
  out = out.replace(/친구·또래의 흐름을 다듬는/g, '친구·또래 관계를 다듬는');
  out = out.replace(/흐름을 따라가는 흐름/g, '자연스럽게 따라가는 방식');
  out = out.replace(/가족의 결과 같은 호흡/g, '가족과 비슷한 호흡');
  out = out.replace(/가족 관계은/g, '가족 관계는');
  out = out.replace(/가족 관계으로/g, '가족처럼 가까워지는 관계로');
  out = out.replace(/한 흐름을 닫기 좋은 흐름이에요/g, '한 단락을 마무리하기 좋은 시기예요');
  out = out.replace(/일간의 흐름이 비교적 고른 흐름이에요/g, '일간 기운이 비교적 고른 시기예요');
  out = out.replace(/일간의 흐름이 잔잔한 흐름이에요/g, '일간 기운이 잔잔한 시기예요');
  out = out.replace(/흐름이 흐름을 가볍게 해 줘요/g, '부담이 가벼워져요');
  out = out.replace(/#공망의 결과 닿아요/g, '#공망의 신호와 닿아요');
  out = out.replace(/#용신의 결에 맞는/g, '#용신 보완 방향에 맞는');
  out = out.replace(/이동 흐름은 익숙한 자리에서 한 발짝씩 넓혀 가는 한 해의 흐름이에요/g, '이동운은 익숙한 자리에서 한 발짝씩 넓혀 가기 좋은 모습이에요');
  out = out.replace(/자기 흐름을 회복시켜/g, '자기 리듬을 회복시켜');
  out = out.replace(/흐름이 무거워지기 쉬워요/g, '몸과 마음이 무거워지기 쉬워요');
  out = out.replace(/인연 흐름은 친구·동료의 자리/g, '인연운은 친구·동료 관계');
  out = out.replace(/매력의 흐름이 강하게/g, '매력 신호가 강하게');
  out = out.replace(/그 흐름은 무대 위/g, '그 신호는 무대 위');
  out = out.replace(/다양한 친구·관계의 흐름을 경험/g, '다양한 친구 관계를 경험');
  out = out.replace(/계약·법률문서·자격 갱신 자리에서 큰 단계가 풀리는 흐름이에요/g, '계약·법률문서·자격 갱신 자리에서 큰 단계가 풀리는 시기예요');
  out = out.replace(/새 결정과 점검을 함께 두는 흐름이 잘 맞아요/g, '새 결정과 점검을 함께 두는 방식이 잘 맞아요');
  out = out.replace(/한 번 점검한 자리는 몇 년의 흐름을 또렷하게 해 줘요/g, '한 번 점검한 문서는 몇 년의 기준을 또렷하게 해 줘요');
  out = out.replace(/작은 조항·기한·날짜 같은 디테일을 발견하는 자리예요/g, '작은 조항·기한·날짜 같은 디테일을 발견하는 일이에요');
  out = out.replace(/결이 또렷한 (날|시기)엔/g, '기준이 또렷한 $1엔');
  out = out.replace(/#정인의 흐름이 들어오는/g, '#정인의 기운이 들어오는');
  out = out.replace(/익숙한 흐름을 다듬는 방식/g, '익숙한 기준을 다듬는 방식');
  out = out.replace(/#정재의 흐름이 자리 잡혀/g, '#정재의 기운이 자리 잡혀');
  out = out.replace(/한 박자 늦추는 흐름이 좋아요/g, '한 박자 늦추는 방식이 좋아요');
  out = out.replace(/가족 자리 사이에서/g, '가족 사이에서');
  out = out.replace(/함께한 자리가 한 해의/g, '함께한 시간이 한 해의');
  out = out.replace(/친구·학업·가족 사이에서 마음이 자주 들썩이는 흐름의 시기예요/g, '친구·학업·가족 사이에서 마음이 자주 들썩이는 시기예요');
  out = out.replace(/마음의 흐름을 봄날의 새싹에 비유하면/g, '마음을 봄날의 새싹에 비유하면');
  out = out.replace(/#정인의 흐름/g, '#정인의 기운');
  out = out.replace(/#편관의 흐름/g, '#편관의 압박');
  out = out.replace(/#공망의 흐름/g, '#공망의 신호');
  out = out.replace(/#삼형의 흐름/g, '#삼형의 신호');
  out = out.replace(/#편관의 결/g, '#편관의 압박');
  out = out.replace(/#공망의 결/g, '#공망의 신호');
  out = out.replace(/#삼형의 결/g, '#삼형의 신호');
  out = out.replace(/학업 흐름/g, '학업운');
  out = out.replace(/차분히 깊어지는 흐름/g, '차분히 깊어지는 힘');
  out = out.replace(/함께 보이는 흐름/g, '함께 보이는 신호');
  out = out.replace(/표현 흐름/g, '표현력');
  out = out.replace(/표현 결/g, '표현력');
  out = out.replace(/한 단원을 자기 말로 풀어 보기 좋은 흐름/g, '한 단원을 자기 말로 풀어 보기 좋은 하루');
  out = out.replace(/자기에게 맞는 흐름/g, '자기에게 맞는 공부 방식');
  out = out.replace(/작은 호기심의 흐름/g, '작은 호기심');
  out = out.replace(/미래의 자리/g, '미래의 선택지');
  out = out.replace(/다음 단계의 흐름/g, '다음 단계');
  out = out.replace(/결의 흐름/g, '시기');
  out = out.replace(/어린 흐름의 사주/g, '어린 시기의 사주');
  out = out.replace(/보호자의 흐름이 그대로 아이의 일상 호흡/g, '보호자의 호흡이 그대로 아이의 일상');
  out = out.replace(/#정인의 결과 가장 가까이/g, '#정인이 가장 가까이');
  out = out.replace(/자라나는 흐름의 작은 뿌리/g, '자라나는 시기의 작은 뿌리');
  out = out.replace(/시기이에요/g, '시기예요');
  out = out.replace(/오늘의 이동 흐름/g, '오늘의 이동운');
  out = out.replace(/이번 주의 이동 흐름/g, '이번 주의 이동운');
  out = out.replace(/이번 달의 이동 흐름/g, '이번 달의 이동운');
  out = out.replace(/올해 이동 흐름/g, '올해 이동운');
  out = out.replace(/큰 결정 자리가 있다면/g, '중요한 결정이 있다면');
  out = out.replace(/마음이 차분해진 자리에서/g, '마음이 차분해진 뒤');
  out = out.replace(/가까운 친구와의 자리/g, '가까운 친구와의 관계');
  out = out.replace(/두 자리를 같이 챙기면/g, '두 관계를 같이 챙기면');
  out = out.replace(/미래 자리의 씨앗/g, '미래 선택지의 씨앗');
  out = out.replace(/어른이 되었을 때 자리가/g, '어른이 되었을 때 선택지가');
  out = out.replace(/작가·아티스트의 흐름/g, '작가·아티스트의 방식');
  out = out.replace(/친구·관계의 자산/g, '친구 관계의 자산');
  out = out.replace(/이번 주 이동 흐름/g, '이번 주 이동운');
  out = out.replace(/이번 달 이동 흐름/g, '이번 달 이동운');
  out = out.replace(/#용신의 결에 어울리는/g, '#용신 보완 방향에 맞는');
  out = out.replace(/가족과 친구의 흐름/g, '가족과 친구');
  out = out.replace(/의논하는 흐름/g, '의논하는 방식');
  out = out.replace(/함께하는 활동으로 흐름을 잡으면/g, '함께하는 활동으로 자연스럽게 가까워지면');
  out = out.replace(/흐름을 봐 가는 흐름/g, '상대를 알아 가는 방식');
  out = out.replace(/흐름을 봐 가는 방식/g, '상대를 알아 가는 방식');
  out = out.replace(/다 잘하고 싶은 마음이 큰 자리이니/g, '다 잘하고 싶은 마음이 커지기 쉬우니');
  out = out.replace(/고요한 호수 자리/g, '고요한 호수 같은 시간');
  out = out.replace(/강을 더 또렷하게/g, '마음을 또렷하게');
  out = out.replace(/무게가 절반으로 줄어드는 흐름이에요/g, '무게가 절반으로 줄어들 수 있어요');
  out = out.replace(/다른 사람의 몫까지 떠안는 자리/g, '다른 사람의 몫까지 떠안는 습관');
  out = out.replace(/적당히 나누는 흐름/g, '적당히 나누는 방식');
  out = out.replace(/따뜻한 자리에서 일찍 쉬는 흐름/g, '따뜻한 공간에서 일찍 쉬는 시간');
  out = out.replace(/#정관 식 책임 언어/g, '#정관처럼 책임을 앞세운 말');
  out = out.replace(/#용신의 결과 어울리는/g, '#용신 보완 방향에 어울리는');
  out = out.replace(/오늘의 인연 흐름/g, '오늘의 인연운');
  out = out.replace(/이번 주의 인연 흐름/g, '이번 주 인연운');
  out = out.replace(/이번 달의 인연 흐름/g, '이번 달 인연운');
  out = out.replace(/올해의 인연 흐름/g, '올해 인연운');
  out = out.replace(/오늘의 진로 흐름/g, '오늘의 진로운');
  out = out.replace(/오늘 재물 흐름/g, '오늘 재물운');
  out = out.replace(/이번 주 재물 흐름/g, '이번 주 재물운');
  out = out.replace(/이번 달 재물 흐름/g, '이번 달 재물운');
  out = out.replace(/올해 재물 흐름/g, '올해 재물운');
  out = out.replace(/마음의 흐름을 흐르는 강에 비유한다면/g, '마음을 흐르는 강에 비유한다면');
  out = out.replace(/고요한 호수 같은 시간가/g, '고요한 호수 같은 시간이');
  out = out.replace(/무게가 절반으로 줄어드는 흐름이라/g, '무게가 줄어들 수 있으니');
  out = out.replace(/모든 책임을 자기에게 두는 자리/g, '모든 책임을 자기에게 두는 습관');
  out = out.replace(/자라는 흐름이 빛나는 흐름을 키우는 자리예요/g, '자라는 힘이 밝은 표현력을 키우는 모습이에요');
  out = out.replace(/결단의 흐름이 깊은 흐름을 길러 내는 자리예요/g, '분명한 결단이 깊은 생각을 길러 내는 모습이에요');
  out = out.replace(/깊은 흐름이 자라는 흐름을 길러 주는 자리예요/g, '깊은 물 기운이 성장의 힘을 길러 주는 모습이에요');
  out = out.replace(/어깨를 풀어 주는 흐름이에요/g, '어깨를 풀어 주는 시기예요');
  out = out.replace(/어깨를 자주 풀어 주는 흐름이에요/g, '어깨를 자주 풀어 주는 시기예요');
  out = out.replace(/작은 한 매듭으로 흐름이 단단해져요/g, '작은 한 매듭으로 표현이 단단해져요');
  out = out.replace(/작은 한 매듭으로 흐름이 단단해지는 흐름이에요/g, '작은 한 매듭으로 표현이 단단해지는 시기예요');
  out = out.replace(/시간 같은 흐름/g, '시간 같은 시기');
  out = out.replace(/흐름을 따뜻하게 데우는 큰 흐름이에요/g, '가족 분위기를 따뜻하게 데우는 계기가 돼요');
  out = out.replace(/#용신이 천천히 자기 흐름을 찾아가는 흐름이에요/g, '#용신 보강을 천천히 찾아가는 자리예요');
  out = out.replace(/#용신이 멀리 흐르는 흐름이라/g, '#용신 보강을 의식적으로 챙겨야 하는 자리라');
  out = out.replace(/용신 흐름/g, '용신 보완 방향');
  out = out.replace(/용신 결/g, '용신 보완 방향');
  out = out.replace(/그 결에 맞는/g, '그 방향에 맞는');
  out = out.replace(/#정인의 결과 잘 맞물려/g, '#정인의 기운과 잘 맞물려');
  out = out.replace(/의 결과 잘 맞물려/g, '의 기운과 잘 맞물려');
  out = out.replace(/자격·서류 흐름/g, '자격·서류운');
  out = out.replace(/큰 거래·확장의 흐름이 또렷해지는 흐름이에요/g, '큰 거래·확장성이 또렷해지는 시기예요');
  out = out.replace(/큰 거래·확장의 흐름이 또렷해져요/g, '큰 거래·확장성이 또렷해져요');
  out = out.replace(/주의할 흐름은 #/g, '주의할 신호는 #');
  out = out.replace(/인성의 흐름이 부족한 자리에서는 책·스승의 흐름을/g, '인성 기운이 부족한 자리에서는 책·스승의 도움을');
  out = out.replace(/인성의 흐름이 부족한 자리에서는 책·스승의 결을/g, '인성 기운이 부족한 자리에서는 책·스승의 도움을');
  out = out.replace(/책·스승의 흐름을 의도적으로/g, '책·스승의 도움을 의도적으로');
  out = out.replace(/책·스승의 결을 의도적으로/g, '책·스승의 도움을 의도적으로');
  out = out.replace(/매력의 결인/g, '매력 신호인');
  out = out.replace(/표현의 결인/g, '표현 기운인');
  out = out.replace(/책임의 결인/g, '책임 기운인');
  out = out.replace(/그달의 결과 평소 흐름의 짜임/g, '그달의 흐름과 평소 흐름의 짜임');
  out = out.replace(/다툼 흐름을 풀어 주는 약이 되는 흐름이에요/g, '다툼을 풀어 주는 약이 되는 기운이에요');
  out = out.replace(/흐름이 더 또렷해지는 흐름도/g, '흐름이 더 또렷해지는 경우도');
  out = out.replace(/도움이 되는 흐름도/g, '도움이 될 때도');
  out = out.replace(
    /흐름이 (천천히 |한층 )?(단단해지는|부드러워지는|또렷해지는|깊어지는) 흐름이에요/g,
    (_match, adverb: string | undefined, verb: string) => `흐름이 ${adverb ?? ''}${verb.replace('지는', '져요')}`,
  );
  out = out.replace(/오행 다섯 흐름/g, '오행 다섯 기운');
  out = out.replace(/나무·불·흙·쇠·물 다섯 흐름/g, '나무·불·흙·쇠·물 다섯 기운');
  out = out.replace(/보여 주는 흐름이에요/g, '보여 주는 점수예요');
  out = out.replace(/흐름이라 흐름이/g, '흐름이라 전체 흐름이');
  out = out.replace(/부족한 흐름을 채울 흐름/g, '부족한 부분을 채울 보완점');
  out = out.replace(/더 또렷이 살려 주는 흐름이라/g, '더 또렷이 살려 주는 신호라');
  out = out.replace(/흔들림을 줄이는 흐름이라/g, '흔들림을 줄이는 신호라');
  out = out.replace(/시기이에요/g, '시기예요');
  return out.replace(/([.!?])(?=[가-힣])/g, '$1 ');
}

function reduceOverusedGyeol(value: string): string {
  const count = (value.match(/결/g) ?? []).length;
  if (count === 0) return value;

  let out = value;
  out = out.replace(/결이에요/g, '흐름이에요');
  out = out.replace(/결입니다/g, '흐름입니다');
  out = out.replace(/결이라/g, '흐름이라');
  out = out.replace(/결이고/g, '흐름이고');
  out = out.replace(/결이/g, '흐름이');
  out = out.replace(/결은/g, '흐름은');
  out = out.replace(/결을/g, '흐름을');
  out = out.replace(/결로/g, '흐름으로');
  out = out.replace(/결의/g, '흐름의');
  out = out.replace(/결도/g, '흐름도');
  out = out.replace(/결만/g, '흐름만');
  out = out.replace(/결처럼/g, '흐름처럼');
  out = out.replace(/결마다/g, '흐름마다');
  return out;
}

function startsWithParticle(value: string): boolean {
  return /^(은|는|이|가|을|를|의|도|만|부터|까지|처럼|보다|으로|로|에서|에게|께|와|과|이나|나|이라|라|이에요|예요|입니다|입니다만|,|\.|!|\?|\)|\])/u.test(value.trimStart());
}

function endsWithWhitespace(value: string): boolean {
  return /\s$/u.test(value);
}

function plainTextFromTokens(tokens: readonly ParagraphToken[]): string {
  let out = '';
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (tok.kind === 'text') {
      out += tok.value;
      continue;
    }

    if (out && !endsWithWhitespace(out)) out += ' ';
    out += `#${tok.label}`;

    const next = tokens[i + 1];
    if (next?.kind === 'text' && next.value && !startsWithParticle(next.value)) {
      out += ' ';
    }
  }
  return normalizeRenderedText(out.replace(/\s{2,}/g, ' '));
}

function resolveSlot(
  token: FragmentToken,
  slots: Readonly<Record<string, readonly string[]>> | undefined,
  feature: FeatureVector,
  periodLabel: string,
  seedKey: string,
): string {
  const name = token.name ?? '';
  const type = token.type ?? '';
  const seed = fnv1a(`${seedKey}|slot|${name}`);

  // Feature-vector slots resolve from saju context, not variant pools.
  if (type === 'periodLabel') return periodLabel;
  if (type === 'elementName') {
    return feature.dayMasterElement ? (ELEMENT_NAME_KO[feature.dayMasterElement] ?? '') : '';
  }
  if (type === 'elementMetaphor') {
    return feature.dayMasterElement ? (ELEMENT_METAPHOR_KO[feature.dayMasterElement] ?? '') : '';
  }
  if (type === 'ageLabel') return AGE_LABEL_KO[feature.ageBand] ?? '';

  // Variant pool slots come from the fragment's own slots dict.
  const pool = slots?.[name];
  if (Array.isArray(pool) && pool.length > 0) return pickFromPool(pool, seed);
  return '';
}

function mergeAdjacentText(tokens: ParagraphToken[]): ParagraphToken[] {
  const out: ParagraphToken[] = [];
  for (const tok of tokens) {
    const last = out[out.length - 1];
    if (tok.kind === 'text' && last && last.kind === 'text') {
      out[out.length - 1] = { kind: 'text', value: normalizeRenderedText(last.value + tok.value) };
    } else {
      out.push(tok);
    }
  }
  return out;
}

function hasFinalConsonant(label: string): boolean {
  const chars = [...label].reverse();
  const hangul = chars.find((ch) => ch >= '가' && ch <= '힣');
  if (!hangul) return true;
  const code = hangul.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

function normalizeParticleForLabel(label: string, value: string): string {
  const hasBatchim = hasFinalConsonant(label);
  return value.replace(/^(\s*)(이|가|은|는|을|를|과|와)(?=\s|,|\.|!|\?)/u, (_match, leading: string, particle: string) => {
    const next = hasBatchim
      ? ({ 가: '이', 는: '은', 를: '을', 와: '과' } as Record<string, string>)[particle] ?? particle
      : ({ 이: '가', 은: '는', 을: '를', 과: '와' } as Record<string, string>)[particle] ?? particle;
    return `${leading}${next}`;
  });
}

function normalizeParticlesAfterTags(tokens: ParagraphToken[]): ParagraphToken[] {
  const out = tokens.map((token) => ({ ...token }));
  for (let i = 0; i < out.length - 1; i += 1) {
    const current = out[i];
    const next = out[i + 1];
    if (current.kind !== 'tag' || next.kind !== 'text') continue;
    next.value = normalizeParticleForLabel(current.label, next.value);
  }
  return out;
}

export interface RenderContext {
  readonly seedKey: string;
  readonly periodLabel: string;
  readonly feature: FeatureVector;
}

/** Render a fragment's templateTokens into a TaggedParagraph. */
export function renderFragment(
  fragment: NarrativeFragment,
  ctx: RenderContext,
): TaggedParagraph {
  const out: ParagraphToken[] = [];
  for (const tok of fragment.templateTokens) {
    if (tok.kind === 'text') {
      out.push({ kind: 'text', value: normalizeRenderedText(tok.value ?? '') });
    } else if (tok.kind === 'slot') {
      const resolved = resolveSlot(tok, fragment.slots, ctx.feature, ctx.periodLabel, ctx.seedKey);
      if (resolved) out.push({ kind: 'text', value: normalizeRenderedText(resolved) });
    } else if (tok.kind === 'tag') {
      if (tok.tagId && tok.label) {
        out.push({ kind: 'tag', tagId: tok.tagId, label: tok.label });
      }
    }
  }
  const merged = normalizeParticlesAfterTags(mergeAdjacentText(out));
  return { tokens: merged, plainText: plainTextFromTokens(merged) };
}
