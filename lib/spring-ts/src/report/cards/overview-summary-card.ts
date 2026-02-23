/**
 * overview-summary-card.ts -- Build an OverviewSummaryCard from SajuSummary
 *
 * Extracts the four pillars, day master identity, strength level,
 * yongshin element, and element balance from the saju analysis
 * and combines them into a concise, friendly-tone summary card.
 */

import type { SajuSummary } from '../../types.js';
import type { OverviewSummaryCard, PillarDisplay, ElementCode } from '../types.js';
import {
  ELEMENT_KOREAN_SHORT,
  ELEMENT_NATURE,
  STRENGTH_KOREAN,
  lookupStemInfo,
  lookupBranchInfo,
  elementCodeToKorean,
} from '../common/elementMaps.js';
import { STEM_ENCYCLOPEDIA } from '../knowledge/stemEncyclopedia.js';
import { STRENGTH_ENCYCLOPEDIA } from '../knowledge/strengthEncyclopedia.js';

import type { StemCode, StrengthLevel } from '../types.js';

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const ALL_ELEMENTS: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

/** User-friendly element name (no Chinese characters) */
const ELEMENT_FRIENDLY: Record<ElementCode, string> = {
  WOOD: '나무',
  FIRE: '불',
  EARTH: '흙',
  METAL: '쇠',
  WATER: '물',
};

const PILLAR_POSITIONS: readonly { key: 'year' | 'month' | 'day' | 'hour'; label: string }[] = [
  { key: 'year', label: '년주' },
  { key: 'month', label: '월주' },
  { key: 'day', label: '일주' },
  { key: 'hour', label: '시주' },
];

// ---------------------------------------------------------------------------
//  Element normalisation
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

/** 한글 마지막 글자에 받침이 있는지 확인 */
function hasBatchim(word: string): boolean {
  if (!word) return false;
  const last = word.charCodeAt(word.length - 1);
  return last >= 0xAC00 && last <= 0xD7A3 && (last - 0xAC00) % 28 !== 0;
}

/** 한글 받침 유무에 따라 와/과 선택 후 두 단어 연결 */
function joinWithGwaWa(a: string, b: string): string {
  if (!a) return b;
  const particle = hasBatchim(a) ? '과' : '와';
  return `${a}${particle} ${b}`;
}

/** 받침 유무에 따라 이/가 선택 */
function iGa(word: string): string {
  return hasBatchim(word) ? '이' : '가';
}

/** 받침 유무에 따라 이에요/예요 선택 (서술격 조사) */
function ieyo(word: string): string {
  return hasBatchim(word) ? '이에요' : '예요';
}

// ---------------------------------------------------------------------------
//  Builder
// ---------------------------------------------------------------------------

