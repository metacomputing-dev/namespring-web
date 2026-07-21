import React, { useMemo, useRef } from 'react';
import {
  ReportActionButtons,
  ReportPrintOverlay,
  ReportScrollTopFab,
  ReportShareDialog,
  useReportActions,
} from './report-common-ui';
import {
  bandPresentation,
  buildNameParts,
  buildSoundNarrative,
  buildStructureNarrative,
  metricValue,
  reportVerdict,
  scorePresentation,
} from './lib/naming-report-view-model';

const FRAME_LABELS = {
  won: { label: '초년운', period: '처음 기반을 다지는 시기' },
  hyung: { label: '중년운', period: '일과 관계가 넓어지는 시기' },
  lee: { label: '말년운', period: '삶이 무르익는 시기' },
  jung: { label: '총운', period: '이름 전체에 담긴 흐름' },
};

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function DetailDisclosure({ label = '근거 자세히 보기', children }) {
  return (
    <details className="nnr-disclosure">
      <summary>
        <span>{label}</span>
        <span className="nnr-disclosure__icon" aria-hidden="true">+</span>
      </summary>
      <div className="nnr-disclosure__body">{children}</div>
    </details>
  );
}

function ChapterHeading({ kicker, title, description }) {
  return (
    <header className="nnr-chapter-heading">
      <p>{kicker}</p>
      <h2>{title}</h2>
      {description ? <span>{description}</span> : null}
    </header>
  );
}

function EvidenceNarrative({ section }) {
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

  if (plainParts.length === 0) {
    return <p className="nnr-unavailable">이 이름에 적용할 수 있는 근거가 충분하지 않아요.</p>;
  }

  return (
    <div className="nnr-narrative">
      <div className="nnr-narrative__plain">
        {plainParts.map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 16)}`}>{paragraph}</p>
        ))}
      </div>
      {detailParts.length ? (
        <DetailDisclosure label="사주 근거 자세히 보기">
          <div className="nnr-narrative__detail">
            {detailParts.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 16)}`}>{paragraph}</p>
            ))}
          </div>
        </DetailDisclosure>
      ) : null}
    </div>
  );
}

function Metric({ label, value, caption }) {
  const formatted = metricValue(value);
  if (!formatted) return null;
  return (
    <div className="nnr-metric">
      <div>
        <span>{label}</span>
        {caption ? <small>{caption}</small> : null}
      </div>
      <strong>{formatted}</strong>
    </div>
  );
}

function StructureDetails({ namingEvidence }) {
  const frames = Array.isArray(namingEvidence?.frames) ? namingEvidence.frames : [];
  if (frames.length === 0) return null;
  return (
    <DetailDisclosure label="획수 풀이 자세히 보기">
      <dl className="nnr-facts">
        {frames.map((frame) => (
          <div key={`${frame.frameType}-${frame.strokeSum}`}>
            <dt>{FRAME_LABELS[frame.frameType]?.label || frame.label || '이름운'}</dt>
            <dd>{frame.strokeSum}획 · {frame.elementLabel || frame.element || '오행'} · {frame.title || '수리 풀이'}</dd>
          </div>
        ))}
      </dl>
    </DetailDisclosure>
  );
}

