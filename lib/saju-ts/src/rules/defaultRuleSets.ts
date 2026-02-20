import type { Rule, RuleSet } from './dsl.js';
import {
  buildBranchPresenceRules,
  buildCatalogDayPillarRules,
  buildCatalogDayStemRules,
  buildCatalogMonthBranchBranchRules,
  buildCatalogMonthBranchStemRules,
  buildPillarBranchInListRules,
  buildRelationSalRules,
} from './shinsalRuleCompiler.js';

export const DEFAULT_YONGSHIN_RULESET: RuleSet = {
  id: 'yongshin.base',
  version: '0.1',
  description: 'Optional school-specific adjustments for yongshin scoring (base model is math-first).',
  rules: [
    // Example adjustment (disabled by default): if a config flag is set in facts, boost WATER slightly.
    // { id: 'EXAMPLE', when: { op: 'eq', args: [{ var: 'config.example' }, true] }, score: { 'yongshin.WATER': 0.2 } },
  ],
};

export const DEFAULT_GYEOKGUK_RULESET: RuleSet = {
  id: 'gyeokguk.monthGyeokTenGod.quality',
  version: '0.4',
  description:
    'Month “gyeok”(透干/会支) ten-god → gyeokguk baseline with quality multiplier (清濁/破格). Includes optional high-level pattern keys (化气/专旺) as continuous signals.',
  rules: [
    { id: 'GYEOK_JEONG_GWAN', when: { op: 'eq', args: [{ var: 'month.gyeok.tenGod' }, 'JEONG_GWAN'] }, score: { 'gyeokguk.JEONG_GWAN': { op: 'mul', args: [1, { var: 'month.gyeok.quality.multiplier' }] } }, explain: '월지 격=정관 → 정관격(기초×품질)' },
    { id: 'GYEOK_PYEON_GWAN', when: { op: 'eq', args: [{ var: 'month.gyeok.tenGod' }, 'PYEON_GWAN'] }, score: { 'gyeokguk.PYEON_GWAN': { op: 'mul', args: [1, { var: 'month.gyeok.quality.multiplier' }] } }, explain: '월지 격=편관 → 편관격(기초×품질)' },
    { id: 'GYEOK_JEONG_JAE', when: { op: 'eq', args: [{ var: 'month.gyeok.tenGod' }, 'JEONG_JAE'] }, score: { 'gyeokguk.JEONG_JAE': { op: 'mul', args: [1, { var: 'month.gyeok.quality.multiplier' }] } }, explain: '월지 격=정재 → 정재격(기초×품질)' },
    { id: 'GYEOK_PYEON_JAE', when: { op: 'eq', args: [{ var: 'month.gyeok.tenGod' }, 'PYEON_JAE'] }, score: { 'gyeokguk.PYEON_JAE': { op: 'mul', args: [1, { var: 'month.gyeok.quality.multiplier' }] } }, explain: '월지 격=편재 → 편재격(기초×품질)' },
    { id: 'GYEOK_SIK_SHIN', when: { op: 'eq', args: [{ var: 'month.gyeok.tenGod' }, 'SIK_SHIN'] }, score: { 'gyeokguk.SIK_SHIN': { op: 'mul', args: [1, { var: 'month.gyeok.quality.multiplier' }] } }, explain: '월지 격=식신 → 식신격(기초×품질)' },
    { id: 'GYEOK_SANG_GWAN', when: { op: 'eq', args: [{ var: 'month.gyeok.tenGod' }, 'SANG_GWAN'] }, score: { 'gyeokguk.SANG_GWAN': { op: 'mul', args: [1, { var: 'month.gyeok.quality.multiplier' }] } }, explain: '월지 격=상관 → 상관격(기초×품질)' },
    { id: 'GYEOK_JEONG_IN', when: { op: 'eq', args: [{ var: 'month.gyeok.tenGod' }, 'JEONG_IN'] }, score: { 'gyeokguk.JEONG_IN': { op: 'mul', args: [1, { var: 'month.gyeok.quality.multiplier' }] } }, explain: '월지 격=정인 → 정인격(기초×품질)' },
    { id: 'GYEOK_PYEON_IN', when: { op: 'eq', args: [{ var: 'month.gyeok.tenGod' }, 'PYEON_IN'] }, score: { 'gyeokguk.PYEON_IN': { op: 'mul', args: [1, { var: 'month.gyeok.quality.multiplier' }] } }, explain: '월지 격=편인 → 편인격(기초×품질)' },
    { id: 'GYEOK_BI_GYEON', when: { op: 'eq', args: [{ var: 'month.gyeok.tenGod' }, 'BI_GYEON'] }, score: { 'gyeokguk.BI_GYEON': { op: 'mul', args: [1, { var: 'month.gyeok.quality.multiplier' }] } }, explain: '월지 격=비견 → 비견격(기초×품질)' },
    { id: 'GYEOK_GEOB_JAE', when: { op: 'eq', args: [{ var: 'month.gyeok.tenGod' }, 'GEOB_JAE'] }, score: { 'gyeokguk.GEOB_JAE': { op: 'mul', args: [1, { var: 'month.gyeok.quality.multiplier' }] } }, explain: '월지 격=겁재 → 겁재격(기초×품질)' },

    // --- High-level patterns (math-first continuous signals)
    {
      id: 'GYEOK_HUA_QI',
      when: {
        op: 'gte',
        args: [
          {
            op: 'if',
            args: [
              { op: 'gt', args: [{ var: 'patterns.transformations.best.huaqiFactor' }, 0] },
              { var: 'patterns.transformations.best.huaqiFactor' },
              { var: 'patterns.transformations.best.effectiveFactor' },
            ],
          },
          0.6,
        ],
      },
      score: {
        'gyeokguk.HUA_QI': {
          op: 'mul',
          args: [
            {
              op: 'if',
              args: [
                { op: 'gt', args: [{ var: 'patterns.transformations.best.huaqiFactor' }, 0] },
                { var: 'patterns.transformations.best.huaqiFactor' },
                { var: 'patterns.transformations.best.effectiveFactor' },
              ],
            },
            0.85,
          ],
        },
      },
      explain: '합화(化气) 신호가 강하면 “화기격” 후보를 가산(연속값 factor×0.85)',
      tags: ['PATTERN', 'HUA_QI'],
    },
    {
      id: 'GYEOK_ZHUAN_WANG',
      when: {
        op: 'and',
        args: [
          { op: 'gte', args: [{ var: 'patterns.elements.oneElement.factor' }, 0.62] },
          { op: 'gte', args: [{ var: 'strength.index' }, 0] },
        ],
      },
      score: {
        'gyeokguk.ZHUAN_WANG': {
          op: 'mul',
          args: [
            {
              op: 'if',
              args: [
                { op: 'gt', args: [{ var: 'patterns.elements.oneElement.zhuanwangFactor' }, 0] },
                { var: 'patterns.elements.oneElement.zhuanwangFactor' },
                { var: 'patterns.elements.oneElement.factor' },
              ],
            },
            0.85,
          ],
        },
      },
      explain: '일행득기/专旺(편중) 신호 + 신강(>=0)일 때 “专旺格” 후보를 가산(가능하면 zhuanwangFactor×0.85, 없으면 factor×0.85)',
      tags: ['PATTERN', 'ZHUAN_WANG'],
    },
    {
      id: 'GYEOK_CONG_GE',
      when: {
        op: 'gte',
        args: [{ var: 'patterns.follow.jonggyeokFactor' }, 0.6],
      },
      score: {
        'gyeokguk.CONG_GE': { op: 'mul', args: [{ var: 'patterns.follow.jonggyeokFactor' }, 0.85] },
      },
      explain: '종격/从格(jonggyeok) 신호가 강하면 “从格” 후보를 가산(연속값 factor×0.85)',
      tags: ['PATTERN', 'CONG_GE'],
    },
    {
      id: 'GYEOK_CONG_CAI',
      when: {
        op: 'and',
        args: [
          { op: 'gte', args: [{ var: 'patterns.follow.jonggyeokFactor' }, 0.6] },
          { op: 'eq', args: [{ var: 'patterns.follow.followType' }, 'CONG_CAI'] },
        ],
      },
      score: {
        'gyeokguk.CONG_CAI': { op: 'mul', args: [{ var: 'patterns.follow.jonggyeokFactor' }, 0.85] },
      },
      explain: '종격 세분(从财): jonggyeokFactor가 강하면 “从财格” 후보를 가산(연속값 factor×0.85)',
      tags: ['PATTERN', 'CONG_GE', 'CONG_CAI'],
    },
    {
      id: 'GYEOK_CONG_GUAN',
      when: {
        op: 'and',
        args: [
          { op: 'gte', args: [{ var: 'patterns.follow.jonggyeokFactor' }, 0.6] },
          { op: 'eq', args: [{ var: 'patterns.follow.followType' }, 'CONG_GUAN'] },
        ],
      },
      score: {
        'gyeokguk.CONG_GUAN': { op: 'mul', args: [{ var: 'patterns.follow.jonggyeokFactor' }, 0.85] },
      },
      explain: '종격 세분(从官): jonggyeokFactor가 강하면 “从官格” 후보를 가산(연속값 factor×0.85)',
      tags: ['PATTERN', 'CONG_GE', 'CONG_GUAN'],
    },
    {
      id: 'GYEOK_CONG_SHA',
      when: {
        op: 'and',
        args: [
          { op: 'gte', args: [{ var: 'patterns.follow.jonggyeokFactor' }, 0.6] },
          { op: 'eq', args: [{ var: 'patterns.follow.followType' }, 'CONG_SHA'] },
        ],
      },
      score: {
        'gyeokguk.CONG_SHA': { op: 'mul', args: [{ var: 'patterns.follow.jonggyeokFactor' }, 0.85] },
      },
      explain: '종격 세분(从杀): jonggyeokFactor가 강하면 “从杀格” 후보를 가산(연속값 factor×0.85)',
      tags: ['PATTERN', 'CONG_GE', 'CONG_SHA'],
    },
    {
      id: 'GYEOK_CONG_ER',
      when: {
        op: 'and',
        args: [
          { op: 'gte', args: [{ var: 'patterns.follow.jonggyeokFactor' }, 0.6] },
          { op: 'eq', args: [{ var: 'patterns.follow.followType' }, 'CONG_ER'] },
        ],
      },
      score: {
        'gyeokguk.CONG_ER': { op: 'mul', args: [{ var: 'patterns.follow.jonggyeokFactor' }, 0.85] },
      },
      explain: '종격 세분(从儿): jonggyeokFactor가 강하면 “从儿格” 후보를 가산(연속값 factor×0.85)',
      tags: ['PATTERN', 'CONG_GE', 'CONG_ER'],
    },
    {
      id: 'GYEOK_CONG_YIN',
      when: {
        op: 'and',
        args: [
          { op: 'gte', args: [{ var: 'patterns.follow.jonggyeokFactor' }, 0.6] },
          { op: 'eq', args: [{ var: 'patterns.follow.followType' }, 'CONG_YIN'] },
        ],
      },
      score: {
        'gyeokguk.CONG_YIN': { op: 'mul', args: [{ var: 'patterns.follow.jonggyeokFactor' }, 0.85] },
      },
      explain: '종격 세분(从印): jonggyeokFactor가 강하면 “从印格” 후보를 가산(연속값 factor×0.85)',
      tags: ['PATTERN', 'CONG_GE', 'CONG_YIN'],
    },
    {
      id: 'GYEOK_CONG_BI',
      when: {
        op: 'and',
        args: [
          { op: 'gte', args: [{ var: 'patterns.follow.jonggyeokFactor' }, 0.6] },
          { op: 'eq', args: [{ var: 'patterns.follow.followType' }, 'CONG_BI'] },
        ],
      },
      score: {
        'gyeokguk.CONG_BI': { op: 'mul', args: [{ var: 'patterns.follow.jonggyeokFactor' }, 0.85] },
      },
      explain: '종격 세분(从比): jonggyeokFactor가 강하면 “从比格” 후보를 가산(연속값 factor×0.85)',
      tags: ['PATTERN', 'CONG_GE', 'CONG_BI'],
    },
  ],
};

