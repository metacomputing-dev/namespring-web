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
import { ScoreBar } from './compat/shared';

/** naming 표면을 함께 요청해 이름 점수 metric들을 한눈에 보기 카드에 쓴다. */
const SURFACES: ReportSurfaceSelectionV1[] = [
  { id: 'integrated', depth: 'standard' },
  { id: 'naming', depth: 'standard' },
];

const INTERACTION_KO: Record<string, string> = {
  supportive_signal: '이름이 사주가 반기는 기운을 담고 있어요.',
  mixed_signals: '이름에 사주를 살리는 기운과 함께 살필 기운이 같이 있어요.',
  no_direct_match: '이름과 사주가 직접 겹치는 기운은 없어요 — 전체 구성으로 어울림을 봐요.',
  caution_signal: '이름에 사주가 조심스러워하는 기운이 있어, 함께 읽어볼 지점이에요.',
};

/** 년지 → 띠 동물. 申은 런타임 'SIN'과 보고서 계층 별칭 'SIN_BRANCH'를 모두 받는다. */
const ZODIAC_KO: Record<string, string> = {
  JA: '쥐', CHUK: '소', IN: '호랑이', MYO: '토끼', JIN: '용', SA: '뱀',
  O: '말', MI: '양', SIN: '원숭이', SIN_BRANCH: '원숭이', YU: '닭', SUL: '개', HAE: '돼지',
};

/** 월지 → 절기 계절 이름 (지지의 달은 절기 기준이라 양력 달과 다를 수 있다). */
const SEASON_KO: Record<string, string> = {
  IN: '초봄', MYO: '봄', JIN: '늦봄', SA: '초여름', O: '한여름', MI: '늦여름',
  SIN: '초가을', SIN_BRANCH: '초가을', YU: '가을', SUL: '늦가을',
  HAE: '초겨울', JA: '한겨울', CHUK: '늦겨울',
};

/**
 * 궁합 화면의 '두 사람의 자리' 카드에 대응하는 한 사람 판.
 * 띠·절기 계절·일간·시각 유무라는 결정론적 사실만 자리말로 엮는다.
 */
function MyPlaceCard({ index, profile }: { index: DeliveryIndex; profile: V3Profile }) {
  const pillars = factOfKind(index, 'pillars');
  if (!pillars) return null;
  const at = (position: string) =>
    pillars.values.find(value => value.position === position) ?? null;
  const year = at('year');
  const month = at('month');
  const day = at('day');
  if (!day) return null;
  const zodiac = year ? ZODIAC_KO[year.branch.code] ?? null : null;
  const season = month ? SEASON_KO[month.branch.code] ?? null : null;
  const hourKnown = profile.birth.hour !== null;

  let opening = '';
  if (season && month) {
    opening += `${season} ${month.branch.hangul}(${month.branch.hanja})월에 태어난 `;
  }
  opening += `${day.stem.hangul}(${day.stem.hanja}) 일간이에요.`;
  if (year && zodiac) {
    opening += ` ${year.stem.hangul}${year.branch.hangul}(${year.stem.hanja}${year.branch.hanja})년, ${zodiac}띠 해에 났어요.`;
  }
  const hourNote = hourKnown
    ? '태어난 시각까지 알고 있어 여덟 글자를 모두 셈했어요.'
    : '태어난 시각을 몰라 시주는 셈에 넣지 않고, 아는 글자만으로 정직하게 읽어요.';

  return (
    <div className="v3-card" style={{ marginTop: 'var(--space-sm)' }}>
      <p className="v3-kicker">나의 자리</p>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {zodiac ? <span className="v3-badge v3-badge--accent">{zodiac}띠</span> : null}
        {season ? <span className="v3-badge">{season} 태생</span> : null}
        <span className="v3-badge">{hourKnown ? '여덟 글자로 읽음' : '태어난 시각 모름'}</span>
      </div>
      <p style={{ margin: '0.55rem 0 0' }}>{opening}</p>
      <p style={{ margin: '0.55rem 0 0' }}>{hourNote}</p>
    </div>
  );
}

/**
 * 이 보고서가 실제로 셈한 값들을 궁합 화면의 요약 카드와 같은 시각 언어로 모은다.
 * 이름↔사주는 합산 점수를 두지 않는 계약(not_a_combined_balance_score)이라
 * 이름 점수만 크게 보여주고, 사주는 점수 없이 결론으로 읽는다.
 */
