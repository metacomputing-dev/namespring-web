/**
 * Baseline 신살(神煞) catalog pack.
 *
 * Design goals:
 * - Data-first: definitions live as compact data (mostly tables), not branching code.
 * - Extensible: users can override/extend via config.extensions.catalogs.shinsal.
 * - Math-friendly: when a 신살 can be derived from a formula, we keep it in code (e.g., 도화/역마/화개/공망).
 *
 * Notes on “덕(德) 귀인”:
 * - 천덕(天德) / 월덕(月德) / (천덕합/월덕합) are often defined by 月支 and then checked against
 *   stems or (sometimes) branches in the chart. We encode them as month-branch based tables.
 * - Schools differ (e.g., whether only 日干 counts, or any pillar stem counts). The engine exposes
 *   strategy hooks so you can override scope without changing API.
 */

export const DEFAULT_SHINSAL_CATALOG = {
  meta: {
    id: 'shinsal.catalog.base',
    version: '0.4',
    description:
      'Baseline shinsal catalog (천을/태극/문창/문곡/양인/비인 + 록신/국인 + 천관/천복 + 천주/복성/금여/홍염 + 월덕/월덕합/천덕 + day-pillar sets: 괴강/백호).',
  },

  /**
   * Day-stem based lookups: key → (日干 → target 地支 list)
   *
   * Note: schools vary. This is a common baseline; override via config if needed.
   */
  dayStem: {
    /** 天乙貴人 (천을귀인): 日干 → 2 branches */
    CHEON_EUL_GUI_IN: {
      branches: {
        '甲': ['丑', '未'],
        '乙': ['子', '申'],
        '丙': ['亥', '酉'],
        '丁': ['亥', '酉'],
        '戊': ['丑', '未'],
        '己': ['子', '申'],
        '庚': ['丑', '未'],
        '辛': ['寅', '午'],
        '壬': ['巳', '卯'],
        '癸': ['巳', '卯'],
      },
    },

    /** 太極貴人 (태극귀인): 日干 → branches */
    TAE_GEUK_GUI_IN: {
      branches: {
        '甲': ['子', '午'],
        '乙': ['子', '午'],
        '丙': ['卯', '酉'],
        '丁': ['卯', '酉'],
        '戊': ['辰', '戌', '丑', '未'],
        '己': ['辰', '戌', '丑', '未'],
        '庚': ['寅', '亥'],
        '辛': ['寅', '亥'],
        '壬': ['巳', '申'],
        '癸': ['巳', '申'],
      },
    },

    /** 文昌貴人 (문창귀인): 日干 → 1 branch */
    MUN_CHANG_GUI_IN: {
      branches: {
        '甲': ['巳'],
        '乙': ['午'],
        '丙': ['申'],
        '丁': ['酉'],
        '戊': ['申'],
        '己': ['酉'],
        '庚': ['亥'],
        '辛': ['子'],
        '壬': ['寅'],
        '癸': ['卯'],
      },
    },

    /** 文曲貴人 (문곡귀인): 日干 → 1 branch */
    MUN_GOK_GUI_IN: {
      branches: {
        '甲': ['亥'],
        '乙': ['子'],
        '丙': ['寅'],
        '丁': ['卯'],
        '戊': ['寅'],
        '己': ['卯'],
        '庚': ['巳'],
        '辛': ['午'],
        '壬': ['申'],
        '癸': ['酉'],
      },
    },

    /** 祿神 (록신/건록): 日干 → 1 branch (臨官) */
    LOK_SHIN: {
      branches: {
        '甲': ['寅'],
        '乙': ['卯'],
        '丙': ['巳'],
        '丁': ['午'],
        '戊': ['巳'],
        '己': ['午'],
        '庚': ['申'],
        '辛': ['酉'],
        '壬': ['亥'],
        '癸': ['子'],
      },
    },

    /** 國印貴人 (국인귀인): 日干 → 1 branch */
    GUK_IN_GUI_IN: {
      branches: {
        '甲': ['戌'],
        '乙': ['亥'],
        '丙': ['丑'],
        '丁': ['寅'],
        '戊': ['丑'],
        '己': ['寅'],
        '庚': ['辰'],
        '辛': ['巳'],
        '壬': ['未'],
        '癸': ['申'],
      },
    },

    /** 天廚貴人 (천주귀인/천주): 日干 → 1 branch (전통적으로 时支에서 특히 중시) */
    CHEON_JU_GUI_IN: {
      branches: {
        '甲': ['巳'],
        '乙': ['午'],
        '丙': ['巳'],
        '丁': ['午'],
        '戊': ['申'],
        '己': ['酉'],
        '庚': ['亥'],
        '辛': ['子'],
        '壬': ['寅'],
        '癸': ['卯'],
      },
    },

    /** 天官貴人 (천관귀인): 日干 → 1 branch (口诀: 甲未 乙辰 丙巳 丁寅 戊丑 己戌 庚亥 辛申 壬酉 癸午) */
    CHEON_GWAN_GUI_IN: {
      branches: {
        '甲': ['未'],
        '乙': ['辰'],
        '丙': ['巳'],
        '丁': ['寅'],
        '戊': ['丑'],
        '己': ['戌'],
        '庚': ['亥'],
        '辛': ['申'],
        '壬': ['酉'],
        '癸': ['午'],
      },
    },

    /** 天福貴人 (천복귀인): 日干 → 1 branch (口诀: 甲酉 乙申 丙子 丁亥 戊卯 己寅 庚午 辛巳 壬午 癸巳) */
    CHEON_BOK_GUI_IN: {
      branches: {
        '甲': ['酉'],
        '乙': ['申'],
        '丙': ['子'],
        '丁': ['亥'],
        '戊': ['卯'],
        '己': ['寅'],
        '庚': ['午'],
        '辛': ['巳'],
        '壬': ['午'],
        '癸': ['巳'],
      },
    },

    /**
     * 福星貴人 (복성귀인): 日干 → branches
     *  - 甲/丙: 寅 or 子
     *  - 乙/癸: 卯 or 丑
     *  - 丁: 亥
     *  - 戊: 申
     *  - 己: 未
     *  - 庚: 午
     *  - 辛: 巳
     *  - 壬: 辰
     */
    BOK_SEONG_GUI_IN: {
      branches: {
        '甲': ['寅', '子'],
        '乙': ['卯', '丑'],
        '丙': ['寅', '子'],
        '丁': ['亥'],
        '戊': ['申'],
        '己': ['未'],
        '庚': ['午'],
        '辛': ['巳'],
        '壬': ['辰'],
        '癸': ['卯', '丑'],
      },
    },

    /**
     * 金輿貴人 (금여귀인/금여): 日干 → branches
     * Common口诀: 甲辰乙巳 丙戊未 丁己申 庚戌 辛亥 壬丑 癸寅
     */
    GEUM_YEO_GUI_IN: {
      branches: {
        '甲': ['辰'],
        '乙': ['巳'],
        '丙': ['未'],
        '丁': ['申'],
        '戊': ['未'],
        '己': ['申'],
        '庚': ['戌'],
        '辛': ['亥'],
        '壬': ['丑'],
        '癸': ['寅'],
      },
    },

    /**
     * 紅艶煞 (홍염살/홍염): 日干 → branch
     * Common口诀: 甲午 乙申 丙寅 丁未 戊辰 己辰 庚戌 辛酉 壬子 癸申
     */
    HONG_YEOM_SAL: {
      branches: {
        '甲': ['午'],
        '乙': ['申'],
        '丙': ['寅'],
        '丁': ['未'],
        '戊': ['辰'],
        '己': ['辰'],
        '庚': ['戌'],
        '辛': ['酉'],
        '壬': ['子'],
        '癸': ['申'],
      },
    },
  },

  /**
   * Month-branch → target STEM tables (月支 기준: 대상 = 천간).
   *
   * Used for: 월덕/월덕합 and (부분적으로) 천덕/천덕합.
   */
  monthBranchStem: {
    /**
     * 月德貴人 (월덕귀인): 月支 삼합국 → 旺干
     * 寅午戌→丙, 申子辰→壬, 亥卯未→甲, 巳酉丑→庚
     */
    WOL_DEOK_GUI_IN: {
      stems: {
        '寅': ['丙'],
        '卯': ['甲'],
        '辰': ['壬'],
        '巳': ['庚'],
        '午': ['丙'],
        '未': ['甲'],
        '申': ['壬'],
        '酉': ['庚'],
        '戌': ['丙'],
        '亥': ['甲'],
        '子': ['壬'],
        '丑': ['庚'],
      },
    },

    /**
     * 月德合 (월덕합): 月德의 五合 파트너 천간
     * 寅午戌→辛, 申子辰→丁, 亥卯未→己, 巳酉丑→乙
     */
    WOL_DEOK_HAP: {
      stems: {
        '寅': ['辛'],
        '卯': ['己'],
        '辰': ['丁'],
        '巳': ['乙'],
        '午': ['辛'],
        '未': ['己'],
        '申': ['丁'],
        '酉': ['乙'],
        '戌': ['辛'],
        '亥': ['己'],
        '子': ['丁'],
        '丑': ['乙'],
      },
    },

    /**
     * 天德贵人(천덕귀인) - STEM part only.
     * Some months map to a stem, others map to a branch (handled in monthBranchBranch).
     *
     * 正月(寅)丁, 三月(辰)壬, 四月(巳)辛, 六月(未)甲,
     * 七月(申)癸, 九月(戌)丙, 十月(亥)乙, 十二月(丑)庚
     */
    CHEON_DEOK_GUI_IN_STEM: {
      stems: {
        '寅': ['丁'],
        '辰': ['壬'],
        '巳': ['辛'],
        '未': ['甲'],
        '申': ['癸'],
        '戌': ['丙'],
        '亥': ['乙'],
        '丑': ['庚'],
      },
    },

    /**
     * 天德合(천덕합) - STEM part only.
     * 天干五合: 甲己, 乙庚, 丙辛, 丁壬, 戊癸
     *
     * From CHEON_DEOK_GUI_IN_STEM targets:
     * 寅: 丁→壬, 辰: 壬→丁, 巳: 辛→丙, 未: 甲→己,
     * 申: 癸→戊, 戌: 丙→辛, 亥: 乙→庚, 丑: 庚→乙
     */
    CHEON_DEOK_HAP: {
      stems: {
        '寅': ['壬'],
        '辰': ['丁'],
        '巳': ['丙'],
        '未': ['己'],
        '申': ['戊'],
        '戌': ['辛'],
        '亥': ['庚'],
        '丑': ['乙'],
      },
    },
  },

  /**
   * Month-branch → target BRANCH tables (月支 기준: 대상 = 지지).
   *
   * Used for: 천덕(일부 월은 지지로 판정).
   */
  monthBranchBranch: {
    /**
     * 天德贵人(천덕귀인) - BRANCH part only.
     * 二月(卯)申, 五月(午)亥, 八月(酉)寅, 十一月(子)巳
     */
    CHEON_DEOK_GUI_IN_BRANCH: {
      branches: {
        '卯': ['申'],
        '午': ['亥'],
        '酉': ['寅'],
        '子': ['巳'],
      },
    },
  },

  /**
   * Day-pillar sets (日柱-based).
   *
   * Many schools treat these as "only counts when 日柱 itself is in the set".
   * We encode that as requiresDayPillar=true; rules can be overridden.
   */
  dayPillar: {
    /** 魁罡 (괴강): common 4-day-pillar baseline, with optional extended 2. */
    KUI_GANG: {
      requiresDayPillar: true,
      primary: ['庚辰', '壬辰', '庚戌', '戊戌'],
      extended: ['戊辰', '壬戌'],
    },

    /** 白虎大殺 (백호): 7 day-pillar set */
    BAEK_HO: {
      requiresDayPillar: true,
      primary: ['甲辰', '乙未', '丙戌', '丁丑', '戊辰', '壬戌', '癸丑'],
    },
  },
} as const;
