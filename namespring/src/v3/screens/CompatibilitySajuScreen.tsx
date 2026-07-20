import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadCompatRelationship, loadCompatSlot } from '../model/compat';
import { Loading, Section, TermToggle } from '../ui/primitives';
import {
  AxisCard,
  CompatPremiumSection,
  CompatReportTail,
  CrossSignalBrowser,
  SaveCompatStar,
  SummaryCard,
  axesOf,
  dayBranchSeatLabel,
  useCompatibilityResult,
} from './compat/shared';
import DaeunOverlaySection from './compat/DaeunOverlay';
import { CompatNatalSignalsSection } from './compat/CompatNatalSignals';

/**
 * 사주간 궁합 상세 보고서. 일간·배우자궁·용신·오행 등 명리 궁합의 정통 축을
 * 전부 펼쳐 읽고, 여덟 기둥 교차 신호까지 살핀다.
 */
export default function CompatibilitySajuScreen() {
  const navigate = useNavigate();
  const [slotA] = useState(() => loadCompatSlot('a'));
  const [slotB] = useState(() => loadCompatSlot('b'));
  const [selection] = useState(loadCompatRelationship);
  const state = useCompatibilityResult(slotA, slotB, selection);

  useEffect(() => {
    // 슬롯이 비었거나 같은 사람이면 통합 화면에서 다시 고르게 한다.
    if (!slotA || !slotB || state.status === 'same') {
      navigate('/compatibility', { replace: true });
    }
  }, [slotA, slotB, state.status, navigate]);

  if (state.status === 'loading' || state.status === 'missing' || state.status === 'same') {
    return (
      <main className="v3-page">
        <Loading message="두 사주의 만남을 읽고 있어요…" />
      </main>
    );
  }
  if (state.status === 'error') {
    return (
      <main className="v3-page">
        <div className="v3-card">
          <p style={{ margin: 0 }}>
            사주 궁합 보고서를 준비하지 못했어요. 입력을 다시 확인해 주시겠어요?
          </p>
          <Link to="/compatibility" className="v3-button" style={{ marginTop: '0.8rem' }}>
            통합 궁합으로
          </Link>
        </div>
      </main>
    );
  }

  const { result } = state;

  return (
    <main className="v3-page">
      <div className="v3-page-head">
        <p className="v3-kicker">사주간 궁합</p>
        <h1 className="v3-page-title">
          {result.persons.a.displayName} · {result.persons.b.displayName}
        </h1>
        <p className="v3-page-lede">
          일간의 만남과 {dayBranchSeatLabel(result.context.fact.framing)}의 관계부터
          용신·오행의 상보까지, 명리 궁합의 정통 축을 하나하나 짚어 읽어요.
        </p>
      </div>

      <TermToggle />

      <Section title="사주 궁합 한눈에 보기">
        <SummaryCard
          summary={result.sections.saju.summary}
          kicker="사주 궁합"
          headerAction={
            <SaveCompatStar
              slotA={slotA!}
              slotB={slotB!}
              result={result}
              selection={selection}
            />
          }
        />
      </Section>

      <Section
        title="축별로 자세히 읽기"
        lede="각 축의 근거와 해석을 모두 펼쳐 두었어요. 점수의 가중치도 그대로 공개해요."
      >
        {axesOf(result, result.sections.saju.axisIds).map(axis => (
          <AxisCard key={axis.id} axis={axis} defaultOpen />
        ))}
      </Section>

      {slotA && slotB ? (
        <DaeunOverlaySection slotA={slotA} slotB={slotB} result={result} />
      ) : null}

      {slotA && slotB ? (
        <CompatNatalSignalsSection slotA={slotA} slotB={slotB} />
      ) : null}

      {/* 교차 신호가 없으면 Section 자체가 그려지지 않는다 (빈 제목 방지). */}
      <CrossSignalBrowser
        result={result}
        title="여덟 기둥을 모두 겹쳐 보기"
        lede="일지·띠 밖의 기둥끼리 오가는 신호는 점수 없이 참고로만 살펴요."
      />

      <CompatPremiumSection />
      <CompatReportTail />
    </main>
  );
}
