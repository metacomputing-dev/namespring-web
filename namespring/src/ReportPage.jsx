import React, { useEffect, useState } from 'react';
import InputForm from './InputForm';
import NamingReport from './NamingReport';
import ReportShell from './components/report/ReportShell';
import { PageHeading } from './components/report/ReportPrimitives';
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
    <ReportShell activeNav="report" onHome={onBackHome} size="wide">
      <PageHeading
        kicker="Name report"
        title="이름 평가 보고서"
        description="이름의 자원, 음양, 오행, 수리 흐름을 한 번에 검토합니다."
      />
      <div className={REPORT_PAGE_CLASS.container}>

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
    </ReportShell>
  );
}

export default ReportPage;
