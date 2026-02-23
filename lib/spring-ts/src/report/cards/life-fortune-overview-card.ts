/**
 * life-fortune-overview-card.ts -- Build a LifeFortuneOverviewCard from SajuSummary
 *
 * Computes a holistic life fortune rating (1-5 stars) by evaluating
 * yongshin confidence, element balance, shinsal quality, and strength
 * balance. Produces a friendly Korean summary and highlights.
 */

import type { SajuSummary } from '../../types.js';
import type { LifeFortuneOverviewCard, StarRating, ElementCode } from '../types.js';
import {
  STRENGTH_KOREAN,
  elementCodeToKorean,
} from '../common/elementMaps.js';

import type { StrengthLevel } from '../types.js';

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const ALL_ELEMENTS: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

const ELEMENT_FRIENDLY: Record<ElementCode, string> = {
  WOOD: '나무',
  FIRE: '불',
  EARTH: '흙',
  METAL: '쇠',
  WATER: '물',
};

// ---------------------------------------------------------------------------
//  Element normalisation (shared pattern with other cards)
// ---------------------------------------------------------------------------

function normalizeElement(code: string): ElementCode | null {
  const upper = code.toUpperCase();
  if ((ALL_ELEMENTS as readonly string[]).includes(upper)) return upper as ElementCode;
  const firstCharMap: Record<string, ElementCode> = {
    '목': 'WOOD', '화': 'FIRE', '토': 'EARTH', '금': 'METAL', '수': 'WATER',
  };
  return firstCharMap[code.charAt(0)] ?? null;
}

function friendlyElementName(code: string): string {
  const el = normalizeElement(code);
  return el ? ELEMENT_FRIENDLY[el] : elementCodeToKorean(code);
}

/** 한글 마지막 글자 받침 유무에 따라 이에요/예요 선택 */
function ieyo(word: string): string {
  if (!word) return '이에요';
  const last = word.charCodeAt(word.length - 1);
  if (last >= 0xAC00 && last <= 0xD7A3 && (last - 0xAC00) % 28 !== 0) return '이에요';
  return '예요';
}

// ---------------------------------------------------------------------------
//  Scoring helpers
// ---------------------------------------------------------------------------

/**
 * Compute a raw score 0-100 from multiple saju quality signals,
 * then map to a 1-5 star rating.
 *
 * Scoring components (each normalised to 0-25):
 *   1. Yongshin confidence: higher is better
 *   2. Element balance: fewer deficiencies = better
 *   3. Shinsal quality: ratio of auspicious to total
 *   4. Strength balance: BALANCED > STRONG/WEAK > EXTREME
 */
function computeLifeFortuneScore(saju: SajuSummary): number {
  // 1. Yongshin confidence (0-1 mapped to 0-25)
  const yongshinConfidence = Math.min(1, Math.max(0, saju.yongshin.confidence ?? 0));
  const yongshinScore = yongshinConfidence * 25;

  // 2. Element balance (0-25, fewer deficiencies = higher)
  const defCount = saju.deficientElements.length;
  const excessCount = saju.excessiveElements.length;
  const imbalanceCount = defCount + excessCount;
  // 0 imbalance = 25, 1 = 20, 2 = 15, 3 = 10, 4 = 5, 5+ = 0
  const balanceScore = Math.max(0, 25 - imbalanceCount * 5);

  // 3. Shinsal quality (0-25, more auspicious relative to total = higher)
  const shinsalHits = saju.shinsalHits ?? [];
  const totalShinsal = shinsalHits.length;
  let shinsalScore: number;
  if (totalShinsal === 0) {
    // No shinsal data -- neutral, assume moderate score
    shinsalScore = 15;
  } else {
    const auspiciousCount = shinsalHits.filter(
      h => h.grade === 'auspicious' || h.grade === '길신',
    ).length;
    const ratio = auspiciousCount / totalShinsal;
    shinsalScore = ratio * 25;
  }

  // 4. Strength balance (0-25)
  const level = (saju.strength.level ?? '').toUpperCase();
  const strengthScoreMap: Record<string, number> = {
    BALANCED: 25,
    STRONG: 18,
    WEAK: 15,
    EXTREME_STRONG: 8,
    EXTREME_WEAK: 5,
  };
  const strengthScore = strengthScoreMap[level] ?? 12;

  return yongshinScore + balanceScore + shinsalScore + strengthScore;
}

