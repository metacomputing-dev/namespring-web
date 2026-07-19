import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadCompatRelationship, loadCompatSlot } from '../model/compat';
import { Loading, Section } from '../ui/primitives';
import {
  AxisCard,
  CompatPremiumSection,
  CompatReportTail,
  SaveCompatStar,
  SummaryCard,
  axesOf,
  useCompatibilityResult,
} from './compat/shared';

/**
 * 이름간 궁합 상세 보고서. 통합 궁합에서 고른 두 사람을 그대로 이어받아,
 * 발음오행·오행 상보·수리·음양 축을 하나하나 펼쳐 읽는다.
 */
export default function CompatibilityNameScreen() {
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
        <Loading message="두 이름의 어울림을 읽고 있어요…" />
      </main>
    );
  }
  if (state.status === 'error') {
    return (
      <main className="v3-page">
        <div className="v3-card">
          <p style={{ margin: 0 }}>
            이름 궁합 보고서를 준비하지 못했어요. 입력을 다시 확인해 주시겠어요?
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
        <p className="v3-kicker">이름간 궁합</p>
        <h1 className="v3-page-title">
          {result.persons.a.displayName} · {result.persons.b.displayName}
        </h1>
        <p className="v3-page-lede">
          두 이름이 서로를 부를 때 오가는 소리의 기운과, 글자에 담긴 오행·수리·음양의
          어울림을 성명학의 눈으로 읽어요.
        </p>
      </div>

      <Link to="/compatibility" className="v3-button v3-button--ghost">
        ← 통합 궁합으로
      </Link>

      <Section title="이름 궁합 한눈에 보기">
        <SummaryCard
          summary={result.sections.name.summary}
          kicker="이름 궁합"
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
        lede="각 축의 근거 수치와 해석을 모두 펼쳐 두었어요."
      >
        {axesOf(result, result.sections.name.axisIds).map(axis => (
          <AxisCard key={axis.id} axis={axis} defaultOpen />
        ))}
      </Section>

      <Section
        title="이름과 사주가 만나는 자리"
        lede="이름은 이름끼리만 보지 않아요 — 한 사람의 이름이 상대의 사주에 어떤 기운을 건네는지도 함께 읽어요."
      >
        {axesOf(result, ['cross_name_saju']).map(axis => (
          <AxisCard key={axis.id} axis={axis} defaultOpen />
        ))}
      </Section>

      <CompatPremiumSection />
      <CompatReportTail />
    </main>
  );
}
