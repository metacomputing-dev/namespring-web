import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReportActionButtons,
  ReportPrintOverlay,
  ReportScrollTopFab,
  ReportShareDialog,
  useReportActions,
} from './report-common-ui';
import {
  StarRating,
} from './report-modules-ui';

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

function elementClassSuffix(elementKey) {
  const value = normalizeElementKey(elementKey).toLowerCase();
  return value || 'neutral';
}

function buildSummaryItems(fortuneReport, nameCompatibility) {
  const overview = fortuneReport?.overviewSummary;
  const personality = fortuneReport?.personality;
  const strengths = fortuneReport?.strengthsWeaknesses;
  const cautions = fortuneReport?.cautions;
  const firstCaution = asArray(cautions?.cautions)[0];
  const firstStrength = asArray(strengths?.strengths)[0];

  return [
    {
      key: 'saju-flow',
      number: '01',
      title: '사주 흐름',
      body: compactText(overview?.overallSummary, '사주 흐름 요약을 준비 중입니다.'),
    },
    {
      key: 'name-harmony',
      number: '02',
      title: '이름과의 조화',
      body: compactText(nameCompatibility?.summary, '이름과 사주의 조화 분석을 준비 중입니다.'),
    },
    {
      key: 'watch-point',
      number: '03',
      title: firstStrength?.text ? '살려볼 점' : '살펴볼 점',
      body: compactText(firstStrength?.reason || firstCaution?.response || personality?.summary, '보완할 흐름을 차분히 살펴보면 좋습니다.'),
    },
  ];
}

