import React, { useEffect, useMemo, useState } from 'react';

const LUCKY_COLORS = {
  "최상운수": "bg-indigo-600",
  "상운수": "bg-blue-500",
  "양운수": "bg-emerald-500",
  "평운수": "bg-slate-400",
  "평흉운수": "bg-amber-500",
  "최평운수": "bg-orange-500",
  "흉운수": "bg-rose-500",
  "최흉운수": "bg-red-600",
};

function safeParseArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'string') return [parsed];
  } catch {
    // noop
  }
  if (typeof value === 'string' && value.includes(',')) {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return [String(value)];
}

function replacePlaceholder(text, name) {
  if (!text) return "";
  return text
    .replace(/\[성함\]/g, name || "사용자")
    .replace(/\[ì„±í•¨\]/g, name || "사용자");
}

function DevDbViewer() {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSqlReady, setIsSqlReady] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("전체");
  const [selectedItem, setSelectedItem] = useState(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.js";
    script.async = true;
    script.onload = () => setIsSqlReady(true);
    script.onerror = () => setError("sql.js 로드에 실패했습니다.");
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const levels = useMemo(() => {
    const unique = Array.from(new Set(rows.map((item) => item.lucky_level).filter(Boolean)));
    return ["전체", ...unique];
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows
      .filter((item) => {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          String(item.number ?? "").includes(search) ||
          String(item.title ?? "").toLowerCase().includes(search) ||
          String(item.summary ?? "").toLowerCase().includes(search);
        const matchesLevel = selectedLevel === "전체" || item.lucky_level === selectedLevel;
        return matchesSearch && matchesLevel;
      })
      .sort((a, b) => (a.number || 0) - (b.number || 0));
  }, [rows, searchTerm, selectedLevel]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.initSqlJs) {
      setError("sql.js 초기화 전입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const buffer = await file.arrayBuffer();
      const SQL = await window.initSqlJs({
        locateFile: () => "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm",
      });

      const db = new SQL.Database(new Uint8Array(buffer));
      const stmt = db.prepare("SELECT * FROM sagyeoksu_meanings");
      const list = [];

      while (stmt.step()) {
        const row = stmt.getAsObject();
        list.push({
          ...row,
          personality_traits: safeParseArray(row.personality_traits),
          suitable_career: safeParseArray(row.suitable_career),
          positive_aspects: safeParseArray(row.positive_aspects),
        });
      }

      stmt.free();
      db.close();

      setRows(list);
      setSelectedItem(list[0] || null);
    } catch (err) {
      setError(`DB 파싱 실패: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans text-[var(--ns-text)]">
      <div className="max-w-7xl mx-auto">
        <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-3xl p-6 mb-6">
          <p className="text-xs font-black tracking-widest text-[var(--ns-muted)] uppercase mb-2">Internal Dev Tool</p>
          <h1 className="text-2xl font-black text-[var(--ns-accent-text)] mb-4">사격수리 DB Viewer</h1>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="cursor-pointer">
              <input type="file" accept=".db,.sqlite,.sqlite3" onChange={handleFileUpload} className="hidden" />
              <span className="inline-flex items-center px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold">
                {isLoading ? "읽는 중..." : "DB 파일 선택"}
              </span>
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="이름(치환용)"
              className="px-3 py-2 rounded-xl bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] text-sm"
            />
            <span className="text-xs text-[var(--ns-muted)]">
              {isSqlReady ? "sql.js ready" : "sql.js loading..."}
            </span>
          </div>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-2xl p-4 space-y-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="번호/제목/요약 검색"
                className="w-full px-3 py-2 rounded-xl bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] text-sm"
              />
              <div className="flex flex-wrap gap-2">
                {levels.map((level) => (
                  <button
                    key={level}
                    onClick={() => setSelectedLevel(level)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                      selectedLevel === level ? "bg-indigo-600 text-white" : "bg-[var(--ns-surface-soft)] text-[var(--ns-muted)]"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-2xl overflow-hidden max-h-[65vh] overflow-y-auto">
              {filteredRows.map((item) => (
                <button
                  key={item.number}
                  onClick={() => setSelectedItem(item)}
                  className={`w-full text-left px-4 py-3 border-b border-[var(--ns-border)] hover:bg-[var(--ns-surface-soft)] ${
                    selectedItem?.number === item.number ? "bg-[var(--ns-surface-soft)]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[var(--ns-accent-text)] text-sm">{item.number}. {item.title}</p>
                      <p className="text-xs text-[var(--ns-muted)]">{item.summary}</p>
                    </div>
                    <span className={`text-[10px] text-white px-2 py-1 rounded-full ${LUCKY_COLORS[item.lucky_level] || "bg-slate-500"}`}>
                      {item.lucky_level}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8">
            {!selectedItem && (
              <div className="bg-[var(--ns-surface)] border border-dashed border-[var(--ns-border)] rounded-2xl p-10 text-center text-[var(--ns-muted)]">
                왼쪽 목록에서 항목을 선택하세요.
              </div>
            )}

            {selectedItem && (
              <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-2xl p-6 space-y-6">
                <div>
                  <p className="text-xs text-[var(--ns-muted)] font-black uppercase tracking-widest mb-1">
                    {selectedItem.lucky_level}
                  </p>
                  <h2 className="text-3xl font-black text-[var(--ns-accent-text)]">
                    {selectedItem.number}. {selectedItem.title}
                  </h2>
                  <p className="text-[var(--ns-muted)] mt-2">{selectedItem.summary}</p>
                </div>

                <section>
                  <h3 className="font-black text-[var(--ns-accent-text)] mb-2">종합 해설</h3>
                  <p className="text-[var(--ns-text)] leading-relaxed">
                    {replacePlaceholder(selectedItem.detailed_explanation, userName)}
                  </p>
                </section>

                <section>
                  <h3 className="font-black text-[var(--ns-accent-text)] mb-2">강점</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.positive_aspects.map((itemText) => (
                      <span key={itemText} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg">
                        {replacePlaceholder(itemText, userName)}
                      </span>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="font-black text-[var(--ns-accent-text)] mb-2">주의점</h3>
                  <p className="text-[var(--ns-text)] leading-relaxed">
                    {replacePlaceholder(selectedItem.caution_points, userName)}
                  </p>
                </section>

                <section>
                  <h3 className="font-black text-[var(--ns-accent-text)] mb-2">생애 흐름</h3>
                  <p className="text-[var(--ns-text)] leading-relaxed">
                    {replacePlaceholder(selectedItem.life_period_influence, userName)}
                  </p>
                </section>

                {selectedItem.personality_traits.length > 0 && (
                  <section>
                    <h3 className="font-black text-[var(--ns-accent-text)] mb-2">성향 키워드</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.personality_traits.map((trait) => (
                        <span key={trait} className="px-3 py-1.5 bg-[var(--ns-surface-soft)] text-[var(--ns-text)] text-xs font-semibold rounded-lg">
                          {trait}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {selectedItem.suitable_career.length > 0 && (
                  <section>
                    <h3 className="font-black text-[var(--ns-accent-text)] mb-2">적합 직업</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.suitable_career.map((career) => (
                        <span key={career} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg">
                          {career}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DevDbViewer;
