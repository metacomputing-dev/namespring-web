import { Ohaeng } from '../domain/Ohaeng.js';
import { Sipseong } from '../domain/Sipseong.js';
import { SibiUnseong } from '../domain/SibiUnseong.js';
import { Gender } from '../domain/Gender.js';
import { CHEONGAN_INFO } from '../domain/Cheongan.js';
import { JIJI_INFO } from '../domain/Jiji.js';
import type { DaeunPillar } from '../domain/DaeunInfo.js';
import type { Pillar } from '../domain/Pillar.js';

const MONTH_LABELS: readonly string[] = [
  '', '인월(寅月\u00B72~3월)', '묘월(卯月\u00B73~4월)', '진월(辰月\u00B74~5월)', '사월(巳月\u00B75~6월)', '오월(午月\u00B76~7월)', '미월(未月\u00B77~8월)',
  '신월(申月\u00B78~9월)', '유월(酉月\u00B79~10월)', '술월(戌月\u00B710~11월)', '해월(亥月\u00B711~12월)', '자월(子月\u00B712~1월)', '축월(丑月\u00B71~2월)',
];

const THEME_DESC: Readonly<Record<Sipseong, string>> = {
  [Sipseong.BI_GYEON]: '비견운으로, 경쟁과 독립, 자기 확장의 에너지가 강한 해',
  [Sipseong.GYEOB_JAE]: '겁재운으로, 도전과 모험, 과감한 결단이 필요한 해',
  [Sipseong.SIK_SIN]: '식신운으로, 풍요와 안정, 기술력이 빛나는 해',
  [Sipseong.SANG_GWAN]: '상관운으로, 창의력과 표현력이 폭발하는 해',
  [Sipseong.PYEON_JAE]: '편재운으로, 사업과 투자 기회가 열리는 해',
  [Sipseong.JEONG_JAE]: '정재운으로, 꾸준한 노력이 결실을 맺는 해',
  [Sipseong.PYEON_GWAN]: '편관운으로, 도전과 경쟁이 치열한 해',
  [Sipseong.JEONG_GWAN]: '정관운으로, 승진과 인정의 기회가 있는 해',
  [Sipseong.PYEON_IN]: '편인운으로, 학습과 전문성이 깊어지는 해',
  [Sipseong.JEONG_IN]: '정인운으로, 교양과 지혜가 성장하는 해',
};

const CAREER_FORECAST: Readonly<Record<Sipseong, string>> = {
  [Sipseong.JEONG_GWAN]: '정관운으로 승진·인정·직위 상승의 기회가 있습니다. 조직에서 성과를 인정받는 해입니다.',
  [Sipseong.PYEON_GWAN]: '편관운으로 도전적인 업무와 경쟁이 있지만, 이를 극복하면 크게 성장합니다.',
  [Sipseong.SIK_SIN]: '식신운으로 기술력과 전문성이 인정받는 해입니다. 실력으로 승부하세요.',
  [Sipseong.SANG_GWAN]: '상관운으로 기존 틀을 벗어난 새로운 시도가 좋은 결과를 가져옵니다.',
  [Sipseong.JEONG_IN]: '정인운으로 학습·교육·멘토링 분야에서 기회가 옵니다. 자기계발에 투자하세요.',
  [Sipseong.PYEON_IN]: '편인운으로 전문 분야 연구와 독창적 아이디어가 빛나는 해입니다.',
  [Sipseong.PYEON_JAE]: '편재운으로 사업·투자·영업에서 기회가 많습니다. 적극적으로 움직이세요.',
  [Sipseong.JEONG_JAE]: '정재운으로 꾸준한 노력이 보상받는 해입니다. 안정적 직장에서 성과를 내세요.',
  [Sipseong.BI_GYEON]: '비견운으로 독립적 활동이나 경쟁적 환경에서 성과를 냅니다.',
  [Sipseong.GYEOB_JAE]: '겁재운으로 직업적 변동이 있을 수 있습니다. 이직보다 현 위치에서의 성장이 유리합니다.',
};

const MALE_SPOUSE_STARS: ReadonlySet<Sipseong> = new Set([Sipseong.PYEON_JAE, Sipseong.JEONG_JAE]);
const FEMALE_SPOUSE_STARS: ReadonlySet<Sipseong> = new Set([Sipseong.PYEON_GWAN, Sipseong.JEONG_GWAN]);

const LOVE_FORECAST: Readonly<Partial<Record<Sipseong, string>>> = {
  [Sipseong.SIK_SIN]: '식신운으로 편안하고 안정적인 연애 관계가 기대됩니다.',
  [Sipseong.SANG_GWAN]: '상관운으로 자유롭고 드라마틱한 연애가 예상됩니다. 감정 표현이 활발해집니다.',
  [Sipseong.BI_GYEON]: '비견운으로 대등한 파트너와의 만남이 가능합니다. 독립적 관계가 좋습니다.',
  [Sipseong.GYEOB_JAE]: '겁재운으로 이성 관계에서 경쟁이나 삼각관계에 주의하세요.',
  [Sipseong.PYEON_IN]: '편인운으로 정신적 교감이 깊은 관계에 집중하세요.',
  [Sipseong.JEONG_IN]: '정인운으로 안정적이고 신뢰할 수 있는 관계가 기대됩니다.',
};

export function monthLabel(sajuMonthIndex: number): string {
  return MONTH_LABELS[sajuMonthIndex] ?? `${sajuMonthIndex}월`;
}

