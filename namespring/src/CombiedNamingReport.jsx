import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReportActionButtons,
  ReportPrintOverlay,
  ReportScrollTopFab,
  ReportShareDialog,
  useReportActions,
} from './report-common-ui';
import { CollapsibleCard, CollapsibleMiniCard, StarRating, TimeSeriesChart } from './report-modules-ui';

const PERIOD_FORTUNE_ITEMS = [
  {
    key: 'daily',
    title: '일일 운세',
    score: 3.5,
    trend: [52, 56, 50, 61, 58, 63, 59],
    goodAction: '작은 약속 1개를 끝까지 지키세요.',
    avoidAction: '즉흥적인 소비 결정을 미루세요.',
    warningSignal: '집중력이 떨어져 실수가 늘어날 수 있어요.',
    response: '중요한 일은 오전 1회, 오후 1회 체크리스트로 점검하세요.',
    reason: '오늘은 실행력보다 점검력이 운세 안정에 더 크게 작용하는 흐름입니다.',
  },
  {
    key: 'weekly',
    title: '이번주 운세',
    score: 3.9,
    trend: [48, 51, 55, 57, 62, 65, 64],
    goodAction: '중요 우선순위 3가지를 먼저 확정하세요.',
    avoidAction: '동시에 너무 많은 목표를 시작하지 마세요.',
    warningSignal: '일정 과부하로 피로 누적이 생길 수 있어요.',
    response: '중간 휴식 시간을 일정에 고정해 체력 리듬을 지키세요.',
    reason: '이번주는 확장보다 선택과 집중이 성과를 만드는 주간 흐름입니다.',
  },
  {
    key: 'monthly',
    title: '당월 운세',
    score: 4.1,
    trend: [44, 46, 51, 55, 60, 62, 66, 68],
    goodAction: '협업 관계를 정리하고 연락 루틴을 고정하세요.',
    avoidAction: '오해를 부를 수 있는 모호한 답변을 피하세요.',
    warningSignal: '의사소통 누락으로 일정 차질이 발생할 수 있어요.',
    response: '회의/대화 후 핵심 결론을 3줄로 기록해 공유하세요.',
    reason: '이번 달은 관계의 명확성이 운세 점수 상승을 이끄는 핵심 요인입니다.',
  },
  {
    key: 'yearly',
    title: '당년도 운세',
    score: 3.7,
    trend: [40, 47, 53, 58, 61, 57, 55, 60, 63, 59, 62, 66],
    goodAction: '상반기에는 기반 만들기, 하반기에는 확장에 집중하세요.',
    avoidAction: '초반에 과도한 결과 압박을 두지 마세요.',
    warningSignal: '중반에 동기 저하가 올 수 있어요.',
    response: '분기마다 목표를 재설정하고 달성 기준을 낮게 다시 시작하세요.',
    reason: '연간 흐름은 완만한 상승형이며, 중간 리듬 관리가 성패를 좌우합니다.',
  },
  {
    key: 'lifetime',
    title: '생애 시기 별 운세',
    score: 4.0,
    trend: [35, 42, 52, 63, 70, 68, 62, 67, 74],
    goodAction: '지금은 장기 기반이 되는 역량 축적에 투자하세요.',
    avoidAction: '단기 성과만 보고 장기 계획을 포기하지 마세요.',
    warningSignal: '중기 구간에서 방향 혼란이 올 수 있어요.',
    response: '1년 단위 큰 목표와 3개월 단위 실행 목표를 분리해 운영하세요.',
    reason: '중장기 흐름에서 후반 상승 여력이 높아, 축적 전략이 유리합니다.',
  },
];

