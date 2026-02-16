import React, { useMemo, useState } from 'react';
import NamingResultRenderer from './NamingResultRenderer';

const ELEMENT_LABEL = {
  Wood: '목',
  Fire: '화',
  Earth: '토',
  Metal: '금',
  Water: '수',
};

function normalizeElement(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'wood' || raw === '목') return 'Wood';
  if (raw === 'fire' || raw === '화') return 'Fire';
  if (raw === 'earth' || raw === '토') return 'Earth';
  if (raw === 'metal' || raw === '금') return 'Metal';
  if (raw === 'water' || raw === '수') return 'Water';
  return '';
}

function elementBadgeClass(element) {
  if (element === 'Wood') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (element === 'Fire') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (element === 'Earth') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (element === 'Metal') return 'border-slate-200 bg-slate-100 text-slate-700';
  if (element === 'Water') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)]';
}

function formatScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return '0.0';
  return score.toFixed(1);
}

function scoreGuideText(score) {
  if (score >= 85) return '이름과 사주의 조화가 매우 안정적이에요.';
  if (score >= 70) return '전반적으로 균형이 좋은 통합 흐름이에요.';
  if (score >= 55) return '무난한 흐름이며 일부 보완 포인트가 있어요.';
  return '보완이 필요한 구간이 보여요. 세부 해석을 확인해 주세요.';
}

function CollapseCard({ title, subtitle, open, onToggle, children }) {
  return (
    <section className="bg-[var(--ns-surface)] rounded-[2rem] border border-[var(--ns-border)] shadow-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-lg font-black text-[var(--ns-accent-text)]">{title}</h3>
          {subtitle ? <p className="text-sm text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">{subtitle}</p> : null}
        </div>
        <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--ns-border)] bg-[var(--ns-surface-soft)]">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className={`w-4 h-4 text-[var(--ns-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </section>
  );
}

