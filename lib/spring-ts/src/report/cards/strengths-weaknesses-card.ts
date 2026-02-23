/**
 * strengths-weaknesses-card.ts -- Build a StrengthsWeaknessesCard
 *
 * Derives strengths and weaknesses from three knowledge sources:
 *   - stemEncyclopedia (day master character strengths/cautions)
 *   - tenGodEncyclopedia (dominant group strengths, deficient group cautions)
 *   - yongshin alignment (yongshin-aligned strengths, gisin/gusin risks)
 *
 * Every item is a FortuneAdvice with both `text` and `reason`.
 * All text uses friendly Korean (~해요 / ~에요 tone).
 */

import type { SajuSummary } from '../../types.js';
import type { StrengthsWeaknessesCard, FortuneAdvice, ElementCode } from '../types.js';
import type { StemCode, TenGodCode } from '../types.js';
import {
  lookupStemInfo,
  TEN_GOD_BY_CODE,
  ELEMENT_KOREAN_SHORT,
} from '../common/elementMaps.js';
import { STEM_ENCYCLOPEDIA } from '../knowledge/stemEncyclopedia.js';
import { TEN_GOD_ENCYCLOPEDIA } from '../knowledge/tenGodEncyclopedia.js';
import { STRENGTH_ENCYCLOPEDIA } from '../knowledge/strengthEncyclopedia.js';

// ---------------------------------------------------------------------------
//  Ten-god helpers (shared with personality-card)
// ---------------------------------------------------------------------------

const TEN_GOD_KOREAN_TO_CODE: Readonly<Record<string, string>> = {
  '비견': 'BI_GYEON',
  '겁재': 'GEOB_JAE',
  '식신': 'SIK_SHIN',
  '상관': 'SANG_GWAN',
  '편재': 'PYEON_JAE',
  '정재': 'JEONG_JAE',
  '편관': 'PYEON_GWAN',
  '정관': 'JEONG_GWAN',
  '편인': 'PYEON_IN',
  '정인': 'JEONG_IN',
};

function normalizeTenGodCode(raw: string): string {
  return TEN_GOD_KOREAN_TO_CODE[raw] ?? raw;
}

type TenGodCategoryKey = 'friend' | 'output' | 'wealth' | 'authority' | 'resource';

const ALL_CATEGORIES: readonly TenGodCategoryKey[] = [
  'friend', 'output', 'wealth', 'authority', 'resource',
];

const CATEGORY_KOREAN: Record<TenGodCategoryKey, string> = {
  friend: '비겁',
  output: '식상',
  wealth: '재성',
  authority: '관성',
  resource: '인성',
};

function getTenGodCategory(raw: string): TenGodCategoryKey | null {
  const code = normalizeTenGodCode(raw);
  const info = TEN_GOD_BY_CODE[code];
  return info ? (info.category as TenGodCategoryKey) : null;
}

// ---------------------------------------------------------------------------
//  Element helpers
// ---------------------------------------------------------------------------

const ALL_ELEMENTS: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

const ELEMENT_FRIENDLY: Record<string, string> = {
  WOOD: '나무', FIRE: '불', EARTH: '흙', METAL: '쇠', WATER: '물',
};

function normalizeElement(code: string): ElementCode | null {
  const upper = code.toUpperCase();
  if ((ALL_ELEMENTS as readonly string[]).includes(upper)) return upper as ElementCode;
  const map: Record<string, ElementCode> = {
    '목': 'WOOD', '화': 'FIRE', '토': 'EARTH', '금': 'METAL', '수': 'WATER',
  };
  return map[code.charAt(0)] ?? null;
}

function friendlyElement(code: string): string {
  const el = normalizeElement(code);
  return el ? ELEMENT_FRIENDLY[el] : code;
}

// ---------------------------------------------------------------------------
//  Builder
// ---------------------------------------------------------------------------

