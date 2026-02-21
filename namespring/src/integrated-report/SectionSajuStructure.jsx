import React from 'react';
import CollapsibleDetail from './CollapsibleDetail';

function cleanFloatingPoint(text) {
  return String(text).replace(/(-?\d+\.\d{2,})/g, (match) => {
    const num = parseFloat(match);
    return Number.isFinite(num) ? num.toFixed(1) : match;
  });
}

function SectionTitle({ children, subtitle }) {
  return (
    <div className="mb-3">
      <h3 className="text-lg font-black text-[var(--ns-accent-text)]">{children}</h3>
      {subtitle ? <p className="text-sm text-[var(--ns-muted)] mt-0.5 break-keep">{subtitle}</p> : null}
    </div>
  );
}

function StrengthDetailBar({ label, value }) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const num = Number(value);
  const width = Math.max(2, Math.min(100, Math.abs(num) * 10));
  const isPositive = num > 0;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-right font-black text-[var(--ns-muted)]">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] overflow-hidden">
        <div
          className={`h-full rounded-full ${isPositive ? 'bg-blue-400' : 'bg-rose-400'}`}
          style={{ width: `${width}%`, opacity: 0.7 }}
        />
      </div>
      <span className={`w-8 text-right font-black ${isPositive ? 'text-blue-700' : 'text-rose-700'}`}>
        {num > 0 ? `+${num.toFixed(1)}` : num.toFixed(1)}
      </span>
    </div>
  );
}

export default function SectionSajuStructure({ sajuStructureInsight, strengthDetails, gyeokgukDetail }) {
  if (!sajuStructureInsight) return null;

  const {
    strengthPct, level, isStrong,
    gyeokgukLabel, roleNeeded, roleFit, roleNarrative,
  } = sajuStructureInsight;

  const gaugePos = Math.max(5, Math.min(95, strengthPct));

  const hasStrengthDetails = strengthDetails && (
    strengthDetails.deukryeong != null || strengthDetails.deukji != null
    || strengthDetails.deukse != null || strengthDetails.details.length > 0
  );

  const hasGyeokgukDetail = gyeokgukDetail && gyeokgukDetail.reasoning;

  return (
    <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-4">
      <SectionTitle subtitle="신강/신약 체질과 격국 구조에 맞춘 이름의 역할이에요.">
        사주 체질에 이름이 어떤 도움을 줄까요?
      </SectionTitle>

      {/* 신강/신약 게이지 */}
      <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-3 mb-3">
        <div className="flex items-center justify-between text-[10px] font-black text-[var(--ns-muted)] mb-1.5">
          <span>신약</span>
          <span>중화</span>
          <span>신강</span>
        </div>
        <div className="relative h-3 rounded-full bg-gradient-to-r from-blue-100 via-gray-100 to-rose-100 border border-[var(--ns-border)]">
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--ns-border)]" />
          <div
            className="absolute top-[-3px] w-4.5 h-4.5 rounded-full border-2 border-[var(--ns-accent-text)] bg-[var(--ns-surface)] shadow-sm"
            style={{ left: `${gaugePos}%`, transform: 'translateX(-50%)' }}
          />
        </div>
        <p className="text-center text-sm font-black text-[var(--ns-accent-text)] mt-2">
          {level}
        </p>

        {/* 신강/신약 판정 근거 (접이식) */}
        {hasStrengthDetails ? (
          <CollapsibleDetail label="판정 근거 보기">
            {strengthDetails.deukryeong != null || strengthDetails.deukji != null || strengthDetails.deukse != null ? (
              <div className="space-y-1.5">
                <StrengthDetailBar label="득령" value={strengthDetails.deukryeong} />
                <StrengthDetailBar label="득지" value={strengthDetails.deukji} />
                <StrengthDetailBar label="득세" value={strengthDetails.deukse} />
              </div>
            ) : null}
            {strengthDetails.details.length > 0 ? (
              <div className="mt-1.5 space-y-1">
                {strengthDetails.details.map((text, i) => (
                  <p key={`sd-${i}`} className="text-xs text-[var(--ns-muted)] leading-relaxed break-keep">
                    {cleanFloatingPoint(text)}
                  </p>
                ))}
              </div>
            ) : null}
          </CollapsibleDetail>
        ) : null}
      </div>

      {/* 격국 */}
      <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2.5 mb-3">
        <p className="text-xs font-black text-[var(--ns-muted)] mb-1">격국</p>
        <p className="text-sm font-black text-[var(--ns-accent-text)] break-keep">
          {gyeokgukLabel}
        </p>

        {/* 격국 판정 근거 (접이식) */}
        {hasGyeokgukDetail ? (
          <CollapsibleDetail label="판정 근거 보기">
            <p className="text-xs text-[var(--ns-text)] leading-relaxed break-keep">
              {gyeokgukDetail.reasoning}
            </p>
            {gyeokgukDetail.confidence != null ? (
              <p className="text-[11px] text-[var(--ns-muted)]">
                판정 신뢰도: {Math.round(gyeokgukDetail.confidence * 100)}%
              </p>
            ) : null}
          </CollapsibleDetail>
        ) : null}
      </div>

      {/* 이름 역할 */}
      <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2.5 mb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-black text-[var(--ns-muted)]">이름에 필요한 역할</p>
          {roleFit ? (
            <span className="px-2 py-0.5 rounded-full border text-[10px] font-black border-emerald-200 bg-emerald-50 text-emerald-700">부합</span>
          ) : (
            <span className="px-2 py-0.5 rounded-full border text-[10px] font-black border-amber-200 bg-amber-50 text-amber-700">보완 필요</span>
          )}
        </div>
        <p className="text-sm text-[var(--ns-muted)]">{roleNeeded}</p>
      </div>

      {/* 서술문 */}
      <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2.5">
        <p className="text-sm leading-relaxed break-keep text-[var(--ns-text)]">
          {roleNarrative}
        </p>
      </div>
    </section>
  );
}
