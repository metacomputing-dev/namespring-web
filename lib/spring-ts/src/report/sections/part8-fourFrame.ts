/**
 * part8-fourFrame.ts -- 수리 사격(四格) 분석 섹션
 *
 * PART 8-2: 성명학의 원격·형격·이격·정격 수리값과 81수리 길흉을 분석합니다.
 *
 * 페르소나: 체스 전략가 / 보드게임 해설자
 * - 원격=오프닝, 형격=미들게임, 이격=엔드게임, 정격=최종 승리 조건
 * - 전략 비유: 포석, 수읽기, 포지션, 게임 플랜, 승기, 방어, 공격
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
  SURI_81_LUCK,
  SURI_LUCK_KOREAN,
  suriToElement,
  getElementRelation,
  type SuriLuck,
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
} from '../common/sentenceUtils.js';

// ─────────────────────────────────────────────────────────────────────────────
//  상수 정의
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

/** 격 이름 한국어 매핑 */
const FRAME_KOREAN: Record<string, string> = {
  won: '원격(元格)',
  hyung: '형격(亨格)',
  lee: '이격(利格)',
  jung: '정격(貞格)',
};

/** 격 의미(운세 시기) 매핑 */
const FRAME_MEANING: Record<string, string> = {
  won: '초년운 (이름 총획)',
  hyung: '청년운 (성 + 이름1)',
  lee: '중년운 (성 + 이름2)',
  jung: '말년운·총운 (총획)',
};

/** 격별 체스 전략 비유 */
const FRAME_CHESS_METAPHOR: Record<string, string> = {
  won: '오프닝(첫 수)',
  hyung: '미들게임(공격 포지션)',
  lee: '엔드게임(방어 포지션)',
  jung: '체크메이트(최종 승리 조건)',
};

// ─────────────────────────────────────────────────────────────────────────────
//  다양성 문장 풀
// ─────────────────────────────────────────────────────────────────────────────

const INTRO_TEMPLATES: readonly string[] = [
  '수리 사격(四格) 분석은 이름의 획수를 4가지 전략적 포지션으로 나눠 읽는 게임이에요. 마치 체스의 오프닝부터 체크메이트까지의 전략을 짜는 것과 같죠!',
  '이름의 획수를 원격·형격·이격·정격, 네 가지 전략 포석으로 배치해 볼게요. 보드 위의 말처럼, 각각의 위치가 인생의 승부처를 결정하거든요.',
  '성명학의 수리 분석은 인생이라는 보드게임의 전략 설계도예요. 4개의 격이 바로 오프닝부터 엔드게임까지의 게임 플랜이라고 볼 수 있죠!',
  '81수리 길흉 테이블은 체스의 오프닝 이론서와 같아요. 이미 검증된 수천 가지 포석 중에서, 이름의 획수가 어떤 전략을 품고 있는지 분석해 볼게요!',
  '체스에서 좋은 오프닝이 승리의 반이듯, 이름의 수리 배치도 인생 게임의 포석이에요. 원격·형격·이격·정격, 네 가지 전략적 수읽기를 시작합니다!',
  '이름의 획수에는 전략이 숨어 있어요. 마치 체스 그랜드마스터가 말의 배치를 읽듯, 4격의 수리 포지션을 하나씩 분석해 나가 볼게요.',
];

/** 격별 개별 분석 도입 문장 — won */
const WON_TEMPLATES: readonly string[] = [
  '원격은 게임의 오프닝이에요. 첫 수를 어떻게 두느냐가 전체 흐름을 좌우하는 법이죠.',
  '원격은 초년운, 즉 인생 게임의 첫 포석이에요. 첫 수가 좋으면 이후 전개가 한결 수월해지거든요.',
  '체스에서 오프닝이 탄탄해야 미들게임이 편안하듯, 원격은 인생의 시작 포지션을 결정하는 셈입니다.',
  '보드게임의 시작 턴처럼, 원격은 초년기의 흐름을 보여주는 첫 번째 전략 포인트예요.',
];

