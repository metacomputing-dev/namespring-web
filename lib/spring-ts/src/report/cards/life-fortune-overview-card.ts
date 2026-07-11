/**
 * life-fortune-overview-card.ts -- Build a LifeFortuneOverviewCard from SajuSummary
 *
 * Computes a holistic life fortune rating (1-5 stars) by evaluating
 * yongshin confidence, element balance, shinsal quality, and strength
 * balance. Produces a friendly Korean summary and highlights.
 */

import type { SajuSummary, EvidenceRow, SajuAxisStrengthMap } from '../../types.js';
import { pointsToRatio } from '../../saju/confidence-units.js';
import type { LifeFortuneOverviewCard, StarRating, ElementCode } from '../types.js';
import {
  STRENGTH_KOREAN,
  elementCodeToKorean,
} from '../common/elementMaps.js';
import { findGyeokgukEntry } from '../knowledge/gyeokgukEncyclopedia.js';

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

function shouldHedgeYongshin(saju: SajuSummary): boolean {
  const tier = saju.axisStrength?.yongshin;
  const conflict = (saju.yongshinConsensus ?? saju.yongshin.consensus)?.final?.conflictLevel;
  return tier === 'candidate' || tier === 'deferred' || conflict === 'high';
}

function normalizeStrengthLevel(level: string): StrengthLevel | null {
  const baseLevel = level.replace(/\(.+\)$/, '').trim();
  const normalized = baseLevel.toUpperCase();
  if (['EXTREME_STRONG', 'STRONG', 'BALANCED', 'WEAK', 'EXTREME_WEAK'].includes(normalized)) {
    return normalized as StrengthLevel;
  }
  const koreanMap: Record<string, StrengthLevel> = {
    극신강: 'EXTREME_STRONG',
    신강: 'STRONG',
    중화: 'BALANCED',
    신약: 'WEAK',
    극신약: 'EXTREME_WEAK',
  };
  return koreanMap[baseLevel] ?? null;
}

function strengthDisplayName(level: string): string {
  if (/[가-힣]/.test(level)) return level;
  const normalized = normalizeStrengthLevel(level);
  return normalized ? STRENGTH_KOREAN[normalized] : level;
}

