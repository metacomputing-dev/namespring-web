import { Cheongan, CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { Jiji } from '../../domain/Jiji.js';
import { Ohaeng, ohaengKoreanLabel } from '../../domain/Ohaeng.js';
import { registerJohuCatalog, type JohuCatalogEntry } from './JohuCatalog.js';

export interface JohuEntry {
  readonly primary: Ohaeng;
  readonly secondary: Ohaeng | null;
  readonly note: string;
}

type SeasonType = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';

const SEASON_BY_BRANCH: Readonly<Record<Jiji, SeasonType>> = {
  [Jiji.IN]: 'SPRING',
  [Jiji.MYO]: 'SPRING',
  [Jiji.JIN]: 'SPRING',
  [Jiji.SA]: 'SUMMER',
  [Jiji.O]: 'SUMMER',
  [Jiji.MI]: 'SUMMER',
  [Jiji.SIN]: 'AUTUMN',
  [Jiji.YU]: 'AUTUMN',
  [Jiji.SUL]: 'AUTUMN',
  [Jiji.HAE]: 'WINTER',
  [Jiji.JA]: 'WINTER',
  [Jiji.CHUK]: 'WINTER',
};

const SEASON_DESCRIPTION: Readonly<Record<Jiji, string>> = {
  [Jiji.IN]: '인월(초봄)',
  [Jiji.MYO]: '묘월(중봄)',
  [Jiji.JIN]: '진월(늦봄)',
  [Jiji.SA]: '사월(초여름)',
  [Jiji.O]: '오월(한여름)',
  [Jiji.MI]: '미월(늦여름)',
  [Jiji.SIN]: '신월(초가을)',
  [Jiji.YU]: '유월(중가을)',
  [Jiji.SUL]: '술월(늦가을)',
  [Jiji.HAE]: '해월(초겨울)',
  [Jiji.JA]: '자월(한겨울)',
  [Jiji.CHUK]: '축월(늦겨울)',
};

const STEM_DESCRIPTION: Readonly<Record<Cheongan, string>> = {
  [Cheongan.GAP]: '갑목(甲木, 양목/큰 나무)',
  [Cheongan.EUL]: '을목(乙木, 음목/화초)',
  [Cheongan.BYEONG]: '병화(丙火, 양화/태양)',
  [Cheongan.JEONG]: '정화(丁火, 음화/촛불)',
  [Cheongan.MU]: '무토(戊土, 양토/산)',
  [Cheongan.GI]: '기토(己土, 음토/밭)',
  [Cheongan.GYEONG]: '경금(庚金, 양금/쇠)',
  [Cheongan.SIN]: '신금(辛金, 음금/보석)',
  [Cheongan.IM]: '임수(壬水, 양수/강)',
  [Cheongan.GYE]: '계수(癸水, 음수/이슬)',
};

const PRIMARY_REASONING_TEMPLATES: Readonly<Record<Ohaeng, Readonly<Record<SeasonType, string>>>> = {
  [Ohaeng.WOOD]: {
    SPRING: '{primary}로 뿌리에 자양분을 공급하여 성장을 도움',
    SUMMER: '{primary}로 뜨거운 기운을 식혀 목이 마르지 않도록 보호',
    AUTUMN: '금왕(金旺)의 계절에 {primary}로 금의 극을 완화',
    WINTER: '추운 계절에 {primary}로 보온하여 목의 생기를 유지',
  },
  [Ohaeng.FIRE]: {
    SPRING: '{primary}로 화를 생(生)하여 봄의 기운을 이어받음',
    SUMMER: '화왕(火旺)의 계절에 {primary}로 과열을 방지',
    AUTUMN: '가을에 약해지는 화를 {primary}로 생(生)하여 유지',
    WINTER: '추운 계절에 {primary}로 화의 연료를 공급하여 꺼지지 않도록 함',
  },
  [Ohaeng.EARTH]: {
    SPRING: '봄에 목의 극(剋)을 받는 토를 {primary}로 보호',
    SUMMER: '더운 계절에 {primary}로 건조한 토를 적셔 생기를 부여',
    AUTUMN: '가을에 금으로 기운이 빠지는 토를 {primary}로 보강',
    WINTER: '추운 계절에 {primary}로 얼어붙은 토를 녹여 활력을 회복',
  },
  [Ohaeng.METAL]: {
    SPRING: '봄에 약해지는 금을 {primary}로 단련하여 쓸모있게 함',
    SUMMER: '더운 계절에 {primary}로 달구어진 금을 식힘',
    AUTUMN: '금왕(金旺)의 계절에 {primary}로 제련하여 날카롭게 함',
    WINTER: '추운 계절에 {primary}로 얼어붙은 금에 생기를 부여',
  },
  [Ohaeng.WATER]: {
    SPRING: '봄에 흩어지는 수를 {primary}로 따뜻하게 하여 활력 부여',
    SUMMER: '더운 계절에 {primary}로 증발하는 수의 수원을 보충',
    AUTUMN: '가을에 금생수(金生水)와 함께 {primary}로 균형 유지',
    WINTER: '수왕(水旺)의 계절에 {primary}로 보온하여 얼지 않도록 함',
  },
};

const MONTH_BRANCHES: readonly Jiji[] = [
  Jiji.IN, Jiji.MYO, Jiji.JIN, Jiji.SA, Jiji.O, Jiji.MI,
  Jiji.SIN, Jiji.YU, Jiji.SUL, Jiji.HAE, Jiji.JA, Jiji.CHUK,
] as const;

type TableKey = `${Cheongan}:${Jiji}`;

function tableKey(dayMaster: Cheongan, monthBranch: Jiji): TableKey {
  return `${dayMaster}:${monthBranch}`;
}

function buildRow(
  map: Map<TableKey, JohuEntry>,
  dayMaster: Cheongan,
  entries: readonly JohuCatalogEntry[],
): void {
  if (entries.length !== MONTH_BRANCHES.length) {
    throw new Error(
      `Expected ${MONTH_BRANCHES.length} entries for ${dayMaster}, got ${entries.length}`,
    );
  }
  MONTH_BRANCHES.forEach((branch, index) => {
    map.set(tableKey(dayMaster, branch), entries[index]!);
  });
}

function buildTable(): Map<TableKey, JohuEntry> {
  const map = new Map<TableKey, JohuEntry>();
  registerJohuCatalog((dayMaster, entries) => {
    buildRow(map, dayMaster, entries);
  });
  return map;
}

function primaryReasoning(stem: Cheongan, month: Jiji, primary: Ohaeng): string {
  const stemOhaeng = CHEONGAN_INFO[stem].ohaeng;
  const season = SEASON_BY_BRANCH[month];
  const template = PRIMARY_REASONING_TEMPLATES[stemOhaeng][season];
  return template.replace('{primary}', ohaengKoreanLabel(primary));
}

function secondaryReasoning(secondary: Ohaeng): string {
  return `보조로 ${ohaengKoreanLabel(secondary)}을(를) 취하여 조화를 이룸.`;
}

const TABLE: ReadonlyMap<TableKey, JohuEntry> = buildTable();

export const JohuTable = {
  lookup(dayMaster: Cheongan, monthBranch: Jiji): JohuEntry {
    const entry = TABLE.get(tableKey(dayMaster, monthBranch));
    if (!entry) {
      throw new Error(
        `Missing JohuTable entry for dayMaster=${dayMaster}, monthBranch=${monthBranch}`,
      );
    }
    return entry;
  },

  reasoning(dayMaster: Cheongan, monthBranch: Jiji): string {
    const entry = JohuTable.lookup(dayMaster, monthBranch);
    const primaryReasonStr = primaryReasoning(dayMaster, monthBranch, entry.primary);
    const secondaryReasonStr = entry.secondary != null ? ` ${secondaryReasoning(entry.secondary)}` : '';
    return `${STEM_DESCRIPTION[dayMaster]}이(가) ${SEASON_DESCRIPTION[monthBranch]}에 태어남: ` +
      `${primaryReasonStr}${secondaryReasonStr}`;
  },
} as const;
