/**
 * overview-summary-card.ts -- Build an OverviewSummaryCard from SajuSummary
 *
 * Extracts the four pillars, day master identity, strength level,
 * yongshin element, and element balance from the saju analysis
 * and combines them into a concise, friendly-tone summary card.
 */

import type { SajuSummary, SajuAxisStrengthMap, EvidenceRow, SajuOutputSummary, CounterexampleRow } from '../../types.js';
import type { OverviewSummaryCard, PillarDisplay, ElementCode } from '../types.js';

/** PR10 — options forwarded from buildFortuneReport. */
export interface OverviewSummaryCardOptions {
  readonly narrativeStyle?: 'expert' | 'plain' | 'counselor' | 'sideBySide';
}
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
import { GYEOKGUK_ENCYCLOPEDIA } from '../knowledge/gyeokgukEncyclopedia.js';

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

const PILLAR_UNCERTAINTY_AXIS = {
  year: 'yearPillar',
  month: 'monthPillar',
  day: 'dayPillar',
  hour: 'hourPillar',
} as const;

const INPUT_AXIS_LABELS: Readonly<Record<string, string>> = {
  yearPillar: '연주',
  monthPillar: '월주',
  dayPillar: '일주',
  hourPillar: '시주',
  yongshin: '용신 후보',
  gyeokguk: '격국',
  strength: '신강약',
  tenGod: '십성 위치',
  relations: '천간·지지 관계',
  shinsal: '신살·공망',
  fortuneTiming: '운세 시점',
};

const GYEOKGUK_RULE_LABELS: Readonly<Record<string, string>> = {
  MONTH_BRANCH_DAMAGED: '월지가 충·형·해 등으로 흔들리는 신호',
};

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

function friendlyConflictLevel(level: string): string {
  return {
    none: '낮음',
    low: '낮음',
    medium: '중간',
    high: '높음',
  }[level] ?? level;
}

