# PR #653 기본 출력 변경 리뷰 도시에 (default-change dossier)

> **목적**: `origin/main → HEAD`의 기본 모드 출력 변경(17픽스처 전수, leaf diff 183건)을
> 리뷰어가 **필드 단위로 승인/반려**할 수 있도록, 모든 변경을 원인 커밋에 귀속시키고
> 명리학적 방향 근거를 붙인 정본 증거 문서.
> **생성 방법**: `node tools/measure_default_change.mjs --baseline origin/main --branch HEAD`
> + 스냅샷 변경 커밋 시퀀스(아래 §2)의 인접쌍 `buildSnapshotDiff` 전수 귀속(기계 생성, 2026-07-10).
> **승인 절차**: §6. 이 문서 자체는 증거이지 승인이 아니다 — fingerprint 승인 권한은 독립 리뷰어에게 있다.

## 1. 총괄

| 항목 | 값 |
|---|---|
| 대상 | `test/baseline/spring_ts_snapshot.json` (기본 모드 17픽스처) |
| leaf diff | 183건 / 17픽스처 (판정 필드 변화는 7픽스처, 그중 신규 픽스처 2) |
| fingerprint | `measure_default_change` 실행 결과의 `approval.fingerprint` — 승인 시점에 반드시 재실행해 최신 값 확인 |
| 회귀(regression) 분류 | **0건** (분류기: 필드 소실·구조 붕괴·범위 이탈) |
| 방향 불명(categorical) | 5픽스처 (fix-03·05·06·07·11) — 본 문서 §4에서 항목별 논증 |

**분류 요약**: 183건 = 이름 후보 점수/구성 변화(다수) + 격국 confidence 이동(17픽스처 전부)
+ 판정 categorical 변화(5픽스처) + 운세 별점 변동(5픽스처) + 신규 픽스처 2건(fix-16/17 전체).

## 2. 원인 커밋 전수 귀속

스냅샷을 바꾼 커밋은 정확히 13개다. 각 커밋의 leaf 변경 수와 성격:

| 커밋 | 내용 | leaf 수 | 성격 |
|---|---|---|---|
| `3d65a56cf` | await 누락 수정 + 재캡처 carrier (PR-1) | 63 | **실제 원인 `79042afdc`** — 첫 추천 타입 JOHU→EOKBU 정정으로 방법 가중치 0.95→1.0. await-only 재현은 점수 무변. 상세는 `docs/dossiers/default-change-stack01-2026-07-13/` |
| `1f6090919` | 신강약 base → deLingDiShi(월지 가중) 전환 [감사 B7] | 32 | 판정 모델 기본화 (결정 ②) |
| `32a740129` | 조후 개입 기본화 — climate 0.25 + 조후위급 게이트 [감사 B6·A2] | 104 | 판정 모델 기본화 (결정 ②) — 희신·별점·이름점수 파급 최대 축 |
| `416c0d845` | 종격 게이트 — 리스크 신호 + 억부 확신 감쇠 [감사 B5] | 5 | 종격 리스크 명식의 confidence 감쇠 |
| `ea2f8366a` | 건록격/양인격/월겁격 신설 [감사 B4] | 4 | **격명 현대화** (계산 불변, 명명만) |
| `b7ff328f8` | 일주 경계 기본 정자시설 전환 [결정①·감사 A11] | 30 | 역법 정책 기본화 — fix-03 명식 자체 변경 |
| `28751758d` | 합충 상호작용 → 신강약 주입 [PR-5] | 23 | 판정 모델 기본화 |
| `2a98bab3d` | 격국 damage 탐합망충 해소 [PR-5] | 1 | fix-11 confidence 소폭 회복 |
| `8401cfbab` | seasonal(왕상휴수) + positional(궁위 감쇠) 기본 on [PR-10-1/2] | 2 | fix-14 이름점수 +0.1×2 (순위 불변) |
| `75c3cdef5` | 17픽스처 확장 (야자시 창 + 음력 윤달) [P0-3] | 2 | **신규 픽스처** fix-16/17 (main에 부재) |
| `a9f27f52b` | 관성 천간합 pressure 감쇠(합거) 기본 on [PR-10-3] | 22 | 이름 후보 재배열(판정 필드 불변) |
| `5fe356482` | 성패(成敗) 점수 통합 v0 재캡처 [PR-10-4] | 17 | **17픽스처 전부의 gyeokgukConfidence 이동** |
| `c132da72a` | 성패 v1 — 회지 상신 인정 [PR-10-5] | 2 | fix-09/14 confidence 부분 회복 |

