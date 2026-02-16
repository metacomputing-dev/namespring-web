import React, { useMemo, useState } from 'react';

const ELEMENT_CODE_ORDER = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];
const POSITION_ORDER = ['YEAR', 'MONTH', 'DAY', 'HOUR'];
const POSITION_LABEL = { YEAR: '년주', MONTH: '월주', DAY: '일주', HOUR: '시주' };

function toElementKey(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return '';
  if (raw === '목') return 'WOOD';
  if (raw === '화') return 'FIRE';
  if (raw === '토') return 'EARTH';
  if (raw === '금') return 'METAL';
  if (raw === '수') return 'WATER';
  if (raw === 'WOOD' || raw === 'FIRE' || raw === 'EARTH' || raw === 'METAL' || raw === 'WATER') return raw;
  return raw;
}

function elementLabel(value) {
  const key = toElementKey(value);
  if (key === 'WOOD') return '목';
  if (key === 'FIRE') return '화';
  if (key === 'EARTH') return '토';
  if (key === 'METAL') return '금';
  if (key === 'WATER') return '수';
  return key || '-';
}

function elementCardClass(value) {
  const key = toElementKey(value);
  if (key === 'WOOD') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (key === 'FIRE') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (key === 'EARTH') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (key === 'METAL') return 'border-slate-200 bg-slate-100 text-slate-800';
  if (key === 'WATER') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)]';
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatNumber(value, digits = 1) {
  return asNumber(value, 0).toFixed(digits);
}

function formatDateTime(data) {
  const year = asNumber(data?.year, 0);
  const month = String(asNumber(data?.month, 0)).padStart(2, '0');
  const day = String(asNumber(data?.day, 0)).padStart(2, '0');
  const hour = String(asNumber(data?.hour, 0)).padStart(2, '0');
  const minute = String(asNumber(data?.minute, 0)).padStart(2, '0');
  return `${year}.${month}.${day} ${hour}:${minute}`;
}

function strengthGuide(strength) {
  if (!strength) return '-';
  const level = String(strength.level || '').trim();
  if (!level) return strength.isStrong ? '신강' : '신약';
  return `${level} / ${strength.isStrong ? '신강' : '신약'}`;
}

function CollapseCard({ title, subtitle, open, onToggle, children }) {
  return (
    <section className="bg-[var(--ns-surface)] rounded-[2rem] border border-[var(--ns-border)] shadow-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-lg font-black text-[var(--ns-accent-text)]">{title}</h3>
          {subtitle ? <p className="text-sm text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">{subtitle}</p> : null}
        </div>
        <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--ns-border)] bg-[var(--ns-surface-soft)]">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className={`w-4 h-4 text-[var(--ns-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </section>
  );
}

function InfoCard({ title, value }) {
  return (
    <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2.5">
      <p className="text-[11px] font-black text-[var(--ns-muted)] mb-1">{title}</p>
      <p className="text-sm text-[var(--ns-text)] break-keep whitespace-normal">{value || '-'}</p>
    </div>
  );
}

function PillarCard({ label, pillar }) {
  return (
    <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2.5">
      <p className="text-[11px] font-black text-[var(--ns-muted)] mb-1">{label}</p>
      <p className="text-sm text-[var(--ns-text)] font-black">
        {pillar?.stem?.hangul || '-'}({pillar?.stem?.hanja || '-'}) / {pillar?.branch?.hangul || '-'}({pillar?.branch?.hanja || '-'})
      </p>
      <p className="text-xs text-[var(--ns-muted)] mt-1">
        {pillar?.stem?.code || '-'} / {pillar?.branch?.code || '-'}
      </p>
    </div>
  );
}