const SUMMARY_ITEMS = [
  {
    key: 'saju-card',
    title: '사주팔자 카드',
    subtitle: '핵심 흐름 요약',
    content: '균형형 흐름(안정 65%) · 변동형 흐름(35%)',
    reason: '주요 축이 균형을 유지하지만 시기별 변동 구간이 일부 존재합니다.',
  },
  {
    key: 'life-summary',
    title: '인생 운세 총평',
    subtitle: '장기 흐름',
    content: '초반 신중, 중반 확장, 후반 안정의 흐름입니다.',
    reason: '중간 구간의 상승 곡선이 크고 후반 회복력 지표가 높게 나타납니다.',
  },
  {
    key: 'tendency',
    title: '나의 성향',
    subtitle: '성향 분석',
    content: '성실형 + 문제해결형 성향이 강합니다.',
    reason: '계획 유지력 점수와 실행 완결성 점수가 평균보다 높습니다.',
  },
  {
    key: 'strength-weakness',
    title: '나의 장/단점',
    subtitle: '강점과 리스크',
    content: '장점: 꾸준함 · 단점: 과한 완벽주의',
    reason: '목표 유지 지표는 높지만 시작 지연 신호가 함께 관찰됩니다.',
  },
  {
    key: 'caution',
    title: '유의점',
    subtitle: '반드시 체크',
    content: '결정이 늦어질 때는 24시간 내 1차 결론을 먼저 정하세요.',
    reason: '지연 구간에서 피로가 누적되면 전체 운세 점수 하락폭이 커집니다.',
  },
];

const DOMAIN_FORTUNE_ITEMS = [
  {
    key: 'wealth',
    title: '재물/커리어운',
    score: 4.2,
    advice: '수입 다변화보다 현재 강점 분야의 생산성을 먼저 높이세요.',
    reason: '확장보다 핵심 역량 고도화에서 수익 효율이 커지는 흐름입니다.',
  },
  {
    key: 'health',
    title: '건강운',
    score: 3.6,
    advice: '수면 시간과 식사 시간을 일정하게 고정하세요.',
    reason: '생활 루틴 일관성이 건강 점수에 직접 반영되는 패턴입니다.',
  },
  {
    key: 'study',
    title: '학업운',
    score: 3.8,
    advice: '짧은 집중(25분) + 복습(5분) 사이클을 반복하세요.',
    reason: '단발성 몰입보다 반복 학습 구조가 성취감을 안정적으로 높입니다.',
  },
  {
    key: 'love',
    title: '연애/결혼운',
    score: 4.0,
    advice: '감정 표현을 늦추기보다 타이밍 좋게 먼저 전달해보세요.',
    reason: '관계 운은 상호 피드백 속도에 반응해 선제 소통이 유리합니다.',
  },
  {
    key: 'family',
    title: '가족운',
    score: 3.9,
    advice: '짧은 안부 루틴을 주 2회 이상 유지하세요.',
    reason: '큰 이벤트보다 작은 반복 접촉에서 안정도가 높아지는 흐름입니다.',
  },
];