각 기본화 커밋은 랜딩 당시 §계측 절차(로드맵 §2)를 통과했고 수치가 커밋 메시지·로드맵 §9에
기록돼 있다. 필드×커밋 전수 귀속 원본(JSON)은 이 문서와 같은 방법으로 재생성 가능하다.

## 3. 판정 필드 변화 전수표 (기계 귀속)

| 픽스처 | 필드 | main → HEAD | 원인 커밋(체인) |
|---|---|---|---|
| fix-03 | dayMaster.stem | 정(丁) → 무(戊) | b7ff328f8 |
| fix-03 | gyeokgukType | 편관격 → 정재격 | b7ff328f8 |
| fix-03 | strengthLevel | 중화(신약 경향) → 중화(신강 경향) | b7ff328f8 |
| fix-03 | yongshinElement / Heeshin | WOOD→FIRE / EARTH→FIRE→METAL | 32a740129 → b7ff328f8 |
| fix-03 | isStrong | false → true | b7ff328f8 |
| fix-03 | deficient/excessive | []→[METAL] / []→[WATER] | b7ff328f8 |
| fix-05 | strengthLevel | 신약 → 중화(신약 경향) | 1f6090919 (동일 band) |
| fix-05 | gyeokgukType | 비견격 → 건록격 | ea2f8366a (동등 격명) |
| fix-05 | yongshinHeeshin | WATER → FIRE | 32a740129 |
| fix-06 | gyeokgukType | 겁재격 → 양인격 | ea2f8366a (동등 격명) |
| fix-06 | yongshinHeeshin | WOOD → WATER | 32a740129 |
| fix-07 | gyeokgukType | 겁재격 → 월겁격 | ea2f8366a (동등 격명) |
| fix-07 | yongshinHeeshin | WOOD → METAL | 1f6090919 |
| fix-11 | gyeokgukType | 비견격 → 건록격 | ea2f8366a (동등 격명) |
| fix-14 | yongshinHeeshin | FIRE → EARTH | 32a740129 |
| 전 픽스처 | gyeokgukConfidence | 이동 (±0.2 이내) | 5fe356482(성패 v0) ± c132da72a(v1)·416c0d845·2a98bab3d·b7ff328f8 |
| fix-03/05/06/07/08/13/14 | 운세 별점 | ±1~2 | 32a740129 · 1f6090919 · b7ff328f8 |
| fix-16/17 | (신규) | — | 75c3cdef5 |

## 4. 방향 논증 (리뷰어 판단 자료)

### 4-1. fix-03 — 명식 자체가 바뀐 유일한 픽스처 (子時 경계, 2000-01-01 00:30)

`b7ff328f8`가 일주 경계를 **정자시설(자정 경계, 감사 결정 ①)**로 전환하면서 이 출생시각의
일주가 이동했다(丁→戊). 격국·용신·강약·오행 분포는 모두 **바뀐 명식의 정상 재계산 결과**다.
리뷰 포인트는 개별 필드가 아니라 **정자시설 채택 그 자체**다:
- 근거: 감사 A11 — 종전 기본(야자시 이중 보정)은 23:30~23:59 창에서 시주·일주 불일치를
  낳았고, 정자시설+경도 보정 단일화가 결정 ①로 확정됨(`TIME_POLICY.md`, 감사 보고서 §3).
- 야자시 사용자를 위한 옵션(`JOJA_SPLIT` 포함)은 opt-in으로 보존(PR-12-8).
- 검증: 경계 골든 867/0, 야자시 opt-in 4/0, 신규 fix-16(23:40 창)이 창 동작을 고정.

### 4-2. 격명 현대화 (fix-05·06·07·11) — 계산 불변

`ea2f8366a`는 월지 비겁 명식의 격명을 비견격/겁재격 → **건록격/양인격/월겁격**(주류 명명)으로
바꿨다. 선정 로직·점수 불변, 표기만 변경(감사 B4). 오라클 대조기는 `GYEOKGUK_EQUIV`로 동등
매핑하므로 외부 비교 회귀 없음. 명리 근거: 월지 비겁은 팔격에 넣지 않고 건록·양인(월겁)으로
따로 명명하는 것이 『자평진전』 이래 주류 관행.

