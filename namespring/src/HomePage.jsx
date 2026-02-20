import React, { useEffect, useMemo, useState } from 'react';
import logoSvg from './assets/logo.svg';
import NamingResultRenderer from './NamingResultRenderer';
import { HOME_CARD_COLOR_THEME, buildTileStyle } from './theme/card-color-theme';
import { buildRenderMetricsFromSajuReport } from './naming-result-render-metrics';

function HomeTile({ item, onClick }) {
  const isClickable = typeof onClick === 'function';
  const tileStyle = useMemo(() => buildTileStyle(item.theme), [item.theme]);
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative overflow-hidden rounded-[2.2rem] border p-4 md:p-5 text-left min-h-[11rem]',
        'bg-gradient-to-br shadow-[0_10px_24px_rgba(23,31,22,0.08)] transition-all duration-300',
        isClickable ? 'hover:translate-y-[-3px] hover:shadow-[0_14px_30px_rgba(23,31,22,0.12)]' : 'cursor-default',
      ].join(' ')}
      style={tileStyle}
      disabled={!isClickable}
    >
      <div className="flex flex-col">
        <div className="w-14 h-14 rounded-2xl border border-[var(--ns-border)] bg-white/85 shadow-inner flex items-center justify-center">
          <img src={logoSvg} alt="" className="h-8 w-8 select-none" draggable="false" />
        </div>

        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] md:text-[11px] font-medium tracking-wide text-[#91A0B8]">{item.subtitle}</p>
          <h3 className="text-[1.1rem] leading-tight md:text-[1.25rem] font-semibold text-[var(--ns-accent-text)] break-keep">
            {item.title}
          </h3>
          <p className="text-[11px] md:text-[12px] leading-snug font-normal text-[#73819A] break-keep">
            {item.description}
          </p>
        </div>
      </div>
    </button>
  );
}

function HomePage({ entryUserInfo, onLoadSajuReport, onOpenCombinedReport, onOpenNamingCandidates, onOpenEntry }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewMetrics, setPreviewMetrics] = useState(null);
  const [analyzeError, setAnalyzeError] = useState('');
  const menuItems = useMemo(() => ([
    {
      id: 1,
      title: '통합 평가 보고서',
      subtitle: '사주와 성명학의 통합 분석',
      description: '이름 평가와 사주 평가를 함께 묶은 종합 리포트를 제공합니다.',
      theme: HOME_CARD_COLOR_THEME.report,
      onClick: onOpenCombinedReport,
    },
    {
      id: 2,
      title: '작명하기',
      subtitle: '세상에 단 하나뿐인 축복',
      description: '사주에 부족한 성분을 채워주는 최적의 이름을 추천받으세요.',
      theme: HOME_CARD_COLOR_THEME.naming,
      onClick: onOpenNamingCandidates,
    },
    {
      id: 3,
      title: '고마움 전달하기',
      subtitle: '마음을 나누는 따뜻한 선물',
      description: '좋은 이름을 지어준 분께 감사의 마음을 예쁘게 전달하세요.',
      theme: HOME_CARD_COLOR_THEME.gratitude,
      onClick: null,
    },
    {
      id: 4,
      title: '이름봄 정보',
      subtitle: '브랜드 철학과 가이드',
      description: '이름봄이 추구하는 가치와 오행 분석의 원리를 소개합니다.',
      theme: HOME_CARD_COLOR_THEME.info,
      onClick: null,
    },
  ]), [onOpenCombinedReport, onOpenNamingCandidates]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!entryUserInfo || !onLoadSajuReport) {
        setPreviewMetrics(null);
        return;
      }

      setIsAnalyzing(true);
      setAnalyzeError('');
      try {
        const sajuReport = await onLoadSajuReport(entryUserInfo);
        if (cancelled) return;
        setPreviewMetrics(buildRenderMetricsFromSajuReport(sajuReport, {
          entryUserInfo,
        }));
      } catch {
        if (cancelled) return;
        setAnalyzeError('결과를 불러오지 못했습니다.');
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
    <div className="min-h-screen p-6 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <img src={logoSvg} alt="이름봄 로고" className="h-10 w-10 select-none" draggable="false" />
          <h2 className="text-3xl font-black text-[var(--ns-accent-text)]">이름봄</h2>
        </div>

        <div className="h-44 md:h-52 mb-4">
          {isAnalyzing && (
            <div className="h-full w-full rounded-[1.6rem] border border-dashed border-[var(--ns-border)] bg-[var(--ns-surface-soft)] flex items-center justify-center text-center shadow-xl">
              <p className="text-sm md:text-base font-bold text-[var(--ns-muted)]">사주 결과를 분석하는 중입니다...</p>
            </div>
          )}
          {!isAnalyzing && analyzeError && (
            <div className="h-full w-full rounded-[1.6rem] border border-dashed border-[var(--ns-border)] bg-[var(--ns-surface-soft)] flex items-center justify-center text-center shadow-xl">
              <p className="text-sm md:text-base font-bold text-[var(--ns-muted)]">{analyzeError}</p>
            </div>
          )}
          {!isAnalyzing && !analyzeError && previewMetrics && (
            <div className="h-full w-full block text-left rounded-[1.6rem] overflow-hidden">
              <NamingResultRenderer
                renderMetrics={previewMetrics}
                birthDateTime={entryUserInfo?.birthDateTime}
                gender={entryUserInfo?.gender}
                isSolarCalendar={entryUserInfo?.isSolarCalendar}
                isBirthTimeUnknown={entryUserInfo?.isBirthTimeUnknown}
              />
            </div>
          )}
          {!isAnalyzing && !analyzeError && !previewMetrics && (
            <div className="h-full w-full rounded-[1.6rem] border border-dashed border-[var(--ns-border)] bg-[var(--ns-surface-soft)] flex items-center justify-center text-center">
              <p className="text-sm md:text-base font-bold text-[var(--ns-muted)]">입력한 이름 데이터가 없습니다.</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-5">
          {menuItems.map((item) => (
            <HomeTile
              key={item.id}
              item={item}
              onClick={item.onClick}
            />
          ))}
        </div>
      </div>

      {typeof onOpenEntry === 'function' && (
        <button
          type="button"
          onClick={() => onOpenEntry(entryUserInfo)}
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '24px',
            transform: 'translateX(-50%)',
            zIndex: 9999,
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-[var(--ns-surface)]/95 text-[var(--ns-accent-text)] shadow-[0_10px_24px_rgba(15,23,42,0.22)] backdrop-blur-sm hover:brightness-95"
          aria-label="입력 정보 수정"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
            <path d="M3.5 13.8L13.5 3.8L16.2 6.5L6.2 16.5L3 17L3.5 13.8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M12.1 5.2L14.8 7.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default HomePage;
