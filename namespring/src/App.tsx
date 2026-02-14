import HanjaSelectionModal from "./components/HanjaSelectionModal";
import NameInputSection from "./components/NameInputSection";
import { useNameAnalysisForm } from "./hooks/useNameAnalysisForm";
import NamingReport from "./NamingReport";
import type { GenderOption } from "./types";

const STEPS = [
  { key: "profile", title: "Profile" },
  { key: "name", title: "Hangul Name" },
  { key: "hanja", title: "Hanja Pick" },
  { key: "result", title: "Result" },
] as const;

const GENDER_OPTIONS: Array<{ label: string; value: GenderOption }> = [
  { label: "Female", value: "female" },
  { label: "Male", value: "male" },
  { label: "None", value: "none" },
];

export default function App() {
  const {
    isDbLoading,
    isDbReady,
    dbStatusMessage,
    lastNameHangul,
    setLastNameHangul,
    firstNameHangul,
    setFirstNameHangul,
    birthDate,
    setBirthDate,
    birthTime,
    setBirthTime,
    gender,
    setGender,
    includeSaju,
    setIncludeSaju,
    selectedSurnameEntries,
    selectedFirstNameEntries,
    isModalOpen,
    modalTarget,
    hanjaOptions,
    analysisResult,
    analysisError,
    isAnalyzing,
    isProfileComplete,
    isNameInputComplete,
    isHanjaSelectionComplete,
    canAnalyze,
    ctaBlockReason,
    currentStep,
    openHanjaModal,
    closeHanjaModal,
    handleSelectHanja,
    analyzeName,
    clearAnalysis,
  } = useNameAnalysisForm();

  const topCandidate = analysisResult?.candidates[0] ?? null;
  const completedByStep = [isProfileComplete, isNameInputComplete, isHanjaSelectionComplete, Boolean(topCandidate)];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(160deg,#fff8ef_0%,#eefcff_45%,#fff1f8_100%)] px-4 py-8 text-slate-900">
      <div className="floating-orb floating-orb-left" />
      <div className="floating-orb floating-orb-right" />

      <main className="relative mx-auto w-full max-w-4xl space-y-5">
        <header className="rounded-3xl bg-white/85 p-6 shadow-xl ring-1 ring-white/70 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">NameSpring Studio</p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">Korean Naming Analysis</h1>
              <p className="mt-2 text-sm text-slate-600">
                Default case: 김서윤 / 金西玧 / 1995-09-21 09:30 / female / includeSaju false
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900 px-4 py-3 text-right text-white">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Progress</p>
              <p className="text-2xl font-black">{currentStep}/4</p>
            </div>
          </div>
        </header>

        <section className="rounded-3xl bg-white/85 p-5 shadow-lg ring-1 ring-white/70 backdrop-blur">
          <div className="grid gap-2 sm:grid-cols-4">
            {STEPS.map((step, index) => {
              const done = completedByStep[index];
              const active = currentStep === index + 1;

              return (
                <div
                  key={step.key}
                  className={`rounded-2xl border px-3 py-3 ${
                    done
                      ? "border-emerald-300 bg-emerald-50"
                      : active
                        ? "border-orange-300 bg-orange-50"
                        : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Step {index + 1}</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{step.title}</p>
                </div>
              );
            })}
          </div>
        </section>

        {!topCandidate && (
          <section className="space-y-5 rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-100">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Birth Date</span>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:border-orange-500 focus:bg-white"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Birth Time</span>
                <input
                  type="time"
                  value={birthTime}
                  onChange={(event) => setBirthTime(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:border-orange-500 focus:bg-white"
                />
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Gender</p>
              <div className="flex flex-wrap gap-2">
                {GENDER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setGender(option.value)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      gender === option.value
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-bold text-slate-800">Include Saju</span>
                  <span className="block text-xs text-slate-500">Default is OFF to match the baseline case.</span>
                </span>
                <input
                  type="checkbox"
                  checked={includeSaju}
                  onChange={(event) => setIncludeSaju(event.target.checked)}
                  className="h-5 w-5 accent-orange-500"
                />
              </label>
            </div>

            <NameInputSection
              label="Surname"
              value={lastNameHangul}
              onChange={setLastNameHangul}
              maxLength={2}
              placeholder="e.g. 김"
              selectedEntries={selectedSurnameEntries}
              onSelectCharacter={openHanjaModal}
              targetType="last"
              selectionEnabled={isDbReady}
              variant="surname"
            />

            <NameInputSection
              label="Given Name"
              value={firstNameHangul}
              onChange={setFirstNameHangul}
              maxLength={4}
              placeholder="e.g. 서윤"
              selectedEntries={selectedFirstNameEntries}
              onSelectCharacter={openHanjaModal}
              targetType="first"
              selectionEnabled={isDbReady}
              variant="given"
            />

            {isDbLoading && (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">Loading Seed DB...</p>
            )}

            {dbStatusMessage && (
              <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">{dbStatusMessage}</p>
            )}

            {analysisError && (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{analysisError}</p>
            )}

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => void analyzeName()}
                disabled={!canAnalyze || isAnalyzing}
                className="w-full rounded-2xl bg-orange-500 px-6 py-4 text-base font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isAnalyzing ? "Analyzing name..." : "Run Naming Analysis"}
              </button>

              <p className="text-sm text-slate-500">
                {ctaBlockReason ?? "All steps complete. Start analysis when ready."}
              </p>
            </div>
          </section>
        )}

        {topCandidate && <NamingReport candidate={topCandidate} onReset={clearAnalysis} />}
      </main>

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
