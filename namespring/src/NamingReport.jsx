import React, { useMemo, useState } from 'react';

const ELEMENT_ORDER = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];

const ELEMENT_LABEL = {
  Wood: '목',
  Fire: '화',
  Earth: '토',
  Metal: '금',
  Water: '수',
};

const ELEMENT_SOFT = {
  Wood: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Fire: 'bg-rose-50 text-rose-700 border-rose-200',
  Earth: 'bg-amber-50 text-amber-700 border-amber-200',
  Metal: 'bg-slate-100 text-slate-700 border-slate-200',
  Water: 'bg-blue-50 text-blue-700 border-blue-200',
};

const POLARITY_SOFT = {
  양: 'bg-orange-50 text-orange-700 border-orange-200',
  음: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

function getBlocks(calculator) {
  if (!calculator || typeof calculator.getNameBlocks !== 'function') return [];
  return calculator.getNameBlocks();
}

function getFrames(calculator) {
  if (!calculator || typeof calculator.getFrames !== 'function') return [];
  return calculator.getFrames();
}

function getCalculatorScore(calculator) {
  if (!calculator || typeof calculator.getScore !== 'function') return 0;
  const score = Number(calculator.getScore());
  return Number.isFinite(score) ? score : 0;
}

function normalizeElement(element) {
  const raw = typeof element === 'object'
    ? element?.english || element?.korean || ''
    : String(element ?? '');
  const value = raw.trim().toLowerCase();
  if (value === 'wood' || value === '목' || value === '나무') return 'Wood';
  if (value === 'fire' || value === '화' || value === '불') return 'Fire';
  if (value === 'earth' || value === '토' || value === '흙') return 'Earth';
  if (value === 'metal' || value === '금' || value === '쇠') return 'Metal';
  if (value === 'water' || value === '수' || value === '물') return 'Water';
  return '';
}

function polarityLabel(polarity) {
  const raw = typeof polarity === 'object'
    ? polarity?.english || polarity?.korean || ''
    : String(polarity ?? '');
  const value = raw.trim().toLowerCase();
  if (value === 'positive' || value === '양') return '양';
  if (value === 'negative' || value === '음') return '음';
  return '-';
}

function summarizeEnergies(items) {
  const elementCounts = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  let positive = 0;
  let negative = 0;

  for (const item of items) {
    const key = normalizeElement(item?.energy?.element);
    if (key) elementCounts[key] += 1;
    const p = polarityLabel(item?.energy?.polarity);
    if (p === '양') positive += 1;
    if (p === '음') negative += 1;
  }

  return { elementCounts, positive, negative };
}

function getElementSoftClass(el) {
  return ELEMENT_SOFT[el] || 'bg-slate-100 text-slate-700 border-slate-200';
}

function getPolaritySoftClass(pol) {
  return POLARITY_SOFT[pol] || 'bg-slate-100 text-slate-700 border-slate-200';
}

function frameTypeLabel(type) {
  if (type === 'won') return '원격';
  if (type === 'hyung') return '형격';
  if (type === 'lee') return '이격';
  if (type === 'jung') return '정격';
  return '-';
}

function lifePhaseLabel(type) {
  if (type === 'won') return '초년';
  if (type === 'hyung') return '중년';
  if (type === 'lee') return '말년';
  if (type === 'jung') return '전체';
  return '-';
}

function getScoreGrade(score) {
  if (score >= 85) return '매우 균형이 좋은 이름';
  if (score >= 70) return '안정적인 균형의 이름';
  if (score >= 55) return '무난한 흐름의 이름';
  return '보완이 필요한 이름';
}

function replaceNamePlaceholder(value, fullName) {
  if (typeof value !== 'string') return value;
  return value.replace(/\[성함\]/g, fullName);
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
      <p className="text-sm font-semibold leading-relaxed">{value || '-'}</p>
    </div>
  );
}

function getFrameDetailScores(frames, index) {
  const current = frames[index];
  const next = frames[(index + 1) % frames.length];
  if (!current?.energy || !next?.energy) {
    return { polarity: 0, element: 0, final: 0 };
  }

  const pair = [current.energy, next.energy];

  let polarityRaw = 0;
  for (const energy of pair) {
    const p = polarityLabel(energy?.polarity);
    polarityRaw += p === '양' ? 1 : -1;
  }
  const polarityScore = (pair.length - Math.abs(polarityRaw)) * 100 / pair.length;

  const currentElement = pair[0].element;
  const nextElement = pair[1].element;
  let elementScore = 70;
  if (currentElement?.isGenerating?.(nextElement)) {
    elementScore += 15;
  } else if (currentElement?.isOvercoming?.(nextElement)) {
    elementScore -= 20;
  } else if (currentElement?.isSameAs?.(nextElement)) {
    elementScore -= 5;
  }
  elementScore = Math.max(0, Math.min(100, elementScore));

  return {
    polarity: polarityScore,
    element: elementScore,
    final: polarityScore * 0.5 + elementScore * 0.5,
  };
}

