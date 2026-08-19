import React, { useEffect, useMemo, useState } from 'react';
import ReportShell from './components/report/ReportShell';
import NamingResultRenderer from './NamingResultRenderer';
import {
  MenuCoffeeIcon,
  MenuInfoIcon,
  MenuNamingIcon,
  MenuReportIcon,
} from './components/icons/IreumBomMenuIcons';
import {
  EditIcon,
  InfoList,
  LeafMark,
  PageHeading,
  ReportCard,
  ScoreRing,
  SearchIcon,
  SajuPillarTable,
  StatusPanel,
  cx,
} from './components/report/ReportPrimitives';
import { buildRenderMetricsFromSajuReport } from './naming-result-render-metrics';
import { BezelCard } from './components/ui/BezelCard.jsx';
import { RevealOnScroll } from './components/ui/RevealOnScroll.jsx';

const PILLAR_COLUMNS = ['년주', '월주', '일주', '시주'];
const PILLAR_KEYS = ['year', 'month', 'day', 'hour'];
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

const stemVisualMap = {
  GAP: { label: '갑', hanja: '甲', tone: 'wood', icon: 'sprout', description: '갑목 · 곧게 뻗는 시작' },
  EUL: { label: '을', hanja: '乙', tone: 'wood', icon: 'sprout', description: '을목 · 부드러운 생장' },
  BYEONG: { label: '병', hanja: '丙', tone: 'fire', icon: 'sun', description: '병화 · 밝게 드러나는 빛' },
  JEONG: { label: '정', hanja: '丁', tone: 'fire', icon: 'flame', description: '정화 · 오래 머무는 불씨' },
  MU: { label: '무', hanja: '戊', tone: 'earth', icon: 'mountain', description: '무토 · 너른 대지의 힘' },
  GI: { label: '기', hanja: '己', tone: 'earth', icon: 'soil', description: '기토 · 안정의 흙' },
  GYEONG: { label: '경', hanja: '庚', tone: 'metal', icon: 'blade', description: '경금 · 단단한 결단' },
  SIN: { label: '신', hanja: '辛', tone: 'metal', icon: 'mineral', description: '신금 · 정제된 감각' },
  IM: { label: '임', hanja: '壬', tone: 'water', icon: 'wave', description: '임수 · 큰 물의 흐름' },
  GYE: { label: '계', hanja: '癸', tone: 'water', icon: 'drop', description: '계수 · 고요한 물기' },
};

const stemKeyByHangul = {
  갑: 'GAP',
  을: 'EUL',
  병: 'BYEONG',
  정: 'JEONG',
  무: 'MU',
  기: 'GI',
  경: 'GYEONG',
  신: 'SIN',
  임: 'IM',
  계: 'GYE',
};

const stemKeyByHanja = {
  甲: 'GAP',
  乙: 'EUL',
  丙: 'BYEONG',
  丁: 'JEONG',
  戊: 'MU',
  己: 'GI',
  庚: 'GYEONG',
  辛: 'SIN',
  壬: 'IM',
  癸: 'GYE',
};

const elementVisualMap = {
  WOOD: { label: '목', hanja: '木', tone: 'wood', icon: 'leaf', description: '목의 성장 기운' },
  FIRE: { label: '화', hanja: '火', tone: 'fire', icon: 'sun', description: '화의 밝은 확장' },
  EARTH: { label: '토', hanja: '土', tone: 'earth', icon: 'mountain', description: '토의 중심 기운' },
  METAL: { label: '금', hanja: '金', tone: 'metal', icon: 'mineral', description: '금의 맑은 결' },
  WATER: { label: '수', hanja: '水', tone: 'water', icon: 'wave', description: '수의 흐르는 감각' },
};

const yinYangVisualMap = {
  YANG: { label: '양', hanja: '陽', tone: 'yang', icon: 'yang', description: '양 · 바깥으로 밝히는 흐름' },
  YIN: { label: '음', hanja: '陰', tone: 'yin', icon: 'yin', description: '음 · 안으로 모으는 흐름' },
};

function normalizeElement(value) {
  const raw = String(value ?? '').trim();
  const upper = raw.toUpperCase();
  if (!raw) return '';
  if (raw.includes('목') || raw.includes('木') || upper === 'WOOD') return 'WOOD';
  if (raw.includes('화') || raw.includes('火') || upper === 'FIRE') return 'FIRE';
  if (raw.includes('토') || raw.includes('土') || upper === 'EARTH') return 'EARTH';
  if (raw.includes('금') || raw.includes('金') || upper === 'METAL') return 'METAL';
  if (raw.includes('수') || raw.includes('水') || upper === 'WATER') return 'WATER';
  return upper;
}