function QualitySection({ namingEvidence, phonetic, familyFit }) {
  const structureParagraphs = buildStructureNarrative(namingEvidence);
  const soundParagraph = buildSoundNarrative({ phonetic, familyFit });
  const hasSoundScores = phonetic !== null || familyFit !== null;

  return (
    <div className="nnr-quality-grid">
      <article className="nnr-quality-panel">
        <header>
          <p>한자와 획수</p>
          <h3>이름의 짜임은 안정적인가요?</h3>
        </header>
        <div className="nnr-copy">
          {structureParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <div className="nnr-metrics">
          <Metric label="수리운" value={namingEvidence?.luckScore} caption="초년운부터 총운까지" />
          <Metric label="획수 오행" value={namingEvidence?.elementScore} caption="획수 사이의 오행 짜임" />
        </div>
        <StructureDetails namingEvidence={namingEvidence} />
      </article>

      <article className="nnr-quality-panel">
        <header>
          <p>부르는 느낌</p>
          <h3>성과 이름이 자연스럽게 이어지나요?</h3>
        </header>
        <div className="nnr-copy"><p>{soundParagraph}</p></div>
        {hasSoundScores ? (
          <div className="nnr-metrics">
            <Metric label="발음 흐름" value={phonetic} caption="음절 사이의 연결" />
            <Metric label="성과의 어울림" value={familyFit} caption="성을 붙여 부른 리듬" />
          </div>
        ) : null}
        <DetailDisclosure label="발음 기준 자세히 보기">
          <p>각 음절이 이어질 때의 발음과 성을 붙여 불렀을 때의 연결감을 나누어 살폈어요. 점수와 별개로 가족이 직접 여러 번 불러 보는 과정도 중요해요.</p>
        </DetailDisclosure>
      </article>
    </div>
  );
}

function LifeFlowCard({ frame }) {
  const meta = FRAME_LABELS[frame?.frameType] || { label: frame?.label || '이름운', period: '이름에 담긴 흐름' };
  return (
    <article className="nnr-life-card">
      <header>
        <div>
          <p>{meta.period}</p>
          <h3>{meta.label}</h3>
        </div>
        {frame?.strokeSum ? <span>{frame.strokeSum}획</span> : null}
      </header>
      <strong>{frame?.title || '이름의 수리 흐름'}</strong>
      <p>{frame?.summary || '이 시기의 흐름을 확인할 수 있는 정보가 충분하지 않아요.'}</p>
      {frame?.lifePeriodInfluence ? (
        <DetailDisclosure label="풀이 더 보기">
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
  const vector = compatibility?.scoreVector || selectedCandidate?.scoreVector || {};
  const phoneticAnalysis = compatibility?.phonetic || {};
  const namingEvidence = fortuneReport?.tieredMatrix?.namingEvidence || {};
  const score = numberOrNull(selectedCandidate?.finalScore)
    ?? numberOrNull(compatibility?.overallScore)
    ?? numberOrNull(namingEvidence?.fourFrameScore)
    ?? 0;
  const phonetic = numberOrNull(vector?.phonetic) ?? numberOrNull(phoneticAnalysis?.phoneticScore);
  const familyFit = numberOrNull(vector?.familyFit) ?? numberOrNull(phoneticAnalysis?.familyNameFitScore);
  const evidenceSections = fortuneReport?.namingRecommendationEvidence?.sections || [];
  const sajuFitEvidence = evidenceSections.find((section) => section.id === 'sajuFit');
  const sajuFit = numberOrNull(vector?.sajuFit) ?? numberOrNull(compatibility?.sajuCompatibilityScore);
  const verdict = reportVerdict(score, [
    sajuFit,
    numberOrNull(namingEvidence?.fourFrameScore),
    phonetic,
  ]);
  const sajuState = sajuFitEvidence?.verdict
    ? bandPresentation(sajuFitEvidence.verdict)
    : scorePresentation(sajuFit);
  const structureState = scorePresentation(namingEvidence?.fourFrameScore);
  const soundState = phonetic === null ? null : scorePresentation(phonetic);
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

  const summarySignals = [
    { label: '사주와의 어울림', value: sajuState.label, band: sajuState.band },
    { label: '한자와 획수의 짜임', value: structureState.label, band: structureState.band },
    soundState ? { label: '부르는 느낌', value: soundState.label, band: soundState.band } : null,
  ].filter(Boolean);

  return (
    <>
      <article ref={reportRootRef} className="nnr-report">
        <header className="nnr-hero">
          <div className="nnr-hero__name">
            <p>이름봄 추천 이름</p>
            <div>
              <h1>{name.hangul}</h1>
              {name.hanja ? <span>{name.hanja}</span> : null}
            </div>
          </div>
          <div className="nnr-hero__verdict">
            <span className={`nnr-badge nnr-badge--${verdict.band}`}>{verdict.label}</span>
            <h2>{verdict.headline}</h2>
            <p>{verdict.summary}</p>
          </div>
          <div className={`nnr-score nnr-score--${verdict.band}`} aria-label={`종합 추천 점수 ${Math.round(score)}점`}>
            <span>종합 점수</span>
            <strong>{Math.round(score)}</strong>
            <small>100점 만점</small>
          </div>
        </header>

        <div className="nnr-summary" aria-label="이름 평가 요약">
          {summarySignals.map((signal) => (
            <div key={signal.label}>
              <span>{signal.label}</span>
              <strong className={`nnr-text--${signal.band}`}>{signal.value}</strong>
            </div>
          ))}
        </div>

        <main className="nnr-content">
          <section className="nnr-chapter">
            <ChapterHeading
              kicker="이름을 고른 이유"
              title={`${name.hangul}이 지금 필요한 방향과 얼마나 어울리는지 살펴봤어요.`}
              description="점수만 보여드리는 대신, 어떤 점이 잘 맞고 무엇을 더 살펴야 하는지 차례로 설명할게요."
            />
            <div className="nnr-evidence-layout">
              <aside>
                <span>사주와의 어울림</span>
                <strong className={`nnr-text--${sajuState.band}`}>{sajuState.label}</strong>
                {sajuFit !== null ? <small>{Math.round(sajuFit)}점</small> : null}
              </aside>
              <EvidenceNarrative section={sajuFitEvidence} />
            </div>
          </section>

          <section className="nnr-chapter">
            <ChapterHeading
              kicker="이름 자체의 완성도"
              title="뜻만큼 중요한 이름의 짜임과 소리도 확인했어요."
              description="한자의 획수와 오행, 성과 이어지는 발음을 각각 나누어 살폈어요."
            />
            <QualitySection
              namingEvidence={namingEvidence}
              phonetic={phonetic}
              familyFit={familyFit}
            />
          </section>

          <section className="nnr-chapter">
            <ChapterHeading
              kicker="이름에 담긴 흐름"
              title="초년부터 총운까지, 네 시기의 이름운이에요."
              description="이름의 획수로 풀이한 흐름이며, 삶을 단정하는 예측이 아니라 이름에 담긴 상징으로 봐주세요."
            />
            {frames.length ? (
              <div className="nnr-life-grid">
                {frames.map((frame) => <LifeFlowCard key={frame.frameType} frame={frame} />)}
              </div>
            ) : (
              <p className="nnr-unavailable">선택한 한자의 획수 풀이를 확인할 수 없어요.</p>
            )}
          </section>

          <footer className={`nnr-closing nnr-closing--${verdict.band}`}>
            <div>
              <p>이름봄의 최종 제안</p>
              <h2>{verdict.closing}</h2>
            </div>
            <strong>{name.hangul}{name.hanja ? ` · ${name.hanja}` : ''}</strong>
          </footer>
        </main>

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
