# 스택 23 격국 품질 증거 분리 영향 dossier

> 상태: **snapshot-invisible default change · 독립 영향 검토 대기(P1)**
> blocker: `QUALITY_EVIDENCE_DEFAULT_IMPACT_REVIEW`
> 비교 기준: Stack 22 `3011d1904bfe71c7005e234b4c0698b41dc686fb`
> 기계 판독본: [impact-sample.json](./impact-sample.json)

## 결론

Stack 23은 일반 월령격의 **선택 후보 집합**과 **품질 판정을 위한 투간 증거 집합**을
분리한다. 비겁 후보를 일반격 선택에서 제외하는 정책은 유지하면서, 선택에서 제외된
비견·겁재가 실제로 투간했다면 순도(`purity`), 혼잡 여부(`mixed`), 청탁(`clarity`)과
품질 배율(`multiplier`)의 증거에는 남긴다. 이로써 노출 겁재가 있는데도
`QING/mixed:false`와 `PAGYEOK/GEOB_JAE`가 동시에 나올 수 있던 내부 모순을 해소한다.

코드 방향은 선택 자격과 관측 증거의 의미를 분리한다는 점에서 논리적으로 일관된다.
그러나 이 사실은 명리 권위 승인, 품질 계수 승인 또는 기본값의 상용 배포 승인을
뜻하지 않는다. 17개 기본 snapshot과 261개 격국 후보 snapshot이 모두 그대로여서
기존 회귀 묶음만으로는 이 변경의 기본 경로 영향을 관측할 수 없다. 따라서 P1
`QUALITY_EVIDENCE_DEFAULT_IMPACT_REVIEW`는 독립 영향 검토가 끝날 때까지 open이다.

## 변경 경계

변경 전에는 품질 계산의 투간 십성 집합에도 일반격으로 선택 가능한 후보만 사용했다.
변경 후에는 다음처럼 책임을 나눈다.

- gap 및 일반격 선택 자격: 기존과 동일한 filtered selection candidates
- purity/mixed 품질 증거: 선택 제외 후보를 포함한 all visible candidates
- 일반격 후보를 만드는 규칙과 그 입력: 변경 없음
- 품질 증거 변화 가능 필드: `purity`, `mixed`, `clarity`, `multiplier`
- 후속 영향: 품질 배율이 격국 후보 경쟁에 사용되므로 최종 격국 순위·confidence가
  바뀔 가능성은 있으며, 이를 "선택 후보 불변"과 혼동하면 안 된다.

즉, 후보 자격을 새로 부여한 변경이 아니라 이미 관측된 투간을 품질 증거에서
누락하지 않게 한 변경이다.

## 결정론적 영향 표본

실사용자 분포가 아닌 간지 규칙 충족 조합 격자를 대상으로 정적·결정론적 표본을
구성했다.

- 전체 격자: `60 년주 × 60 일주 × 12 월지 × 12 시지 = 518,400`
- 순회 순서: `yearCycle(0..59) → dayCycle(0..59) → monthBranch(0..11) → hourBranch(0..11)`
- 표본 규칙: 위 중첩 순회의 0-base linear index가 `index % 101 === 0`
- 표본 수: 5,133
- 월간: 오호둔 규칙
  `(((yearStem % 5) * 2 + 2 + ((monthBranch - 2) % 12 + 12) % 12) % 10)`
- 시간: 오서둔 규칙 `(((dayStem % 5) * 2 + hourBranch) % 10)`
- 실행 경로: `normalizeConfig({})` → `elementDistributionFromPillars` →
  `scorePillarsForRuleFacts(DEFAULT_SCORE_POLICY)` → `buildRuleFacts`
- 영향 판정: 선택에서 제외된 visible companion evidence가 존재하고, 변경 후의
  visible ten-god evidence 집합이 변경 전보다 커져 실제 품질 결과가 달라진 경우

이 표본은 난수 추출이 아니며 실제 생년월일·지역·성별·서비스 사용자 분포를
가중하지 않는다. 따라서 아래 비율은 사용자 발생률, 인구 유병률, 시장 영향률 또는
통계적 추정치가 아니다. 신뢰구간도 부여하지 않는다.

## 결과

| 항목 | 건수 | 표본 대비 |
|---|---:|---:|
| 전체 표본 | 5,133 | 100% |
| 선택 제외 visible companion evidence 존재 | 358 | 6.9745% |
| 품질 결과 실제 변화 | 126 | **2.4547%** |

126건의 선택된 일반격별 분포는 다음과 같고 합계는 정확히 126이다.

| 일반격 | 변화 건수 |
|---|---:|
| 편관격 (`PYEON_GWAN`) | 17 |
| 편재격 (`PYEON_JAE`) | 10 |
| 식신격 (`SIK_SHIN`) | 14 |
| 정재격 (`JEONG_JAE`) | 11 |
| 편인격 (`PYEON_IN`) | 21 |
| 상관격 (`SANG_GWAN`) | 12 |
| 정인격 (`JEONG_IN`) | 26 |
| 정관격 (`JEONG_GWAN`) | 15 |

이 결과는 결함이 한 격에만 국한되지 않고 8개 일반격 모두에 걸쳐 있음을 보여준다.
반대로 2.4547%를 실제 사용자 영향률로 해석할 근거는 제공하지 않는다.

## 회귀 증거와 탐지 한계

- 표적 구조격 테스트: 42/42 PASS
- 관련 격국 테스트: 70/70 PASS
- 기본 snapshot: 17/17 PASS, diff 없음
- 격국 후보 snapshot: 261/261 PASS, diff 없음

기본·후보 snapshot의 무변은 기존 고정 사례에서 회귀가 없다는 증거일 뿐, 표본에서
확인된 126건의 기본 동작 변화가 없다는 증거가 아니다. 이 변경을
`snapshot-invisible default change`로 분류하는 이유다.

## 승인 한계와 P1 종료 조건

현재 확인된 것은 다음 두 가지뿐이다.

1. 선택 후보와 품질 증거를 같은 filtered 배열로 사용하던 내부 의미 충돌이 있었다.
2. 두 집합을 분리하면 5,133개 결정론적 표본 중 126개에서 품질 결과가 달라진다.

다음은 아직 확인되지 않았다.

- 126건의 변경 방향이 각 격의 권위 규칙과 모두 부합하는지
- 현행 purity/clarity/multiplier 계수 자체가 명리적으로 승인 가능한지
- 실제 서비스 트래픽에서의 빈도와 최종 보고서 영향 크기
- 토 일간 잡기월의 별도 구조격 호환 P1

따라서 독립 검토자가 표본 구성과 변화 레코드를 재현하고, 대표 경계 사례의 방향과
상용 기본값 영향 범위를 승인하기 전에는 blocker를 닫지 않는다. 테스트 통과나 이
dossier 자체를 Ready 전환 또는 merge 승인으로 사용해서는 안 된다.
