import React from 'react';
import logoSvg from './assets/logo.svg';

function MainPage({ onEnter }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans text-[var(--ns-text)]">
      <div className="ns-card ns-card--large ns-card--surface w-full max-w-2xl overflow-hidden text-center">
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
          className="ns-primary-button w-full min-h-14"
        >
          입장하기
        </button>
      </div>
    </div>
  );
}

export default MainPage;
