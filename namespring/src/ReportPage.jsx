import React, { useEffect, useState } from 'react';
import InputForm from './InputForm';
import NamingReport from './NamingReport';

function ReportPage({ hanjaRepo, isDbReady, onAnalyze, initialUserInfo, onBackHome }) {
  const [analysisResult, setAnalysisResult] = useState(null);

  const handleAnalyze = (userInfo) => {
    const result = onAnalyze(userInfo);
    setAnalysisResult(result);
  };

  useEffect(() => {
    if (analysisResult || !initialUserInfo || !isDbReady) return;
    const result = onAnalyze(initialUserInfo);
    setAnalysisResult(result);
  }, [analysisResult, initialUserInfo, isDbReady, onAnalyze]);

  return (
    <div className="min-h-screen flex flex-col items-center p-6 font-sans text-[var(--ns-text)]">
      <div className="bg-[var(--ns-surface)] p-10 rounded-[3rem] shadow-2xl border border-[var(--ns-border)] w-full max-w-2xl overflow-hidden">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-[var(--ns-accent-text)]">이름 평가 보고서</h1>
            <p className="text-[var(--ns-muted)] text-sm font-semibold">이름을 입력해 분석을 시작해요.</p>
          </div>
          <button
            onClick={onBackHome}
            className="px-4 py-2 rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)] font-bold"
          >
            홈으로
          </button>
        </header>

        {!analysisResult && (
          <InputForm
            hanjaRepo={hanjaRepo}
            isDbReady={isDbReady}
            onAnalyze={handleAnalyze}
            submitLabel="이름 평가 보고서"
          />
        )}
        {analysisResult && <NamingReport result={analysisResult.candidates[0]} onNewAnalysis={() => setAnalysisResult(null)} />}
      </div>
    </div>
  );
}

export default ReportPage;
