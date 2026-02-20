import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NamingResultRenderer from './NamingResultRenderer';
import { buildRenderMetricsFromSajuReport } from './naming-result-render-metrics';
import FiveElementRadarChart from './FiveElementRadarChart';
import {
  ReportActionButtons,
  ReportPrintOverlay,
  ReportScrollTopFab,
  ReportShareDialog,
  useReportActions,
} from './report-common-ui';

const ELEMENT_LABEL = {
  Wood: '목',
  Fire: '화',
  Earth: '토',
  Metal: '금',
  Water: '수',
};

const ELEMENT_KEYS = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];

const PARAGRAPH_TYPE_LABEL = {
  narrative: '해설',
  tip: '실천 팁',
  warning: '주의',
  quote: '핵심',
  emphasis: '강조',
};

const CHART_TYPE_LABEL = {
  radar: '레이더',
  bar: '막대',
  gauge: '게이지',
  timeline: '타임라인',
  donut: '도넛',
  line: '라인',
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeElement(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'wood' || raw === '목') return 'Wood';
  if (raw === 'fire' || raw === '화') return 'Fire';
  if (raw === 'earth' || raw === '토') return 'Earth';
  if (raw === 'metal' || raw === '금') return 'Metal';
  if (raw === 'water' || raw === '수') return 'Water';
  return '';
}

function normalizeReportElement(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (raw === 'WOOD') return 'Wood';
  if (raw === 'FIRE') return 'Fire';
  if (raw === 'EARTH') return 'Earth';
  if (raw === 'METAL') return 'Metal';
  if (raw === 'WATER') return 'Water';
  return normalizeElement(raw);
}

function elementBadgeClass(element) {
  if (element === 'Wood') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (element === 'Fire') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (element === 'Earth') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (element === 'Metal') return 'border-slate-200 bg-slate-100 text-slate-700';
  if (element === 'Water') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)]';
}

function formatScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return '0.0';
  return score.toFixed(1);
}

function scoreGuideText(score) {
  if (score >= 85) return '이름과 사주의 조화가 매우 안정적으로 잡혀 있어요.';
  if (score >= 70) return '전체 균형이 좋아서 실제 사용성이 높은 이름이에요.';
  if (score >= 55) return '무난하지만 부족 오행을 보완하는 전략이 필요해요.';
  return '보완 포인트가 뚜렷해 생활 전략을 함께 가져가야 해요.';
}

function formatDateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toText(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function CollapseCard({ title, subtitle, open, onToggle, children }) {
  return (
    <section className="bg-[var(--ns-surface)] rounded-[2rem] border border-[var(--ns-border)] shadow-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-lg font-black text-[var(--ns-accent-text)]">{title}</h3>
          {subtitle ? <p className="text-sm text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">{subtitle}</p> : null}
        </div>
        <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--ns-border)] bg-[var(--ns-surface-soft)]">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className={`w-4 h-4 text-[var(--ns-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </section>
  );
}

function MetaInfoCard({ title, value, tone = 'default' }) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : tone === 'blue'
          ? 'border-blue-200 bg-blue-50 text-blue-800'
          : 'border-[var(--ns-border)] bg-[var(--ns-surface)] text-[var(--ns-muted)]';

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${toneClass}`}>
      <p className="text-[11px] font-black mb-1">{title}</p>
      <p className="text-sm leading-relaxed break-keep whitespace-normal">{value || '-'}</p>
    </div>
  );
}
function ParagraphList({ paragraphs, emptyText }) {
  const items = safeArray(paragraphs)
    .map((paragraph) => {
      if (!paragraph || typeof paragraph !== 'object') return null;
      const text = toText(paragraph.text, '');
      if (!text) return null;
      return {
        ...paragraph,
        text,
      };
    })
    .filter(Boolean);

  if (!items.length) {
    return <p className="text-sm text-[var(--ns-muted)]">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((paragraph, index) => {
        const type = String(paragraph.type ?? 'narrative');
        const element = normalizeReportElement(paragraph.element);
        const cardTone = type === 'tip'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : type === 'warning'
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : type === 'quote'
              ? 'border-blue-200 bg-blue-50 text-blue-900'
              : type === 'emphasis'
                ? 'border-violet-200 bg-violet-50 text-violet-900'
                : 'border-[var(--ns-border)] bg-[var(--ns-surface)] text-[var(--ns-text)]';

        return (
          <article key={`paragraph-${index}-${type}`} className={`rounded-xl border px-3 py-2.5 ${cardTone}`}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/70 border border-current/20">
                {PARAGRAPH_TYPE_LABEL[type] || '해설'}
              </span>
              {element ? (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${elementBadgeClass(element)}`}>
                  {ELEMENT_LABEL[element]}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed break-keep whitespace-normal">{paragraph.text}</p>
          </article>
        );
      })}
    </div>
  );
}

