import React, { useRef } from 'react';
import NamingResultRenderer from './NamingResultRenderer';
import {
  ReportActionButtons,
  ReportPrintOverlay,
  ReportScrollTopFab,
  ReportShareDialog,
  useReportActions,
} from './report-common-ui';
import useIntegratedReportData from './integrated-report/useIntegratedReportData';
import {
  ELEMENT_LABEL,
  formatScore, scoreColor, scoreBgColor, elShort, elementBadgeClass,
} from './integrated-report/constants';
import SectionCoreCompat from './integrated-report/SectionCoreCompat';
import SectionResourceElement from './integrated-report/SectionResourceElement';
import SectionFourFrameLuck from './integrated-report/SectionFourFrameLuck';
import SectionYinYangHarmony from './integrated-report/SectionYinYangHarmony';
import SectionSajuStructure from './integrated-report/SectionSajuStructure';
import SectionCombinedInsights from './integrated-report/SectionCombinedInsights';
import SectionElementBalance from './integrated-report/SectionElementBalance';

// ─────────────────────────────────────────────────────────────────────────────
//  메인 오케스트레이터
// ─────────────────────────────────────────────────────────────────────────────

function IntegratedReportView({
  springReport,
  candidates = [],
  onOpenNamingReport = null,
  onOpenSajuReport = null,
  shareUserInfo = null,
}) {
  const reportRootRef = useRef(null);

  const data = useIntegratedReportData(springReport, candidates);

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
    prepareBeforePrint: data.prepareBeforePrint,
    restoreAfterPrint: data.restoreAfterPrint,
  });

  if (!springReport) return null;

  return (
    <>
      <div ref={reportRootRef} data-pdf-root="true" className="space-y-5">

        {/* ═══ 1. 헤더: 이름카드 + 통합점수 + 판정 ═══ */}
        <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-black text-[var(--ns-accent-text)] break-keep">
                {data.fullHangul} <span className="text-lg text-[var(--ns-muted)]">({data.fullHanja})</span>
              </h2>
              <p className="text-xs text-[var(--ns-muted)] mt-1">
                일간 {data.dayMasterStem}{data.dayMasterElement ? ` (${ELEMENT_LABEL[data.dayMasterElement]})` : ''} · {data.strengthLevel}
              </p>
              {/* 이름 인기도/성별 경향 */}
              {(data.popularityRank != null || data.nameGender) ? (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {data.popularityRank != null ? (
                    <span className="px-2 py-0.5 rounded-full border border-[var(--ns-border)] bg-[var(--ns-surface)] text-[10px] font-black text-[var(--ns-muted)]">
                      인기도 {Math.round(data.popularityRank).toLocaleString()}위
                    </span>
                  ) : null}
                  {data.nameGender && data.nameGender !== 'unknown' && data.maleRatio != null ? (
                    <span className="px-2 py-0.5 rounded-full border border-[var(--ns-border)] bg-[var(--ns-surface)] text-[10px] font-black text-[var(--ns-muted)]">
                      {data.nameGender === 'male' ? '남성' : '여성'} 이름 경향
                      {` (${(data.nameGender === 'male' ? data.maleRatio * 100 : (1 - data.maleRatio) * 100).toFixed(1)}%)`}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className={`rounded-xl border px-3 py-2 text-right ${scoreBgColor(data.finalScore)}`}>
              <p className="text-[10px] font-black opacity-70">통합 점수</p>
              <p className={`text-2xl font-black ${scoreColor(data.finalScore)}`}>{formatScore(data.finalScore)}</p>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2.5">
            <p className="text-sm leading-relaxed break-keep text-[var(--ns-text)]">
              {data.verdictLine}
            </p>
          </div>
        </section>

        {/* ═══ 2. 이름 비주얼 카드 ═══ */}
        <section className="h-44 md:h-52">
          <NamingResultRenderer
            renderMetrics={data.nameCardRenderMetrics}
            birthDateTime={shareUserInfo?.birthDateTime ?? null}
            gender={shareUserInfo?.gender}
            isSolarCalendar={shareUserInfo?.isSolarCalendar}
            isBirthTimeUnknown={shareUserInfo?.isBirthTimeUnknown}
          />
        </section>

        {/* ═══ 3. 핵심 궁합 (확장: 소점수 뱃지 추가) ═══ */}
        <SectionCoreCompat
          yongshinEl={data.yongshinEl}
          heeshinEl={data.heeshinEl}
          gishinEl={data.gishinEl}
          nameElements={data.nameElements}
          yongshinNameRelation={data.yongshinNameRelation}
          harmonySummary={data.insights?.elementHarmonySummary}
          subScores={data.subScores}
        />

        {/* ═══ 4. 자원오행 상세 (신규) ═══ */}
        <SectionResourceElement
          resourceElementDetails={data.resourceElementDetails}
        />

        {/* ═══ 5. 사격수리 운세 (신규) ═══ */}
        <SectionFourFrameLuck
          fourFrameAnalysis={data.fourFrameAnalysis}
          fullHangul={data.fullHangul}
        />

        {/* ═══ 6. 음양 조화 (신규) ═══ */}
        <SectionYinYangHarmony
          yinYangHarmony={data.yinYangHarmony}
        />

        {/* ═══ 7. 사주 체질과 이름 (신규) ═══ */}
        <SectionSajuStructure
          sajuStructureInsight={data.sajuStructureInsight}
          strengthDetails={data.strengthDetails}
          gyeokgukDetail={data.gyeokgukDetail}
        />

        {/* ═══ 8. 종합 인사이트 (합병: 시너지+발음오행+주의) ═══ */}
        <SectionCombinedInsights
          insights={data.insights}
          pronunciationFlow={data.pronunciationFlow}
        />

        {/* ═══ 9. 오행 밸런스 (확장: 결핍/과다 뱃지) ═══ */}
        <SectionElementBalance
          combinedDistributionRows={data.combinedDistributionRows}
          combinedDistMax={data.combinedDistMax}
          deficientElements={data.deficientElements}
          excessiveElements={data.excessiveElements}
        />

        {/* ═══ 10. 실천 가이드 ═══ */}
        <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-4">
          <div className="mb-3">
            <h3 className="text-lg font-black text-[var(--ns-accent-text)]">실천 가이드</h3>
            <p className="text-sm text-[var(--ns-muted)] mt-0.5 break-keep">사주와 이름 분석을 결합한 오늘의 실천 제안이에요.</p>
          </div>
          <div className="space-y-2">
            {(data.insights?.dailyActionSuggestions || []).map((text, i) => (
              <div key={`action-${i}`} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2.5 flex items-start gap-2.5">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--ns-primary)] text-[var(--ns-accent-text)] text-xs font-black flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed break-keep text-[var(--ns-text)]">{text}</p>
              </div>
            ))}
          </div>

          {/* 용신 기반 실천 추천 */}
          {data.yongshinRecommendations.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-black text-[var(--ns-muted)] mb-2">용신 기반 보완 추천</p>
              <div className="space-y-1.5">
                {data.yongshinRecommendations.map((rec, i) => (
                  <div key={`yong-rec-${i}`} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-full border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[10px] font-black text-[var(--ns-muted)]">
                        {rec.type || '보완'}
                      </span>
                      {rec.primaryElement ? (
                        <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-black ${elementBadgeClass(rec.primaryElement)}`}>
                          {elShort(rec.primaryElement)}
                        </span>
                      ) : null}
                    </div>
                    {rec.reasoning ? (
                      <p className="text-sm text-[var(--ns-text)] leading-relaxed break-keep">{rec.reasoning}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* ═══ 종합 점수가 더 높은 이름 후보 ═══ */}
        {data.betterCandidates.length > 0 ? (
          <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-4">
            <div className="mb-3">
              <h3 className="text-lg font-black text-[var(--ns-accent-text)]">함께 고려해볼 이름 후보</h3>
              <p className="text-sm text-[var(--ns-muted)] mt-0.5 break-keep">
                작명 후보 중 현재 이름({formatScore(data.finalScore)}점)보다 종합 점수가 높은 이름이에요.
              </p>
            </div>
            <div className="space-y-2">
              {data.betterCandidates.map((c, i) => (
                <div key={`alt-${i}`} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="shrink-0 w-7 h-7 rounded-full border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)] text-xs font-black flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-black text-[var(--ns-accent-text)]">
                        {c.fullHangul}
                        {c.fullHanja ? <span className="text-xs text-[var(--ns-muted)] ml-1">({c.fullHanja})</span> : null}
                      </p>
                    </div>
                  </div>
                  <div className={`rounded-lg border px-2 py-1 text-right ${scoreBgColor(c.finalScore)}`}>
                    <p className={`text-sm font-black ${scoreColor(c.finalScore)}`}>{formatScore(c.finalScore)}</p>
                  </div>
                </div>
              ))}
              <p className="text-xs text-[var(--ns-muted)] mt-1 break-keep">
                점수는 사주 용신 부합, 오행 균형, 수리 격국 등을 종합한 통합 점수입니다.
              </p>
            </div>
          </section>
        ) : null}

        {/* ═══ 다른 보고서 링크 ═══ */}
        <section className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-3">
          <p className="text-sm font-black text-[var(--ns-accent-text)] mb-2">더 자세한 분석이 필요하다면</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenNamingReport || undefined}
              className="w-full rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-3 text-left hover:bg-[var(--ns-surface-soft)] transition-colors"
            >
              <span className="inline-flex items-center gap-1.5 text-sm font-black text-[var(--ns-accent-text)]">
                <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4" aria-hidden="true">
                  <path d="M6 3H14C15.1 3 16 3.9 16 5V15C16 16.1 15.1 17 14 17H6C4.9 17 4 16.1 4 15V5C4 3.9 4.9 3 6 3Z" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M7 7H13M7 10H13M7 13H11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                이름 상세 보고서
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed font-semibold text-[var(--ns-muted)] break-keep">
                성명학 중심의 상세 분석을 확인해요.
              </span>
            </button>
            <button
              type="button"
              onClick={onOpenSajuReport || undefined}
              className="w-full rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-3 text-left hover:bg-[var(--ns-surface-soft)] transition-colors"
            >
              <span className="inline-flex items-center gap-1.5 text-sm font-black text-[var(--ns-accent-text)]">
                <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4" aria-hidden="true">
                  <path d="M10 5V10L13.2 12.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                사주 상세 보고서
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed font-semibold text-[var(--ns-muted)] break-keep">
                사주명리학 중심의 상세 분석을 확인해요.
              </span>
            </button>
          </div>
        </section>

        {/* ═══ 면책 조항 ═══ */}
        <p className="text-[11px] text-[var(--ns-muted)] text-center leading-relaxed px-2 break-keep">
          이 보고서는 동양 전통 사주명리학과 성명학 이론에 기반한 참고 자료입니다.
          사주는 가능성을 제시할 뿐, 미래를 확정짓지 않습니다.
        </p>

        {/* ═══ 인쇄/공유 ═══ */}
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

export default IntegratedReportView;
