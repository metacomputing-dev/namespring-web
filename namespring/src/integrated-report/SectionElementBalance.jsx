import React from 'react';
import FiveElementRadarChart from '../FiveElementRadarChart';
import {
  ELEMENT_CODE_TO_SHORT,
  clampPercent, elementBadgeClass, normalizeElementCode,
} from './constants';

function SectionTitle({ children, subtitle }) {
  return (
    <div className="mb-3">
      <h3 className="text-lg font-black text-[var(--ns-accent-text)]">{children}</h3>
      {subtitle ? <p className="text-sm text-[var(--ns-muted)] mt-0.5 break-keep">{subtitle}</p> : null}
    </div>
  );
}

export default function SectionElementBalance({
  combinedDistributionRows,
  combinedDistMax,
  deficientElements,
  excessiveElements,
}) {
  return (
    <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-4">
      <SectionTitle subtitle="사주 오행과 이름 오행을 합산한 전체 균형이에요.">
        통합 오행 밸런스
      </SectionTitle>

      {/* 결핍/과다 뱃지 */}
      {(deficientElements.length > 0 || excessiveElements.length > 0) ? (
        <div className="flex flex-wrap gap-2 mb-3">
          {deficientElements.map(el => (
            <span
              key={`def-${el}`}
              className="px-2 py-0.5 rounded-full border text-[11px] font-black border-blue-200 bg-blue-50 text-blue-700"
            >
              {ELEMENT_CODE_TO_SHORT[el] || el} 부족
            </span>
          ))}
          {excessiveElements.map(el => (
            <span
              key={`exc-${el}`}
              className="px-2 py-0.5 rounded-full border text-[11px] font-black border-rose-200 bg-rose-50 text-rose-700"
            >
              {ELEMENT_CODE_TO_SHORT[el] || el} 과다
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 md:items-center">
        <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2 py-2 flex justify-center">
          <FiveElementRadarChart rows={combinedDistributionRows} size={200} maxValue={combinedDistMax} />
        </div>
        <div className="space-y-1.5">
          {combinedDistributionRows.map(item => {
            const widthPct = clampPercent((item.value / combinedDistMax) * 100);
            const elCode = normalizeElementCode(item.key);
            const isDef = elCode && deficientElements.includes(elCode);
            const isExc = elCode && excessiveElements.includes(elCode);

            return (
              <div key={`dist-${item.key}`} className={`rounded-lg border px-3 py-2 ${elementBadgeClass(item.key)}`}>
                <div className="flex items-center justify-between text-sm font-black">
                  <span className="flex items-center gap-1.5">
                    {item.label}
                    {isDef ? <span className="text-[10px] text-blue-600">(부족)</span> : null}
                    {isExc ? <span className="text-[10px] text-rose-600">(과다)</span> : null}
                  </span>
                  <span>{item.value}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-white/60 overflow-hidden">
                  <div className="h-full rounded-full bg-current" style={{ width: `${widthPct}%`, opacity: 0.7 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
