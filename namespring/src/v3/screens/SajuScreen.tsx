import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  ReportSurfaceSelectionV1,
  ReportCategoryIdV1,
  CalendarPeriodIdV1,
} from '@spring/report/delivery/types';
import { useDelivery } from '../engine/useDelivery';
import {
  factOfKind,
  factsOfKind,
  metricValue,
  type DeliveryIndex,
} from '../model/facts';
import {
  branchGlyph,
  stemGlyph,
  CATEGORY_META,
  PERIOD_META,
  PILLAR_KO,
  RELATION_MEANINGS,
  SEONGPAE_KO,
  SHINSAL_MEANINGS,
  TEN_GOD_KO,
  UNSEONG_GLOSS,
} from '../model/saju-labels';
import { fullHangulName, type V3Profile } from '../model/profile';
import {
  ElementBadge,
  Loading,
  QuoteCard,
  Section,
  Stars,
  TermToggle,
  useTerms,
} from '../ui/primitives';

const CATEGORIES: ReportCategoryIdV1[] = [
  'overall',
  'wealth',
  'health',
  'academic',
  'romance',
  'family',
];

const BASE_SURFACES: ReportSurfaceSelectionV1[] = [
  { id: 'saju', depth: 'standard', life: 'summary' },
];

function periodSurfaces(period: CalendarPeriodIdV1): ReportSurfaceSelectionV1[] {
  return [
    {
      id: 'saju',
      depth: 'standard',
      timeline: { periods: [period], categories: CATEGORIES as never },
      life: 'summary',
    },
  ];
}

/* ---------- 원국표 ---------- */

