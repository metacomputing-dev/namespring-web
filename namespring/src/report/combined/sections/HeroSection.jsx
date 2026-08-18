import React from 'react';
import { BezelCard } from '../../../components/ui/BezelCard.jsx';
import { RevealOnScroll } from '../../../components/ui/RevealOnScroll.jsx';
import { ScoreRing } from '../../../components/report/ReportPrimitives';
import { HeroName } from '../../../components/report/HeroName.jsx';
import { TrackCards } from '../../../components/report/ReportV3Bits.jsx';

export function HeroSection({ hero, onSelectTrack }) {
  return (
    <RevealOnScroll as="section" id="sec-hero" className="cr-v3-section" style={{ paddingTop: 0 }}>
      <BezelCard>
        <HeroName chars={hero.chars} fullHanja={hero.fullHanja} />
        {hero.verdictSentence ? (
          <p className="cr-v3-hero__verdict">{hero.verdictSentence}</p>
        ) : null}
        {hero.subline ? <p className="mt-2 text-sm text-inkfaint">{hero.subline}</p> : null}
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <TrackCards tracks={hero.tracks} onSelect={onSelectTrack} />
          {hero.score !== null ? (
            <div className="text-right">
              <ScoreRing value={hero.score} max={100} label="종합 점수" />
              <p className="mt-1 max-w-[18ch] text-2xs text-inkfaint">
                점수는 참고용 요약이며, 판단 근거는 아래 섹션에 있습니다.
              </p>
            </div>
          ) : null}
        </div>
      </BezelCard>
    </RevealOnScroll>
  );
}
