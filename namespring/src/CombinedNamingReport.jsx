import React, { useMemo, useRef } from 'react';
import {
  ReportActionButtons,
  ReportPrintOverlay,
  ReportScrollTopFab,
  ReportShareDialog,
  useReportActions,
} from './report-common-ui';
import {
  buildNameParts,
  bandPresentation,
  buildSoundNarrative,
  buildStructureNarrative,
  metricValue,
  scorePresentation,
} from './lib/naming-report-view-model';

const FRAME_LABELS = {
  won: { index: '01', label: '초년운', period: '성장기의 기반' },
  hyung: { index: '02', label: '중년운', period: '사회적 성장과 활동' },
  lee: { index: '03', label: '말년운', period: '성숙기의 관계와 안정' },
  jung: { index: '04', label: '총운', period: '이름 전체의 흐름' },
};

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function DetailDisclosure({ label = '상세 근거', children }) {
  return (
    <details className="ncr-disclosure">
      <summary>
        <span>{label}</span>
        <span className="ncr-disclosure__icon" aria-hidden="true">+</span>
      </summary>
      <div className="ncr-disclosure__body">{children}</div>
    </details>
  );
}

function SectionHeading({ number, eyebrow, title, description }) {
  return (
    <header className="ncr-section-heading">
      <span className="ncr-section-heading__number">{number}</span>
      <div>
        <p className="ncr-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
    </header>
  );
}

function ScoreMetric({ label, value, valueText, caption }) {
  return (
    <div className="ncr-metric">
      <span>{label}</span>
      <strong>{valueText || metricValue(value)}</strong>
      {caption ? <small>{caption}</small> : null}
    </div>
  );
}

function EvidenceArticle({ section }) {
  const plainParts = section?.plainParts?.length
    ? section.plainParts
    : section?.plain
      ? [section.plain]
      : [];
  const detailParts = section?.detailParts?.length
    ? section.detailParts
    : section?.detail
      ? [section.detail]
      : [];

  if (section?.availability === 'not_applicable' || plainParts.length === 0) {
    return <div className="ncr-empty">이 이름에 적용할 수 있는 사주 조화 근거를 준비하고 있어요.</div>;
  }

  return (
    <div className="ncr-evidence-article">
      <div className="ncr-prose">
        {plainParts.map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>
        ))}
      </div>
      {detailParts.length ? (
        <DetailDisclosure>
          <div className="ncr-detail-prose">
            {detailParts.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>
            ))}
          </div>
        </DetailDisclosure>
      ) : null}
    </div>
  );
}