function HighlightList({ highlights }) {
  const items = safeArray(highlights).filter((highlight) => highlight && typeof highlight === 'object');
  if (!items.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {items.map((highlight, index) => {
        const element = normalizeReportElement(highlight.element);
        const tone = highlight.sentiment === 'good'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : highlight.sentiment === 'caution'
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-[var(--ns-border)] bg-[var(--ns-surface)] text-[var(--ns-text)]';

        return (
          <div key={`highlight-${index}`} className={`rounded-xl border px-3 py-2.5 ${tone}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black">{toText(highlight.label)}</p>
              {element ? (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${elementBadgeClass(element)}`}>
                  {ELEMENT_LABEL[element]}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm font-semibold leading-relaxed break-keep whitespace-normal">{toText(highlight.value)}</p>
          </div>
        );
      })}
    </div>
  );
}

function TableBlock({ table, index }) {
  if (!table || typeof table !== 'object') return null;

  const headers = safeArray(table.headers).map((header) => toText(header, '항목'));
  const rows = safeArray(table.rows).map((row) => (Array.isArray(row) ? row.map((cell) => toText(cell)) : []));
  if (!headers.length && !rows.length) return null;

  const maxColumns = Math.max(headers.length, ...rows.map((row) => row.length), 1);
  const normalizedHeaders = headers.length
    ? headers.concat(Array.from({ length: Math.max(0, maxColumns - headers.length) }, (_, i) => `컬럼 ${headers.length + i + 1}`))
    : Array.from({ length: maxColumns }, (_, i) => `컬럼 ${i + 1}`);

  return (
    <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-2.5 overflow-x-auto">
      {table.title ? <p className="text-sm font-black text-[var(--ns-accent-text)] mb-2 break-keep whitespace-normal">{table.title}</p> : null}
      <table className="w-full min-w-[520px] border-collapse text-xs">
        <thead>
          <tr>
            {normalizedHeaders.map((header, headerIndex) => (
              <th key={`table-${index}-header-${headerIndex}`} className="text-left py-1.5 px-2 border-b border-[var(--ns-border)] text-[var(--ns-muted)] font-black">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const normalizedRow = row.concat(Array.from({ length: Math.max(0, maxColumns - row.length) }, () => '-'));
            return (
              <tr key={`table-${index}-row-${rowIndex}`}>
                {normalizedRow.map((cell, cellIndex) => (
                  <td key={`table-${index}-${rowIndex}-${cellIndex}`} className="py-1.5 px-2 border-b border-[var(--ns-border)]/50 text-[var(--ns-text)]">
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function ChartBlock({ chart, index }) {
  if (!chart || typeof chart !== 'object') return null;

  const entries = Object.entries(chart.data || {});
  if (!entries.length) return null;

  const numericEntries = entries
    .map(([label, rawValue]) => ({ label: toText(label, '항목'), value: Number(rawValue) }))
    .filter((item) => Number.isFinite(item.value));
  const textEntries = entries
    .filter(([, rawValue]) => !Number.isFinite(Number(rawValue)))
    .map(([label, rawValue]) => ({ label: toText(label, '항목'), value: toText(rawValue) }));

  const maxValue = numericEntries.length ? Math.max(...numericEntries.map((item) => Math.abs(item.value)), 1) : 1;

  return (
    <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">{toText(chart.title, `차트 ${index + 1}`)}</p>
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full border border-[var(--ns-border)] text-[var(--ns-muted)] bg-[var(--ns-surface-soft)]">
          {CHART_TYPE_LABEL[String(chart.type ?? '').toLowerCase()] || toText(chart.type, '차트')}
        </span>
      </div>

      {numericEntries.length ? (
        <div className="mt-2 space-y-2">
          {numericEntries.map((item, itemIndex) => {
            const widthPercent = clampPercent((Math.abs(item.value) / maxValue) * 100);
            return (
              <div key={`chart-${index}-${itemIndex}`} className="rounded-lg border border-[var(--ns-border)]/60 bg-[var(--ns-surface-soft)] px-2 py-1.5">
                <div className="flex items-center justify-between text-xs font-black text-[var(--ns-muted)]">
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-white/70 overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--ns-primary)]" style={{ width: `${widthPercent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {textEntries.length ? (
        <div className="mt-2 space-y-1.5">
          {textEntries.map((item, itemIndex) => (
            <div key={`chart-text-${index}-${itemIndex}`} className="rounded-lg border border-[var(--ns-border)]/60 bg-[var(--ns-surface-soft)] px-2 py-1.5">
              <p className="text-[11px] font-black text-[var(--ns-muted)]">{item.label}</p>
              <p className="text-xs text-[var(--ns-text)] mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SectionBody({ section }) {
  if (!section || typeof section !== 'object') return null;

  return (
    <div className="space-y-3">
      <ParagraphList paragraphs={section.paragraphs} emptyText="본문 설명이 아직 준비되지 않았습니다." />
      <HighlightList highlights={section.highlights} />

      {safeArray(section.tables).map((table, tableIndex) => (
        <TableBlock key={`section-${String(section.id)}-table-${tableIndex}`} table={table} index={tableIndex} />
      ))}

      {safeArray(section.charts).map((chart, chartIndex) => (
        <ChartBlock key={`section-${String(section.id)}-chart-${chartIndex}`} chart={chart} index={chartIndex} />
      ))}

      {safeArray(section.subsections).map((subsection, subsectionIndex) => (
        <div key={`section-${String(section.id)}-sub-${subsectionIndex}`} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-2.5 space-y-2">
          <h4 className="text-sm font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">
            {toText(subsection?.title, `세부 항목 ${subsectionIndex + 1}`)}
          </h4>
          <ParagraphList paragraphs={subsection?.paragraphs} emptyText="세부 설명이 아직 준비되지 않았습니다." />
          <HighlightList highlights={subsection?.highlights} />
          {safeArray(subsection?.tables).map((table, tableIndex) => (
            <TableBlock key={`sub-${subsectionIndex}-table-${tableIndex}`} table={table} index={tableIndex} />
          ))}
          {safeArray(subsection?.charts).map((chart, chartIndex) => (
            <ChartBlock key={`sub-${subsectionIndex}-chart-${chartIndex}`} chart={chart} index={chartIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CombiedNamingReport({
  springReport,
  integratedReport,
  onOpenNamingReport,
  onOpenSajuReport,
  shareUserInfo = null,
}) {
  if (!springReport) return null;

  const reportRootRef = useRef(null);
  const [openCards, setOpenCards] = useState({
    saju: true,
    compatibility: true,
    scores: false,
    interpretation: false,
    integratedOverview: true,
    integratedConclusion: true,
  });
  const [openIntegratedSections, setOpenIntegratedSections] = useState({});

  const namingReport = springReport.namingReport || {};
  const sajuReport = springReport.sajuReport || {};
  const sajuCompatibility = springReport.sajuCompatibility || {};

  const integratedMeta = integratedReport?.meta || null;
  const integratedIntroduction = useMemo(() => safeArray(integratedReport?.introduction), [integratedReport]);
  const integratedSections = useMemo(() => safeArray(integratedReport?.sections), [integratedReport]);
  const integratedConclusion = useMemo(() => safeArray(integratedReport?.conclusion), [integratedReport]);
  const integratedSectionKeys = useMemo(
    () => integratedSections.map((section, index) => `${String(section?.id ?? 'section')}-${index}`),
    [integratedSections],
  );

  useEffect(() => {
    if (!integratedSectionKeys.length) {
      setOpenIntegratedSections({});
      return;
    }

    setOpenIntegratedSections((prev) => {
      const next = {};
      integratedSectionKeys.forEach((key, index) => {
        next[key] = Object.prototype.hasOwnProperty.call(prev, key) ? prev[key] : index < 4;
      });

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const sameLength = prevKeys.length === nextKeys.length;
      const sameState = sameLength && nextKeys.every((key) => prev[key] === next[key]);
      return sameState ? prev : next;
    });
  }, [integratedSectionKeys]);

  const fullHangul = namingReport?.name?.fullHangul || '-';
  const fullHanja = namingReport?.name?.fullHanja || '-';
  const finalScore = Number(springReport.finalScore || 0);

  const normalizedNameElements = useMemo(
    () => safeArray(sajuCompatibility?.nameElements)
      .map((element) => normalizeElement(element))
      .filter(Boolean),
    [sajuCompatibility],
  );

  const yongshinElement = normalizeElement(sajuCompatibility?.yongshinElement || sajuReport?.yongshin?.element);
  const heeshinElement = normalizeElement(sajuCompatibility?.heeshinElement || sajuReport?.yongshin?.heeshin);
  const gishinElement = normalizeElement(sajuCompatibility?.gishinElement || sajuReport?.yongshin?.gishin);

  const dayMasterStem = sajuReport?.dayMaster?.stem || '-';
  const dayMasterElement = normalizeElement(sajuReport?.dayMaster?.element);
  const strengthLevel = sajuReport?.strength?.level || '-';
  const confidence = Number(sajuReport?.yongshin?.confidence ?? 0);
  const recommendationTexts = safeArray(sajuReport?.yongshin?.recommendations)
    .map((item) => item?.reasoning)
    .filter(Boolean);

  const combinedDistributionRows = useMemo(() => {
    const source = springReport?.combinedDistribution || {};
    return ELEMENT_KEYS.map((key) => ({
      key,
      label: ELEMENT_LABEL[key],
      value: Number(source[key] ?? 0),
    }));
  }, [springReport]);

  const combinedDistributionMax = useMemo(() => {
    const values = combinedDistributionRows
      .map((item) => item.value)
      .filter((value) => Number.isFinite(value));
    const max = values.length ? Math.max(...values) : 0;
    return max > 0 ? max : 1;
  }, [combinedDistributionRows]);

  const nameCardRenderMetrics = useMemo(
    () => buildRenderMetricsFromSajuReport(sajuReport, {
      displayHangul: fullHangul === '-' ? '' : fullHangul,
      displayHanja: fullHanja === '-' ? '' : fullHanja,
      score: finalScore,
    }),
    [sajuReport, fullHangul, fullHanja, finalScore],
  );
  const toggleCard = (key) => setOpenCards((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleIntegratedSection = (sectionKey) => {
    setOpenIntegratedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const prepareBeforePrint = useCallback(() => {
    const previousOpenCards = { ...openCards };
    const previousOpenIntegratedSections = { ...openIntegratedSections };

    setOpenCards({
      saju: true,
      compatibility: true,
      scores: true,
      interpretation: true,
      integratedOverview: true,
      integratedConclusion: true,
    });

    setOpenIntegratedSections((prev) => {
      const next = { ...prev };
      integratedSectionKeys.forEach((key) => {
        next[key] = true;
      });
      return next;
    });

    return {
      previousOpenCards,
      previousOpenIntegratedSections,
    };
  }, [openCards, openIntegratedSections, integratedSectionKeys]);

  const restoreAfterPrint = useCallback((payload) => {
    if (payload?.previousOpenCards) {
      setOpenCards(payload.previousOpenCards);
    }
    if (payload?.previousOpenIntegratedSections) {
      setOpenIntegratedSections(payload.previousOpenIntegratedSections);
    }
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
      <div ref={reportRootRef} data-pdf-root="true" className="space-y-4">
        <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 md:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">
                {fullHangul} <span className="text-lg text-[var(--ns-muted)]">({fullHanja})</span>
              </h2>
              <p className="text-sm text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">
                이름과 사주를 함께 반영한 통합 해석 리포트입니다.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-right">
              <p className="text-xs font-black text-emerald-700">통합 점수</p>
              <p className="text-2xl font-black text-emerald-800">{formatScore(finalScore)}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-[var(--ns-muted)] break-keep whitespace-normal">{scoreGuideText(finalScore)}</p>
        </section>

        <section className="h-44 md:h-52">
          <NamingResultRenderer
            renderMetrics={nameCardRenderMetrics}
            birthDateTime={shareUserInfo?.birthDateTime ?? null}
            gender={shareUserInfo?.gender}
            isSolarCalendar={shareUserInfo?.isSolarCalendar}
            isBirthTimeUnknown={shareUserInfo?.isBirthTimeUnknown}
          />
        </section>

        <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 md:p-4">
          <h3 className="text-lg font-black text-[var(--ns-accent-text)]">통합 오행 분포</h3>
          <p className="text-sm text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">
            사주의 오행과 이름 오행을 합산해 현재 균형을 한눈에 보여줍니다.
          </p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 md:items-center">
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2 py-2">
              <FiveElementRadarChart rows={combinedDistributionRows} size={220} maxValue={combinedDistributionMax} />
            </div>
            <div className="space-y-2">
              {combinedDistributionRows.map((item) => {
                const widthPercent = clampPercent((item.value / combinedDistributionMax) * 100);
                return (
                  <div key={`combined-dist-${item.key}`} className={`rounded-xl border px-3 py-2.5 ${elementBadgeClass(item.key)}`}>
                    <div className="flex items-center justify-between text-sm font-black">
                      <span>{item.label}</span>
                      <span>{item.value}</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-white/60 overflow-hidden">
                      <div className="h-full rounded-full bg-current" style={{ width: `${widthPercent}%`, opacity: 0.7 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <CollapseCard title="사주 핵심 요약" subtitle="일간, 용신, 강약을 빠르게 확인할 수 있어요." open={openCards.saju} onToggle={() => toggleCard('saju')}>
          <div className="space-y-2.5">
            <MetaInfoCard title="일간" value={`${dayMasterStem} / ${dayMasterElement ? ELEMENT_LABEL[dayMasterElement] : '-'}`} tone="blue" />
            <MetaInfoCard title="강약" value={String(strengthLevel)} tone="default" />
            <MetaInfoCard title="용신 신뢰도" value={`${Math.round(confidence)}점`} tone="amber" />
            {recommendationTexts.length ? <MetaInfoCard title="용신 해석" value={recommendationTexts.join(' ')} tone="emerald" /> : null}
          </div>
        </CollapseCard>

        <CollapseCard title="이름-사주 궁합" subtitle="이름 오행이 사주 보완에 얼마나 기여하는지 보여줍니다." open={openCards.compatibility} onToggle={() => toggleCard('compatibility')}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {normalizedNameElements.length
                ? normalizedNameElements.map((element, index) => (
                  <span key={`name-element-${element}-${index}`} className={`px-2.5 py-1 rounded-full border text-xs font-black ${elementBadgeClass(element)}`}>
                    이름 오행 {ELEMENT_LABEL[element]}
                  </span>
                ))
                : <span className="text-sm text-[var(--ns-muted)]">이름 오행 정보가 없습니다.</span>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <MetaInfoCard title="용신" value={yongshinElement ? ELEMENT_LABEL[yongshinElement] : '-'} tone="emerald" />
              <MetaInfoCard title="희신" value={heeshinElement ? ELEMENT_LABEL[heeshinElement] : '-'} tone="blue" />
              <MetaInfoCard title="기신" value={gishinElement ? ELEMENT_LABEL[gishinElement] : '-'} tone="amber" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <MetaInfoCard title="용신 매칭 수" value={String(sajuCompatibility?.yongshinMatchCount ?? 0)} tone="emerald" />
              <MetaInfoCard title="기신 매칭 수" value={String(sajuCompatibility?.gishinMatchCount ?? 0)} tone="amber" />
              <MetaInfoCard title="궁합 점수" value={formatScore(sajuCompatibility?.affinityScore ?? 0)} tone="blue" />
            </div>
          </div>
        </CollapseCard>

        <CollapseCard title="점수 요약" subtitle="통합 점수와 세부 점수를 함께 확인하세요." open={openCards.scores} onToggle={() => toggleCard('scores')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">통합 점수: {formatScore(finalScore)}</div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">이름 점수: {formatScore(namingReport?.totalScore)}</div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">한글 점수: {formatScore(namingReport?.scores?.hangul)}</div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">한자 점수: {formatScore(namingReport?.scores?.hanja)}</div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)] md:col-span-2">수리 격국 점수: {formatScore(namingReport?.scores?.fourFrame)}</div>
          </div>
        </CollapseCard>

        <CollapseCard title="이름 해석" subtitle="성명학 관점의 핵심 요약입니다." open={openCards.interpretation} onToggle={() => toggleCard('interpretation')}>
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-3">
            <p className="text-sm text-[var(--ns-muted)] leading-relaxed break-keep whitespace-normal">
              {namingReport?.interpretation || '이름 해석 정보가 없습니다.'}
            </p>
          </div>
        </CollapseCard>

        <CollapseCard title="통합 보고서 안내" subtitle="엔진 메타 정보와 도입 문단입니다." open={openCards.integratedOverview} onToggle={() => toggleCard('integratedOverview')}>
          {integratedReport ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <MetaInfoCard title="리포트 버전" value={toText(integratedMeta?.version)} tone="blue" />
                <MetaInfoCard title="생성 시각" value={formatDateTime(integratedMeta?.generatedAt)} tone="default" />
                <MetaInfoCard title="엔진 버전" value={toText(integratedMeta?.engineVersion)} tone="amber" />
              </div>
              <ParagraphList paragraphs={integratedIntroduction} emptyText="도입 문단이 아직 준비되지 않았습니다." />
            </div>
          ) : (
            <p className="text-sm text-[var(--ns-muted)]">통합 보고서 본문을 아직 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.</p>
          )}
        </CollapseCard>

        <section className="space-y-2">
          {integratedSections.length
            ? integratedSections.map((section, index) => {
              const sectionKey = integratedSectionKeys[index];
              const title = toText(section?.title, `통합 섹션 ${index + 1}`);
              const sectionId = toText(section?.id, `section-${index + 1}`);
              const subtitle = toText(section?.subtitle, `섹션 코드: ${sectionId}`);
              return (
                <CollapseCard key={`integrated-section-${sectionKey}`} title={title} subtitle={subtitle} open={Boolean(openIntegratedSections[sectionKey])} onToggle={() => toggleIntegratedSection(sectionKey)}>
                  <SectionBody section={section} />
                </CollapseCard>
              );
            })
            : (
              <section className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-3">
                <p className="text-sm font-black text-[var(--ns-accent-text)]">통합 본문 섹션</p>
                <p className="mt-1 text-sm text-[var(--ns-muted)]">표시할 섹션 데이터가 없습니다.</p>
              </section>
            )}
        </section>
        <CollapseCard title="마무리 정리" subtitle="보고서 결론과 실행 포인트를 확인하세요." open={openCards.integratedConclusion} onToggle={() => toggleCard('integratedConclusion')}>
          <ParagraphList paragraphs={integratedConclusion} emptyText="결론 문단이 아직 준비되지 않았습니다." />
        </CollapseCard>

        <section className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-3">
          <p className="text-sm font-black text-[var(--ns-accent-text)]">다른 보고서 보기</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenNamingReport}
              className="w-full rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-3 text-left hover:bg-[var(--ns-surface-soft)] transition-colors"
            >
              <span className="inline-flex items-center gap-1.5 text-sm font-black text-[var(--ns-accent-text)]">
                <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4" aria-hidden="true">
                  <path d="M6 3H14C15.1 3 16 3.9 16 5V15C16 16.1 15.1 17 14 17H6C4.9 17 4 16.1 4 15V5C4 3.9 4.9 3 6 3Z" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M7 7H13M7 10H13M7 13H11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                이름 단독 보고서
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed font-semibold text-[var(--ns-muted)] break-keep whitespace-normal">
                성명학 중심의 상세 분석 리포트를 확인할 수 있어요.
              </span>
            </button>
            <button
              type="button"
              onClick={onOpenSajuReport}
              className="w-full rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-3 text-left hover:bg-[var(--ns-surface-soft)] transition-colors"
            >
              <span className="inline-flex items-center gap-1.5 text-sm font-black text-[var(--ns-accent-text)]">
                <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4" aria-hidden="true">
                  <path d="M10 5V10L13.2 12.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                사주 단독 보고서
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed font-semibold text-[var(--ns-muted)] break-keep whitespace-normal">
                사주명리학 중심의 상세 분석 리포트를 확인할 수 있어요.
              </span>
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
