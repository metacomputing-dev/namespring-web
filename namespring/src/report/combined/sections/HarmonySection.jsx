import React from 'react';
import { V3Section } from './V3Section.jsx';
import { BezelCard } from '../../../components/ui/BezelCard.jsx';
import { cx } from '../../../components/report/ReportPrimitives';

const REL_NOTES = {
  match: '필요한 기운과 일치',
  generates: '필요한 기운을 살림',
  drains: '기운을 나눠 씀',
  controls: '필요한 기운을 누름',
  controlled: '눌리는 자리',
};

export function HarmonySection({ harmony }) {
  if (!harmony) return null;
  return (
    <V3Section
      id="sec-harmony"
      kicker="Harmony"
      title="이름과 사주의 궁합"
      dek={harmony.yongshinKo
        ? `사주가 필요로 하는 ${harmony.yongshinKo}(五行) 기운을 이름 글자가 어떻게 대하는지 봅니다.`
        : '이름 글자의 기운이 사주와 어떻게 맞물리는지 봅니다.'}
    >
      <BezelCard invert>
        {harmony.sentence ? (
          <p className="ns-invert-muted max-w-[62ch] text-smd leading-relaxed" style={{ wordBreak: 'keep-all' }}>
            {harmony.sentence}
          </p>
        ) : null}
        {harmony.chars.length ? (
          <div className="cr-v3-harmony-grid">
            {harmony.chars.map((char, index) => (
              <div key={`${char.hanja || char.hangul}-${index}`} className="ns-invert-card cr-v3-harmony-card">
                <p className="cr-v3-harmony-card__glyph">{char.hanja || char.hangul}</p>
                <p className="mt-0.5 text-xs text-inkfaint">
                  {char.hangul}
                  {char.elementKo ? ` · ${char.elementKo}` : ''}
                  {char.strokes ? ` · ${char.strokes}획` : ''}
                </p>
                {char.relation ? (
                  <span className={cx('cr-v3-rel-chip', `cr-v3-rel-chip--${char.relation.type}`)}>
                    {char.relation.label}
                  </span>
                ) : null}
                {char.relation ? (
                  <p className="mt-1 text-2xs text-inkfaint">{REL_NOTES[char.relation.type] || ''}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </BezelCard>
      {harmony.details.length ? (
        <ul className="mt-4 space-y-1.5">
          {harmony.details.map((line) => (
            <li key={line} className="cr-v3-prose">{line}</li>
          ))}
        </ul>
      ) : null}
    </V3Section>
  );
}