function SajuReport({ report }) {
  if (!report) return null;

  const [openCards, setOpenCards] = useState({
    time: true,
    pillars: true,
    strength: true,
    yongshin: true,
    elements: true,
    tenGod: true,
    relations: false,
    shinsal: false,
  });

  const toggleCard = (key) => {
    setOpenCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const pillarRows = useMemo(() => ([
    ['년주', report?.pillars?.year],
    ['월주', report?.pillars?.month],
    ['일주', report?.pillars?.day],
    ['시주', report?.pillars?.hour],
  ]), [report]);

  const distributionRows = useMemo(() => {
    const raw = report?.elementDistribution || {};
    const extraKeys = Object.keys(raw)
      .map((key) => toElementKey(key))
      .filter((key) => key && !ELEMENT_CODE_ORDER.includes(key));

    const orderedKeys = [...ELEMENT_CODE_ORDER, ...extraKeys];
    const rows = orderedKeys.map((key) => ({
      key,
      value: asNumber(raw[key], 0),
    }));
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return rows.map((row) => ({
      ...row,
      ratio: total > 0 ? Math.round((row.value / total) * 100) : 0,
      total,
    }));
  }, [report]);

  const deficiency = useMemo(() => {
    const src = Array.isArray(report?.deficientElements) ? report.deficientElements : [];
    return src.map((item) => toElementKey(item)).filter(Boolean);
  }, [report]);

  const excessive = useMemo(() => {
    const src = Array.isArray(report?.excessiveElements) ? report.excessiveElements : [];
    return src.map((item) => toElementKey(item)).filter(Boolean);
  }, [report]);

  const tenGodRows = useMemo(() => {
    const byPosition = report?.tenGodAnalysis?.byPosition || {};
    const rows = Object.entries(byPosition)
      .map(([position, data]) => ({ position: String(position), data }))
      .sort((a, b) => {
        const ai = POSITION_ORDER.indexOf(a.position);
        const bi = POSITION_ORDER.indexOf(b.position);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
    return rows;
  }, [report]);

  const cheonganRelations = Array.isArray(report?.cheonganRelations) ? report.cheonganRelations : [];
  const jijiRelations = Array.isArray(report?.jijiRelations) ? report.jijiRelations : [];
  const shinsalHits = Array.isArray(report?.shinsalHits) ? report.shinsalHits : [];

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 md:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-[var(--ns-accent-text)]">사주 핵심 요약</h2>
            <p className="text-sm text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">
              엔진에서 계산된 실제 사주 값을 기준으로 정리했어요.
            </p>
          </div>
          <div className={`rounded-xl border px-3 py-2 text-right ${report?.sajuEnabled ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <p className={`text-xs font-black ${report?.sajuEnabled ? 'text-emerald-700' : 'text-amber-700'}`}>
              분석 상태
            </p>
            <p className={`text-lg font-black ${report?.sajuEnabled ? 'text-emerald-800' : 'text-amber-800'}`}>
              {report?.sajuEnabled ? '활성' : '비활성'}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <InfoCard title="일간 코드" value={report?.dayMaster?.stem || '-'} />
          <InfoCard title="일간 오행" value={`${elementLabel(report?.dayMaster?.element)} (${report?.dayMaster?.element || '-'})`} />
          <InfoCard title="일간 음양" value={report?.dayMaster?.polarity || '-'} />
          <InfoCard title="강약 판정" value={strengthGuide(report?.strength)} />
          <InfoCard title="격국" value={`${report?.gyeokguk?.type || '-'} / ${report?.gyeokguk?.category || '-'}`} />
          <InfoCard title="용신" value={`${elementLabel(report?.yongshin?.element)} (${report?.yongshin?.element || '-'})`} />
        </div>
      </section>

      <CollapseCard
        title="시간 보정"
        subtitle="입력된 시간과 보정 후 시간을 비교해서 보여줘요."
        open={openCards.time}
        onToggle={() => toggleCard('time')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <InfoCard
            title="표준시 기준"
            value={formatDateTime({
              year: report?.timeCorrection?.standardYear,
              month: report?.timeCorrection?.standardMonth,
              day: report?.timeCorrection?.standardDay,
              hour: report?.timeCorrection?.standardHour,
              minute: report?.timeCorrection?.standardMinute,
            })}
          />
          <InfoCard
            title="보정 후 기준"
            value={formatDateTime({
              year: report?.timeCorrection?.adjustedYear,
              month: report?.timeCorrection?.adjustedMonth,
              day: report?.timeCorrection?.adjustedDay,
              hour: report?.timeCorrection?.adjustedHour,
              minute: report?.timeCorrection?.adjustedMinute,
            })}
          />
          <InfoCard title="DST 보정(분)" value={String(asNumber(report?.timeCorrection?.dstCorrectionMinutes, 0))} />
          <InfoCard title="경도 보정(분)" value={String(asNumber(report?.timeCorrection?.longitudeCorrectionMinutes, 0))} />
          <InfoCard title="균시차(분)" value={String(asNumber(report?.timeCorrection?.equationOfTimeMinutes, 0))} />
        </div>
      </CollapseCard>

      <CollapseCard
        title="사주 기둥"
        subtitle="년주·월주·일주·시주의 천간/지지 실제 값이에요."
        open={openCards.pillars}
        onToggle={() => toggleCard('pillars')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {pillarRows.map(([label, pillar]) => (
            <PillarCard key={label} label={label} pillar={pillar} />
          ))}
        </div>
      </CollapseCard>

      <CollapseCard
        title="강약 분석"
        subtitle="득령·득지·득세와 판정 상세 문장을 그대로 표시해요."
        open={openCards.strength}
        onToggle={() => toggleCard('strength')}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <InfoCard title="총 생조" value={formatNumber(report?.strength?.totalSupport)} />
            <InfoCard title="총 극설" value={formatNumber(report?.strength?.totalOppose)} />
            <InfoCard title="레벨" value={strengthGuide(report?.strength)} />
            <InfoCard title="득령" value={formatNumber(report?.strength?.deukryeong)} />
            <InfoCard title="득지" value={formatNumber(report?.strength?.deukji)} />
            <InfoCard title="득세" value={formatNumber(report?.strength?.deukse)} />
          </div>
          {Array.isArray(report?.strength?.details) && report.strength.details.length ? (
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2.5 space-y-1">
              <p className="text-[11px] font-black text-[var(--ns-muted)]">상세 로그</p>
              {report.strength.details.map((line, index) => (
                <p key={`strength-line-${index}`} className="text-xs text-[var(--ns-text)] break-keep whitespace-normal leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </CollapseCard>

      <CollapseCard
        title="용신 · 격국"
        subtitle="용신/희신/기신/구신과 격국 해석을 실제 값 그대로 보여줘요."
        open={openCards.yongshin}
        onToggle={() => toggleCard('yongshin')}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <InfoCard title="용신" value={`${elementLabel(report?.yongshin?.element)} (${report?.yongshin?.element || '-'})`} />
            <InfoCard title="희신" value={`${elementLabel(report?.yongshin?.heeshin)} (${report?.yongshin?.heeshin || '-'})`} />
            <InfoCard title="기신" value={`${elementLabel(report?.yongshin?.gishin)} (${report?.yongshin?.gishin || '-'})`} />
            <InfoCard title="구신" value={`${elementLabel(report?.yongshin?.gushin)} (${report?.yongshin?.gushin || '-'})`} />
            <InfoCard title="신뢰도" value={formatNumber(report?.yongshin?.confidence, 2)} />
            <InfoCard title="합의 결과" value={report?.yongshin?.agreement || '-'} />
          </div>

          {Array.isArray(report?.yongshin?.recommendations) && report.yongshin.recommendations.length ? (
            <div className="space-y-2">
              {report.yongshin.recommendations.map((item, index) => (
                <div key={`recommend-${item?.type || 'type'}-${index}`} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2.5">
                  <p className="text-[11px] font-black text-[var(--ns-muted)] mb-1">{item?.type || `추천 ${index + 1}`}</p>
                  <p className="text-xs text-[var(--ns-muted)] mb-1">
                    주 오행: {item?.primaryElement || '-'} / 보조 오행: {item?.secondaryElement || '-'} / 신뢰도: {formatNumber(item?.confidence, 2)}
                  </p>
                  <p className="text-sm text-[var(--ns-text)] break-keep whitespace-normal leading-relaxed">
                    {item?.reasoning || '-'}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <InfoCard title="격국 코드" value={report?.gyeokguk?.type || '-'} />
            <InfoCard title="격국 분류" value={report?.gyeokguk?.category || '-'} />
            <InfoCard title="기준 십성" value={report?.gyeokguk?.baseTenGod || '-'} />
            <InfoCard title="격국 신뢰도" value={formatNumber(report?.gyeokguk?.confidence, 2)} />
          </div>
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2.5">
            <p className="text-[11px] font-black text-[var(--ns-muted)] mb-1">격국 해석</p>
            <p className="text-sm text-[var(--ns-text)] break-keep whitespace-normal leading-relaxed">
              {report?.gyeokguk?.reasoning || '-'}
            </p>
          </div>
        </div>
      </CollapseCard>

      <CollapseCard
        title="오행 분포"
        subtitle="오행 분포와 부족/과다 오행을 실제 분포값으로 표시해요."
        open={openCards.elements}
        onToggle={() => toggleCard('elements')}
      >
        <div className="space-y-2">
          {distributionRows.map((row) => (
            <div key={row.key} className={`rounded-xl border px-3 py-2.5 ${elementCardClass(row.key)}`}>
              <div className="flex items-center justify-between text-sm font-black">
                <span>{elementLabel(row.key)} ({row.key})</span>
                <span>{row.value} ({row.ratio}%)</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-white/60 overflow-hidden">
                <div className="h-full rounded-full bg-current" style={{ width: `${row.ratio}%`, opacity: 0.7 }} />
              </div>
            </div>
          ))}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <InfoCard
              title="부족 오행"
              value={deficiency.length ? deficiency.map((key) => `${elementLabel(key)}(${key})`).join(', ') : '없음'}
            />
            <InfoCard
              title="과다 오행"
              value={excessive.length ? excessive.map((key) => `${elementLabel(key)}(${key})`).join(', ') : '없음'}
            />
          </div>
        </div>
      </CollapseCard>

      <CollapseCard
        title="십성 분석"
        subtitle="사주 각 주의 천간 십성과 지지 본기 십성, 지장간 정보를 보여줘요."
        open={openCards.tenGod}
        onToggle={() => toggleCard('tenGod')}
      >
        <div className="space-y-2">
          <InfoCard title="일간 기준" value={report?.tenGodAnalysis?.dayMaster || '-'} />
          {tenGodRows.length ? tenGodRows.map(({ position, data }) => (
            <div key={`ten-god-${position}`} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2.5">
              <p className="text-[11px] font-black text-[var(--ns-muted)] mb-1">
                {POSITION_LABEL[position] || position}
              </p>
              <p className="text-sm text-[var(--ns-text)] break-keep whitespace-normal">
                천간 십성: {data?.cheonganTenGod || '-'} / 지지 본기 십성: {data?.jijiPrincipalTenGod || '-'}
              </p>
              <div className="mt-1 space-y-1">
                {Array.isArray(data?.hiddenStems) && data.hiddenStems.length ? (
                  <p className="text-xs text-[var(--ns-muted)] break-keep whitespace-normal">
                    지장간: {data.hiddenStems.map((hidden) => `${hidden?.stem || '-'}(${hidden?.element || '-'}, ${formatNumber(hidden?.ratio, 2)})`).join(', ')}
                  </p>
                ) : null}
                {Array.isArray(data?.hiddenStemTenGod) && data.hiddenStemTenGod.length ? (
                  <p className="text-xs text-[var(--ns-muted)] break-keep whitespace-normal">
                    지장간 십성: {data.hiddenStemTenGod.map((hidden) => `${hidden?.stem || '-'}:${hidden?.tenGod || '-'}`).join(', ')}
                  </p>
                ) : null}
              </div>
            </div>
          )) : <p className="text-sm text-[var(--ns-muted)]">십성 분석 정보가 없습니다.</p>}
        </div>
      </CollapseCard>

      <CollapseCard
        title="천간 · 지지 관계"
        subtitle="합/충/형/파/해 등 관계 해석 값과 점수 정보를 보여줘요."
        open={openCards.relations}
        onToggle={() => toggleCard('relations')}
      >
        <div className="space-y-3">
          <section className="space-y-2">
            <p className="text-sm font-black text-[var(--ns-accent-text)]">천간 관계</p>
            {cheonganRelations.length ? cheonganRelations.map((item, index) => (
              <div key={`cg-${index}`} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2.5">
                <p className="text-sm font-black text-[var(--ns-text)]">{item?.type || '-'}</p>
                <p className="text-xs text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">
                  멤버: {(Array.isArray(item?.stems) ? item.stems.join(', ') : '-')} / 결과오행: {item?.resultElement || '-'}
                </p>
                {item?.note ? <p className="text-xs text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">{item.note}</p> : null}
                {item?.score ? (
                  <p className="text-xs text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">
                    점수: base {formatNumber(item.score.baseScore, 2)}, adj {formatNumber(item.score.adjacencyBonus, 2)}, mult {formatNumber(item.score.outcomeMultiplier, 2)}, final {formatNumber(item.score.finalScore, 2)}
                  </p>
                ) : null}
              </div>
            )) : <p className="text-sm text-[var(--ns-muted)]">천간 관계 정보가 없습니다.</p>}
          </section>

          <section className="space-y-2">
            <p className="text-sm font-black text-[var(--ns-accent-text)]">지지 관계</p>
            {jijiRelations.length ? jijiRelations.map((item, index) => (
              <div key={`jj-${index}`} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2.5">
                <p className="text-sm font-black text-[var(--ns-text)]">{item?.type || '-'}</p>
                <p className="text-xs text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">
                  멤버: {(Array.isArray(item?.branches) ? item.branches.join(', ') : '-')} / 결과: {item?.outcome || '-'}
                </p>
                {item?.note ? <p className="text-xs text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">{item.note}</p> : null}
                {item?.reasoning ? <p className="text-xs text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">{item.reasoning}</p> : null}
              </div>
            )) : <p className="text-sm text-[var(--ns-muted)]">지지 관계 정보가 없습니다.</p>}
          </section>
        </div>
      </CollapseCard>

      <CollapseCard
        title="신살 · 공망"
        subtitle="신살 히트와 공망 값을 실제 계산 결과 그대로 확인해요."
        open={openCards.shinsal}
        onToggle={() => toggleCard('shinsal')}
      >
        <div className="space-y-2">
          <InfoCard
            title="공망"
            value={Array.isArray(report?.gongmang) ? report.gongmang.join(', ') : '-'}
          />
          {shinsalHits.length ? (
            <div className="space-y-2">
              {shinsalHits.map((item, index) => (
                <div key={`shinsal-${index}`} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2.5">
                  <p className="text-sm font-black text-[var(--ns-text)]">
                    {item?.type || '-'} ({item?.position || '-'})
                  </p>
                  <p className="text-xs text-[var(--ns-muted)] mt-1">
                    등급: {item?.grade || '-'} / 가중치: {formatNumber(item?.weightedScore, 2)} (base {formatNumber(item?.baseWeight, 2)}, x {formatNumber(item?.positionMultiplier, 2)})
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--ns-muted)]">신살 정보가 없습니다.</p>
          )}
        </div>
      </CollapseCard>
    </div>
  );
}

export default SajuReport;
