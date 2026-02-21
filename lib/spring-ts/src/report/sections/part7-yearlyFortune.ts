/**
 * part7-yearlyFortune.ts -- 세운(歲運) 분석 섹션
 *
 * PART 7-3: 세운(연운) 간지 계산, 십성, 합충형파해, 용신 부합도,
 *           신살 활성화, 최근 5년~향후 5년 간지 캘린더를 제공합니다.
 *
 * 페르소나: "역사학자"
 * - 역사적 사건, 시대의 전환점, 문명의 흥망, 역사적 인물에 비유하여
 *   세운의 기운을 설명합니다.
 * - 초등학생~중학생이 이해할 수 있는 수준으로 풀어냅니다.
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportChart,
  ReportHighlight,
  ElementCode,
  TenGodCode,
  BranchCode,
  YongshinMatchGrade,
} from '../types.js';

import {
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_HANJA,
  ELEMENT_GENERATED_BY,
  ELEMENT_GENERATES,
  ELEMENT_CONTROLS,
  ELEMENT_CONTROLLED_BY,
  STEMS,
  BRANCHES,
  STEM_BY_CODE,
  BRANCH_BY_CODE,
  GANZHI_60,
  yearToGanzhiIndex,
  getYongshinMatchGrade,
  YONGSHIN_GRADE_STARS,
  YONGSHIN_GRADE_DESC,
  TEN_GOD_BY_CODE,
  TEN_GODS,
  lookupStemInfo,
  lookupBranchInfo,
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
  type SeededRandom,
} from '../common/sentenceUtils.js';

import {
  getYearlyFortune,
  getYearlyFortuneRange,
  checkFortuneRelations,
  type YearlyFortune,
  type FortuneRelation,
  type FortuneRelationType,
} from '../common/fortuneCalculator.js';

import {
  getStemEncyclopediaEntry,
  type StemEncyclopediaEntry,
} from '../knowledge/stemEncyclopedia.js';

import {
  getBranchEncyclopediaEntry,
  type BranchEncyclopediaEntry,
} from '../knowledge/branchEncyclopedia.js';

// =============================================================================
//  헬퍼 함수
// =============================================================================

function safeName(input: ReportInput): string {
  return input.name?.trim() || '회원';
}

function elFull(c: string | null | undefined): string {
  return c ? (ELEMENT_KOREAN[c as ElementCode] ?? c) : '?';
}

function elShort(c: string | null | undefined): string {
  return c ? (ELEMENT_KOREAN_SHORT[c as ElementCode] ?? c) : '?';
}

function elHanja(c: string | null | undefined): string {
  return c ? (ELEMENT_HANJA[c as ElementCode] ?? c) : '?';
}

function pickFirstText(values: readonly string[] | undefined): string | null {
  if (!values || values.length === 0) return null;
  const first = values[0]?.trim();
  return first && first.length > 0 ? first : null;
}

function resolveStemEncyclopediaEntry(
  stemCode: string | undefined,
): StemEncyclopediaEntry | null {
  const normalized = stemCode ? STEM_BY_CODE[stemCode]?.code : undefined;
  if (!normalized) return null;
  return getStemEncyclopediaEntry(normalized) ?? null;
}

function resolveBranchEncyclopediaEntry(
  branchCode: string | undefined,
): BranchEncyclopediaEntry | null {
  const normalized = branchCode ? BRANCH_BY_CODE[branchCode]?.code : undefined;
  if (!normalized) return null;
  return getBranchEncyclopediaEntry(normalized) ?? null;
}

function buildCurrentYearEncyclopediaParagraph(fortune: YearlyFortune): string | null {
  const stemEntry = resolveStemEncyclopediaEntry(fortune.stem?.code);
  const branchEntry = resolveBranchEncyclopediaEntry(fortune.branch?.code);
  if (!stemEntry && !branchEntry) return null;

  const stemLabel = stemEntry
    ? `${stemEntry.korean}(${stemEntry.hanja})`
    : `${fortune.stem.hangul}(${fortune.stem.hanja})`;
  const branchLabel = branchEntry
    ? `${branchEntry.hangul}(${branchEntry.hanja})`
    : `${fortune.branch.hangul}(${fortune.branch.hanja})`;

  const stemKeyword = pickFirstText(stemEntry?.coreKeywords);
  const stemStrength = pickFirstText(stemEntry?.strengths);
  const caution = pickFirstText(stemEntry?.cautions) ?? pickFirstText(branchEntry?.cautions);
  const branchVibe = branchEntry?.vibe?.trim() || null;
  const branchTip = pickFirstText(branchEntry?.lifestyleTips) ?? pickFirstText(branchEntry?.relationshipTips);

  return joinSentences(
    `올해 간지의 느낌을 쉬운 말로 풀면, 천간 ${stemLabel}과 지지 ${branchLabel}의 성향이 함께 흐른다고 볼 수 있어요.`,
    stemKeyword ? `${stemLabel}의 핵심 키워드는 "${stemKeyword}"에 가까워요.` : null,
    branchVibe ? `${branchLabel}는 "${branchVibe}" 분위기를 만들어요.` : null,
    stemStrength ? `잘 살리면 ${stemStrength} 같은 장점이 살아나요.` : null,
    caution ? `다만 ${caution} 같은 부분은 미리 점검해 주세요.` : null,
    branchTip ? `실천 팁으로는 ${branchTip}부터 가볍게 시작해 보세요.` : null,
  );
}

// =============================================================================
//  십성 계산 헬퍼
// =============================================================================

/**
 * 일간 vs 대상 천간으로 십성을 산출합니다.
 *
 * 십성 판정 규칙:
 * - 같은 오행, 같은 음양 → 비견
 * - 같은 오행, 다른 음양 → 겁재
 * - 내가 생하는 오행, 같은 음양 → 식신
 * - 내가 생하는 오행, 다른 음양 → 상관
 * - 내가 극하는 오행, 같은 음양 → 편재
 * - 내가 극하는 오행, 다른 음양 → 정재
 * - 나를 극하는 오행, 같은 음양 → 편관
 * - 나를 극하는 오행, 다른 음양 → 정관
 * - 나를 생하는 오행, 같은 음양 → 편인
 * - 나를 생하는 오행, 다른 음양 → 정인
 */
function computeTenGod(dayMasterIdx: number, targetStemIdx: number): TenGodCode {
  const dm = STEMS[dayMasterIdx];
  const tg = STEMS[targetStemIdx];
  if (!dm || !tg) return 'BI_GYEON';

  const dmEl = dm.element;
  const tgEl = tg.element;
  const sameYinYang = dm.yinYang === tg.yinYang;

  // 같은 오행
  if (dmEl === tgEl) {
    return sameYinYang ? 'BI_GYEON' : 'GEOB_JAE';
  }
  // 내가 생하는 오행
  if (ELEMENT_GENERATES[dmEl] === tgEl) {
    return sameYinYang ? 'SIK_SHIN' : 'SANG_GWAN';
  }
  // 내가 극하는 오행
  if (ELEMENT_CONTROLS[dmEl] === tgEl) {
    return sameYinYang ? 'PYEON_JAE' : 'JEONG_JAE';
  }
  // 나를 극하는 오행
  if (ELEMENT_CONTROLLED_BY[dmEl] === tgEl) {
    return sameYinYang ? 'PYEON_GWAN' : 'JEONG_GWAN';
  }
  // 나를 생하는 오행
  if (ELEMENT_GENERATED_BY[dmEl] === tgEl) {
    return sameYinYang ? 'PYEON_IN' : 'JEONG_IN';
  }
  return 'BI_GYEON';
}

/** 십성 코드 → 한국어 이름 */
function tenGodKorean(code: TenGodCode): string {
  return TEN_GOD_BY_CODE[code]?.korean ?? code;
}

/** 십성 코드 → 한자 이름 */
function tenGodHanja(code: TenGodCode): string {
  return TEN_GOD_BY_CODE[code]?.hanja ?? code;
}

// =============================================================================
//  원국 지지 추출
// =============================================================================