/** 격별 개별 분석 도입 문장 — hyung */
const HYUNG_TEMPLATES: readonly string[] = [
  '형격은 미들게임, 즉 공격 포지션이에요. 청년기에 얼마나 공격적으로 나아갈 수 있는지를 보여주죠.',
  '형격은 게임의 미들게임이에요. 말의 위치가 잡힌 뒤, 본격적인 승부수를 던지는 시기라고 볼 수 있죠.',
  '청년운인 형격은 보드 위에서 공격 진형을 갖추는 단계예요. 여기서 좋은 수가 나오면 승기가 보이는 법이에요.',
  '미들게임의 핵심은 적극적 전략이에요. 형격은 바로 그 공격의 기세를 품고 있는 격이거든요.',
];

/** 격별 개별 분석 도입 문장 — lee */
const LEE_TEMPLATES: readonly string[] = [
  '이격은 엔드게임, 방어 포지션이에요. 중년기에 얼마나 단단하게 지킬 수 있는지가 관건이죠.',
  '이격은 게임의 엔드게임이에요. 쌓아온 것을 지키면서 마무리 포석을 깔아야 하는 시기라고 볼 수 있죠.',
  '엔드게임에서는 방어가 곧 공격이에요. 이격은 중년의 안정과 수성의 전략을 보여주는 격이에요.',
  '중년운인 이격은 보드 위의 방어 라인이에요. 탄탄한 수비가 최종 승리로 이끄는 법이거든요.',
];

/** 격별 개별 분석 도입 문장 — jung */
const JUNG_TEMPLATES: readonly string[] = [
  '정격은 체크메이트, 최종 승리 조건이에요. 말년의 총운이 어떤 결과를 내놓는지가 여기서 결정되는 셈입니다.',
  '정격은 게임의 마지막 수, 체크메이트예요! 인생 전체의 총운이자 최종 결산이라고 볼 수 있죠.',
  '모든 전략의 종착점이 체크메이트이듯, 정격은 인생 게임의 최종 승리 조건이에요. 여기가 좋으면 해피엔딩이라니 대단해요!',
  '보드게임의 최종 점수가 정격이에요. 총획으로 산출된 이 수가 인생 전체의 게임 플랜을 완성하는 거예요.',
];

const FRAME_INTRO_MAP: Record<string, readonly string[]> = {
  won: WON_TEMPLATES,
  hyung: HYUNG_TEMPLATES,
  lee: LEE_TEMPLATES,
  jung: JUNG_TEMPLATES,
};

/** 81수리 길흉별 체스 전략 해설 */
const LUCK_GREAT_TEMPLATES: readonly string[] = [
  '결정적 우세 포지션이에요! 이 수리 배치는 전략적으로 매우 유리하거든요.',
  '압도적인 전략 우위예요! 보드 위의 최고 포지션을 확보한 셈입니다.',
  '그랜드마스터급 포석이에요! 이보다 좋은 수읽기는 없는 법이죠.',
  '이건 완벽한 전략적 배치예요! 승기를 잡은 포지션이라고 볼 수 있죠.',
  '이 수리는 체스의 황금 오프닝 같아요! 탄탄한 기반 위에 승리가 보이는 포지션이에요.',
];

const LUCK_GOOD_TEMPLATES: readonly string[] = [
  '안정적인 포지션을 확보했어요. 전략적으로 나쁘지 않은 수읽기예요.',
  '무난한 전략 배치예요. 수비와 공격 모두 가능한 균형 잡힌 포지션이에요.',
  '탄탄한 중간 포지션이에요. 이 정도면 게임을 충분히 유리하게 끌고 갈 수 있는 셈입니다.',
];

const LUCK_HALF_TEMPLATES: readonly string[] = [
  '양날의 검 같은 포지션이에요. 수읽기에 따라 공격도, 방어도 가능한 셈입니다.',
  '반길반흉이라 다이나믹한 국면이에요! 플레이어의 전략에 따라 결과가 달라지는 법이죠.',
  '전세가 엎치락뒤치락하는 접전 포지션이에요. 하지만 다음 수를 잘 두면 충분히 유리해질 수 있어요.',
  '흥미진진한 중간 포지션이에요! 게임이 한쪽으로 기울지 않은 만큼, 전략적 선택이 중요하거든요.',
];