### 4-3. 신강약 모델 (fix-05 신약→중화(신약 경향))

`1f6090919`(deLingDiShi 월지 가중, 결정 ②)의 유일한 레벨 표기 변화이며 **band 불변**(weak).
게이트의 `STRENGTH_BAND` 동등성 기준으로도 동일 band다. 월령 가중은 억부 판정의 표준
관행(득령·득지·득세)이라 방향은 교리 정합.

### 4-4. 조후 개입 (희신 변화 3건 + 별점 변동)

`32a740129`(climate 0.25 + 조후위급, 결정 ②)의 파급:
- fix-05(2005-12-25 06:00, 한랭 겨울생): 희신 WATER→**FIRE**. 겨울 한랭 명식에서 조후
  화(火)를 세우는 것은 『궁통보감』 조후의 정면 사례 — **이 픽스처가 조후 기본화의 목적 그 자체**.
- fix-06(여름 庚金): 희신 WOOD→WATER — 하월 금일간의 조후(임수 우선) 방향.
- fix-14(가을 정관격): 희신 FIRE→EARTH — 용신 WOOD 유지, 희신만 조후 반영 조정.
- 별점 변동은 희신 변화가 운세 매칭에 반영된 2차 파급.

### 4-5. 격국 confidence 이동 (17픽스처 전부)

`5fe356482`(성패 점수 통합)는 격국 성패(成敗) verdict를 월령 격국 score에 배율로 반영한다.
방향성: **성격(成格) 요인이 있으면 상승**(fix-12 0.92→0.99, fix-13 0.96→1.0, fix-15 0.98→1.0),
**파격(破格) 요인이 있으면 하락**(fix-08 0.88→0.66, fix-10 0.80→0.60). 파격 명식의 확신을
낮추는 것은 『자평진전』 성패·구응 교리의 수학화이며, 하락 자체가 품질 저하가 아니라
**과잉 확신의 교정**이다. `c132da72a`(회지 상신 인정)는 월지 지장간 상신을 성격 요인으로
복권시켜 fix-09/14를 부분 회복 — 투간만 보던 v0의 보수 편향 교정.

### 4-6. 이름 후보 점수/구성 변화

PR-1의 63개 `finalScore` 상승은 계측기 수정 때문이 아니다. 2026-07-13 재현에서
`origin/main + await-only`와 `053b1f9ec + await-only`는 각각 저장 baseline과 `capturedAt` 외
모든 leaf가 같았다. 실제 원인은 `79042afdc`가 첫 추천 타입을 JOHU에서 EOKBU로 바로잡아
Spring 방법 가중치가 0.95→1.0으로 바뀐 것이다. 14픽스처에서 +0.1 38개, +0.2 20개,
+0.3 5개이며 후보 이름·순서는 불변이다. 이 변화는 표시 정직성 수정의 점수 파급이므로
독립 승인이 필요하며 `docs/dossiers/default-change-stack01-2026-07-13/`에 재현 증거를 고정했다.
그 밖의 이름 축 변화는 보완 오행 변경과 `8401cfbab`·`a9f27f52b`의 미세 가점에서 온다.

### 4-7. 신규 픽스처 (fix-16/17)

`75c3cdef5` — 야자시 창(23:40)과 음력 윤달 입력. main에 존재하지 않으므로 "변경"이 아니라
**커버리지 추가**. 회귀 개념 없음.

## 5. 리뷰어가 반박·확인할 포인트

1. fix-03: 정자시설 전환 자체에 동의하는가? (반대 시 이 픽스처의 모든 diff가 반려 대상)
2. fix-05 희신 FIRE: 조후 위급 판정의 개입 강도(0.25)가 과한가? — `32a740129`의 계측 기록 대조.
3. confidence 하락 2건(fix-08/10): 해당 명식의 파격 요인(damage 관계)을 엔진 트레이스
   (`gyeokguk.quality.details`)로 직접 확인 — PR-12-2가 노출한 basis로 검증 가능.
