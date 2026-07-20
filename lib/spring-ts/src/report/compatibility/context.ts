/**
 * 짝의 맥락(나이·관계 프레임) 파생.
 *
 * 궁합의 계산 축은 관계와 무관하게 같지만, 카피의 프레임은 관계와 나이에서
 * 결정된다 — 성인 연인에게는 배우자궁·배우자성의 언어를, 아이가 포함된
 * 짝에게는 돌봄·성장·우정의 언어를 쓴다. 이 파일은 그 프레임 판정과,
 * 동갑·띠동갑·네 살 차 삼합 같은 나이 속설의 정직한 읽기를 담당한다.
 *
 * 원칙:
 *  - 결정론. 나이는 각 delivery의 anchorDate(기준일)만 보고 계산하고,
 *    Date.now() 같은 실행 시각은 절대 쓰지 않는다.
 *  - 생년월일이 없으면 나이 관련 값을 null로 두고 지어내지 않는다.
 *  - 미성년자가 포함되면 요청과 무관하게 연애 프레임을 쓰지 않는다.
 */
import type { ColoredAnimalV1 } from '../zodiac.js';
import { euRo } from './copy-bundles.js';
import type {
  BranchPairRelationV1,
  CompatAgeBandV1,
  CompatFramingV1,
  CompatRelationshipV1,
  CoupleCompatibilityRequestV1,
  PairContextFactV1,
} from './types.js';

/** 띠 이름을 문장에 넣을 때의 짧은 표기 (색+동물, 색 없으면 동물). */
function zodiacKo(zodiac: ColoredAnimalV1 | null): string | null {
  if (!zodiac) return null;
  return zodiac.color ? zodiac.label : zodiac.animal;
}

/* ================================================================== */
/* 나이 계산                                                            */
/* ================================================================== */