function buildLifeFlowPoints(periodOptions) {
  const lifePeriods = asArray(periodOptions).filter((item) => item?.isLifeStage).slice(0, 10);
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
    return {
      key: item.key,
      label: item.label.replace('세', ''),
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
    const lifeStages = lifePeriod
      ? LIFE_STAGE_PERIOD_OPTIONS.map((option) => {
        const ageBandPeriod = lifePeriod.byAgeBand?.[option.ageBand];
        return {
          ...option,
          isMatrixPeriod: true,
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
  const lifeStages = LIFE_STAGE_PERIOD_OPTIONS.map((option) => ({
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

function ScoreMetricCard({ label, value, caption }) {
  return (
    <div className="cr-metric-card">
      <p className="cr-metric-card__label">{label}</p>
      <p className="cr-metric-card__value">{value}</p>
      {caption ? <p className="cr-metric-card__caption">{caption}</p> : null}
    </div>
  );
}

function ReportHero({ nameParts, birthLabel, genderLabel, nameCompatibility }) {
  const overallScore = scoreNumber(nameCompatibility?.overallScore);
  const sajuScore = scoreNumber(nameCompatibility?.sajuCompatibilityScore);
  const nameScore = scoreNumber(nameCompatibility?.nameAnalysisScore);
  const summary = compactText(nameCompatibility?.summary, '이름 적합도 분석 결과를 준비 중입니다.');

  return (
    <section className="cr-hero" aria-labelledby="combined-report-hero-title">
      <div className="cr-hero__main">
        <div className="cr-hero__identity">
          <p className="cr-eyebrow">이름 적합도 평가</p>
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

function ReportSection({ id, eyebrow, title, description, children, className = '' }) {
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
    <div className={compact ? 'cr-pillars cr-pillars--compact' : 'cr-pillars'}>
      <table className="cr-pillars__table" aria-label="사주팔자 4기둥">
        <thead>
          <tr>
            <th scope="col">구분</th>
            {columns.map((pillar) => (
              <th key={`${pillar.key}-head`} scope="col">{pillar.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">천간</th>
            {columns.map((pillar) => (
              <td key={`${pillar.key}-stem`}>
                <span className="cr-pillars__symbol">{pillar.stem}</span>
                <span className={`cr-element-chip cr-element-chip--${elementClassSuffix(pillar.stemElementKey)}`}>
                  {pillar.stemElement}
                </span>
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">지지</th>
            {columns.map((pillar) => (
              <td key={`${pillar.key}-branch`}>
                <span className="cr-pillars__symbol">{pillar.branch}</span>
                <span className={`cr-element-chip cr-element-chip--${elementClassSuffix(pillar.branchElementKey)}`}>
                  {pillar.branchElement}
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SummaryRail({ nameParts, birthLabel, genderLabel, nameCompatibility, pillars }) {
  const overallScore = scoreNumber(nameCompatibility?.overallScore);
  const sajuScore = scoreNumber(nameCompatibility?.sajuCompatibilityScore);
  const nameScore = scoreNumber(nameCompatibility?.nameAnalysisScore);

  return (
    <aside className="cr-summary-rail" aria-label="통합 보고서 요약">
      <section className="cr-rail-card">
        <p className="cr-rail-card__label">이름</p>
        <h2 className="cr-rail-card__name">{nameParts.hangul}</h2>
        {nameParts.hanja ? <p className="cr-rail-card__hanja">{nameParts.hanja}</p> : null}
        <p className="cr-rail-card__meta">{birthLabel}</p>
        <p className="cr-rail-card__meta">{genderLabel}</p>
      </section>

      <section className="cr-rail-card">
        <p className="cr-rail-card__label">사주팔자</p>
        <SajuPillarsGrid pillars={pillars} compact />
      </section>

      <section className="cr-rail-card">
        <p className="cr-rail-card__label">핵심 점수</p>
        <div className="cr-rail-scores">
          <span>종합 <strong>{overallScore}</strong></span>
          <span>사주 <strong>{sajuScore}</strong></span>
          <span>이름 <strong>{nameScore}</strong></span>
        </div>
      </section>

      <nav className="cr-rail-nav" aria-label="통합 보고서 빠른 이동">
        <a href="#combined-name">이름 평가</a>
        <a href="#combined-saju">사주 요약</a>
        <a href="#combined-summary">총평</a>
        <a href="#combined-periods">기간별 운세</a>
      </nav>
    </aside>
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
  const min = Math.min(...values);
  const max = Math.max(...values);
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

  return (
    <div className="cr-life-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="나이대별 운의 흐름 그래프">
        <path d={path} fill="none" stroke="var(--color-wood)" strokeWidth="3" strokeLinecap="round" />
        {coords.map((point) => (
          <g
            key={point.key}
            role="button"
            tabIndex={0}
            aria-label={`${point.label} 운의 흐름 ${point.value}`}
            onClick={() => onSelect?.(point.key)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect?.(point.key);
              }
            }}
            className="cr-life-chart__point"
          >
            <circle
              cx={point.x}
              cy={point.y}
              r={point.isSelected ? 8 : 5}
              fill={point.isSelected ? 'var(--color-accent)' : 'var(--color-paper-2)'}
              stroke="var(--color-wood)"
              strokeWidth="2"
            />
            <text x={point.x} y={height - 12} textAnchor="middle" fill="var(--color-ink-3)" fontSize="12" fontWeight="800">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function CombiedNamingReport({
  fortuneReport,
  onOpenNamingReport,
  onOpenSajuReport,
  shareUserInfo = null,
}) {
  const reportRootRef = useRef(null);
  const [selectedPeriodKey, setSelectedPeriodKey] = useState('today');
  const [activeDetail, setActiveDetail] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(true);
  const [expertTagState, setExpertTagState] = useState({ status: 'idle', tags: [] });
  const expertTagRequestRef = useRef(0);

  const periodOptions = useMemo(() => buildPeriodOptions(fortuneReport), [fortuneReport]);
  const selectedPeriod = periodOptions.find((item) => item.key === selectedPeriodKey) || periodOptions[0] || null;
  const primaryPeriodOptions = useMemo(
    () => periodOptions.filter((item) => !item.isLifeStage).slice(0, 4),
    [periodOptions],
  );
  const selectedCategoryItems = useMemo(
    () => buildCategoryItems(selectedPeriod),
    [selectedPeriod],
  );
  const selectedPeriodOverall = selectedPeriod?.period?.overall || null;
  const selectedPeriodStars = selectedPeriodOverall?.stars || selectedPeriod?.lifeStage?.stars || null;
  const selectedPeriodSummary = cellSummary(selectedPeriodOverall, '') || selectedPeriod?.lifeStage?.summary || '';
  const nameCompatibility = fortuneReport?.nameCompatibility;
  const nameParts = useMemo(() => getNamePartsFromUserInfo(shareUserInfo), [shareUserInfo]);
  const birthLabel = useMemo(() => formatBirthDateTimeLabel(shareUserInfo), [shareUserInfo]);
  const genderLabel = useMemo(() => formatGenderLabel(shareUserInfo?.gender), [shareUserInfo]);
  const overview = fortuneReport?.overviewSummary || {};
  const summaryItems = useMemo(
    () => buildSummaryItems(fortuneReport, nameCompatibility),
    [fortuneReport, nameCompatibility],
  );
  const lifeFlowPoints = useMemo(() => {
    return buildLifeFlowPoints(periodOptions).map((point) => ({
      ...point,
      isSelected: point.key === selectedPeriodKey,
    }));
  }, [periodOptions, selectedPeriodKey]);
  const nameDetails = asArray(nameCompatibility?.details).filter(Boolean);
  const personality = fortuneReport?.personality || {};
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

  const closeCategoryDetail = () => {
    setActiveDetail(null);
    expertTagRequestRef.current += 1;
    setExpertTagState({ status: 'idle', tags: [] });
    setIsDetailOpen(true);
  };

  const openCategoryDetail = (periodOption, categoryItem) => {
    if (!periodOption || !categoryItem?.cell) return;
    const key = `${periodOption.key}:${categoryItem.id}`;
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

  const prepareBeforePrint = useCallback(() => {
    const previousIsDetailOpen = isDetailOpen;
    setIsDetailOpen(true);
    return { previousIsDetailOpen };
  }, [isDetailOpen]);

  const restoreAfterPrint = useCallback((payload) => {
    if (!payload) return;
    setIsDetailOpen(payload.previousIsDetailOpen ?? true);
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
        />

        <div className="cr-document-grid">
          <SummaryRail
            nameParts={nameParts}
            birthLabel={birthLabel}
            genderLabel={genderLabel}
            nameCompatibility={nameCompatibility}
            pillars={overview?.pillars}
          />

          <main className="cr-main-content" aria-label="통합 평가 본문">
            <ReportSection
              id="combined-summary"
              eyebrow="Summary"
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
              eyebrow="Name"
              title="이름 평가"
              description="성명학 결과와 사주 흐름이 이름과 만나는 지점을 분리해서 봅니다."
            >
              <div className="cr-text-block">
                <h3>이름 적합도 결과</h3>
                <p>{compactText(nameCompatibility?.summary, '이름 적합도 분석 결과를 준비 중입니다.')}</p>
              </div>
              <div className="cr-evidence-grid">
                <ScoreMetricCard label="종합" value={scoreNumber(nameCompatibility?.overallScore)} caption={scoreStateLabel(nameCompatibility?.overallScore)} />
                <ScoreMetricCard label="사주 궁합" value={scoreNumber(nameCompatibility?.sajuCompatibilityScore)} caption="사주와의 연결" />
                <ScoreMetricCard label="이름 분석" value={scoreNumber(nameCompatibility?.nameAnalysisScore)} caption="성명학 기준" />
              </div>
              {nameDetails.length ? (
                <div className="cr-note-list" aria-label="이름 평가 상세 근거">
                  {nameDetails.slice(0, 4).map((line, index) => (
                    <p key={`name-detail-${index}`}>{line}</p>
                  ))}
                </div>
              ) : null}
            </ReportSection>

            <ReportSection
              id="combined-saju"
              eyebrow="Saju"
              title="사주 평가"
              description="사주팔자와 성향, 강점, 주의점을 한 문서 안에서 이어서 봅니다."
            >
              <SajuPillarsGrid pillars={overview?.pillars} />
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

            <ReportSection
              id="combined-periods"
              eyebrow="Fortune"
              title="기간별 운세"
              description="기간과 분야를 선택하면 해당 흐름의 핵심과 상세 근거를 확인할 수 있습니다."
              className="cr-section--periods"
            >
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
                      className="cr-period-tab"
                    >
                      <span>{periodOption.label}</span>
                      <small>{periodOption.periodLabel}</small>
                    </button>
                  );
                })}
              </div>

              <div className="cr-life-flow">
                <div>
                  <h3>나이대별 운의 흐름</h3>
                  <p>그래프의 포인트를 선택하면 해당 나이대 흐름으로 전환됩니다.</p>
                </div>
                <LifeFlowChart points={lifeFlowPoints} onSelect={selectPeriod} />
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

              {!activeDetail ? (
                <div className="cr-category-grid">
                  {selectedCategoryItems.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => openCategoryDetail(selectedPeriod, item)}
                      className={`cr-category-card cr-category-card--${item.tone}`}
                    >
                      <span className="cr-category-card__head">
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.subtitle}</small>
                        </span>
                        {item.cell?.stars ? <StarRating score={toStars(item.cell.stars)} /> : null}
                      </span>
                      <span className="cr-category-card__summary">{item.summary}</span>
                      <span className="cr-category-card__action">상세 보기</span>
                    </button>
                  ))}
                </div>
              ) : (
                <article className="cr-detail-panel" id="combined-period-detail">
                  <div className="cr-detail-panel__head">
                    <div>
                      <p className="cr-eyebrow">{activeDetail.periodLabel}</p>
                      <h3>{activeDetail.categoryTitle}</h3>
                      <p>{activeDetail.summary}</p>
                    </div>
                    <button type="button" onClick={closeCategoryDetail} className="ns-secondary-button">
                      분야 목록
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDetailOpen((prev) => !prev)}
                    className="cr-disclosure"
                    aria-expanded={isDetailOpen}
                    aria-controls="combined-period-detail-body"
                  >
                    <span>상세 근거</span>
                    <span aria-hidden="true">{isDetailOpen ? '접기' : '펼치기'}</span>
                  </button>

                  {isDetailOpen ? (
                    <div id="combined-period-detail-body" className="cr-detail-panel__body">
                      <div className="cr-note-list">
                        {cellDetailParagraphs(activeDetail.cell).map((paragraph, index) => (
                          <p key={`detail-paragraph-${activeDetail.key}-${index}`}>{paragraph}</p>
                        ))}
                      </div>
                      <div className="cr-two-column">
                        {cellLivingTips(activeDetail.cell).length ? (
                          <div className="cr-text-block cr-text-block--success">
                            <h3>도움 되는 행동</h3>
                            {cellLivingTips(activeDetail.cell).map((tip, index) => (
                              <p key={`living-tip-${activeDetail.key}-${index}`}>{tip}</p>
                            ))}
                          </div>
                        ) : null}
                        {cellCautions(activeDetail.cell).length ? (
                          <div className="cr-text-block cr-text-block--warn">
                            <h3>주의할 점</h3>
                            {cellCautions(activeDetail.cell).map((caution, index) => (
                              <p key={`caution-${activeDetail.key}-${index}`}>{caution}</p>
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
                                <span key={`${activeDetail.key}-${tag.id}`}>{tag.label}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              )}
            </ReportSection>

            <section className="cr-related-reports" aria-label="다른 보고서 보기">
              <button type="button" onClick={onOpenNamingReport}>
                <strong>이름 평가 보고서</strong>
                <span>성명학 중심 상세 결과를 확인합니다.</span>
              </button>
              <button type="button" onClick={onOpenSajuReport}>
                <strong>사주 평가 보고서</strong>
                <span>사주 중심 상세 결과를 확인합니다.</span>
              </button>
            </section>
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