function scoreToStars(score: number): StarRating {
  if (score >= 80) return 5;
  if (score >= 65) return 4;
  if (score >= 45) return 3;
  if (score >= 25) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
//  Summary and highlight generation
// ---------------------------------------------------------------------------

function buildSummary(saju: SajuSummary, stars: StarRating): string {
  const { dayMaster, strength, yongshin, deficientElements } = saju;

  const dayMasterFriendly = friendlyElementName(dayMaster.element);
  const levelKey = strength.level as StrengthLevel;
  const strengthKorean = STRENGTH_KOREAN[levelKey] ?? strength.level;
  const yongshinFriendly = friendlyElementName(yongshin.element);

  const parts: string[] = [];

  // Opening sentence
  if (stars >= 4) {
    parts.push(`${dayMasterFriendly} 기운을 가진 사주로, 전체적으로 좋은 흐름을 타고났어요.`);
  } else if (stars >= 3) {
    parts.push(`${dayMasterFriendly} 기운을 가진 사주로, 안정적인 기본기를 갖추고 있어요.`);
  } else {
    parts.push(`${dayMasterFriendly} 기운을 가진 사주예요. 몇 가지 보완할 점이 있지만 충분히 좋아질 수 있어요.`);
  }

  // Strength context
  parts.push(`에너지 균형은 ${strengthKorean}${ieyo(strengthKorean)}.`);

  // Yongshin guidance
  parts.push(`${yongshinFriendly} 기운을 가까이하면 삶의 흐름이 더 좋아질 수 있어요.`);

  // Deficiency note
  if (deficientElements.length > 0) {
    const names = deficientElements.map(friendlyElementName).join(', ');
    parts.push(`부족한 ${names} 기운을 생활 속에서 조금씩 보충해 보세요.`);
  }

  return parts.join(' ');
}

function buildHighlights(saju: SajuSummary): string[] {
  const highlights: string[] = [];
  const { dayMaster, strength, yongshin, deficientElements, excessiveElements, shinsalHits } = saju;

  const dayMasterFriendly = friendlyElementName(dayMaster.element);
  const levelKey = strength.level as StrengthLevel;
  const strengthKorean = STRENGTH_KOREAN[levelKey] ?? strength.level;
  const yongshinFriendly = friendlyElementName(yongshin.element);

  // Day master highlight
  highlights.push(`일간은 ${dayMasterFriendly} 기운이에요`);

  // Strength highlight
  if (levelKey === 'BALANCED') {
    highlights.push(`에너지 균형이 잘 잡혀 있어요 (${strengthKorean})`);
  } else {
    highlights.push(`에너지 균형은 ${strengthKorean} 상태예요`);
  }

  // Yongshin highlight
  highlights.push(`용신은 ${yongshinFriendly} 기운이에요`);

  // Deficiency/excess
  if (deficientElements.length > 0) {
    const names = deficientElements.map(friendlyElementName).join(', ');
    highlights.push(`${names} 기운이 부족해요`);
  } else if (excessiveElements.length === 0) {
    highlights.push('오행이 고르게 분포되어 있어요');
  }

  if (excessiveElements.length > 0) {
    const names = excessiveElements.map(friendlyElementName).join(', ');
    highlights.push(`${names} 기운이 많은 편이에요`);
  }

  // Shinsal highlight (pick one noteworthy one)
  const goodShinsals = (shinsalHits ?? []).filter(
    h => h.grade === 'auspicious' || h.grade === '길신',
  );
  if (goodShinsals.length > 0) {
    highlights.push(`길신 ${goodShinsals.length}개가 사주에 자리하고 있어요`);
  }

  // Return 3-5 items
  return highlights.slice(0, 5);
}

// ---------------------------------------------------------------------------
//  Public builder
// ---------------------------------------------------------------------------

export function buildLifeFortuneOverviewCard(saju: SajuSummary): LifeFortuneOverviewCard {
  const rawScore = computeLifeFortuneScore(saju);
  const stars = scoreToStars(rawScore);
  const summary = buildSummary(saju, stars);
  const highlights = buildHighlights(saju);

  return {
    title: '인생 운세 총평',
    stars,
    summary,
    highlights,
  };
}
