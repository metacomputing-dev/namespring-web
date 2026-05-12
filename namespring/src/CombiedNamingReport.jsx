import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReportActionButtons,
  ReportPrintOverlay,
  ReportScrollTopFab,
  ReportShareDialog,
  useReportActions,
} from './report-common-ui';
import {
  CollapsibleCard,
  CollapsibleMiniCard,
  REPORT_HOME_CARD_TONE_MAP,
  StarRating,
  getNestedGradientClass,
  getNestedMiniCardClass,
} from './report-modules-ui';
import { getElementToneClass } from './theme/report-ui-theme';

const CARD_TONE = {
  fit: REPORT_HOME_CARD_TONE_MAP.report,
  summary: REPORT_HOME_CARD_TONE_MAP.info,
  periods: REPORT_HOME_CARD_TONE_MAP.gratitude,
};

const SUMMARY_MINI_CARD_CLASSES = [
  getNestedMiniCardClass('info'),
  getNestedMiniCardClass('success'),
  getNestedMiniCardClass('cyan'),
  getNestedMiniCardClass('warn'),
  getNestedMiniCardClass('danger'),
];

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

function buildMiniKey(section, key) {
  return `${section}:${key}`;
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

function getPillarElementCardClass(elementKey) {
  return getElementToneClass(elementKey || '');
}

function buildEightPillarComponents(pillars) {
  const list = asArray(pillars);
  const rows = [];

  list.forEach((pillar, index) => {
    const position = pillar?.position || `기둥 ${index + 1}`;
    const { stemElement, branchElement } = splitPillarElements(pillar?.element);
    rows.push({
      key: `stem-${index}`,
      label: `${position} 천간`,
      value: pillar?.stem || '-',
      element: stemElement || '-',
      elementKey: normalizeElementKey(stemElement),
    });
    rows.push({
      key: `branch-${index}`,
      label: `${position} 지지`,
      value: pillar?.branch || '-',
      element: branchElement || '-',
      elementKey: normalizeElementKey(branchElement),
    });
  });

  while (rows.length < 8) {
    const idx = rows.length + 1;
    rows.push({
      key: `empty-${idx}`,
      label: `성분 ${idx}`,
      value: '-',
      element: '-',
      elementKey: '',
    });
  }

  return rows.slice(0, 8);
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
          period,
          periodLabel: period.periodLabel || option.label,
        };
      })
      .filter(Boolean);
    const lifePeriod = matrixPeriods.life;
    const lifeStages = lifePeriod
      ? LIFE_STAGE_PERIOD_OPTIONS.map((option) => {
        const ageBandPeriod = lifePeriod.byAgeBand?.[option.ageBand];
        return {
          ...option,
          period: ageBandPeriod || lifePeriod,
          periodLabel: ageBandPeriod?.periodLabel || option.label,
          selectorAgeBand: ageBandPeriod?.selectorAgeBand || '',
          lifeStage: findLifeStage(fortuneReport?.lifeStageFortune, option.startAge, option.endAge),
        };
      })
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
  const lifeStages = LIFE_STAGE_PERIOD_OPTIONS.map((option) => ({
    ...option,
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
  asArray(cell?.expert?.paragraphs).forEach((paragraph) => {
    asArray(paragraph?.tokens).forEach((token) => {
      if (token?.kind !== 'tag' || !token.tagId || seen.has(token.tagId)) return;
      const label = tagLabelFromGlossary(token.tagId, token.label, glossary);
      if (!label) return;
      seen.add(token.tagId);
      tags.push({ id: token.tagId, label });
    });
  });
  asArray(cell?.selectedFragments?.expert?.tags).forEach((tagId) => {
    if (!tagId || seen.has(tagId)) return;
    const label = tagLabelFromGlossary(tagId, '', glossary);
    if (!label) return;
    seen.add(tagId);
    tags.push({ id: tagId, label });
  });
  return tags.slice(0, DETAIL_TAG_LIMIT);
}

function CombiedNamingReport({
  fortuneReport,
  onOpenNamingReport,
  onOpenSajuReport,
  shareUserInfo = null,
}) {
  const reportRootRef = useRef(null);
  const [openSections, setOpenSections] = useState({
    fit: false,
    summary: false,
    periods: false,
  });
  const [openMini, setOpenMini] = useState({});
  const [selectedPeriodKey, setSelectedPeriodKey] = useState('today');
  const [activeDetail, setActiveDetail] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(true);
  const [activeExpertTags, setActiveExpertTags] = useState([]);

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleMini = (key) => {
    setOpenMini((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const summaryCards = useMemo(() => {
    const overview = fortuneReport?.overviewSummary;
    const life = fortuneReport?.lifeFortuneOverview;
    const personality = fortuneReport?.personality;
    const strengths = fortuneReport?.strengthsWeaknesses;
    const cautions = fortuneReport?.cautions;

    return [
      {
        key: 'saju-card',
        title: '사주팔자 카드',
        subtitle: '핵심 구조 요약',
        body: (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--ns-text)]">{overview?.overallSummary || '-'}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {buildEightPillarComponents(overview?.pillars).map((item) => (
                <div key={item.key} className={`rounded-xl border px-2 py-2 ${getPillarElementCardClass(item.elementKey)}`}>
                  <p className="text-[10px] font-black opacity-80">{item.label}</p>
                  <p className="text-sm leading-tight font-black mt-0.5">{item.value}</p>
                  <p className="text-[10px] font-black mt-1">{item.element}</p>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        key: 'life-summary',
        title: '인생 운세 총평',
        subtitle: life?.title || '장기 흐름',
        body: (
          <div className="space-y-2">
            <StarRating score={toStars(life?.stars)} />
            <p className="text-sm font-semibold text-[var(--ns-text)]">{life?.summary || '-'}</p>
            {asArray(life?.highlights).length ? (
              <div className="space-y-1">
                {asArray(life?.highlights).map((line, index) => (
                  <p key={`life-highlight-${index}`} className="text-xs text-[var(--ns-muted)]">{`- ${line}`}</p>
                ))}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        key: 'tendency',
        title: '나의 성향',
        subtitle: '핵심 특성',
        body: (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--ns-text)]">{personality?.summary || '-'}</p>
            <div className="space-y-1.5">
              {asArray(personality?.traits).map((trait, index) => (
                <div key={`trait-${index}`} className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)]/20 px-2.5 py-2">
                  <p className="text-xs font-black text-[var(--ns-accent-text)]">{trait?.trait || '-'}</p>
                  <p className="text-sm font-semibold text-[var(--ns-text)]">{trait?.description || '-'}</p>
                  <p className="text-[11px] text-[var(--ns-muted)]">근거: {trait?.source || '-'}</p>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        key: 'strength-weakness',
        title: '나의 장/단점',
        subtitle: '강점과 보완점',
        body: (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="rounded-lg border border-[var(--ns-tone-success-border)] bg-[var(--ns-tone-success-bg)]/20 px-2.5 py-2 space-y-1.5">
              <p className="text-xs font-black text-[var(--ns-tone-success-text)]">강점</p>
              {asArray(strengths?.strengths).map((item, index) => (
                <div key={`strength-${index}`}>
                  <p className="text-sm font-semibold text-[var(--ns-text)]">{item?.text || '-'}</p>
                  <p className="text-[11px] text-[var(--ns-muted)]">이유: {item?.reason || '-'}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-[var(--ns-tone-danger-border)] bg-[var(--ns-tone-danger-bg)]/20 px-2.5 py-2 space-y-1.5">
              <p className="text-xs font-black text-[var(--ns-tone-danger-text)]">보완점</p>
              {asArray(strengths?.weaknesses).map((item, index) => (
                <div key={`weakness-${index}`}>
                  <p className="text-sm font-semibold text-[var(--ns-text)]">{item?.text || '-'}</p>
                  <p className="text-[11px] text-[var(--ns-muted)]">이유: {item?.reason || '-'}</p>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        key: 'caution',
        title: '유의점',
        subtitle: '주의 신호와 대응',
        body: (
          <div className="space-y-1.5">
            {asArray(cautions?.cautions).map((item, index) => (
              <div key={`caution-${index}`} className="rounded-lg border border-[var(--ns-tone-warn-border)] bg-[var(--ns-tone-warn-bg)]/20 px-2.5 py-2">
                <p className="text-sm font-semibold text-[var(--ns-text)]">신호: {item?.signal || '-'}</p>
                <p className="text-sm text-[var(--ns-text)]">대응: {item?.response || '-'}</p>
                <p className="text-[11px] text-[var(--ns-muted)]">이유: {item?.reason || '-'}</p>
              </div>
            ))}
          </div>
        ),
      },
    ];
  }, [fortuneReport]);

  const periodOptions = useMemo(() => buildPeriodOptions(fortuneReport), [fortuneReport]);
  const selectedPeriod = periodOptions.find((item) => item.key === selectedPeriodKey) || periodOptions[0] || null;
  const selectedCategoryItems = useMemo(
    () => buildCategoryItems(selectedPeriod),
    [selectedPeriod],
  );
  const selectedPeriodOverall = selectedPeriod?.period?.overall || null;
  const selectedPeriodStars = selectedPeriod?.lifeStage?.stars || selectedPeriodOverall?.stars || null;
  const selectedPeriodSummary = selectedPeriod?.lifeStage?.summary || cellSummary(selectedPeriodOverall, '');

  const allMiniKeys = useMemo(() => {
    const keys = [];
    summaryCards.forEach((item) => keys.push(buildMiniKey('summary', item.key)));
    return keys;
  }, [summaryCards]);

  const selectPeriod = (periodKey) => {
    setSelectedPeriodKey(periodKey);
    setActiveDetail(null);
    setActiveExpertTags([]);
    setIsDetailOpen(true);
  };

  const openCategoryDetail = (periodOption, categoryItem) => {
    if (!periodOption || !categoryItem?.cell) return;
    const key = `${periodOption.key}:${categoryItem.id}`;
    setActiveDetail({
      key,
      periodLabel: periodOption.periodLabel || periodOption.label,
      periodSubtitle: periodOption.period?.periodLabel || '',
      categoryTitle: categoryItem.title,
      categorySubtitle: categoryItem.subtitle,
      cell: categoryItem.cell,
      lifeStage: periodOption.lifeStage || null,
    });
    setActiveExpertTags(collectExpertTags(categoryItem.cell, fortuneReport?.tieredMatrix?.glossary));
    setIsDetailOpen(true);
  };

  const prepareBeforePrint = useCallback(() => {
    const previousOpenSections = { ...openSections };
    const previousOpenMini = { ...openMini };
    setOpenSections({ fit: true, summary: true, periods: true });

    const expandedMini = {};
    allMiniKeys.forEach((key) => {
      expandedMini[key] = true;
    });
    setOpenMini(expandedMini);

    return { previousOpenSections, previousOpenMini };
  }, [allMiniKeys, openMini, openSections]);

  const restoreAfterPrint = useCallback((payload) => {
    if (!payload) return;
    setOpenSections(payload.previousOpenSections || { fit: false, summary: false, periods: false });
    setOpenMini(payload.previousOpenMini || {});
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

  const nameLabel = useMemo(() => getNameLabelFromUserInfo(shareUserInfo), [shareUserInfo]);

  const nameCompatibility = fortuneReport?.nameCompatibility;

  return (
    <>
      <div ref={reportRootRef} data-pdf-root="true" className="space-y-4">
        <CollapsibleCard
          title="이름 적합도 평가"
          subtitle="사주와 성명학을 함께 고려한 결과 카드입니다."
          open={openSections.fit}
          onToggle={() => toggleSection('fit')}
          tone="fit"
          toneMap={CARD_TONE}
        >
          <div className="rounded-2xl border border-[var(--ns-tone-success-border)] bg-gradient-to-r from-[var(--ns-tone-success-bg)] via-[var(--ns-surface-soft)] to-[var(--ns-report-grad-end)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-[var(--ns-tone-success-text)]">이름 적합도 결과</p>
                <h2 className="mt-1 text-2xl font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">{nameLabel}</h2>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-[var(--ns-tone-success-text)]">종합 별점</p>
                <StarRating score={toStars(nameCompatibility?.overallStars || 3)} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)]/20 px-3 py-2">
                <p className="text-[11px] font-black text-[var(--ns-muted)]">한 줄 결론</p>
                <p className="font-semibold text-[var(--ns-text)]">{nameCompatibility?.summary || '이름 적합도 분석 결과를 준비 중입니다.'}</p>
              </div>
              <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)]/20 px-3 py-2">
                <p className="text-[11px] font-black text-[var(--ns-muted)]">핵심 점수</p>
                <p className="font-semibold text-[var(--ns-text)]">{`종합 ${Math.round(Number(nameCompatibility?.overallScore) || 0)} / 사주 ${Math.round(Number(nameCompatibility?.sajuCompatibilityScore) || 0)} / 이름 ${Math.round(Number(nameCompatibility?.nameAnalysisScore) || 0)}`}</p>
              </div>
              <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)]/20 px-3 py-2">
                <p className="text-[11px] font-black text-[var(--ns-muted)]">조언 이유</p>
                <p className="font-semibold text-[var(--ns-text)]">{asArray(nameCompatibility?.details)[0] || '세부 설명이 준비 중입니다.'}</p>
              </div>
            </div>
            {asArray(nameCompatibility?.details).length > 1 ? (
              <div className="mt-2 space-y-1">
                {asArray(nameCompatibility?.details).slice(1).map((line, index) => (
                  <p key={`name-detail-${index}`} className="text-xs text-[var(--ns-muted)]">{`- ${line}`}</p>
                ))}
              </div>
            ) : null}
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="총평 요약"
          subtitle="전문 용어를 줄이고, 이해하기 쉬운 핵심만 모았습니다."
          open={openSections.summary}
          onToggle={() => toggleSection('summary')}
          tone="summary"
          toneMap={CARD_TONE}
        >
          <div className={`space-y-2.5 rounded-2xl border border-[var(--ns-tone-info-border)] ${getNestedGradientClass('info')} p-2`}>
            {summaryCards.map((item, summaryIndex) => {
              const key = buildMiniKey('summary', item.key);
              return (
                <CollapsibleMiniCard
                  key={key}
                  title={item.title}
                  subtitle={item.subtitle}
                  open={Boolean(openMini[key])}
                  onToggle={() => toggleMini(key)}
                  className={SUMMARY_MINI_CARD_CLASSES[summaryIndex % SUMMARY_MINI_CARD_CLASSES.length]}
                >
                  {item.body}
                </CollapsibleMiniCard>
              );
            })}
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="기간 별 운세"
          subtitle="기간을 고른 뒤, 해당 기간의 분야별 흐름을 확인하세요."
          open={openSections.periods}
          onToggle={() => toggleSection('periods')}
          tone="periods"
          toneMap={CARD_TONE}
        >
          <div className={`space-y-2.5 rounded-2xl border border-[var(--ns-tone-warn-border)] ${getNestedGradientClass('warn')} p-2`}>
            <div className="space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {periodOptions.map((periodOption) => {
                  const isSelected = selectedPeriod?.key === periodOption.key;
                  return (
                    <button
                      key={periodOption.key}
                      type="button"
                      onClick={() => selectPeriod(periodOption.key)}
                      className={`rounded-xl border px-2.5 py-2 text-left transition-colors ${isSelected ? 'border-[var(--ns-tone-warn-border)] bg-[var(--ns-tone-warn-bg)]/40' : 'border-[var(--ns-border)] bg-[var(--ns-surface)]/20 hover:bg-[var(--ns-surface-soft)]/30'}`}
                    >
                      <span className="block text-sm font-black text-[var(--ns-accent-text)]">{periodOption.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-[var(--ns-muted)] break-keep whitespace-normal">
                        {periodOption.isLifeStage ? '생애시기' : periodOption.periodLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedPeriod ? (
                <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)]/20 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-black text-[var(--ns-tone-warn-text)]">선택 기간</p>
                      <p className="text-base font-black text-[var(--ns-accent-text)]">{selectedPeriod.periodLabel || selectedPeriod.label}</p>
                    </div>
                    {selectedPeriodStars ? <StarRating score={toStars(selectedPeriodStars)} /> : null}
                  </div>
                  {selectedPeriodSummary ? (
                    <p className="mt-2 text-sm font-semibold text-[var(--ns-text)]">{selectedPeriodSummary}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {selectedCategoryItems.map((item) => {
                  const isActive = activeDetail?.key === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => openCategoryDetail(selectedPeriod, item)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${isActive ? 'border-[var(--ns-tone-warn-border)] bg-[var(--ns-tone-warn-bg)]/40' : `${getNestedMiniCardClass(item.tone)} hover:bg-[var(--ns-surface-soft)]/30`}`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block text-sm font-black text-[var(--ns-accent-text)]">{item.title}</span>
                          <span className="mt-0.5 block text-[11px] text-[var(--ns-muted)]">{item.subtitle}</span>
                        </span>
                        {item.cell?.stars ? <StarRating score={toStars(item.cell.stars)} /> : null}
                      </span>
                      <span className="mt-2 block text-sm font-semibold leading-relaxed text-[var(--ns-text)] break-keep whitespace-normal">{item.summary}</span>
                      <span className="mt-2 inline-flex text-[11px] font-black text-[var(--ns-muted)]">상세 보기</span>
                    </button>
                  );
                })}
              </div>

              {activeDetail ? (
                <section className="rounded-xl border border-[var(--ns-tone-info-border)] bg-[var(--ns-tone-info-bg)]/20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsDetailOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-black text-[var(--ns-tone-info-text)]">{activeDetail.periodLabel}</span>
                      <span className="block text-base font-black text-[var(--ns-accent-text)]">{activeDetail.categoryTitle}</span>
                      <span className="mt-0.5 block text-xs text-[var(--ns-muted)]">{activeDetail.categorySubtitle}</span>
                    </span>
                    <span className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--ns-border)] bg-[var(--ns-surface)]">
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        className={`w-4 h-4 text-[var(--ns-muted)] transition-transform duration-200 ${isDetailOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      >
                        <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>

                  {isDetailOpen ? (
                    <div className="px-3 pb-3 space-y-2.5">
                      <div className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)]/20 px-2.5 py-2 space-y-1.5">
                        <p className="text-xs font-black text-[var(--ns-muted)]">상세 내용</p>
                        {cellDetailParagraphs(activeDetail.cell).map((paragraph, index) => (
                          <p key={`detail-paragraph-${activeDetail.key}-${index}`} className="text-sm leading-relaxed font-semibold text-[var(--ns-text)] break-keep whitespace-normal">{paragraph}</p>
                        ))}
                      </div>

                      {cellLivingTips(activeDetail.cell).length ? (
                        <div className="rounded-lg border border-[var(--ns-tone-success-border)] bg-[var(--ns-tone-success-bg)]/20 px-2.5 py-2">
                          <p className="text-xs font-black text-[var(--ns-tone-success-text)]">도움 되는 행동</p>
                          <div className="mt-1 space-y-1">
                            {cellLivingTips(activeDetail.cell).map((tip, index) => (
                              <p key={`living-tip-${activeDetail.key}-${index}`} className="text-sm font-semibold text-[var(--ns-text)]">{`- ${tip}`}</p>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {cellCautions(activeDetail.cell).length ? (
                        <div className="rounded-lg border border-[var(--ns-tone-warn-border)] bg-[var(--ns-tone-warn-bg)]/20 px-2.5 py-2">
                          <p className="text-xs font-black text-[var(--ns-tone-warn-text)]">주의할 점</p>
                          <div className="mt-1 space-y-1">
                            {cellCautions(activeDetail.cell).map((caution, index) => (
                              <p key={`caution-${activeDetail.key}-${index}`} className="text-sm font-semibold text-[var(--ns-text)]">{`- ${caution}`}</p>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {activeDetail.lifeStage?.highlights?.length ? (
                        <div className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)]/20 px-2.5 py-2">
                          <p className="text-xs font-black text-[var(--ns-muted)]">선택한 생애시기 참고</p>
                          {asArray(activeDetail.lifeStage.highlights).map((line, index) => (
                            <p key={`life-stage-highlight-${activeDetail.key}-${index}`} className="mt-1 text-sm font-semibold text-[var(--ns-text)]">{`- ${line}`}</p>
                          ))}
                        </div>
                      ) : null}

                      <div className="rounded-lg border border-[var(--ns-tone-indigo-border)] bg-[var(--ns-tone-indigo-bg)]/20 px-2.5 py-2">
                        <p className="text-xs font-black text-[var(--ns-tone-indigo-text)]">전문태그</p>
                        {activeExpertTags.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {activeExpertTags.map((tag) => (
                              <span key={`${activeDetail.key}-${tag.id}`} className="inline-flex items-center rounded-full border border-[var(--ns-tone-indigo-border)] bg-[var(--ns-surface)]/40 px-2 py-1 text-xs font-black text-[var(--ns-accent-text)]">
                                {tag.label}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-sm font-semibold text-[var(--ns-muted)]">이 상세 항목에는 붙일 전문태그가 없어요.</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          </div>
        </CollapsibleCard>

        <section className="rounded-2xl border border-[var(--ns-tone-info-border)] bg-gradient-to-r from-[var(--ns-tone-info-bg)] via-[var(--ns-surface-soft)] to-[var(--ns-report-grad-end)] px-3 py-3">
          <p className="text-sm font-black text-[var(--ns-accent-text)]">다른 보고서 보기</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenNamingReport}
              className="w-full rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)]/20 px-3 py-3 text-left hover:bg-[var(--ns-surface-soft)]/20 transition-colors"
            >
              <span className="inline-flex items-center gap-1.5 text-sm font-black text-[var(--ns-accent-text)]">이름 평가 보고서</span>
              <span className="mt-1 block text-[11px] leading-relaxed font-semibold text-[var(--ns-muted)]">성명학 중심 상세 결과를 확인합니다.</span>
            </button>
            <button
              type="button"
              onClick={onOpenSajuReport}
              className="w-full rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)]/20 px-3 py-3 text-left hover:bg-[var(--ns-surface-soft)]/20 transition-colors"
            >
              <span className="inline-flex items-center gap-1.5 text-sm font-black text-[var(--ns-accent-text)]">사주 평가 보고서</span>
              <span className="mt-1 block text-[11px] leading-relaxed font-semibold text-[var(--ns-muted)]">사주 중심 상세 결과를 확인합니다.</span>
            </button>
          </div>
        </section>

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



