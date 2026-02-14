import React from 'react';
import logoPng from './assets/logo.png';

function HomeTile({ title, className, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-[2.2rem] p-5 shadow-xl hover:translate-y-[-2px] transition-all text-left ${className}`}
    >
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <img src={logoPng} alt="" className="h-12 w-12 select-none" draggable="false" />
        <p className="text-sm md:text-base font-black text-[var(--ns-accent-text)] text-center">{title}</p>
      </div>
    </button>
  );
}

function HomePage({ onOpenReport }) {
  return (
    <div className="min-h-screen p-6 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-black text-[var(--ns-accent-text)] mb-6">기능 홈</h2>
        <div className="grid grid-cols-2 gap-4">
          <HomeTile title="이름 평가 보고서" className="h-44 md:h-52" onClick={onOpenReport} />
          <HomeTile title="작명하기" className="h-44 md:h-52" onClick={() => {}} />
          <HomeTile title="고마움 전달하기" className="h-44 md:h-52" onClick={() => {}} />
          <HomeTile title="이름봄 정보" className="h-44 md:h-52" onClick={() => {}} />
        </div>
      </div>
    </div>
  );
}

export default HomePage;
