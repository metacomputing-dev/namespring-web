# 스택 18 격국 투간·구조격 기본변화 dossier

> 상태: **독립 명리 승인 대기(pending)**
> 원인 커밋: 6fb2f68a4 → 0416c3daa
> 스냅샷 증거 carrier: Stack 22
> fingerprint: sha256:6018d66d34e3875e22cb8924f01221b41bfaa9adaa1c9993ff3ddadd809440a0

## 결론

0416c3daa는 일간 자신을 월령 지장간의 투간 증거로 잘못 세던 P0 오류를 수정하고,
일간 자기투간에 의한 잘못된 일반 격 승격 경로를 차단하도록 구조격 판정과 일반격 후보 선택을
분리했다. 코드를 되돌릴 사유는 확인되지 않았지만, 판정 기본값이 바뀌므로 테스트 통과만으로
승인할 수 없다.

2026-07-13 재실측은 저장 기준 대비 정확히 5픽스처·8 leaf이며 커밋 메시지에 선기록된
fingerprint와 일치한다. Stack 22의 다른 소스 변경에는 격국·facts 기본 판정 코드가 없다.

| fixture | 필드 | 이전 | 현재 |
|---|---|---:|---:|
| fix-01 | sajuReport.gyeokgukConfidence | 0.562957219251337 | 0.5820160427807487 |
| fix-06 | sajuReport.gyeokgukType | 양인격 | 정인격 |
| fix-06 | sajuReport.gyeokgukConfidence | 0.35000000000000003 | 0.4855555555555555 |
| fix-07 | sajuReport.gyeokgukType | 월겁격 | 정인격 |
| fix-07 | sajuReport.gyeokgukConfidence | 0.6168 | 0.6102 |
| fix-08 | sajuReport.gyeokgukConfidence | 0.65625 | 0.67875 |
| fix-11 | sajuReport.gyeokgukType | 건록격 | 식신격 |
| fix-11 | sajuReport.gyeokgukConfidence | 0.2540192307692308 | 0.24046153846153842 |

## 귀속과 반증

- 투간은 일간을 제외한 년간·월간·시간의 출현으로 단일화했다.
- 일간 자신은 투간에서 제외하고, 구조격 분류는 일반 월령격 후보 선택과 독립된 classifier가 수행한다.
- classifier가 구조격을 반환하지 않은 비겁 지장간은 진단 증거로 남기되 일반 월령격 후보에서는 제외한다.
- 0416c3daa의 376줄 구조격 회귀 테스트가 fix-06·07·11 재분류를 의도적으로 고정한다.
- Stack 22에서 단독 snapshot 실행과 exact diff를 반복해 같은 5/8 결과를 얻었다.
- 별도 후보 snapshot도 9픽스처 변화가 있고 fingerprint
  sha256:b05f310745c6ae1ff15a0e90abb090affc51139afe991635b2115cae0c66c746로
  커밋 메시지에 기록되어 있다. Stack 22 재캡처를 동일 deep-diff 규약으로 정규화하면 9픽스처·22 exact diff record/path, sha256:246c769a989536fbda66aaa6f0ac5156d951d1d8af35d32aae6b2a391387c81e다. 이 후보 변화 역시 같은 전문가 승인 범위이며 누락하면 안 된다.

## 후속 독립 반박검토에서 발견된 별도 P1

0416c3daa의 자기 투간 제외 자체는 타당하고 다른 년간·월간·시간의 합법적 투간은
보존된다. 다만 같은 커밋의 경계에서 아래 두 P1이 추가로 확인됐다. 이 항목은 기존
5픽스처·8 leaf와 후보 9건을 승인한다고 자동 해소되지 않는다.

1. 토 일간 잡기월 가운데 본기가 BI_GYEON인 4조합(戊辰·戊戌·己丑·己未)을
   건록 구조격으로 자동 승격하는 `MONTH_MAIN_BI_GYEON` 호환정책은 strict 자평
   월령 해석과 충돌할 수 있다. GEOB_JAE 조합은 현재 근거 범위에 포함하지 않는다.
   현재 테스트는 동작을 고정할 뿐 authority 정당성을 증명하지 않는다.
2. 비겁 후보를 격 선택에서 제외한 것은 맞지만 같은 filtered 배열을 purity/mixed 품질
   계산에도 사용해, 노출 겁재가 있는데 `QING/mixed:false`와 `겁재 투출 파격`이 동시에
   나오는 내부 모순이 생긴다. 선택 후보와 노출 증거 집합을 분리해야 한다.

Stack 23은 2번을 코드로 해소했다. `computeMonthGyeokQuality`의 gap은 선택 가능 후보만,
purity/mixed는 선택 제외 후보를 포함한 전체 투간 증거를 사용한다. 유효 명식
`己巳/戊辰/甲子/乙亥`는 편재격 선택을 유지하면서 노출 겁재를
`mixed:true/ZHUO`와 `PAGYEOK/GEOB_JAE`에 일관되게 반영한다. 표적 42/42,
관련 격국 70/70, 기본 17/17 및 후보 261/261 회귀가 통과했다.

1번 BI_GYEON 4조합의 학파·권위 결정은 계속 open P1이다. 또한 2번 수정은
기본 17·후보 261 snapshot 밖에서 품질 결과를 바꾸므로 영향 검토 P1
`QUALITY_EVIDENCE_DEFAULT_IMPACT_REVIEW`도 별도로 open이다. 합법 4주 격자의
결정론적 표본 5,133건 중 126건(2.4547%)이 바뀌었으며, 이는 인구·서비스 트래픽
발생률 추정치가 아니다. 재현 규약과 한계는
[Stack 23 영향 dossier](../stack23-gyeok-quality-evidence-2026-07-13/DOSSIER.md)에 고정한다.

Stack 18의 예전 PR tip은 Stack 23의 코드 수정과 global blocker gate를 소급 포함하지 않는다.
따라서 Stack 18은 top-level registry와 별개로도 수동 Draft hold를 유지한다.

## 승인 전 확인 사항

1. fix-06의 양인격→정인격이 월지 본기와 구조격 조건에 맞는가.
2. fix-07의 월겁격→정인격이 일간 자기 투간 제외 후의 월령 취용에 맞는가.
3. fix-11의 건록격→식신격이 시간미상 정오 fallback에서도 안정적인가.
4. confidence 5건의 방향과 크기가 선택 근거·품질 점수와 일관되는가.
5. 후보 snapshot 9건의 구성·순위 변화까지 함께 승인하는가.

현재 spring_ts_snapshot.json 재캡처는 exact diff를 Git에 노출하기 위한 review artifact다.
approval manifest는 pending이며, 독립 검토 전 Ready 또는 merge 근거가 아니다.
기계 판독 요약은 [attribution.json](./attribution.json)에 고정한다.