function extractNatalBranches(input: ReportInput): BranchCode[] {
  const pillars = input.saju.pillars;
  const branches: BranchCode[] = [];
  for (const pos of ['year', 'month', 'day', 'hour'] as const) {
    const p = pillars[pos];
    if (p?.branch?.code) {
      branches.push(p.branch.code as BranchCode);
    }
  }
  return branches;
}

function extractDayMasterIndex(input: ReportInput): number {
  const dayMasterStem = input.saju.dayMaster?.stem;
  if (!dayMasterStem) return 0;
  const info = lookupStemInfo(dayMasterStem);
  return info?.index ?? 0;
}

// =============================================================================
//  한신(閑神) 추론
// =============================================================================

function deriveHansin(
  yongEl: ElementCode | null,
  heeEl: ElementCode | null,
  giEl: ElementCode | null,
  guEl: ElementCode | null,
): ElementCode | null {
  const allElements: ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];
  const assigned = new Set<ElementCode | null>([yongEl, heeEl, giEl, guEl]);
  const remaining = allElements.filter(e => !assigned.has(e));
  return remaining.length === 1 ? remaining[0] : null;
}

// =============================================================================
//  신살 활성화 체크
// =============================================================================

interface ShinsalActivation {
  readonly name: string;
  readonly active: boolean;
  readonly description: string;
}

function checkShinsalActivations(
  yearBranch: BranchCode,
  input: ReportInput,
): ShinsalActivation[] {
  const results: ShinsalActivation[] = [];
  const branchInfo = BRANCH_BY_CODE[yearBranch];
  if (!branchInfo) return results;

  const saju = input.saju as Record<string, unknown>;

  // 1. 공망 체크
  const gongmang = input.saju.gongmang;
  if (gongmang && Array.isArray(gongmang)) {
    const gongBranches = gongmang.map(g => {
      const bi = lookupBranchInfo(g);
      return bi?.code ?? g;
    });
    const isGongmang = gongBranches.includes(yearBranch);
    results.push({
      name: '공망(空亡)',
      active: isGongmang,
      description: isGongmang
        ? '세운 지지가 공망에 해당하여, 실속 없는 허세나 헛된 기대가 생길 수 있어요.'
        : '세운 지지가 공망에 해당하지 않아요.',
    });
  }

  // 2. 역마 체크 (연지 기준 역마 지지 탐색)
  // 역마: 신자진→인, 인오술→신, 해묘미→사, 사유축→해
  const yiokmaMap: Record<number, number> = {
    0: 2, 4: 2, 8: 2,   // 신자진 → 인
    2: 8, 6: 8, 10: 8,  // 인오술 → 신
    3: 5, 7: 5, 11: 5,  // 해묘미 → 사
    1: 11, 5: 11, 9: 11, // 사유축 → 해
  };
  const yearPillar = input.saju.pillars?.year;
  if (yearPillar?.branch?.code) {
    const yearNatalBranch = BRANCH_BY_CODE[yearPillar.branch.code];
    if (yearNatalBranch) {
      const yiokmaTarget = yiokmaMap[yearNatalBranch.index];
      if (yiokmaTarget !== undefined) {
        const isYiokma = branchInfo.index === yiokmaTarget;
        results.push({
          name: '역마(驛馬)',
          active: isYiokma,
          description: isYiokma
            ? '역마가 활성화되어 이동, 변화, 여행의 기운이 강해지는 해예요.'
            : '역마가 비활성 상태예요.',
        });
      }
    }
  }

  // 3. 도화 체크 (연지 기준 도화 지지)
  // 도화: 신자진→유, 인오술→묘, 해묘미→자, 사유축→오
  const dohwaMap: Record<number, number> = {
    0: 9, 4: 9, 8: 9,   // 신자진 → 유
    2: 3, 6: 3, 10: 3,  // 인오술 → 묘
    3: 0, 7: 0, 11: 0,  // 해묘미 → 자
    1: 6, 5: 6, 9: 6,   // 사유축 → 오
  };
  if (yearPillar?.branch?.code) {
    const yearNatalBranch = BRANCH_BY_CODE[yearPillar.branch.code];
    if (yearNatalBranch) {
      const dohwaTarget = dohwaMap[yearNatalBranch.index];
      if (dohwaTarget !== undefined) {
        const isDohwa = branchInfo.index === dohwaTarget;
        results.push({
          name: '도화(桃花)',
          active: isDohwa,
          description: isDohwa
            ? '도화살이 활성화되어 매력, 인기, 예술적 감각이 빛나는 해예요.'
            : '도화살이 비활성 상태예요.',
        });
      }
    }
  }

  // 4. 홍란성 체크 (연지 기준)
  // 홍란: 자→묘, 축→인, 인→축, 묘→자, 진→해, 사→술, 오→유, 미→신, 신→미, 유→오, 술→사, 해→진
  const honglanMap: Record<number, number> = {
    0: 3, 1: 2, 2: 1, 3: 0, 4: 11, 5: 10, 6: 9, 7: 8, 8: 7, 9: 6, 10: 5, 11: 4,
  };
  if (yearPillar?.branch?.code) {
    const yearNatalBranch = BRANCH_BY_CODE[yearPillar.branch.code];
    if (yearNatalBranch) {
      const honglanTarget = honglanMap[yearNatalBranch.index];
      if (honglanTarget !== undefined) {
        const isHonglan = branchInfo.index === honglanTarget;
        results.push({
          name: '홍란(紅鸞)',
          active: isHonglan,
          description: isHonglan
            ? '홍란성이 활성화되어 연애, 결혼, 인연의 기운이 강한 해예요.'
            : '홍란성이 비활성 상태예요.',
        });
      }
    }
  }

  // 5. 천희성 체크 (홍란의 대충)
  // 천희: 자→유, 축→신, 인→미, 묘→오, 진→사, 사→진, 오→묘, 미→인, 신→축, 유→자, 술→해, 해→술
  const cheonhuiMap: Record<number, number> = {
    0: 9, 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1, 9: 0, 10: 11, 11: 10,
  };
  if (yearPillar?.branch?.code) {
    const yearNatalBranch = BRANCH_BY_CODE[yearPillar.branch.code];
    if (yearNatalBranch) {
      const cheonhuiTarget = cheonhuiMap[yearNatalBranch.index];
      if (cheonhuiTarget !== undefined) {
        const isCheonhui = branchInfo.index === cheonhuiTarget;
        results.push({
          name: '천희(天喜)',
          active: isCheonhui,
          description: isCheonhui
            ? '천희성이 활성화되어 기쁜 소식, 경사, 축하할 일이 생길 수 있는 해예요.'
            : '천희성이 비활성 상태예요.',
        });
      }
    }
  }

  return results;
}

// =============================================================================
//  오행별 역사 이미지 매핑 — 역사학자 페르소나
// =============================================================================

const ELEMENT_HISTORY_IMAGE: Record<string, string> = {
  WOOD:  '봄의 세종대왕 시대처럼 문화가 활짝 꽃피는 성장의 기운',
  FIRE:  '한여름의 열정으로 세계를 정복한 알렉산더처럼 뜨거운 도전의 기운',
  EARTH: '만리장성처럼 든든하게 기반을 다지는 안정의 기운',
  METAL: '산업혁명의 철도처럼 새 시대를 여는 혁신의 기운',
  WATER: '대항해시대 탐험가처럼 깊은 지혜로 미지를 개척하는 기운',
};

// =============================================================================
//  문장 템플릿 — 역사학자 페르소나
// =============================================================================

// ─── 도입부 ─────────────────────────────────────────────────────────────

