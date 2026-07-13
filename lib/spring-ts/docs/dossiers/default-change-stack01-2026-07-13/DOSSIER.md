# 스택 01 기본 출력 변화 재귀속 dossier

> 상태: **독립 승인 대기(pending)**
> 대상: `origin/main@354fa60a4 → a4f443347`
> fingerprint: `sha256:2ca4ddcf743061692aa6e0900ee5d20e04aee134cb6c63954af38afca6c51bfc`

## 결론

스택 01 스냅샷의 후보 점수 상승은 await 누락 수정이나 main 드리프트 때문이 아니다.
실제 원인은 `79042afdc`가 첫 번째 용신 추천의 잘못된 `JOHU` 라벨을
`EOKBU`로 바로잡은 것이다. 이 타입은 Spring 이름 점수에서 표시용 라벨만이
아니라 타입 가중 계수와 contextual/adaptive 배분의 입력으로도 쓰인다. 따라서
타입 가중 계수가 0.95에서 1.0으로 바뀌는 동시에 contextual priority와
balance↔yongshin adaptive weight shift도 함께 변했다.

- 영향: 15픽스처 중 14개, `candidatesTop5[].finalScore` 63개
- 변화량: +0.1 38개, +0.2 20개, +0.3 5개
- 후보 이름·순서·사주 판정·운세 카드는 불변
- 승인 상태: pending. 이 문서는 원인 귀속 증거이지 승인 자체가 아니다.

## 재현 절차와 반증

2026-07-13에 별도 worktree에서 다음 세 상태를 실제 재캡처했다.

1. `origin/main@354fa60a4`에 `baseline_snapshot.ts`의 await 세 줄만 적용
2. `053b1f9ec`(palace 본기 수정과 죽은 룰 정리까지 포함)에 같은 await 수정 적용
3. 스택 01 저장 스냅샷(`a4f443347`, 재캡처 carrier는 `3d65a56cf`)

1과 2의 결과는 origin/main 저장 스냅샷과 `capturedAt` 외 모든 leaf가 동일했다.
따라서 `ed78a0638`, `053b1f9ec`, await 수정 자체는 후보 점수 상승 원인이 아니다.
반면 2 다음 커밋 `79042afdc` 이후 저장 스냅샷에는 정확히 위 63개 상승만 나타났다.

`79042afdc`의 관련 코드 변화는 첫 추천 타입을 `JOHU`에서 `EOKBU`로
정정한 것이다. Spring의 `saju-scoring.json`은 EOKBU 1.0, JOHU 0.95로
서로 다른 가중치를 사용한다. 또한 `contextualTypes`에는 JOHU가 포함되지만
EOKBU는 포함되지 않는다. `computeRecommendationScore`는 이 차이를
`contextualPriority`에 반영하고, `resolveAdaptiveWeights`는 그 값을 이용해
balance와 yongshin 사이의 weight shift를 계산한다. 따라서 라벨 정정은 표시
변경에 그치지 않고 아래 세 경로를 통해 이름 점수에 작게 반영된다.

1. 첫 추천의 type-weight policy coefficient: 0.95 → 1.0
2. contextual membership: true(JOHU) → false(EOKBU)
3. contextual priority를 입력으로 쓰는 adaptive balance↔yongshin 배분

63개 변화의 기계적 귀속은 재현됐지만, EOKBU 1.0·JOHU 0.95와
`contextualTypes` 구성은 고전 정설이나 authority calibration 결과가 아니라
현재 Spring 제품의 provisional 튜닝 정책이다.

## 판단

라벨 정정 방향은 Stack 01 기본 정책(balance=1, role=1, climate=0)의 실제
첫 추천 축(억부)에 맞는다. 다만 점수 정책까지 변하는 default change이므로
“계측기 복구”로 자동 승인할 수 없다. 표기 계약 승인과 제품 점수정책 승인을
분리해야 한다.

Ready 전 독립 리뷰어가 다음을 확인해야 한다.

1. Stack 01 기본 정책의 첫 추천 축을 EOKBU로 분류하는 계약이 맞는가.
2. EOKBU 1.0 대 JOHU 0.95의 provisional 제품 가중 정책을 잠정 유지하는가.
3. JOHU는 contextual이고 EOKBU는 비contextual인 현재 정책과 그 adaptive 배분 파급을 허용하는가.
4. 63개 +0.1~+0.3 변화와 후보 순위 불변을 승인하는가.
5. 승인 시 정확 fingerprint와 리뷰어·일자·증거를 approval manifest에 기록하는가.

1만 승인되고 2~3이 보류되면 표기 정정은 타당해도 이 fingerprint는 승인할 수
없다. 1~4가 모두 승인되어야 approval manifest를 `approved`로 바꿀 수 있다.

기계 판독 요약은 [attribution.json](./attribution.json)에 고정한다.
