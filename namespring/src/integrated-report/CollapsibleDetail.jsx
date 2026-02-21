import React, { useState } from 'react';

export default function CollapsibleDetail({ label, children }) {
  const [open, setOpen] = useState(false);

  if (!children) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs font-black text-[var(--ns-muted)] hover:text-[var(--ns-accent-text)] transition-colors"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label || '상세 보기'}
      </button>
      {open ? (
        <div className="mt-2 pl-5 space-y-1.5 animate-[fadeIn_0.15s_ease-out]">
          {children}
        </div>
      ) : null}
    </div>
  );
}