4. 격명 현대화: 서비스 사용자 문구(카드)에서 구 격명 잔존 여부 — `test:service-visible-output` 13/0.
5. 이름 순위 변화가 큰 픽스처(fix-03/05)의 상위 후보가 실제로 보완 오행 정합적인지 표본 확인.

## 6. 승인 절차 (독립 리뷰어용)

1. `cd lib/spring-ts && node tools/measure_default_change.mjs --baseline origin/main --branch HEAD`
   실행 → 출력의 `Approval: PENDING (sha256:…)` fingerprint를 확인한다(HEAD가 바뀌면
   fingerprint도 바뀐다 — 반드시 승인 시점 값 사용).
2. §3~§5를 검토하고, 필요한 픽스처는 스냅샷 원본(`test/baseline/spring_ts_snapshot.json`)과
   엔진 트레이스로 직접 재확인한다.
3. 승인 시 `test/baseline/default-change-approvals.json`의 해당 fingerprint 엔트리를
   `status: "approved"`, `reviewedBy: "<실명>"`, `reviewedAt: "YYYY-MM-DD"`로 갱신하고
   `evidence[]`에 최소 1건 — 예:
   `{ "kind": "dossier", "reference": "docs/REVIEW_DEFAULT_CHANGE_PR653.md", "summary": "커밋 귀속·방향 논증 검토 완료" }`
   — 를 기록한다.
4. `npm run test:measure-default-change`와 `npm run test:composite-quality-gate`가 PASS로
   전환되는지 확인한다. **구조 회귀(필드 소실)는 승인으로 우회되지 않는다**(분류기가 차단).

## 7. 후속 opt-in: 일간 자기 셈입 제거 (기본화 미승인)

`4eefcd154`는 `strategies.strength.excludeDayMasterSelf=true`일 때만 일간의 직접 비견
기여를 강약 원장에서 제외한다. 기본값은 off라 이 문서 §1의 기존 `origin/main → HEAD`
승인 대상 스냅샷을 바꾸지 않는다.

임시 default-on 캡처를 직전 HEAD와 비교한 별도 증분 결과:

| 항목 | 값 |
|---|---|
| 판정 | `REVIEW_REQUIRED` |
| fixture / leaf | 17 / 158 |
| 분류 | review 7 / regression 0 / unchanged 10 |
| 강약 표면 이동 | fix-03·04·12·16 강→약 hedge, fix-05·11 중화약→신약, fix-15 신강→중화강 |
| 2차 파급 | 희신 6건, 종격 위험/경고 4건, 서사 golden 17건, 이름 후보 점수·순위 |
| fingerprint | `sha256:3772274798d96e9e9fe1b9a7ad5a2b72ef6b918b967242066b99f5169fb69143` |

이 fingerprint는 **승인되지 않았다**. 특히 희신·종격·서사 기대값을 현재 엔진 출력으로
재캡처하는 것은 순환 검증이므로 금지한다. 외부 명리 전문가가 158 leaf의 방향과 fix-04
메타 정정(`甲木 / 申月`)을 확인한 뒤에만 기본값 전환과 새 누적 fingerprint 승인을 진행한다.

## 8. Stack 18 F1: 일간 자기 투간·비겁 구조격 오분류 수정 (승인 대기)

0416c3daa는 일간을 년·월·시간과 같은 투간 증거로 보던 오류를 제거하고,
구조적 근거가 없는 비겁 지장간 후보의 일반 격 승격을 막는다. 재실측 결과는
5픽스처·8 leaf, fingerprint
sha256:6018d66d34e3875e22cb8924f01221b41bfaa9adaa1c9993ff3ddadd809440a0로
커밋 메시지와 일치한다. 격명은 fix-06 양인격→정인격, fix-07 월겁격→정인격,
fix-11 건록격→식신격이며 나머지 5 leaf는 confidence다.

후보 snapshot도 9픽스처 변화(sha256:b05f310745c6ae1ff15a0e90abb090affc51139afe991635b2115cae0c66c746)가
별도로 남아 있으므로 같은 명리 검토에서 함께 승인해야 한다. 정본은
docs/dossiers/default-change-stack18-gyeok-transparency-2026-07-13/이다.
재캡처와 pending manifest는 exact diff 노출 수단일 뿐 승인 자체가 아니며,
독립 검토 전 Stack 18 및 후속 스택을 Ready로 전환하지 않는다.
