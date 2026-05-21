import React, { useEffect, useMemo, useState } from 'react';
import ReportShell from './components/report/ReportShell';
import {
  DocumentIcon,
  EditIcon,
  InfoList,
  LeafMark,
  PillarTable,
  ReportCard,
  ScoreRing,
  SearchIcon,
  StatusPanel,
  cx,
} from './components/report/ReportPrimitives';
import { buildRenderMetricsFromSajuReport } from './naming-result-render-metrics';

const PILLAR_COLUMNS = ['시주', '일주', '월주', '년주'];
const PILLAR_KEYS = ['hour', 'day', 'month', 'year'];
const ELEMENT_LABELS = {
  WOOD: '목',
  FIRE: '화',
  EARTH: '토',
  METAL: '금',
  WATER: '수',
  Wood: '목',
  Fire: '화',
  Earth: '토',
  Metal: '금',
  Water: '수',
};
const STEM_ELEMENT_BY_CODE = {
  GAP: 'WOOD',
  EUL: 'WOOD',
  BYEONG: 'FIRE',
  JEONG: 'FIRE',
  MU: 'EARTH',
  GI: 'EARTH',
  GYEONG: 'METAL',
  SIN: 'METAL',
  IM: 'WATER',
  GYE: 'WATER',
};
const BRANCH_ELEMENT_BY_CODE = {
  JA: 'WATER',
  CHUK: 'EARTH',
  IN: 'WOOD',
  MYO: 'WOOD',
  JIN: 'EARTH',
  SA: 'FIRE',
  O: 'FIRE',
  MI: 'EARTH',
  SIN: 'METAL',
  YU: 'METAL',
  SUL: 'EARTH',
  HAE: 'WATER',
};

