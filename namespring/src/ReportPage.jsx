import React, { useEffect, useState } from 'react';
import InputForm from './InputForm';
import NamingReport from './NamingReport';
import { REPORT_PAGE_CLASS } from './theme/report-ui-theme';

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
    <div className={REPORT_PAGE_CLASS.outer}>
      <div className={REPORT_PAGE_CLASS.container}>
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className={REPORT_PAGE_CLASS.headerTitle}>이름 평가 보고서</h1>
          </div>
          <button
            onClick={onBackHome}
            aria-label="홈으로"
            title="홈으로"
            className={REPORT_PAGE_CLASS.homeButton}
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
