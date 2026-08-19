import React from 'react';
import logoSvg from './assets/logo.svg';
import companyLogo from './assets/logo_2025_rev01.svg';
import AppBackground from './ui/AppBackground';

function SplashScreen() {
  return (
    <AppBackground>
      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-between py-24">
        <div />

        <div className="ns-rise flex flex-col items-center gap-4">
          <img
            src={logoSvg}
            alt="NameSpring leaf logo"
            className="h-20 w-20 md:h-24 md:w-24 select-none"
            draggable="false"
          />
          <h1 className="font-serif text-5xl font-bold tracking-tight text-[var(--ns-accent-text)]">이름봄</h1>
        </div>

        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-[var(--ns-primary)]/70">
            Namespring
          </p>
          <p className="mt-1 text-smd font-medium text-[var(--ns-muted)]">새로운 인생의 시작</p>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex items-center justify-center gap-2 text-sm text-[var(--ns-muted)]">
        <img src={companyLogo} alt="MetaIntelligence logo" className="h-[18px] w-[24px] opacity-45 grayscale" draggable="false" />
        <span className="tracking-wide"> MetaIntelligence Inc.</span>
      </div>
    </AppBackground>
  );
}

export default SplashScreen;
