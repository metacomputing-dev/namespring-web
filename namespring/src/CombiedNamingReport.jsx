import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReportActionButtons,
  ReportPrintOverlay,
  ReportScrollTopFab,
  ReportShareDialog,
  useReportActions,
} from './report-common-ui';
import NamingResultRenderer from './NamingResultRenderer';
import {
  StarRating,
} from './report-modules-ui';
import { SajuPillarTable } from './components/report/ReportPrimitives';
import { PREMIUM_ACCESS_STORAGE_KEY } from '../shared/types/payment';

const TIERED_PERIOD_OPTIONS = [
  { key: 'today', periodKind: 'today', label: '오늘' },
  { key: 'thisWeek', periodKind: 'thisWeek', label: '이번주' },
  { key: 'thisMonth', periodKind: 'thisMonth', label: '이번달' },
  { key: 'thisYear', periodKind: 'thisYear', label: '올해' },
];

const LIFE_STAGE_PERIOD_OPTIONS = Array.from({ length: 10 }, (_, index) => {
  const startAge = 10 + index * 10;
  const endAge = startAge + 9;
  const ageBand = `${startAge}-${endAge}`;
  return {
    key: `life-${ageBand}`,
    periodKind: 'life',
    label: `${startAge}~${endAge}세`,
    ageBand,
    startAge,
    endAge,
    isLifeStage: true,
  };
});

const TIERED_CATEGORY_OPTIONS = [
  { id: 'overall', title: '총 운', subtitle: '전체적인 운세', tone: 'warn' },
  { id: 'wealth', title: '재물운', subtitle: '돈과 물건 관리', tone: 'success' },
  { id: 'health', title: '건강운', subtitle: '몸과 마음의 리듬', tone: 'danger' },
  { id: 'academic', title: '학업운', subtitle: '공부와 배움', tone: 'info' },
  { id: 'romance', title: '연애/결혼운', subtitle: '관계와 마음', tone: 'indigo' },
  { id: 'family', title: '가족운', subtitle: '가족 관계', tone: 'cyan' },
];

const DETAIL_TAG_LIMIT = 12;
const PREMIUM_ACCESS_VALUE = 'paid';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toStars(value) {
  return clamp(Number(value) || 0, 1, 5);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function joinNameText(items, key) {
  return asArray(items).map((item) => String(item?.[key] ?? '')).join('');
}

function getNameLabelFromUserInfo(shareUserInfo) {
  const fullHangul = `${joinNameText(shareUserInfo?.lastName, 'hangul')}${joinNameText(shareUserInfo?.firstName, 'hangul')}`;
  const fullHanja = `${joinNameText(shareUserInfo?.lastName, 'hanja')}${joinNameText(shareUserInfo?.firstName, 'hanja')}`;
  if (!fullHangul && !fullHanja) return '이름 정보 없음';
  return `${fullHangul || '-'}${fullHanja ? ` (${fullHanja})` : ''}`;
}

function getNamePartsFromUserInfo(shareUserInfo) {
  const hangul = `${joinNameText(shareUserInfo?.lastName, 'hangul')}${joinNameText(shareUserInfo?.firstName, 'hangul')}`;
  const hanja = `${joinNameText(shareUserInfo?.lastName, 'hanja')}${joinNameText(shareUserInfo?.firstName, 'hanja')}`;
  return {
    hangul: hangul || '이름 정보 없음',
    hanja,
    label: getNameLabelFromUserInfo(shareUserInfo),
  };
}

function formatGenderLabel(gender) {
  if (gender === 'female') return '여성';
  if (gender === 'male') return '남성';
  return '성별 정보 없음';
}

function formatBirthDateTimeLabel(shareUserInfo) {
  const birth = shareUserInfo?.birthDateTime;
  const year = Number(birth?.year);
  const month = Number(birth?.month);
  const day = Number(birth?.day);
  const hour = Number(birth?.hour);
  const minute = Number(birth?.minute);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return '생년월일 정보 없음';
  }
  const date = `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
  const calendar = shareUserInfo?.isSolarCalendar === false ? '음력' : '양력';
  if (shareUserInfo?.isBirthTimeUnknown) return `${date} · 시각 미상 · ${calendar}`;
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return `${date} · ${calendar}`;
  return `${date} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} · ${calendar}`;
}

function scoreNumber(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function scoreStateLabel(score) {
  const safeScore = scoreNumber(score);
  if (safeScore >= 85) return '강한 조화';
  if (safeScore >= 70) return '좋은 조화';
  if (safeScore >= 55) return '균형형';
  if (safeScore > 0) return '보완 필요';
  return '분석 대기';
}

function compactText(value, fallback = '-') {
  return firstSentence(value) || fallback;
}

function buildPillarColumns(pillars) {
  const labels = ['년주', '월주', '일주', '시주'];
  const list = asArray(pillars).slice(0, 4);
  while (list.length < 4) list.push(null);
  return list.map((pillar, index) => {
    const { stemElement, branchElement } = splitPillarElements(pillar?.element);
    return {
      key: `pillar-${index}`,
      label: pillar?.position || labels[index],
      stem: pillar?.stem || '-',
      branch: pillar?.branch || '-',
      stemElement: stemElement || '-',
      branchElement: branchElement || '-',
      stemElementKey: normalizeElementKey(stemElement),
      branchElementKey: normalizeElementKey(branchElement),
    };
  });
}

function toRendererElementKey(value) {
  const key = normalizeElementKey(value);
  if (key === 'WOOD') return 'Wood';
  if (key === 'FIRE') return 'Fire';
  if (key === 'EARTH') return 'Earth';
  if (key === 'METAL') return 'Metal';
  if (key === 'WATER') return 'Water';
  return '';
}

const STEM_POLARITY = {
  갑: 'yang',
  병: 'yang',
  무: 'yang',
  경: 'yang',
  임: 'yang',
  을: 'yin',
  정: 'yin',
  기: 'yin',
  신: 'yin',
  계: 'yin',
};

const BRANCH_POLARITY = {
  자: 'yang',
  인: 'yang',
  진: 'yang',
  오: 'yang',
  신: 'yang',
  술: 'yang',
  축: 'yin',
  묘: 'yin',
  사: 'yin',
  미: 'yin',
  유: 'yin',
  해: 'yin',
};

function buildCombinedSajuRenderMetrics(overview, shareUserInfo, nameCompatibility) {
  const elementCounts = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  let positiveCount = 0;
  let negativeCount = 0;

  asArray(overview?.pillars).forEach((pillar) => {
    const { stemElement, branchElement } = splitPillarElements(pillar?.element);
    [stemElement, branchElement].forEach((element) => {
      const key = toRendererElementKey(element);
      if (key) elementCounts[key] += 1;
    });

    const stemPolarity = STEM_POLARITY[String(pillar?.stem ?? '').trim()];
    const branchPolarity = BRANCH_POLARITY[String(pillar?.branch ?? '').trim()];
    if (stemPolarity === 'yang') positiveCount += 1;
    if (stemPolarity === 'yin') negativeCount += 1;
    if (branchPolarity === 'yang') positiveCount += 1;
    if (branchPolarity === 'yin') negativeCount += 1;
  });

  return {
    elementCounts,
    positiveCount,
    negativeCount,
    score: nameCompatibility?.overallScore ?? '',
    displayHangul: `${joinNameText(shareUserInfo?.lastName, 'hangul')}${joinNameText(shareUserInfo?.firstName, 'hangul')}`,
    displayHanja: `${joinNameText(shareUserInfo?.lastName, 'hanja')}${joinNameText(shareUserInfo?.firstName, 'hanja')}`,
  };
}

function buildSummaryItems(fortuneReport, nameCompatibility) {
  const overview = fortuneReport?.overviewSummary;
  const personality = fortuneReport?.personality;
  const strengths = fortuneReport?.strengthsWeaknesses;
  const cautions = fortuneReport?.cautions;
  const firstCaution = asArray(cautions?.cautions)[0];
  const firstStrength = asArray(strengths?.strengths)[0];

  // NS-D: lead the summary with the name-first item, saju flow follows as basis.
  return [
    {
      key: 'name-harmony',
      number: '01',
      title: '이름과의 조화',
      // F1: summary(별점 문구)는 히어로가 정본 1회 노출 — 여기는 N1 평문(이름이 채우는 기운)을 쓴다.
      body: compactText(
        fortuneReport?.tieredMatrix?.nameSajuReading?.sentence || nameCompatibility?.summary,
        '이름과 사주의 조화 분석을 준비 중입니다.',
      ),
    },
    {
      key: 'saju-flow',
      number: '02',
      title: '사주 흐름',
      body: compactText(overview?.overallSummary, '사주 흐름 요약을 준비 중입니다.'),
    },
    {
      key: 'watch-point',
      number: '03',
      title: firstStrength?.text ? '살려볼 점' : '살펴볼 점',
      body: compactText(firstStrength?.reason || firstCaution?.response || personality?.summary, '보완할 흐름을 차분히 살펴보면 좋습니다.'),
    },
  ];
}

function buildLifeFlowPoints(periodOptions, lifeCurve) {
  // 엔진 커브(0~100세, 대운 0.6 + 세운 0.4 블렌드)가 있으면 연 단위 곡선.
  // 점수 정본 규칙: 칩·분야 카드의 별점이 정본이고 이 곡선은 시각화용 파생값.
  const curvePoints = asArray(lifeCurve?.points);
  if (curvePoints.length) {
    const firstIndexed = curvePoints.find((p) => Number.isFinite(p?.daeunIndex));
    const fallbackIndex = Number.isFinite(firstIndexed?.daeunIndex) ? firstIndexed.daeunIndex : 0;
    let prevDaeun = null;
    return curvePoints.map((p) => {
      const daeunIndex = Number.isFinite(p?.daeunIndex) ? p.daeunIndex : fallbackIndex;
      const isBoundary = daeunIndex !== prevDaeun;
      prevDaeun = daeunIndex;
      return {
        key: `life-daeun-${daeunIndex}`,
        pointId: `age-${p.age}`,
        label: Number(p.age) % 10 === 0 ? String(p.age) : '',
        value: Number(p.score) || 0,
        showDot: isBoundary,
        fixedDomain: true,
        isSelected: false,
      };
    });
  }

  const lifePeriods = asArray(periodOptions).filter((item) => item?.isLifeStage);
  if (!lifePeriods.length) {
    return TIERED_PERIOD_OPTIONS.map((item, index) => ({
      key: item.key,
      label: item.label,
      value: 55 + index * 4,
      isSelected: false,
    }));
  }
  return lifePeriods.map((item) => {
    const value = scoreNumber((Number(item?.lifeStage?.stars || item?.period?.overall?.stars || 3) / 5) * 100);
    const startAge = Number(item?.startAge);
    return {
      key: item.key,
      label: Number.isFinite(startAge) ? `${startAge}세~` : item.label.replace(/~\d+세$/u, '대').replace('세', ''),
      value: value || 50,
      isSelected: false,
    };
  });
}

function splitPillarElements(elementText) {
  const raw = String(elementText ?? '');
  const [stemElement, branchElement] = raw.split('/').map((part) => part?.trim() || '');
  return { stemElement, branchElement };
}

function normalizeElementKey(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return '';
  if (raw === 'WOOD' || raw.includes('목') || raw.includes('나무')) return 'WOOD';
  if (raw === 'FIRE' || raw.includes('화') || raw.includes('불')) return 'FIRE';
  if (raw === 'EARTH' || raw.includes('토') || raw.includes('흙')) return 'EARTH';
  if (raw === 'METAL' || raw.includes('금') || raw.includes('쇠')) return 'METAL';
  if (raw === 'WATER' || raw.includes('수') || raw.includes('물')) return 'WATER';
  return '';
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function paragraphToText(paragraph) {
  const direct = normalizeText(paragraph?.plainText);
  if (direct) return direct;
  return normalizeText(asArray(paragraph?.tokens).map((token) => {
    if (token?.kind === 'tag') return token.label ? `#${String(token.label).replace(/^#/u, '')}` : '';
    return token?.value || '';
  }).join(''));
}

