import { useMemo, useState } from "react";
import HanjaSelectionModal from "./components/HanjaSelectionModal";
import NameInputSection from "./components/NameInputSection";
import { useNameAnalysisForm } from "./hooks/useNameAnalysisForm";
import NamingReport from "./NamingReport";
import type { GenderOption, KoreanConstraintKind } from "./types";

const GENDER_OPTIONS: Array<{ label: string; value: GenderOption }> = [
  { label: "Female", value: "female" },
  { label: "Male", value: "male" },
  { label: "None", value: "none" },
];

const GENERATOR_LENGTH_OPTIONS = [1, 2, 3, 4] as const;
const SEARCH_LIMIT_OPTIONS = [
  { label: "All", value: "all" },
  { label: "10", value: "10" },
  { label: "20", value: "20" },
  { label: "30", value: "30" },
  { label: "50", value: "50" },
  { label: "100", value: "100" },
] as const;

type WorkspaceTab = "analyze" | "generate";

function constraintKindLabel(kind: KoreanConstraintKind): string {
  switch (kind) {
    case "empty":
      return "Any";
    case "syllable":
      return "Hangul";
    case "chosung":
      return "Chosung";
    case "jungsung":
      return "Jungsung";
    default:
      return "Invalid";
  }
}

function constraintKindColor(kind: KoreanConstraintKind): string {
  switch (kind) {
    case "syllable":
      return "bg-emerald-100 text-emerald-700";
    case "chosung":
      return "bg-cyan-100 text-cyan-700";
    case "jungsung":
      return "bg-indigo-100 text-indigo-700";
    case "invalid":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default function App() {
  const [tab, setTab] = useState<WorkspaceTab>("analyze");

  const {
    isDbLoading,
    isDbReady,
    dbStatusMessage,
    birthDate,
    setBirthDate,
    birthTime,
    setBirthTime,
    gender,
    setGender,
    surnameHangul,
    setSurnameHangul,
    analyzeGivenHangul,
    setAnalyzeGivenHangul,
    selectedSurnameEntries,
    selectedAnalyzeGivenEntries,
    isModalOpen,
    modalTarget,
    hanjaOptions,
    analysisResult,
    analysisError,
    isAnalyzing,
    canAnalyze,
    ctaBlockReason,
    openHanjaModal,
    closeHanjaModal,
    handleSelectHanja,
    analyzeName,
    clearAnalysis,
    generatorLength,
    visibleGeneratorConstraints,
    generatorLimit,
    generatorOffset,
    isSearchingCandidates,
    candidateResult,
    candidateError,
    generatorQueryPreview,
    setGeneratorLength,
    setGeneratorLimit,
    setGeneratorOffset,
    setConstraintKorean,
    setConstraintHanja,
    getConstraintKind,
    resetGeneratorConstraints,
    searchCandidates,
    clearSearchOutput,
  } = useNameAnalysisForm();

  const topAnalysisCandidate = analysisResult?.candidates[0] ?? null;
  const topGeneratedCandidate = candidateResult?.candidates[0] ?? null;

  const generatorSummaryText = useMemo(() => {
    if (!candidateResult) {
      return "Run candidate search to see ranked name suggestions.";
    }
    const truncationText = candidateResult.truncated ? " (truncated by ranking limit)" : "";
    return `Showing ${candidateResult.candidates.length} candidates, total ${candidateResult.totalCount}${truncationText}`;
  }, [candidateResult]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(155deg,#fff8ef_0%,#eefcff_42%,#fef2f2_100%)] px-4 py-8 text-slate-900">
      <div className="floating-orb floating-orb-left" />
      <div className="floating-orb floating-orb-right" />

      <main className="relative mx-auto w-full max-w-5xl space-y-5">
        <header className="rounded-3xl bg-white/90 p-6 shadow-xl ring-1 ring-white/70 backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-orange-500">NameSpring Studio</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Naming Analysis + Candidate Generator</h1>
          <p className="mt-2 text-sm text-slate-600">
            Default case: Kim Seoyun / 金西玧 / 1995-09-21 09:30 / female
          </p>
        </header>

        <section className="rounded-3xl bg-white p-5 shadow-lg ring-1 ring-slate-100">
          <h2 className="text-lg font-black text-slate-900">Profile</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
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

          <div className="mt-4 space-y-2">
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

          <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Saju is always included and computed from birth date/time.
          </p>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-lg ring-1 ring-slate-100">
          <h2 className="text-lg font-black text-slate-900">Surname (required)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Support single and double surname. Fully select surname Hanja first.
          </p>
          <div className="mt-3">
            <NameInputSection
              label="Surname"
              value={surnameHangul}
              onChange={setSurnameHangul}
              maxLength={2}
              placeholder="e.g. 源, ?쒓컝"
              selectedEntries={selectedSurnameEntries}
              onSelectCharacter={openHanjaModal}
              targetType="last"
              selectionEnabled={isDbReady}
              variant="surname"
            />
          </div>
        </section>

        <section className="rounded-3xl bg-white p-2 shadow-lg ring-1 ring-slate-100">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setTab("analyze")}
              className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                tab === "analyze" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Analyze Selected Name
            </button>
            <button
              type="button"
              onClick={() => setTab("generate")}
              className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                tab === "generate" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Generate Candidate Names
            </button>
          </div>
        </section>

        {tab === "analyze" && (
          <section className="space-y-5 rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-100">
            <NameInputSection
              label="Given Name (analysis)"
              value={analyzeGivenHangul}
              onChange={setAnalyzeGivenHangul}
              maxLength={4}
              placeholder="e.g. ?쒖쑄"
              selectedEntries={selectedAnalyzeGivenEntries}
              onSelectCharacter={openHanjaModal}
              targetType="first"
              selectionEnabled={isDbReady}
              variant="given"
            />

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void analyzeName()}
                disabled={!canAnalyze || isAnalyzing}
                className="w-full rounded-2xl bg-orange-500 px-6 py-4 text-base font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isAnalyzing ? "Analyzing..." : "Run Naming Analysis"}
              </button>
              <p className="text-sm text-slate-500">
                {ctaBlockReason ?? "Ready. Click the button to analyze selected Hangul/Hanja pair."}
              </p>
            </div>

            {analysisError && (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{analysisError}</p>
            )}

            {topAnalysisCandidate && <NamingReport candidate={topAnalysisCandidate} onReset={clearAnalysis} />}
          </section>
        )}

        {tab === "generate" && (
          <section className="space-y-5 rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-100">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Given Name Length</p>
                <div className="flex flex-wrap gap-2">
                  {GENERATOR_LENGTH_OPTIONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGeneratorLength(value)}
                      className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                        generatorLength === value
                          ? "bg-cyan-600 text-white"
                          : "bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                      }`}
                    >
                      {value} char
                    </button>
                  ))}
                </div>
              </div>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Limit</span>
                <select
                  value={generatorLimit === null ? "all" : String(generatorLimit)}
                  onChange={(event) => {
                    const value = event.target.value;
                    setGeneratorLimit(value === "all" ? null : Number(value));
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold outline-none focus:border-cyan-500"
                >
                  {SEARCH_LIMIT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Offset</span>
                <input
                  type="number"
                  min={0}
                  value={generatorOffset}
                  onChange={(event) => setGeneratorOffset(Number(event.target.value))}
                  className="w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold outline-none focus:border-cyan-500"
                />
              </label>
            </div>

            <div className="space-y-2">
              {visibleGeneratorConstraints.map((constraint, index) => {
                const kind = getConstraintKind(index);
                return (
                  <div key={index} className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[72px_1fr_auto_1fr]">
                    <div className="self-center text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                      Slot {index + 1}
                    </div>
                    <label className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Korean constraint
                      </span>
                      <input
                        type="text"
                        value={constraint.korean}
                        maxLength={1}
                        onChange={(event) => setConstraintKorean(index, event.target.value)}
                        placeholder="媛 / ??/ ??/ empty"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-lg font-bold outline-none focus:border-cyan-500"
                      />
                    </label>

                    <div
                      className={`self-center rounded-full px-2 py-1 text-center text-xs font-bold uppercase tracking-[0.14em] ${constraintKindColor(kind)}`}
                    >
                      {constraintKindLabel(kind)}
                    </div>

                    <label className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Hanja constraint
                      </span>
                      <input
                        type="text"
                        value={constraint.hanja}
                        maxLength={1}
                        onChange={(event) => setConstraintHanja(index, event.target.value)}
                        placeholder="Optional"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-lg font-bold outline-none focus:border-cyan-500"
                      />
                    </label>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Query Preview</p>
              <code className="block overflow-x-auto rounded-xl bg-slate-900 px-3 py-2 text-xs text-slate-100">
                {generatorQueryPreview ?? "(Complete surname Hanja first)"}
              </code>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void searchCandidates()}
                disabled={!isDbReady || isSearchingCandidates}
                className="rounded-2xl bg-cyan-600 px-6 py-4 text-base font-black text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSearchingCandidates ? "Searching..." : "Search Candidate Names"}
              </button>
              <button
                type="button"
                onClick={resetGeneratorConstraints}
                className="rounded-2xl border border-slate-300 bg-white px-6 py-4 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Reset Constraints
              </button>
            </div>

            {candidateError && (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{candidateError}</p>
            )}

            <p className="text-sm text-slate-600">{generatorSummaryText}</p>

            {candidateResult && (
              <div className="space-y-3">
                {candidateResult.candidates.length === 0 && (
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    No candidates found for current constraints.
                  </p>
                )}

                {candidateResult.candidates.map((candidate, index) => (
                  <article key={`${candidate.lastNameHanja}-${candidate.firstNameHanja}-${index}`} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-lg font-black text-slate-900">
                        {candidate.lastNameHangul}
                        {candidate.firstNameHangul}{" "}
                        <span className="text-sm font-semibold text-slate-500">
                          ({candidate.lastNameHanja}
                          {candidate.firstNameHanja})
                        </span>
                      </h3>
                      <span className="rounded-full bg-cyan-100 px-3 py-1 text-sm font-black text-cyan-700">
                        {candidate.totalScore}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{candidate.interpretation}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Categories: {candidate.categories.length} | Provider: {candidate.provider}
                    </p>
                  </article>
                ))}
              </div>
            )}

            {topGeneratedCandidate && (
              <div className="rounded-3xl border border-cyan-200 bg-cyan-50/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Top Candidate Detail</h3>
                  <button
                    type="button"
                    onClick={clearSearchOutput}
                    className="rounded-full border border-cyan-300 bg-white px-3 py-1 text-xs font-bold text-cyan-700"
                  >
                    Clear Search Output
                  </button>
                </div>
                <NamingReport candidate={topGeneratedCandidate} onReset={clearSearchOutput} />
              </div>
            )}
          </section>
        )}

        {isDbLoading && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">Loading Seed DB...</p>
        )}

        {dbStatusMessage && (
          <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">{dbStatusMessage}</p>
        )}
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


