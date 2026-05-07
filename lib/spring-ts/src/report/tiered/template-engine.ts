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

/**
 * Public wrapper -- paragraph-aware normalization.
 *
 * P15-A2: All normalize rules are inherently paragraph-scoped (regex pipeline
 * + `reduceOverusedGyeol` density budget). Splitting on `\n\n+` BEFORE the
 * pipeline runs ensures every rule sees only one paragraph at a time, so:
 *   • density-based budgets (`reduceOverusedGyeol`) count per paragraph
 *     even when the value flows in pre-joined,
 *   • cross-paragraph false positives in long-prefix regex (e.g. season + 결)
 *     are impossible by construction,
 *   • each paragraph round-trips byte-stable when the input is single-paragraph
 *     (the wrapper degenerates to a direct call).
 *
 * The internal pipeline lives in `normalizeRenderedParagraph` so callers
 * cannot accidentally bypass the split (mirrors the `reduceOverusedGyeol`
 * pattern from P13-A2).
 */
export function normalizeRenderedText(value: string): string {
  if (!value.includes('\n\n')) return normalizeRenderedParagraph(value);
  // Preserve the EXACT separator run (\n\n vs \n\n\n) by capturing in split.
  const parts = value.split(/(\n\n+)/);
  let out = '';
  for (let i = 0; i < parts.length; i += 1) {
    out += i % 2 === 0 ? normalizeRenderedParagraph(parts[i]) : parts[i];
  }
  return out;
}

