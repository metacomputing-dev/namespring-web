import React, { useEffect, useMemo, useState } from 'react';
import {
  NamingEvidenceRepository,
  buildNamingEvidenceReport,
} from '@spring/report/naming-evidence/index';

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
  special: '특수',
};

const BAND_LABELS = {
  excellent: '매우 좋음',
  good: '좋음',
  mixed: '혼합',
  caution: '주의',
};

const BAND_STYLES = {
  excellent: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  good: 'bg-sky-100 text-sky-800 border-sky-200',
  mixed: 'bg-amber-100 text-amber-900 border-amber-200',
  caution: 'bg-rose-100 text-rose-800 border-rose-200',
};

const SCORE_ROWS = [
  ['sajuFit', '사주 조화'],
  ['yongshinFit', '용신 적합'],
  ['elementBalance', '오행 균형'],
];

function inputOf(sample) {
  const vector = {
    legal: null,
    sajuFit: sample.sajuFit,
    yongshinFit: sample.yongshinFit,
    elementBalance: sample.elementBalance,
    hanjaMeaning: null,
    phonetic: null,
    eraFit: null,
    familyFit: null,
    risk: 0,
  };
  return {
    springReport: {
      scoreVector: vector,
      namingReport: {
        name: { surname: [], givenName: [], fullHangul: sample.name, fullHanja: '' },
        totalScore: sample.sajuFit,
        scores: { hangul: 70, hanja: 0, fourFrame: 70 },
        scoreVector: vector,
        analysis: {
          hangul: { blocks: [], elementScore: 70, polarityScore: 70 },
          hanja: { blocks: [], elementScore: 0, polarityScore: 0 },
          fourFrame: { frames: [], elementScore: 70, luckScore: 70 },
        },
        interpretation: '',
      },
    },
    sajuAxes: {
      dayMasterElement: sample.dayMasterElement,
      strength: sample.strength,
      yongshinElement: sample.yongshinElement,
      gyeokgukFamily: sample.gyeokgukFamily,
    },
  };
}

function scoreColor(score) {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 65) return 'bg-sky-500';
  if (score >= 46) return 'bg-amber-500';
  return 'bg-rose-500';
}

function AxisValue({ label, value }) {
  return (
    <div className="min-w-0 border-r border-[var(--ns-border)] px-3 py-2 last:border-r-0">
      <p className="text-[10px] font-bold text-[var(--ns-muted)]">{label}</p>
      <p className="mt-0.5 truncate text-sm font-black text-[var(--ns-accent-text)]">{value}</p>
    </div>
  );
}

