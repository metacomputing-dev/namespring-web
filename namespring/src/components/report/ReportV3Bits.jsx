import React from 'react';
import { cx } from './ReportPrimitives';

const STATE_LABELS = { good: '순조로움', mixed: '섞임', bad: '주의' };

export function StateDot({ state, className }) {
  return <span className={cx('cr-v3-state-dot', `cr-v3-state-dot--${state || 'mixed'}`, className)} aria-hidden="true" />;
}

export function TrackCards({ tracks = [], onSelect }) {
  if (!tracks.length) return null;
  return (
    <div className="cr-v3-track-row">
      {tracks.map((track) => (
        <button
          key={track.key}
          type="button"
          className="cr-v3-track-card"
          onClick={() => onSelect?.(track.target)}
        >
          <span className="cr-v3-track-card__label">{track.label}</span>
          <span className="cr-v3-track-card__state">
            <StateDot state={track.state} />
            {STATE_LABELS[track.state] || STATE_LABELS.mixed}
          </span>
        </button>
      ))}
    </div>
  );
}

export function RecapList({ rows = [] }) {
  if (!rows.length) return null;
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key} className="ns-recap-row">
          <span className={cx('ns-recap-row__dot', `ns-recap-row__dot--${row.state || 'mixed'}`)} aria-hidden="true" />
          <div>
            <p className="text-sm font-bold">{row.label}</p>
            {row.sentence ? <p className="text-sm text-inksoft">{row.sentence}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StatTiles({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <div key={item.label} className="ns-stat-tile">
          <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-inkfaint">{item.label}</p>
          <p className="mt-1 font-serif text-2xl font-bold">{item.value}</p>
          {item.caption ? <p className="mt-0.5 text-2xs text-inkfaint">{item.caption}</p> : null}
        </div>
      ))}
    </div>
  );
}