const INTRO_TEMPLATES: readonly string[] = [
  '세운(歲運)은 역사에서 "그 해의 시대정신"과도 같아요. 역사학자들이 한 해의 흐름을 읽듯, {{이름}}님의 올해 기운을 역사의 관점에서 분석해 볼게요!',
  '역사에는 태평성대가 있고, 격동의 전환기가 있지요. 세운은 한 해 동안 {{이름}}님에게 불어오는 시대의 바람이에요. 자, 역사의 페이지를 넘겨볼까요?',
  '모든 위대한 문명에는 흥성기와 전환기가 있었어요. 세운은 바로 {{이름}}님 개인의 역사에서 올해가 어떤 시기인지를 알려주는 연대기(年代記)랍니다.',
  '세종대왕의 한글 창제처럼 어떤 해는 역사에 길이 남을 업적을 남기기도 해요. 세운 분석은 올해가 {{이름}}님에게 어떤 역사적 해가 될지 읽어보는 거예요.',
  '역사학자가 시대의 흐름을 읽듯, 세운(歲運) 분석은 매년 바뀌는 하늘의 기운을 해독하는 작업이에요. {{이름}}님의 올해 역사를 함께 살펴보겠어요!',
  '나폴레옹에게 워털루가 있었고, 세종에게 집현전이 있었듯, 매 해마다 고유한 기운이 흘러요. 세운은 올해 {{이름}}님에게 어떤 역사적 순간이 찾아오는지 말해준답니다.',
];

// ─── 용신 부합도별 해설 (★1~★5) ──────────────────────────────────────

const GRADE_HISTORY_TEMPLATES: Record<YongshinMatchGrade, readonly string[]> = {
  5: [
    '르네상스 시대처럼 모든 것이 활짝 피어나는 최고의 해예요! 문화와 예술이 꽃피었던 그 시대의 기운이 감돌고 있어요.',
    '세종대왕의 집현전처럼, 지혜와 성과가 한꺼번에 쏟아지는 황금기와도 같은 해랍니다.',
    '실크로드가 활짝 열린 당나라 전성기처럼, 모든 길이 {{이름}}님에게 유리하게 열리는 시기예요!',
    '고려 문종 시대처럼 태평성대의 기운이 감도는 한 해예요. 하고 싶은 일에 과감히 도전해 보세요.',
    '알렉산더 대왕의 동방 원정처럼, 새로운 영토를 개척하기에 더없이 좋은 기운이 흐르고 있어요.',
    '에디슨이 전구를 발명한 해처럼, 눈부신 성과와 빛나는 아이디어가 나올 수 있는 최고의 시기랍니다.',
    '페르시아 제국의 키루스 대왕 시절처럼, 관용과 지혜로 모든 일이 순탄하게 풀리는 해예요.',
    '조선 정조 시대의 르네상스처럼, 학문과 실용이 조화를 이루는 빛나는 한 해가 될 거예요.',
    '로마의 아우구스투스 시대처럼 평화와 번영이 함께 찾아오는 황금의 해가 될 거예요.',
    '산업혁명 초기의 영국처럼, 새로운 가능성이 폭발적으로 열리는 시기와도 같아요!',
  ],
  4: [
    '조선 초기 세종 시대의 안정기처럼, 꾸준한 발전과 좋은 성과가 기대되는 해예요.',
    '고려 광종의 개혁 시대처럼, 변화를 통해 한 단계 성장할 수 있는 기운이 감돌아요.',
    '프랑스 계몽시대처럼, 새로운 지식과 기회가 문을 두드리는 좋은 해랍니다.',
    '한강의 기적이라 불린 경제 성장기처럼, 노력한 만큼 결실을 맺을 수 있는 시기예요.',
    '빅토리아 시대의 영국처럼, 안정 속에서 꾸준히 성장하는 기운이 흐르고 있어요.',
    '조선 성종 시대처럼, 문화와 제도가 잘 정비되어 성과가 자연스럽게 따라오는 해예요.',
    '메디치 가문의 피렌체처럼, 예술과 학문에 투자하면 빛나는 성과가 나올 수 있는 시기예요.',
    '독일 통일기의 비스마르크처럼, 전략적 판단이 좋은 결과로 이어지는 해랍니다.',
    '당 태종의 정관지치(貞觀之治) 시절처럼, 현명한 판단이 좋은 성과로 연결되는 해예요.',
    '메이지 유신의 일본처럼, 과감한 개혁과 도전이 성공을 불러오는 기운이 감돌아요.',
  ],
  3: [
    '조선 중기의 평화로운 시절처럼, 큰 파도 없이 안정적으로 흘러가는 한 해예요.',
    '로마 제국의 오현제 시대 중반처럼, 무난하고 안정적인 흐름 속에 있는 시기예요.',
    '고려 중기의 평온한 시절처럼, 특별한 사건 없이 꾸준히 나아가는 해가 될 거예요.',
    '에도 시대의 일본처럼, 평화 속에서 내실을 다지기 좋은 시기랍니다.',
    '당나라 중기처럼, 겉으로 보기엔 평범하지만 내면의 힘을 기르기에 좋은 해예요.',
    '한나라 문경지치(文景之治) 시절처럼, 화려하지는 않지만 착실하게 기반을 쌓는 시기예요.',
    '백제 무령왕 시대처럼, 조용하지만 단단한 내공을 쌓아가는 한 해가 될 거예요.',
    '빅토리아 여왕 중기처럼, 평온한 일상 속에서 미래를 준비하는 시간이에요.',
    '송나라의 평화로운 학문 시대처럼, 배움과 자기 계발에 집중하기 좋은 해예요.',
    '조선 숙종 초기처럼, 겉으로 보기엔 조용하지만 물밑에서 변화를 준비하는 시기랍니다.',
  ],
  2: [
    '임진왜란 직전의 조선처럼, 미리 준비하고 대비하면 위기를 기회로 바꿀 수 있는 해예요.',
    '로마 공화정 말기처럼, 변화의 조짐이 보이는 시기예요. 신중한 판단이 필요하답니다.',
    '삼국시대의 전환기처럼, 여러 방향에서 도전이 찾아올 수 있으니 마음의 준비를 해두세요.',
    '프랑스 혁명 직전처럼, 기존의 틀이 흔들리는 시기예요. 하지만 새로운 세상을 여는 계기가 되기도 해요.',
    '고려 말기의 개혁기처럼, 낡은 것을 버리고 새것을 받아들이는 용기가 필요한 해예요.',
    '대공황 시기의 미국처럼, 어려움 속에서도 뉴딜 같은 혁신이 탄생할 수 있는 시기예요.',
    '병자호란 이후의 조선처럼, 시련 후에 더 강해지는 회복력을 보여줄 수 있는 해예요.',
    '백년전쟁 중의 프랑스처럼, 인내가 필요하지만 잔 다르크처럼 빛나는 순간이 올 수 있어요.',
    '동학혁명 시기처럼, 기존 질서가 흔들리지만 새로운 희망의 씨앗이 움트는 해예요.',
    '오스만 제국 말기처럼, 도전적인 상황이지만 현명하게 대처하면 전환점이 될 수 있어요.',
  ],
  1: [
    '임진왜란의 격동기처럼, 큰 시련이 올 수 있는 해예요. 하지만 이순신 장군처럼 지혜와 용기로 극복할 수 있어요!',
    '로마 제국 멸망기처럼, 기존 체계가 흔들리는 시기예요. 하지만 모든 끝은 새로운 시작이기도 하답니다.',
    '흑사병 시대의 유럽처럼, 어둡게 보이지만 르네상스를 잉태한 시기였듯, 이 시련 뒤에 큰 성장이 기다리고 있어요.',
    '병자호란처럼 혹독한 겨울이 올 수 있지만, 겨울이 지나면 봄은 반드시 찾아오는 법이에요.',
    '세계 대전 시기처럼, 모든 것이 혼란스러워 보이지만 UN과 같은 새로운 질서가 탄생한 것처럼 위기 속에서 기회가 싹트는 법이에요.',
    '안시성 전투처럼, 어려운 상황에서 끝까지 버텨내면 역사에 빛나는 승리를 거둘 수 있어요.',
    '트로이 전쟁의 긴 포위처럼, 인내와 지혜가 필요한 해예요. 결국 승리는 끝까지 포기하지 않는 자의 것이에요.',
    '고구려 을지문덕 장군의 살수대첩처럼, 위기 속에서 빛나는 지혜로 역전할 수 있는 해예요.',
    '나폴레옹의 러시아 원정 실패처럼, 무리한 확장보다 내실을 다지는 전략이 필요한 해예요.',
    '광해군 시절처럼, 판단력과 중립의 지혜가 특히 중요한 시기랍니다.',
  ],
};