export interface BirthYmd {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** 'YYYY-MM-DD' ISO 날짜를 문자열 연산만으로 파싱한다 (타임존 무관). */
function parseIsoDate(iso: string): BirthYmd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(iso);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/** anchor 기준 만 나이. 생일이 아직 지나지 않았으면 한 살을 뺀다. */
function fullAgeAt(birth: BirthYmd, anchor: BirthYmd): number {
  let age = anchor.year - birth.year;
  if (
    anchor.month < birth.month
    || (anchor.month === birth.month && anchor.day < birth.day)
  ) {
    age -= 1;
  }
  return age;
}

/** 나이대: 14세 미만 아이, 14~18 청소년, 19~64 성인, 65+ 시니어. */
function bandOf(age: number): CompatAgeBandV1 {
  if (age < 14) return 'child';
  if (age <= 18) return 'teen';
  if (age <= 64) return 'adult';
  return 'senior';
}

/* ================================================================== */
/* 짝 맥락 fact 파생                                                    */
/* ================================================================== */

/** derivePairContext에 빌더가 delivery facts에서 파생해 넘기는 보조 근거. */
export interface PairContextEvidence {
  /**
   * 두 사람의 실제 년지(띠)가 같은가. 년지 정보가 한쪽이라도 없으면 null.
   * 띠동갑 판정은 달력 나이차만으로 하지 않고 실제 년지 일치를 요구한다.
   */
  readonly sameYearBranch?: boolean | null;
  /**
   * delivery의 time_correction fact가 준 양력(태양력) 기준 생년월일.
   * 있으면 호출자가 넘긴 birth보다 우선한다 — 음력 입력의 원본 연도가
   * 나이 셈을 흔드는 것을 막는다.
   */
  readonly birthA?: BirthYmd | null;
  readonly birthB?: BirthYmd | null;
}

/**
 * 요청과 anchorDate에서 짝의 맥락 fact를 결정론적으로 파생한다.
 *
 * 프레임 규칙(우선순위 순):
 *  1. 둘 다 아이            → 'kids'
 *  2. 한쪽만 아이           → 'guardian' (돌봄 프레임은 아이가 포함될 때만)
 *  3. 아이·청소년이 포함되면 요청과 무관하게 'couple' 금지 → 'companion'
 *  4. 성인끼리 romance 요청  → 'couple'
 *  5. 그 밖의 모든 경우      → 'companion'
 *     (family + 18년 이상 차이의 성인 짝은 guardian이 아니라 companion —
 *      양육의 언어 대신 돌봄의 결 노트만 한 줄 얹는다.)
 *
 * 생년월일이 없으면 나이 값은 null로 두고, 프레임은 요청된 관계를
 * 존중한다(호출자의 선언을 신뢰) — 미성년 판정은 근거가 있을 때만 한다.
 */
export function derivePairContext(
  request: CoupleCompatibilityRequestV1,
  evidence: PairContextEvidence = {},
): PairContextFactV1 {
  const requestedRelationship: CompatRelationshipV1 =
    request.relationship ?? 'unspecified';
  const anchor = parseIsoDate(request.a.delivery.anchorDate);

  const birthA = evidence.birthA ?? request.a.birth ?? null;
  const birthB = evidence.birthB ?? request.b.birth ?? null;

  const ageA = birthA && anchor ? fullAgeAt(birthA, anchor) : null;
  const ageB = birthB && anchor ? fullAgeAt(birthB, anchor) : null;
  const bandA = ageA != null ? bandOf(ageA) : null;
  const bandB = ageB != null ? bandOf(ageB) : null;

  /**
   * 나이차는 태어난 해의 차이(연 나이 차)로 센다 — 동갑·띠동갑·네 살 차
   * 같은 속설이 모두 "해"의 언어이기 때문이다. 만 나이 차로 세면 생일에
   * 따라 11·13이 되어 띠동갑 판정이 흔들린다.
   */
  const ageGapYears =
    birthA && birthB ? Math.abs(birthA.year - birthB.year) : null;
  const olderPerson: PairContextFactV1['olderPerson'] =
    birthA && birthB
      ? birthA.year < birthB.year
        ? 'a'
        : birthB.year < birthA.year
          ? 'b'
          : 'same'
      : null;
  const sameAge = ageGapYears != null ? ageGapYears === 0 : null;
  // 띠동갑은 "12년 차 + 실제 년지 일치"일 때만 참이다. 입춘 전 출생처럼
  // 달력 연도와 사주 년지가 어긋나는 경우, 년지가 다르면 false,
  // 년지를 모르면 null로 두고 지어내지 않는다.
  const sameYearBranch = evidence.sameYearBranch ?? null;
  const twelveGapSameZodiac =
    ageGapYears != null
      ? ageGapYears > 0 && ageGapYears % 12 === 0
        ? sameYearBranch
        : false
      : null;

  const childInvolved = bandA === 'child' || bandB === 'child';
  const teenInvolved = bandA === 'teen' || bandB === 'teen';

  let framing: CompatFramingV1;
  if (bandA === 'child' && bandB === 'child') {
    framing = 'kids';
  } else if (childInvolved) {
    framing = 'guardian';
  } else if (teenInvolved) {
    // 청소년 포함: 연애 프레임 금지. 아이가 없으므로 양육 프레임도 쓰지 않는다.
    framing = 'companion';
  } else if (requestedRelationship === 'romance') {
    framing = 'couple';
  } else {
    // 성인끼리의 가족은 나이차가 커도 어른-아이 양육 프레임이 아니다 —
    // companion으로 읽고, 돌봄의 결은 buildContextNotes가 한 줄로 얹는다.
    framing = 'companion';
  }

  return {
    id: 'compat.pair-context',
    kind: 'pair_context',
    domain: 'cross',
    method: 'spring-ts.couple-pair-context.v1',
    requestedRelationship,
    // 호출자가 붙인 상세 라벨·결은 그대로 되울린다 — 없으면 정직하게 null.
    relationshipLabel: request.relationshipLabel ?? null,
    relationshipTone: request.relationshipTone ?? null,
    framing,
    ageA,
    ageB,
    ageGapYears,
    olderPerson,
    sameAge,
    twelveGapSameZodiac,
    bandA,
    bandB,
    childInvolved,
  };
}

/* ================================================================== */
/* 맥락 읽기 문장                                                       */
/* ================================================================== */

const TURN_KO: Record<number, string> = { 1: '한 바퀴', 2: '두 바퀴', 3: '세 바퀴' };

/**
 * 짝 맥락의 해석 문장들 (interpretive).
 *
 * 동갑·띠동갑·네 살 차 삼합·여섯 살 차 충 같은 나이 속설을 실제 띠 관계와
 * 대조해 정직하게 읽고, 아이가 포함된 짝에는 프레임 안내를 앞세운다.
 * 해당 사항이 없으면 빈 배열을 돌려준다.
 *
 * @param yearBranchRelations 년지↔년지 쌍의 관계 목록 (빌더가 이미 계산한
 *   branch_pair fact의 relations). 년지 정보가 없으면 null.
 */
export function buildContextNotes(
  fact: PairContextFactV1,
  aName: string,
  bName: string,
  yearBranchRelations: readonly BranchPairRelationV1[] | null,
  zodiacA: ColoredAnimalV1 | null = null,
  zodiacB: ColoredAnimalV1 | null = null,
  // 사주(일간의 만남)·이름(소리·어울림)의 한 줄 서사 — 축 헤드라인을 그대로 끌어와,
  // '자리' 카드가 띠 이야기에만 치우치지 않고 사주·이름까지 고르게 담게 한다.
  sajuMeetLine: string | null = null,
  nameMeetLine: string | null = null,
): string[] {
  const notes: string[] = [];
  const gap = fact.ageGapYears;
  // 두 사람의 띠를 문장에 자연스럽게 끼울 때 쓰는 짧은 표기 (예: '흰 말과 검은 쥐').
  const zA = zodiacKo(zodiacA);
  const zB = zodiacKo(zodiacB);
  const bothZodiac = zA && zB ? `${aName}님은 ${zA}띠, ${bName}님은 ${zB}띠 — ` : '';
  const bothAdult =
    (fact.bandA === 'adult' || fact.bandA === 'senior')
    && (fact.bandB === 'adult' || fact.bandB === 'senior');
  // guardian 짝에서 나이 위쪽이 미성년(청소년)이면 '어른'이라 부르지 않는다.
  const elderBand =
    fact.olderPerson === 'a' ? fact.bandA : fact.olderPerson === 'b' ? fact.bandB : null;
  const elderIsMinor = elderBand === 'teen' || elderBand === 'child';

  /* --- 관계 라벨: 짝이 스스로 붙인 이름을 첫 문장이 그대로 되울린다 --- */
  const label = fact.relationshipLabel ?? null;
  const labelSentence = label
    ? `두 분의 자리를 '${label}'${euRo(label)} 읽었어요.`
    : null;

  /* --- 프레임 안내: 아이가 포함된 짝은 읽는 잣대부터 바꿔 준다.
   *     라벨이 있으면 해당 프레임 안내의 첫 문장으로 자연스럽게 엮는다. --- */
  if (fact.framing === 'kids') {
    notes.push(
      (labelSentence ? `${labelSentence} ` : '')
      + '아이들의 짝은 연애의 잣대가 아니라 기질과 우정의 잣대로 읽어요. '
      + `${aName}님과 ${bName}님이 어떤 결로 어울리고 어디서 부딪히기 쉬운지, `
      + '곁에서 지켜보는 어른의 관전 포인트로 삼아 주세요.',
    );
  } else if (fact.framing === 'guardian') {
    notes.push(
      (labelSentence ? `${labelSentence} ` : '')
      + (elderIsMinor
        ? '손위와 손아래의 짝은 좋고 나쁨의 잣대가 아니라 돌봄과 성장의 궁합으로 읽어요. '
        : '어른과 아이의 짝은 좋고 나쁨의 잣대가 아니라 돌봄과 성장의 궁합으로 읽어요. ')
      + '아래의 축들도 "잘 맞는가"보다 "어떻게 이끌어 주고 어떻게 함께 자라는가"의 언어로 읽어 주세요.',
    );
  } else if (labelSentence) {
    // 프레임 안내가 없는 짝(couple·companion)은 라벨 문장을 첫 노트로 세운다.
    notes.push(`${labelSentence} 아래의 풀이도 그 자리에 맞는 말로 골라 두었어요.`);
  }
  if (fact.requestedRelationship === 'romance' && fact.framing !== 'couple') {
    notes.push(
      '요청해 주신 관계는 연인이었지만, 아직 어린 분이 함께 있어 이 리포트는 관계의 프레임을 우정과 성장의 언어로 바꿔 읽었어요.',
    );
  }

  /* --- 사주·이름의 자리: 띠 이야기에 앞서 두 축의 만남을 한 줄씩 짚는다 --- */
  if (sajuMeetLine) notes.push(`사주로 보면 — ${sajuMeetLine}`);
  if (nameMeetLine) notes.push(`이름으로 보면 — ${nameMeetLine}`);

  /* --- 나이의 결: 동갑·속설·띠동갑·세대 차 --- */
  if (fact.sameAge === true) {
    notes.push(
      `두 분은 같은 해를 살아온 동갑내기예요. 같은 시절의 공기를 나눠 마신 사이라, 말하지 않아도 통하는 편안함이 이 인연의 밑바탕이 돼요.`,
    );
  }
  if (gap === 4 && yearBranchRelations?.includes('samhap')) {
    // 혼인 속설("궁합도 안 본다")은 성인 연애·부부 프레임에서만 인용한다.
    // companion에는 중립적인 삼합 어울림 문장만, kids·guardian에는 아무것도 얹지 않는다.
    if (fact.framing === 'couple') {
      notes.push(
        `"네 살 차이는 궁합도 안 본다"는 옛말이 있지요. ${bothZodiac}네 살 차이의 두 띠는 실제로 `
        + '삼합(三合)의 짝이에요. 삼합은 세 지지가 한 오행 방향으로 힘을 모으는 강한 어울림이라, '
        + '이 속설에는 명리의 근거가 실제로 있어요. 두 분이 바로 그 배치라, 뜻과 방향이 잘 맞고 '
        + '한번 마음이 통하면 오래 함께 밀고 가는 힘이 있는 짝이에요. 다만 방향이 같은 만큼 서로 '
        + '너무 닮아 새로움이 옅어질 수 있으니, 각자의 다른 취향 하나쯤은 남겨 두면 좋아요.',
      );
    } else if (fact.framing === 'companion') {
      notes.push(
        `${bothZodiac}네 살 차이의 두 띠는 실제로 삼합(三合)의 자리에 있어요. 같은 오행 방향으로 `
        + '힘을 모으는 배치라 뜻과 목표가 같은 쪽을 보고, 함께 무언가를 도모할 때 손발이 잘 맞아요. '
        + '역할만 또렷이 나눠 두면 오래가는 동반이 돼요.',
      );
    }
  }
  if (gap === 6 && yearBranchRelations?.includes('chung')) {
    notes.push(
      `여섯 살 차이를 꺼리는 속설이 있어요. ${bothZodiac}두 분의 띠는 실제로 충(沖) — 정반대 자리에서 `
      + '마주 보는 배치예요. 하지만 충은 이별의 선고가 아니라 서로를 흔들어 깨우는 변화의 힘이에요. '
      + '한쪽이 놓친 것을 다른 쪽이 정확히 짚어 주는 사이라, 다름을 공격이 아니라 보완으로 받아들이고 '
      + '부딪히는 지점에 작은 규칙 하나를 정해 두면 오히려 서로를 가장 크게 키우는 짝이 돼요.',
    );
  }
  if (fact.twelveGapSameZodiac === true && gap != null) {
    const turns = gap / 12;
    const turnKo = TURN_KO[turns] ?? `${turns} 바퀴`;
    const sameZodiacName = zA ? `같은 ${zA}띠` : '같은 띠';
    notes.push(
      turns === 1
        ? `두 분은 열두 해를 사이에 둔 띠동갑이에요. 띠가 한 바퀴 돌아 ${sameZodiacName}로 같은 자리에서 `
          + '다시 만난 인연이라, 기질의 밑바탕이 닮았어요. 말하지 않아도 서로의 결이 익숙한 편안함이 '
          + '있는 대신, 닮은 만큼 같은 약점도 겹치기 쉬우니 한 사람이 조심스러울 때 다른 사람이 밀어 '
          + '주는 식으로 번갈아 중심을 잡아 주면 좋아요.'
        : `두 분은 띠가 ${turnKo}를 돌아 ${sameZodiacName}로 같은 자리에서 만난 띠동갑이에요. 같은 띠의 `
          + '닮은 기질을 서로 다른 시절의 눈으로 나누게 되는, 시간을 건너는 인연이라 한쪽의 경험이 '
          + '다른 쪽에게 그대로 길잡이가 돼요.',
    );
  }
  if (gap != null && gap >= 15 && bothAdult) {
    notes.push(
      '두 분은 세대를 건너 만난 인연이에요. 한 분의 경험과 한 분의 새로움이 서로에게 선물이 되는 짝이니, 삶의 속도가 다름을 존중해 주는 것이 이 인연을 아름답게 해요.',
    );
  }

  /* --- 관계의 결(tone): 위계·돌봄의 자리에는 맞는 지혜를 한 줄 얹는다.
   *     peer는 기본 결이라 따로 문장을 더하지 않는다.
   *     성인 가족의 큰 나이차(18년 이상)는 guardian 프레임 대신
   *     companion + 돌봄의 결 한 줄로 읽는다. --- */
  const familyElderCare =
    fact.framing === 'companion'
    && fact.requestedRelationship === 'family'
    && gap != null
    && gap >= 18;
  if (fact.relationshipTone === 'hierarchy') {
    notes.push(
      '위계가 있는 자리일수록 합은 신뢰를 쌓는 데 쓰고, 충은 절차와 예의로 다듬는 것이 지혜예요.',
    );
  } else if (fact.relationshipTone === 'care' || familyElderCare) {
    notes.push(
      '돌봄이 흐르는 자리는 주고받음이 한쪽으로 기울기 마련이에요 — 받는 쪽의 작은 표현이 그 기울기를 균형으로 바꿔 줘요.',
    );
  }

  return notes;
}
