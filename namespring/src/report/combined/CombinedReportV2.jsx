import React, { useMemo, useRef, useState } from 'react';
import { TierProvider, TierToggle, useTier } from '../../components/ui/TierToggle.jsx';
import { AnchorRail } from '../../components/report/AnchorRail.jsx';
import {
  ReportActionButtons,
  ReportPrintOverlay,
  ReportScrollTopFab,
  ReportShareDialog,
  useReportActions,
} from '../../report-common-ui';
import { PREMIUM_ACCESS_STORAGE_KEY } from '../../../shared/types/payment';
import { buildCombinedViewModel } from './view-model.js';
import { HeroSection } from './sections/HeroSection.jsx';
import { SoundFlowSection } from './sections/SoundFlowSection.jsx';
import { FramesSection } from './sections/FramesSection.jsx';
import { SajuSummarySection } from './sections/SajuSummarySection.jsx';
import { HarmonySection } from './sections/HarmonySection.jsx';
import { FinalSection } from './sections/FinalSection.jsx';
import { NameStatsSection } from './sections/NameStatsSection.jsx';
import { BasisSection } from './sections/BasisSection.jsx';

const PREMIUM_ACCESS_VALUE = 'paid';

function readPremiumUnlocked() {
  try {
    return window.sessionStorage.getItem(PREMIUM_ACCESS_STORAGE_KEY) === PREMIUM_ACCESS_VALUE;
  } catch {
    return false;
  }
}

function buildRailItems(vm) {
  return [
    vm.flow ? { id: 'sec-sound', label: '발음' } : null,
    vm.frames ? { id: 'sec-frames', label: '획수' } : null,
    vm.saju ? { id: 'sec-saju', label: '사주' } : null,
    vm.harmony ? { id: 'sec-harmony', label: '궁합' } : null,
    { id: 'sec-final', label: '종합' },
    vm.stats ? { id: 'sec-stats', label: '통계' } : null,
    { id: 'sec-basis', label: '근거' },
  ].filter(Boolean);
}

function CombinedReportV2Body({
  vm,
  entryUserInfo,
  onOpenNamingReport,
  onOpenSajuReport,
  onOpenPremium,
  onRecommend,
}) {
  const { tier } = useTier();
  const reportRootRef = useRef(null);
  const basisDetailsRef = useRef(null);
  const [isPremiumUnlocked] = useState(() => readPremiumUnlocked());

  const {
    isPdfSaving,
    isShareDialogOpen,
    shareLink,
    isLinkCopied,
    handleSavePdf,
    handleOpenShareDialog,
    handleCopyShareLink,
    closeShareDialog,
  } = useReportActions({
    reportRootRef,
    shareUserInfo: entryUserInfo,
    prepareBeforePrint: () => {
      const details = basisDetailsRef.current;
      const wasOpen = Boolean(details?.open);
      if (details) details.open = true;
      return { wasOpen };
    },
    restoreAfterPrint: (payload) => {
      const details = basisDetailsRef.current;
      if (details) details.open = Boolean(payload?.wasOpen);
    },
  });

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div ref={reportRootRef} className="cr-v3" data-tier={tier} data-report-version="v2">
      <div className="mb-3 flex justify-center" data-pdf-exclude="true">
        <TierToggle />
      </div>

      <AnchorRail items={buildRailItems(vm)} />

      <HeroSection
        hero={vm.hero}
        uncertaintyMessage={vm.saju?.uncertaintyMessage || null}
        onSelectTrack={scrollToSection}
      />
      <SoundFlowSection flow={vm.flow} />
      <FramesSection frames={vm.frames} />
      <SajuSummarySection saju={vm.saju} />
      <HarmonySection harmony={vm.harmony} />
      <FinalSection
        final={vm.final}
        isPremiumUnlocked={isPremiumUnlocked}
        onShare={handleOpenShareDialog}
        onRecommend={onRecommend}
        onOpenPremium={onOpenPremium}
      />
      <NameStatsSection stats={vm.stats} />
      <BasisSection ref={basisDetailsRef} basis={vm.basis} />

      <div className="cr-v3-section" data-pdf-exclude="true">
        <p className="cr-v3-kicker">More</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {typeof onOpenNamingReport === 'function' ? (
            <button type="button" className="ns-secondary-button" onClick={onOpenNamingReport}>
              이름 평가 보고서 보기
            </button>
          ) : null}
          {typeof onOpenSajuReport === 'function' ? (
            <button type="button" className="ns-secondary-button" onClick={onOpenSajuReport}>
              사주 평가 보고서 보기
            </button>
          ) : null}
        </div>
      </div>

      <ReportActionButtons
        isPdfSaving={isPdfSaving}
        onSavePdf={handleSavePdf}
        onShare={handleOpenShareDialog}
      />
      <ReportPrintOverlay isPdfSaving={isPdfSaving} />
      <ReportShareDialog
        isOpen={isShareDialogOpen}
        shareLink={shareLink}
        isLinkCopied={isLinkCopied}
        onCopy={handleCopyShareLink}
        onClose={closeShareDialog}
      />
      <ReportScrollTopFab />
    </div>
  );
}

function CombinedReportV2(props) {
  const { springReport, fortuneReport, entryUserInfo } = props;
  const vm = useMemo(
    () => buildCombinedViewModel({ springReport, fortuneReport, entryUserInfo }),
    [springReport, fortuneReport, entryUserInfo],
  );

  return (
    <TierProvider>
      <CombinedReportV2Body vm={vm} {...props} />
    </TierProvider>
  );
}

export default CombinedReportV2;
