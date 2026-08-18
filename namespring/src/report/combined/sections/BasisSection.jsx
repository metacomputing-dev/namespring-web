import React, { forwardRef } from 'react';
import { V3Section } from './V3Section.jsx';

export const BasisSection = forwardRef(function BasisSection({ basis }, detailsRef) {
  if (!basis) return null;
  return (
    <V3Section
      id="sec-basis"
      kicker="Evidence"
      title="분석 근거와 기준"
      dek="이 보고서의 모든 판정이 어떤 값에서 나왔는지 공개합니다."
    >
      <details ref={detailsRef} className="cr-v3-disclosure">
        <summary>판정에 사용된 값 보기</summary>
        <div className="cr-v3-disclosure__body">
          {basis.rows.length ? (
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
          <p className="mt-4 text-2xs text-inkfaint">
            이 보고서는 입력된 정보와 성명학·명리학 계산 규칙만으로 산출되며, 같은 입력에는 항상 같은
            결과가 나옵니다.
            {basis.schoolPreset ? ` 유파 기준: ${basis.schoolPreset}.` : ''}
            {basis.engineVersion ? ` 엔진 버전 ${basis.engineVersion}.` : ''}
          </p>
        </div>
      </details>
    </V3Section>
  );
});
