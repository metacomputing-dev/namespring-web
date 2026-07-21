import React, { useEffect, useState } from 'react';
import CombinedNamingReport from './CombinedNamingReport';
import ReportShell from './components/report/ReportShell';

function DevCombinedReportPreview() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/__dev/combined-report-preview')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((nextPayload) => {
        if (!cancelled) setPayload(nextPayload);
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : String(nextError));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ReportShell activeNav="report" size="wide" onHome={() => { window.location.href = '/'; }}>
      {error ? <div className="ncr-empty">미리보기를 불러오지 못했어요: {error}</div> : null}
      {!error && !payload ? <div className="ncr-empty">작명 보고서를 준비하고 있어요.</div> : null}
      {payload ? (
        <CombinedNamingReport
          fortuneReport={payload.fortuneReport}
          selectedCandidate={payload.selectedCandidate}
          shareUserInfo={payload.shareUserInfo}
          onBackCandidates={() => { window.location.href = '/'; }}
        />
      ) : null}
    </ReportShell>
  );
}

export default DevCombinedReportPreview;
