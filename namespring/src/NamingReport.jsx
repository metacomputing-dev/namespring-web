import React, { useMemo } from 'react';

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

function polarityLabel(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'positive' || raw === '양') return '양';
  if (raw === 'negative' || raw === '음') return '음';
  return '-';
}

function getNameBlocks(calculator) {
  if (!calculator || typeof calculator.getNameBlocks !== 'function') return [];
  return calculator.getNameBlocks();
}

function getCalculatorScore(calculator) {
  if (!calculator || typeof calculator.getScore !== 'function') return 0;
  const score = Number(calculator.getScore());
  return Number.isFinite(score) ? score : 0;
}

function summarizeHangul(hangulBlocks) {
  const counts = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  let positive = 0;
  let negative = 0;

  for (const block of hangulBlocks) {
    const element = normalizeElement(block?.energy?.element?.english || block?.energy?.element);
    if (element) counts[element] += 1;

    const polarity = polarityLabel(block?.energy?.polarity?.english || block?.energy?.polarity);
    if (polarity === '양') positive += 1;
    if (polarity === '음') negative += 1;
  }

  return { counts, positive, negative };
}

function scoreText(score) {
  const n = Number(score);
  return Number.isFinite(n) ? n.toFixed(1) : '0.0';
}

function gradeText(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return '평가 데이터 없음';
  if (n >= 85) return '매우 안정적인 이름';
  if (n >= 70) return '안정적인 이름';
  if (n >= 55) return '보통 수준의 이름';
  return '보완이 필요한 이름';
}

const NamingReport = ({ result, onNewAnalysis }) => {
  if (!result) return null;

  const fullEntries = [...(result.lastName || []), ...(result.firstName || [])];
  const fullNameHangul = fullEntries.map((v) => String(v?.hangul ?? '')).join('');
  const fullNameHanja = fullEntries.map((v) => String(v?.hanja ?? '')).join('');

  const hangulScore = getCalculatorScore(result.hangul);
  const totalScore = Number(result.totalScore ?? hangulScore);
  const hangulBlocks = getNameBlocks(result.hangul);

  const hangulSummary = useMemo(() => summarizeHangul(hangulBlocks), [hangulBlocks]);

  return (
    <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <section className="bg-[var(--ns-surface)] rounded-[2.4rem] p-4 md:p-5 border border-[var(--ns-border)] shadow-xl">
        <p className="text-[11px] tracking-[0.22em] text-[var(--ns-muted)] font-black mb-3">이름 평가 요약</p>
        <h2 className="text-4xl md:text-5xl font-black text-[var(--ns-accent-text)]">{fullNameHangul || '-'}</h2>
        <p className="text-xl md:text-2xl text-[var(--ns-muted)] font-semibold mt-1">{fullNameHanja || '-'}</p>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3">
            <p className="text-xs font-black text-[var(--ns-muted)]">종합 점수</p>
            <p className="text-2xl font-black text-[var(--ns-accent-text)]">{scoreText(totalScore)}</p>
            <p className="text-xs text-[var(--ns-muted)] mt-1">{gradeText(totalScore)}</p>
          </div>
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3">
            <p className="text-xs font-black text-[var(--ns-muted)]">한글 평가 점수</p>
            <p className="text-2xl font-black text-[var(--ns-accent-text)]">{scoreText(hangulScore)}</p>
            <p className="text-xs text-[var(--ns-muted)] mt-1">사격수리/한자 평가는 지원하지 않습니다.</p>
          </div>
        </div>

        <p className="text-[var(--ns-muted)] mt-3 leading-relaxed">
          {result.interpretation || '한글 음운/오행 중심의 결과를 제공합니다.'}
        </p>
      </section>

      <section className="bg-[var(--ns-surface)] rounded-[2rem] border border-[var(--ns-border)] shadow-lg p-3">
        <h3 className="text-lg font-black text-[var(--ns-accent-text)]">한글 오행/음양</h3>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-2 font-black text-[var(--ns-muted)]">양 {hangulSummary.positive}</div>
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-2 font-black text-[var(--ns-muted)]">음 {hangulSummary.negative}</div>
          {Object.keys(ELEMENT_LABEL).map((key) => (
            <div key={key} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-2 font-black text-[var(--ns-muted)]">
              {ELEMENT_LABEL[key]} {hangulSummary.counts[key]}
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {hangulBlocks.map((block, index) => {
            const hangul = String(block?.entry?.hangul ?? '-');
            const nucleus = String(block?.entry?.nucleus ?? '-');
            const element = normalizeElement(block?.energy?.element?.english || block?.energy?.element);
            const polarity = polarityLabel(block?.energy?.polarity?.english || block?.energy?.polarity);
            return (
              <div key={`hangul-block-${index}`} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2 text-sm flex items-center justify-between gap-2">
                <span className="font-black text-[var(--ns-accent-text)]">{hangul} ({nucleus})</span>
                <span className="font-semibold text-[var(--ns-muted)]">
                  {element ? `${ELEMENT_LABEL[element]} / ` : ''}{polarity}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex gap-4 pt-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex-1 py-4 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-2xl font-black text-[var(--ns-muted)] hover:bg-[var(--ns-surface-soft)] active:scale-95 transition-all"
        >
          인쇄하기
        </button>
        <button
          type="button"
          onClick={() => (onNewAnalysis ? onNewAnalysis() : window.location.reload())}
          className="flex-1 py-4 bg-[var(--ns-primary)] text-[var(--ns-accent-text)] rounded-2xl font-black shadow-lg hover:brightness-95 active:scale-95 transition-all"
        >
          다시 분석하기
        </button>
      </div>
    </div>
  );
};

export default NamingReport;
