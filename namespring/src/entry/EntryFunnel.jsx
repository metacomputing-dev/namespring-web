import React, { useCallback, useState } from 'react';
import InputForm from '../InputForm';
import { BezelCard } from '../components/ui/BezelCard.jsx';
import { StepProgress } from '../components/ui/StepProgress.jsx';

export default function EntryFunnel({ hanjaRepo, isDbReady, initialUserInfo, onEnter, submitLabel }) {
  const [step, setStep] = useState(0);

  const handleProgressChange = useCallback((next) => {
    setStep((prev) => (prev === next.step ? prev : next.step));
  }, []);

  return (
    <div className="ns-rise">
      <header className="mb-8">
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-sage/10 px-3 py-1 text-2xs font-medium uppercase tracking-[0.15em] text-sage">
          이름 통합 보고서
        </p>
        <h1 className="font-serif text-3xl font-bold leading-snug tracking-tight sm:text-4xl">
          이 이름이 이 사람에게
          <br />
          맞는지, 근거로 알려 드려요
        </h1>
        <p className="mt-3 max-w-[46ch] text-smd leading-relaxed text-inksoft">
          생년월일시와 이름만 있으면 돼요. 판정은 전부 계산 결과이고, 문장은 검수된 문안으로 조립돼요.
        </p>
      </header>

      <StepProgress className="mb-6" total={3} current={step + 1} label="입력 단계" />

      <BezelCard>
        <InputForm
          hanjaRepo={hanjaRepo}
          isDbReady={isDbReady}
          initialUserInfo={initialUserInfo}
          onEnter={onEnter}
          submitLabel={submitLabel}
          onProgressChange={handleProgressChange}
        />
      </BezelCard>
    </div>
  );
}