function OverallComputationCard({ index }: { index: DeliveryIndex }) {
  const metrics = factsOfKind(index, 'metric').filter(
    fact => fact.unit === 'score_0_100' && fact.direction === 'higher_is_better',
  );
  const main =
    metrics.find(fact => fact.id === 'naming.total-score') ??
    metrics.find(fact => fact.id === 'naming.hangul-score') ??
    null;
  if (!main) return null;
  const rest = metrics.filter(fact => fact.id !== main.id);
  const interaction = factOfKind(index, 'name_saju_interaction');
  const interactionLine =
    interaction && interaction.classification !== 'unavailable'
      ? INTERACTION_KO[interaction.classification] ?? null
      : null;
  const strength = factOfKind(index, 'strength');
  const yongshin = factOfKind(index, 'yongshin');
  const sajuDistribution =
    factsOfKind(index, 'element_distribution').find(fact => fact.source === 'saju') ?? null;
  const strongest =
    sajuDistribution && sajuDistribution.values.length > 0
      ? sajuDistribution.values.reduce((a, b) => (b.sharePercent > a.sharePercent ? b : a))
      : null;
  const faintest =
    sajuDistribution && sajuDistribution.values.length > 0
      ? sajuDistribution.values.reduce((a, b) => (b.sharePercent < a.sharePercent ? b : a))
      : null;
  return (
    <div className="v3-card">
      <div className="v3-grid-2">
        <div>
          <p className="v3-kicker">이름의 계산</p>
          <div className="v3-fortune-cell-head">
            <p className="v3-core-value" style={{ margin: 0 }}>
              {Math.round(main.value)}
              <span className="v3-hint" style={{ marginLeft: '0.25rem' }}>/ 100</span>
            </p>
            <span className="v3-badge v3-badge--accent">{main.label}</span>
          </div>
          <ScoreBar score={main.value} />
          {rest.length > 0 ? (
            <ul className="v3-plain-list" style={{ margin: '0.7rem 0 0' }}>
              {rest.map(fact => (
                <li key={fact.id}>
                  {fact.label} <strong>{Math.round(fact.value)}점</strong>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div>
          <p className="v3-kicker">사주의 결론</p>
          <ul className="v3-plain-list">
            {strength ? (
              <li>타고난 기운 세기 <strong>{strength.level}</strong></li>
            ) : null}
            {strongest ? (
              <li>
                가장 짙은 기운 <ElementBadge element={strongest.element} suffix="기운" />{' '}
                {Math.round(strongest.sharePercent)}%
              </li>
            ) : null}
            {faintest ? (
              <li>
                가장 옅은 기운 <ElementBadge element={faintest.element} suffix="기운" />{' '}
                {Math.round(faintest.sharePercent)}%
              </li>
            ) : null}
            {yongshin?.element ? (
              <li>
                반기는 기운 <ElementBadge element={yongshin.element} suffix="기운" />
                {Number.isFinite(yongshin.confidence) ? (
                  <span className="v3-hint"> 신뢰도 {Math.round(yongshin.confidence)}%</span>
                ) : null}
              </li>
            ) : null}
          </ul>
          <p className="v3-hint" style={{ margin: '0.55rem 0 0' }}>
            사주는 좋고 나쁨을 점수로 매길 대상이 아니라 결론으로 읽어요.
          </p>
        </div>
      </div>
      {interactionLine ? <p style={{ margin: '0.7rem 0 0' }}>{interactionLine}</p> : null}
      <p className="v3-hint" style={{ margin: '0.7rem 0 0' }}>
        이름과 사주는 단위가 다른 계산이라 하나의 점수로 합치지 않아요. 두 사람
        사이를 셈하는 궁합의 통합 점수와 다른 점이에요.
      </p>
    </div>
  );
}

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

/** 궁합 허브의 상세 링크 카드와 같은 모양새: 점수 머리 + 한 줄 요약 + 하단 와이드 버튼. */
function NameDetailLinkCard({ index, profile }: { index: DeliveryIndex; profile: V3Profile }) {
  const metrics = factsOfKind(index, 'metric').filter(
    fact => fact.unit === 'score_0_100' && fact.direction === 'higher_is_better',
  );
  const main =
    metrics.find(fact => fact.id === 'naming.total-score') ??
    metrics.find(fact => fact.id === 'naming.hangul-score') ??
    null;
  const meanings = factsOfKind(index, 'name_character')
    .filter(fact => fact.meaning)
    .map(fact => fact.meaning);
  const headline =
    meanings.length > 0
      ? `${meanings.join(' · ')} — 글자마다 담긴 뜻과 소리, 수리의 흐름을 풀어드려요.`
      : `${fullHangulName(profile)} — 글자의 소리와 뜻, 수리의 흐름을 하나하나 풀어드려요.`;
  return (
    <div className="v3-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <p className="v3-kicker">이름 풀이</p>
      {main ? (
        <p className="v3-core-value" style={{ marginBottom: '0.25rem' }}>
          {Math.round(main.value)}
          <span className="v3-hint" style={{ marginLeft: '0.25rem' }}>/ 100</span>
          <span className="v3-badge" style={{ marginLeft: '0.45rem' }}>{main.label}</span>
        </p>
      ) : null}
      <p style={{ margin: 0 }}>{headline}</p>
      <div style={{ marginTop: 'auto', paddingTop: '0.9rem' }}>
        <Link to="/reports/naming" className="v3-button v3-button--ghost v3-button--wide">
          이름 자세히 보기
        </Link>
      </div>
    </div>
  );
}

/** 사주는 점수가 없으므로 일간 글자를 머리값으로 두고 결론 한 줄로 잇는다. */
function SajuDetailLinkCard({ index }: { index: DeliveryIndex }) {
  const pillars = factOfKind(index, 'pillars');
  const dayPillar = pillars?.values.find(value => value.position === 'day') ?? null;
  const dayMaster = factOfKind(index, 'day_master');
  const strength = factOfKind(index, 'strength');
  const yongshin = factOfKind(index, 'yongshin');
  return (
    <div className="v3-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <p className="v3-kicker">사주 풀이</p>
      {dayPillar || dayMaster ? (
        <p className="v3-core-value" style={{ marginBottom: '0.25rem' }}>
          {dayPillar ? `${dayPillar.stem.hangul}(${dayPillar.stem.hanja})` : dayMaster!.stem}
          {dayMaster?.element ? (
            <span className="v3-badge" style={{ marginLeft: '0.45rem' }}>
              나를 나타내는 글자
            </span>
          ) : null}
        </p>
      ) : null}
      <p style={{ margin: 0 }}>
        {strength ? (
          <>타고난 기운은 <strong>{strength.level}</strong> 쪽이에요.</>
        ) : null}
        {yongshin?.element ? (
          <>
            {' '}
            사주가 반기는 기운은 <ElementBadge element={yongshin.element} suffix="기운" /> 이에요.
          </>
        ) : null}
      </p>
      <div style={{ marginTop: 'auto', paddingTop: '0.9rem' }}>
        <Link to="/reports/saju" className="v3-button v3-button--ghost v3-button--wide">
          사주 자세히 보기
        </Link>
      </div>
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

      <MyPlaceCard index={index} profile={profile} />

      {meeting?.caution ? (
        <div className="v3-card v3-card--tinted" style={{ marginTop: 'var(--space-sm)' }}>
          <p style={{ margin: 0 }}>{meeting.caution}</p>
        </div>
      ) : null}

      <Section
        title="한눈에 보기"
        lede="이 보고서가 실제로 셈한 값을 한자리에 모았어요. 이름은 점수로 셈하고, 사주는 점수 대신 결론으로 읽어요."
      >
        <OverallComputationCard index={index} />
      </Section>

      <Section title="오행으로 견주어 보기">
        <div className="v3-card">
          <ElementCompareBars index={index} />
        </div>
      </Section>

      <Section
        title="더 자세히 읽기"
        lede="글자 하나·기둥 하나의 근거와 해석은 각각의 상세 보고서에 있어요. 전 생애 대운 흐름은 사주 보고서에서 볼 수 있어요."
      >
        <div className="v3-grid-2">
          <NameDetailLinkCard index={index} profile={profile} />
          <SajuDetailLinkCard index={index} />
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
