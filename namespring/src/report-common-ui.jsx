import React, { useEffect, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { buildShareLinkFromEntryUserInfo } from './share-entry-user-info';

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
      alert('인쇄 준비에 실패했습니다. 잠시 후 다시 시도해 주세요.');
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
}) {
  return (
    <div data-pdf-exclude="true" className="flex gap-4 pt-2">
      <button
        type="button"
        onClick={onSavePdf}
        disabled={isPdfSaving}
        className="flex-1 py-4 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-2xl font-black text-[var(--ns-muted)] hover:bg-[var(--ns-surface-soft)] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPdfSaving ? '인쇄 준비 중...' : 'PDF로 저장하기'}
      </button>
      <button
        type="button"
        onClick={onShare}
        className="flex-1 py-4 bg-[var(--ns-primary)] text-[var(--ns-accent-text)] rounded-2xl font-black shadow-lg hover:brightness-95 active:scale-95 transition-all"
      >
        공유하기
      </button>
    </div>
  );
}

export function ReportPrintOverlay({ isPdfSaving }) {
  if (!isPdfSaving) return null;
  return (
    <div data-pdf-exclude="true" className="fixed inset-0 z-[120] bg-black/35 backdrop-blur-[2px] p-4 flex items-center justify-center">
      <div className="w-full max-w-xs rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-5 shadow-2xl text-center">
        <div className="mx-auto h-10 w-10 rounded-full border-4 border-[var(--ns-primary)] border-t-transparent animate-spin" />
        <h3 className="mt-3 text-base font-black text-[var(--ns-accent-text)]">인쇄 준비 중</h3>
        <p className="mt-1 text-sm font-semibold text-[var(--ns-muted)]">인쇄 창에서 PDF로 저장해 주세요.</p>
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
  if (!isOpen) return null;
  return (
    <div
      data-pdf-exclude="true"
      className="fixed inset-0 z-[100] bg-black/35 backdrop-blur-[2px] p-4 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-base font-black text-[var(--ns-accent-text)]">공유 링크</h3>
        <p className="text-xs font-semibold text-[var(--ns-muted)] mt-1">아래 주소를 복사해 공유하세요.</p>
        <div className="mt-3 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2 text-xs text-[var(--ns-text)] break-all">
          {shareLink}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="flex-1 py-2.5 rounded-xl bg-[var(--ns-primary)] text-[var(--ns-accent-text)] font-black text-sm hover:brightness-95 transition-all"
          >
            {isLinkCopied ? '복사됨' : '클립보드에 복사'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)] font-black text-sm"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
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
      aria-label="최상단으로 이동"
      className="ns-scroll-top-fab w-12 h-12 rounded-full border border-[var(--ns-border)] bg-[var(--ns-surface)] text-[var(--ns-muted)] shadow-xl inline-flex items-center justify-center"
    >
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
        <path d="M10 4L4.5 9.5M10 4L15.5 9.5M10 4V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>,
    document.body
  );
}