function firstSentence(value) {
  const text = normalizeText(value);
  if (!text) return '';
  const match = text.match(/^.+?[.!?。！？]|^.+?요\.|^.+?다\./u);
  return match ? match[0].trim() : text;
}

function cellSummary(cell, fallback = '운세 정보를 준비 중입니다.') {
  return firstSentence(
    cell?.brief?.headline
    || cell?.brief?.hook
    || paragraphToText(asArray(cell?.standard?.paragraphs)[0])
    || fallback,
  ) || fallback;
}

function cellDetailParagraphs(cell) {
  const paragraphs = asArray(cell?.standard?.paragraphs)
    .map(paragraphToText)
    .filter(Boolean);
  if (paragraphs.length) return paragraphs;
  const fallback = cellSummary(cell, '');
  return fallback ? [fallback] : [];
}

function cellLivingTips(cell) {
  return asArray(cell?.standard?.livingTips).map(normalizeText).filter(Boolean);
}

function cellCautions(cell) {
  return asArray(cell?.standard?.cautions).map(normalizeText).filter(Boolean);
}

function getTieredCell(period, categoryId) {
  if (!period) return null;
  if (categoryId === 'overall') return period.overall || null;
  return period.byCategory?.[categoryId] || null;
}

function findLifeStage(lifeStageFortune, startAge, endAge) {
  const stages = asArray(lifeStageFortune?.stages);
  return stages.find((stage) => {
    const start = Number(stage?.startAge);
    const end = Number(stage?.endAge);
    return Number.isFinite(start) && Number.isFinite(end) && start <= endAge && end >= startAge;
  }) || null;
}

// NS-A: derive the viewer's current age from the birth year so the matching
// age band can be pre-selected on first render.
function computeCurrentAge(shareUserInfo) {
  const birthYear = Number(shareUserInfo?.birthDateTime?.year);
  if (!Number.isFinite(birthYear) || birthYear <= 0) return null;
  const age = new Date().getFullYear() - birthYear;
  return age >= 0 && age < 200 ? age : null;
}

// NS-A: pick the life-stage option the age falls into — the band with the
// largest startAge that is still <= age. This stays correct across both band
// conventions (daeun spans and 10-year fallback) and avoids picking the earlier
// band when the age sits exactly on a boundary.
function findAgeBandPeriodKey(lifePeriodOptions, age) {
  if (!Number.isFinite(age)) return '';
  let best = null;
  asArray(lifePeriodOptions).forEach((item) => {
    const start = Number(item?.startAge);
    if (!Number.isFinite(start) || start > age) return;
    if (!best || start > Number(best.startAge)) best = item;
  });
  return best?.key || '';
}

function legacyPeriodToCell(card) {
  if (!card) return null;
  const good = asArray(card.goodActions).map((item) => normalizeText(item?.text)).filter(Boolean);
  const bad = asArray(card.badActions).map((item) => normalizeText(item?.text)).filter(Boolean);
  const warning = normalizeText(card.warning?.signal || card.warning?.response);
  return {
    meaningfulness: 'meaningful',
    stars: card.stars || null,
    brief: { headline: normalizeText(card.summary) || `${card.title || '기간'} 운세를 확인해 보세요.` },
    standard: {
      paragraphs: [
        { plainText: normalizeText(card.summary) || `${card.title || '기간'} 운세를 확인해 보세요.` },
      ],
      livingTips: good,
      cautions: [...bad, warning].filter(Boolean),
    },
    expert: { paragraphs: [] },
  };
}

function legacyCategoryToCell(card) {
  if (!card) return null;
  return {
    meaningfulness: 'meaningful',
    stars: card.stars || null,
    brief: { headline: normalizeText(card.summary) || `${card.title || '분야'} 운세를 확인해 보세요.` },
    standard: {
      paragraphs: [
        { plainText: normalizeText(card.summary) || `${card.title || '분야'} 운세를 확인해 보세요.` },
      ],
      livingTips: asArray(card.advice).map((item) => normalizeText(item?.text)).filter(Boolean),
      cautions: card.caution ? [normalizeText(card.caution.signal), normalizeText(card.caution.response)].filter(Boolean) : [],
    },
    expert: { paragraphs: [] },
  };
}

