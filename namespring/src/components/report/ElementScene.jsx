import React from 'react';
import { cx } from './ReportPrimitives';

// Five-element landscape drawn from engine counts: resource elements
// (자원오행) place the sprites, hangul polarity picks the sky. All colors
// come from the report tokens so the scene follows light/dark themes.

const MAX_SPRITES = 5;

const TREE_SPOTS = [[44, 124], [86, 134], [124, 120], [26, 140], [150, 138]];
const MOUND_SPOTS = [[176, 136], [246, 152], [284, 136], [318, 148], [352, 132]];
const HOUSE_SPOTS = [[300, 118], [346, 124], [262, 112], [376, 112], [326, 142]];
const FLAME_SPOTS = [[0, -10], [-10, -4], [10, -4], [-4, -18], [6, -16]];

function clampCount(value) {
  return Math.min(MAX_SPRITES, Math.max(0, Math.floor(Number(value) || 0)));
}

function Tree({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-2.5" y="-6" width="5" height="16" rx="2" fill="var(--color-ink-3)" />
      <circle cx="-9" cy="-12" r="8" fill="var(--color-wood-bg)" stroke="var(--color-wood)" strokeWidth="1.5" />
      <circle cx="2" cy="-18" r="12" fill="var(--color-wood-bg)" stroke="var(--color-wood)" strokeWidth="1.5" />
    </g>
  );
}

function Mound({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M-12 0C-12 -7 -6 -11 0 -11C6 -11 12 -7 12 0Z"
        fill="var(--color-earth-bg)"
        stroke="var(--color-earth)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <g stroke="var(--color-earth)" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M-4 -11C-4 -14 -3.5 -16 -3 -18" />
        <path d="M1 -11C1 -15 1.5 -17 2 -20" />
        <path d="M6 -11C6 -13 5.5 -15 5 -16" />
      </g>
    </g>
  );
}

function House({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-13" y="-12" width="26" height="17" rx="2" fill="var(--color-card)" stroke="var(--color-metal)" strokeWidth="1.5" />
      <path d="M-16 -12L0 -25L16 -12Z" fill="var(--color-metal-bg)" stroke="var(--color-metal)" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="-3.5" y="-5" width="7" height="10" rx="1.5" fill="var(--color-metal-bg)" />
    </g>
  );
}

function Flame({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M0 -13C4.5 -6.5 7 -3 7 1.5A7 7 0 1 1 -7 1.5C-7 -3 -4.5 -6.5 0 -13Z"
        fill="var(--color-fire)"
        opacity="0.9"
      />
      <path
        d="M0 -5.5C2 -2.5 3.2 -1 3.2 1.5A3.2 3.2 0 1 1 -3.2 1.5C-3.2 -1 -2 -2.5 0 -5.5Z"
        fill="var(--color-fire-bg)"
      />
    </g>
  );
}

function Campfire({ flameCount }) {
  return (
    <g transform="translate(208 142)">
      <g stroke="var(--color-ink-3)" strokeWidth="4.5" strokeLinecap="round">
        <path d="M-13 8L13 3" />
        <path d="M-13 3L13 8" />
      </g>
      {FLAME_SPOTS.slice(0, flameCount).map(([x, y]) => (
        <Flame key={`${x}-${y}`} x={x} y={y} />
      ))}
    </g>
  );
}

function SkyOrb({ mode }) {
  if (mode === 'night') {
    return (
      <g transform="translate(54 40)">
        {/* Crescent: base disc cut by a sky-colored disc — the sky is a flat
            tint, so the overlay reads as a clean crescent in both themes. */}
        <circle r="15" fill="var(--color-warn-bg)" stroke="var(--color-ink-3)" strokeWidth="1.2" />
        <circle cx="9" cy="-6" r="13" fill="var(--scene-sky, var(--color-paper-3))" />
        <circle cx="34" cy="-10" r="2" fill="var(--color-warn-bg)" stroke="var(--color-ink-3)" strokeWidth="0.8" />
        <circle cx="44" cy="4" r="1.6" fill="var(--color-warn-bg)" stroke="var(--color-ink-3)" strokeWidth="0.8" />
      </g>
    );
  }
  if (mode === 'dusk') {
    return (
      <g transform="translate(52 38)">
        <circle cx="6" cy="-6" r="14" fill="var(--color-warn)" opacity="0.9" />
        <g fill="var(--color-paper)" stroke="var(--color-rule)" strokeWidth="1">
          <circle cx="-2" cy="8" r="9" />
          <circle cx="12" cy="9" r="10" />
          <circle cx="26" cy="8" r="7.5" />
          <rect x="-8" y="9" width="40" height="9" rx="4.5" stroke="none" />
        </g>
      </g>
    );
  }
  return (
    <g transform="translate(54 40)">
      <circle r="15" fill="var(--color-warn)" />
      <g stroke="var(--color-warn)" strokeWidth="2.5" strokeLinecap="round">
        <path d="M0 -21V-26" />
        <path d="M0 21V26" />
        <path d="M-21 0H-26" />
        <path d="M21 0H26" />
        <path d="M-15 -15L-18.5 -18.5" />
        <path d="M15 15L18.5 18.5" />
        <path d="M-15 15L-18.5 18.5" />
        <path d="M15 -15L18.5 -18.5" />
      </g>
    </g>
  );
}

