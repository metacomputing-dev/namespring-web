/**
 * part4-gyeokguk.ts -- 격국·용신 체계 섹션 (PART 4)
 *
 * 격국 판정 + 용신/희신/기신/구신/한신 체계 + 용신 생활 매핑을 모두 포함합니다.
 *
 * 페르소나: "건축가"
 *   격국 = 인생이라는 건축물의 설계도
 *   용신 = 건물을 지탱하는 대들보(핵심 기둥)
 *   희신 = 기둥을 받치는 기초
 *   기신 = 구조적 약점·균열
 *   구신 = 약점을 확대하는 습기
 *   한신 = 중립적 외벽 마감재
 *
 * 건축 용어를 자연스럽게 섞어 체계적이고 논리적인 전개를 유지합니다.
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportHighlight,
  ElementCode,
} from '../types.js';

import {
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_COLOR,
  ELEMENT_COLOR_DETAIL,
  ELEMENT_DIRECTION,
  ELEMENT_NUMBER,
  ELEMENT_TASTE,
  ELEMENT_SEASON,
  ELEMENT_TIME,
  ELEMENT_ORGAN,
  ELEMENT_FOOD,
  ELEMENT_HOBBY,
  ELEMENT_GENERATES,
  ELEMENT_GENERATED_BY,
  ELEMENT_CONTROLS,
  ELEMENT_CONTROLLED_BY,
  ELEMENT_NATURE,
  elementCodeToKorean,
} from '../common/elementMaps.js';

import {
  createRng,
  pickAndFill,
  fillTemplate,
  narrative,
  positive,
  caution,
  tip,
  emphasis,
  encouraging,
  joinSentences,
  eunNeun,
  iGa,
  eulReul,
  euroRo,
  listJoin,
} from '../common/sentenceUtils.js';
import { findGyeokgukEntry } from '../knowledge/gyeokgukEncyclopedia.js';

import type { SeededRandom } from '../common/sentenceUtils.js';

// ---------------------------------------------------------------------------
//  유틸리티
// ---------------------------------------------------------------------------

function safeName(input: ReportInput): string {
  return input.name?.trim() || '회원';
}

function elFull(c: string | null | undefined): string {
  return c ? (ELEMENT_KOREAN[c as ElementCode] ?? c) : '?';
}

function elShort(c: string | null | undefined): string {
  return c ? (ELEMENT_KOREAN_SHORT[c as ElementCode] ?? c) : '?';
}

// ---------------------------------------------------------------------------
//  오행 → 건축 비유 매핑
// ---------------------------------------------------------------------------

const ELEMENT_ARCHITECTURE: Record<ElementCode, string> = {
  WOOD: '하늘을 향해 뻗어가는 나무 기둥의 건축물',
  FIRE: '붉은 벽돌과 첨탑이 인상적인 성당 같은 건축물',
  EARTH: '너른 기초 위에 묵직하게 자리 잡은 석조 건축물',
  METAL: '유리와 강철로 빛나는 현대적 건축물',
  WATER: '유려한 곡선이 흐르는 물결 같은 건축물',
};

const ELEMENT_PILLAR_METAPHOR: Record<ElementCode, string> = {
  WOOD: '곧게 뻗은 편백나무 대들보',
  FIRE: '뜨거운 열정으로 단련된 강철 기둥',
  EARTH: '대지를 단단히 다진 화강암 초석',
  METAL: '빛나는 티타늄 골조',
  WATER: '깊이 박힌 해저 파일 기초',
};

const ELEMENT_WEAKNESS_METAPHOR: Record<ElementCode, string> = {
  WOOD: '뿌리가 흔들리는 지반 침하',
  FIRE: '과열로 인한 구조 피로',
  EARTH: '토양 유실에 의한 기초 약화',
  METAL: '부식이 진행되는 철근',
  WATER: '누수가 스며드는 콘크리트 균열',
};

// ---------------------------------------------------------------------------
//  격국 카테고리 → 건축 양식 매핑
// ---------------------------------------------------------------------------

const CATEGORY_ARCHITECTURE: Record<string, string> = {
  '정격': '전통 한옥처럼 격식과 균형을 갖춘',
  '편격': '모더니즘 건축처럼 파격적이면서도 기능적인',
  '종격': '자연지형에 순응하는 유기적 건축 같은',
  '외격': '세상 어디에도 없는 독창적 설계의',
  '잡격': '여러 양식이 조화롭게 섞인 퓨전 건축 같은',
};

// ---------------------------------------------------------------------------
//  문장 템플릿 — 건축가 페르소나
// ---------------------------------------------------------------------------

const INTRO_TEMPLATES: readonly string[] = [
  '격국(格局)은 인생이라는 건축물의 설계도와도 같아요. 어떤 양식의 건물인지 알아야 올바른 기둥을 세울 수 있는 것처럼, 격국을 알면 나에게 가장 필요한 기운(용신)을 찾을 수 있는 법이지요.',
  '모든 위대한 건축물에는 설계도가 있듯, 사주에도 그 구조를 규정하는 "격국"이 있어요. 격국은 인생이라는 건축물의 설계도이고, 용신은 그 건물을 지탱하는 대들보에 비유할 수 있어요.',
  '건축의 시작이 설계에 있듯, 사주 해석의 시작은 격국 판정에 있거든요. 월주(월지 본기 십성)를 살펴 사주의 기본 골격을 파악하면, 어떤 기둥이 필요한지 자연스레 드러나는 법이지요.',
  '한 채의 건물이 기초·기둥·벽체·지붕으로 이루어지듯, 사주도 격국이라는 구조적 틀 안에서 읽어야 해요. 격국 분석은 사주 건축학의 첫걸음인 셈이에요.',
  '어떤 집이든 먼저 "어떤 양식으로 지을 것인가"를 정하잖아요. 사주에서 그 양식을 정하는 것이 바로 격국이에요. 격국이라는 설계도 위에 용신이라는 핵심 기둥을 세울 때, 인생의 건축물이 비로소 완성되는 거라 할 수 있겠죠.',
  '건축가가 가장 먼저 하는 일은 부지의 성격을 파악하는 것이에요. 사주명리에서는 이것을 "격국 판정"이라 불러요. 격국이 곧 인생 건축의 부지 분석인 셈이에요.',
];

const GYEOKGUK_DETAIL_TEMPLATES: readonly string[] = [
  '{{이름}}님의 격국은 "{{격국}}"이에요. 이것은 {{양식}} 설계도라 할 수 있어요. {{설명}}',
  '분석 결과, {{이름}}님의 사주 구조는 {{격국}}으로 판정되었어요. 마치 {{양식}} 건축물처럼, {{설명}}',
  '{{이름}}님의 인생 건축물은 "{{격국}}"이라는 설계도 위에 세워져 있어요. {{양식}} 구조이니, {{설명}}',
  '견고한 토대 위에 세워진 {{이름}}님의 사주는 "{{격국}}" 유형이에요. {{양식}} 골격을 가지고 있으며, {{설명}}',
  '{{이름}}님의 사주를 건축물에 비유하면, {{격국}}이라는 아름다운 설계도를 가진 {{양식}} 양식이에요. {{설명}}',
];

const GYEOKGUK_CONFIDENCE_HIGH: readonly string[] = [
  '이 격국의 구조적 완성도가 높아요. 마치 건축 감리를 통과한 든든한 설계처럼 명확하게 판정되었거든요.',
  '격국의 명확도가 높은 편이에요. 설계도면이 선명하다는 것은 인생의 방향성도 뚜렷하다는 뜻이에요.',
  '균형 잡힌 설계의 아름다움이 돋보이는 격국이에요. 구조가 온전하고 명확하게 잡혀 있어요.',
];

const GYEOKGUK_CONFIDENCE_LOW: readonly string[] = [
  '격국의 구조가 다소 유동적이에요. 마치 리모델링 가능성이 열린 건물처럼, 대운의 흐름에 따라 변화할 여지가 있거든요.',
  '설계도가 여러 양식을 품고 있어서, 한 가지로 딱 잘라 말하기 어려운 면이 있어요. 그만큼 다양한 가능성이 열려 있다고도 볼 수 있겠죠.',
];

const YONGSHIN_TEMPLATES: readonly string[] = [
  '이제 이 건축물의 핵심 기둥, 용신(用神)을 살펴볼게요. {{이름}}님의 용신은 {{용신}}이에요! 이 기둥이 튼튼할 때 인생의 건물도 흔들림 없이 서 있을 수 있거든요.',
  '{{이름}}님의 인생 건축물에서 대들보 역할을 하는 용신은 {{용신}}이에요. 이 기운이 채워질 때 건물 전체가 안정되는 것과 같은 이치예요.',
  '건축물의 핵심 골조가 기둥이듯, {{이름}}님 사주의 핵심 골조는 {{용신}}이에요. 이 오행의 기운을 보강하는 것이 인생 설계의 가장 중요한 포인트라 할 수 있겠죠.',
  '모든 건물에는 빠져서는 안 되는 핵심 기둥이 있어요. {{이름}}님의 사주에서 그 기둥은 바로 {{용신}}이에요. 이 기운이 충만할 때 운세가 상승하는 법이지요.',
  '견고한 건축물의 비밀은 튼튼한 기둥에 있듯, {{이름}}님의 운명에서 가장 필요한 기둥은 {{용신}}이에요. 이 {{짧은용신}} 기운을 생활 속에서 채워가면 좋겠어요.',
];

const HEESHIN_TEMPLATES: readonly string[] = [
  '희신(喜神)은 기둥을 받치는 기초에 해당해요. {{이름}}님의 희신 {{희신}}은(는) 용신 {{용신}}을(를) 생(生)해 주는 오행이니, 기초가 튼튼해야 기둥도 든든한 것과 같습니다.',
  '건물의 기초가 기둥을 떠받치듯, 희신 {{희신}}은(는) 용신 {{용신}}의 든든한 토대 역할을 해요. 이 두 오행이 함께 채워질 때 구조가 가장 안정적이에요.',
  '용신이 대들보라면, 희신 {{희신}}은(는) 그 대들보를 받치는 주춧돌인 셈이에요. {{희신}}의 기운도 함께 보강하면 금상첨화거든요.',
];

const GISHIN_TEMPLATES: readonly string[] = [
  '반면, 기신(忌神) {{기신}}은(는) 이 건축물의 구조적 약점에 해당해요. {{비유}}처럼, 이 기운이 강해지면 건물에 금이 갈 수 있으니 주의가 필요해요.',
  '기신 {{기신}}은(는) 건물의 균열과도 같아요. {{비유}}를 떠올려 보세요. 이 기운이 과하면 구조가 약해질 수 있으니 피하는 것이 좋겠어요.',
  '모든 건축물에 보수가 필요한 약한 지점이 있듯, {{이름}}님 사주에서는 {{기신}} 기운이 그 약점이에요. {{비유}}에 비유할 수 있으니, 이 방면을 조심하는 것이 현명하겠죠.',
];

const GUSHIN_TEMPLATES: readonly string[] = [
  '구신(仇神) {{구신}}은(는) 기신을 강화하는 오행이에요. 건물의 약점에 습기가 스며들면 손상이 가속되듯, 구신의 기운도 경계하면 좋겠어요.',
  '{{구신}} 기운은 구신에 해당하는데, 이는 균열에 비를 맞히는 것과 같아요. 기신을 더 키우는 역할이니 가급적 피하는 편이 낫겠죠.',
];

const HANSHIN_TEMPLATES: readonly string[] = [
  '한신(閑神) {{한신}}은(는) 건물의 외벽 마감재처럼 중립적인 오행이에요. 이 기운은 큰 도움도 해도 끼치지 않는, 무난한 위치에 있거든요.',
  '{{한신}} 기운은 한신에 해당해요. 건축에 비유하면 인테리어 소품 같은 존재로, 있어도 좋고 없어도 구조에는 영향이 없는 중립적 오행이에요.',
];

const SHEN_SYSTEM_OVERVIEW: readonly string[] = [
  '이렇게 다섯 가지 신(神)이 사주 건축의 역할 분담을 이루고 있어요. 용신과 희신은 뼈대, 한신은 외장재, 기신과 구신은 보수 대상이라 생각하면 쉽겠죠.',
  '인생 건축물의 구조를 한눈에 정리하면 이래요. 용신·희신이 건물의 골조와 기초, 한신이 벽체, 기신·구신이 주의할 균열 포인트인 셈이에요.',
  '사주 건축의 다섯 기둥이 모두 드러났어요. 이 구조의 핵심 골격은 용신과 희신에 있고, 기신과 구신은 보강이 필요한 약한 지점이에요.',
];

const LIFE_GUIDE_INTRO_TEMPLATES: readonly string[] = [
  '이제 용신 {{용신}}의 기운을 일상에서 어떻게 보강할 수 있는지, 건축 자재를 고르듯 하나하나 살펴볼게요!',
  '건축가가 자재를 신중히 고르듯, {{이름}}님도 용신 {{용신}}에 맞는 생활 요소를 골라 활용하면 큰 도움이 돼요.',
  '튼튼한 건물을 짓기 위해 좋은 자재가 필요하듯, 용신 {{용신}}을 보강할 생활 속 자재들을 알려드릴게요.',
  '설계도가 완성되었으니, 이제 어떤 자재로 건물을 채울지 구체적으로 안내해 드릴게요. 용신 {{용신}}에 맞는 생활 가이드예요!',
];

const LIFE_GUIDE_COLOR_TEMPLATES: readonly string[] = [
  '색상은 건물의 외관을 결정하는 페인트와도 같아요. {{색상}} 계열을 생활 곳곳에 활용해 보세요. {{상세색상}} 같은 색조가 특히 좋아요.',
  '인테리어의 첫걸음은 색상 선택이지요. {{이름}}님에게는 {{색상}} 계열이 행운의 컬러예요. {{상세색상}} 등을 활용해 보시길 추천해요.',
];

const LIFE_GUIDE_DIRECTION_TEMPLATES: readonly string[] = [
  '건물의 향이 중요하듯, {{이름}}님에게 유리한 방위는 {{방위}}이에요. 책상이나 침대 머리를 이 방향으로 놓으면 좋은 기운이 들어오는 법이지요.',
  '{{방위}} 방향은 {{이름}}님 인생 건축의 정문과도 같아요. 중요한 결정을 할 때 이 방위를 의식해 보세요.',
];

const LIFE_GUIDE_FOOD_TEMPLATES: readonly string[] = [
  '건축 자재 중 가장 기본이 되는 것은 영양분이에요. {{음식}} 같은 음식이 {{이름}}님의 용신 기운을 채워주는 보강재 역할을 한답니다.',
  '몸이라는 건축물을 튼튼히 하려면, {{음식}} 같은 음식을 즐겨 드시면 좋아요. {{맛}} 계열의 음식이 특히 궁합이 좋거든요.',
];

const LIFE_GUIDE_HOBBY_TEMPLATES: readonly string[] = [
  '건물에도 정원이 필요하듯, 마음의 여유를 채워줄 취미도 중요해요. {{취미}} 같은 활동이 용신 기운을 충전하는 힐링 공간이 되어줄 거예요.',
  '건축물 옆 쉼터처럼, {{취미}} 같은 취미 활동이 {{이름}}님의 에너지를 재충전해 줄 거예요.',
];

const AVOID_GUIDE_TEMPLATES: readonly string[] = [
  '반대로, 기신 {{기신}}에 해당하는 {{피할색상}} 계열 색상이나 {{피할방위}} 방향은 건물의 약한 벽면 같은 것이니 가급적 피하시는 게 좋겠어요.',
  '기신 {{기신}}의 영향을 줄이려면 {{피할색상}} 색상과 {{피할방위}} 방향을 조심하세요. 구조적 약점을 자극하는 것은 건축의 금기와도 같거든요.',
  '건물의 균열 부위에 하중을 더하면 안 되듯, 기신 {{기신}}에 해당하는 {{피할색상}} 톤이나 {{피할방위}} 방위는 가급적 멀리하시는 편이 현명해요.',
];

const CLOSING_TEMPLATES: readonly string[] = [
  '격국이라는 설계도와 용신이라는 핵심 기둥을 알았으니, 이제 인생의 건축물을 더 견고하게 세워갈 수 있어요. 이 정보를 생활 곳곳에 녹여보세요!',
  '좋은 건축물은 좋은 설계와 적절한 자재에서 시작되는 법이지요. 격국·용신 분석이 {{이름}}님 인생 건축의 나침반이 되길 바랍니다.',
  '모든 건축에는 주기적인 점검이 필요하듯, 대운·세운이 바뀔 때마다 이 용신 가이드를 다시 점검해 보세요. 운세의 건축 감리와도 같답니다.',
  '이로써 인생 건축의 설계도(격국)와 핵심 기둥(용신) 분석이 마무리되었어요. 이 구조 위에 대운·세운이라는 증축 계획이 이어진답니다.',
  '견고한 기초 위에 세워진 건물이 오래가듯, 용신의 기운을 꾸준히 보강하면 인생의 건축물도 더욱 튼튼해질 거예요.',
];

// ---------------------------------------------------------------------------
//  5신 체계 산출 유틸리티
// ---------------------------------------------------------------------------

interface ShenSystem {
  readonly yongshin: ElementCode;
  readonly heeshin: ElementCode;
  readonly gishin: ElementCode;
  readonly gushin: ElementCode;
  readonly hanshin: ElementCode;
}

/**
 * 용신·희신·기신·구신·한신을 산출합니다.
 *
 * - 용신: yongshin.element (가장 필요한 오행)
 * - 희신: yongshin.heeshin 또는 용신을 생해주는 모(母) 오행
 * - 기신: yongshin.gishin 또는 용신을 극하는 오행
 * - 구신: 기신을 생해주는 모(母) 오행
 * - 한신: 나머지 오행
 */
