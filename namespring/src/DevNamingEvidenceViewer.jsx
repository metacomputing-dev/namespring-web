import React, { useEffect, useMemo, useState } from 'react';

const ELEMENT_LABELS = {
  WOOD: '목',
  FIRE: '화',
  EARTH: '토',
  METAL: '금',
  WATER: '수',
};

const STRENGTH_LABELS = {
  weak: '신약',
  balanced: '중화',
  strong: '신강',
};

const GYEOKGUK_LABELS = {
  inseong: '인성',
  siksang: '식상',
  jaeseong: '재성',
  gwanseong: '관성',
  bigeop: '비겁',
  special: '특수격',
};

const SOURCE_LABELS = {
  balance: '오행 균형',
  yongshin: '용신 관계',
  strength: '신강약 조절',
  tenGod: '십신 보완',
  deficiency: '부족 오행 보완',
  harmfulElement: '기신·구신 제한',
  gyeokgukProtection: '종격 보호',
};

const STATE_LABELS = {
  improves: '균형 개선',
  holds: '균형 유지',
  worsens: '치우침 증가',
  yongshin: '용신 일치',
  heesin: '희신 일치',
  neutral: '중립',
  supportsNeededDirection: '필요 방향 보완',
  mixed: '양쪽 성분 포함',
  opposesNeededDirection: '필요 방향과 반대',
  fillsDeficit: '부족 계열 보완',
  reinforcesExcess: '과한 계열 강화',
  yongshinDeficiencyFilled: '부족한 용신 보완',
  heesinDeficiencyFilled: '부족한 희신 보완',
  gisinPresent: '기신 포함',
  gusinPresent: '구신 포함',
  protected: '종격 보호',
  broken: '종격 훼손',
};

const CONCLUSION_LABELS = {
  allPositive: '긍정 근거 일치',
  mostlyPositive: '긍정 우세',
  mixedButUsable: '장단점 혼재',
  needsCaution: '비교 필요',
  insufficientEvidence: '근거 부족',
};

function TextWithTokens({ children }) {
  const parts = String(children || '').split(/(\{\{[^}]+\}\})/gu);
  return parts.map((part, index) => part.startsWith('{{')
    ? <code key={`${part}-${index}`} className="rounded bg-sky-50 px-1 py-0.5 text-[0.92em] font-bold text-sky-700">{part}</code>
    : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>);
}

function AxisValue({ label, value, code }) {
  return (
    <div className="min-w-0 border-r border-[var(--ns-border)] px-3 py-2 last:border-r-0">
      <p className="text-[10px] font-bold text-[var(--ns-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-black text-[var(--ns-accent-text)]">{value}</p>
      {code && <p className="mt-0.5 truncate font-mono text-[9px] text-[var(--ns-muted)]">{code}</p>}
    </div>
  );
}

function TextPair({ plain, detail }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-md border border-[var(--ns-border)] bg-[var(--ns-border)] lg:grid-cols-2">
      <section className="bg-white p-4 md:p-5">
        <h3 className="text-[11px] font-black text-emerald-700">기본 설명</h3>
        <p className="mt-3 text-[15px] leading-8 text-[var(--ns-text)]"><TextWithTokens>{plain}</TextWithTokens></p>
      </section>
      <section className="bg-white p-4 md:p-5">
        <h3 className="text-[11px] font-black text-sky-700">상세 근거</h3>
        <p className="mt-3 text-sm leading-7 text-[var(--ns-text)]"><TextWithTokens>{detail}</TextWithTokens></p>
      </section>
    </div>
  );
}