function formatOneDecimal(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '자료 없음';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatConfidence(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '자료 없음';
  return `${Math.round(n)} / 100`;
}

function formatGyeokgukRule(rule: string): string {
  if (GYEOKGUK_RULE_LABELS[rule]) return GYEOKGUK_RULE_LABELS[rule];
  const [key, rawValue] = rule.split(':');
  if (key === 'blocking' && rawValue && GYEOKGUK_RULE_LABELS[rawValue]) {
    return GYEOKGUK_RULE_LABELS[rawValue];
  }
  if (key === 'monthHiddenStem' && rawValue) {
    const stem = lookupStemInfo(rawValue);
    return `월지 지장간: ${stem?.hangul ?? rawValue}`;
  }
  if (key === 'role' && rawValue) {
    const role = {
      MAIN: '정기',
      MIDDLE: '중기',
      RESIDUAL: '여기',
    }[rawValue] ?? rawValue;
    return `지장간 역할: ${role}`;
  }
  if (key === 'weight' && rawValue) return `반영 비중: ${rawValue}`;
  if (rule === 'MAIN') return '월지 정기 기준';
  if (rule === 'VISIBLE' || rule === 'visibleInChart') return '원국에 드러난 기운';
  return rule;
}

function formatInputAxisLabels(axes: readonly string[] | undefined): string {
  const labels = (axes ?? []).map((axis) => INPUT_AXIS_LABELS[axis] ?? axis);
  return labels.length > 0 ? labels.join(', ') : '시간 관련 해석';
}

function formatPillarElementPair(stemElement: string, branchElement: string): string {
  if (stemElement && branchElement) return `${stemElement}/${branchElement}`;
  return stemElement || branchElement;
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

/** 받침 유무에 따라 로/으로 선택 (받침 ㄹ은 로). */
function roEuro(word: string): string {
  if (!word) return '로';
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xAC00 || last > 0xD7A3) return '로';
  const batchimIdx = (last - 0xAC00) % 28;
  // 0 = no batchim, 8 = ㄹ → 로; otherwise 으로
  return batchimIdx === 0 || batchimIdx === 8 ? '로' : '으로';
}

// ---------------------------------------------------------------------------
//  Builder
// ---------------------------------------------------------------------------

export function buildOverviewSummaryCard(
  saju: SajuSummary,
  options?: OverviewSummaryCardOptions,
): OverviewSummaryCard {
  const unknownHour = saju.inputUncertainty?.unknownHour;
  const unknownMinute = saju.inputUncertainty?.unknownMinute;
  const isPillarProvisional = (key: keyof typeof PILLAR_UNCERTAINTY_AXIS): boolean => {
    const axis = PILLAR_UNCERTAINTY_AXIS[key];
    return unknownHour?.affectedAxes.includes(axis) === true
      || (unknownMinute?.boundarySensitive === true
        && unknownMinute.affectedAxes.includes(axis));
  };
  const dayPillarUncertain = isPillarProvisional('day');

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
    const elementDesc = formatPillarElementPair(stemElement, branchElement);
    return {
      position: isPillarProvisional(key)
        ? `${label}(임시)`
        : label,
      stem: p.stem.hangul,
      branch: p.branch.hangul,
      element: elementDesc,
    };
  });

  // ── 2. Day master description ──
  const { dayMaster, strength, yongshin } = saju;
  const yongshinConsensus = saju.yongshinConsensus ?? yongshin.consensus;
  const stemInfo = lookupStemInfo(dayMaster.stem);
  const stemCode = stemInfo?.code as StemCode | undefined;
  const stemEntry = stemCode ? STEM_ENCYCLOPEDIA[stemCode] : null;
  const dayMasterEl = normalizeElement(dayMaster.element);
  const dayMasterFriendly = dayMasterEl ? ELEMENT_FRIENDLY[dayMasterEl] : friendlyElementName(dayMaster.element);
  const natureDesc = dayMasterEl ? ELEMENT_NATURE[dayMasterEl] : '';

  const personalitySnippet = stemEntry
    ? stemEntry.personality[0]
    : '';

  const baseDayMasterDescription = stemInfo
    ? `일간은 ${stemInfo.hangul}${ieyo(stemInfo.hangul)}. ${dayMasterFriendly} 기운을 가지고 있고, ${natureDesc ? natureDesc + '이' : ''} 느껴져요. ${personalitySnippet}`
    : `일간의 오행은 ${dayMasterFriendly}${ieyo(dayMasterFriendly)}.`;
  const dayMasterDescription = dayPillarUncertain
    ? `임시 계산 기준입니다. ${unknownHour
        ? '출생 시각 정보에 따라 일주와 일간이 달라질 수 있습니다.'
        : '출생 분 정보에 따라 일주와 일간이 달라질 수 있습니다.'} ${baseDayMasterDescription}`
    : baseDayMasterDescription;

  // ── 3. Strength description ──
  const levelKey = strength.level as StrengthLevel;
  const strengthKorean = STRENGTH_KOREAN[levelKey] ?? strength.level;
  const strengthEntry = STRENGTH_ENCYCLOPEDIA[strength.level] ?? null;
  const strengthMeaning = strengthEntry?.meaning ?? '';

  const strengthDescription = `에너지 균형은 ${strengthKorean}${ieyo(strengthKorean)}. ${strengthMeaning}`.trim();

  // ── 4. Yongshin description ──
  const yongshinEl = normalizeElement(yongshin.element);
  const yongshinFriendly = yongshinEl ? ELEMENT_FRIENDLY[yongshinEl] : friendlyElementName(yongshin.element);
  const yongshinKorean = yongshinEl ? ELEMENT_KOREAN_SHORT[yongshinEl] : elementCodeToKorean(yongshin.element);
  const sajuOutput = saju as unknown as { axisStrength?: SajuAxisStrengthMap };
  const axisStrength = sajuOutput.axisStrength;
  const yongshinTier = axisStrength?.yongshin;
  const yongshinConflict = yongshinConsensus?.final?.conflictLevel;
  const hedgeYongshin =
    yongshinTier === 'candidate' ||
    yongshinTier === 'deferred' ||
    yongshinConflict === 'high' ||
    Boolean(unknownHour) ||
    (unknownMinute?.boundarySensitive === true
      && unknownMinute.affectedAxes.includes('yongshin'));

  let yongshinDescription = hedgeYongshin
    ? `사주의 균형을 맞춰주는 용신 후보는 ${yongshinFriendly}(${yongshinKorean}) 기운이에요. 출생 시각이나 판단 축에 따라 보조 기운이 달라질 수 있어 참고 기준으로 보는 것이 좋아요.`
    : `사주의 균형을 맞춰주는 용신은 ${yongshinFriendly}(${yongshinKorean}) 기운이에요. 이 기운을 일상에서 가까이하면 좋은 흐름을 만들 수 있어요.`;
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
  summaryParts.push(hedgeYongshin
    ? `전체 에너지는 ${strengthKorean} 수준이고, ${yongshinFriendly} 기운은 중요한 보완 후보로 참고하면 좋아요.`
    : `전체 에너지는 ${strengthKorean} 수준이고, ${yongshinFriendly} 기운을 보충하면 더 좋은 균형을 만들 수 있어요.`);
  if (deficient.length > 0) {
    const defNames = deficient.map(friendlyElementName).join(', ');
    summaryParts.push(
      `부족한 ${defNames} 기운을 일상에서 조금씩 채워가면 삶이 더 안정될 수 있어요.`,
    );
  }

  const baseOverallSummary = summaryParts.join(' ');
  const overallSummary = dayPillarUncertain
    ? `임시 계산 기준 요약입니다. ${unknownHour
        ? '출생 시각 정보에 따라 일주·일간 중심 해석이 달라질 수 있습니다.'
        : '출생 분 정보에 따라 일주·일간 중심 해석이 달라질 수 있습니다.'} ${baseOverallSummary}`
    : baseOverallSummary;

  // ── 7. Narrative foundations (PR9) ─────────────────────────────────────
  // Surface the upstream judgment-strength + per-claim evidence so a UI
  // (or a future audience-translation layer) can adapt the wording: a
  // 'definite' yongshin is stated as fact, a 'candidate' one is hedged.
  const evidence: EvidenceRow[] = [];

  if (unknownHour) {
    evidence.push({
      axis: 'inputTime',
      claim: unknownHour.message,
      supportingFeatures: [
        `임시 계산 시각: ${String(unknownHour.fallbackHour).padStart(2, '0')}:${String(unknownHour.fallbackMinute).padStart(2, '0')}`,
        `영향을 받을 수 있는 항목: ${formatInputAxisLabels(unknownHour.affectedAxisLabels ?? unknownHour.affectedAxes)}`,
      ],
      weakness: '출생 시각이 확인되면 시주, 용신, 격국, 신강약, 십성 위치, 운세 시점 해석이 달라질 수 있어요.',
      strength: 'candidate',
    });
  }

  if (unknownMinute) {
    evidence.push({
      axis: 'inputTime',
      claim: unknownMinute.message,
      supportingFeatures: [
        `적용 계산 시각: ${String(unknownMinute.fallbackHour).padStart(2, '0')}:${String(unknownMinute.fallbackMinute).padStart(2, '0')}`,
        `검토한 분 범위: ${String(unknownMinute.evaluatedMinuteRange.from).padStart(2, '0')}~${String(unknownMinute.evaluatedMinuteRange.to).padStart(2, '0')}`,
        unknownMinute.boundarySensitive
          ? `경계 영향 가능 항목: ${formatInputAxisLabels(unknownMinute.affectedAxisLabels ?? unknownMinute.affectedAxes)}`
          : '선택한 시간 보정 정책에서 분 범위 내 이산 사주 결과가 동일함',
        '대운 시작 연령·UTC 같은 연속 운세 시점 정밀도는 출생 분에 따라 달라질 수 있음',
      ],
      weakness: unknownMinute.boundarySensitive
        ? '정확한 출생 분을 확인하면 경계에 걸린 항목의 해석이 달라질 수 있습니다.'
        : '정확한 출생 분은 입력 보정 기록을 완성하기 위해 여전히 필요합니다.',
      strength: unknownMinute.boundarySensitive ? 'candidate' : 'practical',
    });
  }

  // Day master row — anchored on yongshin + strength axes.
  if (stemInfo) {
    const supportingFeatures: string[] = [
      `${stemInfo.hangul} 일간 - ${dayMasterFriendly} 기운`,
    ];
    if (stemEntry) supportingFeatures.push(`기본 성향: ${stemEntry.coreKeywords.slice(0, 2).join(', ')}`);
    evidence.push({
      axis: 'dayMaster',
      claim: dayMasterDescription,
      supportingFeatures,
      strength: axisStrength?.strength,
    });
  }

  // Strength row — independent claim, 4-tier strength from axisStrength.
  evidence.push({
    axis: 'strength',
    claim: strengthDescription,
    supportingFeatures: [
      `도움 기운: ${formatOneDecimal(strength.totalSupport)}`,
      `부담 기운: ${formatOneDecimal(strength.totalOppose)}`,
      `강약 판단: ${strengthKorean}`,
    ],
    strength: axisStrength?.strength,
  });

  // Yongshin row — 4-tier strength from axisStrength.yongshin. Hedge wording
  // when 'candidate' / 'deferred' so we don't overclaim a low-confidence yongshin.
  const isHedged = hedgeYongshin;
  const consensusAxes = yongshinConsensus
    ? ([
        ['억부', yongshinConsensus.eokbu.element],
        ['조후', yongshinConsensus.johu.element],
        ['격국', yongshinConsensus.gyeokguk.element],
        ['통관', yongshinConsensus.tonggwan.element],
        ['병약', yongshinConsensus.byeongyak.element],
        ['식상 흐름', yongshinConsensus.siksangFlow.element],
      ] as const)
        .filter(([, element]) => Boolean(element))
        .map(([axis, element]) => `${axis}:${friendlyElementName(String(element))}`)
    : [];
  const consensusWeakness = yongshinConsensus && yongshinConsensus.final.conflictLevel !== 'none'
    ? `용신 판단이 서로 갈리는 지점이 있어요: ${yongshinConsensus.final.competingElements.map((el) => friendlyElementName(String(el))).join(', ')}`
    : undefined;
  evidence.push({
    axis: 'yongshin',
    claim: isHedged
      ? `${yongshinDescription} (다만 용신 신뢰도가 낮은 편이라 다른 보조 기운도 함께 살펴보세요.)`
      : yongshinDescription,
      supportingFeatures: [
        `용신 후보: ${friendlyElementName(String(yongshin.element))}`,
        `신뢰도: ${formatConfidence(yongshin.confidence)}`,
        ...(yongshinConsensus ? [
        `용신 판단 충돌: ${friendlyConflictLevel(yongshinConsensus.final.conflictLevel)}`,
        `판단 축별 후보: ${consensusAxes.join(', ') || '없음'}`,
      ] : []),
      ...(yongshin.heeshin ? [`희신: ${friendlyElementName(String(yongshin.heeshin))}`] : []),
    ],
    weakness: isHedged
      ? '용신 신뢰도가 낮은 편이라 차트에 따라 조후·통관 같은 보조 해석도 함께 보는 것이 안전해요.'
      : consensusWeakness,
    strength: yongshinTier,
  });

  // Gyeokguk row — PR-J-4. Surfaces the 격국 success-rule encyclopedia entry
  // (PR-J-1) so the report's evidence layer carries classical principle /
  // helpful / disease / remedy alongside the simpler pillar/strength/yongshin
  // claims. Only emitted when the encyclopedia has a matching `korean`
  // entry; that's true for the 10 정격 with PR-J-1 fields populated and
  // silent for the 9 별격 (PR-J-1's chengbai-only sourcing).
  //
  // SajuSummary.gyeokguk.type carries the Korean label ('식신격', '비견격',
  // …); we match it against encyclopedia entries by their `korean` field
  // so the wire is robust to enum-vs-Korean shape mismatches.
  const gyeokgukType = saju.gyeokguk?.type;
  const gyeokgukEntry = gyeokgukType
    ? Object.values(GYEOKGUK_ENCYCLOPEDIA).find((entry) => entry.korean === gyeokgukType)
    : undefined;
  if (gyeokgukEntry?.principle) {
    const gyeokgukSupporting: string[] = [`격국: ${gyeokgukEntry.korean}`];
    if (gyeokgukEntry.helpful?.length) {
      gyeokgukSupporting.push(`성(成) 조건: ${gyeokgukEntry.helpful[0]}`);
    }
    const gyeokgukWeakness = gyeokgukEntry.disease?.[0];
    evidence.push({
      axis: 'gyeokguk',
      claim: gyeokgukEntry.principle,
      supportingFeatures: gyeokgukSupporting,
      weakness: gyeokgukWeakness,
      strength: axisStrength?.gyeokguk,
    });
  }

  // ── 8. Narrative styles + counterexamples (PR10) ──────────────────────
  // Gyeokguk candidate disagreement row. Evidence-only; selected gyeokguk stays unchanged.
  const gyeokgukCandidates = saju.gyeokguk?.candidates ?? [];
  const alternativeGyeokgukCandidates = gyeokgukCandidates
    .filter((candidate) =>
      candidate.type &&
      candidate.type !== gyeokgukType &&
      (candidate.score > 0 || candidate.confidence > 0))
    .slice(0, 3);
  if (alternativeGyeokgukCandidates.length > 0) {
    const candidateNotes = alternativeGyeokgukCandidates.map((candidate) => {
      const support = candidate.supportingRules.slice(0, 3).map(formatGyeokgukRule).join(', ');
      const confidencePct = Math.round(candidate.confidence * 100);
      return support
        ? `${candidate.type} 후보(점수 ${candidate.score.toFixed(3)}, 신뢰도 ${confidencePct}%): ${support}`
        : `${candidate.type} 후보(점수 ${candidate.score.toFixed(3)}, 신뢰도 ${confidencePct}%)`;
    });
    const blockingNotes = alternativeGyeokgukCandidates
      .flatMap((candidate) => candidate.blockingRules)
      .map(formatGyeokgukRule)
      .slice(0, 4);
    evidence.push({
      axis: 'gyeokgukCandidates',
      claim: '격국 후보 간 이견이 있어 선택 격국은 보조 후보와 함께 보는 것이 안전해요.',
      supportingFeatures: [
        `선택 격국: ${gyeokgukType ?? '-'}`,
        ...candidateNotes,
      ],
      weakness: blockingNotes.length > 0 ? blockingNotes.join(' / ') : undefined,
      strength: axisStrength?.gyeokguk,
    });
  }

  // The plain style is the existing tone (already in `overallSummary`).
  // 'expert' uses classical 명리 terminology; 'counselor' uses flowing
  // counselor paragraphs. 'sideBySide' populates both expert and plain.
  const style = options?.narrativeStyle;
  const includeExpert    = style === 'expert'    || style === 'sideBySide';
  const includePlain     = style === 'plain'     || style === 'sideBySide';
  const includeCounselor = style === 'counselor';

  const expertText = includeExpert
    ? buildExpertOverviewText({
        stemHangul: stemInfo?.hangul ?? dayMaster.stem,
        dayMasterEl,
        strengthLevelKorean: strengthKorean,
        yongshinElementCode: yongshin.element,
        yongshinKorean,
        gyeokgukType: saju.gyeokguk?.type ?? '',
      })
    : undefined;
  const plainText     = includePlain ? overallSummary : undefined;
  const counselorText = includeCounselor
    ? buildCounselorOverviewText(stemInfo?.hangul ?? dayMaster.stem, yongshinFriendly, strengthKorean)
    : undefined;

  // Counterexamples — currently surfaced when yongshin is low-confidence so a
  // user / counselor can see which condition would flip the recommendation.
  // Voice (NARRATIVE_STYLE_GUIDE §1): 단정 회피 + 권유·제안 어조 (~보면 좋아요).
  const counterexamples: CounterexampleRow[] | undefined =
    yongshinTier === 'candidate' || yongshinTier === 'deferred'
      ? [
          {
            condition: '월령(月令)이 지장간 중 정기와 어긋나거나, 격국 안정성이 낮은 경우',
            revisedClaim: `용신을 ${yongshinFriendly}${roEuro(yongshinFriendly)} 단정하기보다, 조후·통관 후보를 함께 살펴보면 좋아요.`,
            appliesWhen: yongshinTier,
          },
          {
            condition: '시간 미상 또는 입절 경계(±1 일) 이내 출생인 경우',
            revisedClaim: '시진 변경 시 격국·용신 후보가 달라질 수 있어, 두 가지 가능성을 함께 살펴보면 좋아요.',
            appliesWhen: yongshinTier,
          },
        ]
      : undefined;

  return {
    title: '총평 요약',
    pillars,
    dayMasterDescription,
    strengthDescription,
    yongshinDescription,
    elementBalance,
    overallSummary,
    axisStrength,
    evidence,
    expertText,
    plainText,
    counselorText,
    counterexamples,
  };
}

