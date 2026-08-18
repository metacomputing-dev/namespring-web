import React, { forwardRef } from 'react';
import { RevealOnScroll } from '../../../components/ui/RevealOnScroll.jsx';

export const BasisSection = forwardRef(function BasisSection({ basis }, detailsRef) {
  if (!basis) return null;
  return (
    <RevealOnScroll as="section" id="sec-basis" className="scroll-mt-32 pt-14">
      <details ref={detailsRef} className="cr-v3-disclosure rounded-[2rem] border border-hairline bg-parchment/60 p-6 open:bg-parchment/80 sm:p-8">
        <summary>
          <span>
            <span className="mb-1 block text-2xs font-medium uppercase tracking-[0.15em] text-sage">신뢰 안내</span>
            <span className="font-serif text-xl font-bold tracking-tight">분석 근거와 기준</span>
          </span>
        </summary>
        <div className="mt-6 border-t border-hairline pt-6">
          {basis.rows.length ? (
            <div className="overflow-x-auto">
              <table className="cr-v3-evidence">
                <tbody>
                  {basis.rows.map((row) => (
                    <tr key={row.term}>
                      <th scope="row">{row.term}</th>
                      <td>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {basis.gyeokgukReasoning ? (
            <p className="mt-3 text-sm text-inkfaint">{basis.gyeokgukReasoning}</p>
          ) : null}
          {basis.uncertainties.length ? (
            <ul className="mt-3 space-y-1 text-sm text-inkfaint">
              {basis.uncertainties.map((item) => (
                <li key={item.id || item.message}>{item.message}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-6 space-y-3 text-xs leading-relaxed text-inksoft">
            <p><b>발음오행 기준</b> — ㅇ·ㅎ을 흙(土)으로 보는 훈민정음 운해본 기준이에요. 물(水)로 보는 유파도 있어요.</p>
            <p><b>수리 기준</b> — 현행 엔진 공식 기준이에요.</p>
            <p><b>서술 방식</b> — 판정은 전부 계산 결과이고, 문장은 미리 작성·검수된 문안 조합이에요. 실시간 AI 생성이 아니에요.</p>
          </div>
          <p className="mt-4 text-2xs text-inkfaint">
            같은 입력에는 항상 같은 결과가 나와요.
            {basis.schoolPreset ? ` 유파 기준: ${basis.schoolPreset}.` : ''}
            {basis.engineVersion ? ` 엔진 버전 ${basis.engineVersion}.` : ''}
          </p>
        </div>
      </details>
    </RevealOnScroll>
  );
});
