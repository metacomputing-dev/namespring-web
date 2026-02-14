import React from 'react';

function AppBackground({ children, className = '' }) {
  return (
    <div className={`relative min-h-screen overflow-hidden bg-[var(--ns-bg)] text-[var(--ns-text)] ${className}`}>
      <div className="pointer-events-none absolute top-0 inset-x-0 h-[55vh] bg-gradient-to-b from-[var(--ns-primary)]/15 via-[var(--ns-primary)]/5 to-transparent" />
      <div className="pointer-events-none absolute -top-24 right-[-120px] h-80 w-80 rounded-full bg-[var(--ns-secondary)]/10 blur-3xl" />
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}

export default AppBackground;