// ─── 용신 부합도별 구체적 조언 ─────────────────────────────────────────

const GRADE_ADVICE_TEMPLATES: Record<YongshinMatchGrade, readonly string[]> = {
  5: [
    '르네상스의 레오나르도 다빈치처럼, 다방면에 도전하면 모두 좋은 결과로 이어질 거예요.',
    '세종대왕의 한글 창제처럼, 평소 구상했던 큰 프로젝트를 실행에 옮기기에 최적의 해예요.',
    '이 해에는 역사적 전환점을 만들 수 있는 기운이 감돌아요. 과감한 결단이 빛을 발할 거예요.',
  ],
  4: [
    '영조 시대의 탕평책처럼, 조화와 균형을 중시하며 꾸준히 나아가면 좋은 성과가 있을 거예요.',
    '실크로드의 상인처럼, 새로운 인연과 기회를 적극적으로 탐색해 보세요.',
    '계몽주의 철학자들처럼, 배움과 성장에 투자하면 큰 보상이 따라올 거예요.',
  ],
  3: [
    '조선 선비처럼, 학문과 자기 수양에 집중하면 다음 기회를 잡을 실력이 쌓일 거예요.',
    '한나라 초기의 유방처럼, 겸손하게 주변의 조언을 듣고 내실을 다지는 전략이 좋아요.',
    '에도 시대의 장인처럼, 묵묵히 자기 분야의 전문성을 갈고닦는 시기로 삼아보세요.',
  ],
  2: [
    '제갈량의 신중함처럼, 모든 결정을 세 번 생각한 후에 행동으로 옮기세요.',
    '이순신 장군이 명량해전을 앞두고 철저히 준비했듯, 이 해에는 준비와 계획이 가장 중요해요.',
    '큰 투자나 변화보다는, 학문의 수도승처럼 내면의 힘을 기르는 데 집중하세요.',
  ],
  1: [
    '광개토대왕이 위기 속에서 영토를 지켰듯, 지금은 지키는 데 집중하는 것이 현명해요.',
    '겨울을 나는 동물처럼, 에너지를 보존하고 건강에 특히 신경 쓰세요.',
    '모든 위대한 역사는 시련을 딛고 일어선 이야기예요. 이 시기를 잘 버텨내면 더 강해질 거예요.',
  ],
};

// ─── 세운 십성별 해설 (10개 십성 × 최소 5개) ─────────────────────────

const TEN_GOD_YEARLY_TEMPLATES: Record<string, readonly string[]> = {
  BI_GYEON: [
    '올해는 비견(比肩)의 해예요. 역사에서 동맹국끼리 힘을 합치는 시기와 비슷해요. 동료와 협력하면 큰 힘이 될 거예요.',
    '비견의 해에는 삼국시대의 동맹처럼, 같은 뜻을 가진 사람들과 힘을 합치는 것이 중요해요.',
    '비견은 형제의 기운이에요. 관우와 장비가 유비를 도왔듯, 든든한 동지가 나타날 수 있어요.',
    '올해 비견의 기운은 스파르타의 전우애처럼, 함께하는 사람들과의 유대가 강해지는 시기예요.',
    '비견의 해에는 자신감이 높아지지만, 나폴레옹의 교훈처럼 지나친 독선은 조심하세요.',
    '고구려 삼형제처럼, 비견의 기운은 경쟁보다 협력에서 더 큰 빛을 발해요.',
  ],
  GEOB_JAE: [
    '겁재(劫財)의 해예요. 역사의 라이벌 관계처럼, 경쟁자가 나타나 자극을 줄 수 있어요.',
    '겁재는 조조와 유비의 관계처럼, 경쟁 속에서 서로를 더 성장시키는 기운이에요.',
    '올해는 겁재의 해라, 이슬람 제국과 비잔틴의 경쟁처럼 자극적이지만 발전의 원동력이 될 거예요.',
    '겁재의 기운은 올림픽 라이벌처럼, 건전한 경쟁이 최고의 성과를 만들어 내는 에너지예요.',
    '겁재의 해에는 재정 관리에 특히 신경 쓰세요. 역사 속 과도한 전비 지출의 교훈을 기억하세요.',
    '겁재의 기운 속에서는 명나라 정화처럼, 도전 정신을 발휘하되 자원 관리도 철저히 하세요.',
  ],
  SIK_SHIN: [
    '식신(食神)의 해예요. 르네상스의 예술가들처럼, 창의력과 표현력이 넘치는 시기랍니다.',
    '식신은 실크로드의 문화 교류처럼, 다양한 경험과 재능이 꽃피는 기운이에요.',
    '올해 식신의 기운은 에디슨의 발명 시대처럼, 아이디어가 샘솟는 창조의 해예요.',
    '식신의 해에는 세종대왕의 학자들처럼, 배움과 탐구가 풍성한 결실로 이어질 거예요.',
    '식신은 풍요의 기운이에요. 이집트 나일강의 풍년처럼, 노력한 만큼 풍성한 수확이 있을 거예요.',
    '식신의 기운 속에서는 모차르트처럼, 자기만의 재능을 마음껏 펼쳐보세요.',
  ],
  SANG_GWAN: [
    '상관(傷官)의 해예요. 프랑스 혁명의 자유 정신처럼, 기존 틀을 깨는 창의적 에너지가 넘쳐요.',
    '상관은 마르틴 루터의 종교개혁처럼, 관습에 도전하고 새로운 길을 여는 기운이에요.',
    '올해 상관의 기운은 피카소의 큐비즘처럼, 파격적이고 혁신적인 발상이 빛을 발할 거예요.',
    '상관의 해에는 갈릴레오처럼, 진실을 위해 기존 질서에 용감하게 도전할 수 있어요.',
    '상관은 예술적 감각의 폭발이에요. 다만, 반 고흐의 교훈처럼 감정 조절도 함께 신경 쓰세요.',
    '상관의 기운은 다빈치의 과학 정신처럼, 관습을 뛰어넘는 새로운 시각을 선물해요.',
  ],
  PYEON_JAE: [
    '편재(偏財)의 해예요. 대항해시대 콜럼버스처럼, 뜻밖의 기회와 행운이 찾아올 수 있어요.',
    '편재는 마르코 폴로의 모험처럼, 새로운 영역에서 재물과 기회를 발견하는 기운이에요.',
    '올해 편재의 기운은 골드러시 시대처럼, 과감한 도전이 큰 보상으로 이어질 수 있어요.',
    '편재의 해에는 정화의 대항해처럼, 넓은 시야로 새로운 가능성을 탐색해 보세요.',
    '편재는 실크로드 상인의 기운이에요. 인맥과 사교 활동이 재물로 연결될 수 있답니다.',
    '편재의 기운 속에서는 카네기처럼, 사업적 감각과 인맥 관리가 빛을 발해요.',
  ],
  JEONG_JAE: [
    '정재(正財)의 해예요. 산업혁명의 꾸준한 성장처럼, 성실한 노력이 안정적 수입으로 돌아오는 시기예요.',
    '정재는 네덜란드 황금시대의 무역처럼, 꾸준하고 정직한 거래가 부를 쌓는 기운이에요.',
    '올해 정재의 기운은 조선 상인 임상옥처럼, 신용과 성실함이 재물을 불러오는 해예요.',
    '정재의 해에는 독일 장인 정신처럼, 맡은 일에 성실하게 임하면 자연스럽게 보상이 따라올 거예요.',
    '정재는 안정적 재물운이에요. 로마의 도로처럼, 튼튼한 기반을 쌓아가는 시기랍니다.',
    '정재의 기운은 한강의 기적처럼, 꾸준한 노력이 경제적 안정으로 연결되는 해예요.',
  ],
  PYEON_GWAN: [
    '편관(偏官)의 해예요. 전국시대의 장군처럼, 강한 외부 압력과 도전이 찾아올 수 있어요.',
    '편관은 진시황의 통일 전쟁처럼, 거센 힘이 밀려오지만 이를 이겨내면 큰 업적을 남길 수 있어요.',
    '올해 편관의 기운은 이순신의 전장처럼, 강한 시련 속에서 빛나는 리더십을 발휘할 수 있어요.',
    '편관의 해에는 을지문덕처럼, 위기를 기회로 바꾸는 전략적 사고가 중요해요.',
    '편관은 강한 규율의 기운이에요. 스파르타 교육처럼, 힘들지만 강해지는 시기랍니다.',
    '편관의 기운은 카이사르의 결단력처럼, 대담한 행동이 새 역사를 여는 해예요.',
  ],
  JEONG_GWAN: [
    '정관(正官)의 해예요. 태평성대를 이끈 현명한 왕처럼, 질서와 명예가 높아지는 시기예요.',
    '정관은 세종대왕의 통치처럼, 정의롭고 공정한 기운이 흐르는 해예요.',
    '올해 정관의 기운은 로마 오현제 시대처럼, 안정적 체계 속에서 승진이나 인정을 받을 수 있어요.',
    '정관의 해에는 공자의 가르침처럼, 예의와 도덕을 중시하면 자연스럽게 존경을 얻게 될 거예요.',
    '정관은 관직과 명예의 기운이에요. 과거에 급제한 선비처럼, 노력의 결실을 공식적으로 인정받을 수 있어요.',
    '정관의 기운은 영국 빅토리아 시대의 질서처럼, 체계적이고 안정적인 성장을 이끌어 내요.',
  ],
  PYEON_IN: [
    '편인(偏印)의 해예요. 연금술사들의 비밀 연구처럼, 독특한 학문과 특별한 재능에 빛이 드는 시기예요.',
    '편인은 다빈치의 비밀 노트처럼, 남다른 아이디어와 영감이 떠오르는 기운이에요.',
    '올해 편인의 기운은 뉴턴이 만유인력을 발견한 것처럼, 뜻밖의 깨달음이 찾아올 수 있어요.',
    '편인의 해에는 동양의 도사처럼, 고독한 탐구가 위대한 발견으로 이어질 수 있어요.',
    '편인은 직감의 기운이에요. 아인슈타인의 사고실험처럼, 논리보다 직감이 빛을 발할 수 있어요.',
    '편인의 기운은 노스트라다무스처럼, 미래를 내다보는 통찰력이 높아지는 해예요.',
  ],
  JEONG_IN: [
    '정인(正印)의 해예요. 플라톤의 아카데미아처럼, 배움과 학문이 풍성해지는 시기랍니다.',
    '정인은 조선 성균관의 학자처럼, 체계적인 공부와 자격증 취득에 유리한 기운이에요.',
    '올해 정인의 기운은 장영실의 발명처럼, 학문적 성과가 현실의 성공으로 이어질 수 있어요.',
    '정인의 해에는 공자의 제자들처럼, 좋은 스승이나 멘토를 만날 가능성이 높아요.',
    '정인은 어머니의 사랑 같은 기운이에요. 안정적인 지원과 보살핌을 받을 수 있는 해랍니다.',
    '정인의 기운은 옥스퍼드 대학의 전통처럼, 정통 학문에서 빛을 발하는 해예요.',
  ],
};