function buildLegacyPeriod(periodKind, periodLabel, overallCard, categoryFortunes) {
  const byCategory = {};
  TIERED_CATEGORY_OPTIONS.forEach((category) => {
    if (category.id !== 'overall') byCategory[category.id] = legacyCategoryToCell(categoryFortunes?.[category.id]);
  });
  return {
    periodKind,
    periodLabel,
    periodMeta: {},
    overall: legacyPeriodToCell(overallCard),
    byCategory,
  };
}

function buildPeriodOptions(fortuneReport) {
  const matrixPeriods = fortuneReport?.tieredMatrix?.periods;
  if (matrixPeriods) {
    const basePeriods = TIERED_PERIOD_OPTIONS
      .map((option) => {
        const period = matrixPeriods[option.periodKind];
        if (!period) return null;
        return {
          ...option,
          isMatrixPeriod: true,
          period,
          periodLabel: period.periodLabel || option.label,
        };
      })
      .filter(Boolean);
    const lifePeriod = matrixPeriods.life;
    // 정통 축: 개인별 대운(大運) 구간(byDaeun)이 있으면 그걸 선택 축으로 쓴다.
    // 경계·라벨·본문 {{periodLabel}}이 전부 그 사람의 실제 대운을 따른다.
    const byDaeun = asArray(lifePeriod?.byDaeun);
    const lifeStages = lifePeriod
      ? (byDaeun.length
        ? byDaeun.map((cell, index) => ({
          key: `life-daeun-${index}`,
          periodKind: 'life',
          label: cell.ageLabel || cell.periodLabel,
          ageBand: cell.ageBand,
          startAge: Number(cell.startAge) || 0,
          endAge: Number(cell.endAge) || 0,
          isLifeStage: true,
          isMatrixPeriod: true,
          period: cell,
          periodLabel: cell.pillarDisplay
            ? `${cell.ageLabel} · ${cell.pillarDisplay} 대운`
            : (cell.ageLabel || cell.periodLabel),
          selectorAgeBand: cell.selectorAgeBand || '',
          lifeStage: findLifeStage(fortuneReport?.lifeStageFortune, cell.startAge, cell.endAge),
        }))
        : LIFE_STAGE_PERIOD_OPTIONS.map((option) => {
          const ageBandPeriod = lifePeriod.byAgeBand?.[option.ageBand];
          return {
            ...option,
            isMatrixPeriod: true,
            period: ageBandPeriod || lifePeriod,
            periodLabel: ageBandPeriod?.periodLabel || option.label,
            selectorAgeBand: ageBandPeriod?.selectorAgeBand || '',
            lifeStage: findLifeStage(fortuneReport?.lifeStageFortune, option.startAge, option.endAge),
          };
        }))
      : [];
    return [...basePeriods, ...lifeStages];
  }

  const categoryFortunes = fortuneReport?.categoryFortunes || {};
  const legacyCards = {
    today: fortuneReport?.dailyFortune,
    thisWeek: fortuneReport?.weeklyFortune,
    thisMonth: fortuneReport?.monthlyFortune,
    thisYear: fortuneReport?.yearlyFortune,
  };
  const basePeriods = TIERED_PERIOD_OPTIONS
    .map((option) => {
      const card = legacyCards[option.key];
      if (!card) return null;
      return {
        ...option,
        isMatrixPeriod: false,
        period: buildLegacyPeriod(option.periodKind, option.label, card, categoryFortunes),
        periodLabel: option.label,
      };
    })
    .filter(Boolean);
  const lifePeriod = buildLegacyPeriod(
    'life',
    '생애시기',
    fortuneReport?.lifeFortuneOverview,
    categoryFortunes,
  );
  // 레거시 경로도 실제 대운 구간(lifeStageFortune.stages)을 1차 소스로 쓴다.
  const legacyStages = asArray(fortuneReport?.lifeStageFortune?.stages)
    .filter((stage) => Number.isFinite(Number(stage?.startAge)) && Number.isFinite(Number(stage?.endAge)));
  const lifeStages = legacyStages.length
    ? legacyStages.map((stage, index) => {
      const startAge = Math.floor(Number(stage.startAge));
      const endAge = Math.floor(Number(stage.endAge));
      // 폐구간 표기: 다음 대운 시작 나이와 겹치지 않게 (25세~34세 / 35세~44세).
      const ageLabel = `${startAge}세~${Math.max(startAge, endAge - 1)}세`;
      return {
        key: `life-daeun-${index}`,
        periodKind: 'life',
        label: ageLabel,
        ageBand: `${startAge}-${endAge}`,
        startAge,
        endAge,
        isLifeStage: true,
        isMatrixPeriod: false,
        period: lifePeriod,
        periodLabel: stage.pillarDisplay ? `${ageLabel} · ${stage.pillarDisplay} 대운` : ageLabel,
        lifeStage: stage,
      };
    })
    : LIFE_STAGE_PERIOD_OPTIONS.map((option) => ({
      ...option,
      isMatrixPeriod: false,
      period: lifePeriod,
      periodLabel: option.label,
      lifeStage: findLifeStage(fortuneReport?.lifeStageFortune, option.startAge, option.endAge),
    }));
  return [...basePeriods, ...lifeStages];
}

function buildCategoryItems(periodOption) {
  return TIERED_CATEGORY_OPTIONS.map((category) => {
    const cell = getTieredCell(periodOption?.period, category.id);
    return {
      ...category,
      cell,
      key: `${periodOption?.key || 'period'}:${category.id}`,
      summary: cellSummary(cell, `${category.title} 정보를 준비 중입니다.`),
    };
  });
}

function tagLabelFromGlossary(tagId, tokenLabel, glossary) {
  const entry = glossary?.entries?.[tagId];
  const raw = normalizeText(entry?.hashLabel || tokenLabel || entry?.label || tagId);
  if (!raw) return '';
  return raw.startsWith('#') ? raw : `#${raw}`;
}

function collectExpertTags(cell, glossary) {
  const seen = new Set();
  const tags = [];
  asArray(cell?.selectedFragments?.expert?.tags).forEach((tagId) => {
    if (!tagId || seen.has(tagId)) return;
    const label = tagLabelFromGlossary(tagId, '', glossary);
    if (!label) return;
    seen.add(tagId);
    tags.push({ id: tagId, label });
  });
  asArray(cell?.expert?.paragraphs).forEach((paragraph) => {
    asArray(paragraph?.tokens).forEach((token) => {
      if (token?.kind !== 'tag' || !token.tagId || seen.has(token.tagId)) return;
      const label = tagLabelFromGlossary(token.tagId, token.label, glossary);
      if (!label) return;
      seen.add(token.tagId);
      tags.push({ id: token.tagId, label });
    });
  });
  return tags.slice(0, DETAIL_TAG_LIMIT);
}

function categoryDetailKey(periodOption, categoryItem) {
  return `${periodOption?.key || 'period'}:${categoryItem?.id || 'category'}`;
}

function categoryDetailPanelId(key) {
  return `combined-category-detail-${String(key).replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
}

function getCategorySummary(categoryItems, id, fallback) {
  const item = asArray(categoryItems).find((category) => category?.id === id);
  return normalizeText(item?.summary) || fallback;
}

/**
 * 전문 인사이트 — 엔진이 계산한 신살·공망·합충형파해 등의 원자료(fact) 중
 * 해석(interpretation)이 충전된 항목만 렌더한다. 해석 파일이 비어 있는 초기
 * 상태에서는 아무것도 그리지 않아 화면 무회귀. (성인 대상자에게만 카드가 실림)
 */
const INSIGHT_GROUP_ORDER = [
  { key: 'boon', title: '도움의 신호', desc: '귀인과 합 — 힘이 되어 주는 배치' },
  { key: 'tension', title: '완급의 신호', desc: '살·충·형 — 속도를 챙기면 무기가 되는 배치' },
  { key: 'space', title: '여백의 신호', desc: '공망·지장간 — 비움과 잠재의 배치' },
];

function insightChips(fact) {
  const chips = [`#${(fact.label || '').replace(/\s+/g, '')}`];
  if (fact.members?.length) chips.push(fact.members.join('·'));
  else if (fact.detail) chips.push(fact.detail);
  return chips;
}