export function ElementScene({ scene, caption, className }) {
  if (!scene) return null;
  const counts = {
    wood: clampCount(scene.elements?.wood),
    fire: clampCount(scene.elements?.fire),
    earth: clampCount(scene.elements?.earth),
    metal: clampCount(scene.elements?.metal),
    water: clampCount(scene.elements?.water),
  };
  const positive = Math.max(0, Math.floor(Number(scene.positive) || 0));
  const negative = Math.max(0, Math.floor(Number(scene.negative) || 0));
  const mode = negative > positive ? 'night' : positive > negative ? 'day' : 'dusk';
  const riverWidth = counts.water > 0 ? 11 + counts.water * 3 : 0;
  const pills = [
    { key: 'wood', ko: '목', count: scene.elements?.wood ?? 0 },
    { key: 'fire', ko: '화', count: scene.elements?.fire ?? 0 },
    { key: 'earth', ko: '토', count: scene.elements?.earth ?? 0 },
    { key: 'metal', ko: '금', count: scene.elements?.metal ?? 0 },
    { key: 'water', ko: '수', count: scene.elements?.water ?? 0 },
  ];
  const label = `오행 구성 ${pills.map((pill) => `${pill.ko} ${pill.count}`).join(', ')} · 음 ${negative} · 양 ${positive}`;

  return (
    <figure className={cx('cr-v3-scene', `cr-v3-scene--${mode}`, className)}>
      <svg className="cr-v3-scene__canvas" viewBox="0 0 400 168" role="img" aria-label={label}>
        <SkyOrb mode={mode} />
        <path
          d="M0 96C70 82 140 94 210 92C280 90 340 82 400 90L400 168L0 168Z"
          fill="var(--color-earth-bg)"
          opacity="0.55"
        />
        <path
          d="M0 122C80 108 170 126 250 120C310 116 360 110 400 116L400 168L0 168Z"
          fill="var(--color-earth-bg)"
        />
        {riverWidth > 0 ? (
          <g fill="none" strokeLinecap="round">
            <path
              d="M-5 152C60 147 120 156 200 152C280 148 340 156 405 151"
              stroke="var(--color-water)"
              strokeWidth={riverWidth}
              opacity="0.3"
            />
            <path
              d="M-5 152C60 147 120 156 200 152C280 148 340 156 405 151"
              stroke="var(--color-water)"
              strokeWidth="2"
              opacity="0.6"
            />
          </g>
        ) : null}
        {TREE_SPOTS.slice(0, counts.wood).map(([x, y]) => (
          <Tree key={`tree-${x}`} x={x} y={y} />
        ))}
        {MOUND_SPOTS.slice(0, counts.earth).map(([x, y]) => (
          <Mound key={`mound-${x}`} x={x} y={y} />
        ))}
        {HOUSE_SPOTS.slice(0, counts.metal).map(([x, y]) => (
          <House key={`house-${x}`} x={x} y={y} />
        ))}
        {counts.fire > 0 ? <Campfire flameCount={counts.fire} /> : null}
      </svg>
      <figcaption>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {pills.map((pill) => (
          <span
            key={pill.key}
            className={cx(
              'rounded-full px-2.5 py-1 text-2xs font-bold',
              `cr-v3-el-${pill.key}`,
              'bg-[var(--el-bg)] text-[var(--el)]',
            )}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {pill.ko} {pill.count}
          </span>
        ))}
          <span className="rounded-full bg-parchment px-2.5 py-1 text-2xs font-bold text-inksoft" style={{ fontVariantNumeric: 'tabular-nums' }}>
            음 {negative}
          </span>
          <span className="rounded-full bg-parchment px-2.5 py-1 text-2xs font-bold text-inksoft" style={{ fontVariantNumeric: 'tabular-nums' }}>
            양 {positive}
          </span>
        </div>
        {caption ? (
          <p className="mt-2 text-center text-2xs leading-relaxed text-inkfaint">{caption}</p>
        ) : null}
      </figcaption>
    </figure>
  );
}