function shinsalPolarity(grade: string): 'auspicious' | 'inauspicious' | null {
  if (grade === 'auspicious' || grade === '길신') return 'auspicious';
  if (grade === 'inauspicious' || grade === '흉살') return 'inauspicious';
  return null;
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
  // 1. Public SajuSummary confidence is 0..100 points; scoring uses 0..1.
  const yongshinConfidence = pointsToRatio(saju.yongshin.confidence);
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
    const polarityRows = shinsalHits
      .map((hit) => shinsalPolarity(hit.grade))
      .filter((polarity): polarity is 'auspicious' | 'inauspicious' => polarity != null);
    if (polarityRows.length === 0) {
      // A/B/C grades are importance grades from the weighted shinsal adapter,
      // not good/bad polarity. Treat them as neutral instead of a 0 score.
      shinsalScore = 15;
    } else {
      const auspiciousCount = polarityRows.filter((polarity) => polarity === 'auspicious').length;
      shinsalScore = (auspiciousCount / polarityRows.length) * 25;
    }
  }

  // 4. Strength balance (0-25)
  const level = normalizeStrengthLevel(saju.strength.level ?? '');
  const strengthScoreMap: Record<StrengthLevel, number> = {
    BALANCED: 25,
    STRONG: 18,
    WEAK: 15,
    EXTREME_STRONG: 8,
    EXTREME_WEAK: 5,
  };
  const strengthScore = level ? strengthScoreMap[level] : 12;

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
  const levelKey = normalizeStrengthLevel(strength.level) ?? (strength.level as StrengthLevel);
  const strengthKorean = strengthDisplayName(strength.level);
  const yongshinFriendly = friendlyElementName(yongshin.element);
  const hedgeYongshin = shouldHedgeYongshin(saju);

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
  if (hedgeYongshin) {
    parts.push(`${yongshinFriendly} 기운은 중요한 보완 후보지만, 다른 보조 기운과 함께 살펴보면 더 안전해요.`);
  } else {
    parts.push(`${yongshinFriendly} 기운을 가까이하면 삶의 호흡이 한층 부드러워져요.`);
  }

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
  const levelKey = normalizeStrengthLevel(strength.level) ?? (strength.level as StrengthLevel);
  const strengthKorean = strengthDisplayName(strength.level);
  const yongshinFriendly = friendlyElementName(yongshin.element);
  const hedgeYongshin = shouldHedgeYongshin(saju);

  // Day master highlight
  highlights.push(`일간은 ${dayMasterFriendly} 기운이에요`);

  // Strength highlight
  if (levelKey === 'BALANCED') {
    highlights.push(`에너지 균형이 잘 잡혀 있어요 (${strengthKorean})`);
  } else {
    highlights.push(`에너지 균형은 ${strengthKorean} 상태예요`);
  }

  // Yongshin highlight
  highlights.push(hedgeYongshin
    ? `용신 후보는 ${yongshinFriendly} 기운이에요`
    : `용신은 ${yongshinFriendly} 기운이에요`);

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

  // ── PR-J-5c — narrative foundations (axisStrength + evidence) ──
  const sajuAxis = (saju as unknown as { axisStrength?: SajuAxisStrengthMap }).axisStrength;
  const evidence: EvidenceRow[] = [];

  // Yongshin row — anchors the "왜 이 별점인가" rationale on the user's
  // primary balancing element. Hedge wording when the yongshin tier is
  // 'candidate' / 'deferred' so a low-confidence yongshin doesn't drive
  // an over-confident life-fortune narrative.
  const yongshinTier = sajuAxis?.yongshin;
  const yongshinElement = saju.yongshin?.element;
  if (yongshinElement) {
    const yongshinKorean = friendlyElementName(yongshinElement);
    const heeshinKorean = saju.yongshin?.heeshin ? friendlyElementName(saju.yongshin.heeshin) : null;
    const isHedged = yongshinTier === 'candidate' || yongshinTier === 'deferred';
    evidence.push({
      axis: 'yongshin',
      claim: isHedged
        ? `용신 후보는 ${yongshinKorean} 기운이에요. 신뢰도가 낮아 보조 기운도 함께 살펴보세요.`
        : `용신은 ${yongshinKorean} 기운이에요. 균형의 핵심 기운으로 활용하면 운세가 견고해져요.`,
      supportingFeatures: [
        `용신 후보: ${yongshinKorean}`,
        ...(heeshinKorean ? [`희신: ${heeshinKorean}`] : []),
      ],
      weakness: isHedged
        ? '용신 신뢰도가 낮은 편이라 조후·통관 같은 보조 해석을 함께 살펴보면 더 안전해요.'
        : undefined,
      strength: yongshinTier,
    });
  }

  // Gyeokguk row — same shape as overview / personality wires.
  const gyeokgukEntry = findGyeokgukEntry(saju.gyeokguk?.type);
  if (gyeokgukEntry?.principle) {
    const supporting: string[] = [`격국: ${gyeokgukEntry.korean}`];
    if (gyeokgukEntry.helpful?.length) {
      supporting.push(`성(成) 조건: ${gyeokgukEntry.helpful[0]}`);
    }
    evidence.push({
      axis: 'gyeokguk',
      claim: gyeokgukEntry.principle,
      supportingFeatures: supporting,
      weakness: gyeokgukEntry.disease?.[0],
      strength: sajuAxis?.gyeokguk,
    });
  }

  return {
    title: '인생 운세 총평',
    stars,
    summary,
    highlights,
    axisStrength: sajuAxis,
    evidence: evidence.length > 0 ? evidence : undefined,
  };
}
