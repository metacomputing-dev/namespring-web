const ELEMENT_CLASS_BY_NAME = {
  Wood: 'bg-emerald-500',
  木: 'bg-emerald-500',
  목: 'bg-emerald-500',
  Fire: 'bg-rose-500',
  火: 'bg-rose-500',
  화: 'bg-rose-500',
  Earth: 'bg-amber-500',
  土: 'bg-amber-500',
  토: 'bg-amber-500',
  Metal: 'bg-slate-400',
  金: 'bg-slate-400',
  금: 'bg-slate-400',
  Water: 'bg-slate-800',
  水: 'bg-slate-800',
  수: 'bg-slate-800',
};

function normalizeLabel(value) {
  if (!value) {
    return '-';
  }
  if (typeof value === 'object') {
    return value.korean || value.english || value.symbol || '-';
  }
  return String(value);
}

function getElementClass(element) {
  const label = normalizeLabel(element);
  return ELEMENT_CLASS_BY_NAME[label] || 'bg-slate-300';
}

function getStrokes(entry) {
  return entry?.strokes ?? entry?.strokeCount ?? '-';
}

function joinName(entries, key) {
  return (entries || []).map((item) => item?.[key] || '').join('');
}

function NamingReport({ result }) {
  if (!result) {
    return null;
  }

  const { lastName = [], firstName = [], totalScore = 0, hanja, hangul, interpretation } = result;
  const hanjaBlocks = typeof hanja?.getNameBlocks === 'function' ? hanja.getNameBlocks() : [];
  const hangulBlocks = typeof hangul?.getNameBlocks === 'function' ? hangul.getNameBlocks() : [];

  const fullNameHanja = joinName([...lastName, ...firstName], 'hanja');
  const fullNameHangul = joinName([...lastName, ...firstName], 'hangul');

  return (
    <div className="mt-12 space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-1000">
      <section className="bg-slate-900 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <h2 className="text-indigo-400 font-black text-sm uppercase tracking-widest mb-4">Overall Result</h2>
            <div className="text-8xl font-black tracking-tighter mb-4">
              {totalScore}
              <span className="text-2xl text-slate-500 ml-2">pts</span>
            </div>
            <p className="text-slate-300 text-lg leading-relaxed max-w-md italic">"{interpretation || ''}"</p>
          </div>
          <div className="flex flex-col items-center md:items-end border-l border-white/10 pl-8">
            <div className="text-7xl font-serif mb-2 tracking-[0.2em]">{fullNameHanja || '-'}</div>
            <div className="text-2xl font-black tracking-[0.6em] text-indigo-300">{fullNameHangul || '-'}</div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px]"></div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl">
          <h3 className="font-black text-slate-400 text-[11px] uppercase tracking-widest mb-8 flex items-center gap-2">
            <span className="w-2 h-2 bg-rose-500 rounded-full"></span> 발음 오행 분석 (Phonetic Energy)
          </h3>
          <div className="flex gap-4 justify-around">
            {hangulBlocks.map((block, index) => (
              <div key={`hangul-${index}`} className="flex-1 text-center">
                <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-3xl font-black text-rose-600 mx-auto mb-4 shadow-sm">
                  {block?.entry?.hangul || '-'}
                </div>
                <div
                  className={`inline-block px-3 py-1 rounded-full text-white text-[10px] font-black uppercase mb-1 ${getElementClass(block?.energy?.element)}`}
                >
                  {normalizeLabel(block?.energy?.element)}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  {normalizeLabel(block?.energy?.polarity)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl">
          <h3 className="font-black text-slate-400 text-[11px] uppercase tracking-widest mb-8 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> 자원 오행 분석 (Resource Balance)
          </h3>
          <div className="space-y-4">
            {hanjaBlocks.map((block, index) => (
              <div
                key={`hanja-${index}`}
                className="flex items-center justify-between p-5 bg-emerald-50/50 rounded-3xl border border-emerald-100"
              >
                <div className="flex items-center gap-5">
                  <div className="text-4xl font-serif font-black text-emerald-900">{block?.entry?.hanja || '-'}</div>
                  <div>
                    <div className="text-sm font-black text-slate-800">{block?.entry?.meaning || '의미 정보 없음'}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">
                      {getStrokes(block?.entry)} STROKES
                    </div>
                  </div>
                </div>
                <div
                  className={`px-4 py-2 rounded-2xl text-white text-xs font-black shadow-sm ${getElementClass(block?.energy?.element)}`}
                >
                  {normalizeLabel(block?.energy?.element)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex-1 py-5 bg-white border-2 border-slate-200 rounded-3xl font-black text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
        >
          PRINT REPORT
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex-1 py-5 bg-indigo-600 text-white rounded-3xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"
        >
          NEW ANALYSIS
        </button>
      </div>
    </div>
  );
}

export default NamingReport;