function PillarsTable({ index }: { index: DeliveryIndex }) {
  const pillars = factOfKind(index, 'pillars');
  const unseong = factOfKind(index, 'sibi_unseong');
  const { expert } = useTerms();
  if (!pillars) return null;
  const order = ['year', 'month', 'day', 'hour'] as const;
  const byPosition = new Map(pillars.values.map(value => [value.position, value]));
  const stageByPosition = new Map((unseong?.stages ?? []).map(entry => [entry.position, entry.stage]));
  return (
    <div className="v3-pillars" role="table" aria-label="사주 네 기둥">
      {order.map(position => {
        const pillar = byPosition.get(position);
        if (!pillar) return null;
        const stem = stemGlyph(pillar.stem.code);
        const branch = branchGlyph(pillar.branch.code);
        const stage = stageByPosition.get(position);
        return (
          <div key={position} className="v3-pillar" role="row">
            <span className="v3-hint">{PILLAR_KO[position]}</span>
            <span
              className={`v3-pillar-glyph v3-el-${stem?.element ?? 'none'}`}
              title={stem ? `${pillar.stem.hangul} — ${stem.element}` : undefined}
            >
              {pillar.stem.hangul}
              <small>{pillar.stem.hanja}</small>
            </span>
            <span className={`v3-pillar-glyph v3-el-${branch?.element ?? 'none'}`}>
              {pillar.branch.hangul}
              <small>{pillar.branch.hanja}</small>
            </span>
            {expert && stage ? <span className="v3-badge">{stage}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- 핵심 요약 ---------- */

function CoreCards({ index }: { index: DeliveryIndex }) {
  const dayMaster = factOfKind(index, 'day_master');
  const strength = factOfKind(index, 'strength');
  const yongshin = factOfKind(index, 'yongshin');
  const gyeokguk = factOfKind(index, 'gyeokguk');
  const seongpae = factOfKind(index, 'gyeokguk_seongpae');
  const { expert } = useTerms();
  return (
    <div className="v3-grid-3">
      {dayMaster ? (
        <div className="v3-card">
          <p className="v3-kicker">나를 나타내는 글자</p>
          <p className="v3-core-value">
            {dayMaster.stem}
            {dayMaster.element ? <ElementBadge element={dayMaster.element} suffix="기운" /> : null}
          </p>
          <p className="v3-hint">태어난 날의 하늘 글자(일간)를 기준으로 읽어요.</p>
        </div>
      ) : null}
      {strength ? (
        <div className="v3-card">
          <p className="v3-kicker">기운의 세기</p>
          <p className="v3-core-value">{strength.level}</p>
          <p className="v3-hint">
            {strength.isStrong
              ? '스스로 밀고 나가는 힘이 넉넉한 쪽이에요.'
              : '주변의 도움이 힘이 되어 주는 쪽이에요.'}
          </p>
        </div>
      ) : null}
      {yongshin?.element ? (
        <div className="v3-card">
          <p className="v3-kicker">반기는 기운</p>
          <p className="v3-core-value">
            <ElementBadge element={yongshin.element} suffix="기운" />
          </p>
          <p className="v3-hint">
            {expert
              ? `용신 판단이에요. 방법에 따라 다른 후보가 있을 수 있어요.`
              : '사주의 균형을 맞춰 주는 기운이에요.'}
          </p>
        </div>
      ) : null}
      {gyeokguk ? (
        <div className="v3-card">
          <p className="v3-kicker">사주의 골격</p>
          <p className="v3-core-value">{gyeokguk.type}</p>
          {seongpae ? (
            <p className="v3-hint">
              {SEONGPAE_KO[seongpae.verdict]?.label ?? seongpae.verdict} ·{' '}
              {SEONGPAE_KO[seongpae.verdict]?.gloss}
              {expert && seongpae.sangshin
                ? ` 격을 지켜 주는 글자(상신)는 ${seongpae.sangshin}이에요.`
                : ''}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- 음양 균형 ---------- */

function YinYangCard({ index }: { index: DeliveryIndex }) {
  const balance = factOfKind(index, 'yin_yang_balance');
  if (!balance) return null;
  const total = balance.yang + balance.yin;
  if (total === 0) return null;
  const yangShare = (balance.yang / total) * 100;
  const dominantText =
    balance.dominant === 'EVEN'
      ? '음과 양이 고르게 나뉘어 있어요.'
      : balance.dominant === 'YANG'
        ? '드러내고 움직이는 양의 기운이 더 많아요.'
        : '머금고 다듬는 음의 기운이 더 많아요.';
  return (
    <div className="v3-card">
      <p className="v3-kicker">음양의 저울</p>
      <div className="v3-yinyang-track" aria-hidden="true">
        <div className="v3-yinyang-yang" style={{ width: `${yangShare}%` }} />
      </div>
      <p style={{ margin: '0.5rem 0 0' }}>
        여덟 글자 중 양 {balance.yang} · 음 {balance.yin} — {dominantText}
      </p>
    </div>
  );
}

/* ---------- 구조 인사이트 ---------- */

function InsightQuotes({ index }: { index: DeliveryIndex }) {
  const shinsal = factOfKind(index, 'shinsal_hits');
  const gongmang = factOfKind(index, 'gongmang');
  const relations = factOfKind(index, 'natal_relations');
  const quotes: { key: string; main: string; expertNote?: string; tags?: string[] }[] = [];

  const sortedHits = [...(shinsal?.hits ?? [])].sort((a, b) => {
    const gradeGap = a.grade.localeCompare(b.grade);
    if (gradeGap !== 0) return gradeGap;
    const aKnown = SHINSAL_MEANINGS[a.name] ? 0 : 1;
    const bKnown = SHINSAL_MEANINGS[b.name] ? 0 : 1;
    return aKnown - bKnown;
  });
  for (const hit of sortedHits) {
    const meaning = SHINSAL_MEANINGS[hit.name];
    quotes.push({
      key: `shinsal-${hit.name}-${hit.calculationBasis.label}`,
      main: meaning ? `${hit.name} — ${meaning}` : `${hit.name}이 자리해요.`,
      expertNote: `${hit.calculationBasis.label} 기준 · ${hit.occurrenceCount}곳`,
      tags: ['신살'],
    });
  }
  if (gongmang) {
    quotes.push({
      key: 'gongmang',
      main: `${gongmang.voidBranches[0]}·${gongmang.voidBranches[1]} 자리가 비어 있는 공망이에요. 그 영역은 준비를 한 번 더 하면 든든해요.`,
      expertNote: '일주 기준으로 계산한 빈 자리예요.',
      tags: ['공망'],
    });
  }
  for (const relation of relations?.cheongan ?? []) {
    const gloss = RELATION_MEANINGS[relation.type];
    quotes.push({
      key: `cheongan-${relation.type}-${relation.stems.join('')}`,
      main: `하늘 글자 ${relation.stems.join('과 ')}이(가) ${relation.type} 관계예요. ${gloss ?? ''}`.trim(),
      expertNote: relation.resultElement
        ? `천간 ${relation.type}${relation.resultConfirmed ? ' · 합화 성립' : ''}`
        : `천간 ${relation.type}`,
      tags: ['천간 관계'],
    });
  }
  for (const relation of relations?.jiji ?? []) {
    const gloss = RELATION_MEANINGS[relation.type];
    quotes.push({
      key: `jiji-${relation.type}-${relation.branches.join('')}`,
      main: `땅의 글자 ${relation.branches.join('과 ')}이(가) ${relation.type} 관계예요. ${gloss ?? ''}`.trim(),
      expertNote: relation.outcome ? `지지 ${relation.type} · ${relation.outcome}` : `지지 ${relation.type}`,
      tags: ['지지 관계'],
    });
  }

  if (quotes.length === 0) return null;
  const [head, rest] = [quotes.slice(0, 5), quotes.slice(5)];
  return (
    <>
      {head.map(quote => (
        <QuoteCard key={quote.key} main={quote.main} expertNote={quote.expertNote} tags={quote.tags} />
      ))}
      {rest.length > 0 ? (
        <details style={{ marginTop: '0.6rem' }}>
          <summary className="v3-hint" style={{ cursor: 'pointer' }}>
            나머지 신호 {rest.length}개 더 보기
          </summary>
          <div style={{ marginTop: '0.6rem' }}>
            {rest.map(quote => (
              <QuoteCard key={quote.key} main={quote.main} expertNote={quote.expertNote} tags={quote.tags} />
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

/* ---------- 십성 표 (전문) ---------- */

function TenGodTable({ index }: { index: DeliveryIndex }) {
  const analysis = factOfKind(index, 'ten_god_analysis');
  const { expert } = useTerms();
  if (!analysis || !expert) return null;
  return (
    <div className="v3-card" style={{ overflowX: 'auto' }}>
      <p className="v3-kicker">십성 배치</p>
      <table className="v3-table">
        <thead>
          <tr>
            <th scope="col">구분</th>
            {analysis.positions.map(position => (
              <th key={position.position} scope="col">{PILLAR_KO[position.position]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">천간</th>
            {analysis.positions.map(position => (
              <td key={position.position}>{position.cheongan.label}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">지지</th>
            {analysis.positions.map(position => (
              <td key={position.position}>{position.jijiPrincipal.label}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">지장간</th>
            {analysis.positions.map(position => (
              <td key={position.position} className="v3-hint">
                {position.hiddenStems
                  .map(hidden => `${hidden.stem}(${hidden.tenGod.label})`)
                  .join(' · ')}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="v3-hint" style={{ marginTop: '0.4rem' }}>
        지장간은 땅의 글자 속에 숨어 함께 작용하는 하늘 글자예요.
      </p>
    </div>
  );
}

/* ---------- 대운 이정표 ---------- */

function currentAgeYears(profile: V3Profile): number {
  const birth = new Date(profile.birth.year, profile.birth.month - 1, profile.birth.day);
  return (Date.now() - birth.getTime()) / (365.2425 * 24 * 3600 * 1000);
}

function DaeunRoad({ index, profile }: { index: DeliveryIndex; profile: V3Profile }) {
  const daeun = factOfKind(index, 'daeun_timeline');
  const { expert } = useTerms();
  if (!daeun) return null;
  const age = currentAgeYears(profile);
  const startLabel = daeun.firstStartAgeDisplay ?? Math.round(daeun.firstStartAge);
  return (
    <div className="v3-card">
      <p style={{ margin: '0 0 0.7rem' }}>
        대운은 {startLabel}세 무렵 시작해 10년마다 {daeun.isForward ? '순행' : '역행'}으로
        바뀌어요.
      </p>
      <div className="v3-daeun-road">
        {daeun.periods.map(period => {
          const stem = stemGlyph(period.stem);
          const branch = branchGlyph(period.branch);
          const active = age >= period.startAge && age < period.endAge;
          return (
            <div key={period.order} className={`v3-daeun-stop${active ? ' v3-daeun-stop--now' : ''}`}>
              <span className="v3-hint">
                {Math.round(period.startAge)}세~
              </span>
              <span className="v3-daeun-ganji">
                <span className={`v3-el-${stem?.element ?? 'none'}`}>{stem?.hangul ?? period.stem}</span>
                <span className={`v3-el-${branch?.element ?? 'none'}`}>{branch?.hangul ?? period.branch}</span>
              </span>
              {active ? <span className="v3-badge v3-badge--accent">지금</span> : null}
              {expert ? (
                <span className="v3-hint">
                  {[period.tenGod ? TEN_GOD_KO[period.tenGod] ?? period.tenGod : null, period.lifeStage]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {expert ? (
        <p className="v3-hint" style={{ marginTop: '0.6rem' }}>
          현재 구간의 십성·십이운성을 함께 표시하고 있어요.
          {daeun.periods.some(p => p.lifeStage && UNSEONG_GLOSS[p.lifeStage])
            ? ' 십이운성은 기운이 나고 지는 열두 단계를 뜻해요.'
            : ''}
        </p>
      ) : null}
    </div>
  );
}

/* ---------- 기간 운세 ---------- */

function FortuneCells({ profile, period }: { profile: V3Profile; period: CalendarPeriodIdV1 }) {
  const state = useDelivery(useMemo(() => periodSurfaces(period), [period]));
  if (state.status === 'loading') return <Loading message={`${PERIOD_META[period]}의 흐름을 읽고 있어요…`} />;
  if (state.status === 'error') {
    return <p className="v3-hint">이 기간의 흐름은 지금 불러오지 못했어요.</p>;
  }
  const { index } = state;
  const surface = index.surfaceById.get('saju');
  const timeline = surface?.blocks.find(block => block.kind === 'timeline');
  if (!timeline || timeline.kind !== 'timeline') return null;
  const periodEntry = timeline.periods.find(entry => entry.id === period);
  if (!periodEntry) return null;
  return (
    <div className="v3-fortune-grid">
      {periodEntry.cells.map(cell => {
        const meta = CATEGORY_META[cell.category] ?? { label: cell.category, sub: '' };
        const stars = cell.ratingFactRef ? metricValue(index, cell.ratingFactRef) : null;
        const interpretation = cell.interpretationRef
          ? index.interpretationById.get(cell.interpretationRef)
          : null;
        const paragraphs = interpretation?.standard?.paragraphs ?? [];
        const tips = interpretation?.standard?.livingTips ?? [];
        const cautions = interpretation?.standard?.cautions ?? [];
        return (
          <div key={cell.category} className="v3-card v3-fortune-cell">
            <div className="v3-fortune-cell-head">
              <div>
                <strong>{meta.label}</strong>
                <span className="v3-hint" style={{ marginLeft: '0.4rem' }}>{meta.sub}</span>
              </div>
              {stars !== null ? <Stars value={stars} /> : null}
            </div>
            {interpretation?.brief?.headline ? (
              <p style={{ margin: '0.45rem 0 0' }}>{interpretation.brief.headline}</p>
            ) : null}
            {paragraphs.length > 0 || tips.length > 0 || cautions.length > 0 ? (
              <details style={{ marginTop: '0.45rem' }}>
                <summary className="v3-hint" style={{ cursor: 'pointer' }}>자세히 읽기</summary>
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {paragraphs.map((paragraph, i) => (
                    <p key={i} style={{ margin: 0 }}>{paragraph}</p>
                  ))}
                  {tips.length > 0 ? (
                    <div>
                      <p className="v3-label" style={{ margin: '0 0 0.25rem' }}>이 흐름을 살리는 방법</p>
                      <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                        {tips.map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {cautions.length > 0 ? (
                    <div>
                      <p className="v3-label" style={{ margin: '0 0 0.25rem' }}>한 번 더 살필 점</p>
                      <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                        {cautions.map((caution, i) => (
                          <li key={i}>{caution}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </details>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function LifeSummary({ index }: { index: DeliveryIndex }) {
  const surface = index.surfaceById.get('saju');
  const life = surface?.blocks.find(block => block.kind === 'life_flow');
  if (!life || life.kind !== 'life_flow') return null;
  const interpretation = life.interpretationRef
    ? index.interpretationById.get(life.interpretationRef)
    : null;
  const stars = life.ratingFactRef ? metricValue(index, life.ratingFactRef) : null;
  if (!interpretation && stars === null) return null;
  return (
    <div className="v3-card v3-card--tinted" style={{ marginTop: 'var(--space-sm)' }}>
      <div className="v3-fortune-cell-head">
        <strong>생애 전체의 흐름</strong>
        {stars !== null ? <Stars value={stars} /> : null}
      </div>
      {interpretation?.brief?.headline ? (
        <p style={{ margin: '0.45rem 0 0' }}>{interpretation.brief.headline}</p>
      ) : null}
      {interpretation?.standard?.paragraphs?.map((paragraph, i) => (
        <p key={i} style={{ margin: '0.45rem 0 0' }}>{paragraph}</p>
      ))}
    </div>
  );
}

/* ---------- 화면 ---------- */

export default function SajuScreen() {
  const state = useDelivery(BASE_SURFACES);
  const [period, setPeriod] = useState<CalendarPeriodIdV1>('today');

  if (state.status === 'loading') {
    return (
      <main className="v3-page">
        <Loading message="타고난 기운을 정리하고 있어요…" />
      </main>
    );
  }
  if (state.status === 'error') {
    return (
      <main className="v3-page">
        <div className="v3-card">
          <p style={{ margin: 0 }}>사주 보고서를 준비하지 못했어요. 태어난 정보를 다시 확인해 주시겠어요?</p>
          <Link to="/" className="v3-button" style={{ marginTop: '0.8rem' }}>입력 화면으로</Link>
        </div>
      </main>
    );
  }

  const { index, profile } = state;
  return (
    <main className="v3-page">
      <div className="v3-page-head">
        <p className="v3-kicker">사주 보고서</p>
        <h1 className="v3-page-title">{fullHangulName(profile)}님이 타고난 기운</h1>
        <p className="v3-page-lede">태어난 순간의 네 기둥에서 시작해, 지금의 흐름까지 이어서 봅니다.</p>
      </div>

      <TermToggle />

      <Section title="태어난 순간의 네 기둥">
        <div className="v3-card">
          <PillarsTable index={index} />
        </div>
      </Section>

      <Section title="이 사주의 핵심">
        <CoreCards index={index} />
        <div style={{ marginTop: 'var(--space-sm)' }}>
          <YinYangCard index={index} />
        </div>
      </Section>

      <Section
        title="원국에서 눈에 띄는 신호"
        lede="계산으로 실제 감지된 것만 보여드려요. 좋고 나쁨을 정하는 목록이 아니에요."
      >
        <InsightQuotes index={index} />
        <div style={{ marginTop: 'var(--space-sm)' }}>
          <TenGodTable index={index} />
        </div>
      </Section>

      <Section title="10년 단위의 큰 흐름" lede="대운은 인생을 10년씩 끊어 읽는 긴 호흡의 흐름이에요.">
        <DaeunRoad index={index} profile={profile} />
      </Section>

      <Section title="지금의 흐름">
        <div className="v3-tabs" role="tablist" aria-label="기간 선택">
          {(Object.keys(PERIOD_META) as CalendarPeriodIdV1[]).map(id => (
            <button
              key={id}
              type="button"
              role="tab"
              className="v3-tab"
              aria-selected={period === id}
              onClick={() => setPeriod(id)}
            >
              {PERIOD_META[id]}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 'var(--space-sm)' }}>
          <FortuneCells profile={profile} period={period} />
        </div>
        <LifeSummary index={index} />
      </Section>
    </main>
  );
}