// ─── 합충형파해 발생 시 해설 (역사학자 톤) ──────────────────────────────

const RELATION_HISTORY_TEMPLATES: Record<string, readonly string[]> = {
  YUKHAP: [
    '세운 지지가 원국과 육합(六合)을 이루고 있어요. 한일 양국의 문화 교류처럼, 서로 다른 기운이 만나 새로운 조화를 만들어 내는 거예요.',
    '육합의 기운이 활성화되어, 동서 문명의 만남처럼 뜻밖의 좋은 인연이 생길 수 있어요.',
    '올해 육합은 실크로드의 교류처럼, 새로운 인연이 풍요로운 결실을 가져다줄 수 있어요.',
    '육합의 에너지는 고려와 송나라의 우호 관계처럼, 좋은 동맹이 형성되는 기운이에요.',
    '이 합은 세종과 집현전 학자들의 만남처럼, 뜻이 맞는 사람과의 조화가 빛나는 해예요.',
  ],
  SAMHAP: [
    '삼합(三合)의 기운이 원국과 만나고 있어요. 삼국 동맹처럼, 여러 힘이 하나로 모여 강력한 시너지를 발휘해요.',
    '올해 삼합은 유방의 삼걸처럼, 핵심 인재들과 합류하면 대업을 이룰 수 있는 기운이에요.',
    '삼합의 에너지는 세 나라가 연합하는 것처럼, 단체 활동이나 팀 프로젝트에서 큰 성과를 올릴 수 있어요.',
    '이 삼합은 의적 로빈 후드의 동지들처럼, 같은 뜻을 가진 사람들이 모이는 기운이에요.',
    '삼합의 완성은 삼국지의 도원결의처럼, 운명적 만남이 이루어질 수 있음을 의미해요.',
  ],
  BANGHAP: [
    '방합(方合)의 기운이 원국과 공명하고 있어요. 동아시아 문화권의 연대처럼, 같은 방향의 기운이 한꺼번에 강해지는 시기예요.',
    '올해 방합은 EU 통합처럼, 같은 방향을 바라보는 힘이 모여 거대한 에너지를 만들어요.',
    '방합의 에너지는 한자 문화권의 공유처럼, 공동체 안에서 힘을 모으면 놀라운 결과가 나올 거예요.',
    '이 방합은 지중해 문명의 공통된 기반처럼, 비슷한 가치관을 가진 사람들과의 연대가 빛나는 해예요.',
    '방합의 완성은 실크로드 위의 오아시스 도시들처럼, 같은 네트워크 안에서 번영하는 기운이에요.',
  ],
  CHUNG: [
    '세운 지지가 원국과 충(冲)을 형성하고 있어요. 로마와 카르타고의 충돌처럼, 큰 변화의 에너지가 일어나는 해예요.',
    '충의 기운이 활성화되어, 메이지 유신처럼 기존 질서가 뒤바뀌는 전환점이 될 수 있어요.',
    '올해 충은 프랑스 혁명처럼, 격렬하지만 새 시대를 여는 기폭제가 될 수 있어요.',
    '이 충은 삼국시대의 전투처럼, 격동적이지만 역사를 새로 쓰는 계기가 되기도 해요.',
    '충의 에너지는 산업혁명의 파괴적 혁신처럼, 불편하지만 결과적으로 더 나은 세상을 만들어 내요.',
    '장기판의 대국처럼, 충의 해에는 전략적 사고와 침착함이 특히 중요해요.',
  ],
  HYEONG: [
    '세운 지지가 원국과 형(刑)을 이루고 있어요. 역사의 시련기처럼, 성장통을 겪는 시기예요.',
    '형의 기운은 십자군 전쟁처럼, 힘든 과정이지만 문화적 교류와 성장을 낳는 양면성이 있어요.',
    '올해 형은 고난의 행군처럼, 인내가 필요하지만 그 끝에 새로운 강인함을 얻게 될 거예요.',
    '이 형은 대장정(大長征)처럼, 힘든 여정이지만 불굴의 의지를 만들어 주는 기운이에요.',
    '형의 에너지는 세계 대전 후의 재건처럼, 시련 뒤에 더 강한 모습으로 다시 일어서는 힘이에요.',
  ],
  PA: [
    '세운 지지가 원국과 파(破)를 이루고 있어요. 베를린 장벽 붕괴처럼, 기존의 틀이 깨지는 에너지가 있어요.',
    '파의 기운은 봉건제도의 해체처럼, 낡은 구조가 무너지고 새로운 체제가 시작되는 시기예요.',
    '올해 파는 인쇄술의 발명처럼, 기존 질서의 균열이 오히려 새로운 가능성을 여는 계기가 돼요.',
    '이 파는 동서독 통일처럼, 깨진 벽 너머로 새로운 세계가 펼쳐지는 기운이에요.',
    '파의 에너지는 작은 금이지만, 도자기의 킨쓰기처럼 금을 메우면 더 아름다워지는 법이에요.',
  ],
  HAE: [
    '세운 지지가 원국과 해(害)를 이루고 있어요. 냉전 시대의 미묘한 긴장처럼, 겉으로 평화로워 보이지만 주의가 필요해요.',
    '해의 기운은 동서 냉전처럼, 표면적으로는 평온하지만 내면에 긴장이 흐르는 시기예요.',
    '올해 해는 아편전쟁 전의 무역 마찰처럼, 작은 불씨가 커지지 않도록 미리 관리하는 것이 중요해요.',
    '이 해는 역사 속 외교적 긴장처럼, 대인관계에서 세심한 주의를 기울이면 무사히 넘길 수 있어요.',
    '해의 에너지는 데탕트 시기처럼, 적절한 거리 조절이 오히려 관계를 건강하게 유지하는 비결이에요.',
  ],
  WONJIN: [
    '세운 지지가 원국과 원진(怨嗔)을 이루고 있어요. 역사 속 오해로 벌어진 전쟁처럼, 소통 부족에서 오는 불편함이 있을 수 있어요.',
    '원진의 기운은 백년전쟁의 시작처럼, 사소한 오해가 큰 갈등으로 번질 수 있으니 대화를 많이 하세요.',
    '올해 원진은 로미오와 줄리엣의 두 가문처럼, 불필요한 오해를 풀면 좋은 관계로 전환될 수 있어요.',
    '이 원진은 역사 속 종교 갈등처럼, 서로의 차이를 이해하려는 노력이 필요한 시기예요.',
    '원진의 에너지는 문화 충돌처럼, 차이를 존중하면 오히려 풍요로운 교류가 될 수 있어요.',
  ],
};

