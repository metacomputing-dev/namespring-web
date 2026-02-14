import type { AnalysisCandidate, BirthDateTime, SajuCategoryDetails } from "./types";

const STATUS_STYLE: Record<string, string> = {
  POSITIVE: "bg-emerald-100 text-emerald-700",
  NEUTRAL: "bg-amber-100 text-amber-700",
  NEGATIVE: "bg-rose-100 text-rose-700",
};

const SAJU_FRAME = "SAJU_JAWON_BALANCE";

const ELEMENT_ROWS = [
  { key: "\u6728", label: "\uBAA9(\u6728)" },
  { key: "\u706B", label: "\uD654(\u706B)" },
  { key: "\u571F", label: "\uD1A0(\u571F)" },
  { key: "\u91D1", label: "\uAE08(\u91D1)" },
  { key: "\u6C34", label: "\uC218(\u6C34)" },
] as const;

const OHAENG_CODE_LABEL: Record<string, string> = {
  WOOD: "\uBAA9(\u6728)",
  FIRE: "\uD654(\u706B)",
  EARTH: "\uD1A0(\u571F)",
  METAL: "\uAE08(\u91D1)",
  WATER: "\uC218(\u6C34)",
};

const PILLAR_SLOTS = [
  { key: "year", label: "\uB144\uC8FC" },
  { key: "month", label: "\uC6D4\uC8FC" },
  { key: "day", label: "\uC77C\uC8FC" },
  { key: "hour", label: "\uC2DC\uC8FC" },
] as const;

const TEN_GOD_GROUP_LABEL: Record<string, string> = {
  friend: "비겁(친구성)",
  output: "식상(표현/생산)",
  wealth: "재성(재물/관리)",
  authority: "관성(규범/책임)",
  resource: "인성(학습/지원)",
};

const YONGSHIN_TYPE_LABEL: Record<string, string> = {
  EOKBU: "억부",
  JOHU: "조후",
  TONGGWAN: "통관",
  GYEOKGUK: "격국",
  BYEONGYAK: "병약",
  JEONWANG: "전왕",
  HAPWHA_YONGSHIN: "합화",
  ILHAENG_YONGSHIN: "일행득기",
};

