import React from 'react';
import logoSvg from './assets/logo.svg';

function MainPage({ onEnter }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 font-sans text-[var(--ns-text)]">
      <div className="bg-[var(--ns-surface)] p-10 rounded-[3rem] shadow-2xl border border-[var(--ns-border)] w-full max-w-2xl overflow-hidden text-center">
        <img
          src={logoSvg}
          alt="이름봄 로고"
          className="h-20 w-20 mx-auto mb-5 select-none"
          draggable="false"
        />
        <h1 className="text-5xl font-black text-[var(--ns-accent-text)] mb-3">이름봄</h1>
        <p className="text-[var(--ns-muted)] font-semibold mb-10">새로운 인생의 시작</p>
        <button
          onClick={onEnter}
          className="w-full py-5 bg-[var(--ns-primary)] text-[var(--ns-accent-text)] rounded-[2rem] font-black text-lg hover:brightness-95 transition-all"
        >
          입장하기
        </button>
      </div>
    </div>
  );
}

export default MainPage;
