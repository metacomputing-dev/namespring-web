import React, { useState } from 'react';
import { RevealOnScroll } from '../../../components/ui/RevealOnScroll.jsx';
import { SajuPillarTable, StatusPanel, cx } from '../../../components/report/ReportPrimitives';
import { DeukBars } from '../../../components/report/StrengthMeter.jsx';
import { ExpertOnly, TierText } from '../../../components/ui/TierToggle.jsx';
import { ELEMENT_HANJA } from '../element-relations.js';

export function SajuSummarySection({ saju }) {
  const [pillarsOpen, setPillarsOpen] = useState(false);
  if (!saju) return null;

  const pillarColumns = (saju.pillarColumns || []).map((column) => ({
    key: column.key,
    label: column.label,
    stem: { symbol: column.stem, element: column.stemElement || '' },
    branch: { symbol: column.branch, element: column.branchElement || '' },
  }));
  const meterPercent = Math.round((saju.strength?.meterPosition ?? 0.5) * 100);
  const yongshinElement = saju.yongshin?.element;
  const expertYongshin = [
    saju.yongshin?.confidence !== null && saju.yongshin
      ? `판단 신뢰도 ${Math.round(saju.yongshin.confidence)}점`
      : null,
    saju.yongshin?.heeshin ? `희신 ${ELEMENT_HANJA[saju.yongshin.heeshin]}` : null,
    saju.yongshin?.gishin ? `기신 ${ELEMENT_HANJA[saju.yongshin.gishin]}` : null,
    saju.gyeokguk?.type ? `격국 ${saju.gyeokguk.type}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <RevealOnScroll as="section" id="sec-saju" className="scroll-mt-32 pt-14">
      <div className="mb-6 px-1">
        <p className="mb-1 text-2xs font-medium uppercase tracking-[0.15em] text-sage">사주 분석</p>
        <h2 className="font-serif text-xl font-bold tracking-tight sm:text-2xl">내 사주 요약</h2>
        <p className="mt-1 max-w-[52ch] text-xs leading-relaxed text-inkfaint">
          이름이 채워야 할 목표예요. 여기서는 뼈대만 봐요 — 깊은 풀이는 사주 보고서에서 이어져요.
        </p>
      </div>

      {saju.uncertaintyMessage ? (
        <div className="mb-4">
          <StatusPanel tone="warn" title="출생 시각 정보가 불완전해요.">
            {saju.uncertaintyMessage}
          </StatusPanel>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-hairline bg-card p-6">
          <h3 className="mb-4 text-xs font-bold tracking-[0.04em] text-inkfaint">타고난 바탕 · 일간</h3>
          <div className="flex items-center gap-4">
            <span className={cx(
              'grid h-16 w-16 flex-none place-items-center rounded-2xl border-2 font-serif text-3xl font-bold',
              `cr-v3-el-${saju.dayMaster?.element || 'neutral'}`,
              'border-[var(--el)] bg-[var(--el-bg)] text-[var(--el)]',
            )}
            >
              {saju.dayMaster?.hanja || saju.dayMaster?.stem || '—'}
            </span>
            <p className="text-sm leading-relaxed text-inksoft">
              {saju.dayMaster ? (
                <b className="text-ink">
                  {saju.dayMaster.stem}{saju.dayMaster.elementNoun ? ` · ${saju.dayMaster.elementNoun} 기운` : ''}
                </b>
              ) : null}
              {saju.texts.dayMaster ? <><br />{saju.texts.dayMaster}</> : null}
            </p>
          </div>
          {pillarColumns.length ? (
            <>
              <button
                type="button"
                aria-expanded={pillarsOpen}
                onClick={() => setPillarsOpen((prev) => !prev)}
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-sage transition-colors hover:text-ink"
              >
                {pillarsOpen ? '사주 여덟 글자 접기' : '사주 여덟 글자 펼쳐 보기'}
              </button>
              {pillarsOpen ? (
                <div className="mt-4">
                  <SajuPillarTable columns={pillarColumns} compact />
                  <p className="mt-2 text-2xs text-inkfaint">일주 자리가 나의 기둥이에요. 깊은 풀이는 사주 보고서에서 이어져요.</p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="rounded-3xl border border-hairline bg-card p-6">
          <h3 className="mb-4 text-xs font-bold tracking-[0.04em] text-inkfaint">기운의 저울 · 신강과 신약</h3>
          <div className="relative h-2.5 rounded-full bg-hairline">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sage to-elearth opacity-80"
              style={{ width: `${meterPercent}%` }}
            />
            <div
              className="absolute -top-1.5 h-5 w-1 rounded-full bg-ink"
              style={{ left: `calc(${meterPercent}% - 2px)` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-2xs text-inkfaint">
            <span>신약</span>
            <span>균형</span>
            <b className="text-ink">{saju.strength?.level || ''}</b>
          </div>
          {saju.texts.strength ? (
            <p className="mt-4 text-sm leading-relaxed text-inksoft">{saju.texts.strength}</p>
          ) : null}
          <ExpertOnly>
            <div className="mt-4">
              <DeukBars strength={saju.strength} />
            </div>
          </ExpertOnly>
          <p className="tier-plain mt-4 text-xs text-inkfaint">전문가 레이어에서 득령 · 득지 · 득세 근거를 볼 수 있어요.</p>
        </div>

        {saju.elementBars ? (
          <div className="rounded-3xl border border-hairline bg-card p-6">
            <h3 className="mb-4 text-xs font-bold tracking-[0.04em] text-inkfaint">오행 분포</h3>
            <div className="space-y-2">
              {saju.elementBars.map((bar) => (
                <div key={bar.element} className={cx('cr-v3-el-bar', `cr-v3-el-${bar.element}`)}>
                  <span>{bar.ko}</span>
                  <span className="cr-v3-el-bar__track">
                    <i className="cr-v3-el-bar__fill" style={{ width: `${Math.round(bar.ratio * 100)}%` }} />
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{bar.count}</span>
                </div>
              ))}
            </div>
            {saju.texts.elementBalance ? (
              <p className="mt-3 text-xs text-inkfaint">{saju.texts.elementBalance}</p>
            ) : null}
          </div>
        ) : null}

        {yongshinElement ? (
          <div className={cx(
            'rounded-3xl border-2 p-6',
            `cr-v3-el-${yongshinElement}`,
            'border-[var(--el-line)] bg-[var(--el-bg)]',
          )}
          >
            <h3 className="mb-4 text-xs font-bold tracking-[0.04em] text-[var(--el)]">필요한 기운 · 용신</h3>
            <div className="flex items-center gap-4">
              <span className="relative grid h-20 w-20 flex-none place-items-center rounded-full border-2 border-[var(--el)] bg-card">
                <span className="absolute inset-2 rounded-full border border-[var(--el)] opacity-40" aria-hidden="true" />
                <span className="absolute inset-4 rounded-full border border-[var(--el)] opacity-30" aria-hidden="true" />
                <b className="relative font-serif text-2xl text-[var(--el)]">{ELEMENT_HANJA[yongshinElement]}</b>
              </span>
              <p className="text-sm leading-relaxed text-inksoft">
                <b className="text-ink">{saju.yongshin.elementKo}({ELEMENT_HANJA[yongshinElement]})의 기운</b>
                <br />
                <TierText
                  plain={saju.texts.yongshin || ''}
                  expert={expertYongshin || saju.texts.yongshin || ''}
                />
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {saju.texts.plain || saju.texts.expert ? (
        <div className="mt-5 max-w-[62ch] text-smd leading-relaxed text-inksoft">
          <TierText
            as="p"
            plain={saju.texts.plain || saju.texts.expert}
            expert={saju.texts.expert || saju.texts.plain}
          />
        </div>
      ) : null}
    </RevealOnScroll>
  );
}