const LUCK_BAD_TEMPLATES: readonly string[] = [
  '불리한 포지션이지만, 체스에서도 역전승은 있는 법이에요! 다른 격이 보완해 줄 수 있거든요.',
  '수세에 몰린 국면이에요. 하지만 뛰어난 전략가는 역경에서 더 빛나는 법이죠!',
  '방어가 필요한 포지션이에요. 다른 격들의 지원으로 충분히 역전의 기회가 있는 셈입니다.',
  '이 포지션은 도전적이에요. 하지만 보드게임의 묘미는 불리한 상황에서의 역전이거든요!',
];

const LUCK_TEMPLATE_MAP: Record<SuriLuck, readonly string[]> = {
  GREAT: LUCK_GREAT_TEMPLATES,
  GOOD: LUCK_GOOD_TEMPLATES,
  HALF: LUCK_HALF_TEMPLATES,
  BAD: LUCK_BAD_TEMPLATES,
};

/** 상생/상극 관계를 전략 비유로 표현 */
const RELATION_STRATEGY: Record<string, readonly string[]> = {
  generates: [
    '앞 격이 뒤 격을 지원하는 상생(相生) 관계예요! 마치 체스에서 비숍이 퀸을 커버하듯, 연계 전략이 완벽하거든요.',
    '상생 흐름이에요! 전선의 앞줄이 뒷줄에 에너지를 공급하는 이상적인 진형이라고 볼 수 있죠.',
    '좋은 연계 포석이에요! 앞의 말이 뒤의 말을 살려주는 상생 전략이 작동하고 있어요.',
  ],
  generated_by: [
    '뒤 격이 앞 격에게 힘을 받는 역상생 관계예요. 후방 지원이 탄탄한 포메이션인 셈입니다.',
    '후방에서 전방을 밀어주는 형세예요! 뒤에서 오는 에너지가 앞의 포지션을 강화시키는 법이죠.',
  ],
  same: [
    '같은 오행끼리 나란히 서 있어요! 동일 전력이 뭉치면 시너지가 나는 법이죠.',
    '비화(比和) 관계예요. 같은 편 말이 나란히 서 있으니 든든한 포메이션인 셈입니다.',
  ],
  controls: [
    '앞 격이 뒤 격을 상극하는 관계예요. 전략적 긴장이 있는 포지션이지만, 이 긴장이 오히려 추진력이 되기도 해요.',
    '상극 관계로 보드 위에 긴장감이 흐르고 있어요. 하지만 체스에서도 공격적 플레이가 빛날 때가 있는 법이거든요.',
  ],
  controlled_by: [
    '뒤 격이 앞 격을 제어하는 역상극 관계예요. 방어적 전환이 필요한 국면이에요.',
    '역상극 관계로 후방에서 견제가 들어오고 있어요. 수비 전략을 점검해 보면 좋겠어요.',
  ],
};

/** 종합 상생 흐름 판정 (체스 비유) */
const FLOW_PERFECT: readonly string[] = [
  '놀라워요! 4격 전체가 상생으로 연결된 완벽한 포메이션이에요! 오프닝부터 체크메이트까지 물 흐르듯 이어지는 최고의 게임 플랜이에요.',
  '전 격이 상생 관계라니! 이건 체스의 "불멸의 게임"에 비견될 만한 완벽한 전략 배치예요!',
  '모든 격이 서로를 살려주는 전상생 포석이에요! 보드게임에서 이런 배치는 승리가 예정된 것이나 다름없는 셈입니다.',
];

const FLOW_GOOD: readonly string[] = [
  '대부분의 격이 상생 관계로 연결돼 있어요! 몇 곳에 긴장이 있지만, 전체적으로 안정적인 게임 플랜이에요.',
  '상생 흐름이 우세한 좋은 전략 배치예요. 일부 상극은 오히려 긴장감 있는 플레이를 만들어 주거든요.',
];