/** 접힌 목록의 칩 라벨 — 관계는 고전 표기(병임충·인사형)로 압축. */
function insightChipText(fact) {
  if (fact.kind === 'stemRelation' || fact.kind === 'branchRelation') {
    const typeWord = (fact.label || '').replace(/^(천간|지지)\s*/u, '');
    return `${(fact.members || []).join('')}${typeWord}`;
  }
  return fact.label || fact.factId;
}

const INSIGHT_GROUP_RGB = { boon: '47, 107, 79', tension: '176, 108, 38', space: '90, 96, 120' };

/** 주요도(salience 0~1) → 테두리·배경 농도. 글자는 항상 진하게(가독성·비활성 오독 방지). */
function insightSalienceStyle(groupKey, salience) {
  const rgb = INSIGHT_GROUP_RGB[groupKey] || INSIGHT_GROUP_RGB.tension;
  const s = Number.isFinite(salience) ? Math.max(0, Math.min(1, salience)) : 0.5;
  return {
    '--ins-border': `rgba(${rgb}, ${(0.10 + s * 0.90).toFixed(3)})`,
    '--ins-bg': `rgba(${rgb}, ${(0.02 + s * 0.26).toFixed(3)})`,
  };
}

function InsightFactsSection({ insightFacts }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedFactId, setSelectedFactId] = useState(null);
  const raw = asArray(insightFacts?.facts).filter((fact) => fact?.interpretation?.text);
  // 같은 factId(예: 지살이 년주·일주 양쪽 히트)는 한 항목으로 병합 — 위치만 합산.
  const byId = new Map();
  raw.forEach((fact) => {
    const prev = byId.get(fact.factId);
    if (!prev) byId.set(fact.factId, { ...fact });
    else if (fact.detail && prev.detail && !prev.detail.includes(fact.detail)) {
      prev.detail = `${prev.detail} · ${fact.detail}`;
    }
  });
  const interpreted = [...byId.values()];
  if (!interpreted.length) return null;

  // 엔진이 가중치로 고른 하이라이트(최대 6) = 기본 노출. 나머지는 접힘.
  const highlights = interpreted.filter((fact) => fact.highlight);
  const rest = interpreted.filter((fact) => !fact.highlight);
  const lead = highlights.length ? highlights : interpreted.slice(0, 4);
  const folded = highlights.length ? rest : interpreted.slice(4);

  return (
    <ReportSection
      id="combined-insights"
      title="전문 인사이트"
      description="원국에서 특히 눈에 띄는 배치를 골라 풀어드립니다. 전문용어는 태그로만 달아 두었어요."
      className="cr-section--insights"
      collapsedOnMobile
    >
      <div className="cr-insight-highlights">
        {lead.map((fact) => (
          <article
            key={fact.factId}
            className="cr-insight-item cr-insight-item--highlight"
            style={{ borderLeftColor: `rgba(47, 107, 79, ${(0.22 + (fact.salience ?? 0.5) * 0.78).toFixed(3)})` }}
          >
            <p className="cr-insight-item__headline">{fact.interpretation.text}</p>
            {fact.interpretation.expertText ? (
              <p className="cr-insight-item__expert">{fact.interpretation.expertText}</p>
            ) : null}
            <div className="cr-insight-item__chips" aria-label="전문태그">
              {insightChips(fact).map((chip) => (
                <span key={`${fact.factId}-${chip}`}>{chip}</span>
              ))}
            </div>
          </article>
        ))}
      </div>

      {folded.length ? (
        <div className="cr-insight-rest">
          <button
            type="button"
            className="cr-insight-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '원국 신호 접기' : `원국 신호 전체 보기 (${folded.length})`}
          </button>
          {expanded ? (
            <div className="cr-insight-groups">
              {INSIGHT_GROUP_ORDER.map((group) => {
                const items = folded.filter((fact) => (fact.group || 'tension') === group.key);
                if (!items.length) return null;
                const selected = items.find((fact) => fact.factId === selectedFactId) || null;
                return (
                  <div key={group.key} className="cr-insight-group">
                    <h4>{group.title}<span className="cr-insight-group__desc"> — {group.desc}</span></h4>
                    <div className="cr-insight-chiprow" role="group" aria-label={group.title}>
                      {items.map((fact) => {
                        const isSelected = fact.factId === selectedFactId;
                        return (
                          <button
                            key={fact.factId}
                            type="button"
                            aria-pressed={isSelected}
                            className={`cr-insight-chip cr-insight-chip--${group.key}${isSelected ? ' is-selected' : ''}`}
                            style={insightSalienceStyle(group.key, fact.salience)}
                            onClick={() => setSelectedFactId(isSelected ? null : fact.factId)}
                          >
                            {insightChipText(fact)}
                          </button>
                        );
                      })}
                    </div>
                    {selected ? (
                      <article className={`cr-insight-detail cr-insight-detail--${group.key}`}>
                        <h5>
                          {selected.label}
                          {selected.detail ? <span className="cr-insight-item__where"> · {selected.detail}</span> : null}
                        </h5>
                        <p>{selected.interpretation.text}</p>
                        {selected.interpretation.expertText ? (
                          <p className="cr-insight-item__expert">{selected.interpretation.expertText}</p>
                        ) : null}
                      </article>
                    ) : null}
                  </div>
                );
              })}
              <p className="cr-insight-hint">신호를 누르면 풀이가 열립니다.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </ReportSection>
  );
}

function PremiumReportSection({
  isUnlocked,
  selectedPeriod,
  selectedPeriodSummary,
  selectedCategoryItems,
  nameCompatibility,
  onOpenPremium,
}) {
  const periodLabel = selectedPeriod?.periodLabel || selectedPeriod?.label || '선택한 기간';
  // F1: 첫 줄(종합 점수 해설)은 이름 평가 섹션 도입부가 쓰므로, 여기는 용신 해설
  // 우선 → 둘째 줄 이후 → summary 순으로 골라 같은 문장이 페이지에 반복되지 않게 한다.
  const details = asArray(nameCompatibility?.details);
  const nameDetail = details.find((line) => normalizeText(line) && String(line).includes('용신'))
    || details.slice(1).find((line) => normalizeText(line))
    || compactText(nameCompatibility?.summary, '이름과 사주의 조화가 이어지는 지점을 더 자세히 읽을 수 있습니다.');
  const threads = [
    {
      key: 'future-flow',
      title: '숨겨진 미래 흐름',
      preview: selectedPeriodSummary || `${periodLabel}의 흐름은 짧은 요약만으로는 다 읽히지 않습니다.`,
      detail: `${periodLabel} 안에서 반복되는 리듬을 관계, 일, 선택의 방향으로 나누어 이어 읽습니다.`,
    },
    {
      key: 'name-combination',
      title: '가장 잘 맞는 이름 조합',
      preview: nameDetail,
      detail: '추천 이름의 음양, 오행, 수리 흐름을 한 문장씩 연결해 왜 이 조합이 어울리는지 정리합니다.',
    },
    {
      key: 'relationship-money',
      title: '관계와 재물의 심화 해석',
      preview: getCategorySummary(selectedCategoryItems, 'romance', '관계 흐름은 마음이 먼저 움직이는 지점부터 천천히 읽습니다.'),
      detail: getCategorySummary(selectedCategoryItems, 'wealth', '재물 흐름은 무리한 확장보다 지켜야 할 리듬을 중심으로 봅니다.'),
    },
  ];

  return (
    <ReportSection
      id="combined-premium"
      title="내 해석을 완성하는 부분"
      description="무료 결과가 방향을 보여준다면, 완성 리포트는 왜 그 이름과 흐름이 나에게 맞는지 문장으로 이어 줍니다."
      className={isUnlocked ? 'cr-section--premium cr-section--premium-open' : 'cr-section--premium'}
    >
      <div className="cr-premium-ledger">
        {threads.map((thread) => (
          <article key={thread.key} className="cr-premium-thread">
            <h3>{thread.title}</h3>
            <p>{thread.preview}</p>
            {isUnlocked ? (
              <p className="cr-premium-thread__detail">{thread.detail}</p>
            ) : (
              <div className="cr-premium-thread__lock" aria-hidden="true">
                <span />
                <span />
              </div>
            )}
          </article>
        ))}
      </div>

      {isUnlocked ? (
        <div className="cr-premium-open-note">
          <p>결제가 확인되어 심화 리포트 영역이 열렸습니다. PDF 저장과 공유 링크로 이 흐름을 다시 열어볼 수 있습니다.</p>
        </div>
      ) : (
        <div className="cr-premium-lock" role="note">
          <div>
            <p className="cr-premium-lock__title">이 해석이 나에게 닿는 이유</p>
            <p>
              지금 보신 결과가 방향을 잡아 주었다면, 완성 리포트는 그 방향이 왜 당신의 이름과 사주에
              닿는지 차분히 이어 줍니다. 이름 조합의 이유, 앞으로의 관계와 재물 흐름, 다시 읽을 수
              있는 PDF까지 한 번에 정리됩니다.
            </p>
          </div>
          <button type="button" onClick={onOpenPremium} className="ns-primary-button cr-premium-lock__button">
            내 해석 완성하기
          </button>
        </div>
      )}
    </ReportSection>
  );
}

function ReportClose() {
  return (
    <footer className="cr-report-close">
      <p>읽은 결과는 저장하고, 다시 열어볼 수 있게 남겨두세요.</p>
      <span>이름봄 드림.</span>
    </footer>
  );
}

function ScoreMetricCard({ label, value, caption }) {
  return (
    <div className="cr-metric-card">
      <p className="cr-metric-card__label">{label}</p>
      <p className="cr-metric-card__value">{value}</p>
      {caption ? <p className="cr-metric-card__caption">{caption}</p> : null}
    </div>
  );
}

function ReportHero({ nameParts, birthLabel, genderLabel, nameCompatibility, renderMetrics, shareUserInfo }) {
  const overallScore = scoreNumber(nameCompatibility?.overallScore);
  const sajuScore = scoreNumber(nameCompatibility?.sajuCompatibilityScore);
  const nameScore = scoreNumber(nameCompatibility?.nameAnalysisScore);
  const summary = compactText(nameCompatibility?.summary, '이름 적합도 분석 결과를 준비 중입니다.');

  return (
    <section className="cr-hero" aria-labelledby="combined-report-hero-title">
      <div className="cr-hero__main">
        <div className="cr-hero__identity">
          <p className="cr-hero__overline">통합 해석집</p>
          <h2 id="combined-report-hero-title" className="cr-hero__name">
            {nameParts.hangul}
            {nameParts.hanja ? <span>{` (${nameParts.hanja})`}</span> : null}
          </h2>
          <p className="cr-hero__summary">{summary}</p>
          <dl className="cr-hero__meta">
            <div>
              <dt>생년월일</dt>
              <dd>{birthLabel}</dd>
            </div>
            <div>
              <dt>성별</dt>
              <dd>{genderLabel}</dd>
            </div>
          </dl>
        </div>
        <div className="cr-hero__art">
          <SajuIllustrationPanel
            renderMetrics={renderMetrics}
            shareUserInfo={shareUserInfo}
            variant="cover"
          />
        </div>
        <div className="cr-hero__score" aria-label={`종합 점수 ${overallScore}점, ${scoreStateLabel(overallScore)}`}>
          <p className="cr-score-label">종합 점수</p>
          <p className="cr-score-value">{overallScore}</p>
          <p className="cr-score-caption">{scoreStateLabel(overallScore)}</p>
          <div className="cr-score-stars">
            <StarRating score={toStars(nameCompatibility?.overallStars || 3)} />
          </div>
        </div>
      </div>
      <div className="cr-hero__metrics">
        <ScoreMetricCard label="종합" value={overallScore} caption="전체 조화" />
        <ScoreMetricCard label="사주" value={sajuScore} caption="사주 궁합" />
        <ScoreMetricCard label="이름" value={nameScore} caption="성명학 분석" />
      </div>
    </section>
  );
}

// NS-C/NS-I: sections fold on mobile to cut the report's scroll length.
// The body stays in the DOM (hidden via CSS class, not unmounted) so PDF/print
// capture and the print media override can still reveal every section.
const SECTION_MOBILE_QUERY = '(max-width: 40rem)';

function prefersMobileCollapse() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(SECTION_MOBILE_QUERY).matches;
}

function ReportSection({
  id,
  eyebrow,
  title,
  description,
  children,
  className = '',
  collapsible = true,
  collapsedOnMobile = false,
}) {
  // Detail-heavy sections start folded on narrow screens; core sections stay open.
  const [open, setOpen] = useState(() => !(collapsible && collapsedOnMobile && prefersMobileCollapse()));

  if (!collapsible) {
    return (
      <section id={id} className={`cr-section ${className}`}>
        <div className="cr-section__head">
          {eyebrow ? <p className="cr-eyebrow">{eyebrow}</p> : null}
          <h2 className="cr-section__title">{title}</h2>
          {description ? <p className="cr-section__description">{description}</p> : null}
        </div>
        <div className="cr-section__body">{children}</div>
      </section>
    );
  }

  const bodyId = `${id}-body`;
  const titleId = `${id}-title`;

  return (
    <section
      id={id}
      className={`cr-section cr-section--collapsible ${className}${open ? '' : ' is-collapsed'}`}
    >
      <div className="cr-section__head">
        <h2 className="cr-section__title" id={titleId}>
          <button
            type="button"
            className="cr-section__toggle ns-ripple"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((value) => !value)}
          >
            {eyebrow ? <span className="cr-eyebrow">{eyebrow}</span> : null}
            <span className="cr-section__title-text">{title}</span>
            <span className="cr-section__chevron" aria-hidden="true" />
          </button>
        </h2>
        {description ? <p className="cr-section__description">{description}</p> : null}
      </div>
      <div id={bodyId} role="region" aria-labelledby={titleId} className="cr-section__body">
        {children}
      </div>
    </section>
  );
}

function SummaryItem({ number, title, body }) {
  return (
    <article className="cr-summary-item">
      <span className="cr-summary-item__number" aria-hidden="true">{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </article>
  );
}

function SajuPillarsGrid({ pillars = [], compact = false }) {
  const columns = buildPillarColumns(pillars);
  return (
    <SajuPillarTable
      compact={compact}
      columns={columns.map((pillar) => ({
        key: pillar.key,
        label: pillar.label,
        stem: {
          symbol: pillar.stem,
          element: pillar.stemElementKey || pillar.stemElement,
        },
        branch: {
          symbol: pillar.branch,
          element: pillar.branchElementKey || pillar.branchElement,
        },
      }))}
    />
  );
}

function SajuIllustrationPanel({ renderMetrics, shareUserInfo, variant = '' }) {
  const className = variant === 'top'
    ? 'cr-saju-illustration cr-saju-illustration--top'
    : variant === 'cover'
      ? 'cr-saju-illustration cr-saju-illustration--cover'
      : 'cr-saju-illustration';

  return (
    <div className={className} aria-label="사주 흐름 일러스트">
      <NamingResultRenderer
        renderMetrics={renderMetrics}
        birthDateTime={shareUserInfo?.birthDateTime ?? null}
        gender={shareUserInfo?.gender}
        isSolarCalendar={shareUserInfo?.isSolarCalendar}
        isBirthTimeUnknown={shareUserInfo?.isBirthTimeUnknown}
        showIdentityOverlay={false}
      />
    </div>
  );
}

function LifeFlowChart({ points, onSelect }) {
  const width = 640;
  const height = 180;
  const padX = 26;
  const top = 26;
  const bottom = 42;
  const safePoints = asArray(points).length ? points : [{ key: 'empty', label: '-', value: 50 }];
  const values = safePoints.map((point) => Number(point.value) || 0);
  // 커브 모드(fixedDomain)는 0~100 고정 스케일 — min-max 정규화가 평평한
  // 곡선의 요동을 전고로 증폭하는 것을 막는다. 레거시 점들은 기존 정규화 유지.
  const useFixedDomain = safePoints.some((point) => point.fixedDomain);
  const min = useFixedDomain ? 0 : Math.min(...values);
  const max = useFixedDomain ? 100 : Math.max(...values);
  const range = max - min || 1;
  const coords = safePoints.map((point, index) => {
    const x = padX + (index / Math.max(1, safePoints.length - 1)) * (width - padX * 2);
    const ratio = ((Number(point.value) || 0) - min) / range;
    const y = height - bottom - ratio * (height - top - bottom);
    return { ...point, x, y };
  });
  const path = coords.reduce((result, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    const previous = coords[index - 1];
    const cx = (previous.x + point.x) / 2;
    return `${result} C ${cx.toFixed(1)} ${previous.y.toFixed(1)}, ${cx.toFixed(1)} ${point.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, '');
  // 클릭·키보드 대상은 대운 경계 점만 (연 단위 100개 전부가 탭 스톱이 되는
  // 것을 방지). showDot 미지정(레거시 10점)은 전부 대상.
  const dotPoints = coords.filter((point) => point.showDot !== false);
  const labelPoints = coords.filter((point) => point.label);

  return (
    <div className="cr-life-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="나이대별 운의 흐름 그래프">
        <path d={path} fill="none" stroke="var(--color-wood)" strokeWidth="3" strokeLinecap="round" />
        {labelPoints.map((point) => (
          <text
            key={`label-${point.pointId || point.key}`}
            x={point.x}
            y={height - 12}
            textAnchor="middle"
            fill="var(--color-ink-3)"
            fontSize="12"
            fontWeight="800"
          >
            {point.label}
          </text>
        ))}
        {dotPoints.map((point) => (
          <g
            key={`dot-${point.pointId || point.key}`}
            role="button"
            tabIndex={0}
            aria-label={`${point.label || point.key} 운의 흐름 ${point.value}`}
            onClick={() => onSelect?.(point.key)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect?.(point.key);
              }
            }}
            className={`cr-life-chart__point${point.isSelected ? ' cr-life-chart__point--selected' : ''}`}
          >
            <circle
              cx={point.x}
              cy={point.y}
              r={point.isSelected ? 8 : 5}
              fill={point.isSelected ? 'var(--color-accent)' : 'var(--color-paper-2)'}
              stroke="var(--color-wood)"
              strokeWidth="2"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

function CategoryInlineDetail({ id, detail, expertTagState }) {
  if (!detail) return null;
  const paragraphs = cellDetailParagraphs(detail.cell);
  const livingTips = cellLivingTips(detail.cell);
  const cautions = cellCautions(detail.cell);

  return (
    <div id={id} className="cr-category-inline-detail">
      <p className="cr-category-inline-detail__label">상세 근거</p>
      <div className="cr-note-list">
        {paragraphs.map((paragraph, index) => (
          <p key={`detail-paragraph-${detail.key}-${index}`}>{paragraph}</p>
        ))}
      </div>
      <div className="cr-two-column">
        {livingTips.length ? (
          <div className="cr-text-block cr-text-block--success">
            <h3>도움 되는 행동</h3>
            {livingTips.map((tip, index) => (
              <p key={`living-tip-${detail.key}-${index}`}>{tip}</p>
            ))}
          </div>
        ) : null}
        {cautions.length ? (
          <div className="cr-text-block cr-text-block--warn">
            <h3>주의할 점</h3>
            {cautions.map((caution, index) => (
              <p key={`caution-${detail.key}-${index}`}>{caution}</p>
            ))}
          </div>
        ) : null}
      </div>
      {expertTagState.status === 'loading' || expertTagState.tags.length ? (
        <div className="cr-tag-panel">
          <p>전문태그</p>
          {expertTagState.status === 'loading' ? (
            <span>전문태그를 불러오는 중입니다.</span>
          ) : (
            <div>
              {expertTagState.tags.map((tag) => (
                <span key={`${detail.key}-${tag.id}`}>{tag.label}</span>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CategoryInsightList({
  periodOption,
  categoryItems,
  activeDetail,
  expertTagState,
  onToggleDetail,
  ariaLabel,
}) {
  if (!periodOption) return null;

  return (
    <div className="cr-category-grid" aria-label={ariaLabel}>
      {categoryItems.map((item) => {
        const detailKey = categoryDetailKey(periodOption, item);
        const isOpen = activeDetail?.key === detailKey;
        const panelId = categoryDetailPanelId(detailKey);
        const hasDetail = Boolean(item.cell);

        return (
          <article
            key={item.key}
            className={`cr-category-card cr-category-card--${item.tone}${isOpen ? ' cr-category-card--open' : ''}`}
          >
            <div className="cr-category-card__head">
              <span>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </span>
              {item.cell?.stars ? <StarRating score={toStars(item.cell.stars)} /> : null}
            </div>
            <p className="cr-category-card__summary">{item.summary}</p>
            <button
              type="button"
              onClick={() => onToggleDetail(periodOption, item)}
              className="cr-category-card__action ns-ripple"
              aria-expanded={isOpen}
              aria-controls={panelId}
              disabled={!hasDetail}
            >
              {isOpen ? '접기' : hasDetail ? '상세 보기' : '준비 중'}
            </button>
            {isOpen ? (
              <CategoryInlineDetail
                id={panelId}
                detail={activeDetail}
                expertTagState={expertTagState}
              />
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function CombiedNamingReport({
  fortuneReport,
  onOpenNamingReport,
  onOpenSajuReport,
  onOpenPremium,
  shareUserInfo = null,
}) {
  const reportRootRef = useRef(null);
  const [isPremiumUnlocked] = useState(() => {
    try {
      return window.sessionStorage.getItem(PREMIUM_ACCESS_STORAGE_KEY) === PREMIUM_ACCESS_VALUE;
    } catch {
      return false;
    }
  });
  const [selectedPeriodKey, setSelectedPeriodKey] = useState('today');
  const [selectedLifePeriodKey, setSelectedLifePeriodKey] = useState('');
  // NS-E: split the two fortune tracks into tabs; 'current' = 기간별, 'life' = 연령대별.
  const [fortuneTrack, setFortuneTrack] = useState('current');
  const [activeDetail, setActiveDetail] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(true);
  // NS-J: plain wording is the default; this toggle reveals the 원어/전문 용어.
  const [showExpertTerms, setShowExpertTerms] = useState(false);
  const [expertTagState, setExpertTagState] = useState({ status: 'idle', tags: [] });
  const expertTagRequestRef = useRef(0);

  const periodOptions = useMemo(() => buildPeriodOptions(fortuneReport), [fortuneReport]);
  const primaryPeriodOptions = useMemo(
    () => periodOptions.filter((item) => !item.isLifeStage).slice(0, 4),
    [periodOptions],
  );
  const lifePeriodOptions = useMemo(
    () => periodOptions.filter((item) => item.isLifeStage),
    [periodOptions],
  );
  // NS-A: default the life-flow selection to the viewer's actual age band.
  const defaultLifePeriodKey = useMemo(
    () => findAgeBandPeriodKey(lifePeriodOptions, computeCurrentAge(shareUserInfo)),
    [lifePeriodOptions, shareUserInfo],
  );
  const selectedPeriod = primaryPeriodOptions.find((item) => item.key === selectedPeriodKey)
    || primaryPeriodOptions[0]
    || null;
  const selectedLifePeriod = lifePeriodOptions.find((item) => item.key === selectedLifePeriodKey)
    || lifePeriodOptions.find((item) => item.key === defaultLifePeriodKey)
    || lifePeriodOptions[0]
    || null;
  const selectedCategoryItems = useMemo(
    () => buildCategoryItems(selectedPeriod),
    [selectedPeriod],
  );
  const selectedLifeCategoryItems = useMemo(
    () => buildCategoryItems(selectedLifePeriod),
    [selectedLifePeriod],
  );
  const selectedPeriodOverall = selectedPeriod?.period?.overall || null;
  const selectedPeriodStars = selectedPeriodOverall?.stars || selectedPeriod?.lifeStage?.stars || null;
  const selectedPeriodSummary = cellSummary(selectedPeriodOverall, '') || selectedPeriod?.lifeStage?.summary || '';
  const selectedLifePeriodOverall = selectedLifePeriod?.period?.overall || null;
  const selectedLifePeriodStars = selectedLifePeriodOverall?.stars || selectedLifePeriod?.lifeStage?.stars || null;
  const selectedLifePeriodSummary = cellSummary(selectedLifePeriodOverall, '') || selectedLifePeriod?.lifeStage?.summary || '';
  // 60갑자 리드 — 같은 버킷×등급으로 본문이 겹치는 인접 대운을 그 간지 고유의 글로 열어 준다.
  // 1~2문장이 한 단위로 저작돼 있어 firstSentence 절단(compactText)을 쓰지 않는다.
  const selectedLifePeriodLead = normalizeText(selectedLifePeriod?.period?.daeunLead);
  const selectedLifeFlowKey = selectedLifePeriod?.key || selectedLifePeriodKey;
  const nameCompatibility = fortuneReport?.nameCompatibility;
  const nameParts = useMemo(() => getNamePartsFromUserInfo(shareUserInfo), [shareUserInfo]);
  const birthLabel = useMemo(() => formatBirthDateTimeLabel(shareUserInfo), [shareUserInfo]);
  const genderLabel = useMemo(() => formatGenderLabel(shareUserInfo?.gender), [shareUserInfo]);
  const overview = fortuneReport?.overviewSummary || {};
  const sajuRenderMetrics = useMemo(
    () => buildCombinedSajuRenderMetrics(overview, shareUserInfo, nameCompatibility),
    [overview, shareUserInfo, nameCompatibility],
  );
  const summaryItems = useMemo(
    () => buildSummaryItems(fortuneReport, nameCompatibility),
    [fortuneReport, nameCompatibility],
  );
  const lifeFlowPoints = useMemo(() => {
    return buildLifeFlowPoints(lifePeriodOptions, fortuneReport?.lifeCurve).map((point) => ({
      ...point,
      isSelected: point.isSelected || point.key === selectedLifeFlowKey,
    }));
  }, [lifePeriodOptions, fortuneReport, selectedLifeFlowKey]);
  const nameDetails = asArray(nameCompatibility?.details).filter(Boolean);
  const personality = fortuneReport?.personality || {};
  // A1/N1 — plain-language fingerprint readings (jargon-free). Optional/additive.
  const tieredPersonalReading = fortuneReport?.tieredMatrix?.personalReading || null;
  const tieredNameSajuReading = fortuneReport?.tieredMatrix?.nameSajuReading || null;
  const strengths = asArray(fortuneReport?.strengthsWeaknesses?.strengths);
  const weaknesses = asArray(fortuneReport?.strengthsWeaknesses?.weaknesses);
  const cautions = asArray(fortuneReport?.cautions?.cautions);

  const selectPeriod = (periodKey) => {
    setSelectedPeriodKey(periodKey);
    setActiveDetail(null);
    expertTagRequestRef.current += 1;
    setExpertTagState({ status: 'idle', tags: [] });
    setIsDetailOpen(true);
  };

  const selectLifePeriod = (periodKey) => {
    setSelectedLifePeriodKey(periodKey);
    setActiveDetail(null);
    expertTagRequestRef.current += 1;
    setExpertTagState({ status: 'idle', tags: [] });
    setIsDetailOpen(true);
  };

  const closeCategoryDetail = () => {
    setActiveDetail(null);
    expertTagRequestRef.current += 1;
    setExpertTagState({ status: 'idle', tags: [] });
    setIsDetailOpen(true);
  };

  const selectFortuneTrack = (track) => {
    if (track === fortuneTrack) return;
    setFortuneTrack(track);
    closeCategoryDetail();
  };

  const openCategoryDetail = (periodOption, categoryItem) => {
    if (!periodOption || !categoryItem?.cell) return;
    const key = categoryDetailKey(periodOption, categoryItem);
    const detailSummary = cellSummary(categoryItem.cell, '');
    setActiveDetail({
      key,
      periodLabel: periodOption.periodLabel || periodOption.label,
      periodSubtitle: periodOption.period?.periodLabel || '',
      categoryTitle: categoryItem.title,
      categorySubtitle: categoryItem.subtitle,
      summary: detailSummary,
      cell: categoryItem.cell,
      isMatrixPeriod: Boolean(periodOption.isMatrixPeriod),
      lifeStage: periodOption.lifeStage || null,
    });
    setExpertTagState({ status: 'loading', tags: [] });
    const requestId = expertTagRequestRef.current + 1;
    expertTagRequestRef.current = requestId;
    window.setTimeout(() => {
      if (expertTagRequestRef.current !== requestId) return;
      setExpertTagState({
        status: 'ready',
        tags: collectExpertTags(categoryItem.cell, fortuneReport?.tieredMatrix?.glossary),
      });
    }, 0);
    setIsDetailOpen(true);
  };

  const toggleCategoryDetail = (periodOption, categoryItem) => {
    const key = categoryDetailKey(periodOption, categoryItem);
    if (activeDetail?.key === key) {
      closeCategoryDetail();
      return;
    }
    openCategoryDetail(periodOption, categoryItem);
  };

  const prepareBeforePrint = useCallback(() => {
    const previousIsDetailOpen = isDetailOpen;
    const previousShowExpertTerms = showExpertTerms;
    setIsDetailOpen(true);
    setShowExpertTerms(true); // NS-J: PDF/print captures the full expert layer.
    return { previousIsDetailOpen, previousShowExpertTerms };
  }, [isDetailOpen, showExpertTerms]);

  const restoreAfterPrint = useCallback((payload) => {
    if (!payload) return;
    setIsDetailOpen(payload.previousIsDetailOpen ?? true);
    setShowExpertTerms(payload.previousShowExpertTerms ?? false);
  }, []);

  const {
    isPdfSaving,
    isShareDialogOpen,
    shareLink,
    isLinkCopied,
    handleSavePdf,
    handleOpenShareDialog,
    closeShareDialog,
    handleCopyShareLink,
  } = useReportActions({
    reportRootRef,
    shareUserInfo,
    prepareBeforePrint,
    restoreAfterPrint,
  });

  return (
    <>
      <div ref={reportRootRef} data-pdf-root="true" className="combined-report">
        <ReportHero
          nameParts={nameParts}
          birthLabel={birthLabel}
          genderLabel={genderLabel}
          nameCompatibility={nameCompatibility}
          renderMetrics={sajuRenderMetrics}
          shareUserInfo={shareUserInfo}
        />

        <div className="cr-document-grid cr-document-grid--single">
          <main className="cr-main-content" aria-label="통합 평가 본문">
            {/* NS-J: report-wide switch between plain wording and 전문 용어(원어). */}
            <div className="cr-term-toggle" data-pdf-exclude="true">
              <button
                type="button"
                className="cr-term-toggle__btn ns-ripple"
                aria-pressed={showExpertTerms}
                onClick={() => setShowExpertTerms((value) => !value)}
              >
                {showExpertTerms ? '쉬운 말로 보기' : '전문 용어 보기'}
              </button>
              <span className="cr-term-toggle__hint">
                {showExpertTerms ? '원국 용어와 해설을 함께 보고 있어요.' : '어려운 용어는 접어 두고 쉬운 말로 보여드려요.'}
              </span>
            </div>

            <ReportSection
              id="combined-summary"
              title="총평 요약"
              description="분석 결과를 바로 읽을 수 있도록 핵심 흐름만 먼저 정리했습니다."
            >
              <div className="cr-summary-list">
                {summaryItems.map((item) => (
                  <SummaryItem key={item.key} number={item.number} title={item.title} body={item.body} />
                ))}
              </div>
            </ReportSection>

            <ReportSection
              id="combined-name"
              title="이름 평가"
              description="성명학 결과와 사주 흐름이 이름과 만나는 지점을 분리해서 봅니다."
            >
              <div className="cr-text-block">
                <h3>이름 적합도 결과</h3>
                {/* F1: 별점 summary 재사용 대신 상세 근거의 첫 줄(종합 점수 해설)을 도입부로 승격. */}
                <p>{compactText(nameDetails[0] || nameCompatibility?.summary, '이름 적합도 분석 결과를 준비 중입니다.')}</p>
              </div>
              <div className="cr-evidence-grid">
                <ScoreMetricCard label="종합" value={scoreNumber(nameCompatibility?.overallScore)} caption={scoreStateLabel(nameCompatibility?.overallScore)} />
                <ScoreMetricCard label="사주 궁합" value={scoreNumber(nameCompatibility?.sajuCompatibilityScore)} caption="사주와의 연결" />
                <ScoreMetricCard label="이름 분석" value={scoreNumber(nameCompatibility?.nameAnalysisScore)} caption="성명학 기준" />
              </div>
              {nameDetails.length > 1 ? (
                <div className="cr-note-list" aria-label="이름 평가 상세 근거">
                  {nameDetails.slice(1, 5).map((line, index) => (
                    <p key={`name-detail-${index}`}>{line}</p>
                  ))}
                </div>
              ) : null}
            </ReportSection>

            <ReportSection
              id="combined-fortune"
              title="운세"
              description="현재의 흐름과 평생의 흐름을 나눠서 봅니다. 탭을 눌러 전환하세요."
              className="cr-section--fortune"
              collapsedOnMobile
            >
              <div className="cr-fortune-tabs" role="tablist" aria-label="운세 종류 선택">
                <button
                  type="button"
                  role="tab"
                  aria-selected={fortuneTrack === 'current'}
                  onClick={() => selectFortuneTrack('current')}
                  className="cr-fortune-tab ns-ripple"
                >
                  <span>현재 운세</span>
                  <small>오늘 · 이번주 · 이번달 · 올해</small>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={fortuneTrack === 'life'}
                  onClick={() => selectFortuneTrack('life')}
                  className="cr-fortune-tab ns-ripple"
                >
                  <span>평생 운세</span>
                  <small>나이대별 흐름</small>
                </button>
              </div>

              {fortuneTrack === 'current' ? (
                <div className="cr-fortune-panel" role="tabpanel" aria-label="현재 운세">
                  <div className="cr-period-tabs" role="tablist" aria-label="기간 선택">
                    {primaryPeriodOptions.map((periodOption) => {
                      const isSelected = selectedPeriod?.key === periodOption.key;
                      return (
                        <button
                          key={periodOption.key}
                          type="button"
                          role="tab"
                          aria-selected={isSelected}
                          onClick={() => selectPeriod(periodOption.key)}
                          className="cr-period-tab ns-ripple"
                        >
                          <span>{periodOption.label}</span>
                          <small>{periodOption.periodLabel}</small>
                        </button>
                      );
                    })}
                  </div>

                  {selectedPeriod ? (
                    <div className="cr-period-summary">
                      <div>
                        <p className="cr-eyebrow">선택 기간</p>
                        <h3>{selectedPeriod.periodLabel || selectedPeriod.label}</h3>
                        {selectedPeriodSummary ? <p>{selectedPeriodSummary}</p> : null}
                      </div>
                      {selectedPeriodStars ? <StarRating score={toStars(selectedPeriodStars)} /> : null}
                    </div>
                  ) : null}

                  <CategoryInsightList
                    periodOption={selectedPeriod}
                    categoryItems={selectedCategoryItems}
                    activeDetail={activeDetail}
                    expertTagState={expertTagState}
                    onToggleDetail={toggleCategoryDetail}
                    ariaLabel="기간별 분야 해석"
                  />
                </div>
              ) : (
                <div className="cr-fortune-panel" role="tabpanel" aria-label="평생 운세">
                  <div className="cr-life-flow">
                    <div>
                      <h3>나이대별 운의 흐름</h3>
                      <p>그래프의 포인트를 선택하면 해당 나이대 흐름으로 전환됩니다.</p>
                    </div>
                    <LifeFlowChart points={lifeFlowPoints} onSelect={selectLifePeriod} />
                  </div>

                  {selectedLifePeriod ? (
                    <div className="cr-period-summary cr-period-summary--life">
                      <div>
                        <p className="cr-eyebrow cr-eyebrow--node">선택 나이대</p>
                        <h3>{selectedLifePeriod.periodLabel || selectedLifePeriod.label}</h3>
                        {selectedLifePeriodLead ? <p className="cr-daeun-lead">{selectedLifePeriodLead}</p> : null}
                        {selectedLifePeriodSummary ? <p>{selectedLifePeriodSummary}</p> : null}
                      </div>
                      {selectedLifePeriodStars ? <StarRating score={toStars(selectedLifePeriodStars)} /> : null}
                    </div>
                  ) : null}

                  <CategoryInsightList
                    periodOption={selectedLifePeriod}
                    categoryItems={selectedLifeCategoryItems}
                    activeDetail={activeDetail}
                    expertTagState={expertTagState}
                    onToggleDetail={toggleCategoryDetail}
                    ariaLabel="나이대별 분야 해석"
                  />
                </div>
              )}
            </ReportSection>

            <ReportSection
              id="combined-saju"
              title="사주 평가"
              description="사주팔자와 성향, 강점, 주의점을 한 문서 안에서 이어서 봅니다."
              collapsedOnMobile
            >
              <SajuPillarsGrid pillars={overview?.pillars} />
              {tieredPersonalReading ? (
                <div className="cr-text-block cr-personal-reading">
                  <h3>당신의 사주 프로필</h3>
                  <p className="cr-personal-reading__headline">{tieredPersonalReading.headline}</p>
                  <p>{tieredPersonalReading.paragraph}</p>
                  {tieredNameSajuReading ? (
                    <p className="cr-inline-note">{tieredNameSajuReading.sentence}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="cr-text-block">
                <h3>사주팔자 요약</h3>
                <p>{compactText(overview?.overallSummary, '사주팔자 요약을 준비 중입니다.')}</p>
              </div>
              <div className="cr-two-column">
                <div className="cr-text-block">
                  <h3>성격과 강점</h3>
                  <p>{compactText(personality?.summary, '성향 분석을 준비 중입니다.')}</p>
                  {strengths.slice(0, 2).map((item, index) => (
                    <p key={`strength-${index}`} className="cr-inline-note">{item?.text || item?.reason || '-'}</p>
                  ))}
                </div>
                <div className="cr-text-block">
                  <h3>보완과 주의</h3>
                  {(weaknesses.length ? weaknesses : cautions).slice(0, 2).map((item, index) => (
                    <p key={`watch-${index}`} className="cr-inline-note">
                      {item?.text || item?.signal || item?.response || '-'}
                    </p>
                  ))}
                </div>
              </div>
            </ReportSection>

            <InsightFactsSection insightFacts={fortuneReport?.insightFacts} />

            <PremiumReportSection
              isUnlocked={isPremiumUnlocked}
              selectedPeriod={selectedPeriod}
              selectedPeriodSummary={selectedPeriodSummary}
              selectedCategoryItems={selectedCategoryItems}
              nameCompatibility={nameCompatibility}
              onOpenPremium={onOpenPremium}
            />

            <section className="cr-related-reports" aria-label="다른 보고서 보기">
              <button type="button" className="ns-ripple" onClick={onOpenNamingReport}>
                <strong>이름 평가 보고서</strong>
                <span>성명학 중심 상세 결과를 확인합니다.</span>
              </button>
              <button type="button" className="ns-ripple" onClick={onOpenSajuReport}>
                <strong>사주 평가 보고서</strong>
                <span>사주 중심 상세 결과를 확인합니다.</span>
              </button>
            </section>

            <ReportClose />
          </main>
        </div>

        <ReportActionButtons
          isPdfSaving={isPdfSaving}
          onSavePdf={handleSavePdf}
          onShare={handleOpenShareDialog}
        />
      </div>

      <ReportPrintOverlay isPdfSaving={isPdfSaving} />
      <ReportShareDialog
        isOpen={isShareDialogOpen}
        shareLink={shareLink}
        isLinkCopied={isLinkCopied}
        onCopy={handleCopyShareLink}
        onClose={closeShareDialog}
      />
      <ReportScrollTopFab />
    </>
  );
}

export default CombiedNamingReport;



