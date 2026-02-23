import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReportActionButtons,
  ReportPrintOverlay,
  ReportScrollTopFab,
  ReportShareDialog,
  useReportActions,
} from './report-common-ui';
import { CollapsibleCard, CollapsibleMiniCard, StarRating, TimeSeriesChart } from './report-modules-ui';

const CATEGORY_ORDER = ['wealth', 'health', 'academic', 'romance', 'family'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toStars(value) {
  return clamp(Number(value) || 0, 1, 5);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function joinNameText(items, key) {
  return asArray(items).map((item) => String(item?.[key] ?? '')).join('');
}

function getNameLabelFromUserInfo(shareUserInfo) {
  const fullHangul = `${joinNameText(shareUserInfo?.lastName, 'hangul')}${joinNameText(shareUserInfo?.firstName, 'hangul')}`;
  const fullHanja = `${joinNameText(shareUserInfo?.lastName, 'hanja')}${joinNameText(shareUserInfo?.firstName, 'hanja')}`;
  if (!fullHangul && !fullHanja) return '이름 정보 없음';
  return `${fullHangul || '-'}${fullHanja ? ` (${fullHanja})` : ''}`;
}

function buildMiniKey(section, key) {
  return `${section}:${key}`;
}

function periodTrendFromCard(card) {
  const stars = toStars(card?.stars);
  const categoryScores = CATEGORY_ORDER
    .map((category) => Number(card?.categoryScores?.[category]) || stars)
    .map((score) => clamp(Math.round(score * 20), 20, 100));

  if (card?.periodKind === 'daily') {
    const seed = categoryScores[0] ?? 60;
    return [seed - 4, seed + 3, seed - 2, categoryScores[1] ?? seed, seed + 1, categoryScores[2] ?? seed, seed]
      .map((value) => clamp(value, 20, 100));
  }
  if (card?.periodKind === 'weekly') {
    const a = categoryScores[0] ?? 60;
    const b = categoryScores[1] ?? 60;
    const c = categoryScores[2] ?? 60;
    const d = categoryScores[3] ?? 60;
    const e = categoryScores[4] ?? 60;
    return [a, b, c, d, e, Math.round((b + d) / 2), Math.round((a + e) / 2)].map((v) => clamp(v, 20, 100));
  }
  if (card?.periodKind === 'monthly') {
    const base = clamp(Math.round(stars * 20), 20, 100);
    return [base - 8, base - 3, base + 2, base + 5, base + 1, base + 4, base + 7, base + 3].map((v) => clamp(v, 20, 100));
  }
  if (card?.periodKind === 'yearly') {
    const base = clamp(Math.round(stars * 20), 20, 100);
    return [
      base - 9,
      base - 5,
      base - 2,
      base + 1,
      base + 4,
      base + 2,
      base,
      base + 3,
      base + 5,
      base + 2,
      base + 4,
      base + 6,
    ].map((v) => clamp(v, 20, 100));
  }
  return categoryScores.length ? categoryScores : [60, 62, 58, 64, 61];
}

function lifeStageTrend(card) {
  const stages = asArray(card?.stages);
  if (!stages.length) return [60, 62, 58, 64, 61];
  return stages.map((stage) => clamp(Math.round(toStars(stage?.stars) * 20), 20, 100));
}

function DomainRadarChart({ items }) {
  const safe = asArray(items).slice(0, 5);
  if (!safe.length) return null;

  const center = 110;
  const radius = 82;
  const angleStep = (Math.PI * 2) / 5;

  const points = safe.map((item, idx) => {
    const score = toStars(item?.stars);
    const ratio = score / 5;
    const angle = -Math.PI / 2 + idx * angleStep;
    const x = center + Math.cos(angle) * radius * ratio;
    const y = center + Math.sin(angle) * radius * ratio;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const ring = [0.25, 0.5, 0.75, 1].map((r) => {
    const p = safe.map((_, idx) => {
      const angle = -Math.PI / 2 + idx * angleStep;
      const x = center + Math.cos(angle) * radius * r;
      const y = center + Math.sin(angle) * radius * r;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return p;
  });

  return (
    <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)]/55 p-2">
      <svg viewBox="0 0 220 220" className="w-full h-56">
        {ring.map((poly, idx) => (
          <polygon key={`ring-${idx}`} points={poly} fill="none" stroke="var(--ns-border)" strokeWidth="1" />
        ))}
        <polygon points={points} fill="var(--ns-tone-info-bg)" fillOpacity="0.4" stroke="var(--ns-tone-info-text)" strokeWidth="2" />
      </svg>
    </div>
  );
}

function CombiedNamingReport({
  fortuneReport,
  onOpenNamingReport,
  onOpenSajuReport,
  shareUserInfo = null,
}) {
  const reportRootRef = useRef(null);
  const [openSections, setOpenSections] = useState({
    fit: false,
    summary: false,
    periods: false,
    domains: false,
  });
  const [openMini, setOpenMini] = useState({});

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleMini = (key) => {
    setOpenMini((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const summaryCards = useMemo(() => {
    const overview = fortuneReport?.overviewSummary;
    const life = fortuneReport?.lifeFortuneOverview;
    const personality = fortuneReport?.personality;
    const strengths = fortuneReport?.strengthsWeaknesses;
    const cautions = fortuneReport?.cautions;

    return [
      {
        key: 'saju-card',
        title: '사주팔자 카드',
        subtitle: '핵심 구조 요약',
        body: (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--ns-text)]">{overview?.overallSummary || '-'}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {asArray(overview?.pillars).map((pillar, index) => (
                <div key={`pillar-${index}`} className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-2">
                  <p className="font-black text-[var(--ns-muted)]">{pillar?.position || `기둥 ${index + 1}`}</p>
                  <p className="font-semibold text-[var(--ns-text)]">{`${pillar?.stem || '-'}${pillar?.branch || '-'}`}</p>
                  <p className="text-[var(--ns-muted)]">{pillar?.element || '-'}</p>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        key: 'life-summary',
        title: '인생 운세 총평',
        subtitle: life?.title || '장기 흐름',
        body: (
          <div className="space-y-2">
            <StarRating score={toStars(life?.stars)} />
            <p className="text-sm font-semibold text-[var(--ns-text)]">{life?.summary || '-'}</p>
            {asArray(life?.highlights).length ? (
              <div className="space-y-1">
                {asArray(life?.highlights).map((line, index) => (
                  <p key={`life-highlight-${index}`} className="text-xs text-[var(--ns-muted)]">{`- ${line}`}</p>
                ))}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        key: 'tendency',
        title: '나의 성향',
        subtitle: '핵심 특성',
        body: (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--ns-text)]">{personality?.summary || '-'}</p>
            <div className="space-y-1.5">
              {asArray(personality?.traits).map((trait, index) => (
                <div key={`trait-${index}`} className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-2">
                  <p className="text-xs font-black text-[var(--ns-accent-text)]">{trait?.trait || '-'}</p>
                  <p className="text-sm font-semibold text-[var(--ns-text)]">{trait?.description || '-'}</p>
                  <p className="text-[11px] text-[var(--ns-muted)]">근거: {trait?.source || '-'}</p>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        key: 'strength-weakness',
        title: '나의 장/단점',
        subtitle: '강점과 보완점',
        body: (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="rounded-lg border border-[var(--ns-tone-success-border)] bg-[var(--ns-tone-success-bg)] px-2.5 py-2 space-y-1.5">
              <p className="text-xs font-black text-[var(--ns-tone-success-text)]">강점</p>
              {asArray(strengths?.strengths).map((item, index) => (
                <div key={`strength-${index}`}>
                  <p className="text-sm font-semibold text-[var(--ns-text)]">{item?.text || '-'}</p>
                  <p className="text-[11px] text-[var(--ns-muted)]">이유: {item?.reason || '-'}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-[var(--ns-tone-danger-border)] bg-[var(--ns-tone-danger-bg)] px-2.5 py-2 space-y-1.5">
              <p className="text-xs font-black text-[var(--ns-tone-danger-text)]">보완점</p>
              {asArray(strengths?.weaknesses).map((item, index) => (
                <div key={`weakness-${index}`}>
                  <p className="text-sm font-semibold text-[var(--ns-text)]">{item?.text || '-'}</p>
                  <p className="text-[11px] text-[var(--ns-muted)]">이유: {item?.reason || '-'}</p>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        key: 'caution',
        title: '유의점',
        subtitle: '주의 신호와 대응',
        body: (
          <div className="space-y-1.5">
            {asArray(cautions?.cautions).map((item, index) => (
              <div key={`caution-${index}`} className="rounded-lg border border-[var(--ns-tone-warn-border)] bg-[var(--ns-tone-warn-bg)] px-2.5 py-2">
                <p className="text-sm font-semibold text-[var(--ns-text)]">신호: {item?.signal || '-'}</p>
                <p className="text-sm text-[var(--ns-text)]">대응: {item?.response || '-'}</p>
                <p className="text-[11px] text-[var(--ns-muted)]">이유: {item?.reason || '-'}</p>
              </div>
            ))}
          </div>
        ),
      },
    ];
  }, [fortuneReport]);

  const periodCards = useMemo(() => {
    const daily = fortuneReport?.dailyFortune;
    const weekly = fortuneReport?.weeklyFortune;
    const monthly = fortuneReport?.monthlyFortune;
    const yearly = fortuneReport?.yearlyFortune;
    return [daily, weekly, monthly, yearly].filter(Boolean);
  }, [fortuneReport]);

  const categoryCards = useMemo(() => {
    const cards = fortuneReport?.categoryFortunes || {};
    return CATEGORY_ORDER.map((key) => cards[key]).filter(Boolean);
  }, [fortuneReport]);

  const allMiniKeys = useMemo(() => {
    const keys = [];
    summaryCards.forEach((item) => keys.push(buildMiniKey('summary', item.key)));
    periodCards.forEach((item, index) => keys.push(buildMiniKey('period', item?.periodKind || String(index))));
    keys.push(buildMiniKey('period', 'life-stage'));
    categoryCards.forEach((item, index) => keys.push(buildMiniKey('domain', item?.category || String(index))));
    return keys;
  }, [summaryCards, periodCards, categoryCards]);

  const prepareBeforePrint = useCallback(() => {
    const previousOpenSections = { ...openSections };
    const previousOpenMini = { ...openMini };
    setOpenSections({ fit: true, summary: true, periods: true, domains: true });

    const expandedMini = {};
    allMiniKeys.forEach((key) => {
      expandedMini[key] = true;
    });
    setOpenMini(expandedMini);

    return { previousOpenSections, previousOpenMini };
  }, [allMiniKeys, openMini, openSections]);

  const restoreAfterPrint = useCallback((payload) => {
    if (!payload) return;
    setOpenSections(payload.previousOpenSections || { fit: false, summary: false, periods: false, domains: false });
    setOpenMini(payload.previousOpenMini || {});
  }, []);

  const {
    isPdfSaving,
    isShareDialogOpen,
    shareLink,
    isLinkCopied,
    handleSavePdf,
    handleOpenShareDialog,
    closeShareDialog,
    handleCopyShareLink,
  } = useReportActions({
    reportRootRef,
    shareUserInfo,
    prepareBeforePrint,
    restoreAfterPrint,
  });

  const nameLabel = useMemo(() => getNameLabelFromUserInfo(shareUserInfo), [shareUserInfo]);

  const nameCompatibility = fortuneReport?.nameCompatibility;
  const lifeStageFortune = fortuneReport?.lifeStageFortune;

  return (
    <>
      <div ref={reportRootRef} data-pdf-root="true" className="space-y-4">
        <CollapsibleCard
          title="이름 적합도 평가"
          subtitle="사주와 성명학을 함께 고려한 결과 카드입니다."
          open={openSections.fit}
          onToggle={() => toggleSection('fit')}
        >
          <div className="rounded-2xl border border-[var(--ns-tone-success-border)] bg-[var(--ns-tone-success-bg)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-[var(--ns-tone-success-text)]">이름 적합도 결과</p>
                <h2 className="mt-1 text-2xl font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">{nameLabel}</h2>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-[var(--ns-tone-success-text)]">종합 별점</p>
                <StarRating score={toStars(nameCompatibility?.overallStars || 3)} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)]/70 px-3 py-2">
                <p className="text-[11px] font-black text-[var(--ns-muted)]">한 줄 결론</p>
                <p className="font-semibold text-[var(--ns-text)]">{nameCompatibility?.summary || '이름 적합도 분석 결과를 준비 중입니다.'}</p>
              </div>
              <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)]/70 px-3 py-2">
                <p className="text-[11px] font-black text-[var(--ns-muted)]">핵심 점수</p>
                <p className="font-semibold text-[var(--ns-text)]">{`종합 ${Math.round(Number(nameCompatibility?.overallScore) || 0)} / 사주 ${Math.round(Number(nameCompatibility?.sajuCompatibilityScore) || 0)} / 이름 ${Math.round(Number(nameCompatibility?.nameAnalysisScore) || 0)}`}</p>
              </div>
              <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)]/70 px-3 py-2">
                <p className="text-[11px] font-black text-[var(--ns-muted)]">조언 이유</p>
                <p className="font-semibold text-[var(--ns-text)]">{asArray(nameCompatibility?.details)[0] || '세부 설명이 준비 중입니다.'}</p>
              </div>
            </div>
            {asArray(nameCompatibility?.details).length > 1 ? (
              <div className="mt-2 space-y-1">
                {asArray(nameCompatibility?.details).slice(1).map((line, index) => (
                  <p key={`name-detail-${index}`} className="text-xs text-[var(--ns-muted)]">{`- ${line}`}</p>
                ))}
              </div>
            ) : null}
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="총평 요약"
          subtitle="전문 용어를 줄이고, 이해하기 쉬운 핵심만 모았습니다."
          open={openSections.summary}
          onToggle={() => toggleSection('summary')}
        >
          <div className="space-y-2.5">
            {summaryCards.map((item) => {
              const key = buildMiniKey('summary', item.key);
              return (
                <CollapsibleMiniCard
                  key={key}
                  title={item.title}
                  subtitle={item.subtitle}
                  open={Boolean(openMini[key])}
                  onToggle={() => toggleMini(key)}
                >
                  {item.body}
                </CollapsibleMiniCard>
              );
            })}
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="기간 별 전체 운세"
          subtitle="기간별 점수, 좋은 행동/피해야 할 행동, 주의 신호 대응을 함께 제공합니다."
          open={openSections.periods}
          onToggle={() => toggleSection('periods')}
        >
          <div className="space-y-2.5">
            {periodCards.map((item, index) => {
              const miniKey = buildMiniKey('period', item?.periodKind || String(index));
              const trend = periodTrendFromCard(item);
              return (
                <CollapsibleMiniCard
                  key={miniKey}
                  title={item?.title || '운세'}
                  subtitle={item?.periodLabel || '기간 정보 없음'}
                  open={Boolean(openMini[miniKey])}
                  onToggle={() => toggleMini(miniKey)}
                >
                  <div className="space-y-2.5">
                    <StarRating score={toStars(item?.stars)} />
                    <p className="text-sm font-semibold text-[var(--ns-text)]">{item?.summary || '-'}</p>
                    <TimeSeriesChart
                      points={trend}
                      valueFormatter={(value) => `${Math.round(value)}`}
                      stroke="var(--ns-tone-info-text)"
                      showPointLabels
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl border border-[var(--ns-tone-success-border)] bg-[var(--ns-tone-success-bg)] px-3 py-2 space-y-1.5">
                        <p className="text-[11px] font-black text-[var(--ns-tone-success-text)]">좋은 행동</p>
                        {asArray(item?.goodActions).map((advice, adviceIndex) => (
                          <div key={`good-${miniKey}-${adviceIndex}`}>
                            <p className="font-semibold text-[var(--ns-text)]">{advice?.text || '-'}</p>
                            <p className="text-[11px] text-[var(--ns-muted)]">이유: {advice?.reason || '-'}</p>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-xl border border-[var(--ns-tone-danger-border)] bg-[var(--ns-tone-danger-bg)] px-3 py-2 space-y-1.5">
                        <p className="text-[11px] font-black text-[var(--ns-tone-danger-text)]">피해야 할 행동</p>
                        {asArray(item?.badActions).map((advice, adviceIndex) => (
                          <div key={`bad-${miniKey}-${adviceIndex}`}>
                            <p className="font-semibold text-[var(--ns-text)]">{advice?.text || '-'}</p>
                            <p className="text-[11px] text-[var(--ns-muted)]">이유: {advice?.reason || '-'}</p>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-xl border border-[var(--ns-tone-warn-border)] bg-[var(--ns-tone-warn-bg)] px-3 py-2 md:col-span-2">
                        <p className="text-[11px] font-black text-[var(--ns-tone-warn-text)]">주의 신호 · 대응</p>
                        <p className="font-semibold text-[var(--ns-text)]">신호: {item?.warning?.signal || '-'}</p>
                        <p className="text-sm text-[var(--ns-text)]">대응: {item?.warning?.response || '-'}</p>
                        <p className="text-xs text-[var(--ns-muted)]">이유: {item?.warning?.reason || '-'}</p>
                      </div>
                    </div>
                  </div>
                </CollapsibleMiniCard>
              );
            })}

            <CollapsibleMiniCard
              title={lifeStageFortune?.title || '생애 시기별 운세'}
              subtitle="연령대별 운세 흐름"
              open={Boolean(openMini[buildMiniKey('period', 'life-stage')])}
              onToggle={() => toggleMini(buildMiniKey('period', 'life-stage'))}
            >
              <div className="space-y-2.5">
                <TimeSeriesChart
                  points={lifeStageTrend(lifeStageFortune)}
                  valueFormatter={(value) => `${Math.round(value)}`}
                  stroke="var(--ns-tone-info-text)"
                  showPointLabels
                />
                <div className="space-y-1.5">
                  {asArray(lifeStageFortune?.stages).map((stage, stageIndex) => {
                    const isCurrent = Number(lifeStageFortune?.currentStageIndex) === stageIndex;
                    return (
                      <div
                        key={`stage-${stageIndex}`}
                        className={`rounded-lg border px-2.5 py-2 ${isCurrent ? 'border-[var(--ns-tone-success-border)] bg-[var(--ns-tone-success-bg)]' : 'border-[var(--ns-border)] bg-[var(--ns-surface)]'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-[var(--ns-accent-text)]">{`${stage?.ageRange || '-'} · ${stage?.pillarDisplay || '-'}`}</p>
                          <StarRating score={toStars(stage?.stars)} />
                        </div>
                        <p className="mt-1 text-sm font-semibold text-[var(--ns-text)]">{stage?.summary || '-'}</p>
                        {asArray(stage?.highlights).map((line, lineIndex) => (
                          <p key={`stage-highlight-${stageIndex}-${lineIndex}`} className="text-xs text-[var(--ns-muted)]">{`- ${line}`}</p>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CollapsibleMiniCard>
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="5대 분야별 운세"
          subtitle="분야별 별점과 실행 조언을 함께 확인하세요."
          open={openSections.domains}
          onToggle={() => toggleSection('domains')}
        >
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3">
            <DomainRadarChart items={categoryCards} />
            <div className="space-y-2.5">
              {categoryCards.map((item, index) => {
                const key = buildMiniKey('domain', item?.category || String(index));
                return (
                  <CollapsibleMiniCard
                    key={key}
                    title={item?.title || '분야 운세'}
                    subtitle="분야별 실행 조언"
                    open={Boolean(openMini[key])}
                    onToggle={() => toggleMini(key)}
                  >
                    <div className="space-y-2">
                      <StarRating score={toStars(item?.stars)} />
                      <p className="text-sm font-semibold text-[var(--ns-text)]">{item?.summary || '-'}</p>
                      <div className="space-y-1.5">
                        {asArray(item?.advice).map((advice, adviceIndex) => (
                          <div key={`domain-advice-${index}-${adviceIndex}`} className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-2">
                            <p className="text-sm font-semibold text-[var(--ns-text)]">{advice?.text || '-'}</p>
                            <p className="text-[11px] text-[var(--ns-muted)]">이유: {advice?.reason || '-'}</p>
                          </div>
                        ))}
                      </div>
                      {item?.caution ? (
                        <div className="rounded-lg border border-[var(--ns-tone-warn-border)] bg-[var(--ns-tone-warn-bg)] px-2.5 py-2">
                          <p className="text-sm font-semibold text-[var(--ns-text)]">주의: {item.caution.signal}</p>
                          <p className="text-sm text-[var(--ns-text)]">대응: {item.caution.response}</p>
                          <p className="text-[11px] text-[var(--ns-muted)]">이유: {item.caution.reason}</p>
                        </div>
                      ) : null}
                    </div>
                  </CollapsibleMiniCard>
                );
              })}
            </div>
          </div>
        </CollapsibleCard>

        <section className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-3">
          <p className="text-sm font-black text-[var(--ns-accent-text)]">다른 보고서 보기</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenNamingReport}
              className="w-full rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-3 text-left hover:bg-[var(--ns-surface-soft)] transition-colors"
            >
              <span className="inline-flex items-center gap-1.5 text-sm font-black text-[var(--ns-accent-text)]">이름 평가 보고서</span>
              <span className="mt-1 block text-[11px] leading-relaxed font-semibold text-[var(--ns-muted)]">성명학 중심 상세 결과를 확인합니다.</span>
            </button>
            <button
              type="button"
              onClick={onOpenSajuReport}
              className="w-full rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-3 text-left hover:bg-[var(--ns-surface-soft)] transition-colors"
            >
              <span className="inline-flex items-center gap-1.5 text-sm font-black text-[var(--ns-accent-text)]">사주 평가 보고서</span>
              <span className="mt-1 block text-[11px] leading-relaxed font-semibold text-[var(--ns-muted)]">사주 중심 상세 결과를 확인합니다.</span>
            </button>
          </div>
        </section>

        <ReportActionButtons
          isPdfSaving={isPdfSaving}
          onSavePdf={handleSavePdf}
          onShare={handleOpenShareDialog}
        />
      </div>

      <ReportPrintOverlay isPdfSaving={isPdfSaving} />
      <ReportShareDialog
        isOpen={isShareDialogOpen}
        shareLink={shareLink}
        isLinkCopied={isLinkCopied}
        onCopy={handleCopyShareLink}
        onClose={closeShareDialog}
      />
      <ReportScrollTopFab />
    </>
  );
}

export default CombiedNamingReport;