const FLOW_MIXED: readonly string[] = [
  '상생과 상극이 섞인 다이나믹한 전략 배치예요. 엎치락뒤치락하는 접전이지만, 그만큼 흥미진진한 게임이라고 볼 수 있죠.',
  '공격과 방어가 교차하는 복합적 포메이션이에요. 다양한 전략 옵션을 가지고 있다는 뜻이기도 해요!',
];

const FLOW_WEAK: readonly string[] = [
  '상극 관계가 많아 수비 중심의 전략이 필요한 배치예요. 하지만 보드게임에서 수비의 달인이 최종 승자가 되기도 하는 법이거든요!',
  '전략적 긴장이 높은 배치지만, 이런 도전적 포지션에서 진정한 실력이 드러나는 법이에요.',
];

/** 전체 분석 마무리 (체스 비유) */
const CLOSING_TEMPLATES: readonly string[] = [
  '수리 사격 분석은 인생 게임의 전략 지도예요. 4격이 모두 길하면 최고의 오프닝을 가진 셈이지만, 반길이 있어도 전략적 플레이로 충분히 승리할 수 있어요!',
  '체스에서 완벽한 게임은 없듯, 이름의 수리도 완벽할 필요는 없어요. 중요한 건 주어진 포지션에서 최선의 전략을 세우는 거예요.',
  '보드게임의 묘미는 주어진 조건 안에서 최적의 수를 두는 거예요. 이 수리 분석을 전략적 참고 자료로 활용해 보세요!',
  '이 전략 분석표를 이름-사주 조화 평가와 함께 보면, 더 입체적인 게임 플랜을 세울 수 있어요.',
  '오프닝부터 체크메이트까지의 전략을 살펴봤어요! 이 수리 포석을 참고해서 인생이라는 보드게임을 멋지게 플레이해 보세요.',
];

/** 전체 길흉 요약 — 전략적 총평 */
const OVERALL_ALL_GREAT: readonly string[] = [
  '4격 전부 대길이라니! 이건 체스의 퍼펙트 게임에 가까운 수리 배치예요! 모든 포지션에서 결정적 우세를 점하고 있는 셈입니다.',
  '전 격이 길한 수리라니 대단해요! 오프닝부터 체크메이트까지 빈틈없는 승리 전략을 가진 이름이에요!',
];

const OVERALL_MOSTLY_GREAT: readonly string[] = [
  '대부분의 격이 길해요! 전략적으로 매우 유리한 포지션에서 게임을 시작하는 셈입니다. 한두 곳의 반길은 게임의 스릴을 더해 주는 요소라고 볼 수 있죠.',
  '좋은 수리가 우세해요! 체스로 치면 주요 포지션을 선점한 상태이니, 게임 운영이 한결 수월할 거예요.',
];

const OVERALL_MIXED: readonly string[] = [
  '길과 흉이 섞여 있어 변화무쌍한 게임 전개가 예상돼요. 하지만 전략가는 이런 접전에서 빛나는 법이거든요!',
  '다이나믹한 수리 배치예요! 좋은 포지션과 도전적 포지션이 공존하지만, 이것이 오히려 인생 게임을 풍성하게 만들어 줄 수 있어요.',
];

const OVERALL_CHALLENGING: readonly string[] = [
  '도전적인 수리 배치지만 절대 걱정하지 마세요! 체스에서도 불리한 포지션에서 역전승을 거둔 명경기가 수없이 많거든요.',
  '수리가 다소 도전적이지만, 보드게임의 진정한 고수는 어떤 포지션에서든 최선의 수를 찾아내는 사람이에요. 다른 격과 사주 용신이 보완해 줄 수 있어요!',
];

// ─────────────────────────────────────────────────────────────────────────────
//  사격 데이터 추출
// ─────────────────────────────────────────────────────────────────────────────

interface FrameData {
  type: string;
  strokeSum: number;
  element: ElementCode;
  luck: SuriLuck;
  luckKo: string;
}

