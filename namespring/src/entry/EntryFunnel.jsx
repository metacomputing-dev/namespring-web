import React, { useCallback, useState } from 'react';
import InputForm from '../InputForm';
import { BezelCard } from '../components/ui/BezelCard.jsx';
import { StepProgress } from '../components/ui/StepProgress.jsx';
import { PageHeading } from '../components/report/ReportPrimitives';

const STEP_LABELS = ['이름', '태어난 순간', '확인'];

function sameProgress(a, b) {
  return a.isNameSelectionDone === b.isNameSelectionDone
    && a.isBirthDateTimeValid === b.isBirthDateTimeValid
    && a.isGenderDone === b.isGenderDone;
}

export default function EntryFunnel({ hanjaRepo, isDbReady, initialUserInfo, onEnter, submitLabel }) {
  const [progress, setProgress] = useState({
    isNameSelectionDone: false,
    isBirthDateTimeValid: false,
    isGenderDone: false,
  });

  const handleProgressChange = useCallback((next) => {
    setProgress((prev) => (sameProgress(prev, next) ? prev : next));
  }, []);

  const stepOneDone = progress.isNameSelectionDone;
  const stepTwoDone = stepOneDone && progress.isBirthDateTimeValid;
  const stepThreeDone = stepTwoDone && progress.isGenderDone;
  const doneCount = [stepOneDone, stepTwoDone, stepThreeDone].filter(Boolean).length;
  const currentLabel = STEP_LABELS[Math.min(doneCount, STEP_LABELS.length - 1)];

  return (
    <BezelCard className="ns-rise ns-entry-card">
      <PageHeading
        kicker="Start"
        title="기본 정보 입력"
        description="분석에 필요한 최소 정보만 먼저 입력해 주세요."
        className="mb-4 ns-page-heading--compact"
      />
      <div className="mb-5">
        <StepProgress total={STEP_LABELS.length} current={doneCount} label="입력 진행 단계" />
        <p className="ns-field-note mt-1.5">
          {doneCount >= STEP_LABELS.length ? '모든 입력이 끝났어요.' : `다음 단계: ${currentLabel}`}
        </p>
      </div>
      <InputForm
        hanjaRepo={hanjaRepo}
        isDbReady={isDbReady}
        initialUserInfo={initialUserInfo}
        onEnter={onEnter}
        submitLabel={submitLabel}
        onProgressChange={handleProgressChange}
      />
    </BezelCard>
  );
}
