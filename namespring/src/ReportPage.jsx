import React, { useEffect, useState } from 'react';
import InputForm from './InputForm';
import NamingReport from './NamingReport';

function ReportPage({ hanjaRepo, isDbReady, onAnalyze, initialUserInfo, onBackHome }) {
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisUserInfo, setAnalysisUserInfo] = useState(initialUserInfo || null);

  const handleAnalyze = (userInfo) => {
    const result = onAnalyze(userInfo);
    setAnalysisUserInfo(userInfo);
    setAnalysisResult(result);
  };

  useEffect(() => {
    if (analysisResult || !initialUserInfo || !isDbReady) return;
    const result = onAnalyze(initialUserInfo);
    setAnalysisUserInfo(initialUserInfo);
    setAnalysisResult(result);
  }, [analysisResult, initialUserInfo, isDbReady, onAnalyze]);

  return (
    <div className="min-h-screen flex flex-col items-center p-3 font-sans text-[var(--ns-text)]">
      <div className="bg-[var(--ns-surface)] p-5 rounded-[2rem] shadow-2xl border border-[var(--ns-border)] w-full max-w-2xl overflow-hidden">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-[var(--ns-accent-text)]">이름 평가 보고서</h1>
          </div>
          <button
            onClick={onBackHome}
            aria-label="홈으로"
            title="홈으로"
            className="w-10 h-10 rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)] font-bold inline-flex items-center justify-center"
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
              <path d="M3 9.5L10 4L17 9.5V16.5H12.5V12H7.5V16.5H3V9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </header>

        {!analysisResult && (
          <InputForm
            hanjaRepo={hanjaRepo}
            isDbReady={isDbReady}
            onAnalyze={handleAnalyze}
            initialUserInfo={initialUserInfo}
            submitLabel="이름 평가 보고서"
          />
        )}
        {analysisResult && <NamingReport result={analysisResult.candidates[0]} shareUserInfo={analysisUserInfo || initialUserInfo} />}
      </div>
    </div>
  );
}

export default ReportPage;