function deriveShenSystem(input: ReportInput): ShenSystem | null {
  const { yongshin } = input.saju;
  const yongEl = yongshin?.element as ElementCode | undefined;
  if (!yongEl) return null;

  // 희신: 데이터 우선, 없으면 용신을 생해주는 오행
  const heeEl = (yongshin.heeshin as ElementCode | null) ?? ELEMENT_GENERATED_BY[yongEl];

  // 기신: 데이터 우선, 없으면 용신을 극하는 오행
  const giEl = (yongshin.gishin as ElementCode | null) ?? ELEMENT_CONTROLLED_BY[yongEl];

  // 구신: 데이터 우선, 없으면 기신을 생해주는 오행
  const guEl = (yongshin.gushin as ElementCode | null) ?? ELEMENT_GENERATED_BY[giEl];

  // 한신: 5행 중 나머지
  const ALL_ELEMENTS: ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];
  const used = new Set<ElementCode>([yongEl, heeEl, giEl, guEl]);
  const remaining = ALL_ELEMENTS.filter(e => !used.has(e));
  const hanEl = remaining.length > 0 ? remaining[0] : ELEMENT_GENERATES[yongEl];

  return {
    yongshin: yongEl,
    heeshin: heeEl,
    gishin: giEl,
    gushin: guEl,
    hanshin: hanEl,
  };
}