function normalizeStemKey(value) {
  const raw = String(value ?? '').trim();
  const upper = raw.toUpperCase();
  if (!raw) return '';
  if (stemVisualMap[upper]) return upper;

  for (const [hangul, key] of Object.entries(stemKeyByHangul)) {
    if (raw.includes(hangul)) return key;
  }

  for (const [hanja, key] of Object.entries(stemKeyByHanja)) {
    if (raw.includes(hanja)) return key;
  }

  return '';
}

function normalizePolarityKey(value) {
  const raw = String(value ?? '').trim();
  const upper = raw.toUpperCase();
  if (!raw) return '';
  if (upper === 'YIN' || raw.includes('음') || raw.includes('陰')) return 'YIN';
  if (upper === 'YANG' || raw.includes('양') || raw.includes('陽')) return 'YANG';
  return '';
}

function getStemVisual(value) {
  const key = normalizeStemKey(value);
  return stemVisualMap[key] || {
    label: value || '-',
    hanja: '',
    tone: 'neutral',
    icon: 'seal',
    description: '일간 기준점',
  };
}

function getElementVisual(value) {
  const key = normalizeElement(value);
  return elementVisualMap[key] || {
    label: value || '-',
    hanja: '',
    tone: 'neutral',
    icon: 'element',
    description: '오행 기준점',
  };
}

function getYinYangVisual(value) {
  const key = normalizePolarityKey(value);
  return yinYangVisualMap[key] || {
    label: value || '-',
    hanja: '',
    tone: 'neutral',
    icon: 'duality',
    description: '음양 흐름',
  };
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
  const elementKey = resolvePillarElement(part, type);
  return {
    symbol: part.hangul || part.hanja || '-',
    hangul: part.hangul || '',
    hanja: part.hanja || '',
    element: elementKey,
    elementKey,
  };
}

