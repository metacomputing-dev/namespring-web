import React, { useEffect, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { buildShareLinkFromEntryUserInfo } from './share-entry-user-info';
import { Sheet } from './components/ui/Sheet.jsx';

function waitForNextPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

function waitForFontsReady(timeoutMs = 2500) {
  if (!document.fonts?.ready) {
    return Promise.resolve();
  }
  return Promise.race([
    document.fonts.ready.catch(() => undefined),
    new Promise((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

async function waitForImagesReady(root, timeoutMs = 3000) {
  if (!root) return;
  const images = Array.from(root.querySelectorAll('img'));
  if (!images.length) return;

  await Promise.race([
    Promise.all(images.map((img) => {
      if (img.complete && img.naturalWidth > 0) {
        return Promise.resolve();
      }
      if (typeof img.decode === 'function') {
        return img.decode().catch(() => undefined);
      }
      return new Promise((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    })),
    new Promise((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

async function waitForLayoutStability(root, options = {}) {
  if (!root) return;
  const stableMs = Number(options.stableMs) || 180;
  const timeoutMs = Number(options.timeoutMs) || 3000;
  const start = performance.now();

  const getSignature = () => {
    const rect = root.getBoundingClientRect();
    return [
      Math.round(rect.width),
      Math.round(rect.height),
      Math.round(root.scrollHeight || 0),
      Math.round(root.scrollWidth || 0),
      Math.round(root.clientHeight || 0),
      Math.round(root.clientWidth || 0),
    ].join(':');
  };

  let lastSignature = getSignature();
  let stableSince = performance.now();

  while (performance.now() - start < timeoutMs) {
    await waitForNextPaint();
    const currentSignature = getSignature();
    if (currentSignature === lastSignature) {
      if (performance.now() - stableSince >= stableMs) {
        return;
      }
    } else {
      lastSignature = currentSignature;
      stableSince = performance.now();
    }
  }
}

async function waitForPrintReady(root) {
  await waitForNextPaint();
  await Promise.all([
    waitForFontsReady(2500),
    waitForImagesReady(root, 3000),
  ]);
  await waitForLayoutStability(root, { stableMs: 180, timeoutMs: 3000 });
  await waitForNextPaint();
}

export function useReportActions({
  reportRootRef,
  shareUserInfo = null,
  prepareBeforePrint = null,
  restoreAfterPrint = null,
}) {
  const [isPdfSaving, setIsPdfSaving] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isLinkCopied, setIsLinkCopied] = useState(false);

  const handleSavePdf = async () => {
    if (isPdfSaving || !reportRootRef?.current) return;

    let restorePayload;
    if (typeof prepareBeforePrint === 'function') {
      flushSync(() => {
        restorePayload = prepareBeforePrint();
        setIsPdfSaving(true);
      });
    } else {
      setIsPdfSaving(true);
    }

    let restored = false;
    const restoreState = () => {
      if (restored) return;
      restored = true;
      if (typeof restoreAfterPrint === 'function') {
        restoreAfterPrint(restorePayload);
      }
      setIsPdfSaving(false);
    };

    const handleAfterPrint = () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      restoreState();
    };

    window.addEventListener('afterprint', handleAfterPrint);

    try {
      await waitForPrintReady(reportRootRef.current);
      window.print();
    } catch (error) {
      console.error('Print save failed', error);
      alert('PDF 저장 준비에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      window.removeEventListener('afterprint', handleAfterPrint);
      restoreState();
      return;
    }

    window.setTimeout(() => {
      window.removeEventListener('afterprint', handleAfterPrint);
      restoreState();
    }, 30000);
  };

  const handleOpenShareDialog = () => {
    const nextShareLink = buildShareLinkFromEntryUserInfo(shareUserInfo, window.location.href);
    setShareLink(nextShareLink || window.location.href);
    setIsLinkCopied(false);
    setIsShareDialogOpen(true);
  };

  const closeShareDialog = () => {
    setIsShareDialogOpen(false);
    setIsLinkCopied(false);
  };

  const handleCopyShareLink = async () => {
    if (!shareLink) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareLink);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareLink;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsLinkCopied(true);
    } catch {
      setIsLinkCopied(false);
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  return {
    isPdfSaving,
    isShareDialogOpen,
    shareLink,
    isLinkCopied,
    handleSavePdf,
    handleOpenShareDialog,
    closeShareDialog,
    handleCopyShareLink,
  };
}

export function ReportActionButtons({
  isPdfSaving,
  onSavePdf,
  onShare,
  onBack = null,
}) {
  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    window.history.back();
  };

  return (
    <div data-pdf-exclude="true" className="ns-report-actions">
      <button
        type="button"
        onClick={onSavePdf}
        disabled={isPdfSaving}
        className="ns-report-action ns-report-action--secondary"
      >
        {isPdfSaving ? '저장 준비 중' : 'PDF 저장'}
      </button>
      <button
        type="button"
        onClick={onShare}
        className="ns-report-action ns-report-action--primary"
      >
        공유하기
      </button>
      <button
        type="button"
        onClick={handleBack}
        className="ns-report-action ns-report-action--secondary"
      >
        돌아가기
      </button>
    </div>
  );
}

export function ReportPrintOverlay({ isPdfSaving }) {
  if (!isPdfSaving) return null;
  return (
    <div data-pdf-exclude="true" className="ns-report-modal-backdrop">
      <div className="ns-report-modal-card ns-report-modal-card--center">
        <div className="ns-report-spinner" aria-hidden="true" />
        <h3>저장 준비 중</h3>
        <p>인쇄 창에서 PDF로 저장해 주세요.</p>
      </div>
    </div>
  );
}

export function ReportShareDialog({
  isOpen,
  shareLink,
  isLinkCopied,
  onCopy,
  onClose,
}) {
  return (
    <Sheet open={isOpen} onClose={onClose} labelledBy="report-share-dialog-title">
      <div data-pdf-exclude="true" className="ns-share-dialog">
        <h3 id="report-share-dialog-title">공유 링크</h3>
        <p>아래 주소를 복사해 다시 열어보세요.</p>
        <div className="ns-report-share-link">
          {shareLink}
        </div>
        <div className="ns-report-dialog-actions">
          <button
            type="button"
            onClick={onCopy}
            className="ns-report-action ns-report-action--primary ns-report-action--compact"
          >
            {isLinkCopied ? '복사됨' : '링크 복사'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ns-report-action ns-report-action--secondary ns-report-action--compact"
          >
            닫기
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function ReportScrollTopFab() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const top = window.scrollY
        || document.documentElement.scrollTop
        || document.body.scrollTop
        || document.getElementById('root')?.scrollTop
        || 0;
      setShowScrollTop(top > 280);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, []);

  if (!showScrollTop) return null;
  return createPortal(
    <button
      type="button"
      onClick={() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
        document.body.scrollTo({ top: 0, behavior: 'smooth' });
        document.getElementById('root')?.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      aria-label="맨 위로 이동"
      className="ns-scroll-top-fab w-12 h-12 rounded-full border border-[var(--ns-border)] bg-[var(--ns-surface)] text-[var(--ns-muted)] shadow-[var(--shadow-fab)] inline-flex items-center justify-center"
    >
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
        <path d="M10 4L4.5 9.5M10 4L15.5 9.5M10 4V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>,
    document.body
  );
}