function CoffeeIcon({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4.4 7.1h8.3v4.6A4.1 4.1 0 0 1 8.6 15.8 4.1 4.1 0 0 1 4.4 11.7V7.1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12.7 8.5h1.1a1.7 1.7 0 0 1 0 3.4h-1.1M5.1 17h8.1M6.2 3.2c-.8.7-.8 1.4 0 2.1M9 3.2c-.8.7-.8 1.4 0 2.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <rect x="4.4" y="8.5" width="11.2" height="7.7" rx="1.7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.1 8.5V6.8A2.9 2.9 0 0 1 10 3.8a2.9 2.9 0 0 1 2.9 3v1.7M10 11.5v1.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function normalizeElement(value) {
  const raw = String(value ?? '').trim();
  const upper = raw.toUpperCase();
  if (raw === '목' || upper === 'WOOD') return 'WOOD';
  if (raw === '화' || upper === 'FIRE') return 'FIRE';
  if (raw === '토' || upper === 'EARTH') return 'EARTH';
  if (raw === '금' || upper === 'METAL') return 'METAL';
  if (raw === '수' || upper === 'WATER') return 'WATER';
  return upper;
}

function elementLabel(value) {
  const key = normalizeElement(value);
  return ELEMENT_LABELS[key] || value || '-';
}

function resolvePillarElement(part, type) {
  const direct = normalizeElement(
    part?.element
    ?? part?.fiveElement
    ?? part?.ohaeng
    ?? part?.resource_element
    ?? '',
  );
  if (direct) return direct;
  const code = String(part?.code ?? '').trim().toUpperCase();
  return type === 'stem'
    ? STEM_ELEMENT_BY_CODE[code] || ''
    : BRANCH_ELEMENT_BY_CODE[code] || '';
}

function getPillarPart(part, type) {
  if (!part) return { large: '-', small: '-' };
  const main = part.hanja || part.hangul || part.code || '-';
  const detail = [
    part.hangul && part.hanja ? part.hangul : '',
    elementLabel(resolvePillarElement(part, type)),
  ].filter(Boolean).join(' · ');
  return { large: main, small: detail || '-' };
}

function getTenGod(part) {
  return part?.tenGod?.name
    || part?.tenGod?.hangul
    || part?.tenGod
    || part?.tenGodName
    || '-';
}

function buildPillarRows(report) {
  const pillars = PILLAR_KEYS.map((key) => report?.pillars?.[key] || {});
  return [
    pillars.map((pillar) => getTenGod(pillar?.stem)),
    pillars.map((pillar) => getPillarPart(pillar?.stem, 'stem')),
    pillars.map((pillar) => getPillarPart(pillar?.branch, 'branch')),
  ];
}

function formatBirthDate(birthDateTime) {
  const year = Number(birthDateTime?.year);
  const month = Number(birthDateTime?.month);
  const day = Number(birthDateTime?.day);
  if (!year || !month || !day) return '-';
  return `${String(year).padStart(4, '0')}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
}

function formatBirthTime(birthDateTime, isBirthTimeUnknown) {
  if (isBirthTimeUnknown) return '시각 미상';
  const hour = Number(birthDateTime?.hour);
  const minute = Number(birthDateTime?.minute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '-';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getBirthPlace(entryUserInfo) {
  return String(
    entryUserInfo?.birthPlace
    || entryUserInfo?.birthLocation
    || entryUserInfo?.birthLongitudeOption
    || '서울',
  ).trim();
}

function getBalanceScore(metrics) {
  const values = Object.values(metrics?.elementCounts || {})
    .map((value) => Number(value) || 0)
    .filter((value) => value >= 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const spreadPenalty = Math.min(36, (max - min) * 9);
  const missingPenalty = values.filter((value) => value === 0).length * 8;
  return Math.max(40, Math.min(96, Math.round(92 - spreadPenalty - missingPenalty)));
}

function HomeTile({ item, onClick }) {
  const isClickable = typeof onClick === 'function';
  const Component = isClickable ? 'button' : 'div';

  return (
    <Component
      type={isClickable ? 'button' : undefined}
      onClick={onClick}
      className={cx(
        'ns-card ns-card--large group grid min-h-[14rem] text-left transition-transform duration-200',
        item.toneClass,
        isClickable ? 'hover:-translate-y-0.5' : '',
      )}
      aria-label={isClickable ? item.title : undefined}
    >
      <div className="flex h-full flex-col justify-between gap-5">
        <div className="flex items-start justify-between gap-4">
          <span className="ns-chip">{item.number}</span>
          <span className="grid h-14 w-14 place-items-center rounded-[var(--radius-pill)] border border-current bg-[color-mix(in_oklch,currentColor_8%,transparent)] text-current">
            {item.icon}
          </span>
        </div>
        <div className="space-y-2">
          <p className="ns-kicker text-xs">{item.subtitle}</p>
          <h2 className="font-[var(--font-display)] text-[1.35rem] font-bold leading-tight text-[var(--color-ink)] break-keep">
            {item.title}
          </h2>
          <p className="text-sm font-semibold leading-relaxed text-[var(--color-ink-2)] break-keep">
            {item.description}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--color-accent)]">
          {isClickable ? '열기' : '준비 중'}
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </Component>
  );
}

function SajuPreviewCard({ entryUserInfo, report, metrics, isLoading, error }) {
  const infoItems = useMemo(() => ([
    { label: '생년월일', value: formatBirthDate(entryUserInfo?.birthDateTime) },
    { label: '출생 시간', value: formatBirthTime(entryUserInfo?.birthDateTime, entryUserInfo?.isBirthTimeUnknown) },
    { label: '출생 지역', value: getBirthPlace(entryUserInfo) },
    { label: '성별', value: entryUserInfo?.gender === 'female' ? '여성' : '남성' },
    { label: '음양 기준', value: entryUserInfo?.isSolarCalendar === false ? '음력' : '양력' },
  ]), [entryUserInfo]);

  if (isLoading) {
    return (
      <StatusPanel tone="neutral" title="사주 요약을 준비하고 있습니다." icon={<LeafMark className="h-8 w-8" />}>
        입력한 생년월일을 바탕으로 사주 원국과 오행 흐름을 불러오는 중입니다.
      </StatusPanel>
    );
  }

  if (error) {
    return (
      <StatusPanel tone="earth" title="사주 요약을 불러오지 못했습니다." icon={<SearchIcon className="h-7 w-7" />}>
        {error}
      </StatusPanel>
    );
  }

  if (!report || !metrics) {
    return (
      <StatusPanel tone="neutral" title="입력 정보를 확인해 주세요." icon={<EditIcon className="h-7 w-7" />}>
        이름과 생년월일을 입력하면 이 화면에서 사주 요약을 먼저 확인할 수 있습니다.
      </StatusPanel>
    );
  }

  const balanceScore = getBalanceScore(metrics);
  const fullName = `${entryUserInfo?.lastNameText || ''}${entryUserInfo?.firstNameText || ''}`.trim() || '이름';

  return (
    <ReportCard
      title={`${fullName} 사주 요약`}
      subtitle="입력한 생년월일을 기준으로 원국의 큰 흐름을 먼저 정리했습니다."
      className="ns-card--soft"
      bodyClassName="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.5fr)]"
    >
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--color-rule)] bg-[var(--color-paper)] p-4">
          <ScoreRing value={balanceScore} label="균형 지표" />
          <div className="min-w-0 text-right">
            <p className="ns-kicker">오늘의 기준</p>
            <p className="mt-2 font-[var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">사주 원국</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--color-ink-2)] break-keep">
              오행의 분포와 음양 흐름을 바탕으로 이름 평가의 기준점을 잡습니다.
            </p>
          </div>
        </div>
        <InfoList items={infoItems} />
      </div>
      <div className="grid gap-3">
        <PillarTable columns={PILLAR_COLUMNS} rows={buildPillarRows(report)} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="ns-card ns-card--padded">
            <p className="ns-kicker text-xs">일간</p>
            <p className="mt-1 text-lg font-extrabold text-[var(--color-ink)]">{report?.dayMaster?.stem || '-'}</p>
          </div>
          <div className="ns-card ns-card--padded">
            <p className="ns-kicker text-xs">오행</p>
            <p className="mt-1 text-lg font-extrabold text-[var(--color-ink)]">{elementLabel(report?.dayMaster?.element)}</p>
          </div>
          <div className="ns-card ns-card--padded">
            <p className="ns-kicker text-xs">음양</p>
            <p className="mt-1 text-lg font-extrabold text-[var(--color-ink)]">{report?.dayMaster?.polarity || '-'}</p>
          </div>
        </div>
      </div>
    </ReportCard>
  );
}

function HomePage({ entryUserInfo, onLoadSajuReport, onOpenCombinedReport, onOpenNamingCandidates, onOpenSupport, onOpenEntry }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewReport, setPreviewReport] = useState(null);
  const [previewMetrics, setPreviewMetrics] = useState(null);
  const [analyzeError, setAnalyzeError] = useState('');

  const menuItems = useMemo(() => ([
    {
      number: '01',
      title: '통합 평가 보고서',
      subtitle: '사주 + 성명학 종합',
      description: '이름 평가와 사주 평가를 함께 묶어 핵심 판단을 한 번에 확인합니다.',
      icon: <DocumentIcon className="h-8 w-8" />,
      toneClass: 'ns-tone-wood',
      onClick: onOpenCombinedReport,
    },
    {
      number: '02',
      title: '작명하기',
      subtitle: '맞춤 이름 추천',
      description: '사주에 부족한 성분을 보완하는 이름 후보를 차분하게 비교합니다.',
      icon: <EditIcon className="h-8 w-8" />,
      toneClass: 'ns-tone-indigo',
      onClick: onOpenNamingCandidates,
    },
    {
      number: '03',
      title: '개발자에게 커피 한 잔',
      subtitle: '응원 결제',
      description: '단건 900원 결제로 이름봄의 지속적인 개선을 응원합니다.',
      icon: <CoffeeIcon />,
      toneClass: 'ns-tone-earth',
      onClick: onOpenSupport,
    },
    {
      number: '04',
      title: '이름봄 정보',
      subtitle: '브랜드 가이드',
      description: '이름봄이 지키는 분석 원칙과 이름을 바라보는 관점을 안내합니다.',
      icon: <LockIcon />,
      toneClass: 'ns-tone-neutral',
      onClick: null,
    },
  ]), [onOpenCombinedReport, onOpenNamingCandidates, onOpenSupport]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!entryUserInfo || !onLoadSajuReport) {
        setPreviewReport(null);
        setPreviewMetrics(null);
        return;
      }

      setIsAnalyzing(true);
      setAnalyzeError('');
      try {
        const sajuReport = await onLoadSajuReport(entryUserInfo);
        if (cancelled) return;
        setPreviewReport(sajuReport || null);
        setPreviewMetrics(buildRenderMetricsFromSajuReport(sajuReport, {
          entryUserInfo,
        }));
      } catch {
        if (cancelled) return;
        setPreviewReport(null);
        setPreviewMetrics(null);
        setAnalyzeError('잠시 후 다시 시도하거나 입력 정보를 확인해 주세요.');
      } finally {
        if (!cancelled) {
          setIsAnalyzing(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [entryUserInfo, onLoadSajuReport]);

  return (
    <ReportShell
      activeNav="preview"
      onEdit={typeof onOpenEntry === 'function' ? () => onOpenEntry(entryUserInfo) : null}
      size="wide"
      contentClassName="ns-home-main"
    >
      <div className="space-y-6">
        <SajuPreviewCard
          entryUserInfo={entryUserInfo}
          report={previewReport}
          metrics={previewMetrics}
          isLoading={isAnalyzing}
          error={analyzeError}
        />

        <div className="grid gap-4 md:grid-cols-2">
          {menuItems.map((item) => (
            <HomeTile
              key={item.number}
              item={item}
              onClick={item.onClick}
            />
          ))}
        </div>
      </div>
    </ReportShell>
  );
}

export default HomePage;