function StructureReason({ namingEvidence }) {
  const paragraphs = buildStructureNarrative(namingEvidence);
  const frames = Array.isArray(namingEvidence?.frames) ? namingEvidence.frames : [];
  const polarityLabel = (value) => {
    if (value === 'Positive' || value === '양') return '양';
    if (value === 'Negative' || value === '음') return '음';
    return value;
  };
  const polarities = [...new Set(frames.map((frame) => polarityLabel(frame?.polarity)).filter(Boolean))];
  const polaritySummary = polarities.length > 1 ? '음·양 배치' : polarities.length ? `${polarities[0]} 성향` : '배치 확인';

  return (
    <article className="ncr-reason-row">
      <header>
        <span className="ncr-reason-row__index">2.2</span>
        <div>
          <p className="ncr-eyebrow">이름 자체의 기반</p>
          <h3>성명학 구조가 안정적인가</h3>
        </div>
      </header>
      <div className="ncr-prose ncr-prose--compact">
        {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      <div className="ncr-metric-grid">
        <ScoreMetric label="수리운" value={namingEvidence?.luckScore} caption="네 가지 격의 길흉" />
        <ScoreMetric label="수리오행" value={namingEvidence?.elementScore} caption="획수의 오행 연결" />
        <ScoreMetric label="음양" valueText={polaritySummary} caption="획수 음양의 배치" />
      </div>
      <DetailDisclosure label="성명학 상세 근거">
        <dl className="ncr-fact-list">
          {frames.map((frame) => (
            <div key={`${frame.frameType}-${frame.strokeSum}`}>
              <dt>{FRAME_LABELS[frame.frameType]?.label || frame.label}</dt>
              <dd>{frame.strokeSum}획 · {frame.elementLabel || frame.element} · {polarityLabel(frame.polarity)} · {frame.title || '수리 해석'}</dd>
            </div>
          ))}
        </dl>
      </DetailDisclosure>
    </article>
  );
}

function SoundReason({ candidate }) {
  const phonetic = candidate?.scoreVector?.phonetic;
  const familyFit = candidate?.scoreVector?.familyFit;
  return (
    <article className="ncr-reason-row">
      <header>
        <span className="ncr-reason-row__index">2.3</span>
        <div>
          <p className="ncr-eyebrow">부르고 듣는 경험</p>
          <h3>부르기 좋은 이름인가</h3>
        </div>
      </header>
      <div className="ncr-prose ncr-prose--compact">
        <p>{buildSoundNarrative(candidate)}</p>
      </div>
      <div className="ncr-metric-grid ncr-metric-grid--two">
        <ScoreMetric label="발음 흐름" value={phonetic} caption="음절과 소리의 연결" />
        <ScoreMetric label="성씨 조화" value={familyFit} caption="성과 이름의 리듬" />
      </div>
      <DetailDisclosure label="발음 상세 근거">
        <p>음절 사이의 발음 흐름과 성씨에 이어 불렀을 때의 연결감을 나눠 평가했어요. 실제 사용을 결정할 때는 가족이 직접 여러 번 불러 보는 과정도 함께 권해요.</p>
      </DetailDisclosure>
    </article>
  );
}

function LifeFlowCard({ frame }) {
  const meta = FRAME_LABELS[frame?.frameType] || { index: '--', label: frame?.label || '이름운', period: '이름의 흐름' };
  return (
    <article className="ncr-life-card">
      <header>
        <span>{meta.index}</span>
        <div>
          <p>{meta.period}</p>
          <h3>{meta.label}</h3>
        </div>
        <strong>{frame?.strokeSum || '-'}획</strong>
      </header>
      <div className="ncr-life-card__title">
        <span>{frame?.elementLabel || frame?.element || '오행'}</span>
        <h4>{frame?.title || '수리의 흐름'}</h4>
      </div>
      <p>{frame?.summary || '이름의 수리 흐름을 분석하고 있어요.'}</p>
      {frame?.lifePeriodInfluence ? (
        <DetailDisclosure label="시기별 풀이">
          <p>{frame.lifePeriodInfluence}</p>
        </DetailDisclosure>
      ) : null}
    </article>
  );
}

function CombinedNamingReport({
  fortuneReport,
  selectedCandidate,
  shareUserInfo,
  onBackCandidates,
}) {
  const reportRootRef = useRef(null);
  const name = useMemo(
    () => buildNameParts(selectedCandidate, shareUserInfo),
    [selectedCandidate, shareUserInfo],
  );
  const compatibility = fortuneReport?.nameCompatibility || {};
  const namingEvidence = fortuneReport?.tieredMatrix?.namingEvidence || {};
  const score = numberOrNull(selectedCandidate?.finalScore)
    ?? numberOrNull(compatibility?.overallScore)
    ?? numberOrNull(namingEvidence?.fourFrameScore)
    ?? 0;
  const sajuFit = numberOrNull(selectedCandidate?.scoreVector?.sajuFit)
    ?? numberOrNull(compatibility?.sajuCompatibilityScore);
  const evidenceSections = fortuneReport?.namingRecommendationEvidence?.sections || [];
  const sajuFitEvidence = evidenceSections.find((section) => section.id === 'sajuFit');
  const scoreState = scorePresentation(score);
  const sajuFitState = sajuFitEvidence?.verdict
    ? bandPresentation(sajuFitEvidence.verdict)
    : scorePresentation(sajuFit);
  const structureState = scorePresentation(namingEvidence?.fourFrameScore);
  const frames = Array.isArray(namingEvidence?.frames) ? namingEvidence.frames : [];
  const {
    isPdfSaving,
    isShareDialogOpen,
    shareLink,
    isLinkCopied,
    handleSavePdf,
    handleOpenShareDialog,
    closeShareDialog,
    handleCopyShareLink,
  } = useReportActions({ reportRootRef, shareUserInfo });

  return (
    <>
      <article ref={reportRootRef} className="ncr-report">
        <header className="ncr-hero" id="report-summary">
          <div className="ncr-hero__content">
            <p className="ncr-eyebrow">이름봄 작명 추천 보고서</p>
            <div className="ncr-name-lockup">
              <h1>{name.hangul}</h1>
              {name.hanja ? <p>{name.hanja}</p> : null}
            </div>
            <p className="ncr-hero__verdict">
              사주에 필요한 방향과 이름 자체의 구조를 함께 보면,
              <strong> {scoreState.label}으로 평가되는 이름</strong>이에요.
            </p>
          </div>
          <div className={`ncr-score ncr-score--${scoreState.band}`} aria-label={`종합 추천 점수 ${Math.round(score)}점`}>
            <span>종합 추천</span>
            <strong>{Math.round(score)}</strong>
            <small>/ 100</small>
          </div>
          <div className="ncr-hero__signals">
            <div>
              <span>사주 방향</span>
              <strong>{sajuFitState.label}</strong>
            </div>
            <div>
              <span>성명학 구조</span>
              <strong>{structureState.label}</strong>
            </div>
            <div>
              <span>이름 사용성</span>
              <strong>{scorePresentation(selectedCandidate?.scoreVector?.phonetic).label}</strong>
            </div>
          </div>
        </header>

        <div className="ncr-layout">
          <nav className="ncr-rail" aria-label="보고서 목차" data-pdf-exclude="true">
            <a href="#report-summary"><span>01</span>추천 결론</a>
            <a href="#report-reasons"><span>02</span>핵심 이유</a>
            <a href="#report-life-flow"><span>03</span>이름의 운세</a>
          </nav>

          <main className="ncr-main">
            <section className="ncr-section" id="report-reasons">
              <SectionHeading
                number="02"
                eyebrow="WHY THIS NAME"
                title="이 이름이 잘 맞는 핵심 이유"
                description="사주와의 방향, 이름 자체의 구조, 실제로 부를 때의 사용성을 순서대로 살펴봤어요."
              />

              <article className="ncr-primary-reason">
                <header>
                  <span className="ncr-reason-row__index">2.1</span>
                  <div>
                    <p className="ncr-eyebrow">작명의 첫 번째 기준</p>
                    <h3>사주에 필요한 방향과 맞는가</h3>
                  </div>
                  <div className={`ncr-status ncr-status--${sajuFitState.band}`}>{sajuFitState.label}</div>
                </header>
                <EvidenceArticle section={sajuFitEvidence} />
              </article>

              <StructureReason namingEvidence={namingEvidence} />
              <SoundReason candidate={selectedCandidate} />
            </section>

            <section className="ncr-section" id="report-life-flow">
              <SectionHeading
                number="03"
                eyebrow="NAME FORTUNE"
                title="이름이 담고 있는 삶의 흐름"
                description="성명학의 수리 풀이를 기반으로 초년부터 총운까지 이어지는 이름의 흐름을 보여줄게요."
              />
              {frames.length ? (
                <div className="ncr-life-grid">
                  {frames.map((frame) => <LifeFlowCard key={frame.frameType} frame={frame} />)}
                </div>
              ) : (
                <div className="ncr-empty">선택한 한자의 수리 흐름을 분석하고 있어요.</div>
              )}
            </section>

            <section className="ncr-closing">
              <p className="ncr-eyebrow">최종 제안</p>
              <h2>{name.hangul}{name.hanja ? `(${name.hanja})` : ''}을<br />추천 후보로 제안해요.</h2>
              <p>사주에 필요한 방향과 이름의 수리·발음 구조를 함께 본 결과예요. 마지막 결정 전에는 성과 이름을 여러 번 소리 내어 불러 보세요.</p>
            </section>
          </main>
        </div>

        <ReportActionButtons
          isPdfSaving={isPdfSaving}
          onSavePdf={handleSavePdf}
          onShare={handleOpenShareDialog}
          onBack={onBackCandidates}
        />
      </article>

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

export default CombinedNamingReport;