export function buildStrengthsWeaknessesCard(saju: SajuSummary): StrengthsWeaknessesCard {
  const strengths: FortuneAdvice[] = [];
  const weaknesses: FortuneAdvice[] = [];

  // ── 1. Stem encyclopedia (day master) ──
  const stemInfo = lookupStemInfo(saju.dayMaster.stem);
  const stemCode = stemInfo?.code as StemCode | undefined;
  const stemEntry = stemCode ? STEM_ENCYCLOPEDIA[stemCode] : null;

  if (stemEntry && stemInfo) {
    const stemSource = `일간 ${stemInfo.hangul}의 특성`;

    // Pick up to 2 strengths from stem
    for (const text of stemEntry.strengths.slice(0, 2)) {
      strengths.push({ text, reason: stemSource });
    }

    // Pick up to 2 cautions from stem
    for (const text of stemEntry.cautions.slice(0, 2)) {
      weaknesses.push({ text, reason: stemSource });
    }
  }

  // ── 2. Ten-god group analysis ──
  const tga = saju.tenGodAnalysis;
  if (tga) {
    const categoryCounts: Record<TenGodCategoryKey, number> = {
      friend: 0, output: 0, wealth: 0, authority: 0, resource: 0,
    };

    for (const posKey of Object.keys(tga.byPosition)) {
      const pos = tga.byPosition[posKey];
      for (const raw of [pos.cheonganTenGod, pos.jijiPrincipalTenGod]) {
        if (!raw) continue;
        const cat = getTenGodCategory(raw);
        if (cat) categoryCounts[cat]++;
      }
      for (const hidden of pos.hiddenStemTenGod) {
        const cat = getTenGodCategory(hidden.tenGod);
        if (cat) categoryCounts[cat]++;
      }
    }

    // Find dominant and deficient categories
    let dominantCat: TenGodCategoryKey = 'friend';
    let deficientCat: TenGodCategoryKey = 'friend';
    let maxCount = 0;
    let minCount = Infinity;

    for (const cat of ALL_CATEGORIES) {
      if (categoryCounts[cat] > maxCount) {
        maxCount = categoryCounts[cat];
        dominantCat = cat;
      }
      if (categoryCounts[cat] < minCount) {
        minCount = categoryCounts[cat];
        deficientCat = cat;
      }
    }

    // Dominant group strengths
    const dominantCode = findRepresentativeTenGod(dominantCat, tga);
    const dominantEntry = dominantCode
      ? TEN_GOD_ENCYCLOPEDIA[dominantCode as TenGodCode] ?? null
      : null;

    if (dominantEntry) {
      const reason = `${CATEGORY_KOREAN[dominantCat]} 계열(${dominantEntry.korean})이 강한 사주`;
      for (const text of dominantEntry.strengths.slice(0, 2)) {
        strengths.push({ text, reason });
      }
    }

    // Deficient group cautions (only if meaningfully different)
    if (deficientCat !== dominantCat) {
      const deficientCode = findRepresentativeTenGodForCategory(deficientCat);
      const deficientEntry = deficientCode
        ? TEN_GOD_ENCYCLOPEDIA[deficientCode as TenGodCode] ?? null
        : null;

      if (deficientEntry) {
        const reason = `${CATEGORY_KOREAN[deficientCat]} 계열(${deficientEntry.korean})이 부족한 사주`;
        // The caution from the deficient group highlights what is missing
        for (const text of deficientEntry.cautions.slice(0, 1)) {
          weaknesses.push({ text, reason });
        }
      }
    }
  }

  // ── 3. Strength-level based advice ──
  const strengthEntry = STRENGTH_ENCYCLOPEDIA[saju.strength.level] ?? null;
  if (strengthEntry) {
    const reason = `에너지 균형이 ${strengthEntry.korean} 수준`;
    for (const text of strengthEntry.strengths.slice(0, 1)) {
      strengths.push({ text, reason });
    }
    for (const text of strengthEntry.cautions.slice(0, 1)) {
      weaknesses.push({ text, reason });
    }
  }

  // ── 4. Yongshin-aligned strengths ──
  const yongshinEl = normalizeElement(saju.yongshin.element);
  if (yongshinEl) {
    const yongshinName = friendlyElement(saju.yongshin.element);
    strengths.push({
      text: `${yongshinName} 기운을 가까이하면 에너지가 충전되고 안정감이 높아져요.`,
      reason: `용신이 ${ELEMENT_KOREAN_SHORT[yongshinEl]}인 사주`,
    });
  }

  // ── 5. Gisin/Gusin risks ──
  if (saju.yongshin.gishin) {
    const gishinName = friendlyElement(saju.yongshin.gishin);
    const gishinEl = normalizeElement(saju.yongshin.gishin);
    weaknesses.push({
      text: `${gishinName} 기운이 과하면 에너지 균형이 무너져 컨디션이 떨어질 수 있어요.`,
      reason: `기신이 ${gishinEl ? ELEMENT_KOREAN_SHORT[gishinEl] : gishinName}인 사주`,
    });
  }

  if (saju.yongshin.gushin) {
    const gushinName = friendlyElement(saju.yongshin.gushin);
    const gushinEl = normalizeElement(saju.yongshin.gushin);
    weaknesses.push({
      text: `${gushinName} 기운이 강해지면 주의가 필요해요. 이 기운을 피하기보다 균형을 찾는 것이 중요해요.`,
      reason: `구신이 ${gushinEl ? ELEMENT_KOREAN_SHORT[gushinEl] : gushinName}인 사주`,
    });
  }

  return {
    title: '나의 장/단점',
    strengths,
    weaknesses,
  };
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

/**
 * Find the most frequently occurring ten-god code for a category
 * from the ten-god analysis positions.
 */
function findRepresentativeTenGod(
  category: TenGodCategoryKey,
  tga: NonNullable<SajuSummary['tenGodAnalysis']>,
): string | null {
  const codeCounts = new Map<string, number>();

  for (const posKey of Object.keys(tga.byPosition)) {
    const pos = tga.byPosition[posKey];
    for (const raw of [pos.cheonganTenGod, pos.jijiPrincipalTenGod]) {
      if (!raw) continue;
      const code = normalizeTenGodCode(raw);
      const info = TEN_GOD_BY_CODE[code];
      if (info && info.category === category) {
        codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
      }
    }
    for (const hidden of pos.hiddenStemTenGod) {
      const code = normalizeTenGodCode(hidden.tenGod);
      const info = TEN_GOD_BY_CODE[code];
      if (info && info.category === category) {
        codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
      }
    }
  }

  if (codeCounts.size === 0) return null;

  let best: string | null = null;
  let bestCount = 0;
  codeCounts.forEach((count, code) => {
    if (count > bestCount) {
      bestCount = count;
      best = code;
    }
  });
  return best;
}

/**
 * Get a representative ten-god code for a category using the canonical
 * first code per category (used when no analysis data is available
 * to count frequencies).
 */
function findRepresentativeTenGodForCategory(category: TenGodCategoryKey): string | null {
  const mapping: Record<TenGodCategoryKey, string> = {
    friend: 'BI_GYEON',
    output: 'SIK_SHIN',
    wealth: 'PYEON_JAE',
    authority: 'JEONG_GWAN',
    resource: 'JEONG_IN',
  };
  return mapping[category] ?? null;
}
