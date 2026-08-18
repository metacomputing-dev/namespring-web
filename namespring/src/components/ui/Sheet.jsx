import React, { useEffect, useRef, useState } from 'react';
import { cx } from '../report/ReportPrimitives.jsx';

const EXIT_DURATION_MS = 360;

export function Sheet({ open, onClose, labelledBy, className, panelClassName, children }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);

  useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement;
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timer = setTimeout(() => setMounted(false), EXIT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) {
      const previous = restoreFocusRef.current;
      if (previous && typeof previous.focus === 'function') previous.focus();
      return undefined;
    }
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    panelRef.current?.focus?.();
    return () => {
      body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div className={cx('ns-sheet', !visible && 'ns-sheet--hidden', className)}>
      <div className="ns-sheet__backdrop" onClick={() => onClose?.()} aria-hidden="true" />
      <div
        ref={panelRef}
        className={cx('ns-sheet__panel', panelClassName)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
