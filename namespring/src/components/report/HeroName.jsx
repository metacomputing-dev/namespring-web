import React from 'react';
import { cx } from './ReportPrimitives';

export function HeroName({ chars = [], fullHanja }) {
  return (
    <div>
      <h2 className="cr-v3-hero__name" lang="ko">
        {chars.map((char, index) => (
          <span
            key={`${char.hangul}-${index}`}
            className={cx('cr-v3-hero__char', char.element ? `cr-v3-el-${char.element}` : null)}
          >
            {char.hangul}
          </span>
        ))}
      </h2>
      {fullHanja ? <p className="cr-v3-hero__hanja">{fullHanja}</p> : null}
    </div>
  );
}