function CollapseCard({ title, subtitle, open, onToggle, children }) {
  return (
    <section className="bg-[var(--ns-surface)] rounded-[2rem] border border-[var(--ns-border)] shadow-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-5 text-left"
      >
        <div>
          <h3 className="text-lg font-black text-[var(--ns-accent-text)]">{title}</h3>
          {subtitle ? <p className="text-sm text-[var(--ns-muted)] mt-1">{subtitle}</p> : null}
        </div>
        <span className="text-sm font-black text-[var(--ns-muted)]">{open ? '접기' : '펼치기'}</span>
      </button>
      {open ? <div className="px-6 pb-6">{children}</div> : null}
    </section>
  );
}

function SummaryBadges({ items }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item.key} className={`px-2.5 py-1 rounded-full border text-xs font-black ${item.className}`}>
          {item.label}
        </span>
      ))}
    </div>
  );
}

const NamingReport = ({ result, onNewAnalysis }) => {
  if (!result) return null;

  const [openCards, setOpenCards] = useState({
    fourFrame: true,
    hanja: false,
    hangul: false,
  });
  const [openLifeDetails, setOpenLifeDetails] = useState({});

  const { lastName, firstName, totalScore, hanja, hangul, fourFrames, interpretation } = result;
  const fullEntries = [...lastName, ...firstName];
  const fullNameHanja = fullEntries.map((v) => v.hanja).join('');
  const fullNameHangul = fullEntries.map((v) => v.hangul).join('');

  const score = Number(totalScore ?? 0);
  const scoreText = Number.isFinite(score) ? score.toFixed(1) : '0.0';

  const hangulBlocks = getBlocks(hangul);
  const hanjaBlocks = getBlocks(hanja);
  const frameBlocks = getFrames(fourFrames);

  const hangulScore = getCalculatorScore(hangul);
  const hanjaScore = getCalculatorScore(hanja);
  const fourFrameScore = getCalculatorScore(fourFrames);

  const hangulPolarityScore = Number(hangul?.polarityScore ?? 0);
  const hangulElementScore = Number(hangul?.elementScore ?? 0);
  const hanjaPolarityScore = Number(hanja?.polarityScore ?? 0);
  const hanjaElementScore = Number(hanja?.elementScore ?? 0);
  const fourFrameLuckScore = Number(fourFrames?.luckScore ?? 0);

  const hangulSummary = useMemo(() => summarizeEnergies(hangulBlocks), [hangulBlocks]);
  const hanjaSummary = useMemo(() => summarizeEnergies(hanjaBlocks), [hanjaBlocks]);
  const frameSummary = useMemo(() => summarizeEnergies(frameBlocks), [frameBlocks]);

  const toggleCard = (key) => {
    setOpenCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const toggleLifeDetail = (idx) => {
    setOpenLifeDetails((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <section className="bg-[var(--ns-surface)] rounded-[2.4rem] p-7 md:p-9 border border-[var(--ns-border)] shadow-xl relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-[var(--ns-primary)]/15 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-7">
          <div>
            <p className="text-[11px] tracking-[0.22em] text-[var(--ns-muted)] font-black mb-3">이름 평가 요약</p>
            <h2 className="text-4xl md:text-5xl font-black text-[var(--ns-accent-text)]">{fullNameHangul}</h2>
            <p className="text-xl md:text-2xl text-[var(--ns-muted)] font-semibold mt-1">{fullNameHanja}</p>
            <p className="text-[var(--ns-muted)] mt-4 leading-relaxed">{interpretation || getScoreGrade(score)}</p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-sm text-[var(--ns-muted)] font-bold mb-1">종합 점수</p>
            <div className="text-6xl md:text-7xl font-black text-[var(--ns-accent-text)] leading-none">{scoreText}</div>
            <p className="text-sm text-[var(--ns-muted)] font-semibold mt-2">{getScoreGrade(score)}</p>
          </div>
        </div>
      </section>

      <section className="bg-[var(--ns-surface)] rounded-[2.2rem] border border-[var(--ns-border)] shadow-lg p-6 md:p-7">
        <h3 className="text-xl font-black text-[var(--ns-accent-text)] mb-1">인생의 흐름</h3>
        <p className="text-sm text-[var(--ns-muted)] mb-6">사격수리의 원·형·이·정을 기준으로 초중말년과 전체 흐름을 풀어봅니다.</p>

        <div className="space-y-4">
          {frameBlocks.map((frame, idx) => {
            const el = normalizeElement(frame?.energy?.element);
            const pol = polarityLabel(frame?.energy?.polarity);
            const entry = frame?.entry;
            const isOpen = Boolean(openLifeDetails[idx]);
            const titleText = replaceNamePlaceholder(entry?.title || '흐름 해석 준비중', fullNameHangul);
            const summaryText = replaceNamePlaceholder(entry?.summary || '해당 수리의 기본 의미를 불러오는 중입니다.', fullNameHangul);
            const detailedText = replaceNamePlaceholder(entry?.detailed_explanation || '', fullNameHangul);
            const positiveText = replaceNamePlaceholder(entry?.positive_aspects || '', fullNameHangul);
            const cautionText = replaceNamePlaceholder(entry?.caution_points || '', fullNameHangul);
            const lifePeriodText = replaceNamePlaceholder(entry?.life_period_influence || '', fullNameHangul);
            const challengeText = replaceNamePlaceholder(entry?.challenge_period || '', fullNameHangul);
            const opportunityText = replaceNamePlaceholder(entry?.opportunity_area || '', fullNameHangul);
            const luckyLevelText = replaceNamePlaceholder(entry?.lucky_level || '', fullNameHangul);
            const personalityText = Array.isArray(entry?.personality_traits)
              ? entry.personality_traits.map((item) => replaceNamePlaceholder(item, fullNameHangul)).join(', ')
              : '';
            const careerText = Array.isArray(entry?.suitable_career)
              ? entry.suitable_career.map((item) => replaceNamePlaceholder(item, fullNameHangul)).join(', ')
              : '';
            return (
              <article key={`life-flow-${idx}`} className="rounded-2xl border border-[var(--ns-border)] bg-gradient-to-b from-[var(--ns-surface)] to-[var(--ns-surface-soft)] p-4 md:p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[var(--ns-accent-text)]">{lifePhaseLabel(frame?.type)} · {frameTypeLabel(frame?.type)} ({frame?.strokeSum}수)</p>
                    <p className="text-base font-black text-[var(--ns-text)] mt-1">{titleText}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${el ? getElementSoftClass(el) : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{el ? ELEMENT_LABEL[el] : '-'}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${getPolaritySoftClass(pol)}`}>{pol}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2.5">
                  <p className="text-sm text-[var(--ns-muted)] leading-relaxed">{summaryText}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleLifeDetail(idx)}
                  className="w-full rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2 text-sm font-black text-[var(--ns-muted)] text-left"
                >
                  {isOpen ? '상세 해석 접기' : '상세 해석 펼치기'}
                </button>

                {isOpen ? (
                  <div className="space-y-3">
                    {entry?.detailed_explanation ? (
                      <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2.5">
                        <p className="text-sm text-[var(--ns-muted)] leading-relaxed">{detailedText}</p>
                      </div>
                    ) : null}

                    <div className="space-y-2.5 text-sm">
                      {entry?.positive_aspects ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-2.5">
                          <p className="text-xs font-black mb-1">강점</p>
                          <p className="leading-relaxed font-semibold">{positiveText}</p>
                        </div>
                      ) : null}
                      {entry?.caution_points ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2.5">
                          <p className="text-xs font-black mb-1">유의점</p>
                          <p className="leading-relaxed font-semibold">{cautionText}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2.5">
                      {entry?.personality_traits?.length ? (
                        <MetaInfoCard title="성향" value={personalityText} tone="blue" />
                      ) : null}
                      {entry?.suitable_career?.length ? (
                        <MetaInfoCard title="적성 분야" value={careerText} tone="emerald" />
                      ) : null}
                      {entry?.life_period_influence ? (
                        <MetaInfoCard title="인생 구간 영향" value={lifePeriodText} tone="default" />
                      ) : null}
                      {entry?.opportunity_area ? (
                        <MetaInfoCard title="기회 영역" value={opportunityText} tone="amber" />
                      ) : null}
                      {entry?.challenge_period ? (
                        <MetaInfoCard title="도전 구간" value={challengeText} tone="default" />
                      ) : null}
                      {entry?.lucky_level ? (
                        <MetaInfoCard title="길흉 단계" value={luckyLevelText} tone="default" />
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <CollapseCard
        title={`사격수리 평가 (${fourFrameScore.toFixed(1)}점)`}
        subtitle="클릭해서 상세 점수와 프레임별 값을 확인하세요."
        open={openCards.fourFrame}
        onToggle={() => toggleCard('fourFrame')}
      >
        <div className="space-y-4">
          <SummaryBadges
            items={[
              { key: 'p', label: `양 ${frameSummary.positive}`, className: getPolaritySoftClass('양') },
              { key: 'n', label: `음 ${frameSummary.negative}`, className: getPolaritySoftClass('음') },
              ...ELEMENT_ORDER.map((el) => ({
                key: `e-${el}`,
                label: `${ELEMENT_LABEL[el]} ${frameSummary.elementCounts[el]}`,
                className: getElementSoftClass(el),
              })),
            ]}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">길흉 점수: {fourFrameLuckScore.toFixed(1)}</div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">최종 점수: {fourFrameScore.toFixed(1)}</div>
          </div>
          <div className="space-y-2">
            {frameBlocks.map((frame, idx) => {
              const el = normalizeElement(frame?.energy?.element);
              const pol = polarityLabel(frame?.energy?.polarity);
              const detail = getFrameDetailScores(frameBlocks, idx);
              return (
                <div key={`f-row-${idx}`} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-3 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-[var(--ns-accent-text)]">{frameTypeLabel(frame?.type)} ({frame?.strokeSum}수)</span>
                    <div className="flex gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${el ? getElementSoftClass(el) : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{el ? ELEMENT_LABEL[el] : '-'}</span>
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${getPolaritySoftClass(pol)}`}>{pol}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-black">
                    <div className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2 py-1 text-[var(--ns-muted)]">음양 {detail.polarity.toFixed(1)}</div>
                    <div className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2 py-1 text-[var(--ns-muted)]">오행 {detail.element.toFixed(1)}</div>
                    <div className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2 py-1 text-[var(--ns-accent-text)]">최종 {detail.final.toFixed(1)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CollapseCard>

      <CollapseCard
        title={`한자 평가 (${hanjaScore.toFixed(1)}점)`}
        subtitle="클릭해서 음양/오행 점수와 글자별 결과를 확인하세요."
        open={openCards.hanja}
        onToggle={() => toggleCard('hanja')}
      >
        <div className="space-y-4">
          <SummaryBadges
            items={[
              { key: 'p', label: `양 ${hanjaSummary.positive}`, className: getPolaritySoftClass('양') },
              { key: 'n', label: `음 ${hanjaSummary.negative}`, className: getPolaritySoftClass('음') },
              ...ELEMENT_ORDER.map((el) => ({
                key: `e-${el}`,
                label: `${ELEMENT_LABEL[el]} ${hanjaSummary.elementCounts[el]}`,
                className: getElementSoftClass(el),
              })),
            ]}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">음양 점수: {hanjaPolarityScore.toFixed(1)}</div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">오행 점수: {hanjaElementScore.toFixed(1)}</div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">최종 점수: {hanjaScore.toFixed(1)}</div>
          </div>
          <div className="space-y-2">
            {hanjaBlocks.map((block, idx) => {
              const el = normalizeElement(block?.energy?.element || block?.entry?.resource_element);
              const pol = polarityLabel(block?.energy?.polarity);
              return (
                <div key={`j-row-${idx}`} className="flex items-center justify-between rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2 text-sm">
                  <span className="font-black text-[var(--ns-accent-text)]">{block?.entry?.hanja || '-'} ({block?.entry?.strokes ?? '-'}획)</span>
                  <div className="flex gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${el ? getElementSoftClass(el) : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{el ? ELEMENT_LABEL[el] : '-'}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${getPolaritySoftClass(pol)}`}>{pol}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CollapseCard>

      <CollapseCard
        title={`한글 평가 (${hangulScore.toFixed(1)}점)`}
        subtitle="클릭해서 음양/오행 점수와 음절별 결과를 확인하세요."
        open={openCards.hangul}
        onToggle={() => toggleCard('hangul')}
      >
        <div className="space-y-4">
          <SummaryBadges
            items={[
              { key: 'p', label: `양 ${hangulSummary.positive}`, className: getPolaritySoftClass('양') },
              { key: 'n', label: `음 ${hangulSummary.negative}`, className: getPolaritySoftClass('음') },
              ...ELEMENT_ORDER.map((el) => ({
                key: `e-${el}`,
                label: `${ELEMENT_LABEL[el]} ${hangulSummary.elementCounts[el]}`,
                className: getElementSoftClass(el),
              })),
            ]}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">음양 점수: {hangulPolarityScore.toFixed(1)}</div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">오행 점수: {hangulElementScore.toFixed(1)}</div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">최종 점수: {hangulScore.toFixed(1)}</div>
          </div>
          <div className="space-y-2">
            {hangulBlocks.map((block, idx) => {
              const el = normalizeElement(block?.energy?.element);
              const pol = polarityLabel(block?.energy?.polarity);
              return (
                <div key={`h-row-${idx}`} className="flex items-center justify-between rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2 text-sm">
                  <span className="font-black text-[var(--ns-accent-text)]">{block?.entry?.hangul || '-'} ({block?.entry?.nucleus || '-'})</span>
                  <div className="flex gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${el ? getElementSoftClass(el) : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{el ? ELEMENT_LABEL[el] : '-'}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${getPolaritySoftClass(pol)}`}>{pol}</span>
                  </div>
                </div>
              );
            })}
          </div>
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
