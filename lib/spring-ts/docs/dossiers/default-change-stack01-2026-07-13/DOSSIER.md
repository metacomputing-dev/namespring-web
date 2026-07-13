# 스택 01 기본 출력 변화 재귀속 dossier

> 상태: **독립 승인 대기(pending)**
> 대상: `origin/main@354fa60a4 → a4f443347`
> fingerprint: `sha256:2ca4ddcf743061692aa6e0900ee5d20e04aee134cb6c63954af38afca6c51bfc`

## 결론

스택 01 스냅샷의 후보 점수 상승은 await 누락 수정이나 main 드리프트 때문이 아니다.
실제 원인은 `79042afdc`가 첫 번째 용신 추천의 잘못된 `JOHU` 라벨을
`EOKBU`로 바로잡으면서 Spring 이름 점수의 방법별 가중치가 0.95에서 1.0으로
바뀐 것이다.

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
서로 다른 가중치를 사용하므로, 라벨 정정은 표시 변경에 그치지 않고 이름 점수에
작게 반영된다.

## 판단

라벨 정정 방향은 엔진의 실제 첫 추천 축(억부)에 맞는다. 다만 점수 정책까지
변하는 default change이므로 “계측기 복구”로 자동 승인할 수 없다.

Ready 전 독립 리뷰어가 다음을 확인해야 한다.

1. 첫 추천 축을 EOKBU로 분류하는 계약이 맞는가.
2. EOKBU 1.0 대 JOHU 0.95의 기존 가중 정책을 그대로 적용하는가.
3. 63개 +0.1~+0.3 변화와 후보 순위 불변을 승인하는가.
4. 승인 시 정확 fingerprint와 리뷰어·일자·증거를 approval manifest에 기록하는가.

기계 판독 요약은 [attribution.json](./attribution.json)에 고정한다.
