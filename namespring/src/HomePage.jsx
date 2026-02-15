import React, { useEffect, useState } from 'react';
import logoSvg from './assets/logo.svg';
import NamingResultRenderer from './NamingResultRenderer';

function HomeTile({ title, className, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-[2.2rem] p-5 shadow-xl hover:translate-y-[-2px] transition-all text-left ${className}`}
    >
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <img src={logoSvg} alt="" className="h-12 w-12 select-none" draggable="false" />
        <p className="text-sm md:text-base font-black text-[var(--ns-accent-text)] text-center">{title}</p>
      </div>
    </button>
  );
}

function HomePage({ entryUserInfo, onAnalyzeAsync, onOpenReport }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [analyzeError, setAnalyzeError] = useState('');

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
            <NamingResultRenderer namingResult={previewResult} />
          )}
          {!isAnalyzing && !analyzeError && !previewResult && (
            <div className="h-full w-full rounded-[1.6rem] border border-dashed border-[var(--ns-border)] bg-[var(--ns-surface-soft)] flex items-center justify-center text-center">
              <p className="text-sm md:text-base font-bold text-[var(--ns-muted)]">입력한 이름 데이터가 없습니다.</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <HomeTile title="이름 평가 보고서" className="h-44 md:h-52" onClick={onOpenReport} />
          <HomeTile title="작명하기" className="h-44 md:h-52" onClick={() => {}} />
          <HomeTile title="고마움 전달하기" className="h-44 md:h-52" onClick={() => {}} />
          <HomeTile title="이름봄 정보" className="h-44 md:h-52" onClick={() => {}} />
        </div>
      </div>
    </div>
  );
}

export default HomePage;
