import NamingReport from './NamingReport';
import HanjaSelectionModal from './components/HanjaSelectionModal';
import NameInputSection from './components/NameInputSection';
import { useNameAnalysisForm } from './hooks/useNameAnalysisForm';

function App() {
  const {
    isDbReady,
    lastNameHangul,
    setLastNameHangul,
    firstNameHangul,
    setFirstNameHangul,
    birthDate,
    setBirthDate,
    birthTime,
    setBirthTime,
    selectedSurnameEntries,
    selectedFirstNameEntries,
    isModalOpen,
    modalTarget,
    hanjaOptions,
    analysisResult,
    openHanjaModal,
    closeHanjaModal,
    handleSelectHanja,
    analyzeName,
  } = useNameAnalysisForm();

  if (!isDbReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="text-center animate-pulse">
          <div className="w-16 h-16 bg-indigo-600 rounded-full mb-4 mx-auto shadow-xl"></div>
          <p className="text-slate-400 font-black tracking-widest text-[10px] uppercase">Loading Engine...</p>
        </div>
      </div>
    );
  }

  const topCandidate = analysisResult?.candidates?.[0] ?? null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6 font-sans">
      <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-black text-indigo-600 mb-2">이름 풀이</h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
            Professional Naming Analysis
          </p>
        </header>

        {!topCandidate && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <section className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Birth Date</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Birth Time</label>
                <input
                  type="time"
                  value={birthTime}
                  onChange={(event) => setBirthTime(event.target.value)}
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold"
                />
              </div>
            </section>

            <section className="space-y-6">
              <NameInputSection
                label="Surname (Family Name)"
                value={lastNameHangul}
                onChange={setLastNameHangul}
                maxLength={2}
                placeholder="성"
                selectedEntries={selectedSurnameEntries}
                onSelectCharacter={openHanjaModal}
                targetType="last"
                variant="surname"
              />

              <NameInputSection
                label="Given Name (First Name)"
                value={firstNameHangul}
                onChange={setFirstNameHangul}
                maxLength={4}
                placeholder="이름"
                selectedEntries={selectedFirstNameEntries}
                onSelectCharacter={openHanjaModal}
                targetType="first"
                variant="given"
              />
            </section>

            <button
              type="button"
              onClick={analyzeName}
              className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-lg hover:bg-black transition-all"
            >
              ANALYZE NAME
            </button>
          </div>
        )}

        {topCandidate && <NamingReport result={topCandidate} />}
      </div>

      <HanjaSelectionModal
        isOpen={isModalOpen}
        targetChar={modalTarget.char}
        options={hanjaOptions}
        onClose={closeHanjaModal}
        onSelect={handleSelectHanja}
      />
    </div>
  );
}

export default App;

