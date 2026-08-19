// Period/life-flow judgement helpers shared by fortune sections.
// Extracted verbatim from CombiedNamingReport.jsx so the saju page can render
// the same engine data; the legacy renderer keeps its own private copy and
// stays untouched (the ?reportLegacy=1 path must not move).

export const TIERED_PERIOD_OPTIONS = [
  { key: 'today', periodKind: 'today', label: '오늘' },
  { key: 'thisWeek', periodKind: 'thisWeek', label: '이번주' },
  { key: 'thisMonth', periodKind: 'thisMonth', label: '이번달' },
  { key: 'thisYear', periodKind: 'thisYear', label: '올해' },
];

export const LIFE_STAGE_PERIOD_OPTIONS = Array.from({ length: 10 }, (_, index) => {
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

export const TIERED_CATEGORY_OPTIONS = [
  { id: 'overall', title: '총 운', subtitle: '전체적인 운세', tone: 'warn' },
  { id: 'wealth', title: '재물운', subtitle: '돈과 물건 관리', tone: 'success' },
  { id: 'health', title: '건강운', subtitle: '몸과 마음의 리듬', tone: 'danger' },
  { id: 'academic', title: '학업운', subtitle: '공부와 배움', tone: 'info' },
  { id: 'romance', title: '연애/결혼운', subtitle: '관계와 마음', tone: 'indigo' },
  { id: 'family', title: '가족운', subtitle: '가족 관계', tone: 'cyan' },
];

export const DETAIL_TAG_LIMIT = 12;

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function toStars(value) {
  return clamp(Number(value) || 0, 1, 5);
}

function scoreNumber(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

export function normalizeText(value) {
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

export function cellSummary(cell, fallback = '운세 정보를 준비 중입니다.') {
  return firstSentence(
    cell?.brief?.headline
    || cell?.brief?.hook
    || paragraphToText(asArray(cell?.standard?.paragraphs)[0])
    || fallback,
  ) || fallback;
}

export function cellDetailParagraphs(cell) {
  const paragraphs = asArray(cell?.standard?.paragraphs)
    .map(paragraphToText)
    .filter(Boolean);
  if (paragraphs.length) return paragraphs;
  const fallback = cellSummary(cell, '');
  return fallback ? [fallback] : [];
}

export function cellLivingTips(cell) {
  return asArray(cell?.standard?.livingTips).map(normalizeText).filter(Boolean);
}

export function cellCautions(cell) {
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

export function buildPeriodOptions(fortuneReport) {
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

export function buildCategoryItems(periodOption) {
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

export function buildLifeFlowPoints(periodOptions, lifeCurve) {
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

function tagLabelFromGlossary(tagId, tokenLabel, glossary) {
  const entry = glossary?.entries?.[tagId];
  const raw = normalizeText(entry?.hashLabel || tokenLabel || entry?.label || tagId);
  if (!raw) return '';
  return raw.startsWith('#') ? raw : `#${raw}`;
}

export function collectExpertTags(cell, glossary) {
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

export function categoryDetailKey(periodOption, categoryItem) {
  return `${periodOption?.key || 'period'}:${categoryItem?.id || 'category'}`;
}

export function categoryDetailPanelId(key) {
  return `fortune-category-detail-${String(key).replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
}