function normalizeRenderedParagraph(value: string): string {
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
  out = out.replace(/(오늘|이번 주|이번 달|올해) 일간 (#(?:나무|불|흙|쇠|물) 일간의 기운)/g, '$1는 $2');
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
  out = out.replace(/아이의 흐름은/g, '아이의 하루는');
  // P12-A2: period-aware normalize. The unconditional rewrite
  // `아이의 흐름이에요 → 아이의 하루예요` is a structurally identical
  // latent cross-period leak to the one P11-A2 fixed at the
  // `잠을 충분히 챙기는 자리예요 → ... 하루예요` rule. When the
  // surrounding period is anything other than `오늘`, mapping to
  // `하루예요` (one day) creates a logical contradiction with prefixes
  // like `이번 주`, `이번 달`, `올해`, `인생/평생`. Per the P11-A2
  // pattern, prefix-anchored rewrites map each period to its own
  // coherent unit. The unanchored fallback is preserved AFTER the
  // anchored rules so that mid-sentence occurrences without a period
  // prefix still receive a grammatically valid rewrite (otherwise
  // the next rule below (`/아이의 흐름이/g → /아이의 하루가/g`) would
  // partially match `아이의 흐름이` inside `아이의 흐름이에요` and
  // produce `아이의 하루가에요` — a grammar regression). A grep over
  // data/narrative/ confirms no fragment currently produces
  // `아이의 흐름이에요` directly, so this fix is preventive and
  // byte-stable on the current 35-fixture set.
  out = out.replace(/오늘 아이의 흐름이에요/g, '오늘 아이의 하루예요');
  out = out.replace(/이번 주 아이의 흐름이에요/g, '이번 주 아이의 한 주예요');
  out = out.replace(/이번 달 아이의 흐름이에요/g, '이번 달 아이의 한 달 흐름이에요');
  out = out.replace(/올해 아이의 흐름이에요/g, '올해 아이의 한 해 흐름이에요');
  out = out.replace(/(인생|평생) 아이의 흐름이에요/g, '$1 아이의 시기예요');
  out = out.replace(/아이의 흐름이에요/g, '아이의 하루예요');
  out = out.replace(/아이의 흐름이/g, '아이의 하루가');
  out = out.replace(/아이의 흐름을/g, '아이의 하루를');
  out = out.replace(/아이의 흐름과/g, '아이의 하루와');
  out = out.replace(/아이의 흐름에/g, '아이의 하루에');
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
  out = out.replace(/받쳐 줘야 할 사람과 맡아야 할 책임/g, '챙겨야 할 사람과 맡은 책임');
  out = out.replace(/장년기의 차분한 흐름이 (오늘 하루|이번 주|이번 달|올해)에 부드럽게 이어지는 흐름이에요/g, '장년기의 차분한 기운이 $1에 부드럽게 이어져요');
  out = out.replace(/받쳐 줘야 할 사람·맡아야 할 책임 사이에서 흐름을 잡는/g, '챙겨야 할 사람과 맡은 책임 사이에서 우선순위를 잡는');
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
  out = out.replace(/#용신이 천천히 자기 흐름을 찾아가는 흐름이에요/g, '#용신 보강을 천천히 찾아가는 시기예요');
  out = out.replace(/#용신이 멀리 흐르는 흐름이라/g, '#용신 보강을 의식적으로 챙겨야 해서');
  out = out.replace(/이 약간 떨어져 흐르는 자리에요/g, ' 보강이 약간 멀게 작동해요');
  out = out.replace(/ 자리가 현재 흐름과는 조금 거리가 있어요/g, ' 보강이 현재 흐름과는 조금 거리가 있어요');
  out = out.replace(/이 자리에 들어오는 시기가/g, '이 들어오는 시기가');
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
  out = out.replace(/자기 자리와 가족 흐름/g, '자기 자리와 가족 관계');
  out = out.replace(/가족과 집안 흐름/g, '가족과 집안운');
  out = out.replace(/연애와 인연 흐름/g, '연애와 인연운');
  out = out.replace(/건강·스트레스 흐름/g, '건강·스트레스 해석');
  out = out.replace(/(재물|건강|가족|직업|인연|이동) 흐름/g, '$1운');
  out = out.replace(/스트레스 흐름/g, '스트레스 해석');
  out = out.replace(/전체적으로 균형이 돌아오는 자리를 자주 만드는 사람이 잘 흐르는 사주예요/g, '전체적으로 균형을 되찾는 루틴을 자주 만들수록 좋아지는 사주예요');
  out = out.replace(/균형이 돌아오는 자리를 자주 만들수록/g, '회복 루틴을 자주 만들수록');
  out = out.replace(/균형이 돌아오는 자리/g, '회복 루틴');
  out = out.replace(/잘 흐르는 사주/g, '좋아지는 사주');
  out = out.replace(/부모님 자리와 자녀의 자리 사이에서/g, '부모님과 자녀 사이에서');
  out = out.replace(/흐름을 한 호흡씩 정리하는 자리/g, '역할을 한 호흡씩 정리하기 좋은 때');
  out = out.replace(/한 해의 흐름을 차분히 다듬는 자리/g, '한 해의 역할을 차분히 다듬기 좋은 시기');
  out = out.replace(/부모님 자리는/g, '부모님께는');
  out = out.replace(/한쪽 자리에 시간을/g, '한쪽 가족에게 시간을');
  out = out.replace(/폭이 넓은 자리이니/g, '챙길 사람이 많으니');
  out = out.replace(/자기 휴식도 한 자리는/g, '자기 휴식도 한 칸은');
  out = out.replace(/어깨·허리 자리에/g, '어깨와 허리에');
  out = out.replace(/누적된 자리들이/g, '누적된 피로가');
  out = out.replace(/여러 자리에서 오는 신호/g, '여러 쪽에서 오는 신호');
  out = out.replace(/쌓이는 자리에서/g, '쌓일 때');
  out = out.replace(/차 한 잔의 자리/g, '차 한 잔의 시간');
  out = out.replace(/산책 자리/g, '산책 시간');
  out = out.replace(/회식·과음 자리/g, '회식·과음 약속');
  out = out.replace(/가벼운 자리가 회복의 자리예요/g, '가벼운 시간이 회복에 좋아요');
  out = out.replace(/잠 자리/g, '잠자리');
  out = out.replace(/푹 자는 자리가/g, '푹 자는 시간이');
  out = out.replace(/자리 이동이 생기면 생각보다 빨리 흐름을 탈 수 있어요/g, '이동이 생기면 생각보다 빨리 진행될 수 있어요');
  out = out.replace(/흐름을 탈 수 있어요/g, '진행될 수 있어요');
  out = out.replace(/30대 이동 흐름은 이사·이직의 자리가 한 번 크게 열리는 흐름이에요/g, '30대 이동운은 이사·이직 같은 큰 변화가 한 번 열리기 쉬운 시기예요');
  out = out.replace(/가족과 자기 자리 사이에서/g, '가족과 자기 생활 사이에서');
  out = out.replace(/새 자리로 향할 때/g, '새 환경으로 향할 때');
  out = out.replace(/출장·해외 자리는/g, '출장·해외 일정은');
  out = out.replace(/자리 옮김은/g, '변화는');
  out = out.replace(/자리 옮김을/g, '변화를');
  out = out.replace(/자리 옮김이나/g, '이동이나');
  out = out.replace(/자리 옮김/g, '변화');
  out = out.replace(/큰 변화은/g, '큰 변화는');
  out = out.replace(/단계적으로 접근하는 흐름/g, '단계적으로 접근하는 방식');
  out = out.replace(/한 달이라는 자리는/g, '한 달은');
  out = out.replace(/산책 시간를/g, '산책 시간을');
  out = out.replace(/회복 자리를 사이사이에/g, '회복 시간을 사이사이에');
  out = out.replace(/한 번 푹 쉬는 자리를/g, '한 번 푹 쉬는 시간을');
  out = out.replace(/분기마다 한 번 푹 쉬는 자리를/g, '분기마다 한 번 푹 쉬는 시간을');
  out = out.replace(/짧은 회복 자리를/g, '짧은 회복 시간을');
  out = out.replace(/쌓이는 자리가 자주 와요/g, '쌓이는 때가 자주 와요');
  out = out.replace(/보편적인 자리도/g, '작은 시간도');
  out = out.replace(/잠자리를 평소보다 한 시간 일찍 잡는 자리를/g, '잠자리를 평소보다 한 시간 일찍 챙기는 날을');
  out = out.replace(/다음 달의 흐름이/g, '다음 달 컨디션이');
  out = out.replace(/다음 해의 결까지/g, '다음 해의 컨디션까지');
  out = out.replace(/다음 해의 흐름까지/g, '다음 해의 컨디션까지');
  out = out.replace(/첫 자취·첫 직장·첫 해외 자리가/g, '첫 자취·첫 직장·첫 해외 경험이');
  out = out.replace(/첫 자취·첫 출장·첫 해외 자리가/g, '첫 자취·첫 출장·첫 해외 경험이');
  out = out.replace(/새 자리를 경험해 볼/g, '새 환경을 경험해 볼');
  out = out.replace(/출장·여행·교환학생 같은 자리에/g, '출장·여행·교환학생 같은 기회에');
  out = out.replace(/자리를 바꾸면/g, '환경을 바꾸면');
  out = out.replace(/돌아오는 자리가/g, '돌아오는 시점이');
  out = out.replace(/한 번 옮긴 자리에서/g, '한 번 옮긴 곳에서');
  out = out.replace(/활동량을 받아 내는 그릇이 큰 흐름이에요/g, '활동량을 받아 낼 힘이 큰 해예요');
  out = out.replace(/활동량을 받아 내는 그릇이 큰 결이에요/g, '활동량을 받아 낼 힘이 큰 해예요');
  out = out.replace(/누적되는 자리가/g, '누적되는 피로가');
  out = out.replace(/페이스를 늦추는 자리를/g, '페이스를 늦추는 시간을');
  out = out.replace(/그릇을 더 키워/g, '체력 기반을 더 키워');
  out = out.replace(/한 해의 결이 한층 든든해져요/g, '한 해의 컨디션이 한층 든든해져요');
  out = out.replace(/학업·관계 자리에서 신경 쓸 자리가 많아지기 쉬운 흐름이에요/g, '학업과 관계에서 신경 쓸 일이 많아지기 쉬운 시기예요');
  out = out.replace(/강한 다이어트·과한 야식 자리는/g, '강한 다이어트나 과한 야식은');
  out = out.replace(/친구와의 자리도 회복의 자리가 돼요/g, '친구와 보내는 시간도 회복에 도움이 돼요');
  out = out.replace(/너무 늦은 자리는/g, '너무 늦은 약속은');
  out = out.replace(/받은 자리를 단단히 받쳐/g, '맡은 역할을 단단히 받쳐');
  out = out.replace(/큰 자리만 좇기보다는 한 자리에서의 마무리가 다음 자리의 신뢰가/g, '큰 역할만 좇기보다는 지금 맡은 일을 제대로 마무리하는 태도가 다음 신뢰가');
  out = out.replace(/한 자리에서 길게 머문 만큼 후반의 자리도/g, '한 역할에 오래 머문 만큼 후반의 기반도');
  out = out.replace(/한 자리에서 자기 색을/g, '한 분야에서 자기 색을');
  out = out.replace(/후반의 자리도 길게/g, '후반의 역할도 길게');
  out = out.replace(/자기 자리에서의 작은 결정이 다음 자리의 폭을/g, '지금 역할에서의 작은 결정이 다음 단계의 폭을');
  out = out.replace(/인생의 자리를 잡아 주는 흐름/g, '인생의 기준을 잡아 주는 흐름');
  out = out.replace(/몇 년의 흐름을 받쳐 주는 자리예요/g, '몇 년의 흐름을 받쳐 주는 기준이 돼요');
  out = out.replace(/한 분야의 기준을 또렷이 잡는 자리예요/g, '한 분야의 기준을 또렷이 잡는 일이에요');
  out = out.replace(/관계를 지켜 주는 흐름이에요/g, '관계를 지켜 주는 힘이에요');
  out = out.replace(/자격증·이력서·증명 서류 자리에서/g, '자격증·이력서·증명 서류에서');
  out = out.replace(/시험 응시 한 자리가/g, '시험 응시 한 번이');
  out = out.replace(/한 분야를 처음부터 끝까지 끌고 가는 자리예요/g, '한 분야를 처음부터 끝까지 끌고 가는 일이에요');
  out = out.replace(/오늘 일간 /g, '오늘은 ');
  out = out.replace(/일간이 약한 자리에서/g, '일간이 약한 시기에');
  out = out.replace(/장년기에 일간이 약한 시기에/g, '장년기에는 일간이 약해');
  out = out.replace(/장년기에 일간이 약한 자리에서/g, '장년기에는 일간이 약해');
  out = out.replace(/장년기 자리에서 일간이 약하고/g, '장년기에는 일간이 약하고');
  out = out.replace(/보강을 천천히 찾아가는 자리예요/g, '보강을 천천히 찾아가는 시기예요');
  out = out.replace(/보강을 의식적으로 챙겨야 하는 자리라/g, '보강을 의식적으로 챙겨야 해서');
  out = out.replace(/그 자리를 놓치지 않으면/g, '그 시기를 놓치지 않으면');
  out = out.replace(/일찍 잠드는 자리를 챙겨요/g, '일찍 잠드는 시간을 챙겨요');
  out = out.replace(/일찍 잠드는 자리가 좋아요/g, '일찍 잠드는 시간이 좋아요');
  // P11-A2: period-aware normalize. Source fragments live in
  // `data/narrative/health_stress/{today,thisWeek}/brief.fragments.json` and
  // both originally end with `잠을 충분히 챙기는 자리예요`. An earlier
  // unconditional rewrite mapped both to `하루예요`, which produced the
  // logical contradiction `이번 주는 ... 하루예요` (P10-A5 audit C2). The
  // fix anchors on the period prefix so each period maps to a coherent
  // unit: today→하루예요, thisWeek→한 주예요. No 이번 달/올해/평생
  // variants exist for this phrase in data/, so we don't add handlers for
  // periods that won't fire.
  out = out.replace(/오늘은 잠을 충분히 챙기는 자리예요/g, '오늘은 잠을 충분히 챙기는 하루예요');
  out = out.replace(/이번 주는 잠을 충분히 챙기는 자리예요/g, '이번 주는 잠을 충분히 챙기는 한 주예요');
  out = out.replace(/한 박자 늦추는 자리가 잘 어울려요/g, '한 박자 늦추는 태도가 잘 어울려요');
  out = out.replace(/시기를 지나는 자리이니/g, '시기이니');
  out = out.replace(/자기 자리를 위한 시간/g, '나를 위한 시간');
  out = out.replace(/회복의 흐름은/g, '회복 방향은');
  out = out.replace(/을 살리는 자리에서/g, '을 살릴 때');
  out = out.replace(/마음의 짐을 가장 잘 풀어 주는 자리가 돼요/g, '마음의 짐을 가장 잘 풀어 줘요');
  out = out.replace(/곁의 신호를 받아들이는 자리가 잘 어울려요/g, '곁의 신호를 받아들이는 태도가 잘 어울려요');
  out = out.replace(/곁의 신호를 받아들이는 자리가 잘 어울리는 시기예요/g, '곁의 신호를 받아들이는 태도가 잘 어울리는 시기예요');
  out = out.replace(/자연스럽게 받아들이는 자리가 가장 큰 자산/g, '자연스럽게 받아들이는 태도가 가장 큰 자산');
  out = out.replace(/의 자리에서 들어오는 관심/g, '에서는 들어오는 관심');
  out = out.replace(/이 자리를 잡으면 약속/g, '이 안정되면 약속');
  out = out.replace(/인생 전체에서 인연의 결을 살펴보면/g, '인생 전체의 인연운을 살펴보면');
  out = out.replace(/인생 전체에서 인연의 흐름을 살펴보면/g, '인생 전체의 인연운을 살펴보면');
  out = out.replace(/시기마다 사람과 사람 사이의 거리가 천천히 다듬어지는 흐름이 보여요/g, '시기마다 사람과 사람 사이의 거리가 천천히 다듬어지는 모습이에요');
  out = out.replace(/새 인연이 들어올 자리가/g, '새 인연을 만날 가능성이');
  out = out.replace(/마음을 표현할 자리에서/g, '마음을 표현할 때');
  out = out.replace(/마음을 표현해야 할 자리가/g, '마음을 표현해야 할 때가');
  out = out.replace(/인연 운/g, '인연운');
  out = out.replace(/어울리는 사람이 어울리는 자리에 자연스럽게 머물러요/g, '어울리는 사람이 자연스럽게 곁에 머물러요');
  out = out.replace(/한 평생의 흐름은 늦게 자리 잡고 길게 가는 그림이에요/g, '한평생의 방향은 늦게 잡히더라도 길게 이어지는 그림이에요');
  out = out.replace(/한평생의 흐름은 늦게 자리 잡고 길게 가는 그림이에요/g, '한평생의 방향은 늦게 잡히더라도 길게 이어지는 그림이에요');
  out = out.replace(/한 번 잡은 자리는 오래 가는 편이에요/g, '한 번 정한 방향은 오래 이어 가는 편이에요');
  out = out.replace(/빠른 결정을 강요받는 자리는/g, '빠른 결정을 강요받으면');
  out = out.replace(/자기 페이스를 지키는 결이/g, '자기 페이스를 지키는 태도가');
  out = out.replace(/자기 페이스를 지키는 흐름이/g, '자기 페이스를 지키는 태도가');
  out = out.replace(/#식신과 #상관의 자리에서/g, '#식신과 #상관의 기운으로');
  out = out.replace(/발표·창작·동아리·시험 자리 어디에서도/g, '발표·창작·동아리·시험 같은 활동에서');
  out = out.replace(/단체 활동·동아리·발표 자리에서/g, '단체 활동·동아리·발표 같은 활동에서');
  out = out.replace(/발표·창작·동아리 자리에서/g, '발표·창작·동아리 같은 활동에서');
  out = out.replace(/발표·창작 자리에서/g, '발표·창작 같은 활동에서');
  out = out.replace(/무대·발표·창작 자리에서/g, '무대·발표·창작 같은 활동에서');
  out = out.replace(/사람들이 모이는 자리에/g, '사람들이 모이는 곳에');
  out = out.replace(/사람들이 모이는 자리에서/g, '사람들이 모이는 곳에서');
  out = out.replace(/사람들이 모이는 자리가/g, '사람들이 모이는 기회가');
  out = out.replace(/사람들과의 자리가 늘어나면/g, '사람들과 만나는 일이 늘어나면');
  out = out.replace(/다양한 자리에서 상대를 알아 가는/g, '다양한 활동에서 상대를 알아 가는');
  out = out.replace(/일상의 흐름을 함께 즐기는 자리로/g, '일상의 시간을 함께 즐기는 정도로');
  out = out.replace(/진로·약속의 자리에서/g, '진로·약속의 책임감으로');
  out = out.replace(/책임의 결인/g, '책임 기운인');
  out = out.replace(/자기다움을 다듬는 결을 충분히 누리는 자리예요/g, '자기다움을 다듬는 시간을 충분히 누리면 좋아요');
  out = out.replace(/짝과 관련한 결정은 한참 뒤의 이야기로 두는 자리예요/g, '짝과 관련한 결정은 한참 뒤의 이야기로 두면 충분해요');
  out = out.replace(/먼저 다가갈 자리가 자주 열리는 시기예요/g, '먼저 다가갈 기회가 자주 열리는 시기예요');
  out = out.replace(/먼저 다가가는 자리가/g, '먼저 다가가는 기회가');
  out = out.replace(/#배우자궁의 자리에서/g, '#배우자궁에서는');
  out = out.replace(/사람을 끌어모으는 자리가/g, '사람을 끌어모으는 기회가');
  out = out.replace(/#정관의 결이 함께 자리를 잡으면/g, '#정관의 기운이 함께 잡히면');
  out = out.replace(/#정관의 흐름이 함께 자리를 잡으면/g, '#정관의 기운이 함께 잡히면');
  out = out.replace(/#물의 흐름이 잔잔해서 마음이 가라앉기 쉬운 자리예요/g, '#물 일간의 기운이 잔잔해 마음이 가라앉기 쉬워요');
  out = out.replace(/의 흐름이 잔잔해서 마음이 가라앉기 쉬운 자리예요/g, ' 일간의 기운이 잔잔해 마음이 가라앉기 쉬워요');
  out = out.replace(/#불의 따뜻한 흐름을/g, '#불의 따뜻한 기운을');
  out = out.replace(/#불의 따뜻한 흐름을 가까이 두는 자리, 즉 햇빛 아래 산책·따뜻한 차의 자리에서/g, '#불의 따뜻한 기운을 가까이 두면 도움이 되며, 햇빛 아래 산책이나 따뜻한 차가');
  out = out.replace(/#정인의 따뜻한 돌봄을 가까이 두는 자리가 한 해 회복의 큰 자리가 돼요/g, '#정인의 따뜻한 돌봄을 가까이 두는 습관이 한 해 회복의 큰 축이 돼요');
  out = out.replace(/천천히 익는 자리는 흉한 자리가 아니니/g, '천천히 익는 시간은 흉한 신호가 아니니');
  out = out.replace(/천천히 익는 자리는 흉한 자리가 아니에요/g, '천천히 익는 시간은 흉한 신호가 아니에요');
  out = out.replace(/천천히 익는 시기는 흉한 자리가 아니니/g, '천천히 익는 시기는 흉한 신호가 아니니');
  out = out.replace(/천천히 익는 시기는 흉한 자리가 아니에요/g, '천천히 익는 시기는 흉한 신호가 아니에요');
  out = out.replace(/결과가 더디게 오는 자리에서/g, '결과가 더디게 오는 시기에');
  out = out.replace(/의 자리가 가까이 있을 때/g, '의 기운이 가까이 있을 때');
  out = out.replace(/가족·스승의 자리를 따뜻하게 두는/g, '가족·스승과의 관계를 따뜻하게 두는');
  out = out.replace(/자랄 자리가 넓을수록/g, '자랄 공간이 넓을수록');
  out = out.replace(/가볍게 이야기 나누는 자리가/g, '가볍게 이야기 나누는 시간이');
  out = out.replace(/큰 자리 변경/g, '큰 변화');
  out = out.replace(/익숙한 자리가 우선이에요/g, '익숙한 동선이 우선이에요');
  out = out.replace(/자리가 우선이라/g, '동선이 우선이라');
  out = out.replace(/익숙한 자리에서 한 발짝씩 넓혀/g, '익숙한 동선에서 한 발짝씩 넓혀');
  out = out.replace(/자기 자리를 늘려/g, '활동 범위를 늘려');
  out = out.replace(/새 자리에서 자기 길이/g, '새 환경에서 자기 길이');
  out = out.replace(/이사·이직 자리가/g, '이사·이직 기회가');
  out = out.replace(/평소 가지 않던 자리의 산책/g, '평소 가지 않던 길의 산책');
  out = out.replace(/평소 가지 않던 자리에서/g, '평소 가지 않던 곳에서');
  out = out.replace(/가까운 자리로 가벼운 환기/g, '가까운 곳에서 가벼운 환기');
  out = out.replace(/가까운 자리로 충분/g, '가까운 곳이면 충분');
  out = out.replace(/친구와 가까운 자리를/g, '친구와 가까운 곳을');
  out = out.replace(/가까운 자리를 가요/g, '가까운 곳을 가요');
  out = out.replace(/가까운 자리를 둘러봐요/g, '가까운 곳을 둘러봐요');
  out = out.replace(/가까운 자리가 잘 어울려요/g, '가까운 장소가 잘 어울려요');
  out = out.replace(/새 자리에 닿을 때마다/g, '새 환경에 닿을 때마다');
  out = out.replace(/다음 새 자리가/g, '다음 새 환경이');
  out = out.replace(/보완 방향에 맞는 자리가/g, '보완 방향에 맞는 기회가');
  out = out.replace(/의 첫 자리가 환경 변화와 만나면서/g, '의 첫 흐름이 환경 변화와 만나면서');
  out = out.replace(/여행·전학·체험 자리의 자극/g, '여행·전학·체험 경험의 자극');
  out = out.replace(/평소 다니던 자리에서/g, '평소 다니던 길에서');
  out = out.replace(/한 자리에만 머무르면/g, '한곳에만 머무르면');
  out = out.replace(/한 자리에만 종일/g, '한곳에만 종일');
  out = out.replace(/신뢰가 자리를 정돈해/g, '신뢰가 일을 정돈해');
  out = out.replace(/자기 자리도 함께 자라/g, '자기 기준도 함께 자라');
  out = out.replace(/다음 분기의 자리가/g, '다음 분기의 선택지가');
  out = out.replace(/가족 자리에 한 호흡씩/g, '가족에게 한 호흡씩');
  out = out.replace(/학업·친구 자리가/g, '학업·친구 관계가');
  out = out.replace(/가족과 친구의 자리를/g, '가족과 친구 관계를');
  out = out.replace(/큰 자리를 만들어/g, '큰 기반을 만들어');
  out = out.replace(/자기 자리를 함께 키워/g, '자기 기반을 함께 키워');
  out = out.replace(/나누는 자리가 자연스럽게 생겨요/g, '나눌 기회가 자연스럽게 생겨요');
  out = out.replace(/가까이 있던 자리를/g, '가까운 관계를');
  out = out.replace(/자기 자리를 만들기 위한/g, '자기 기준을 만들기 위한');
  out = out.replace(/비슷해지는 자리이기도 해요/g, '비슷해지는 시기이기도 해요');
  out = out.replace(/부딪히는 자리가 있어도/g, '부딪히는 일이 있어도');
  out = out.replace(/챙기는 자리예요/g, '챙기는 시기예요');
  out = out.replace(/가꿔 가는 자리예요/g, '가꿔 가는 시기예요');
  out = out.replace(/어른 자리에 시간을/g, '어른께 시간을');
  out = out.replace(/양가 자리에 시간을/g, '양가에 시간을');
  out = out.replace(/새로운 자리를 같이 만들어/g, '새로운 시간을 같이 만들어');
  out = out.replace(/같이 만들어 가는 작은 자리가/g, '같이 만들어 가는 작은 시간이');
  out = out.replace(/일상의 관계를 즐기는 자리로/g, '일상의 관계를 즐기는 하루로');
  out = out.replace(/곁의 신호를 받아들이는 자리도/g, '곁의 신호를 받아들이는 여유도');
  out = out.replace(/학교 시험·읽기쓰기 자리에서/g, '학교 시험·읽기쓰기에서');
  out = out.replace(/계약·법률문서·자격 갱신 자리에서/g, '계약·법률문서·자격 갱신에서');
  out = out.replace(/새로운 자리를 더하는 그림/g, '새로운 기준을 더하는 그림');
  out = out.replace(/환경의 도움을 잘 골라 받는 자리예요/g, '환경의 도움을 잘 골라 받는 시기예요');
  out = out.replace(/막혔던 자리가 풀리는 흐름이에요/g, '막혔던 부분이 풀리는 흐름이에요');
  out = out.replace(/끝까지 가는 자리가/g, '끝까지 밀고 가는 힘이');
  out = out.replace(/다 해내는 자리예요/g, '다 해내는 힘이에요');
  out = out.replace(/학업·시험 자리는/g, '학업·시험에서는');
  out = out.replace(/두 자리가 길하면/g, '두 지표가 길하면');
  out = out.replace(/자기 학습이 또렷해지는 자리가/g, '자기 학습이 또렷해지는 기회가');
  out = out.replace(/좋아하는 한 과목에서 한 단계 더 깊이 들어가는 자리예요/g, '좋아하는 한 과목에서 한 단계 더 깊이 들어가는 일이에요');
  out = out.replace(/좋아하는 한 가지를 깊게 파고드는 자리예요/g, '좋아하는 한 가지를 깊게 파고드는 시간이에요');
  out = out.replace(/한 단계 더 깊이 들어가는 자리예요/g, '한 단계 더 깊이 들어가는 일이에요');
  out = out.replace(/자기 자료에 더 깊이 들어가는 자리예요/g, '자기 자료에 더 깊이 들어가는 시간이에요');
  out = out.replace(/의 결이 학습으로 또렷이 풀리는 자리예요/g, '의 기운이 학습으로 또렷이 풀리는 시기예요');
  out = out.replace(/의 흐름이 학습으로 또렷이 풀리는 자리예요/g, '의 기운이 학습으로 또렷이 풀리는 시기예요');
  out = out.replace(/의 결이 자연스럽게 풀리는 자리예요/g, '의 기운이 자연스럽게 풀리는 시기예요');
  out = out.replace(/의 결이 함께 받쳐 주면/g, '의 기운이 함께 받쳐 주면');
  out = out.replace(/이 받쳐 주는 자리에서/g, '이 받쳐 줄 때');
  out = out.replace(/인성 기운이 부족한 자리에서는/g, '인성 기운이 부족할 때는');
  out = out.replace(/함께하는 자리가 한 해 동안/g, '함께하는 시간이 한 해 동안');
  out = out.replace(/일상의 다정함을 챙기는 자리로 한 해를/g, '일상의 다정함을 챙기는 한 해로');
  out = out.replace(/먼저 다가가기 좋은 자리예요/g, '먼저 다가가기 좋은 날이에요');
  out = out.replace(/정돈하는 자리가 자주 와요/g, '정돈할 기회가 자주 와요');
  out = out.replace(/넓혀 두기 좋은 자리예요/g, '넓혀 두기 좋은 시기예요');
  out = out.replace(/따뜻한 자리로 두면/g, '따뜻한 시간으로 두면');
  out = out.replace(/한 박자 늦추는 자리가 회복의 자리예요/g, '한 박자 늦추는 시간이 회복에 도움이 돼요');
  out = out.replace(/오늘은 잘 쉬고 따뜻하게 챙기는 흐름으로\./g, '오늘은 잘 쉬고 따뜻하게 챙기는 하루예요.');
  out = out.replace(/쉬는 자리를 미리 짜두면/g, '쉴 시간을 미리 정해 두면');
  out = out.replace(/쉬는 자리를 만들어/g, '쉴 시간을 만들어');
  out = out.replace(/자리잡/g, '자리 잡');
  out = out.replace(/곁 사람/g, '가까운 사람');
  out = out.replace(/정해두/g, '정해 두');
  out = out.replace(/남겨두/g, '남겨 두');
  out = out.replace(/챙겨두/g, '챙겨 두');
  out = out.replace(/쌓아가는/g, '쌓아 가는');
  out = out.replace(/만들어줘요/g, '만들어 줘요');
  out = out.replace(/회복기지/g, '회복 기반');
  out = out.replace(/회복 기반가/g, '회복 기반이');
  out = out.replace(/자기 자리의 방향/g, '자기 역할의 방향');
  out = out.replace(/다음 주의 자리 폭/g, '다음 주 선택의 폭');
  out = out.replace(/좋아하는 분야와 잘하는 일이 만나는 자리를/g, '좋아하는 분야와 잘하는 일이 만나는 접점을');
  out = out.replace(/막막해지는 결보다/g, '막막함보다');
  out = out.replace(/너무 멀리 보고 막막함보다/g, '너무 멀리 보고 막막해하기보다');
  out = out.replace(/잘 어울리는 흐름이에요/g, '잘 어울려요');
  out = out.replace(/다음 자리의 명함/g, '다음 단계의 명함');
  out = out.replace(/바쁜 자리이지만/g, '바쁜 하루이지만');
  out = out.replace(/짧은 안부를 나누는 자리만 있어도/g, '짧은 안부만 있어도');
  out = out.replace(/새 식구가 자리를 잡고/g, '새 식구와 생활 리듬이 잡히고');
  out = out.replace(/풀어 내는 자리이고/g, '풀어 내는 시기이고');
  out = out.replace(/어려운 자리에서/g, '어려운 상황에서');
  out = out.replace(/자기 시간이 가장자리로 밀릴 수 있어/g, '자기 시간이 뒤로 밀릴 수 있어');
  out = out.replace(/한 자리는 자기 휴식을 위해/g, '한 칸은 자기 휴식을 위해');
  out = out.replace(/내 자리도 한 자리 비워 두기/g, '내 시간도 한 칸 비워 두기');
  out = out.replace(/가까운 자리에서 한 마디·한 줄/g, '가까운 사람 앞에서 한 마디·한 줄');
  out = out.replace(/가까운 자리에서 한 매듭·한 줄/g, '가까운 사람 앞에서 한 매듭·한 줄');
  out = out.replace(/가까운 자리부터 차근히/g, '가까운 사람 앞에서 차근히');
  out = out.replace(/다음 세대와 만나는 자리/g, '다음 세대와 만나는 기회');
  out = out.replace(/#용신이 부드럽게 자리 잡고/g, '#용신 보강이 부드럽게 들어오고');
  out = out.replace(/#용신이 부드럽게 자리 잡아/g, '#용신 보강이 부드럽게 들어와');
  out = out.replace(/#정재의 기운이 자리 잡혀/g, '#정재의 기운이 안정돼');
  out = out.replace(/일과 가족 사이의 짧은 자리들이/g, '일과 가족 사이의 짧은 시간들이');
  out = out.replace(/한 달을 닫는 자리에서/g, '한 달을 마무리할 때');
  out = out.replace(/이사·이직의 자리가 한 번 크게 열리는 흐름이에요/g, '이사·이직 기회가 한 번 크게 열리는 시기예요');
  out = out.replace(/한 가지 시도가 다음 자리로 이어지는 흐름이에요/g, '한 가지 시도가 다음 단계로 이어져요');
  out = out.replace(/작은 결정을 하나씩 쌓아 가는 방식이 잘 맞습니다/g, '작은 결정을 하나씩 쌓아 가는 방식이 잘 맞아요');
  out = out.replace(/잘 맞습니다/g, '잘 맞아요');
  out = out.replace(/큰 결정을 한 번에 짓기보다/g, '큰 결정을 한 번에 내리기보다');
  out = out.replace(/사계절을 한 화분에 담아 보는 그림이에요/g, '한 화분이 사계절을 지나며 자라는 그림이에요');
  out = out.replace(/학교 트랙보다/g, '학교 과정보다');
  out = out.replace(/한 트랙을 풀어 가기 좋은 시기예요/g, '한 가지 방향을 정리하기 좋은 시기예요');
  out = out.replace(/다음 10년의 트랙을/g, '다음 10년의 방향을');
  out = out.replace(/한두 트랙에/g, '한두 방향에');
  out = out.replace(/가까운 사람에게 보여 보는 자리가 도움이 돼요/g, '가까운 사람에게 먼저 보여 보는 것도 도움이 돼요');
  out = out.replace(/한 매듭으로 묶어 두는 흐름이 잘 맞아요/g, '한 매듭으로 묶어 두는 방식이 잘 맞아요');
  out = out.replace(/한 주에 한 가지 매듭을 짓는 흐름이 잘 맞아요/g, '한 주에 한 가지씩 매듭짓는 방식이 잘 맞아요');
  out = out.replace(/봄에 태어난 사람은 몸과 마음이 새 자극에 민감하게 반응하기 쉬운 편으로 볼 수 있습니다/g, '봄에 태어난 사람은 몸과 마음이 새 자극에 민감하게 반응하기 쉬워요');
  out = out.replace(/건강 관리는 무리한 속도보다 몸을 따뜻하게 유지하고, 깊은 휴식과 가벼운 움직임을 균형 있게 이어가는 것이 좋습니다/g, '건강 관리는 무리한 속도보다 몸을 따뜻하게 유지하고, 깊은 휴식과 가벼운 움직임을 균형 있게 이어가면 좋아요');
  out = out.replace(/공부와 서류 일이 빨라집니다/g, '공부와 서류 처리가 빨라져요');
  out = out.replace(/안정됩니다/g, '안정돼요');
  out = out.replace(/빨라집니다/g, '빨라져요');
  out = out.replace(/도움이 됩니다/g, '도움이 돼요');
  out = out.replace(/선명해집니다/g, '선명해져요');
  out = out.replace(/쌓입니다/g, '쌓여요');
  out = out.replace(/됩니다/g, '돼요');
  out = out.replace(/이어집니다/g, '이어져요');
  out = out.replace(/생깁니다/g, '생겨요');
  out = out.replace(/줄어듭니다/g, '줄어요');
  out = out.replace(/풀립니다/g, '풀려요');
  out = out.replace(/커집니다/g, '커져요');
  out = out.replace(/높아집니다/g, '높아져요');
  out = out.replace(/강해집니다/g, '강해져요');
  out = out.replace(/높입니다/g, '높여요');
  out = out.replace(/키웁니다/g, '키워요');
  out = out.replace(/줄입니다/g, '줄여요');
  out = out.replace(/증폭합니다/g, '증폭해요');
  out = out.replace(/안정시킵니다/g, '안정시켜요');
  out = out.replace(/드러납니다/g, '드러나요');
  out = out.replace(/작동합니다/g, '작동해요');
  out = out.replace(/촉진합니다/g, '촉진해요');
  out = out.replace(/강화합니다/g, '강화해요');
  out = out.replace(/전환합니다/g, '전환해요');
  out = out.replace(/나타날 수 있습니다/g, '나타날 수 있어요');
  out = out.replace(/늘 수 있습니다/g, '늘 수 있어요');
  out = out.replace(/될 수 있습니다/g, '될 수 있어요');
  out = out.replace(/만들 수 있습니다/g, '만들 수 있어요');
  out = out.replace(/생길 수 있습니다/g, '생길 수 있어요');
  out = out.replace(/이어질 수 있습니다/g, '이어질 수 있어요');
  out = out.replace(/반응하기 쉽습니다/g, '반응하기 쉬워요');
  out = out.replace(/나가기 쉽습니다/g, '나가기 쉬워요');
  out = out.replace(/구분해야 합니다/g, '구분해야 해요');
  out = out.replace(/확인해야 합니다/g, '확인해야 해요');
  out = out.replace(/봐야 합니다/g, '봐야 해요');
  out = out.replace(/해야 합니다/g, '해야 해요');
  out = out.replace(/역할을 합니다/g, '역할을 해요');
  out = out.replace(/먼저입니다/g, '먼저예요');
  out = out.replace(/우선입니다/g, '먼저예요');
  out = out.replace(/봅니다/g, '봐요');
  out = out.replace(/필요합니다/g, '필요해요');
  out = out.replace(/중요합니다/g, '중요해요');
  out = out.replace(/적절합니다/g, '적절해요');
  out = out.replace(/안전합니다/g, '안전해요');
  out = out.replace(/않습니다/g, '않아요');
  out = out.replace(/좋습니다/g, '좋아요');
  out = out.replace(/합니다/g, '해요');
  out = out.replace(/흐름입니다/g, '흐름이에요');
  out = out.replace(/신호입니다/g, '신호예요');
  out = out.replace(/기준입니다/g, '기준이에요');
  out = out.replace(/지표입니다/g, '지표예요');
  out = out.replace(/형태입니다/g, '형태예요');
  out = out.replace(/모양입니다/g, '모양이에요');
  out = out.replace(/힘입니다/g, '힘이에요');
  out = out.replace(/시기입니다/g, '시기예요');
  out = out.replace(/효율적입니다/g, '효율적이에요');
  out = out.replace(/안정적입니다/g, '안정적이에요');
  out = out.replace(/표현을 한결 풀어 주는 흐름이에요/g, '표현을 한결 풀어 줘요');
  out = out.replace(/표현을 한 단계 넓혀 주는 흐름이에요/g, '표현을 한 단계 넓혀 줘요');
  out = out.replace(/작은 작업이 흐름을 단단히 해 줘요/g, '작은 작업이 표현을 단단히 해 줘요');
  out = out.replace(/색이 진해지는 흐름이에요/g, '색이 진해지는 시간이에요');
  out = out.replace(/나눠 보는 자리도 잘 맞아요/g, '나눠 보는 시간도 잘 맞아요');
  out = out.replace(/후배·아이·다음 사람과의 자리가 자연스러워요/g, '후배·아이·다음 사람과 나누는 시간이 자연스러워요');
  out = out.replace(/자녀와의 흐름도 함께 비치지만/g, '자녀와의 관계 가능성도 함께 비치지만');
  out = out.replace(/거절할 자리는/g, '거절할 일은');
  out = out.replace(/풀어 가기 좋은 흐름이에요/g, '풀어 가기 좋은 시기예요');
  out = out.replace(/막혔던 부분이 풀리는 흐름이에요/g, '막혔던 부분이 풀려요');
  out = out.replace(/천천히 깊어지는 흐름은/g, '천천히 깊어지는 힘은');
  out = out.replace(/익숙한 동선에서 한 발짝씩 넓혀 가는 흐름이에요/g, '익숙한 동선에서 한 발짝씩 넓혀 가기 좋아요');
  out = out.replace(/의 자극을 천천히 받아들이는 흐름이에요/g, '의 자극을 천천히 받아들이는 시기예요');
  out = out.replace(/의 자극을 천천히 풀어 내는 흐름이에요/g, '의 자극을 천천히 풀어 내는 시기예요');
  out = out.replace(/큰 변화는 단계로 나누는 흐름이/g, '큰 변화는 단계로 나누는 방식이');
  out = out.replace(/시기이에요/g, '시기예요');
  return out.replace(/([.!?])(?=[가-힣])/g, '$1 ');
}

function reduceOverusedGyeol(value: string): string {
  const count = (value.match(/결/g) ?? []).length;
  if (count === 0) return value;

  // Paragraph-aware: avoid creating 3+ '흐름' clusters in single paragraph.
  // Pre-count existing '흐름' to budget substitutions.
  const paragraphs = value.split(/\n\n+/);
  return paragraphs.map((p) => substituteGyeolInParagraph(p)).join('\n\n');
}

/**
 * Substitution entry for `결X → 흐름X` / `결X → altX` rewrite.
 *
 * `flowForm` is the canonical 흐름-stem form (used while the paragraph still
 * has the density budget). `altSuffix` is the post-batchim particle that
 * gets appended to a no-batchim or batchim alternative once the 흐름
 * budget is exhausted. `결` always carries ㄹ-batchim, so its surface
 * suffixes assume the batchim form; the alt may not — see P15-A2.
 */
interface GyeolSub {
  readonly pattern: RegExp;
  readonly flowForm: string;
  readonly altSuffix: { readonly batchim: string; readonly noBatchim: string };
}

/**
 * Order matters — longer patterns first so `결이에요` matches before `결이`.
 *
 * Particle batchim/no-batchim pairs:
 *   • subject: 이/가, topic: 은/는, object: 을/를
 *   • copula: 이에요/예요, 이라/라, 이고/고
 *   • directional: 으로/로 (none of the alts carry ㄹ-batchim, so the simple
 *     binary works; if a ㄹ-batchim alt is ever added the no-batchim branch
 *     applies for it as well)
 *   • universal (no variant): 의, 도, 만, 처럼, 마다, 입니다
 *
 * P19-A3: every pattern is prefixed with `(?<![가-힣])` so a Hangul morpheme
 * boundary precedes `결`. Without the lookbehind, compounds whose final
 * morpheme is `결` — `연결`, `종결`, `직결`, `타결`, `해결`, `귀결`,
 * `완결`, etc. — would have their tails (e.g., `연결을`, `해결의`)
 * mis-rewritten as `연흐름을` / `해흐름의`. The lookbehind only fires when
 * the character immediately before `결` is itself Hangul; particle-form
 * `결X` at the start of a sentence or after whitespace/punctuation is
 * unaffected.
 */
const GYEOL_SUBS: readonly GyeolSub[] = [
  { pattern: /(?<![가-힣])결이에요/g, flowForm: '흐름이에요', altSuffix: { batchim: '이에요', noBatchim: '예요' } },
  { pattern: /(?<![가-힣])결입니다/g, flowForm: '흐름입니다', altSuffix: { batchim: '입니다', noBatchim: '입니다' } },
  { pattern: /(?<![가-힣])결이라/g, flowForm: '흐름이라', altSuffix: { batchim: '이라', noBatchim: '라' } },
  { pattern: /(?<![가-힣])결이고/g, flowForm: '흐름이고', altSuffix: { batchim: '이고', noBatchim: '고' } },
  { pattern: /(?<![가-힣])결이/g, flowForm: '흐름이', altSuffix: { batchim: '이', noBatchim: '가' } },
  { pattern: /(?<![가-힣])결은/g, flowForm: '흐름은', altSuffix: { batchim: '은', noBatchim: '는' } },
  { pattern: /(?<![가-힣])결을/g, flowForm: '흐름을', altSuffix: { batchim: '을', noBatchim: '를' } },
  { pattern: /(?<![가-힣])결로/g, flowForm: '흐름으로', altSuffix: { batchim: '으로', noBatchim: '로' } },
  { pattern: /(?<![가-힣])결의/g, flowForm: '흐름의', altSuffix: { batchim: '의', noBatchim: '의' } },
  { pattern: /(?<![가-힣])결도/g, flowForm: '흐름도', altSuffix: { batchim: '도', noBatchim: '도' } },
  { pattern: /(?<![가-힣])결만/g, flowForm: '흐름만', altSuffix: { batchim: '만', noBatchim: '만' } },
  { pattern: /(?<![가-힣])결처럼/g, flowForm: '흐름처럼', altSuffix: { batchim: '처럼', noBatchim: '처럼' } },
  { pattern: /(?<![가-힣])결마다/g, flowForm: '흐름마다', altSuffix: { batchim: '마다', noBatchim: '마다' } },
];

const GYEOL_ALTERNATIVES = ['리듬', '자리', '호흡', '걸음'] as const;

function substituteGyeolInParagraph(paragraph: string): string {
  const initialFlow = (paragraph.match(/흐름/g) ?? []).length;
  let altIdx = 0;
  const pickAlt = (): string => GYEOL_ALTERNATIVES[altIdx++ % GYEOL_ALTERNATIVES.length];

  let out = paragraph;
  let appliedFlow = initialFlow;
  for (const { pattern, flowForm, altSuffix } of GYEOL_SUBS) {
    out = out.replace(pattern, () => {
      appliedFlow += 1;
      // After 2 흐름 already in paragraph, substitute an alternative instead
      // — picking the suffix variant that agrees with the alt's batchim.
      if (appliedFlow > 2) {
        const alt = pickAlt();
        const suffix = hasFinalConsonant(alt) ? altSuffix.batchim : altSuffix.noBatchim;
        return alt + suffix;
      }
      return flowForm;
    });
  }
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
  return compressBriefHeadlineIfApplicable(normalizeRenderedText(out.replace(/\s{2,}/g, ' ')));
}

/**
 * Brief-tier post-pass: undo the `reduceOverusedGyeol`-style `결X → 흐름X`
 * style rewrite when, and only when, doing so is needed to keep the output
 * within the contract's `≤ 28 Korean characters` brief invariant
 * (`data/narrative/_contract/v1.json:depthContracts.brief.intent`).
 *
 * Length-gated:
 *   • input ≤ 28 chars  → return unchanged (already fits).
 *   • input > 32 chars  → return unchanged (standard/expert paragraph;
 *                          probe shows tier-2/3 plainText is always > 60).
 *   • 29 ≤ input ≤ 32   → minimal reversal until ≤ 28 (or no more applies).
 *
 * Reversal set excludes `흐름의 → 결의` because that re-creates the
 * `결의 결과` anti-pattern guarded by tiered-progressive-disclosure.test.ts.
 *
 * Idempotent: a second call finds no `흐름X` left to reverse.
 */
export function compressBriefHeadlineIfApplicable(text: string): string {
  const len = [...text].length;
  if (len <= 28 || len > 32) return text;
  return compressBriefHeadline(text);
}

const BRIEF_HEADLINE_REVERSALS: ReadonlyArray<readonly [RegExp, string]> = [
  // Longer matches first so a shorter prefix (e.g., 흐름이) does not steal
  // characters from a longer, more idiomatic ending (e.g., 흐름이에요).
  [/흐름입니다/, '결입니다'],
  [/흐름이에요/, '결이에요'],
  [/흐름이라/, '결이라'],
  [/흐름이고/, '결이고'],
  [/흐름으로/, '결로'],
  [/흐름처럼/, '결처럼'],
  [/흐름마다/, '결마다'],
  [/흐름이/, '결이'],
  [/흐름은/, '결은'],
  [/흐름을/, '결을'],
  [/흐름도/, '결도'],
  [/흐름만/, '결만'],
];

/**
 * P18-A4: doubled-`결X` cluster detector for brief reversal guard.
 *
 * The reversal cycle in `compressBriefHeadline` chains multiple
 * `흐름X → 결X` substitutions; when the source already contains a `결X`
 * particle form (e.g., `결이` from `reduceOverusedGyeol`'s budget being
 * unused) and a later reversal introduces a second `결X` in the same
 * sentence, the result reads as a stylistic doubled-결 cluster
 * (e.g., `결이 ... 결이에요`). We block any reversal whose result
 * would contain two such surface forms.
 *
 * The detector is intentionally scoped to the exact surface forms
 * `BRIEF_HEADLINE_REVERSALS` can produce. Noun compounds whose first
 * morpheme happens to be `결` — `결과`, `결정`, `결심`, `결실`, `결국`,
 * `결합`, `결성`, `결말`, `결재`, `결판`, etc. — never appear in the
 * reversal table, so excluding them from the regex avoids false
 * positives when `결과 ... 결이에요` (legitimate prose) would otherwise
 * trip the guard.
 */
const GYEOL_PARTICLE_FORMS = /결(?:입니다|이에요|이라|이고|로|처럼|마다|이|은|을|도|만)(?![가-힣])/g;

function hasDoubledGyeolCluster(text: string): boolean {
  const matches = text.match(GYEOL_PARTICLE_FORMS);
  return matches !== null && matches.length >= 2;
}

function compressBriefHeadline(text: string): string {
  let out = text;
  let outLen = [...out].length;
  if (outLen <= 28) return out;

  let changed = true;
  while (changed && outLen > 28) {
    changed = false;
    for (const [re, replacement] of BRIEF_HEADLINE_REVERSALS) {
      const next = out.replace(re, replacement);
      if (next === out) continue;
      // P18-A4: skip any reversal whose result would form a doubled-`결X`
      // cluster (e.g., `결이 ... 결이에요`). Stylistic guard — the brief
      // length invariant yields to cluster avoidance when the two conflict.
      if (hasDoubledGyeolCluster(next)) continue;
      out = next;
      outLen = [...out].length;
      changed = true;
      if (outLen <= 28) return out;
    }
  }
  return out;
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

/**
 * Resolve a fragment's templateTokens into a flat ParagraphToken stream.
 * Slot tokens are looked up via `resolveSlot` (variant pools / feature axes),
 * tag tokens are passed through, and text tokens are normalized in place.
 *
 * The returned stream still contains literal `\n\n` markers inside text
 * values — paragraph splitting is the caller's job (see `splitIntoParagraphs`).
 */
function resolveTokens(
  fragment: NarrativeFragment,
  ctx: RenderContext,
): ParagraphToken[] {
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
  return out;
}

/**
 * Walk a resolved token stream and split into paragraph buckets at every
 * `\n\n` (double-newline) boundary inside a text token.
 *
 * Splitting happens BEFORE `mergeAdjacentText` so the boundary markers are
 * still present in their original positions. A text token whose value
 * contains `\n\n` is sliced — the prefix flushes the current paragraph,
 * the suffix opens the next one. Tag tokens always belong to whichever
 * paragraph is open at their stream position; this naturally distributes
 * them to the leading or trailing side of any nearby `\n\n`.
 *
 * Empty paragraphs (a leading or trailing `\n\n`, or `\n\n\n`) are dropped
 * so callers see only meaningful content.
 */
function splitIntoParagraphs(tokens: readonly ParagraphToken[]): ParagraphToken[][] {
  const buckets: ParagraphToken[][] = [];
  let current: ParagraphToken[] = [];

  for (const tok of tokens) {
    if (tok.kind !== 'text' || !tok.value.includes('\n\n')) {
      current.push(tok);
      continue;
    }

    // Slice the text token at every `\n\n` boundary, flushing between slices.
    const parts = tok.value.split(/\n\n+/);
    for (let i = 0; i < parts.length; i += 1) {
      const piece = parts[i];
      if (piece.length > 0) current.push({ kind: 'text', value: piece });
      // Flush after every part EXCEPT the last — the last piece keeps the
      // current paragraph open so trailing tokens (tag, text) can attach.
      if (i < parts.length - 1) {
        if (current.length > 0) buckets.push(current);
        current = [];
      }
    }
  }

  if (current.length > 0) buckets.push(current);
  return buckets;
}

/**
 * Trim leading whitespace from the first text token and trailing whitespace
 * from the last text token of a paragraph. Splitting at `\n\n` commonly
 * leaves boundary text like `"...결이 갈려요."` (clean) on one side and
 * `" 인성의 흐름이..."` (leading space) on the other — without trimming,
 * `plainText` would surface that leading space.
 *
 * Whitespace-only paragraphs (every text token empty after trim, no tags)
 * collapse to an empty token list and are filtered by the caller.
 */
function trimParagraphEdges(tokens: readonly ParagraphToken[]): ParagraphToken[] {
  if (tokens.length === 0) return [];
  const trimmed = tokens.map((token) => ({ ...token }));

  // First text token: trim leading whitespace.
  const firstTextIdx = trimmed.findIndex((t) => t.kind === 'text');
  if (firstTextIdx >= 0) {
    const t = trimmed[firstTextIdx] as { kind: 'text'; value: string };
    t.value = t.value.replace(/^\s+/u, '');
  }
  // Last text token: trim trailing whitespace.
  for (let i = trimmed.length - 1; i >= 0; i -= 1) {
    if (trimmed[i].kind === 'text') {
      const t = trimmed[i] as { kind: 'text'; value: string };
      t.value = t.value.replace(/\s+$/u, '');
      break;
    }
  }
  // Drop fully-empty text tokens so they do not survive merging.
  return trimmed.filter((token) => token.kind !== 'text' || token.value.length > 0);
}

/**
 * Render a fragment's templateTokens into one OR MORE TaggedParagraphs.
 *
 * Source `data/narrative/**` fragments use literal `\n\n` inside text token
 * values to mark paragraph boundaries (≈95% of expert fragments, ≈17% of
 * standard fragments, 0% of brief fragments per Phase 7 enrichment).
 * Splitting at those markers gives expert cells the 4–8 paragraph shape
 * recommended by the style guide §2-3 instead of a single concatenated blob.
 *
 * Brief fragments contain no `\n\n`, so they always return a single paragraph.
 */
export function renderFragmentParagraphs(
  fragment: NarrativeFragment,
  ctx: RenderContext,
): TaggedParagraph[] {
  const resolved = resolveTokens(fragment, ctx);
  const buckets = splitIntoParagraphs(resolved);
  const paragraphs: TaggedParagraph[] = [];

  for (const bucket of buckets) {
    const trimmed = trimParagraphEdges(bucket);
    if (trimmed.length === 0) continue;
    const merged = normalizeParticlesAfterTags(mergeAdjacentText(trimmed)).map((token) =>
      token.kind === 'text'
        ? { ...token, value: normalizeRenderedText(token.value) }
        : token);
    if (merged.length === 0) continue;
    paragraphs.push({ tokens: merged, plainText: plainTextFromTokens(merged) });
  }

  return paragraphs;
}

/**
 * Render a fragment's templateTokens into a TaggedParagraph.
 *
 * Backwards-compatible single-paragraph view of `renderFragmentParagraphs`.
 * If splitting yields multiple paragraphs (expert/standard fragments with
 * `\n\n` markers), they are concatenated with a single space separator so
 * the legacy callers (build-tiered-matrix's `deriveBrief`, verify-render
 * artifacts, baseline-snapshot tools) keep their existing single-paragraph
 * contract. The `plainText` is the concatenation of the per-paragraph
 * plain texts; the token list is the flat concatenation with a space
 * insertion between paragraphs to avoid word collisions.
 */
export function renderFragment(
  fragment: NarrativeFragment,
  ctx: RenderContext,
): TaggedParagraph {
  const paragraphs = renderFragmentParagraphs(fragment, ctx);
  if (paragraphs.length === 0) return { tokens: [], plainText: '' };
  if (paragraphs.length === 1) return paragraphs[0];

  const tokens: ParagraphToken[] = [];
  for (let i = 0; i < paragraphs.length; i += 1) {
    if (i > 0) tokens.push({ kind: 'text', value: ' ' });
    for (const tok of paragraphs[i].tokens) tokens.push(tok);
  }
  const merged = mergeAdjacentText(tokens);
  return { tokens: merged, plainText: plainTextFromTokens(merged) };
}
