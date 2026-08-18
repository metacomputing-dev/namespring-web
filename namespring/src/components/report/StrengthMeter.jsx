import React from 'react';

export function StrengthMeter({ position = 0.5, levelLabel }) {
  const clamped = Math.min(0.95, Math.max(0.05, Number(position) || 0.5));
  return (
    <div>
      <div
        className="ns-meter"
        role="img"
        aria-label={levelLabel ? `신강약 위치: ${levelLabel}` : '신강약 위치'}
      >
        <div className="ns-meter__fill" style={{ width: `${clamped * 100}%` }} />
        <div className="ns-meter__marker" style={{ left: `${clamped * 100}%` }} />
      </div>
      <div className="cr-v3-meter-scale" aria-hidden="true">
        <span>신약</span>
        <span>균형</span>
        <span>신강</span>
      </div>
    </div>
  );
}

export function DeukBars({ strength }) {
  if (!strength) return null;
  const rows = [
    { label: '득령', value: Number(strength.deukryeong) || 0, max: 1 },
    { label: '득지', value: Number(strength.deukji) || 0, max: 1 },
    { label: '득세', value: Number(strength.deukse) || 0, max: 7 },
  ];
  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.label} className="cr-v3-deuk">
          <span>{row.label}</span>
          <div className="ns-meter" aria-hidden="true">
            <div className="ns-meter__fill" style={{ width: `${(row.value / row.max) * 100}%` }} />
          </div>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.value}/{row.max}</span>
        </div>
      ))}
    </div>
  );
}
