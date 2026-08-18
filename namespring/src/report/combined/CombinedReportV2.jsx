import React, { useMemo } from 'react';
import { TierProvider, TierToggle } from '../../components/ui/TierToggle.jsx';
import { buildCombinedViewModel } from './view-model.js';

/** v2 renderer scaffold (flag: ?reportV2=1). Sections are filled in by
 *  the follow-up increments; this stage proves the dual-report data flow. */
function CombinedReportV2({ springReport, fortuneReport, entryUserInfo }) {
  const vm = useMemo(
    () => buildCombinedViewModel({ springReport, fortuneReport, entryUserInfo }),
    [springReport, fortuneReport, entryUserInfo],
  );

  return (
    <TierProvider>
      <div className="cr-v3" data-report-version="v2">
        <header id="sec-hero" className="space-y-3">
          <h2 className="font-serif text-3xl font-bold text-ink">{vm.hero.fullHangul}</h2>
          {vm.hero.fullHanja ? (
            <p className="font-serif tracking-[0.35em] text-inkfaint">{vm.hero.fullHanja}</p>
          ) : null}
          {vm.hero.verdictSentence ? (
            <p className="text-smd text-inksoft">{vm.hero.verdictSentence}</p>
          ) : null}
          {vm.hero.score !== null ? (
            <p className="text-2xs uppercase tracking-[0.15em] text-sage">score {vm.hero.score}</p>
          ) : null}
          <TierToggle />
        </header>
        <pre className="mt-8 overflow-x-auto rounded-2xl border border-hairline bg-parchment/60 p-4 text-2xs text-inkfaint">
          {JSON.stringify(
            {
              tracks: vm.hero.tracks,
              flowState: vm.flow?.state ?? null,
              framesState: vm.frames?.state ?? null,
              harmonyState: vm.harmony?.state ?? null,
              statsAvailable: Boolean(vm.stats),
              basisRows: vm.basis.rows.length,
            },
            null,
            2,
          )}
        </pre>
      </div>
    </TierProvider>
  );
}

export default CombinedReportV2;
