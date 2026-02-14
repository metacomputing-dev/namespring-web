import type { AnalysisCandidate } from "./types";

const STATUS_STYLE: Record<string, string> = {
  POSITIVE: "bg-emerald-100 text-emerald-700",
  NEUTRAL: "bg-amber-100 text-amber-700",
  NEGATIVE: "bg-rose-100 text-rose-700",
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

interface NamingReportProps {
  candidate: AnalysisCandidate;
  onReset: () => void;
}

export default function NamingReport({ candidate, onReset }: NamingReportProps) {
  const fullHangul = `${candidate.lastNameHangul}${candidate.firstNameHangul}`;
  const fullHanja = `${candidate.lastNameHanja}${candidate.firstNameHanja}`;

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
