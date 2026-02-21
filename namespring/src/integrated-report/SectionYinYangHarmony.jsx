import React from 'react';

function SectionTitle({ children, subtitle }) {
  return (
    <div className="mb-3">
      <h3 className="text-lg font-black text-[var(--ns-accent-text)]">{children}</h3>
      {subtitle ? <p className="text-sm text-[var(--ns-muted)] mt-0.5 break-keep">{subtitle}</p> : null}
    </div>
  );
}

function PolarityBadge({ value }) {
  const isYang = value === '양';
  return (
    <span
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full border text-sm font-black ${
        isYang
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-blue-200 bg-blue-50 text-blue-700'
      }`}
    >
      {value}
    </span>
  );
}

export default function SectionYinYangHarmony({ yinYangHarmony }) {
  if (!yinYangHarmony) return null;

  const {
    namePattern, nameYang, nameYin,
    sajuYang, sajuYin, totalYang, totalYin,
    patternVerdict, balanceLabel, narrative,
  } = yinYangHarmony;

  return (
    <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-4">
      <SectionTitle subtitle="획수의 홀짝이 만드는 음양 패턴과 사주 기운의 조화에요.">
        이름과 사주의 음양 리듬
      </SectionTitle>

      {/* 이름 음양 패턴 */}
      <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-3 mb-3">
        <p className="text-xs font-black text-[var(--ns-muted)] mb-2">이름 음양 패턴</p>
        <div className="flex items-center gap-2">
          {namePattern.map((p, i) => (
            <PolarityBadge key={`yy-name-${i}`} value={p} />
          ))}
          <span className="text-xs text-[var(--ns-muted)] ml-2">{patternVerdict}</span>
        </div>
      </div>

      {/* 음양 수치 테이블 */}
      <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-3 mb-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[var(--ns-muted)] text-xs">
              <th className="text-left font-black py-1"></th>
              <th className="text-center font-black py-1">이름</th>
              <th className="text-center font-black py-1">사주</th>
              <th className="text-center font-black py-1">종합</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-left py-1 font-black text-rose-700">양(陽)</td>
              <td className="text-center py-1">{nameYang}</td>
              <td className="text-center py-1">{sajuYang}</td>
              <td className="text-center py-1 font-black">{totalYang}</td>
            </tr>
            <tr>
              <td className="text-left py-1 font-black text-blue-700">음(陰)</td>
              <td className="text-center py-1">{nameYin}</td>
              <td className="text-center py-1">{sajuYin}</td>
              <td className="text-center py-1 font-black">{totalYin}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-2 text-right">
          <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-black ${
            balanceLabel === '양음 균형'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}>
            {balanceLabel}
          </span>
        </div>
      </div>

      {/* 서술문 */}
      <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2.5">
        <p className="text-sm leading-relaxed break-keep text-[var(--ns-text)]">
          {narrative}
        </p>
      </div>
    </section>
  );
}
