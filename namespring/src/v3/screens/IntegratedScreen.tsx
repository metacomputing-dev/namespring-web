import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ReportSurfaceSelectionV1 } from '@spring/report/delivery/types';
import NamingResultRenderer from '../../NamingResultRenderer';
import { buildRenderMetricsFromSajuReport } from '../../naming-result-render-metrics';
import { useDelivery } from '../engine/useDelivery';
import {
  ELEMENT_KO,
  factOfKind,
  factsOfKind,
  type DeliveryIndex,
} from '../model/facts';
import { fullHangulName, fullHanjaName, type V3Profile } from '../model/profile';
import {
  ElementBadge,
  Loading,
  OverrideBanner,
  ReportActions,
  ReportFootnote,
  Section,
} from '../ui/primitives';

const SURFACES: ReportSurfaceSelectionV1[] = [{ id: 'integrated', depth: 'standard' }];

/** v1의 오행·음양 풍경 그림카드를 delivery의 pillars fact로 되살린다. */
function SceneryCard({ index, profile }: { index: DeliveryIndex; profile: V3Profile }) {
  const pillars = factOfKind(index, 'pillars');
  const metrics = useMemo(() => {
    if (!pillars) return null;
    const byPosition: Record<string, { stem: { code: string }; branch: { code: string } }> = {};
    for (const value of pillars.values) {
      byPosition[value.position] = {
        stem: { code: value.stem.code },
        branch: { code: value.branch.code },
      };
    }
    return buildRenderMetricsFromSajuReport(
      { pillars: byPosition },
      {
        displayHangul: fullHangulName(profile),
        displayHanja: fullHanjaName(profile) ?? '',
      },
    );
  }, [pillars, profile]);
  if (!metrics) return null;
  return (
    <div className="v3-scenery">
      <NamingResultRenderer
        renderMetrics={metrics}
        birthDateTime={{
          year: profile.birth.year,
          month: profile.birth.month,
          day: profile.birth.day,
          hour: profile.birth.hour ?? undefined,
          minute: profile.birth.minute ?? undefined,
        }}
        gender={profile.birth.gender}
        isSolarCalendar={profile.birth.calendarType === 'solar'}
        isBirthTimeUnknown={profile.birth.hour === null}
      />
    </div>
  );
}

function meetingSentence(index: DeliveryIndex): { main: string; caution: string | null } | null {
  const interaction = factOfKind(index, 'name_saju_interaction');
  if (!interaction || interaction.classification === 'unavailable') return null;
  const total = interaction.nameElements.length;
  const yongshinKo = interaction.yongshinElement ? ELEMENT_KO[interaction.yongshinElement] : null;
  const gishinKo = interaction.gishinElement ? ELEMENT_KO[interaction.gishinElement] : null;
  let main: string;
  if (interaction.yongshinMatchCount > 0 && yongshinKo) {
    main = `이름 ${total}글자 가운데 ${interaction.yongshinMatchCount}글자가 사주가 반기는 ${yongshinKo} 기운과 같아요.`;
  } else if (yongshinKo) {
    main = `이름에 ${yongshinKo} 기운 글자가 직접 들어 있지는 않지만, 전체 오행 구성으로 어울림을 살펴봤어요.`;
  } else {
    main = '이름과 사주의 오행 구성을 나란히 살펴봤어요.';
  }
  const caution =
    interaction.gishinMatchCount > 0 && gishinKo
      ? `${gishinKo} 기운 글자 ${interaction.gishinMatchCount}개는 사주가 조심스러워하는 기운과 같아, 함께 읽어볼 지점이에요.`
      : null;
  return { main, caution };
}

function ElementCompareBars({ index }: { index: DeliveryIndex }) {
  const distributions = factsOfKind(index, 'element_distribution');
  const saju = distributions.find(fact => fact.source === 'saju');
  const name = distributions.find(fact => fact.source === 'name');
  if (!saju || !name) return null;
  const share = (fact: typeof saju, element: string) =>
    fact.values.find(value => value.element === element)?.sharePercent ?? 0;
  return (
    <div className="v3-compare">
      {(['wood', 'fire', 'earth', 'metal', 'water'] as const).map(element => (
        <div key={element} className="v3-compare-row">
          <span className="v3-compare-label">{ELEMENT_KO[element]}</span>
          <div className="v3-compare-tracks">
            <div className="v3-compare-track">
              <div
                className="v3-compare-fill v3-compare-fill--saju"
                style={{ width: `${share(saju, element)}%` }}
              />
            </div>
            <div className="v3-compare-track v3-compare-track--name">
              <div
                className="v3-compare-fill v3-compare-fill--name"
                style={{ width: `${share(name, element)}%` }}
              />
            </div>
          </div>
          <span className="v3-compare-values">
            {Math.round(share(saju, element))}·{Math.round(share(name, element))}%
          </span>
        </div>
      ))}
      <p className="v3-hint" style={{ marginTop: '0.4rem' }}>
        위 줄이 사주, 아래 줄이 이름이에요. 이름 줄은 글자 두세 개가 재료의 전부라
        절반 길이로 줄여 두었어요.
      </p>
    </div>
  );
}