function DevNamingEvidenceViewer() {
  const [payload, setPayload] = useState(null);
  const [selectedRun, setSelectedRun] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedVariantKey, setSelectedVariantKey] = useState('');
  const [activeView, setActiveView] = useState('axis');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const loadRun = async (runName = '') => {
    setStatus('loading');
    setError('');
    try {
      const suffix = runName ? `?run=${encodeURIComponent(runName)}` : '';
      const response = await fetch(`/__dev/naming-evidence${suffix}`, { cache: 'no-store' });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || `HTTP ${response.status}`);
      setPayload(next);
      setSelectedRun(next.selectedRun || '');
      const firstSample = next.samples?.[0];
      setSelectedTaskId(firstSample?.taskId || '');
      setSelectedVariantKey(firstSample?.axisVariants?.[0]?.key || '');
      setStatus('ready');
    } catch (loadError) {
      setStatus('error');
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  };

  useEffect(() => { void loadRun(); }, []);

  const selectedSample = useMemo(
    () => payload?.samples?.find(({ taskId }) => taskId === selectedTaskId) || payload?.samples?.[0] || null,
    [payload, selectedTaskId],
  );
  const selectedVariant = useMemo(
    () => selectedSample?.axisVariants?.find(({ key }) => key === selectedVariantKey)
      || selectedSample?.axisVariants?.[0]
      || null,
    [selectedSample, selectedVariantKey],
  );

  const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');
  const sourceRows = useMemo(() => (payload?.draft?.sourceEvidenceExplanations || []).filter((row) => {
    if (!normalizedQuery) return true;
    return [row.sourceId, row.state, row.plain, row.detail, SOURCE_LABELS[row.sourceId], STATE_LABELS[row.state]]
      .join(' ')
      .toLocaleLowerCase('ko-KR')
      .includes(normalizedQuery);
  }), [payload, normalizedQuery]);
  const conclusionRows = payload?.draft?.conclusionExplanations || [];

  const chooseSample = (sample) => {
    setSelectedTaskId(sample.taskId);
    setSelectedVariantKey(sample.axisVariants?.[0]?.key || '');
    setActiveView('axis');
  };

  return (
    <main
      className="box-border min-h-screen w-full bg-slate-100 text-[var(--ns-text)] sm:px-3 sm:py-4 md:px-6"
      style={{
        '--ns-text': '#334155',
        '--ns-accent-text': '#0f172a',
        '--ns-muted': '#64748b',
        '--ns-border': '#d8dee6',
        '--ns-surface': '#ffffff',
        '--ns-surface-soft': '#f8fafc',
      }}
    >
      <div className="mx-auto max-w-[1540px] overflow-hidden border-y border-[var(--ns-border)] bg-white shadow-sm sm:rounded-lg sm:border">
        <header className="flex flex-col gap-4 border-b border-[var(--ns-border)] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
          <div>
            <p className="text-[10px] font-black uppercase text-[var(--ns-muted)]">Internal text review</p>
            <h1 className="mt-1 text-xl font-black text-[var(--ns-accent-text)]">작명 근거 생성 텍스트 검토</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedRun}
              onChange={(event) => void loadRun(event.target.value)}
              className="h-9 max-w-[260px] rounded-md border border-[var(--ns-border)] bg-white px-2 text-xs font-bold"
              aria-label="생성 실행 선택"
            >
              {(payload?.runs || []).map((run) => <option key={run.name} value={run.name}>{run.name}</option>)}
            </select>
            <span className="rounded border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-2 py-1 text-xs font-bold text-[var(--ns-muted)]">
              {payload?.draft ? `${payload.draft.sajuAxisExplanations.length + payload.draft.sourceEvidenceExplanations.length + payload.draft.conclusionExplanations.length}문안` : '불러오는 중'}
            </span>
            <span className={`h-2 w-2 rounded-full ${status === 'ready' ? 'bg-emerald-500' : status === 'error' ? 'bg-rose-500' : 'bg-amber-500'}`} aria-label={status} />
          </div>
        </header>

        {status === 'error' && <div className="border-b border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">{error}</div>}

        <div className="grid min-h-[calc(100vh-130px)] grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="border-b border-[var(--ns-border)] bg-[var(--ns-surface-soft)] lg:border-b-0 lg:border-r">
            <div className="border-b border-[var(--ns-border)] px-4 py-3">
              <p className="text-[10px] font-black text-[var(--ns-muted)]">사주 축 샘플</p>
            </div>
            <div>
              {(payload?.samples || []).map((sample) => {
                const context = sample.context;
                const active = sample.taskId === selectedSample?.taskId;
                return (
                  <button
                    key={sample.taskId}
                    type="button"
                    onClick={() => chooseSample(sample)}
                    className={`block w-full border-b border-[var(--ns-border)] px-4 py-4 text-left transition-colors ${active ? 'bg-sky-50' : 'hover:bg-white'}`}
                  >
                    <p className="text-xs font-black text-[var(--ns-accent-text)]">샘플 {sample.sampleNumber}</p>
                    <p className="mt-1 text-sm font-bold text-[var(--ns-text)]">
                      {ELEMENT_LABELS[context.dayMasterElement.code]} 일간 · {STRENGTH_LABELS[context.strength.code]} · {ELEMENT_LABELS[context.yongshinElement.code]} 용신
                    </p>
                    <p className="mt-1 truncate font-mono text-[9px] text-[var(--ns-muted)]">{sample.taskId}</p>
                  </button>
                );
              })}
            </div>
            {selectedSample && (
              <div className="border-t border-[var(--ns-border)] px-3 py-3">
                <p className="px-1 text-[10px] font-black text-[var(--ns-muted)]">격국 문안</p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {selectedSample.axisVariants.map((variant) => {
                    const gyeokguk = variant.key.split('/').at(-1);
                    return (
                      <button
                        key={variant.key}
                        type="button"
                        onClick={() => { setSelectedVariantKey(variant.key); setActiveView('axis'); }}
                        className={`h-9 rounded-md border px-2 text-xs font-bold ${variant.key === selectedVariant?.key ? 'border-sky-500 bg-white text-sky-700' : 'border-[var(--ns-border)] bg-slate-50 text-[var(--ns-text)] hover:bg-white'}`}
                      >
                        {GYEOKGUK_LABELS[gyeokguk] || gyeokguk}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>

          <article className="min-w-0 bg-white">
            <div className="border-b border-[var(--ns-border)] px-4 md:px-6">
              <div className="flex min-h-12 flex-wrap items-end gap-1" role="tablist" aria-label="근거 문안 보기">
                {[
                  ['axis', '사주 4축 문안', payload?.draft?.sajuAxisExplanations?.length],
                  ['source', '원천 근거', payload?.draft?.sourceEvidenceExplanations?.length],
                  ['conclusion', '결론', payload?.draft?.conclusionExplanations?.length],
                ].map(([value, label, count]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={activeView === value}
                    onClick={() => setActiveView(value)}
                    className={`border-b-2 px-3 py-3 text-xs font-black ${activeView === value ? 'border-sky-600 text-sky-700' : 'border-transparent text-[var(--ns-muted)] hover:text-[var(--ns-text)]'}`}
                  >
                    {label} <span className="ml-1 font-mono text-[10px]">{count || 0}</span>
                  </button>
                ))}
              </div>
            </div>

            {activeView === 'axis' && selectedSample && selectedVariant && (
              <div>
                <div className="border-b border-[var(--ns-border)] px-4 py-5 md:px-6">
                  <p className="font-mono text-[10px] text-[var(--ns-muted)]">{selectedVariant.key}</p>
                  <h2 className="mt-1 text-xl font-black text-[var(--ns-accent-text)]">
                    {GYEOKGUK_LABELS[selectedVariant.key.split('/').at(-1)]} 작명 방향
                  </h2>
                  <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-md border border-[var(--ns-border)] sm:grid-cols-4">
                    <AxisValue label="일간" value={ELEMENT_LABELS[selectedSample.context.dayMasterElement.code]} code={selectedSample.context.dayMasterElement.code} />
                    <AxisValue label="신강약" value={STRENGTH_LABELS[selectedSample.context.strength.code]} code={selectedSample.context.strength.code} />
                    <AxisValue label="용신" value={ELEMENT_LABELS[selectedSample.context.yongshinElement.code]} code={selectedSample.context.yongshinElement.code} />
                    <AxisValue label="격국" value={GYEOKGUK_LABELS[selectedVariant.key.split('/').at(-1)]} code={selectedVariant.key.split('/').at(-1)} />
                  </div>
                </div>
                <div className="p-4 md:p-6"><TextPair plain={selectedVariant.plain} detail={selectedVariant.detail} /></div>
              </div>
            )}

            {activeView === 'source' && (
              <div>
                <div className="border-b border-[var(--ns-border)] p-4 md:px-6">
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="근거, 상태, 문장 검색"
                    className="h-10 w-full max-w-md rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 text-sm outline-none focus:border-sky-500"
                  />
                </div>
                <div className="divide-y divide-[var(--ns-border)]">
                  {sourceRows.map((row) => (
                    <section key={`${row.sourceId}-${row.state}`} className="px-4 py-5 md:px-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-black text-[var(--ns-accent-text)]">{SOURCE_LABELS[row.sourceId] || row.sourceId}</h2>
                        <span className="rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">{STATE_LABELS[row.state] || row.state}</span>
                        <span className="font-mono text-[10px] text-[var(--ns-muted)]">최대 영향 {row.weight}점</span>
                      </div>
                      <p className="mt-1 font-mono text-[9px] text-[var(--ns-muted)]">source/{row.sourceId}/{row.state}</p>
                      <div className="mt-3"><TextPair plain={row.plain} detail={row.detail} /></div>
                    </section>
                  ))}
                  {sourceRows.length === 0 && <p className="px-6 py-12 text-center text-sm text-[var(--ns-muted)]">검색 결과가 없습니다.</p>}
                </div>
              </div>
            )}

            {activeView === 'conclusion' && (
              <div className="divide-y divide-[var(--ns-border)]">
                {conclusionRows.map((row) => (
                  <section key={row.tone} className="px-4 py-5 md:px-6">
                    <h2 className="text-sm font-black text-[var(--ns-accent-text)]">{CONCLUSION_LABELS[row.tone] || row.tone}</h2>
                    <p className="mt-1 font-mono text-[9px] text-[var(--ns-muted)]">conclusion/sajuFit/{row.tone}</p>
                    <div className="mt-3"><TextPair plain={row.plain} detail={row.detail} /></div>
                  </section>
                ))}
              </div>
            )}
          </article>
        </div>
      </div>
    </main>
  );
}

export default DevNamingEvidenceViewer;