function MetaInfoCard({ title, value, tone = 'default' }) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : tone === 'blue'
          ? 'border-blue-200 bg-blue-50 text-blue-800'
          : 'border-[var(--ns-border)] bg-[var(--ns-surface)] text-[var(--ns-muted)]';

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${toneClass}`}>
      <p className="text-[11px] font-black mb-1">{title}</p>
      <p className="text-sm leading-relaxed break-keep whitespace-normal">{value || '-'}</p>
    </div>
  );
}

function CombiedNamingReport({
  springReport,
  onBackCandidates,
  onOpenNamingReport,
  onOpenSajuReport,
}) {
  if (!springReport) return null;

  const [openCards, setOpenCards] = useState({
    saju: true,
    compatibility: true,
    scores: false,
    interpretation: false,
  });

  const namingReport = springReport.namingReport || {};
  const sajuReport = springReport.sajuReport || {};
  const sajuCompatibility = springReport.sajuCompatibility || {};

  const fullHangul = namingReport?.name?.fullHangul || '-';
  const fullHanja = namingReport?.name?.fullHanja || '-';
  const finalScore = Number(springReport.finalScore || 0);

  const normalizedNameElements = useMemo(
    () => (Array.isArray(sajuCompatibility?.nameElements) ? sajuCompatibility.nameElements : [])
      .map((element) => normalizeElement(element))
      .filter(Boolean),
    [sajuCompatibility]
  );

  const yongshinElement = normalizeElement(sajuCompatibility?.yongshinElement || sajuReport?.yongshin?.element);
  const heeshinElement = normalizeElement(sajuCompatibility?.heeshinElement || sajuReport?.yongshin?.heeshin);
  const gishinElement = normalizeElement(sajuCompatibility?.gishinElement || sajuReport?.yongshin?.gishin);

  const dayMasterStem = sajuReport?.dayMaster?.stem || '-';
  const dayMasterElement = normalizeElement(sajuReport?.dayMaster?.element);
  const strengthLevel = sajuReport?.strength?.level || '-';
  const confidence = Number(sajuReport?.yongshin?.confidence ?? 0);
  const recommendationTexts = Array.isArray(sajuReport?.yongshin?.recommendations)
    ? sajuReport.yongshin.recommendations.map((item) => item?.reasoning).filter(Boolean)
    : [];
  const combinedDistributionRows = useMemo(() => {
    const source = springReport?.combinedDistribution || {};
    return ['Wood', 'Fire', 'Earth', 'Metal', 'Water'].map((key) => ({
      key,
      label: ELEMENT_LABEL[key],
      value: Number(source[key] ?? 0),
    }));
  }, [springReport]);
  const combinedDistributionMax = useMemo(() => {
    const values = combinedDistributionRows.map((item) => item.value).filter((value) => Number.isFinite(value));
    const max = values.length ? Math.max(...values) : 0;
    return max > 0 ? max : 1;
  }, [combinedDistributionRows]);
  const nameCardData = useMemo(() => {
    const surnameEntries = Array.isArray(namingReport?.name?.surname) ? namingReport.name.surname : [];
    const givenEntries = Array.isArray(namingReport?.name?.givenName) ? namingReport.name.givenName : [];
    const hangulBlocks = Array.isArray(namingReport?.analysis?.hangul?.blocks) ? namingReport.analysis.hangul.blocks : [];

    return {
      lastName: surnameEntries.map((entry) => ({
        hangul: String(entry?.hangul ?? ''),
        hanja: String(entry?.hanja ?? ''),
        resource_element: String(entry?.element ?? ''),
      })),
      firstName: givenEntries.map((entry) => ({
        hangul: String(entry?.hangul ?? ''),
        hanja: String(entry?.hanja ?? ''),
        resource_element: String(entry?.element ?? ''),
      })),
      totalScore: Number.isFinite(finalScore) ? finalScore : Number(namingReport?.totalScore ?? 0),
      hangul: {
        getNameBlocks: () =>
          hangulBlocks.map((block) => ({
            energy: {
              polarity: {
                english: String(block?.polarity ?? ''),
              },
            },
          })),
      },
    };
  }, [namingReport, finalScore]);

  const toggleCard = (key) => setOpenCards((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 md:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">
              {fullHangul} <span className="text-lg text-[var(--ns-muted)]">({fullHanja})</span>
            </h2>
            <p className="text-sm text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">통합 점수 안내를 포함한 이름·사주 결합 보고서</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-right">
            <p className="text-xs font-black text-emerald-700">통합 점수</p>
            <p className="text-2xl font-black text-emerald-800">{formatScore(finalScore)}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-[var(--ns-muted)] break-keep whitespace-normal">{scoreGuideText(finalScore)}</p>
      </section>

      <section className="h-44 md:h-52">
        <NamingResultRenderer namingResult={nameCardData} />
      </section>

      <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 md:p-4">
        <h3 className="text-lg font-black text-[var(--ns-accent-text)]">통합 오행 지표</h3>
        <p className="text-sm text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">사주 오행과 이름 자원 오행을 합산한 성분 분포예요.</p>
        <div className="mt-3 space-y-2">
          {combinedDistributionRows.map((item) => {
            const widthPercent = Math.max(0, Math.min(100, (item.value / combinedDistributionMax) * 100));
            return (
              <div key={`combined-dist-${item.key}`} className={`rounded-xl border px-3 py-2.5 ${elementBadgeClass(item.key)}`}>
                <div className="flex items-center justify-between text-sm font-black">
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-white/60 overflow-hidden">
                  <div className="h-full rounded-full bg-current" style={{ width: `${widthPercent}%`, opacity: 0.7 }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <CollapseCard
        title="사주 핵심 요약"
        subtitle="일간, 용신, 강약 흐름을 간단히 정리했어요."
        open={openCards.saju}
        onToggle={() => toggleCard('saju')}
      >
        <div className="space-y-2.5">
          <MetaInfoCard title="일간" value={`${dayMasterStem} / ${dayMasterElement ? ELEMENT_LABEL[dayMasterElement] : '-'}`} tone="blue" />
          <MetaInfoCard title="강약" value={String(strengthLevel)} tone="default" />
          <MetaInfoCard title="용신 신뢰도" value={`${Math.round(confidence)}점`} tone="amber" />
          {recommendationTexts.length
            ? <MetaInfoCard title="용신 해석" value={recommendationTexts.join(' ')} tone="emerald" />
            : null}
        </div>
      </CollapseCard>

      <CollapseCard
        title="이름-사주 궁합"
        subtitle="이름 오행과 사주 기준 오행의 맞춤 정도를 보여줘요."
        open={openCards.compatibility}
        onToggle={() => toggleCard('compatibility')}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {normalizedNameElements.length
              ? normalizedNameElements.map((element, index) => (
                <span key={`name-element-${element}-${index}`} className={`px-2.5 py-1 rounded-full border text-xs font-black ${elementBadgeClass(element)}`}>
                  이름 오행 {ELEMENT_LABEL[element]}
                </span>
              ))
              : <span className="text-sm text-[var(--ns-muted)]">이름 오행 정보가 없습니다.</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <MetaInfoCard
              title="용신"
              value={yongshinElement ? ELEMENT_LABEL[yongshinElement] : '-'}
              tone="emerald"
            />
            <MetaInfoCard
              title="희신"
              value={heeshinElement ? ELEMENT_LABEL[heeshinElement] : '-'}
              tone="blue"
            />
            <MetaInfoCard
              title="기신"
              value={gishinElement ? ELEMENT_LABEL[gishinElement] : '-'}
              tone="amber"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <MetaInfoCard title="용신 매칭 수" value={String(sajuCompatibility?.yongshinMatchCount ?? 0)} tone="emerald" />
            <MetaInfoCard title="기신 매칭 수" value={String(sajuCompatibility?.gishinMatchCount ?? 0)} tone="amber" />
            <MetaInfoCard title="궁합 점수" value={formatScore(sajuCompatibility?.affinityScore ?? 0)} tone="blue" />
          </div>
        </div>
      </CollapseCard>

      <CollapseCard
        title="개별 점수"
        subtitle="통합 점수와 성명학 세부 점수예요."
        open={openCards.scores}
        onToggle={() => toggleCard('scores')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">
            통합 점수: {formatScore(finalScore)}
          </div>
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">
            이름 점수: {formatScore(namingReport?.totalScore)}
          </div>
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">
            한글 점수: {formatScore(namingReport?.scores?.hangul)}
          </div>
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">
            한자 점수: {formatScore(namingReport?.scores?.hanja)}
          </div>
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)] md:col-span-2">
            사격수리 점수: {formatScore(namingReport?.scores?.fourFrame)}
          </div>
        </div>
      </CollapseCard>

      <CollapseCard
        title="이름 해석"
        subtitle="성명학 관점에서의 총평 해석이에요."
        open={openCards.interpretation}
        onToggle={() => toggleCard('interpretation')}
      >
        <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-3">
          <p className="text-sm text-[var(--ns-muted)] leading-relaxed break-keep whitespace-normal">
            {namingReport?.interpretation || '해석 정보가 없습니다.'}
          </p>
        </div>
      </CollapseCard>

      <div className="flex gap-4 pt-2">
        <button
          onClick={() => window.print()}
          className="flex-1 py-4 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-2xl font-black text-[var(--ns-muted)] hover:bg-[var(--ns-surface-soft)] active:scale-95 transition-all"
        >
          인쇄하기
        </button>
        <button
          onClick={onBackCandidates}
          className="flex-1 py-4 bg-[var(--ns-primary)] text-[var(--ns-accent-text)] rounded-2xl font-black shadow-lg hover:brightness-95 active:scale-95 transition-all"
        >
          추천 목록으로
        </button>
      </div>

      <section className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-3">
        <p className="text-sm font-black text-[var(--ns-accent-text)]">다른 보고서 보기</p>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenNamingReport}
            className="w-full rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2.5 text-sm font-black text-[var(--ns-muted)] hover:bg-[var(--ns-surface-soft)]"
          >
            이름 평가 보고서
          </button>
          <button
            type="button"
            onClick={onOpenSajuReport}
            className="w-full rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2.5 text-sm font-black text-[var(--ns-muted)] hover:bg-[var(--ns-surface-soft)]"
          >
            사주 평가 보고서
          </button>
        </div>
      </section>
    </div>
  );
}

export default CombiedNamingReport;