// ─── 마무리 템플릿 ──────────────────────────────────────────────────────

const CLOSING_TEMPLATES: readonly string[] = [
  '역사는 반복되지만, 역사를 아는 자는 같은 실수를 반복하지 않아요. 세운 분석이 {{이름}}님의 올해를 현명하게 보내는 나침반이 되기를 바라요!',
  '모든 시대에는 고유한 기회와 도전이 있었어요. {{이름}}님도 올해의 기운을 잘 읽고, 역사에 빛나는 한 해를 만들어 보세요!',
  '역사학자의 관점에서 보면, 어떤 시대든 그 시대를 이해한 사람이 가장 큰 성공을 거뒀어요. {{이름}}님, 올해의 세운을 이해한 것만으로도 절반은 성공한 셈이에요.',
  '세종대왕이 시대를 읽고 한글을 만들었듯, {{이름}}님도 세운의 흐름을 읽고 올해의 역사를 멋지게 써내려 가세요!',
  '역사 속 위인들은 모두 자기 시대의 흐름을 정확히 읽었어요. 세운 분석이 {{이름}}님에게 그 통찰의 열쇠가 되기를 바랍니다.',
  '위대한 역사는 준비된 사람에게 찾아온 기회로 만들어지는 법이에요. {{이름}}님의 올해가 역사에 남을 한 해가 되기를 응원해요!',
];

// =============================================================================
//  세운 데이터 계산
// =============================================================================

interface YearlyFortuneData {
  /** 세운 간지 정보 */
  fortune: YearlyFortune;
  /** 천간 십성 */
  stemTenGod: TenGodCode;
  /** 지지 주기(本氣) 십성 (지지 오행의 양간 기준) */
  branchTenGod: TenGodCode;
  /** 용신 부합도 */
  grade: YongshinMatchGrade;
  /** 합충형파해 */
  relations: FortuneRelation[];
  /** 신살 활성화 */
  shinsalActivations: ShinsalActivation[];
}

function computeYearlyFortuneData(
  year: number,
  dayMasterIdx: number,
  natalBranches: BranchCode[],
  yongEl: ElementCode | null,
  heeEl: ElementCode | null,
  hanEl: ElementCode | null,
  guEl: ElementCode | null,
  giEl: ElementCode | null,
  input: ReportInput,
): YearlyFortuneData {
  const fortune = getYearlyFortune(year);

  // 천간 십성 계산
  const stemTenGod = computeTenGod(dayMasterIdx, fortune.stemIndex);

  // 지지 십성 계산: 지지 본기 천간의 십성
  // 지지의 본기(정기) 오행에 해당하는 양간 인덱스로 매핑
  const branchEl = fortune.branchElement;
  const branchStemIdx = STEMS.findIndex(s => s.element === branchEl && s.yinYang === 'YANG');
  const branchTenGod = computeTenGod(dayMasterIdx, branchStemIdx >= 0 ? branchStemIdx : 0);

  // 용신 부합도 계산
  const grade: YongshinMatchGrade = yongEl
    ? getYongshinMatchGrade(fortune.stemElement, yongEl, heeEl, hanEl, guEl, giEl)
    : (3 as YongshinMatchGrade);

  // 합충형파해 대조
  const relations = checkFortuneRelations(
    fortune.branch.code as BranchCode,
    natalBranches,
  );

  // 신살 활성화 체크
  const shinsalActivations = checkShinsalActivations(
    fortune.branch.code as BranchCode,
    input,
  );

  return { fortune, stemTenGod, branchTenGod, grade, relations, shinsalActivations };
}

// =============================================================================
//  서술문 생성 헬퍼
// =============================================================================

function buildYearNarrative(
  rng: SeededRandom,
  data: YearlyFortuneData,
  name: string,
  isCurrent: boolean,
): string[] {
  const { fortune, stemTenGod, branchTenGod, grade, relations, shinsalActivations } = data;
  const ganzi = fortune.ganzhiHangul;
  const mainEl = fortune.stemElement;
  const year = fortune.year;

  const sentences: string[] = [];

  // 1. 간지 기본 정보
  const yearLabel = isCurrent ? '올해' : `${year}년`;
  sentences.push(
    `${yearLabel}(${year}) ${ganzi}(${fortune.ganzhiHanja})년 — ${elFull(mainEl)}의 기운이 흐르는 해예요.`,
  );

  // 2. 역사 이미지
  const histImage = ELEMENT_HISTORY_IMAGE[mainEl] ?? '새로운 시대의 기운';
  sentences.push(`이 해에는 ${histImage}이(가) 감돌고 있어요.`);

  // 3. 용신 부합도 해설
  sentences.push(
    `용신 부합도는 ${YONGSHIN_GRADE_STARS[grade]}(${YONGSHIN_GRADE_DESC[grade]})이에요.`,
  );
  sentences.push(pickAndFill(rng, GRADE_HISTORY_TEMPLATES[grade], { 이름: name }));

  // 4. 십성 해설
  const stemTGTemplates = TEN_GOD_YEARLY_TEMPLATES[stemTenGod];
  if (stemTGTemplates && stemTGTemplates.length > 0) {
    sentences.push(rng.pick(stemTGTemplates));
  }

  // 5. 합충형파해 해설
  if (relations.length > 0) {
    for (const rel of relations) {
      const relType = rel.type as string;
      const templates = RELATION_HISTORY_TEMPLATES[relType];
      if (templates && templates.length > 0) {
        sentences.push(rng.pick(templates));
      }
      sentences.push(rel.description);
    }
  }

  // 6. 신살 활성화 해설
  const activeShinsals = shinsalActivations.filter(s => s.active);
  if (activeShinsals.length > 0) {
    for (const shinsal of activeShinsals) {
      sentences.push(`[${shinsal.name} 활성화] ${shinsal.description}`);
    }
  }

  // 7. 조언
  sentences.push(pickAndFill(rng, GRADE_ADVICE_TEMPLATES[grade], { 이름: name }));

  return sentences;
}

// =============================================================================
//  메인 생성 함수
// =============================================================================