function NameSummaryCard({ index, profile }: { index: DeliveryIndex; profile: V3Profile }) {
  const characters = factsOfKind(index, 'name_character');
  return (
    <div className="v3-card">
      <p className="v3-kicker">이름에서 확인한 것</p>
      {characters.length > 0 ? (
        <ul className="v3-plain-list">
          {characters.map(fact => (
            <li key={fact.id}>
              <strong>{fact.hangul}</strong>
              {fact.hanja ? ` (${fact.hanja})` : ''}
              {fact.meaning ? ` — ${fact.meaning}` : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0 }}>{fullHangulName(profile)}의 글자 구성을 확인했어요.</p>
      )}
      <Link to="/reports/naming" className="v3-button v3-button--ghost v3-button--wide" style={{ marginTop: '0.9rem' }}>
        이름 자세히 보기
      </Link>
    </div>
  );
}

function SajuSummaryCard({ index }: { index: DeliveryIndex }) {
  const dayMaster = factOfKind(index, 'day_master');
  const strength = factOfKind(index, 'strength');
  const yongshin = factOfKind(index, 'yongshin');
  return (
    <div className="v3-card">
      <p className="v3-kicker">사주에서 확인한 것</p>
      <ul className="v3-plain-list">
        {dayMaster ? (
          <li>
            나를 나타내는 글자는 <strong>{dayMaster.stem}</strong>
            {dayMaster.element ? (
              <>
                {' '}
                — <ElementBadge element={dayMaster.element} suffix="기운" />
              </>
            ) : null}
          </li>
        ) : null}
        {strength ? <li>타고난 기운의 세기는 <strong>{strength.level}</strong> 쪽이에요.</li> : null}
        {yongshin?.element ? (
          <li>
            사주가 반기는 기운은 <ElementBadge element={yongshin.element} suffix="기운" /> 이에요.
          </li>
        ) : null}
      </ul>
      <Link to="/reports/saju" className="v3-button v3-button--ghost v3-button--wide" style={{ marginTop: '0.9rem' }}>
        사주 자세히 보기
      </Link>
    </div>
  );
}

export default function IntegratedScreen() {
  const state = useDelivery(SURFACES);
  if (state.status === 'loading') {
    return (
      <main className="v3-page">
        <Loading message="이름과 사주를 함께 읽고 있어요…" />
      </main>
    );
  }
  if (state.status === 'error') {
    return (
      <main className="v3-page">
        <div className="v3-card">
          <p style={{ margin: 0 }}>
            보고서를 준비하지 못했어요. 입력을 다시 확인해 주시겠어요?
          </p>
          <Link to="/" className="v3-button" style={{ marginTop: '0.8rem' }}>
            입력 화면으로
          </Link>
        </div>
      </main>
    );
  }

  const { index, profile } = state;
  const hangulName = fullHangulName(profile);
  const hanjaName = fullHanjaName(profile);
  const meeting = meetingSentence(index);

  return (
    <main className="v3-page">
      <OverrideBanner />
      <div className="v3-page-head">
        <p className="v3-kicker">통합 보고서</p>
        <h1 className="v3-page-title">
          {hangulName}
          {hanjaName ? <span className="v3-title-hanja"> {hanjaName}</span> : null}
        </h1>
        {meeting ? <p className="v3-page-lede">{meeting.main}</p> : null}
      </div>

      <SceneryCard index={index} profile={profile} />

      {meeting?.caution ? (
        <div className="v3-card v3-card--tinted" style={{ marginTop: 'var(--space-sm)' }}>
          <p style={{ margin: 0 }}>{meeting.caution}</p>
        </div>
      ) : null}

      <Section title="이름과 사주, 나란히 보기" lede="같은 크기로 두고 서로 다른 계산을 억지로 합치지 않았어요.">
        <div className="v3-grid-2">
          <NameSummaryCard index={index} profile={profile} />
          <SajuSummaryCard index={index} />
        </div>
      </Section>

      <Section title="오행으로 견주어 보기">
        <div className="v3-card">
          <ElementCompareBars index={index} />
        </div>
      </Section>

      <Section title="새 이름이 궁금하다면">
        <div className="v3-card">
          <p style={{ margin: 0 }}>
            같은 출생 정보로 뜻·소리·획수·사주 어울림을 함께 계산한 이름 후보를 보여드려요.
          </p>
          <Link to="/naming/candidates" className="v3-button" style={{ marginTop: '0.8rem' }}>
            새 이름 지어 보기
          </Link>
        </div>
      </Section>

      <Section title="이 해석이 나에게 닿는 이유">
        <div className="v3-card v3-card--hero">
          <p style={{ margin: 0 }}>
            지금 보신 결과가 방향을 잡아 주었다면, 완성 리포트는 그 방향이 왜 당신의
            이름과 사주에 닿는지 차분히 이어 줍니다. 이름 조합의 이유, 앞으로의 관계와
            재물 흐름, 다시 읽을 수 있는 PDF까지 한 번에 정리됩니다.
          </p>
          <Link to="/account?intent=premium" className="v3-button" style={{ marginTop: '0.9rem' }}>
            내 해석 완성하기
          </Link>
          <p className="v3-hint" style={{ margin: '0.55rem 0 0' }}>
            결제 전에 계정을 확인해요. 계정이 준비되기 전에는 이메일 영수증만으로도
            진행할 수 있어요.
          </p>
        </div>
      </Section>

      <div className="v3-card" style={{ marginTop: 'var(--space-lg)' }}>
        <p style={{ margin: '0 0 0.7rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          읽은 결과는 저장하고, 다시 열어 볼 수 있게 남겨두세요.
        </p>
        <ReportActions />
      </div>
      <ReportFootnote />
    </main>
  );
}
