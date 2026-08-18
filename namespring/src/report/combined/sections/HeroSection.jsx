import React from 'react';
import { RevealOnScroll } from '../../../components/ui/RevealOnScroll.jsx';
import { HeroName } from '../../../components/report/HeroName.jsx';
import { StateDot } from '../../../components/report/ReportV3Bits.jsx';

export function HeroSection({ hero, uncertaintyMessage, onSelectTrack }) {
  return (
    <RevealOnScroll as="header" id="sec-hero" className="mb-6 text-center">
      {uncertaintyMessage ? (
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          <span className="rounded-full bg-ambersoft px-3 py-1 text-2xs font-semibold text-amber2">
            출생 시간 없이 본 결과예요 — 일부 판정은 참고 수준
          </span>
        </div>
      ) : null}
      <p className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-sage/10 px-3 py-1 text-2xs font-medium uppercase tracking-[0.15em] text-sage">
        이름 통합 보고서
      </p>
      <HeroName chars={hero.chars} fullHanja={hero.chars.every((char) => char.hanja)
        ? hero.chars.map((char) => char.hanja).join(' ')
        : null}
      />
      {hero.verdictSentence ? (
        <p className="mx-auto mt-7 max-w-[26ch] font-serif text-xl font-semibold leading-snug sm:text-2xl">
          {hero.verdictSentence}
        </p>
      ) : null}
      {hero.subline ? <p className="mt-2 text-sm text-inkfaint">{hero.subline}</p> : null}
      <div className="mt-8 flex flex-wrap justify-center gap-2.5">
        {hero.tracks.map((track) => (
          <button
            key={track.key}
            type="button"
            onClick={() => onSelectTrack?.(track.target)}
            className="flex min-w-[6.5rem] flex-col items-center gap-1 rounded-2xl border border-hairline bg-card px-5 py-3 text-xs text-inksoft transition-all duration-500 ease-spring hover:-translate-y-0.5 hover:shadow-[var(--shadow-2)]"
          >
            <StateDot state={track.state} />
            <b className="text-sm text-ink">{track.label}</b>
            {track.stateLabel || ''}
          </button>
        ))}
      </div>
      {hero.score !== null ? (
        <div className="mt-6 inline-flex items-center gap-2.5 text-xs text-inkfaint">
          <span
            className="cr-v3-ring grid h-10 w-10 place-items-center rounded-full"
            style={{ '--score': hero.score }}
            role="img"
            aria-label={`종합 점수 ${hero.score}점`}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-cream text-2xs font-bold text-inksoft">
              {hero.score}
            </span>
          </span>
          종합 점수는 참고용이에요. 판단의 근거는 아래 세 갈래에 있어요.
        </div>
      ) : null}
    </RevealOnScroll>
  );
}