// ---------------------------------------------------------------------------
//  메인 생성 함수
// ---------------------------------------------------------------------------

export function generateGyeokgukSection(input: ReportInput): ReportSection | null {
  const rng = createRng(input);
  for (let i = 0; i < 22; i++) rng.next();

  const name = safeName(input);
  const { gyeokguk, yongshin } = input.saju;

  if (!gyeokguk && !yongshin) return null;

  const paragraphs: ReportParagraph[] = [];
  const shen = deriveShenSystem(input);
  const yongEl = shen?.yongshin ?? null;
  const heeEl = shen?.heeshin ?? null;
  const giEl = shen?.gishin ?? null;
  const guEl = shen?.gushin ?? null;
  const hanEl = shen?.hanshin ?? null;

  // ── 1. 도입: 건축가의 서문 ──

  paragraphs.push(narrative(rng.pick(INTRO_TEMPLATES)));

  // ── 2. 격국 판정 ──

  if (gyeokguk) {
    const category = gyeokguk.category ?? '';
    const bestGyeokguk = gyeokguk.type?.trim() || '';
    const encyclopediaEntry = bestGyeokguk ? findGyeokgukEntry(bestGyeokguk) : null;
    const architectureStyle = CATEGORY_ARCHITECTURE[category] ?? '독자적인 양식의';

    const gyeokText = pickAndFill(rng, GYEOKGUK_DETAIL_TEMPLATES, {
      이름: name,
      격국: gyeokguk.type ?? '미정',
      양식: architectureStyle,
      설명: gyeokguk.reasoning ?? `${category} 계열의 격국이에요.`,
    });
    paragraphs.push(emphasis(gyeokText));

    if (bestGyeokguk) {
      if (encyclopediaEntry) {
        const encyclopediaParagraph = joinSentences(
          `격국 강점: ${encyclopediaEntry.strengths}`,
          `주의할 점: ${encyclopediaEntry.cautions}`,
          `성장 팁: ${encyclopediaEntry.growthTip}`,
        );
        paragraphs.push(tip(encyclopediaParagraph));
      } else {
        paragraphs.push(narrative(
          '격국의 강점과 주의점은 원국과 대운 흐름에 따라 달라질 수 있어요. 현재 강점은 살리고 약점은 단계적으로 보완해 보세요.'
        ));
      }
    }

    // 격국 확신도에 따른 부연
    const confidence = gyeokguk.confidence ?? 0;
    if (confidence >= 0.7) {
      paragraphs.push(positive(rng.pick(GYEOKGUK_CONFIDENCE_HIGH)));
    } else if (confidence > 0 && confidence < 0.5) {
      paragraphs.push(narrative(rng.pick(GYEOKGUK_CONFIDENCE_LOW)));
    }
  }

  // ── 3. 용신 분석: 핵심 기둥 ──

  if (yongEl) {
    const yongText = pickAndFill(rng, YONGSHIN_TEMPLATES, {
      이름: name,
      용신: elFull(yongEl),
      짧은용신: elShort(yongEl),
    });
    paragraphs.push(positive(yongText, yongEl));

    // 용신 오행의 건축적 비유
    const archMetaphor = ELEMENT_PILLAR_METAPHOR[yongEl];
    const natureDesc = ELEMENT_NATURE[yongEl];
    if (archMetaphor && natureDesc) {
      paragraphs.push(narrative(
        `${elFull(yongEl)}은(는) ${natureDesc} ${archMetaphor}에 비유할 수 있어요. ` +
        `이 기둥이 든든할수록 ${name}님의 인생 건축물은 더욱 안정적이에요.`
      ));
    }
  }

  // ── 4. 희신 (기초) ──

  if (yongEl && heeEl) {
    const heeText = pickAndFill(rng, HEESHIN_TEMPLATES, {
      이름: name,
      희신: elFull(heeEl),
      용신: elFull(yongEl),
    });
    paragraphs.push(positive(heeText, heeEl));
  }

  // ── 5. 기신 (구조적 약점) ──

  if (yongEl && giEl) {
    const weaknessMetaphor = ELEMENT_WEAKNESS_METAPHOR[giEl];
    const giText = pickAndFill(rng, GISHIN_TEMPLATES, {
      이름: name,
      기신: elFull(giEl),
      비유: weaknessMetaphor,
    });
    paragraphs.push(caution(giText));
  }

  // ── 6. 구신 (습기) ──

  if (guEl) {
    paragraphs.push(narrative(pickAndFill(rng, GUSHIN_TEMPLATES, {
      구신: elFull(guEl),
    })));
  }

  // ── 7. 한신 (외벽 마감재) ──

  if (hanEl) {
    paragraphs.push(narrative(pickAndFill(rng, HANSHIN_TEMPLATES, {
      한신: elFull(hanEl),
    })));
  }

  // ── 8. 5신 체계 종합 ──

  if (shen) {
    paragraphs.push(encouraging(rng.pick(SHEN_SYSTEM_OVERVIEW)));
  }

  // ── 9. 용신 생활 가이드: 건축 자재 ──

  if (yongEl) {
    // 가이드 도입
    paragraphs.push(tip(pickAndFill(rng, LIFE_GUIDE_INTRO_TEMPLATES, {
      이름: name,
      용신: elShort(yongEl),
    }), yongEl));

    // 색상 가이드
    const colorDetails = ELEMENT_COLOR_DETAIL[yongEl] ?? [];
    const colorDetailStr = colorDetails.length > 0 ? listJoin(colorDetails.slice(0, 3)) : ELEMENT_COLOR[yongEl] ?? '';
    paragraphs.push(tip(pickAndFill(rng, LIFE_GUIDE_COLOR_TEMPLATES, {
      이름: name,
      색상: ELEMENT_COLOR[yongEl] ?? '',
      상세색상: colorDetailStr,
    }), yongEl));

    // 방위 가이드
    paragraphs.push(tip(pickAndFill(rng, LIFE_GUIDE_DIRECTION_TEMPLATES, {
      이름: name,
      방위: ELEMENT_DIRECTION[yongEl] ?? '',
    }), yongEl));

    // 음식 가이드
    const foods = ELEMENT_FOOD[yongEl] ?? [];
    const selectedFoods = rng.sample(foods, 4);
    paragraphs.push(tip(pickAndFill(rng, LIFE_GUIDE_FOOD_TEMPLATES, {
      이름: name,
      음식: listJoin(selectedFoods),
      맛: ELEMENT_TASTE[yongEl] ?? '',
    }), yongEl));

    // 취미 가이드
    const hobbies = ELEMENT_HOBBY[yongEl] ?? [];
    const selectedHobbies = rng.sample(hobbies, 3);
    paragraphs.push(tip(pickAndFill(rng, LIFE_GUIDE_HOBBY_TEMPLATES, {
      이름: name,
      취미: listJoin(selectedHobbies),
    }), yongEl));

    // 기신 피하기 가이드
    if (giEl) {
      paragraphs.push(caution(pickAndFill(rng, AVOID_GUIDE_TEMPLATES, {
        기신: elShort(giEl),
        피할색상: ELEMENT_COLOR[giEl] ?? '',
        피할방위: ELEMENT_DIRECTION[giEl] ?? '',
      })));
    }
  }

  // ── 10. 마무리 ──

  paragraphs.push(encouraging(pickAndFill(rng, CLOSING_TEMPLATES, { 이름: name })));

  // =====================================================================
  //  테이블 1: 용신 체계표
  // =====================================================================

  const tables: ReportTable[] = [];
  if (shen) {
    tables.push({
      title: '용신 체계표',
      headers: ['구분', '오행', '건축 비유', '역할'],
      rows: [
        ['용신(用神)', elFull(shen.yongshin), '핵심 대들보', '가장 필요한 오행 — 건물의 핵심 기둥'],
        ['희신(喜神)', elFull(shen.heeshin), '기초·주춧돌', '용신을 생(生)해주는 오행 — 기둥의 토대'],
        ['한신(閑神)', elFull(shen.hanshin), '외벽 마감재', '무해무익한 중립 오행 — 장식적 외장재'],
        ['구신(仇神)', elFull(shen.gushin), '습기·하중', '기신을 강화하는 오행 — 약점 확대 요인'],
        ['기신(忌神)', elFull(shen.gishin), '균열·약점', '가장 해로운 오행 — 구조적 취약부'],
      ],
    });
  }

  // =====================================================================
  //  테이블 2: 용신 생활 가이드 (9개 카테고리)
  // =====================================================================

  if (yongEl) {
    const foods = ELEMENT_FOOD[yongEl] ?? [];
    const hobbies = ELEMENT_HOBBY[yongEl] ?? [];
    const nums = ELEMENT_NUMBER[yongEl] ?? [];

    const guideRows: string[][] = [
      ['색상', ELEMENT_COLOR[yongEl] ?? '', giEl ? `피할 색상: ${ELEMENT_COLOR[giEl] ?? ''}` : ''],
      ['방위', ELEMENT_DIRECTION[yongEl] ?? '', giEl ? `피할 방위: ${ELEMENT_DIRECTION[giEl] ?? ''}` : ''],
      ['숫자', nums.join(', '), giEl ? `피할 숫자: ${(ELEMENT_NUMBER[giEl] ?? []).join(', ')}` : ''],
      ['맛', ELEMENT_TASTE[yongEl] ?? '', giEl ? `피할 맛: ${ELEMENT_TASTE[giEl] ?? ''}` : ''],
      ['계절', ELEMENT_SEASON[yongEl] ?? '', giEl ? `주의 계절: ${ELEMENT_SEASON[giEl] ?? ''}` : ''],
      ['시간대', ELEMENT_TIME[yongEl] ?? '', giEl ? `주의 시간: ${ELEMENT_TIME[giEl] ?? ''}` : ''],
      ['건강 관리', ELEMENT_ORGAN[yongEl]?.detail ?? '', giEl ? `취약 장기: ${ELEMENT_ORGAN[giEl]?.detail ?? ''}` : ''],
      ['추천 음식', rng.sample(foods, 5).join(', '), giEl ? `주의 음식: ${rng.sample(ELEMENT_FOOD[giEl] ?? [], 3).join(', ')}` : ''],
      ['추천 취미', rng.sample(hobbies, 4).join(', '), giEl ? `주의 취미: ${rng.sample(ELEMENT_HOBBY[giEl] ?? [], 2).join(', ')}` : ''],
    ];

    tables.push({
      title: '용신 생활 가이드',
      headers: ['항목', '추천 (용신 보강)', '주의 (기신 회피)'],
      rows: guideRows,
    });
  }

  // =====================================================================
  //  하이라이트
  // =====================================================================

  const highlights: ReportHighlight[] = [];
  if (gyeokguk) {
    highlights.push({
      label: '격국',
      value: gyeokguk.type ?? '미정',
      sentiment: 'neutral',
    });
  }
  if (shen) {
    highlights.push({
      label: '용신',
      value: `${elFull(shen.yongshin)} (핵심 기둥)`,
      element: shen.yongshin,
      sentiment: 'good',
    });
    highlights.push({
      label: '희신',
      value: `${elFull(shen.heeshin)} (기초)`,
      element: shen.heeshin,
      sentiment: 'good',
    });
    highlights.push({
      label: '기신',
      value: `${elFull(shen.gishin)} (약점)`,
      element: shen.gishin,
      sentiment: 'caution',
    });
  }

  return {
    id: 'gyeokguk',
    title: '격국(格局)·용신(用神) 체계',
    subtitle: '인생 건축물의 설계도와 핵심 기둥',
    paragraphs,
    tables: tables.length > 0 ? tables : undefined,
    highlights: highlights.length > 0 ? highlights : undefined,
  };
}