function extractFourFrames(input: ReportInput): FrameData[] | null {
  const naming = input.naming;
  if (!naming) return null;

  const analysis = naming.analysis as Record<string, unknown> | undefined;
  const fourFrame = analysis?.['fourFrame'] as Record<string, unknown> | undefined;
  const frames = fourFrame?.['frames'] as Array<Record<string, unknown>> | undefined;

  if (!frames || frames.length === 0) return null;

  return frames.map(f => {
    const strokeSum = (f['strokeSum'] as number) ?? 0;
    const suri81 = ((strokeSum - 1) % 81) + 1; // 1~81 범위
    const luck = SURI_81_LUCK[suri81] ?? 'HALF';
    const element = suriToElement(strokeSum);

    return {
      type: (f['type'] as string) ?? 'unknown',
      strokeSum,
      element,
      luck,
      luckKo: SURI_LUCK_KOREAN[luck] ?? '반길(半吉)',
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  메인 생성 함수
// ─────────────────────────────────────────────────────────────────────────────

export function generateFourFrameSection(input: ReportInput): ReportSection | null {
  const frames = extractFourFrames(input);
  if (!frames || frames.length === 0) return null;

  const rng = createRng(input);
  for (let i = 0; i < 32; i++) rng.next();

  const name = safeName(input);
  const paragraphs: ReportParagraph[] = [];
  const highlights: ReportHighlight[] = [];

  // ── 1. 도입 ──────────────────────────────────────────────────────────────

  paragraphs.push(narrative(rng.pick(INTRO_TEMPLATES)));

  // ── 2. 전체 길흉 요약 (전략적 총평) ──────────────────────────────────────

  const greatCount = frames.filter(f => f.luck === 'GREAT' || f.luck === 'GOOD').length;
  const badCount = frames.filter(f => f.luck === 'BAD').length;

  if (greatCount === frames.length) {
    paragraphs.push(positive(rng.pick(OVERALL_ALL_GREAT)));
  } else if (greatCount >= 3) {
    paragraphs.push(positive(rng.pick(OVERALL_MOSTLY_GREAT)));
  } else if (badCount >= 3) {
    paragraphs.push(encouraging(rng.pick(OVERALL_CHALLENGING)));
  } else {
    paragraphs.push(narrative(rng.pick(OVERALL_MIXED)));
  }

  // ── 3. 각 격별 상세 분석 ─────────────────────────────────────────────────

  for (const frame of frames) {
    const frameName = FRAME_KOREAN[frame.type] ?? frame.type;
    const meaning = FRAME_MEANING[frame.type] ?? '';
    const chessRole = FRAME_CHESS_METAPHOR[frame.type] ?? '';

    // 격별 체스 비유 도입
    const frameIntroPool = FRAME_INTRO_MAP[frame.type];
    const frameIntro = frameIntroPool ? rng.pick(frameIntroPool) : '';

    // 길흉 해설 (전략 비유)
    const luckPool = LUCK_TEMPLATE_MAP[frame.luck] ?? LUCK_HALF_TEMPLATES;
    const luckComment = rng.pick(luckPool);

    const detailText = `【${frameName}】 — ${chessRole} (${meaning})\n` +
      `${frameIntro} ` +
      `${frame.strokeSum}획 → 수리오행 ${elFull(frame.element)}, 81수리 판정 ${frame.luckKo}. ` +
      luckComment;

    if (frame.luck === 'GREAT' || frame.luck === 'GOOD') {
      paragraphs.push(positive(detailText, frame.element));
    } else if (frame.luck === 'BAD') {
      paragraphs.push(caution(detailText, frame.element));
    } else {
      paragraphs.push(narrative(detailText, frame.element));
    }
  }

  // ── 4. 인접 격 간 상생/상극 흐름 분석 ────────────────────────────────────

  if (frames.length >= 2) {
    let sangsaengCount = 0;
    const relationDetails: string[] = [];

    for (let i = 0; i < frames.length - 1; i++) {
      const from = frames[i];
      const to = frames[i + 1];
      const rel = getElementRelation(from.element, to.element);
      const fromName = FRAME_KOREAN[from.type] ?? from.type;
      const toName = FRAME_KOREAN[to.type] ?? to.type;
      const fromEl = elShort(from.element);
      const toEl = elShort(to.element);

      if (rel === 'generates' || rel === 'generated_by' || rel === 'same') {
        sangsaengCount++;
      }

      // 관계별 전략 비유 선택
      const relPool = RELATION_STRATEGY[rel] ?? RELATION_STRATEGY['same'];
      const relComment = rng.pick(relPool);
      relationDetails.push(
        `${fromName}(${fromEl}) → ${toName}(${toEl}): ${relComment}`,
      );
    }

    // 각 관계 상세
    for (const detail of relationDetails) {
      paragraphs.push(narrative(detail));
    }

    // 종합 흐름 판정
    const total = frames.length - 1;
    const flowScore = Math.round((sangsaengCount / total) * 15);

    let flowComment: string;
    if (sangsaengCount === total) {
      flowComment = rng.pick(FLOW_PERFECT);
    } else if (sangsaengCount >= Math.ceil(total * 0.6)) {
      flowComment = rng.pick(FLOW_GOOD);
    } else if (sangsaengCount >= 1) {
      flowComment = rng.pick(FLOW_MIXED);
    } else {
      flowComment = rng.pick(FLOW_WEAK);
    }

    paragraphs.push(emphasis(
      `4격 오행 상생 흐름: ${sangsaengCount}/${total}쌍이 우호 관계예요. (전략 흐름 점수: ${flowScore}/15점) ${flowComment}`,
    ));
  }

  // ── 5. 수리오행 구성 요약 ─────────────────────────────────────────────────

  const elementList = frames.map(f => elShort(f.element)).join(' → ');
  paragraphs.push(tip(
    `수리오행 전략 배치: ${elementList}. 이것이 ${name}님 이름의 오행 포메이션이에요!`,
  ));

  // ── 6. 마무리 ────────────────────────────────────────────────────────────

  paragraphs.push(encouraging(rng.pick(CLOSING_TEMPLATES)));

  // ── 테이블: 사격 분석표 ──────────────────────────────────────────────────

  const table: ReportTable = {
    title: '수리 사격(四格) 전략 분석표',
    headers: ['격', '전략 포지션', '의미', '획수', '수리오행', '81수리 길흉'],
    rows: frames.map(f => [
      FRAME_KOREAN[f.type] ?? f.type,
      FRAME_CHESS_METAPHOR[f.type] ?? '',
      FRAME_MEANING[f.type] ?? '',
      String(f.strokeSum),
      elFull(f.element),
      f.luckKo,
    ]),
  };

  // ── 하이라이트 ───────────────────────────────────────────────────────────

  highlights.push({
    label: '길한 격 수',
    value: `${greatCount}/${frames.length}`,
    sentiment: greatCount >= 3 ? 'good' : greatCount >= 2 ? 'neutral' : 'caution',
  });

  if (frames.length >= 2) {
    let sc = 0;
    for (let i = 0; i < frames.length - 1; i++) {
      const rel = getElementRelation(frames[i].element, frames[i + 1].element);
      if (rel === 'generates' || rel === 'generated_by' || rel === 'same') sc++;
    }
    const total = frames.length - 1;
    highlights.push({
      label: '상생 흐름',
      value: `${sc}/${total}쌍`,
      sentiment: sc === total ? 'good' : sc >= 1 ? 'neutral' : 'caution',
    });
  }

  // 전체 수리오행 구성 하이라이트
  highlights.push({
    label: '수리오행 배치',
    value: frames.map(f => elShort(f.element)).join('→'),
    sentiment: 'neutral',
  });

  return {
    id: 'fourFrame',
    title: '수리 사격(四格) 분석',
    subtitle: '이름 획수에 숨겨진 전략적 포석',
    paragraphs,
    tables: [table],
    highlights,
  };
}