const BONUS_CHEON_JU_HOUR: Rule = {
  id: 'CHEON_JU_GUI_IN_HOUR_BONUS',
  when: {
    op: 'and',
    args: [
      { op: 'gt', args: [{ var: 'shinsal.catalog.dayStem.CHEON_JU_GUI_IN.count' }, 0] },
      { op: 'in', args: ['hour', { var: 'shinsal.catalog.dayStem.CHEON_JU_GUI_IN.matchedPillars' }] },
    ],
  },
  score: { 'shinsal.CHEON_JU_GUI_IN': 0.5 },
  explain: '천주귀인(天廚)이 시지/시주에서 확인되면 +0.5 보너스(전통적 강조를 반영)',
  tags: ['BONUS'],
};

const COMPOSITE_CHEON_WOL_DEOK: Rule = {
  id: 'CHEON_WOL_DEOK',
  when: {
    op: 'and',
    args: [
      {
        op: 'or',
        args: [
          { op: 'gt', args: [{ var: 'shinsal.catalog.monthBranchStem.CHEON_DEOK_GUI_IN_STEM.count' }, 0] },
          { op: 'gt', args: [{ var: 'shinsal.catalog.monthBranchBranch.CHEON_DEOK_GUI_IN_BRANCH.count' }, 0] },
        ],
      },
      { op: 'gt', args: [{ var: 'shinsal.catalog.monthBranchStem.WOL_DEOK_GUI_IN.count' }, 0] },
    ],
  },
  score: { 'shinsal.CHEON_WOL_DEOK': 1 },
  emit: { name: 'CHEON_WOL_DEOK', basedOn: 'MONTH_BRANCH', targetKind: 'NONE' },
  explain: '천월덕(天月二德): 천덕 + 월덕이 모두 성립',
  tags: ['COMPOSITE'],
};

