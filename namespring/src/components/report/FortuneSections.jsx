import React from 'react';
import { StarRating } from '../../report-modules-ui';
import {
  asArray,
  categoryDetailKey,
  categoryDetailPanelId,
  cellCautions,
  cellDetailParagraphs,
  cellLivingTips,
  cellSummary,
  normalizeText,
  toStars,
} from '../../report/fortune/fortune-periods';

// Fortune sections shared outside the legacy combined report. The judgement
// helpers live in report/fortune/fortune-periods.js; these components reuse
// the tokenized .cr-* styles from report-ui.css so light/dark and print
// behavior match the legacy renderer exactly.

export function LifeFlowChart({ points, onSelect }) {
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
        {coords.filter((point) => point.isCurrent).map((point) => (
          <g key={`current-${point.pointId || point.key}`} aria-hidden="true">
            <circle
              cx={point.x}
              cy={point.y}
              r={4}
              fill="var(--color-accent)"
              stroke="var(--color-paper)"
              strokeWidth="1.5"
            />
            <text
              x={point.x}
              y={point.y - 12}
              textAnchor="middle"
              fill="var(--color-accent)"
              fontSize="11"
              fontWeight="800"
            >
              현재
            </text>
          </g>
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
              className="cr-category-card__action"
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

export function LifeFlowFortuneBody({ fortune }) {
  const {
    selectedLifePeriod,
    selectedLifeCategoryItems,
    lifeFlowPoints,
    lifeCurveWeights,
    activeDetail,
    expertTagState,
    selectLifePeriod,
    toggleCategoryDetail,
  } = fortune;
  const overall = selectedLifePeriod?.period?.overall || null;
  const stars = overall?.stars || selectedLifePeriod?.lifeStage?.stars || null;
  const summary = cellSummary(overall, '') || selectedLifePeriod?.lifeStage?.summary || '';
  // 60갑자 리드 — 같은 버킷×등급으로 본문이 겹치는 인접 대운을 그 간지 고유의 글로 열어 준다.
  const daeunLead = normalizeText(selectedLifePeriod?.period?.daeunLead);

  return (
    <div className="space-y-4">
      <div className="cr-life-flow">
        <div>
          <h3>나이대별 운의 흐름</h3>
          <p>그래프의 포인트를 선택하면 해당 나이대 흐름으로 전환됩니다.</p>
        </div>
        <LifeFlowChart points={lifeFlowPoints} onSelect={selectLifePeriod} />
        {lifeCurveWeights ? (
          <p className="text-xs font-semibold leading-relaxed text-[var(--ns-muted)] break-keep">
            곡선 높이는 대운(10년 추세) {Math.round((Number(lifeCurveWeights.daeun) || 0) * 100)}%에
            그 해의 세운(잔물결) {Math.round((Number(lifeCurveWeights.seun) || 0) * 100)}%를 섞은
            시각화 값이에요. 나이대의 별점은 대운 등급 기준이라 곡선 높이와 정확히
            일치하지 않을 수 있어요.
          </p>
        ) : null}
      </div>

      {selectedLifePeriod ? (
        <div className="cr-period-summary">
          <div>
            <p className="cr-eyebrow">선택 나이대</p>
            <h3>{selectedLifePeriod.periodLabel || selectedLifePeriod.label}</h3>
            {daeunLead ? <p className="cr-daeun-lead">{daeunLead}</p> : null}
            {summary ? <p>{summary}</p> : null}
          </div>
          {stars ? <StarRating score={toStars(stars)} /> : null}
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
  );
}

export function PeriodFortuneBody({ fortune }) {
  const {
    primaryPeriodOptions,
    selectedPeriod,
    selectedCategoryItems,
    activeDetail,
    expertTagState,
    selectPeriod,
    toggleCategoryDetail,
  } = fortune;
  const overall = selectedPeriod?.period?.overall || null;
  const stars = overall?.stars || selectedPeriod?.lifeStage?.stars || null;
  const summary = cellSummary(overall, '') || '';

  return (
    <div className="space-y-4">
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

      {selectedPeriod ? (
        <div className="cr-period-summary">
          <div>
            <p className="cr-eyebrow">선택 기간</p>
            <h3>{selectedPeriod.periodLabel || selectedPeriod.label}</h3>
            {summary ? <p>{summary}</p> : null}
          </div>
          {stars ? <StarRating score={toStars(stars)} /> : null}
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
  );
}