function DomainRadarChart({ items }) {
  const safe = items.slice(0, 5);
  const center = 110;
  const radius = 82;
  const angleStep = (Math.PI * 2) / 5;

  const points = safe.map((item, idx) => {
    const score = Math.max(0, Math.min(5, Number(item.score) || 0));
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
  springReport,
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

  const prepareBeforePrint = useCallback(() => {
    const previousOpenSections = { ...openSections };
    const previousOpenMini = { ...openMini };
    setOpenSections({ fit: true, summary: true, periods: true, domains: true });
    const expandedMini = {};
    [...SUMMARY_ITEMS, ...PERIOD_FORTUNE_ITEMS, ...DOMAIN_FORTUNE_ITEMS].forEach((item) => {
      expandedMini[item.key] = true;
    });
    setOpenMini(expandedMini);
    return { previousOpenSections, previousOpenMini };
  }, [openSections, openMini]);

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

  const nameLabel = useMemo(() => {
    const fallback = '홍길동 (洪吉童)';
    if (!springReport) return fallback;
    const fullHangul = springReport?.namingReport?.name?.fullHangul;
    const fullHanja = springReport?.namingReport?.name?.fullHanja;
    if (!fullHangul && !fullHanja) return fallback;
    return `${fullHangul || '홍길동'}${fullHanja ? ` (${fullHanja})` : ''}`;
  }, [springReport]);

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
                <StarRating score={4.2} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              {[
                { t: '한 줄 결론', v: '이름과 사주 흐름이 전반적으로 안정적입니다.' },
                { t: '추천 행동', v: '강점 분야를 먼저 실행해 성과를 고정하세요.' },
                { t: '조언 이유', v: '현재 흐름은 분산보다 집중 전략에서 점수 상승 폭이 큽니다.' },
              ].map((item) => (
                <div key={item.t} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)]/70 px-3 py-2">
                  <p className="text-[11px] font-black text-[var(--ns-muted)]">{item.t}</p>
                  <p className="font-semibold text-[var(--ns-text)]">{item.v}</p>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="총평 요약"
          subtitle="어려운 용어를 줄이고, 생활에 바로 적용할 핵심만 요약했습니다."
          open={openSections.summary}
          onToggle={() => toggleSection('summary')}
        >
          <div className="space-y-2.5">
            {SUMMARY_ITEMS.map((item) => (
              <CollapsibleMiniCard
                key={item.key}
                title={item.title}
                subtitle={item.subtitle}
                open={Boolean(openMini[item.key])}
                onToggle={() => toggleMini(item.key)}
              >
                <p className="text-sm font-semibold text-[var(--ns-text)]">{item.content}</p>
                <p className="mt-1 text-xs text-[var(--ns-muted)]">왜: {item.reason}</p>
              </CollapsibleMiniCard>
            ))}
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="기간 별 전체 운세"
          subtitle="각 기간마다 좋은 행동, 피해야 할 행동, 주의 신호 대응을 함께 제공합니다."
          open={openSections.periods}
          onToggle={() => toggleSection('periods')}
        >
          <div className="space-y-2.5">
            {PERIOD_FORTUNE_ITEMS.map((item) => (
              <CollapsibleMiniCard
                key={item.key}
                title={item.title}
                subtitle="시계열 점수 + 행동 조언"
                open={Boolean(openMini[item.key])}
                onToggle={() => toggleMini(item.key)}
              >
                <div className="space-y-2.5">
                  <StarRating score={item.score} />
                  <TimeSeriesChart
                    points={item.trend}
                    valueFormatter={(value) => `${Math.round(value)}`}
                    stroke="var(--ns-tone-info-text)"
                    showPointLabels
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl border border-[var(--ns-tone-success-border)] bg-[var(--ns-tone-success-bg)] px-3 py-2">
                      <p className="text-[11px] font-black text-[var(--ns-tone-success-text)]">좋은 행동</p>
                      <p className="font-semibold text-[var(--ns-text)]">{item.goodAction}</p>
                    </div>
                    <div className="rounded-xl border border-[var(--ns-tone-danger-border)] bg-[var(--ns-tone-danger-bg)] px-3 py-2">
                      <p className="text-[11px] font-black text-[var(--ns-tone-danger-text)]">피해야 할 행동</p>
                      <p className="font-semibold text-[var(--ns-text)]">{item.avoidAction}</p>
                    </div>
                    <div className="rounded-xl border border-[var(--ns-tone-warn-border)] bg-[var(--ns-tone-warn-bg)] px-3 py-2 md:col-span-2">
                      <p className="text-[11px] font-black text-[var(--ns-tone-warn-text)]">주의 신호 · 대응</p>
                      <p className="font-semibold text-[var(--ns-text)]">{item.warningSignal}</p>
                      <p className="mt-1 text-sm text-[var(--ns-text)]">대응: {item.response}</p>
                    </div>
                    <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2 md:col-span-2">
                      <p className="text-[11px] font-black text-[var(--ns-muted)]">왜 이런 조언인가요?</p>
                      <p className="font-semibold text-[var(--ns-text)]">{item.reason}</p>
                    </div>
                  </div>
                </div>
              </CollapsibleMiniCard>
            ))}
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="5대 분야별 운세"
          subtitle="분야별 별점과 실행 조언을 함께 확인하세요."
          open={openSections.domains}
          onToggle={() => toggleSection('domains')}
        >
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3">
            <DomainRadarChart items={DOMAIN_FORTUNE_ITEMS} />
            <div className="space-y-2.5">
              {DOMAIN_FORTUNE_ITEMS.map((item) => (
                <CollapsibleMiniCard
                  key={item.key}
                  title={item.title}
                  subtitle="분야별 실행 조언"
                  open={Boolean(openMini[item.key])}
                  onToggle={() => toggleMini(item.key)}
                >
                  <StarRating score={item.score} />
                  <p className="mt-1 text-sm font-semibold text-[var(--ns-text)]">{item.advice}</p>
                  <p className="mt-1 text-xs text-[var(--ns-muted)]">왜: {item.reason}</p>
                </CollapsibleMiniCard>
              ))}
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