const SPECIAL_CHEON_SA_DAY: Rule = {
  id: 'CHEON_SA_DAY',
  when: { op: 'eq', args: [{ var: 'shinsal.specialDays.CHEON_SA.active' }, true] },
  score: { 'shinsal.CHEON_SA': 1 },
  emit: {
    name: 'CHEON_SA',
    basedOn: 'MONTH_BRANCH',
    targetKind: 'NONE',
    matchedPillars: { var: 'shinsal.specialDays.CHEON_SA.matchedPillars' },
    details: {
      season: { var: 'shinsal.specialDays.CHEON_SA.season' },
      targetDayPillarHanja: { var: 'shinsal.specialDays.CHEON_SA.targetDayPillarHanja' },
    },
  },
  explain: '천사일(天赦日): 월지 계절에 따라 특정 일주(春戊寅/夏甲午/秋戊申/冬甲子)가 일주와 일치',
  tags: ['SPECIAL'],
};

const DEFAULT_SHINSAL_RULES: Rule[] = [
  // ------------------------------------------
  // Relation-based sal: facts precompute ready-to-emit payload arrays
  // ------------------------------------------
  ...buildRelationSalRules([
    { name: 'CHUNG_SAL', explain: '충살(沖殺): 명식 내 지지 관계에서 정충(沖) 발생(관계 기반).' },
    { name: 'HYEONG_SAL', explain: '형살(刑殺): 명식 내 지지 관계에서 형(刑/自刑/三刑) 발생(관계 기반).' },
    { name: 'HAE_SAL', explain: '해살(害殺): 명식 내 지지 관계에서 지해(害) 발생(관계 기반).' },
    { name: 'PA_SAL', explain: '파살(破殺): 명식 내 지지 관계에서 파(破) 발생(관계 기반).' },
    { name: 'WONJIN_SAL', explain: '원진살(怨嗔殺): 명식 내 지지 관계에서 원진(怨嗔) 발생(관계 기반).' },
    { name: 'GEOKGAK_SAL', explain: '격각살(隔角殺): 지지 12순환에서 한 칸 건너 관계(distance=2) 성립(관계 기반).' },
  ]),

  // Special day markers
  SPECIAL_CHEON_SA_DAY,

  // ------------------------------------------
  // Derived: 12신살(十二神殺) + 홍란/천희
  // ------------------------------------------
  ...buildBranchPresenceRules(
    // 12신살은 facts에서 `shinsal.twelveSal.(year|day).<KEY>`로 계산된다.
    // 여기서는 '명식 4지지(chart.branches)에 해당 지지가 존재하는가'만 DSL로 판정한다.
    (
      [
        'JI_SAL',
        'DOHWA',
        'WOL_SAL',
        'MANG_SHIN_SAL',
        'JANGSEONG',
        'BAN_AN_SAL',
        'YEOKMA',
        'YUK_HAE_SAL',
        'HUAGAI',
        'GEOB_SAL',
        'JAESAL',
        'CHEON_SAL',
      ] as string[]
    )
      .flatMap((k) =>
        (['YEAR_BRANCH', 'DAY_BRANCH'] as const).map((basedOn) => ({
          id: `${k}_FROM_${basedOn === 'YEAR_BRANCH' ? 'YEAR' : 'DAY'}`,
          name: k,
          basedOn,
          targetVar: `shinsal.twelveSal.${basedOn === 'YEAR_BRANCH' ? 'year' : 'day'}.${k}`,
          explain: `${basedOn === 'YEAR_BRANCH' ? '년지' : '일지'} 기준 12신살(${k}) 지지가 명식에 존재`,
        })),
      )
      .concat([
        { id: 'HONG_LUAN_FROM_YEAR', name: 'HONG_LUAN', basedOn: 'YEAR_BRANCH', targetVar: 'shinsal.hongluan.year', explain: '년지 기준 홍란(紅鸞) 지지가 명식에 존재' },
        { id: 'CHEON_HUI_FROM_YEAR', name: 'CHEON_HUI', basedOn: 'YEAR_BRANCH', targetVar: 'shinsal.cheonhui.year', explain: '년지 기준 천희(天喜) 지지가 명식에 존재' },
      ]) as Array<{ id: string; name: string; basedOn: 'YEAR_BRANCH' | 'DAY_BRANCH'; targetVar: string; explain: string }>,
  ),

  // ------------------------------------------
  // Derived: 공망(旬空) — pillar.branch ∈ shinsal.gongmang.day
  // ------------------------------------------
  ...buildPillarBranchInListRules({
    name: 'GONGMANG',
    listVar: 'shinsal.gongmang.day',
    pillars: [
      { pillar: 'year', id: 'GONGMANG_YEAR', explain: '연지가 일주旬空(공망)에 해당' },
      { pillar: 'month', id: 'GONGMANG_MONTH', explain: '월지가 일주旬空(공망)에 해당' },
      { pillar: 'day', id: 'GONGMANG_DAY', explain: '일지가 일주旬空(공망)에 해당' },
      { pillar: 'hour', id: 'GONGMANG_HOUR', explain: '시지가 일주旬空(공망)에 해당' },
    ],
  }),

  // ------------------------------------------
  // Catalog-driven: day-stem based (日干→지지)
  // ------------------------------------------
  ...buildCatalogDayStemRules(
    [
      { key: 'CHEON_EUL_GUI_IN', scoreMode: 'lenPresent', explain: '일간(천간) 기준 천을귀인(天乙) 지지가 명식에 존재' },
      { key: 'TAE_GEUK_GUI_IN', scoreMode: 'lenPresent', explain: '일간(천간) 기준 태극귀인(太極) 지지가 명식에 존재' },
      { key: 'MUN_CHANG_GUI_IN', scoreMode: 'lenPresent', explain: '일간(천간) 기준 문창귀인(文昌) 지지가 명식에 존재' },
      { key: 'MUN_GOK_GUI_IN', scoreMode: 'lenPresent', explain: '일간(천간) 기준 문곡귀인(文曲) 지지가 명식에 존재' },
      { key: 'HAK_DANG_GUI_IN', scoreMode: 'lenPresent', explain: '학당귀인(學堂): 일간의 장생지(십이운성) 지지가 명식에 존재' },
      { key: 'BI_IN_SAL', scoreMode: 'lenPresent', explain: '비인살(飛刃): 통용 정의=冲羊刃, 일간 기준 대응 지지가 명식에 존재(양인 테이블에서 도출)' },
      { key: 'YANG_IN', scoreMode: 'lenPresent', explain: '양인(羊刃): 일간 기준 대응 지지가 명식에 존재' },
      { key: 'LOK_SHIN', scoreMode: 'lenPresent', explain: '록신(祿神): 일간 기준 대응 지지가 명식에 존재' },
      { key: 'GUK_IN_GUI_IN', scoreMode: 'lenPresent', explain: '국인귀인(國印貴人): 일간 기준 대응 지지가 명식에 존재' },
      { key: 'CHEON_JU_GUI_IN', scoreMode: 'lenPresent', explain: '천주귀인(天廚): 일간 기준 대응 지지가 명식에 존재' },
      { key: 'CHEON_GWAN_GUI_IN', scoreMode: 'lenPresent', explain: '천관귀인(天官): 일간 기준 대응 지지가 명식에 존재' },
      { key: 'CHEON_BOK_GUI_IN', scoreMode: 'lenPresent', explain: '천복귀인(天福): 일간 기준 대응 지지가 명식에 존재' },
      { key: 'BOK_SEONG_GUI_IN', scoreMode: 'lenPresent', explain: '복성귀인(福星): 일간 기준 대응 지지가 명식에 존재' },
      { key: 'GEUM_YEO_GUI_IN', scoreMode: 'lenPresent', explain: '금여귀인(金輿): 일간 기준 대응 지지가 명식에 존재' },
      { key: 'HONG_YEOM_SAL', scoreMode: 'lenPresent', explain: '홍염살(紅艶): 일간 기준 대응 지지가 명식에 존재' },
    ],
    'dayStem',
  ),

  BONUS_CHEON_JU_HOUR,

  // ------------------------------------------
  // Catalog-driven: month-branch based (月支→天干/地支)
  // ------------------------------------------
  ...buildCatalogMonthBranchStemRules([
    { key: 'WOL_DEOK_GUI_IN', scoreMode: 'count', explain: '월덕귀인(月德): 월지 삼합국 기준 대상 천간이 명식(년월일시 천간)에 존재' },
    { key: 'WOL_DEOK_HAP', scoreMode: 'count', explain: '월덕합(月德合): 월덕 귀인의 五合 파트너 천간이 명식에 존재' },
    { key: 'DEOK_SU_GUI_IN', emitPresentList: true, scoreMode: 'count', explain: '덕수귀인(德秀): 월지 삼합국 기준 대상 천간(복수)이 명식에 존재' },
    { key: 'CHEON_DEOK_GUI_IN_STEM', name: 'CHEON_DEOK_GUI_IN', scoreMode: 'count', explain: '천덕귀인(天德): 월지 기준 대상 천간이 명식에 존재(천간판)' },
    { key: 'CHEON_DEOK_HAP', scoreMode: 'count', explain: '천덕합(天德合): 천덕(천간판)의 五合 파트너 천간이 명식에 존재' },
  ]),

  ...buildCatalogMonthBranchBranchRules([
    { key: 'CHEON_UI', scoreMode: 'count', explain: '천의(天醫): 월지 기준 대상 지지가 명식에 존재' },
    { key: 'CHEON_DEOK_GUI_IN_BRANCH', name: 'CHEON_DEOK_GUI_IN', scoreMode: 'count', explain: '천덕귀인(天德): 월지 기준 대상 지지가 명식에 존재(지지판)' },
  ]),

  COMPOSITE_CHEON_WOL_DEOK,

  // ------------------------------------------
  // Catalog-driven: day-pillar sets (日柱 집합)
  // ------------------------------------------
  ...buildCatalogDayPillarRules([
    { key: 'KUI_GANG', explain: '괴강(魁罡): 일주가 괴강 간지 집합에 해당' },
    { key: 'BAEK_HO', explain: '백호(白虎大殺): 일주가 백호 간지 집합에 해당' },
  ]),
];

export const DEFAULT_SHINSAL_RULESET: RuleSet = {
  id: 'shinsal.base.compiled',
  version: '0.7',
  description:
    'Default shinsal ruleset compiled from meta-spec (formula-based + catalog-driven + relation-based). Extend via config.extensions.rulesets.shinsal.',
  rules: DEFAULT_SHINSAL_RULES,
};