function buildPillarColumns(report) {
  const pillars = PILLAR_KEYS.map((key) => report?.pillars?.[key] || {});
  return pillars.map((pillar, index) => ({
    key: PILLAR_KEYS[index],
    label: PILLAR_COLUMNS[index],
    stem: getPillarPart(pillar?.stem, 'stem'),
    branch: getPillarPart(pillar?.branch, 'branch'),
  }));
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

function DaymasterVisualIcon({ icon }) {
  if (icon === 'sprout' || icon === 'leaf') {
    return (
      <svg className={`ns-daymaster-icon ns-daymaster-icon--${icon}`} viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 25V8" />
        <path d="M16 14C11 10 8 11 6 16c5 2 8 1 10-2Z" />
        <path d="M16 17c5-5 8-5 10 0-4 3-7 3-10 0Z" />
      </svg>
    );
  }

  if (icon === 'sun' || icon === 'flame') {
    return (
      <svg className={`ns-daymaster-icon ns-daymaster-icon--${icon}`} viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="5.5" />
        <path d="M16 4v4" />
        <path d="M16 24v4" />
        <path d="M4 16h4" />
        <path d="M24 16h4" />
        <path d="M7.5 7.5l2.8 2.8" />
        <path d="M21.7 21.7l2.8 2.8" />
        <path d="M24.5 7.5l-2.8 2.8" />
        <path d="M10.3 21.7l-2.8 2.8" />
      </svg>
    );
  }

  if (icon === 'soil' || icon === 'mountain') {
    return (
      <svg className={`ns-daymaster-icon ns-daymaster-icon--${icon}`} viewBox="0 0 32 32" aria-hidden="true">
        <path d="M5 23h22" />
        <path d="M8 18h16" />
        <path d="M11 13h10" />
        <path d="M8 23l8-13 8 13" />
      </svg>
    );
  }

  if (icon === 'blade' || icon === 'mineral') {
    return (
      <svg className={`ns-daymaster-icon ns-daymaster-icon--${icon}`} viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 5l9 7-4 14H11L7 12l9-7Z" />
        <path d="M7 12h18" />
        <path d="M16 5l-5 21" />
        <path d="M16 5l5 21" />
      </svg>
    );
  }

  if (icon === 'wave' || icon === 'drop') {
    return (
      <svg className={`ns-daymaster-icon ns-daymaster-icon--${icon}`} viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 5c5 6 8 10 8 14a8 8 0 0 1-16 0c0-4 3-8 8-14Z" />
        <path d="M9 21c3-2 5-2 8 0s5 2 8 0" />
      </svg>
    );
  }

  if (icon === 'yang') {
    return (
      <svg className="ns-daymaster-icon ns-daymaster-icon--yang" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M7 21a9 9 0 0 1 18 0" />
        <path d="M16 5v4" />
        <path d="M7 10l3 3" />
        <path d="M25 10l-3 3" />
        <path d="M4 21h24" />
      </svg>
    );
  }

  if (icon === 'yin') {
    return (
      <svg className="ns-daymaster-icon ns-daymaster-icon--yin" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M22 7a10 10 0 1 0 0 18 8 8 0 1 1 0-18Z" />
        <path d="M8 23c3-2 5-2 8 0s5 2 8 0" />
      </svg>
    );
  }

  return (
    <svg className="ns-daymaster-icon ns-daymaster-icon--seal" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="9" />
      <path d="M11 16h10" />
      <path d="M16 11v10" />
    </svg>
  );
}

function DaymasterSummaryCard({ label, visual, variant }) {
  const displayValue = visual?.label || '-';
  const tone = visual?.tone || 'neutral';

  return (
    <article className={cx('ns-report-panel ns-daymaster-summary', `ns-daymaster-summary--${variant}`, `ns-daymaster-summary--${tone}`)}>
      <div className="ns-daymaster-summary__mark" aria-hidden="true">
        <DaymasterVisualIcon icon={visual?.icon || variant} />
      </div>
      <div className="ns-daymaster-summary__copy">
        <p className="ns-kicker">{label}</p>
        <p className="ns-daymaster-summary__value">
          {displayValue}
          {visual?.hanja ? <span>{visual.hanja}</span> : null}
        </p>
        {visual?.description ? <p className="ns-daymaster-summary__hint">{visual.description}</p> : null}
      </div>
    </article>
  );
}

function HomeTile({ item, onClick, variant = 'tile' }) {
  const isClickable = typeof onClick === 'function';
  const Component = isClickable ? 'button' : 'div';
  const Icon = item.icon;
  const rootProps = {
    type: isClickable ? 'button' : undefined,
    onClick,
    className: cx(
      'ns-menu-card group',
      variant === 'featured' ? 'ns-menu-card--featured' : '',
      variant === 'strip' ? 'ns-menu-card--strip' : '',
      item.tone ? `ns-menu-card--${item.tone}` : '',
      !isClickable ? 'ns-menu-card--disabled' : '',
    ),
    'aria-label': isClickable ? item.title : undefined,
    'aria-disabled': !isClickable ? 'true' : undefined,
  };

  if (variant === 'strip') {
    return (
      <Component {...rootProps}>
        <span className="ns-menu-card__icon" aria-hidden="true">
          <Icon locked={!isClickable} />
        </span>
        <div className="ns-menu-card__content">
          <p className="ns-menu-card__subtitle">{item.subtitle}</p>
          <h2 className="ns-menu-card__title">{item.title}</h2>
          <p className="ns-menu-card__description">{item.description}</p>
        </div>
        <span className="ns-menu-card__action">
          {isClickable ? '열기' : '준비 중'}
          {isClickable ? <span aria-hidden="true" className="ns-menu-card__arrow">→</span> : null}
        </span>
      </Component>
    );
  }

  if (variant === 'featured') {
    return (
      <Component {...rootProps}>
        <div className="ns-menu-card__content">
          <p className="ns-menu-card__subtitle">{item.subtitle}</p>
          <h2 className="ns-menu-card__title">{item.title}</h2>
          <p className="ns-menu-card__description">{item.description}</p>
        </div>
        <span className="ns-menu-card__icon" aria-hidden="true">
          <Icon locked={!isClickable} />
        </span>
        <span className="ns-menu-card__action ns-menu-card__action--cta">
          {isClickable ? '보고서 열기' : '준비 중'}
          <span aria-hidden="true" className="ns-menu-card__arrow">→</span>
        </span>
      </Component>
    );
  }

  return (
    <Component {...rootProps}>
      <div className="ns-menu-card__top">
        <span className="ns-menu-card__number">{item.number}</span>
        <span className="ns-menu-card__icon" aria-hidden="true">
          <Icon locked={!isClickable} />
        </span>
      </div>
      <div className="ns-menu-card__content">
        <p className="ns-menu-card__subtitle">{item.subtitle}</p>
        <h2 className="ns-menu-card__title">{item.title}</h2>
        <p className="ns-menu-card__description">{item.description}</p>
      </div>
      <span className="ns-menu-card__action">
        {isClickable ? '열기' : '준비 중'}
        <span aria-hidden="true" className="ns-menu-card__arrow">→</span>
      </span>
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
  const dayMasterStemVisual = getStemVisual(report?.dayMaster?.stem);
  const dayMasterElementVisual = getElementVisual(report?.dayMaster?.element);
  const dayMasterPolarityVisual = getYinYangVisual(report?.dayMaster?.polarity);

  return (
    <BezelCard faceClassName="p-0">
      <ReportCard
        title={`${fullName} 사주 요약`}
        subtitle="입력한 생년월일을 기준으로 원국의 큰 흐름을 먼저 정리했습니다."
        className="ns-card--in-bezel"
        bodyClassName="grid gap-5"
      >
      <div className="ns-saju-visual">
        <NamingResultRenderer
          renderMetrics={metrics}
          birthDateTime={entryUserInfo?.birthDateTime}
          gender={entryUserInfo?.gender}
          isSolarCalendar={entryUserInfo?.isSolarCalendar}
          isBirthTimeUnknown={entryUserInfo?.isBirthTimeUnknown}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.5fr)]">
        <div className="grid gap-4">
          <div className="ns-report-panel ns-report-panel--sunken flex items-center justify-between gap-4">
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
        <div className="ns-saju-preview-stack grid">
          <SajuPillarTable columns={buildPillarColumns(report)} />
          <div className="ns-daymaster-grid grid sm:grid-cols-3">
            <DaymasterSummaryCard
              label="일간"
              visual={dayMasterStemVisual}
              variant="stem"
            />
            <DaymasterSummaryCard
              label="오행"
              visual={dayMasterElementVisual}
              variant="element"
            />
            <DaymasterSummaryCard
              label="음양"
              visual={dayMasterPolarityVisual}
              variant="polarity"
            />
          </div>
        </div>
      </div>
      </ReportCard>
    </BezelCard>
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
      icon: MenuReportIcon,
      tone: 'wood',
      onClick: onOpenCombinedReport,
    },
    {
      number: '02',
      title: '작명하기',
      subtitle: '맞춤 이름 추천',
      description: '사주에 부족한 성분을 보완하는 이름 후보를 차분하게 비교합니다.',
      icon: MenuNamingIcon,
      tone: 'indigo',
      onClick: onOpenNamingCandidates,
    },
    {
      number: '03',
      title: '통합 리포트 완성',
      subtitle: '심화 해석 열기',
      description: '무료 요약 뒤의 이름 조합, 관계, 재물 흐름을 이어서 확인합니다.',
      icon: MenuCoffeeIcon,
      tone: 'earth',
      onClick: onOpenSupport,
    },
    {
      number: '04',
      title: '이름봄 정보',
      subtitle: '브랜드 가이드',
      description: '이름봄이 지키는 분석 원칙과 이름을 바라보는 관점을 안내합니다.',
      icon: MenuInfoIcon,
      tone: 'neutral',
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
      <div className="ns-section-stack ns-section-stack--loose">
        <PageHeading
          kicker="Preview"
          title="사주 흐름을 먼저 확인하세요"
          description="입력한 정보를 기준으로 오늘의 원국과 다음 작업을 정리했습니다."
        />
        <SajuPreviewCard
          entryUserInfo={entryUserInfo}
          report={previewReport}
          metrics={previewMetrics}
          isLoading={isAnalyzing}
          error={analyzeError}
        />

        <RevealOnScroll>
          <HomeTile
            item={menuItems[0]}
            onClick={menuItems[0].onClick}
            variant="featured"
          />
        </RevealOnScroll>
        <RevealOnScroll className="grid gap-4 md:grid-cols-2">
          {menuItems.slice(1, 3).map((item) => (
            <HomeTile
              key={item.number}
              item={item}
              onClick={item.onClick}
            />
          ))}
        </RevealOnScroll>
        <RevealOnScroll>
          <HomeTile
            item={menuItems[3]}
            onClick={menuItems[3].onClick}
            variant="strip"
          />
        </RevealOnScroll>
      </div>
    </ReportShell>
  );
}

export default HomePage;
