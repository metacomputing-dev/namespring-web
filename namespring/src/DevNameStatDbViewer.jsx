import React, { useEffect, useMemo, useState } from 'react';

function parseJsonSafe(value, fallback) {
  if (!value) return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function DevNameStatDbViewer() {
  const [isSqlReady, setIsSqlReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dbInfo, setDbInfo] = useState({ fileName: '', totalRows: 0 });

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.js';
    script.async = true;
    script.onload = () => setIsSqlReady(true);
    script.onerror = () => setError('sql.js 로드 실패');
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      String(r.name ?? '').toLowerCase().includes(q) ||
      String(r.first_char ?? '').toLowerCase().includes(q) ||
      String(r.first_choseong ?? '').toLowerCase().includes(q)
    );
  }, [rows, searchTerm]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.initSqlJs) {
      setError('sql.js가 아직 준비되지 않았습니다.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const buf = await file.arrayBuffer();
      const SQL = await window.initSqlJs({
        locateFile: () => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm',
      });
      const db = new SQL.Database(new Uint8Array(buf));

      const tableCheck = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='name_stats'");
      if (!tableCheck.length) {
        db.close();
        throw new Error('name_stats 테이블이 없는 DB입니다.');
      }

      const countRes = db.exec('SELECT COUNT(*) AS cnt FROM name_stats');
      const totalRows = Number(countRes?.[0]?.values?.[0]?.[0] ?? 0);

      const stmt = db.prepare(`
        SELECT id, name, first_char, first_choseong, similar_names_json,
               yearly_rank_json, yearly_birth_json, hanja_combinations_json, raw_entry_json
        FROM name_stats
        ORDER BY name ASC
        LIMIT 3000
      `);
      const list = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        list.push({
          ...row,
          similar_names: parseJsonSafe(row.similar_names_json, []),
          yearly_rank: parseJsonSafe(row.yearly_rank_json, {}),
          yearly_birth: parseJsonSafe(row.yearly_birth_json, {}),
          hanja_combinations: parseJsonSafe(row.hanja_combinations_json, []),
          raw_entry: parseJsonSafe(row.raw_entry_json, {}),
        });
      }
      stmt.free();
      db.close();

      setDbInfo({ fileName: file.name, totalRows });
      setRows(list);
      setSelected(list[0] || null);
    } catch (err) {
      setError(`DB 파싱 실패: ${err.message}`);
      setRows([]);
      setSelected(null);
      setDbInfo({ fileName: '', totalRows: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 mb-6">
          <p className="text-xs font-black tracking-widest text-slate-400 uppercase mb-2">Internal Dev Tool</p>
          <h1 className="text-2xl font-black text-slate-800 mb-4">NameStat Shard DB Viewer</h1>
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer">
              <input type="file" accept=".db,.sqlite,.sqlite3" className="hidden" onChange={handleUpload} />
              <span className="inline-flex items-center px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold">
                {isLoading ? '읽는 중...' : '샤드 DB 선택'}
              </span>
            </label>
            <span className="text-xs text-slate-500">{isSqlReady ? 'sql.js ready' : 'sql.js loading...'}</span>
            {dbInfo.fileName && (
              <span className="text-xs font-semibold text-slate-600">
                {dbInfo.fileName} / total {dbInfo.totalRows} rows (viewer shows up to 3000)
              </span>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="name / first_char / choseong 검색"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm"
              />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden max-h-[65vh] overflow-y-auto">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${
                    selected?.id === item.id ? 'bg-indigo-50' : ''
                  }`}
                >
                  <p className="font-bold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">초성 {item.first_choseong} / 첫글자 {item.first_char}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8">
            {!selected && (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">
                왼쪽 목록에서 이름을 선택하세요.
              </div>
            )}
            {selected && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                <div>
                  <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-1">Name</p>
                  <h2 className="text-3xl font-black text-slate-900">{selected.name}</h2>
                  <p className="text-sm text-slate-500 mt-1">first_char: {selected.first_char} / first_choseong: {selected.first_choseong}</p>
                </div>

                <section>
                  <h3 className="font-black text-slate-800 mb-2">similar_names</h3>
                  <div className="flex flex-wrap gap-2">
                    {(selected.similar_names || []).slice(0, 80).map((n) => (
                      <span key={n} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg">{n}</span>
                    ))}
                  </div>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h3 className="font-black text-slate-700 mb-2">yearly_rank</h3>
                    <pre className="text-xs text-slate-600 overflow-auto max-h-56">{JSON.stringify(selected.yearly_rank, null, 2)}</pre>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h3 className="font-black text-slate-700 mb-2">yearly_birth</h3>
                    <pre className="text-xs text-slate-600 overflow-auto max-h-56">{JSON.stringify(selected.yearly_birth, null, 2)}</pre>
                  </div>
                </section>

                <section>
                  <h3 className="font-black text-slate-800 mb-2">hanja_combinations</h3>
                  <pre className="text-xs text-slate-600 bg-slate-50 rounded-xl p-4 overflow-auto max-h-56">
                    {JSON.stringify(selected.hanja_combinations, null, 2)}
                  </pre>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DevNameStatDbViewer;
