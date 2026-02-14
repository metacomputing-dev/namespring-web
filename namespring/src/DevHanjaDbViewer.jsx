import React, { useEffect, useMemo, useState } from 'react';

function toYesNo(value) {
  return Number(value) === 1 ? '성씨 가능' : '일반 한자';
}

function DevHanjaDbViewer() {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSqlReady, setIsSqlReady] = useState(false);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [surnameOnly, setSurnameOnly] = useState(false);
  const [selectedElement, setSelectedElement] = useState('전체');
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.js';
    script.async = true;
    script.onload = () => setIsSqlReady(true);
    script.onerror = () => setError('sql.js 로드에 실패했습니다.');
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const elementOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.resource_element).filter(Boolean));
    return ['전체', ...Array.from(set)];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((item) => {
      const matchesText =
        !q ||
        String(item.hangul ?? '').toLowerCase().includes(q) ||
        String(item.hanja ?? '').toLowerCase().includes(q) ||
        String(item.meaning ?? '').toLowerCase().includes(q) ||
        String(item.radical ?? '').toLowerCase().includes(q);

      const matchesSurname = !surnameOnly || Number(item.is_surname) === 1;
      const matchesElement = selectedElement === '전체' || item.resource_element === selectedElement;

      return matchesText && matchesSurname && matchesElement;
    });
  }, [rows, searchTerm, surnameOnly, selectedElement]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.initSqlJs) {
      setError('sql.js 초기화 전입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const buffer = await file.arrayBuffer();
      const SQL = await window.initSqlJs({
        locateFile: () => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm',
      });

      const db = new SQL.Database(new Uint8Array(buffer));
      const stmt = db.prepare('SELECT * FROM hanjas');
      const list = [];

      while (stmt.step()) {
        list.push(stmt.getAsObject());
      }

      stmt.free();
      db.close();

      list.sort((a, b) => String(a.hangul || '').localeCompare(String(b.hangul || '')));
      setRows(list);
      setSelectedRow(list[0] || null);
    } catch (err) {
      setError(`DB 파싱 실패: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 mb-6">
          <p className="text-xs font-black tracking-widest text-slate-400 uppercase mb-2">Internal Dev Tool</p>
          <h1 className="text-2xl font-black text-slate-800 mb-4">한자 DB Viewer</h1>
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer">
              <input type="file" accept=".db,.sqlite,.sqlite3" onChange={handleFileUpload} className="hidden" />
              <span className="inline-flex items-center px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold">
                {isLoading ? '읽는 중...' : 'hanja.db 선택'}
              </span>
            </label>
            <span className="text-xs text-slate-500">{isSqlReady ? 'sql.js ready' : 'sql.js loading...'}</span>
          </div>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="훈음/한자/의미/부수 검색"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSurnameOnly((v) => !v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                    surnameOnly ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  성씨만 보기
                </button>
                {elementOptions.map((el) => (
                  <button
                    key={el}
                    type="button"
                    onClick={() => setSelectedElement(el)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                      selectedElement === el ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {el}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden max-h-[65vh] overflow-y-auto">
              {filteredRows.map((item) => (
                <button
                  key={`${item.id}-${item.hanja}`}
                  onClick={() => setSelectedRow(item)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${
                    selectedRow?.id === item.id ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900 text-lg leading-none">{item.hanja}</p>
                      <p className="text-sm font-bold text-slate-700">{item.hangul}</p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.meaning}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-slate-500">{item.strokes}획</p>
                      <p className="text-[10px] text-slate-400">{toYesNo(item.is_surname)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7">
            {!selectedRow && (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">
                왼쪽 목록에서 한자를 선택하세요.
              </div>
            )}

            {selectedRow && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs font-black tracking-widest text-slate-400 uppercase mb-1">Hanja Entry</p>
                    <h2 className="text-5xl font-black text-slate-900 leading-none">{selectedRow.hanja}</h2>
                    <p className="text-xl font-bold text-slate-700 mt-2">{selectedRow.hangul}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-600">
                    {toYesNo(selectedRow.is_surname)}
                  </span>
                </div>

                <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase">획수</p>
                    <p className="text-lg font-bold text-slate-800">{selectedRow.strokes}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase">초성</p>
                    <p className="text-lg font-bold text-slate-800">{selectedRow.onset || '-'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase">중성</p>
                    <p className="text-lg font-bold text-slate-800">{selectedRow.nucleus || '-'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase">획수 오행</p>
                    <p className="text-lg font-bold text-slate-800">{selectedRow.stroke_element || '-'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase">자원 오행</p>
                    <p className="text-lg font-bold text-slate-800">{selectedRow.resource_element || '-'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase">부수</p>
                    <p className="text-lg font-bold text-slate-800">{selectedRow.radical || '-'}</p>
                  </div>
                </section>

                <section>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">의미</p>
                  <p className="text-slate-700 leading-relaxed">{selectedRow.meaning || '-'}</p>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DevHanjaDbViewer;