function DevNamingEvidenceViewer() {
  const [rows, setRows] = useState([]);
  const [contentVersion, setContentVersion] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [strengthFilter, setStrengthFilter] = useState('all');
  const [bandFilter, setBandFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('plain');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const repository = new NamingEvidenceRepository();
    let cancelled = false;
    const load = async () => {
      setStatus('loading');
      setError('');
      try {
        await repository.init();
        const catalog = repository.loadCatalog();
        const loadedRows = repository.findSampleCases().map((sample) => {
          const section = buildNamingEvidenceReport(inputOf(sample), catalog).sections[0];
          return { ...sample, section };
        });
        if (cancelled) return;
        setContentVersion(catalog.contentVersion);
        setRows(loadedRows);
        setSelectedId(loadedRows[0]?.caseId ?? null);
        setStatus('ready');
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : String(loadError));
        setStatus('error');
      }
    };
    void load();
    return () => {
      cancelled = true;
      repository.close();
    };
  }, []);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');
    return rows.filter((row) => {
      const searchText = [
        row.caseId,
        row.name,
        row.dayMasterElement,
        row.yongshinElement,
        row.gyeokgukFamily,
        row.section.plain,
        row.section.detail,
      ].join(' ').toLocaleLowerCase('ko-KR');
      return (!normalizedQuery || searchText.includes(normalizedQuery))
        && (strengthFilter === 'all' || row.strength === strengthFilter)
        && (bandFilter === 'all' || row.section.verdict === bandFilter);
    });
  }, [rows, query, strengthFilter, bandFilter]);

  const selected = rows.find((row) => row.caseId === selectedId) ?? null;

  return (
    <main className="box-border min-h-screen w-full text-[var(--ns-text)] sm:px-3 sm:py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-[1480px] overflow-hidden border-y border-[var(--ns-border)] bg-[var(--ns-surface)] shadow-sm sm:rounded-lg sm:border">
        <header className="flex flex-col gap-3 border-b border-[var(--ns-border)] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
          <div>
            <p className="text-[10px] font-black uppercase text-[var(--ns-muted)]">Internal text review</p>
            <h1 className="mt-1 text-xl font-black text-[var(--ns-accent-text)]">작명 근거 텍스트 Viewer</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-2 py-1 font-bold text-[var(--ns-muted)]">
              {contentVersion || '불러오는 중'}
            </span>
            <span className="rounded border border-[var(--ns-border)] px-2 py-1 font-bold text-[var(--ns-muted)]">
              {rows.length} cases
            </span>
            <span className={`h-2 w-2 rounded-full ${status === 'ready' ? 'bg-emerald-500' : status === 'error' ? 'bg-rose-500' : 'bg-amber-500'}`} aria-label={status} />
          </div>
        </header>

        <section className="grid min-h-[calc(100vh-130px)] grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="min-w-0 border-b border-[var(--ns-border)] lg:border-b-0 lg:border-r">
            <div className="space-y-3 border-b border-[var(--ns-border)] p-3">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="이름, case ID, 본문 검색"
                className="h-10 w-full rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 text-sm outline-none focus:border-sky-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={strengthFilter}
                  onChange={(event) => setStrengthFilter(event.target.value)}
                  className="h-9 min-w-0 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2 text-xs font-bold"
                  aria-label="신강약 필터"
                >
                  <option value="all">신강약 전체</option>
                  <option value="weak">신약</option>
                  <option value="balanced">중화</option>
                  <option value="strong">신강</option>
                </select>
                <select
                  value={bandFilter}
                  onChange={(event) => setBandFilter(event.target.value)}
                  className="h-9 min-w-0 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2 text-xs font-bold"
                  aria-label="평가 필터"
                >
                  <option value="all">평가 전체</option>
                  {Object.entries(BAND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="max-h-[52vh] overflow-y-auto lg:max-h-[calc(100vh-277px)]">
              {status === 'loading' && (
                <p className="px-4 py-8 text-center text-sm text-[var(--ns-muted)]">DB를 확인하고 있어요.</p>
              )}
              {status === 'error' && (
                <div className="m-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  {error}
                </div>
              )}
              {status === 'ready' && filteredRows.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-[var(--ns-muted)]">조건에 맞는 결과가 없습니다.</p>
              )}
              {filteredRows.map((row) => (
                <button
                  key={row.caseId}
                  type="button"
                  onClick={() => { setSelectedId(row.caseId); setActiveTab('plain'); }}
                  className={`block box-border w-full min-w-0 max-w-full overflow-hidden border-b border-[var(--ns-border)] px-4 py-3 text-left transition-colors hover:bg-[var(--ns-surface-soft)] ${
                    row.caseId === selectedId ? 'bg-sky-50' : ''
                  }`}
                >
                  <div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[var(--ns-accent-text)]">
                        {row.name}
                        <span className={`ml-2 inline-flex align-middle rounded border px-2 py-1 text-[10px] font-black ${BAND_STYLES[row.section.verdict]}`}>
                          {BAND_LABELS[row.section.verdict]}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[10px] font-bold text-[var(--ns-muted)]">{row.caseId}</p>
                    </div>
                  </div>
                  <p className="mt-2 truncate text-xs text-[var(--ns-muted)]">
                    {ELEMENT_LABELS[row.dayMasterElement]} · {STRENGTH_LABELS[row.strength]} · {ELEMENT_LABELS[row.yongshinElement]} · {GYEOKGUK_LABELS[row.gyeokgukFamily]}
                  </p>
                </button>
              ))}
            </div>
            <p className="border-t border-[var(--ns-border)] px-4 py-2 text-[10px] font-bold text-[var(--ns-muted)]">
              {filteredRows.length} / {rows.length}
            </p>
          </aside>

          <article
            className="min-w-0 bg-white"
            style={{
              '--ns-text': '#334155',
              '--ns-accent-text': '#0f172a',
              '--ns-muted': '#64748b',
              '--ns-border': '#d8dee6',
              '--ns-surface': '#ffffff',
              '--ns-surface-soft': '#f8fafc',
            }}
          >
            {!selected && status === 'ready' && (
              <p className="p-10 text-center text-sm text-[var(--ns-muted)]">검토할 케이스를 선택하세요.</p>
            )}
            {selected && (
              <>
                <div className="border-b border-[var(--ns-border)] px-4 py-5 md:px-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black text-[var(--ns-muted)]">{selected.caseId}</p>
                      <h2 className="mt-1 text-2xl font-black text-[var(--ns-accent-text)]">{selected.name}</h2>
                    </div>
                    <span className={`w-fit rounded border px-2.5 py-1 text-xs font-black ${BAND_STYLES[selected.section.verdict]}`}>
                      {BAND_LABELS[selected.section.verdict]}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--ns-border)] sm:grid-cols-4">
                    <AxisValue label="일간" value={ELEMENT_LABELS[selected.dayMasterElement]} />
                    <AxisValue label="신강약" value={STRENGTH_LABELS[selected.strength]} />
                    <AxisValue label="용신" value={ELEMENT_LABELS[selected.yongshinElement]} />
                    <AxisValue label="격국" value={GYEOKGUK_LABELS[selected.gyeokgukFamily]} />
                  </div>
                </div>

                <div className="grid border-b border-[var(--ns-border)] md:grid-cols-3">
                  {SCORE_ROWS.map(([key, label]) => {
                    const score = selected[key];
                    return (
                      <div key={key} className="border-b border-[var(--ns-border)] px-4 py-3 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[var(--ns-muted)]">{label}</span>
                          <strong className="text-[var(--ns-accent-text)]">{score}</strong>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full ${scoreColor(score)}`} style={{ width: `${score}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-b border-[var(--ns-border)] px-4 pt-3 md:px-6">
                  <div className="flex gap-1" role="tablist" aria-label="텍스트 보기">
                    {[
                      ['plain', '자연어 설명'],
                      ['detail', '상세 근거'],
                      ['fragments', '조립 정보'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === value}
                        onClick={() => setActiveTab(value)}
                        className={`border-b-2 px-3 py-2 text-xs font-black ${
                          activeTab === value
                            ? 'border-sky-600 text-sky-700'
                            : 'border-transparent text-[var(--ns-muted)] hover:text-[var(--ns-text)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="px-4 py-6 md:px-6 md:py-8">
                  {activeTab === 'plain' && (
                    <section className="mx-auto max-w-4xl">
                      <h3 className="text-sm font-black text-[var(--ns-accent-text)]">사주에 필요한 방향과 맞는가</h3>
                      <p className="mt-4 whitespace-pre-wrap text-[15px] leading-8 text-[var(--ns-text)]">{selected.section.plain}</p>
                    </section>
                  )}
                  {activeTab === 'detail' && (
                    <section className="mx-auto max-w-4xl">
                      <h3 className="text-sm font-black text-[var(--ns-accent-text)]">전문 근거</h3>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--ns-text)]">{selected.section.detail}</p>
                    </section>
                  )}
                  {activeTab === 'fragments' && (
                    <section className="mx-auto max-w-4xl">
                      <div className="overflow-hidden rounded-lg border border-[var(--ns-border)]">
                        {selected.section.fragmentKeys.map((key, index) => (
                          <div key={key} className="grid grid-cols-[36px_minmax(0,1fr)] border-b border-[var(--ns-border)] last:border-b-0">
                            <span className="bg-[var(--ns-surface-soft)] px-2 py-3 text-center text-xs font-black text-[var(--ns-muted)]">{index + 1}</span>
                            <code className="min-w-0 break-all px-3 py-3 text-xs text-[var(--ns-text)]">{key}</code>
                          </div>
                        ))}
                      </div>
                      <dl className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[var(--ns-border)] bg-[var(--ns-border)] sm:grid-cols-2">
                        <div className="bg-white p-3">
                          <dt className="text-[10px] font-bold text-[var(--ns-muted)]">결론 유형</dt>
                          <dd className="mt-1 font-mono text-xs text-[var(--ns-text)]">{selected.section.conclusionTone}</dd>
                        </div>
                        <div className="bg-white p-3">
                          <dt className="text-[10px] font-bold text-[var(--ns-muted)]">콘텐츠 상태</dt>
                          <dd className="mt-1 font-mono text-xs text-[var(--ns-text)]">{selected.section.availability}</dd>
                        </div>
                      </dl>
                    </section>
                  )}
                </div>
              </>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}

export default DevNamingEvidenceViewer;