export function generateYearlyFortuneSection(input: ReportInput): ReportSection | null {
  // 기본 데이터 확인
  if (!input.saju?.pillars || !input.saju?.dayMaster) return null;

  const rng = createRng(input);
  // offset 36 으로 고유성 확보
  for (let i = 0; i < 36; i++) rng.next();

  const name = safeName(input);
  const dayMasterIdx = extractDayMasterIndex(input);
  const natalBranches = extractNatalBranches(input);

  // 용신 체계 추출
  const yongEl = (input.saju.yongshin?.element as ElementCode) ?? null;
  const heeEl = (input.saju.yongshin?.heeshin
    ?? (yongEl ? ELEMENT_GENERATED_BY[yongEl] : null)) as ElementCode | null;
  const giEl = (input.saju.yongshin?.gishin as ElementCode) ?? null;
  const guEl = (input.saju.yongshin?.gushin as ElementCode) ?? null;
  const hanEl = deriveHansin(yongEl, heeEl, giEl, guEl);

  // 올해 기준 산출
  const today = input.today ?? new Date();
  const currentYear = today.getFullYear();
  const saeunRange = input.options?.saeunRange ?? 5;

  // 전후 N년 세운 데이터 계산
  const startYear = currentYear - saeunRange;
  const endYear = currentYear + saeunRange;
  const yearlyDataList: YearlyFortuneData[] = [];

  for (let y = startYear; y <= endYear; y++) {
    yearlyDataList.push(
      computeYearlyFortuneData(y, dayMasterIdx, natalBranches, yongEl, heeEl, hanEl, guEl, giEl, input),
    );
  }

  const paragraphs: ReportParagraph[] = [];

  // ── 7-3-1. 도입부 ───────────────────────────────────────────────────

  paragraphs.push(narrative(
    pickAndFill(rng, INTRO_TEMPLATES, { 이름: name }),
  ));

  // 일간 & 용신 정보 안내
  const dayMasterStem = input.saju.dayMaster?.stem;
  const dmInfo = dayMasterStem ? lookupStemInfo(dayMasterStem) : null;
  if (dmInfo) {
    paragraphs.push(tip(
      `${name}님의 일간(나 자신)은 ${dmInfo.hangul}(${dmInfo.hanja}), ${elFull(dmInfo.element)}이에요. ` +
      (yongEl
        ? `용신은 ${elFull(yongEl)}이고, 세운의 오행이 용신에 가까울수록 역사의 황금기처럼 좋은 기운이 감돌아요.`
        : '세운의 오행이 일간과 어떤 관계를 맺느냐에 따라 그 해의 기운이 결정된답니다.'),
      dmInfo.element,
    ));
  }

  // ── 7-3-2. 올해(현재년) 세운 상세 분석 ──────────────────────────────

  const currentIdx = yearlyDataList.findIndex(d => d.fortune.year === currentYear);
  if (currentIdx >= 0) {
    const currentData = yearlyDataList[currentIdx];
    paragraphs.push(emphasis(`${currentYear}년 세운 상세 분석`));

    const currentNarrative = buildYearNarrative(rng, currentData, name, true);
    const mainEl = currentData.fortune.stemElement;

    // 톤 결정
    if (currentData.grade >= 4) {
      paragraphs.push(positive(joinSentences(...currentNarrative), mainEl));
    } else if (currentData.grade <= 2) {
      paragraphs.push(caution(joinSentences(...currentNarrative), mainEl));
    } else {
      paragraphs.push(narrative(joinSentences(...currentNarrative), mainEl));
    }

    // 현재 세운 십성 상세 설명
    const stemTGName = tenGodKorean(currentData.stemTenGod);
    const stemTGHanja = tenGodHanja(currentData.stemTenGod);
    const branchTGName = tenGodKorean(currentData.branchTenGod);
    const branchTGHanja = tenGodHanja(currentData.branchTenGod);
    const enrichedCurrentYearParagraph = buildCurrentYearEncyclopediaParagraph(currentData.fortune);

    paragraphs.push(narrative(
      `올해 세운의 천간 십성은 ${stemTGName}(${stemTGHanja})이고, 지지 십성은 ${branchTGName}(${branchTGHanja})이에요. ` +
      `천간은 외적으로 드러나는 기운이고, 지지는 내면적으로 작용하는 기운이랍니다.`,
    ));

    // 합충형파해 요약 (올해)
    if (enrichedCurrentYearParagraph) {
      paragraphs.push(narrative(enrichedCurrentYearParagraph, mainEl));
    }

    if (currentData.relations.length > 0) {
      const hapCount = currentData.relations.filter(r =>
        r.type === 'YUKHAP' || r.type === 'SAMHAP' || r.type === 'BANGHAP',
      ).length;
      const conflictCount = currentData.relations.filter(r =>
        r.type === 'CHUNG' || r.type === 'HYEONG' || r.type === 'PA' || r.type === 'HAE' || r.type === 'WONJIN',
      ).length;

      if (hapCount > 0 && conflictCount === 0) {
        paragraphs.push(positive(
          `올해 세운 지지와 원국 사이에 합(合) 관계가 ${hapCount}개 형성되어 있어요. ` +
          '역사의 동맹처럼, 주변 환경이 {{이름}}님을 도와주는 기운이 감돌고 있답니다.'.replace('{{이름}}', name),
        ));
      } else if (conflictCount > 0 && hapCount === 0) {
        paragraphs.push(caution(
          `올해 세운 지지와 원국 사이에 충돌 관계가 ${conflictCount}개 형성되어 있어요. ` +
          '역사의 전환기처럼, 변화의 에너지가 강한 해예요. 하지만 모든 혁명에는 새로운 시대가 뒤따르는 법이에요.',
        ));
      } else if (hapCount > 0 && conflictCount > 0) {
        paragraphs.push(narrative(
          `올해 세운 지지와 원국 사이에 합 ${hapCount}개, 충돌 관계 ${conflictCount}개가 공존하고 있어요. ` +
          '춘추전국시대처럼 합종연횡이 벌어지는 역동적인 한 해가 될 수 있어요.',
        ));
      }
    }

    // 신살 활성화 요약 (올해)
    const activeShinsals = currentData.shinsalActivations.filter(s => s.active);
    if (activeShinsals.length > 0) {
      paragraphs.push(emphasis('올해 활성화되는 신살'));
      for (const shinsal of activeShinsals) {
        const shinsalTip = rng.pick([
          `${shinsal.name}: ${shinsal.description}`,
          `올해 ${shinsal.name}이(가) 켜졌어요. ${shinsal.description}`,
        ]);
        paragraphs.push(tip(shinsalTip));
      }
    }
  }

  // ── 7-3-3. 전후 N년 개요 ────────────────────────────────────────────

  paragraphs.push(emphasis(`최근 ${saeunRange}년 ~ 향후 ${saeunRange}년 세운 흐름`));

  paragraphs.push(narrative(
    `역사학자가 시대의 흐름을 한눈에 보듯, ${startYear}년부터 ${endYear}년까지의 세운을 ` +
    '연대기(年代記)로 펼쳐볼게요.',
  ));

  // 각 연도 요약 (현재년은 이미 상세 분석했으므로 간략히)
  let bestGrade = 0;
  let worstGrade = 6;
  let bestYear = currentYear;
  let worstYear = currentYear;

  for (const data of yearlyDataList) {
    const year = data.fortune.year;
    const isCurrent = year === currentYear;
    const ganzi = data.fortune.ganzhiHangul;
    const mainEl = data.fortune.stemElement;
    const stars = YONGSHIN_GRADE_STARS[data.grade];
    const stemTG = tenGodKorean(data.stemTenGod);

    // 최고/최저 추적
    if (data.grade > bestGrade) { bestGrade = data.grade; bestYear = year; }
    if (data.grade < worstGrade) { worstGrade = data.grade; worstYear = year; }

    if (isCurrent) {
      // 현재년은 간략 표시 (상세 분석은 위에서 했음)
      paragraphs.push(emphasis(
        `${year}년 ${ganzi}(${data.fortune.ganzhiHanja}) — ${elFull(mainEl)} ${stars} ` +
        `[현재] 천간십성: ${stemTG}`,
      ));
    } else {
      // 과거/미래 연도 간략 해설
      const briefSentences: string[] = [];
      briefSentences.push(
        `${year}년 ${ganzi}(${data.fortune.ganzhiHanja}) — ${elFull(mainEl)}, ` +
        `용신 부합도 ${stars}, 천간 십성: ${stemTG}.`,
      );

      // 간략한 역사 비유
      briefSentences.push(
        pickAndFill(rng, GRADE_HISTORY_TEMPLATES[data.grade], { 이름: name }),
      );

      // 합충 있으면 한 줄 추가
      if (data.relations.length > 0) {
        const relTypes = Array.from(new Set(data.relations.map(r => {
          const typeMap: Record<string, string> = {
            YUKHAP: '육합', SAMHAP: '삼합', BANGHAP: '방합',
            CHUNG: '충', HYEONG: '형', PA: '파', HAE: '해', WONJIN: '원진',
          };
          return typeMap[r.type] ?? r.type;
        })));
        briefSentences.push(`원국과의 관계: ${relTypes.join(', ')}.`);
      }

      // 톤에 따라 다른 단락 유형
      if (data.grade >= 4) {
        paragraphs.push(positive(joinSentences(...briefSentences), mainEl));
      } else if (data.grade <= 2) {
        paragraphs.push(caution(joinSentences(...briefSentences), mainEl));
      } else {
        paragraphs.push(narrative(joinSentences(...briefSentences), mainEl));
      }
    }
  }

  // ── 7-3-4. 최고/최저 연도 요약 ──────────────────────────────────────

  if (yearlyDataList.length >= 3) {
    const bestData = yearlyDataList.find(d => d.fortune.year === bestYear);
    const worstData = yearlyDataList.find(d => d.fortune.year === worstYear);

    if (bestData && worstData && bestYear !== worstYear) {
      const summaryVariants: readonly string[] = [
        `역사의 연대기를 조망해보면, ${bestYear}년(${bestData.fortune.ganzhiHangul})이 르네상스처럼 가장 빛나는 해이고, ${worstYear}년(${worstData.fortune.ganzhiHangul})은 시련의 시기일 수 있어요. 하지만 시련 없는 역사가 없듯, 모든 시기가 성장의 일부랍니다.`,
        `전체 흐름에서 ${bestYear}년이 세종대왕 시대 같은 황금기이고, ${worstYear}년은 전환기에 해당해요. 전환기를 잘 보내는 것이 다음 황금기를 만드는 비결이에요.`,
        `${bestYear}년에 가장 좋은 기운이, ${worstYear}년에 도전적 기운이 감돌아요. 역사학자의 조언은 "좋을 때 준비하고, 어려울 때 버텨라"예요.`,
      ];
      paragraphs.push(emphasis(rng.pick(summaryVariants)));
    }
  }

  // ── 7-3-5. 마무리 ──────────────────────────────────────────────────

  paragraphs.push(encouraging(
    pickAndFill(rng, CLOSING_TEMPLATES, { 이름: name }),
  ));

  // ── 테이블: 세운 캘린더 ──────────────────────────────────────────────

  const tableRows: string[][] = yearlyDataList.map(data => {
    const year = data.fortune.year;
    const isCurrent = year === currentYear;
    const ganzi = data.fortune.ganzhiHangul;
    const hanja = data.fortune.ganzhiHanja;
    const stemEl = `${elShort(data.fortune.stemElement)}(${elHanja(data.fortune.stemElement)})`;
    const branchEl = `${elShort(data.fortune.branchElement)}(${elHanja(data.fortune.branchElement)})`;
    const stars = YONGSHIN_GRADE_STARS[data.grade];
    const stemTG = tenGodKorean(data.stemTenGod);
    const branchTG = tenGodKorean(data.branchTenGod);

    const relSummary = data.relations.length > 0
      ? Array.from(new Set(data.relations.map(r => {
          const map: Record<string, string> = {
            YUKHAP: '합', SAMHAP: '삼합', BANGHAP: '방합',
            CHUNG: '충', HYEONG: '형', PA: '파', HAE: '해', WONJIN: '원진',
          };
          return map[r.type] ?? r.type;
        }))).join('·')
      : '-';

    const shinsalSummary = data.shinsalActivations.filter(s => s.active).length > 0
      ? data.shinsalActivations.filter(s => s.active).map(s => s.name.replace(/\(.*\)/, '')).join('·')
      : '-';

    return [
      isCurrent ? `${year} (올해)` : String(year),
      `${ganzi}(${hanja})`,
      `${stemEl}/${branchEl}`,
      `${stemTG}/${branchTG}`,
      stars,
      relSummary,
      shinsalSummary,
    ];
  });

  const table: ReportTable = {
    title: '세운(歲運) 연대기',
    headers: ['연도', '간지', '천간/지지 오행', '천간/지지 십성', '용신부합도', '합충형파해', '신살'],
    rows: tableRows,
  };

  // ── 타임라인 차트 ─────────────────────────────────────────────────────

  const timelineData: Record<string, number | string> = {};
  for (const data of yearlyDataList) {
    const label = data.fortune.year === currentYear
      ? `${data.fortune.year}(올해) ${data.fortune.ganzhiHangul}`
      : `${data.fortune.year} ${data.fortune.ganzhiHangul}`;
    timelineData[label] = data.grade;
  }

  const chart: ReportChart = {
    type: 'line',
    title: '세운 용신부합도 흐름',
    data: timelineData,
    meta: {
      description: '최근 N년~향후 N년의 세운 용신 부합도를 시간 축 위에 표시합니다.',
      gradeLabels: {
        5: '르네상스',
        4: '성장기',
        3: '안정기',
        2: '전환기',
        1: '격동기',
      },
    },
  };

  // ── 하이라이트 ──────────────────────────────────────────────────────

  const currentData = currentIdx >= 0 ? yearlyDataList[currentIdx] : null;
  const highlights: ReportHighlight[] = [];

  if (currentData) {
    highlights.push({
      label: '올해 세운',
      value: `${currentData.fortune.ganzhiHangul}(${currentData.fortune.ganzhiHanja}) — ${elFull(currentData.fortune.stemElement)}`,
      element: currentData.fortune.stemElement,
      sentiment: currentData.grade >= 4 ? 'good' : currentData.grade <= 2 ? 'caution' : 'neutral',
    });

    highlights.push({
      label: '용신 부합도',
      value: `${YONGSHIN_GRADE_STARS[currentData.grade]} (${YONGSHIN_GRADE_DESC[currentData.grade]})`,
      sentiment: currentData.grade >= 4 ? 'good' : currentData.grade <= 2 ? 'caution' : 'neutral',
    });

    highlights.push({
      label: '천간 십성',
      value: `${tenGodKorean(currentData.stemTenGod)}(${tenGodHanja(currentData.stemTenGod)})`,
      sentiment: 'neutral',
    });

    const activeCount = currentData.shinsalActivations.filter(s => s.active).length;
    if (activeCount > 0) {
      highlights.push({
        label: '활성 신살',
        value: `${activeCount}개`,
        sentiment: 'caution',
      });
    }

    const relCount = currentData.relations.length;
    if (relCount > 0) {
      const hapRel = currentData.relations.filter(r =>
        r.type === 'YUKHAP' || r.type === 'SAMHAP' || r.type === 'BANGHAP',
      ).length;
      const chungRel = currentData.relations.filter(r =>
        r.type === 'CHUNG' || r.type === 'HYEONG' || r.type === 'PA' || r.type === 'HAE',
      ).length;
      highlights.push({
        label: '합충관계',
        value: `합 ${hapRel}개 / 충돌 ${chungRel}개`,
        sentiment: hapRel > chungRel ? 'good' : chungRel > hapRel ? 'caution' : 'neutral',
      });
    }
  }

  // 전체 기간 최고 연도
  if (bestGrade > 0) {
    const bestData = yearlyDataList.find(d => d.fortune.year === bestYear);
    if (bestData) {
      highlights.push({
        label: '최고의 해',
        value: `${bestYear}년 ${bestData.fortune.ganzhiHangul}`,
        element: bestData.fortune.stemElement,
        sentiment: 'good',
      });
    }
  }

  highlights.push({
    label: '분석 범위',
    value: `${startYear}~${endYear}년 (${yearlyDataList.length}년간)`,
    sentiment: 'neutral',
  });

  // ── 반환 ──────────────────────────────────────────────────────────────

  return {
    id: 'yearlyFortune',
    title: '세운(歲運) 분석',
    subtitle: '역사의 연대기로 읽는 올해의 기운 — 역사학자의 시선',
    paragraphs,
    tables: [table],
    charts: [chart],
    highlights,
  };
}
