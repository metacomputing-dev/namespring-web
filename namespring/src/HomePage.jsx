import React, { useEffect, useMemo, useState } from 'react';
import logoSvg from './assets/logo.svg';
import NamingResultRenderer from './NamingResultRenderer';

function HomeTile({ item, onClick }) {
  const isClickable = typeof onClick === 'function';
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative overflow-hidden rounded-[2.2rem] border p-4 md:p-5 text-left min-h-[11rem]',
        'bg-gradient-to-br shadow-[0_10px_24px_rgba(23,31,22,0.08)] transition-all duration-300',
        isClickable ? 'hover:translate-y-[-3px] hover:shadow-[0_14px_30px_rgba(23,31,22,0.12)]' : 'cursor-default',
        item.bgClass,
      ].join(' ')}
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

function HomePage({ entryUserInfo, onAnalyzeAsync, onOpenReport, onOpenNamingCandidates, onOpenEntry }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [analyzeError, setAnalyzeError] = useState('');
  const menuItems = useMemo(() => ([
    {
      id: 1,
      title: '이름 평가 보고서',
      subtitle: '사주와 성명학의 깊은 분석',
      description: '당신의 이름에 담긴 기운을 정밀하게 측정하여 리포트로 제공합니다.',
      bgClass: 'from-[#EEF8F1] to-[#FFFFFF] border-[#DCE8DF]',
      onClick: onOpenReport,
    },
    {
      id: 2,
      title: '작명하기',
      subtitle: '세상에 단 하나뿐인 축복',
      description: '사주에 부족한 성분을 채워주는 최적의 이름을 추천받으세요.',
      bgClass: 'from-[#F8F2F8] to-[#FFFFFF] border-[#E7DDE7]',
      onClick: onOpenNamingCandidates,
    },
    {
      id: 3,
      title: '고마움 전달하기',
      subtitle: '마음을 나누는 따뜻한 선물',
      description: '좋은 이름을 지어준 분께 감사의 마음을 예쁘게 전달하세요.',
      bgClass: 'from-[#FBF7EC] to-[#FFFFFF] border-[#ECE4D2]',
      onClick: null,
    },
    {
      id: 4,
      title: '이름봄 정보',
      subtitle: '브랜드 철학과 가이드',
      description: '이름봄이 추구하는 가치와 오행 분석의 원리를 소개합니다.',
      bgClass: 'from-[#F1F4F8] to-[#FFFFFF] border-[#DFE6EE]',
      onClick: null,
    },
  ]), [onOpenNamingCandidates, onOpenReport]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!entryUserInfo || !onAnalyzeAsync) {
        setPreviewResult(null);
        return;
      }

      setIsAnalyzing(true);
      setAnalyzeError('');
      try {
        const seedResult = await onAnalyzeAsync(entryUserInfo);
        if (cancelled) return;
        setPreviewResult(seedResult?.candidates?.[0] ?? null);
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
  }, [entryUserInfo, onAnalyzeAsync]);

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
              <p className="text-sm md:text-base font-bold text-[var(--ns-muted)]">이름 결과를 분석하는 중입니다...</p>
            </div>
          )}
          {!isAnalyzing && analyzeError && (
            <div className="h-full w-full rounded-[1.6rem] border border-dashed border-[var(--ns-border)] bg-[var(--ns-surface-soft)] flex items-center justify-center text-center shadow-xl">
              <p className="text-sm md:text-base font-bold text-[var(--ns-muted)]">{analyzeError}</p>
            </div>
          )}
          {!isAnalyzing && !analyzeError && previewResult && (
            <button
              type="button"
              onClick={onOpenEntry}
              className="h-full w-full block text-left rounded-[1.6rem] overflow-hidden"
            >
              <NamingResultRenderer namingResult={previewResult} />
            </button>
          )}
          {!isAnalyzing && !analyzeError && !previewResult && (
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
    </div>
  );
}

export default HomePage;