const YONGSHIN_AGREEMENT_LABEL: Record<string, string> = {
  FULL_AGREE: "완전 일치",
  PARTIAL_AGREE: "부분 일치",
  DISAGREE: "불일치",
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreBadgeClass(score: number): string {
  if (score >= 85) {
    return "bg-emerald-600";
  }
  if (score >= 70) {
    return "bg-amber-500";
  }
  return "bg-rose-500";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toSajuCategoryDetails(value: unknown): SajuCategoryDetails | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  return record as unknown as SajuCategoryDetails;
}

function formatBirthDateTime(value?: BirthDateTime): string {
  if (!value) {
    return "-";
  }
  const month = String(value.month).padStart(2, "0");
  const day = String(value.day).padStart(2, "0");
  const hour = String(value.hour).padStart(2, "0");
  const minute = String(value.minute).padStart(2, "0");
  return `${value.year}-${month}-${day} ${hour}:${minute}`;
}

function distributionValue(distribution: Record<string, number> | undefined, key: string): number {
  const value = distribution?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function ohaengCodeLabel(value: string | null): string {
  if (!value) {
    return "-";
  }
  return OHAENG_CODE_LABEL[value] ?? value;
}

function numberLabel(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : "-";
}

function percentLabel(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return `${Math.round(value * 100)}%`;
}

function tenGodGroupLabel(group: string): string {
  return TEN_GOD_GROUP_LABEL[group] ?? group;
}

function yongshinTypeLabel(type: string): string {
  return YONGSHIN_TYPE_LABEL[type] ?? type;
}

function yongshinAgreementLabel(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  return YONGSHIN_AGREEMENT_LABEL[value] ?? value;
}

interface NamingReportProps {
  candidate: AnalysisCandidate;
  onReset: () => void;
}

export default function NamingReport({ candidate, onReset }: NamingReportProps) {
  const fullHangul = `${candidate.lastNameHangul}${candidate.firstNameHangul}`;
  const fullHanja = `${candidate.lastNameHanja}${candidate.firstNameHanja}`;

  const sajuCategory = candidate.categories.find((category) => category.frame === SAJU_FRAME);
  const sajuDetails = toSajuCategoryDetails(sajuCategory?.details);
  const sajuOutput = sajuDetails?.sajuOutput ?? null;
  const sajuScoring = sajuDetails?.sajuScoring;
  const yongshinRecommendations = sajuOutput?.yongshin?.recommendations ?? [];
  const tenGod = sajuOutput?.tenGod ?? null;
  const sajuTrace = sajuOutput?.trace ?? [];

  return (
    <section className="space-y-5">
      <div className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-100">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Analysis Complete</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">
              {fullHangul} <span className="text-orange-500">({fullHanja})</span>
            </h2>
            <p className="mt-3 text-sm text-slate-600">{candidate.interpretation}</p>
          </div>
          <div className={`${scoreBadgeClass(candidate.totalScore)} rounded-3xl px-6 py-4 text-white shadow-lg`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Total Score</p>
            <p className="text-4xl font-black leading-none">{candidate.totalScore}</p>
          </div>
        </div>

        <div className="mt-4 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          Provider: {candidate.provider}
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-100">
        <h3 className="text-lg font-black text-slate-900">Category Summary</h3>

        {candidate.categories.length === 0 && (
          <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Category-level details are not available for this result.
          </p>
        )}

        <div className="mt-4 space-y-3">
          {candidate.categories.map((category, index) => {
            const score = clampScore(category.score);
            const statusClass = STATUS_STYLE[category.status] ?? "bg-slate-100 text-slate-700";

            return (
              <article key={`${category.frame}-${index}`} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-800">{category.arrangement || category.frame}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}>
                    {category.status}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-orange-500" style={{ width: `${score}%` }} />
                </div>
                <p className="mt-1 text-right text-xs font-semibold text-slate-500">{score}</p>
              </article>
            );
          })}
        </div>
      </div>

      {sajuDetails && (
        <div className="space-y-4 rounded-3xl border border-cyan-200 bg-cyan-50/50 p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-black text-cyan-900">Saju Input / Output / Interpretation</h3>
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-700">
              Source: {sajuDetails.sajuDistributionSource}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <article className="rounded-2xl border border-cyan-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Requested Input</p>
              <p className="mt-2 text-sm text-slate-700">
                Birth: {formatBirthDateTime(sajuDetails.requestedBirth)}
              </p>
              <p className="mt-1 text-sm text-slate-700">Gender: {sajuDetails.requestedGender ?? "-"}</p>
            </article>

            <article className="rounded-2xl border border-cyan-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Saju Engine Input</p>
              <p className="mt-2 text-sm text-slate-700">
                Timezone: {sajuDetails.sajuInput?.timezone ?? "-"} / Lat: {sajuDetails.sajuInput?.latitude ?? "-"} /
                Lon: {sajuDetails.sajuInput?.longitude ?? "-"}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Birth (Engine):{" "}
                {sajuDetails.sajuInput
                  ? `${sajuDetails.sajuInput.birthYear}-${String(sajuDetails.sajuInput.birthMonth).padStart(2, "0")}-${String(sajuDetails.sajuInput.birthDay).padStart(2, "0")} ${String(sajuDetails.sajuInput.birthHour).padStart(2, "0")}:${String(sajuDetails.sajuInput.birthMinute).padStart(2, "0")}`
                  : "-"}
              </p>
            </article>
          </div>

          {sajuOutput && (
            <>
              <article className="rounded-2xl border border-cyan-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Saju Pillars</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {PILLAR_SLOTS.map((slot) => {
                    const pillar = sajuOutput.pillars[slot.key];
                    return (
                      <div key={slot.key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-500">{slot.label}</p>
                        <p className="mt-1 text-lg font-black text-slate-900">{pillar.hangul}</p>
                        <p className="text-sm font-semibold text-slate-600">{pillar.hanja}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {pillar.stemCode}/{pillar.branchCode}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className="rounded-2xl border border-cyan-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Five Elements Distribution</p>
                <div className="mt-3 space-y-2">
                  {ELEMENT_ROWS.map((element) => (
                    <div key={element.key} className="grid grid-cols-[72px_1fr_1fr_1fr] items-center gap-2 text-sm">
                      <span className="font-bold text-slate-600">{element.label}</span>
                      <span className="rounded-lg bg-cyan-50 px-2 py-1 text-center text-slate-700">
                        Saju {distributionValue(sajuDetails.sajuDistribution, element.key)}
                      </span>
                      <span className="rounded-lg bg-amber-50 px-2 py-1 text-center text-slate-700">
                        Jawon {distributionValue(sajuDetails.jawonDistribution, element.key)}
                      </span>
                      <span className="rounded-lg bg-emerald-50 px-2 py-1 text-center font-bold text-slate-800">
                        Total {distributionValue(sajuDetails.sajuJawonDistribution, element.key)}
                      </span>
                    </div>
                  ))}
                </div>
              </article>

              {sajuScoring && (
                <article className="rounded-2xl border border-cyan-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Saju Naming Score Breakdown</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Balance: {clampScore(sajuScoring.balance)}</p>
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Yongshin: {clampScore(sajuScoring.yongshin)}</p>
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Strength: {clampScore(sajuScoring.strength)}</p>
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">TenGod: {clampScore(sajuScoring.tenGod)}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    Pre-Penalty: {clampScore(sajuScoring.weightedBeforePenalty)} / Penalty (Gisin+Gusin):{" "}
                    {clampScore(sajuScoring.penalties.total)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Weights / Balance {(sajuScoring.weights.balance * 100).toFixed(0)}% / Yongshin{" "}
                    {(sajuScoring.weights.yongshin * 100).toFixed(0)}% / Strength{" "}
                    {(sajuScoring.weights.strength * 100).toFixed(0)}% / TenGod{" "}
                    {(sajuScoring.weights.tenGod * 100).toFixed(0)}%
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Element matches / Yongshin {sajuScoring.elementMatches.yongshin}, Heesin {sajuScoring.elementMatches.heesin}, Gisin{" "}
                    {sajuScoring.elementMatches.gisin}, Gusin {sajuScoring.elementMatches.gusin}
                  </p>
                </article>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <article className="rounded-2xl border border-cyan-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Day Master / Gyeokguk</p>
                  <p className="mt-2 text-sm text-slate-700">
                    Day Master: {sajuOutput.dayMaster.stemHangul} ({sajuOutput.dayMaster.stemCode}) /{" "}
                    {ohaengCodeLabel(sajuOutput.dayMaster.elementCode)}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">Eumyang: {sajuOutput.dayMaster.eumyangCode}</p>
                  <p className="mt-2 text-sm text-slate-700">
                    Gyeokguk: {sajuOutput.gyeokguk ? `${sajuOutput.gyeokguk.type} (${sajuOutput.gyeokguk.category})` : "-"}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Gyeokguk Confidence: {percentLabel(sajuOutput.gyeokguk?.confidence)}
                  </p>
                </article>

                <article className="rounded-2xl border border-cyan-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Strength Analysis</p>
                  <p className="mt-2 text-sm text-slate-700">Level: {sajuOutput.strength?.level ?? "-"}</p>
                  <p className="mt-1 text-sm text-slate-700">
                    Is Strong: {typeof sajuOutput.strength?.isStrong === "boolean" ? String(sajuOutput.strength.isStrong) : "-"}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Support / Oppose: {numberLabel(sajuOutput.strength?.totalSupport ?? Number.NaN)} /{" "}
                    {numberLabel(sajuOutput.strength?.totalOppose ?? Number.NaN)}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    TenGod Dominant: {tenGod ? tenGod.dominantGroups.map((group) => tenGodGroupLabel(group)).join(", ") || "-" : "-"}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    TenGod Weak: {tenGod ? tenGod.weakGroups.map((group) => tenGodGroupLabel(group)).join(", ") || "-" : "-"}
                  </p>
                </article>
              </div>

              <article className="rounded-2xl border border-cyan-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Yongshin Interpretation</p>
                <p className="mt-2 text-sm text-slate-700">
                  Yongshin: {ohaengCodeLabel(sajuOutput.yongshin?.finalYongshin ?? null)}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Heesin: {ohaengCodeLabel(sajuOutput.yongshin?.finalHeesin ?? null)}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Gisin / Gusin: {ohaengCodeLabel(sajuOutput.yongshin?.gisin ?? null)} /{" "}
                  {ohaengCodeLabel(sajuOutput.yongshin?.gusin ?? null)}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Agreement: {yongshinAgreementLabel(sajuOutput.yongshin?.agreement)}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Confidence: {percentLabel(sajuOutput.yongshin?.finalConfidence)}
                </p>
                <div className="mt-3 space-y-2">
                  {yongshinRecommendations.length === 0 && (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">No yongshin recommendation details.</p>
                  )}
                  {yongshinRecommendations.map((recommendation, index) => (
                    <div key={`${recommendation.type}-${index}`} className="rounded-lg border border-slate-100 px-3 py-2">
                      <p className="text-xs font-semibold text-slate-700">
                        {yongshinTypeLabel(recommendation.type)} / {percentLabel(recommendation.confidence)}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Primary {ohaengCodeLabel(recommendation.primaryElement)} / Secondary{" "}
                        {ohaengCodeLabel(recommendation.secondaryElement)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{recommendation.reasoning}</p>
                    </div>
                  ))}
                </div>
              </article>

              <details className="rounded-2xl border border-cyan-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-black text-cyan-800">
                  Full Saju Trace (Evidence + Reasoning + Citations) [{sajuTrace.length}]
                </summary>
                <div className="mt-4 space-y-3">
                  {sajuTrace.length === 0 && (
                    <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">No trace details.</p>
                  )}

                  {sajuTrace.map((step, index) => (
                    <article key={`${step.key}-${index}`} className="rounded-xl border border-slate-100 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        {step.key}
                        {typeof step.confidence === "number" ? ` · confidence ${Math.round(step.confidence * 100)}%` : ""}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{step.summary}</p>
                      {step.evidence.length > 0 && (
                        <p className="mt-2 text-xs text-slate-600">Evidence: {step.evidence.join(" | ")}</p>
                      )}
                      {step.reasoning.length > 0 && (
                        <p className="mt-1 text-xs text-slate-600">Reasoning: {step.reasoning.join(" | ")}</p>
                      )}
                      {step.citations.length > 0 && (
                        <p className="mt-1 text-xs text-slate-600">Citations: {step.citations.join(" | ")}</p>
                      )}
                    </article>
                  ))}
                </div>
              </details>
            </>
          )}

          {sajuDetails.sajuCalculationError && (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              Saju calculation fallback reason: {sajuDetails.sajuCalculationError}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Print Result
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-white transition hover:bg-orange-600"
        >
          Back To Form
        </button>
      </div>
    </section>
  );
}