export function buildOverview(
  year: number,
  sipseong: Sipseong,
  isYongshinElement: boolean,
  isGisinElement: boolean,
  currentDaeun: DaeunPillar | null,
): string {
  let text = `${year}년은 ${THEME_DESC[sipseong]}입니다. `;
  if (isYongshinElement) {
    text += '세운 오행이 용신과 일치하여 전반적으로 좋은 흐름이 기대됩니다. ';
  } else if (isGisinElement) {
    text += '세운 오행이 기신과 일치하여 신중한 대처가 필요한 해입니다. ';
  }
  if (currentDaeun) {
    const dp = currentDaeun;
    const ci = CHEONGAN_INFO[dp.pillar.cheongan];
    const ji = JIJI_INFO[dp.pillar.jiji];
    text += `현재 대운 ${ci.hangul}${ji.hangul}(${dp.startAge}~${dp.endAge}세)의 영향 아래에 있습니다.`;
  }
  return text;
}

export function buildWealthForecast(sipseong: Sipseong, isStrong: boolean): string {
  switch (sipseong) {
    case Sipseong.PYEON_JAE:
      return '편재운으로 큰 돈이 움직이는 해입니다. ' +
        (isStrong ? '적극적 투자와 사업 확장에 유리합니다.' : '신약한 일간이므로 과도한 투자는 삼가세요.');
    case Sipseong.JEONG_JAE:
      return '정재운으로 안정적 수입이 기대됩니다. 저축과 절약으로 재물이 쌓입니다.';
    case Sipseong.SIK_SIN:
    case Sipseong.SANG_GWAN:
      return '식상운으로 아이디어와 기술을 통한 수입 기회가 있습니다. 생재(生財)의 해입니다.';
    case Sipseong.BI_GYEON:
    case Sipseong.GYEOB_JAE:
      return '비겁운으로 재물 경쟁이 있을 수 있습니다. 동업이나 공동 투자에 주의하세요.';
    case Sipseong.PYEON_GWAN:
    case Sipseong.JEONG_GWAN:
      return '관성운으로 직업을 통한 안정적 수입이 기대됩니다. 사업보다 직장이 유리합니다.';
    case Sipseong.PYEON_IN:
    case Sipseong.JEONG_IN:
      return '인성운으로 학업·자격증 투자가 미래 재물의 기초가 됩니다. 당장의 수익보다 장기 투자가 유리합니다.';
    default:
      return '전반적으로 무난한 재물운입니다.';
  }
}

export function buildCareerForecast(sipseong: Sipseong): string {
  return CAREER_FORECAST[sipseong];
}

export function buildHealthForecast(saeunPillar: Pillar, sibiUnseong: SibiUnseong): string {
  const saeunOhaeng: Ohaeng = CHEONGAN_INFO[saeunPillar.cheongan].ohaeng;
  const ORGAN_WARNINGS: Record<Ohaeng, string> = {
    [Ohaeng.WOOD]: '간·담·근육·눈 관련 건강에 주의하세요.',
    [Ohaeng.FIRE]: '심장·혈액·눈·혈압 관련 건강에 주의하세요.',
    [Ohaeng.EARTH]: '위장·소화·피부 관련 건강에 주의하세요.',
    [Ohaeng.METAL]: '폐·호흡기·피부·대장 관련 건강에 주의하세요.',
    [Ohaeng.WATER]: '신장·방광·비뇨기 관련 건강에 주의하세요.',
  };

  let energyNote: string;
  if ([SibiUnseong.JANG_SAENG, SibiUnseong.GEON_ROK, SibiUnseong.JE_WANG].includes(sibiUnseong)) {
    energyNote = '에너지가 충만한 해로 활동적 생활이 가능합니다.';
  } else if ([SibiUnseong.GWAN_DAE, SibiUnseong.MOK_YOK].includes(sibiUnseong)) {
    energyNote = '에너지가 상승하는 해로 새로운 운동을 시작하기 좋습니다.';
  } else if ([SibiUnseong.SWOE, SibiUnseong.BYEONG].includes(sibiUnseong)) {
    energyNote = '에너지가 하강하는 해로 무리하지 말고 건강관리에 신경 쓰세요.';
  } else if ([SibiUnseong.SA, SibiUnseong.MYO].includes(sibiUnseong)) {
    energyNote = '에너지가 낮은 해로 충분한 휴식과 정기 검진이 필요합니다.';
  } else {
    energyNote = '새로운 시작의 에너지로, 과거 습관을 버리고 새로운 건강 루틴을 만들어보세요.';
  }

  return `${energyNote} ${ORGAN_WARNINGS[saeunOhaeng]}`;
}

export function buildLoveForecast(sipseong: Sipseong, gender: Gender): string {
  const spouseStar = gender === Gender.MALE ? MALE_SPOUSE_STARS : FEMALE_SPOUSE_STARS;

  if (spouseStar.has(sipseong)) {
    return '배우자 십성이 들어오는 해로 이성 인연이 강합니다. ' +
      (gender === Gender.MALE ? '만남의 기회를 적극적으로 만드세요.' : '좋은 인연을 만날 가능성이 높습니다.');
  }

  return LOVE_FORECAST[sipseong] ?? '전반적으로 무난한 연애운입니다. 용신 오행이 강한 달에 만남의 기회가 옵니다.';
}
