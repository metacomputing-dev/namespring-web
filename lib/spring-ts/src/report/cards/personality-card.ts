/**
 * personality-card.ts -- Build a PersonalityCard from SajuSummary
 *
 * Combines three independent personality sources:
 *   1. Day master stem (stemEncyclopedia) -- base personality
 *   2. Dominant ten-god group (tenGodEncyclopedia) -- relational traits
 *   3. Gyeokguk pattern (gyeokgukEncyclopedia) -- life structure traits
 *
 * All text is written in friendly Korean (~해요 / ~에요 tone).
 */

import type { SajuSummary } from '../../types.js';
import type { PersonalityCard, PersonalityTrait } from '../types.js';
import type { StemCode, TenGodCode } from '../types.js';
import {
  lookupStemInfo,
  TEN_GOD_BY_CODE,
} from '../common/elementMaps.js';
import { STEM_ENCYCLOPEDIA } from '../knowledge/stemEncyclopedia.js';
import { TEN_GOD_ENCYCLOPEDIA } from '../knowledge/tenGodEncyclopedia.js';
import { findGyeokgukEntry } from '../knowledge/gyeokgukEncyclopedia.js';

// ---------------------------------------------------------------------------
//  Ten-god code normalisation (Korean → code mapping)
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

// ---------------------------------------------------------------------------
//  Ten-god category key type and group mapping
// ---------------------------------------------------------------------------

type TenGodCategoryKey = 'friend' | 'output' | 'wealth' | 'authority' | 'resource';

const CATEGORY_KOREAN: Record<TenGodCategoryKey, string> = {
  friend: '비겁',
  output: '식상',
  wealth: '재성',
  authority: '관성',
  resource: '인성',
};

const ALL_CATEGORIES: readonly TenGodCategoryKey[] = [
  'friend', 'output', 'wealth', 'authority', 'resource',
];

function getTenGodCategory(raw: string): TenGodCategoryKey | null {
  const code = normalizeTenGodCode(raw);
  const info = TEN_GOD_BY_CODE[code];
  return info ? (info.category as TenGodCategoryKey) : null;
}

// ---------------------------------------------------------------------------
//  Element-friendly name (no Chinese characters)
// ---------------------------------------------------------------------------

const ELEMENT_FRIENDLY: Record<string, string> = {
  WOOD: '나무', FIRE: '불', EARTH: '흙', METAL: '쇠', WATER: '물',
};

function friendlyElement(code: string): string {
  return ELEMENT_FRIENDLY[code.toUpperCase()] ?? code;
}

// ---------------------------------------------------------------------------
//  Builder
// ---------------------------------------------------------------------------

export function buildPersonalityCard(saju: SajuSummary): PersonalityCard {
  const traits: PersonalityTrait[] = [];

  // ── Source 1: Day master stem personality ──
  const stemInfo = lookupStemInfo(saju.dayMaster.stem);
  const stemCode = stemInfo?.code as StemCode | undefined;
  const stemEntry = stemCode ? STEM_ENCYCLOPEDIA[stemCode] : null;

  if (stemEntry) {
    // Pick up to 2 personality lines from the stem encyclopedia
    const stemPersonalities = stemEntry.personality.slice(0, 2);
    for (let i = 0; i < stemPersonalities.length; i++) {
      const keyword = stemEntry.coreKeywords[i] ?? stemEntry.coreKeywords[0] ?? friendlyElement(stemEntry.element);
      traits.push({
        trait: keyword,
        description: stemPersonalities[i],
        source: `일간 ${stemInfo!.hangul}의 기본 성향`,
      });
    }
  }

  // ── Source 2: Ten-god group distribution ── dominant / deficient ──
  const tga = saju.tenGodAnalysis;
  let dominantCategory: TenGodCategoryKey | null = null;
  let deficientCategory: TenGodCategoryKey | null = null;

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
    let maxCount = 0;
    let minCount = Infinity;
    for (const cat of ALL_CATEGORIES) {
      if (categoryCounts[cat] > maxCount) {
        maxCount = categoryCounts[cat];
        dominantCategory = cat;
      }
      if (categoryCounts[cat] < minCount) {
        minCount = categoryCounts[cat];
        deficientCategory = cat;
      }
    }

    // Find the representative ten-god code for the dominant category
    if (dominantCategory) {
      const representativeCode = findRepresentativeTenGod(dominantCategory, tga);
      const encyclopediaEntry = representativeCode
        ? TEN_GOD_ENCYCLOPEDIA[representativeCode as TenGodCode] ?? null
        : null;

      if (encyclopediaEntry) {
        traits.push({
          trait: CATEGORY_KOREAN[dominantCategory],
          description: encyclopediaEntry.coreRole,
          source: `십성 분포 (${CATEGORY_KOREAN[dominantCategory]} 계열 우세)`,
        });

        // Add one strength trait from the dominant group
        if (encyclopediaEntry.strengths.length > 0) {
          traits.push({
            trait: `${CATEGORY_KOREAN[dominantCategory]}의 강점`,
            description: encyclopediaEntry.strengths[0],
            source: `십성 ${encyclopediaEntry.korean}의 특성`,
          });
        }
      }
    }

    // Deficient category note (only if meaningfully different)
    if (deficientCategory && deficientCategory !== dominantCategory && minCount === 0) {
      traits.push({
        trait: `${CATEGORY_KOREAN[deficientCategory]} 부족`,
        description: `${CATEGORY_KOREAN[deficientCategory]} 계열의 기운이 약한 편이에요. 이 영역의 특성을 의식적으로 키워보면 균형 잡힌 성장에 도움이 돼요.`,
        source: '십성 분포 분석',
      });
    }
  }

  // ── Source 3: Gyeokguk pattern ──
  const gyeokgukEntry = findGyeokgukEntry(saju.gyeokguk.type);
  if (gyeokgukEntry) {
    const descLine = gyeokgukEntry.description[0] ?? '';
    traits.push({
      trait: gyeokgukEntry.korean,
      description: descLine,
      source: `격국 (${gyeokgukEntry.category} 계열)`,
    });

    // Add one strength from gyeokguk
    if (gyeokgukEntry.strengths.length > 0) {
      traits.push({
        trait: `${gyeokgukEntry.korean}의 강점`,
        description: gyeokgukEntry.strengths[0],
        source: '격국 분석',
      });
    }
  }

  // ── Summary ──
  const summaryParts: string[] = [];

  if (stemEntry && stemInfo) {
    summaryParts.push(
      `${stemInfo.hangul} 일간의 ${friendlyElement(stemEntry.element)} 기운을 바탕으로 ${stemEntry.coreKeywords.slice(0, 2).join(', ')}의 성향이 두드러져요.`,
    );
  }

  if (dominantCategory) {
    summaryParts.push(
      `십성 분포에서는 ${CATEGORY_KOREAN[dominantCategory]} 계열이 강해서, 이 영역의 재능을 잘 살려보면 좋아요.`,
    );
  }

  if (gyeokgukEntry) {
    summaryParts.push(
      `격국은 ${gyeokgukEntry.korean}으로, ${gyeokgukEntry.category} 계열의 삶의 패턴이 자연스럽게 드러나요.`,
    );
  }

  if (summaryParts.length === 0) {
    summaryParts.push('다양한 성향이 조화를 이루는 사주예요.');
  }

  const summary = summaryParts.join(' ');

  return {
    title: '나의 성향',
    traits,
    summary,
  };
}

// ---------------------------------------------------------------------------
//  Helper: find the most representative ten-god code for a category
// ---------------------------------------------------------------------------

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