// ---------------------------------------------------------------------------
//  Narrative style helpers (PR10)
// ---------------------------------------------------------------------------

/** Classical 명리 terminology version of the overview. */
function buildExpertOverviewText(args: {
  stemHangul: string;
  dayMasterEl: ElementCode | null;
  strengthLevelKorean: string;
  yongshinElementCode: string;
  yongshinKorean: string;
  gyeokgukType: string;
}): string {
  const elKo = args.dayMasterEl ? ELEMENT_KOREAN_SHORT[args.dayMasterEl] : '';
  const segments: string[] = [];
  segments.push(`일간 ${args.stemHangul}(${elKo}). 신강·신약 판정: ${args.strengthLevelKorean}.`);
  if (args.gyeokgukType) {
    segments.push(`격국: ${args.gyeokgukType}.`);
  }
  segments.push(`용신: ${friendlyElementName(args.yongshinElementCode)} 기운.`);
  return segments.join(' ');
}

/** Counselor-tone flowing paragraph. */
function buildCounselorOverviewText(
  stemHangul: string,
  yongshinFriendly: string,
  strengthKorean: string,
): string {
  return `${stemHangul} 일간으로 보면, 지금의 에너지 흐름은 ${strengthKorean} 쪽에 가깝습니다. ${yongshinFriendly} 기운을 일상에 조금씩 들이는 편이 큰 흐름과 잘 맞아요. 큰 결정 앞에서는 이 방향을 기준으로 삼으면 흔들리지 않게 됩니다.`;
}
