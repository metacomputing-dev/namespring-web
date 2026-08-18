import React from 'react';
import { RevealOnScroll } from '../../../components/ui/RevealOnScroll.jsx';
import { cx } from '../../../components/report/ReportPrimitives';

const REL_CHIP = {
  match: 'bg-elfire text-cream',
  generates: 'bg-sagesoft text-sage',
  drains: 'bg-cream text-inkfaint',
  controls: 'bg-rosesoft text-rose2',
  controlled: 'bg-rosesoft text-rose2',
};

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
    <RevealOnScroll as="section" id="sec-harmony" className="scroll-mt-32 pt-14">
      <div className="rounded-[2rem] bg-ink p-6 text-cream sm:p-10">
        <p className="mb-1 text-2xs font-medium uppercase tracking-[0.15em] text-sagesoft/80">이름 × 사주</p>
        <h2 className="font-serif text-xl font-bold tracking-tight sm:text-2xl">이름과 사주의 궁합</h2>
        <p className="mt-1 text-xs text-cream/50">글자에 담긴 기운이 필요한 기운을 채우는지 봐요</p>
        {harmony.chars.length ? (
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {harmony.chars.map((char, index) => (
              <div key={`${char.hanja || char.hangul}-${index}`} className="cr-v3-invert-chip">
                <div className="cr-v3-invert-chip__face">
                  <div className="flex items-baseline gap-3">
                    <b className="font-serif text-3xl">{char.hanja || char.hangul}</b>
                    {char.meaning ? <span className="text-xs text-inksoft">{char.meaning}</span> : null}
                  </div>
                  <div className="mt-3.5 flex flex-wrap gap-1.5">
                    {char.soundElementNoun ? (
                      <span className={cx(
                        'rounded-full px-2.5 py-1 text-2xs font-bold',
                        `cr-v3-el-${char.soundElement}`,
                        'bg-[var(--el-bg)] text-[var(--el)]',
                      )}
                      >
                        발음 {char.soundElementNoun}
                      </span>
                    ) : null}
                    {char.elementNoun ? (
                      <span className={cx(
                        'rounded-full px-2.5 py-1 text-2xs font-bold',
                        `cr-v3-el-${char.element}`,
                        'bg-[var(--el-bg)] text-[var(--el)]',
                      )}
                      >
                        자원 {char.elementNoun}
                      </span>
                    ) : null}
                    {char.relation ? (
                      <span className={cx(
                        'rounded-full px-2.5 py-1 text-2xs font-extrabold',
                        REL_CHIP[char.relation.type] || REL_CHIP.drains,
                      )}
                      >
                        {REL_NOTES[char.relation.type] || char.relation.label}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-7 max-w-[62ch] text-smd leading-relaxed text-cream/80">
          {harmony.sentence ? <p>{harmony.sentence}</p> : null}
          {harmony.details.map((line) => (
            <p key={line} className="mt-2">{line}</p>
          ))}
        </div>
      </div>
    </RevealOnScroll>
  );
}