export function buildOverviewSummaryCard(saju: SajuSummary): OverviewSummaryCard {
  // ── 1. Four pillars ──
  const pillars: PillarDisplay[] = PILLAR_POSITIONS.map(({ key, label }) => {
    const p = saju.pillars[key];
    const stemInfo = lookupStemInfo(p.stem.code) ?? lookupStemInfo(p.stem.hangul);
    const branchInfo = lookupBranchInfo(p.branch.code) ?? lookupBranchInfo(p.branch.hangul);
    const stemElement = stemInfo?.element
      ? friendlyElementName(stemInfo.element)
      : '';
    const branchElement = branchInfo?.element
      ? friendlyElementName(branchInfo.element)
      : '';
    const elementDesc = stemElement === branchElement
      ? stemElement
      : [stemElement, branchElement].filter(Boolean).join('/');
    return {
      position: label,
      stem: p.stem.hangul,
      branch: p.branch.hangul,
      element: elementDesc,
    };
  });

  // ── 2. Day master description ──
  const { dayMaster, strength, yongshin } = saju;
  const stemInfo = lookupStemInfo(dayMaster.stem);
  const stemCode = stemInfo?.code as StemCode | undefined;
  const stemEntry = stemCode ? STEM_ENCYCLOPEDIA[stemCode] : null;
  const dayMasterEl = normalizeElement(dayMaster.element);
  const dayMasterFriendly = dayMasterEl ? ELEMENT_FRIENDLY[dayMasterEl] : friendlyElementName(dayMaster.element);
  const natureDesc = dayMasterEl ? ELEMENT_NATURE[dayMasterEl] : '';

  const personalitySnippet = stemEntry
    ? stemEntry.personality[0]
    : '';

  const dayMasterDescription = stemInfo
    ? `일간은 ${stemInfo.hangul}${ieyo(stemInfo.hangul)}. ${dayMasterFriendly} 기운을 가지고 있고, ${natureDesc ? natureDesc + '이' : ''} 느껴져요. ${personalitySnippet}`
    : `일간의 오행은 ${dayMasterFriendly}${ieyo(dayMasterFriendly)}.`;

  // ── 3. Strength description ──
  const levelKey = strength.level as StrengthLevel;
  const strengthKorean = STRENGTH_KOREAN[levelKey] ?? strength.level;
  const strengthEntry = STRENGTH_ENCYCLOPEDIA[strength.level] ?? null;
  const strengthMeaning = strengthEntry?.meaning ?? '';

  const strengthDescription = `에너지 균형은 ${strengthKorean}${ieyo(strengthKorean)}. ${strengthMeaning}`;

  // ── 4. Yongshin description ──
  const yongshinEl = normalizeElement(yongshin.element);
  const yongshinFriendly = yongshinEl ? ELEMENT_FRIENDLY[yongshinEl] : friendlyElementName(yongshin.element);
  const yongshinKorean = yongshinEl ? ELEMENT_KOREAN_SHORT[yongshinEl] : elementCodeToKorean(yongshin.element);

  let yongshinDescription = `사주의 균형을 맞춰주는 용신은 ${yongshinFriendly}(${yongshinKorean}) 기운이에요. 이 기운을 일상에서 가까이하면 좋은 흐름을 만들 수 있어요.`;
  if (yongshin.heeshin) {
    const heeshinFriendly = friendlyElementName(yongshin.heeshin);
    yongshinDescription += ` 희신인 ${heeshinFriendly} 기운도 함께 챙기면 더 좋아요.`;
  }

  // ── 5. Element balance ──
  const distribution = saju.elementDistribution;
  const deficient = saju.deficientElements;
  const excessive = saju.excessiveElements;

  const balanceParts: string[] = [];

  // Summarise distribution
  const sortedElements = Object.entries(distribution)
    .sort(([, a], [, b]) => (b as number) - (a as number));
  if (sortedElements.length > 0) {
    const topCount = sortedElements[0][1] as number;
    // Find all elements tied at the top
    const tiedTop = sortedElements
      .filter(([, count]) => (count as number) === topCount)
      .map(([el]) => friendlyElementName(el));
    if (tiedTop.length >= 2) {
      balanceParts.push(`오행 중 ${tiedTop.join(', ')} 기운이 두드러져요`);
    } else {
      balanceParts.push(`오행 중 ${tiedTop[0]} 기운이 가장 강해요`);
    }
  }

  // Find top element codes for dedup
  const topElCodes = new Set(
    sortedElements.length > 0
      ? sortedElements
          .filter(([, count]) => (count as number) === (sortedElements[0][1] as number))
          .map(([el]) => normalizeElement(el))
      : [],
  );

  if (excessive.length > 0) {
    // Skip excessive elements already mentioned as top
    const extraExcessive = excessive.filter((el) => !topElCodes.has(normalizeElement(el)));
    if (extraExcessive.length > 0) {
      const names = extraExcessive.map(friendlyElementName).join(', ');
      balanceParts.push(`${names} 기운이 많은 편이에요`);
    }
  }
  if (deficient.length > 0) {
    const names = deficient.map(friendlyElementName).join(', ');
    balanceParts.push(`${names} 기운은 부족한 편이에요`);
  }

  if (balanceParts.length === 0) {
    balanceParts.push('오행이 비교적 고르게 분포되어 있어요');
  }

  const elementBalance = balanceParts.join('. ') + '.';

  // ── 6. Overall summary ──
  const summaryParts: string[] = [];
  if (stemInfo && stemEntry) {
    const keywords = stemEntry.coreKeywords.slice(0, 2);
    const keywordsJoined = keywords.length === 2
      ? joinWithGwaWa(keywords[0], keywords[1])
      : keywords[0] ?? '';
    summaryParts.push(
      `${stemInfo.hangul} 일간을 중심으로, ${dayMasterFriendly} 기운의 ${keywordsJoined}${iGa(keywordsJoined)} 돋보이는 사주예요.`,
    );
  }
  summaryParts.push(
    `전체 에너지는 ${strengthKorean} 수준이고, ${yongshinFriendly} 기운을 보충하면 더 좋은 균형을 만들 수 있어요.`,
  );
  if (deficient.length > 0) {
    const defNames = deficient.map(friendlyElementName).join(', ');
    summaryParts.push(
      `부족한 ${defNames} 기운을 일상에서 조금씩 채워가면 삶이 더 안정될 수 있어요.`,
    );
  }

  const overallSummary = summaryParts.join(' ');

  return {
    title: '총평 요약',
    pillars,
    dayMasterDescription,
    strengthDescription,
    yongshinDescription,
    elementBalance,
    overallSummary,
  };
}
